import crypto from "crypto";

const sessions = new Map();
const messageHistory = [];
const referenceTotals = new Map();
const keywordTotals = new Map();
let totalAttachmentCount = 0;

const MAX_MESSAGE_HISTORY = 2000;

const STOPWORDS = new Set([
  "cua",
  "cho",
  "voi",
  "nay",
  "noi",
  "nay",
  "nay",
  "hay",
  "anh",
  "chi",
  "em",
  "co",
  "thi",
  "la",
  "va",
  "mot",
  "nhung",
  "cac",
  "nhu",
  "nua",
  "ban",
  "hoc",
  "hai",
  "lam",
  "theo",
  "day",
  "nen",
  "thoi",
  "van",
  "duoc",
  "khi",
  "neu",
  "gio",
  "de",
  "cach",
  "trong",
  "minh",
  "thu",
  "dang",
  "con",
  "gap",
  "truong",
  "nhieu"
]);

function incrementMap(map, key, amount = 1) {
  if (!key) return;
  map.set(key, (map.get(key) ?? 0) + amount);
}

function normalizeKeyword(word) {
  return word
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function addKeywordsFromText(text) {
  if (!text) return;
  const sanitized = String(text)
    .replace(/[0-9]+/g, " ")
    .replace(/["'`.,!?():;\-_/\\\[\]{}<>\n\r]+/g, " ");

  for (const rawWord of sanitized.split(/\s+/)) {
    if (!rawWord) continue;
    if (rawWord.length < 4) continue;
    const normalized = normalizeKeyword(rawWord);
    if (!normalized || STOPWORDS.has(normalized)) continue;
    const existing = keywordTotals.get(normalized) ?? { keyword: rawWord, count: 0 };
    existing.count += 1;
    if (rawWord.length > existing.keyword.length) {
      existing.keyword = rawWord;
    }
    keywordTotals.set(normalized, existing);
  }
}

function deriveSessionTitle(text) {
  if (!text) {
    return "Cuộc trò chuyện mới";
  }
  const firstLine = text.trim().split(/\n/)[0];
  if (!firstLine) {
    return "Cuộc trò chuyện mới";
  }
  return firstLine.length > 48 ? `${firstLine.slice(0, 48)}…` : firstLine;
}

function truncateContent(text, limit = 600) {
  if (!text) return "";
  const trimmed = text.trim();
  if (trimmed.length <= limit) {
    return trimmed;
  }
  return `${trimmed.slice(0, limit)}…`;
}

export function recordChatExchange({
  sessionId,
  userMessage,
  assistantMessage,
  attachments = [],
  preferences = null,
  profile = null,
  references = []
}) {
  const now = new Date();
  const effectiveSessionId = sessionId || `session-${now.getTime()}-${crypto.randomUUID()}`;
  let session = sessions.get(effectiveSessionId);

  if (!session) {
    session = {
      id: effectiveSessionId,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      title: userMessage?.content ? deriveSessionTitle(userMessage.content) : "Cuộc trò chuyện mới",
      messageCounts: { user: 0, assistant: 0 },
      attachmentCount: 0,
      hasAttachment: false,
      referenceCounts: new Map()
    };
    sessions.set(effectiveSessionId, session);
  }

  session.updatedAt = now.toISOString();

  if (!session.title && userMessage?.content) {
    session.title = deriveSessionTitle(userMessage.content);
  }

  if (preferences && typeof preferences === "object") {
    session.latestPreferences = { ...preferences };
  }

  if (profile && typeof profile === "object") {
    session.latestProfile = { ...profile };
  }

  if (Array.isArray(attachments) && attachments.length > 0) {
    session.attachmentCount = (session.attachmentCount ?? 0) + attachments.length;
    session.hasAttachment = true;
    totalAttachmentCount += attachments.length;
  }

  if (userMessage?.content) {
    session.messageCounts.user = (session.messageCounts.user ?? 0) + 1;
    const record = {
      timestamp: now.toISOString(),
      sessionId: effectiveSessionId,
      role: "user",
      content: truncateContent(userMessage.content, 800),
      references: []
    };
    messageHistory.push(record);
    addKeywordsFromText(userMessage.content);
  }

  if (assistantMessage?.content) {
    session.messageCounts.assistant = (session.messageCounts.assistant ?? 0) + 1;
    const assistantTimestamp = new Date().toISOString();
    const referenceTitles = Array.isArray(references)
      ? references.map((ref) => ref?.title).filter(Boolean)
      : [];

    referenceTitles.forEach((title) => {
      incrementMap(session.referenceCounts, title, 1);
      incrementMap(referenceTotals, title, 1);
    });

    const record = {
      timestamp: assistantTimestamp,
      sessionId: effectiveSessionId,
      role: "assistant",
      content: truncateContent(assistantMessage.content, 800),
      references: referenceTitles
    };
    messageHistory.push(record);
  }

  session.totalMessages = (session.messageCounts.user ?? 0) + (session.messageCounts.assistant ?? 0);

  while (messageHistory.length > MAX_MESSAGE_HISTORY) {
    messageHistory.shift();
  }

  return effectiveSessionId;
}

function sortMapEntries(map, limit = 10) {
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key, value]) => ({ key, value }));
}

