import crypto from "crypto";
import { Router } from "express";
import { getAnalyticsSnapshot } from "../analyticsStore.js";

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

  router.get("/analytics", requireAdminAuth, (req, res) => {
    const analytics = getAnalyticsSnapshot();
    return res.json(analytics);
  });

  router.post("/logout", requireAdminAuth, (req, res) => {
    if (req.adminToken) {
      activeTokens.delete(req.adminToken);
    }
    return res.status(204).send();
  });

  return router;
}
