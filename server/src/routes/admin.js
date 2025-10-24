import crypto from "crypto";
import { Router } from "express";
import { getAnalyticsSnapshot } from "../analyticsStore.js";
import { getAnalyticsSnapshotMongo } from "../analyticsStore.mongo.js";
import { getDb } from "../mongo.js";

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Mindx@2024";
const TOKEN_TTL_MS = Number(process.env.ADMIN_TOKEN_TTL_MS || 1000 * 60 * 60 * 8);

const activeTokens = new Map();

function createToken(username) {
  const token = crypto.randomUUID();
  const issuedAt = Date.now();
  activeTokens.set(token, {
    username,
    issuedAt,
    expiresAt: issuedAt + TOKEN_TTL_MS
  });
  return token;
}

function validateToken(token) {
  if (!token) return null;
  const entry = activeTokens.get(token);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    activeTokens.delete(token);
    return null;
  }
  return entry;
}

function requireAdminAuth(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;
  const entry = validateToken(token);
  if (!entry) {
    return res.status(401).json({ error: "Phiên đăng nhập đã hết hạn hoặc không hợp lệ." });
  }
  req.admin = entry;
  req.adminToken = token;
  return next();
}

setInterval(() => {
  const now = Date.now();
  for (const [token, entry] of activeTokens.entries()) {
    if (entry.expiresAt < now) {
      activeTokens.delete(token);
    }
  }
}, 60 * 1000).unref?.();

export function createAdminRouter() {
  const router = Router();

  router.post("/login", (req, res) => {
    const { username, password } = req.body || {};

    if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
      return res.status(401).json({ error: "Tài khoản hoặc mật khẩu không đúng." });
    }

    const token = createToken(username);
    const entry = activeTokens.get(token);

    return res.json({
      token,
      expiresAt: new Date(entry.expiresAt).toISOString()
    });
  });

  router.get("/analytics", requireAdminAuth, async (req, res) => {
    try {
      const classFilter = req.query.classFilter || "";
      const mongoAnalytics = await getAnalyticsSnapshotMongo(classFilter);
      if (mongoAnalytics) {
        return res.json(mongoAnalytics);
      }
    } catch (err) {
      console.warn("Không thể lấy analytics từ Mongo, fallback bộ nhớ:", err);
    }
    const classFilter = req.query.classFilter || "";
    const analytics = getAnalyticsSnapshot(classFilter);
    return res.json(analytics);
  });

  router.post("/logout", requireAdminAuth, (req, res) => {
    if (req.adminToken) {
      activeTokens.delete(req.adminToken);
    }
    return res.status(204).send();
  });

  router.get("/student-chat/:studentName", requireAdminAuth, async (req, res) => {
    try {
      const { studentName } = req.params;
      const { classFilter } = req.query;
      
      console.log(`[DEBUG] Getting chat history for student: ${studentName}, classFilter: ${classFilter}`);
      
      // Get chat history from MongoDB
      const db = getDb();
      if (!db) {
        return res.status(500).json({ error: "Database not available" });
      }
      
      const sessionsCol = db.collection("sessions");
      const messagesCol = db.collection("messages");
      
      // Build query for sessions
      let sessionQuery = {
        "latestProfile.name": { $regex: studentName, $options: "i" }
      };
      
      // Add class filter if provided
      if (classFilter) {
        const normalizedFilter = classFilter.toLowerCase();
        if (normalizedFilter.length <= 3) {
          // Center filter
          sessionQuery["latestProfile.grade"] = { $regex: `^${classFilter}-`, $options: "i" };
        } else {
          // Class filter
          sessionQuery["latestProfile.grade"] = { $regex: `-${classFilter}$`, $options: "i" };
        }
      }
      
      console.log(`[DEBUG] Session query:`, JSON.stringify(sessionQuery, null, 2));
      
      // Find sessions for this student
      const sessions = await sessionsCol.find(sessionQuery).toArray();
      console.log(`[DEBUG] Found ${sessions.length} sessions for student ${studentName}`);
      
      if (sessions.length === 0) {
        return res.json([]);
      }
      
      const sessionIds = sessions.map(s => s.id);
      
      // Get messages for these sessions
      const messages = await messagesCol
        .find({ sessionId: { $in: sessionIds } })
        .sort({ timestamp: 1 })
        .toArray();
      
      console.log(`[DEBUG] Found ${messages.length} messages for student ${studentName}`);
      
      // Format messages for frontend
      const chatHistory = messages.map(msg => ({
        id: msg._id.toString(),
        timestamp: msg.timestamp,
        role: msg.role,
        content: msg.content,
        sessionId: msg.sessionId
      }));
      
      return res.json(chatHistory);
      
    } catch (error) {
      console.error("Error getting student chat history:", error);
      return res.status(500).json({ error: "Failed to get chat history" });
    }
  });

  return router;
}