function mapToList(map) {
  return Array.from(map.entries()).map(([label, count]) => ({ label, count }));
}

export function getAnalyticsSnapshot() {
  const now = new Date();
  const sessionsArray = Array.from(sessions.values());

  const summary = {
    totalSessions: sessionsArray.length,
    activeSessions24h: 0,
    userMessages: 0,
    assistantMessages: 0,
    averageMessagesPerSession: 0,
    uniqueLearners: 0,
    attachmentsUploaded: totalAttachmentCount,
    sessionsWithAttachments: 0,
    firstMessageAt: null,
    lastMessageAt: null
  };

  const uniqueLearnerSet = new Set();
  const programCounts = new Map();
  const gradeCounts = new Map();
  const goalCounts = new Map();
  const favoriteTopicCounts = new Map();
  const toneCounts = new Map();
  const detailCounts = new Map();
  let includeScratchTrue = 0;
  let includeScratchFalse = 0;
  let includePracticeTrue = 0;
  let includePracticeFalse = 0;

  sessionsArray.forEach((session) => {
    const updatedAt = new Date(session.updatedAt || now);
    const createdAt = new Date(session.createdAt || now);

    if (now - updatedAt <= 24 * 60 * 60 * 1000) {
      summary.activeSessions24h += 1;
    }

    summary.userMessages += session.messageCounts.user ?? 0;
    summary.assistantMessages += session.messageCounts.assistant ?? 0;

    if (session.hasAttachment) {
      summary.sessionsWithAttachments += 1;
    }

    if (!summary.firstMessageAt || createdAt < new Date(summary.firstMessageAt)) {
      summary.firstMessageAt = createdAt.toISOString();
    }

    if (!summary.lastMessageAt || updatedAt > new Date(summary.lastMessageAt)) {
      summary.lastMessageAt = updatedAt.toISOString();
    }

    const profile = session.latestProfile;
    if (profile) {
      const learnerKey = `${(profile.name || "").trim().toLowerCase()}|${(profile.grade || "").trim().toLowerCase()}`;
      if (learnerKey.trim() !== "|") {
        uniqueLearnerSet.add(learnerKey);
      }

      if (profile.program) {
        incrementMap(programCounts, profile.program.trim());
      }

      if (profile.grade) {
        incrementMap(gradeCounts, profile.grade.trim());
      }

      if (profile.goal) {
        incrementMap(goalCounts, profile.goal.trim());
      }

      if (profile.favoriteTopics) {
        const topics = profile.favoriteTopics
          .split(/[,;\n]/)
          .map((item) => item.trim())
          .filter(Boolean);
        topics.forEach((topic) => incrementMap(favoriteTopicCounts, topic));
      }
    }

    const prefs = session.latestPreferences;
    if (prefs) {
      if (prefs.tone) {
        incrementMap(toneCounts, prefs.tone);
      }
      if (prefs.detail) {
        incrementMap(detailCounts, prefs.detail);
      }
      if (typeof prefs.includeScratchSteps === "boolean") {
        if (prefs.includeScratchSteps) includeScratchTrue += 1;
        else includeScratchFalse += 1;
      }
      if (typeof prefs.includePracticeIdeas === "boolean") {
        if (prefs.includePracticeIdeas) includePracticeTrue += 1;
        else includePracticeFalse += 1;
      }
    }
  });

  summary.uniqueLearners = uniqueLearnerSet.size;
  if (summary.totalSessions > 0) {
    summary.averageMessagesPerSession = Number(
      ((summary.userMessages + summary.assistantMessages) / summary.totalSessions).toFixed(1)
    );
  }

  const hourlyBuckets = Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0 }));
  const dayLabels = ["Chủ nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];
  const weeklyBuckets = dayLabels.map((day) => ({ day, count: 0 }));
  const dailyBuckets = [];
  const dailyIndexMap = new Map();

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  for (let offset = 13; offset >= 0; offset -= 1) {
    const bucketDate = new Date(today);
    bucketDate.setDate(today.getDate() - offset);
    const key = bucketDate.toISOString().slice(0, 10);
    dailyIndexMap.set(key, dailyBuckets.length);
    dailyBuckets.push({
      date: key,
      label: bucketDate.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" }),
      count: 0
    });
  }

  messageHistory.forEach((entry) => {
    if (!entry || entry.role !== "user") return;
    const timestamp = new Date(entry.timestamp);
    const hour = timestamp.getHours();
    const dayIdx = timestamp.getDay();
    hourlyBuckets[hour].count += 1;
    weeklyBuckets[dayIdx].count += 1;
    const dayKey = timestamp.toISOString().slice(0, 10);
    const dailyBucketIndex = dailyIndexMap.get(dayKey);
    if (dailyBucketIndex !== undefined) {
      dailyBuckets[dailyBucketIndex].count += 1;
    }
  });

  const guideEntries = sortMapEntries(referenceTotals, 15).map(({ key, value }) => ({ title: key, count: value }));
  const keywordEntries = Array.from(keywordTotals.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 20)
    .map((item) => ({ keyword: item.keyword, count: item.count }));

  const recentSessions = sessionsArray
    .slice()
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .slice(0, 10)
    .map((session) => {
      const topTopics = session.referenceCounts
        ? Array.from(session.referenceCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([title]) => title)
        : [];
      return {
        id: session.id,
        displayTitle: session.title || session.id,
        title: session.title || session.id,
        createdAt: session.createdAt,
        lastActiveAt: session.updatedAt,
        totalMessages: session.totalMessages ?? 0,
        userMessages: session.messageCounts.user ?? 0,
        assistantMessages: session.messageCounts.assistant ?? 0,
        topTopics
      };
    });

  const recentMessages = messageHistory
    .slice(-40)
    .reverse()
    .map((entry) => ({
      timestamp: entry.timestamp,
      sessionId: entry.sessionId,
      role: entry.role,
      content: entry.content,
      references: entry.references
    }));

  return {
    summary,
    usage: {
      hourly: hourlyBuckets,
      weekly: weeklyBuckets,
      daily: dailyBuckets
    },
    topics: {
      guides: guideEntries,
      keywords: keywordEntries
    },
    audience: {
      programs: mapToList(programCounts),
      grades: mapToList(gradeCounts),
      goals: mapToList(goalCounts),
      favoriteTopics: mapToList(favoriteTopicCounts),
      preferences: {
        tone: mapToList(toneCounts),
        detail: mapToList(detailCounts),
        includeScratchSteps: {
          true: includeScratchTrue,
          false: includeScratchFalse
        },
        includePracticeIdeas: {
          true: includePracticeTrue,
          false: includePracticeFalse
        }
      }
    },
    sessions: {
      recent: recentSessions
    },
    messages: {
      recent: recentMessages
    },
    generatedAt: now.toISOString()
  };
}
