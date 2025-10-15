import crypto from "crypto";
import { getDb } from "./mongo.js";

const MAX_MESSAGE_HISTORY = 2000;

function normalize(text) {
	return String(text || "").trim();
}

function deriveSessionTitle(text) {
	const trimmed = normalize(text);
	if (!trimmed) return "Cuộc trò chuyện mới";
	const first = trimmed.split(/\n/)[0];
	return first.length > 48 ? `${first.slice(0, 48)}…` : first;
}

export async function recordChatExchangeMongo({
	sessionId,
	userMessage,
	assistantMessage,
	attachments = [],
	preferences = null,
	profile = null,
	references = []
}) {
	const db = getDb();
	if (!db) return null;
	const now = new Date();
	const effectiveSessionId = sessionId || `session-${now.getTime()}-${crypto.randomUUID()}`;

	const sessionsCol = db.collection("sessions");
	const messagesCol = db.collection("messages");
	const refsCol = db.collection("references");
	const keywordsCol = db.collection("keywords");

	const sessionUpdate = {
		$setOnInsert: { id: effectiveSessionId, createdAt: now.toISOString() },
		$set: { updatedAt: now.toISOString() },
		$inc: {
			"messageCounts.user": userMessage?.content ? 1 : 0,
			"messageCounts.assistant": assistantMessage?.content ? 1 : 0,
			attachmentCount: Array.isArray(attachments) ? attachments.length : 0
		}
	};

	if (userMessage?.content) {
		sessionUpdate.$set = { ...sessionUpdate.$set, title: deriveSessionTitle(userMessage.content) };
	}
	if (preferences && typeof preferences === "object") {
		sessionUpdate.$set = { ...sessionUpdate.$set, latestPreferences: { ...preferences } };
	}
	if (profile && typeof profile === "object") {
		sessionUpdate.$set = { ...sessionUpdate.$set, latestProfile: { ...profile } };
	}
	if (Array.isArray(attachments) && attachments.length > 0) {
		sessionUpdate.$set = { ...sessionUpdate.$set, hasAttachment: true };
	}

	await sessionsCol.updateOne({ id: effectiveSessionId }, sessionUpdate, { upsert: true });

	if (userMessage?.content) {
		await messagesCol.insertOne({
			timestamp: now.toISOString(),
			sessionId: effectiveSessionId,
			role: "user",
			content: normalize(userMessage.content).slice(0, 800),
			references: []
		});
	}
	if (assistantMessage?.content) {
		const titles = Array.isArray(references) ? references.map((r) => r?.title).filter(Boolean) : [];
		await messagesCol.insertOne({
			timestamp: new Date().toISOString(),
			sessionId: effectiveSessionId,
			role: "assistant",
			content: normalize(assistantMessage.content).slice(0, 800),
			references: titles
		});
		for (const title of titles) {
			await refsCol.updateOne({ title }, { $inc: { count: 1 } }, { upsert: true });
		}
	}

	if (userMessage?.content) {
		const sanitized = String(userMessage.content)
			.replace(/[0-9]+/g, " ")
			.replace(/["'`.,!?():;\-_/\\\[\]{}<>\n\r]+/g, " ");
		for (const raw of sanitized.split(/\s+/)) {
			if (!raw || raw.length < 4) continue;
			await keywordsCol.updateOne(
				{ keyword: raw.toLowerCase() },
				{ $inc: { count: 1 }, $setOnInsert: { keyword: raw } },
				{ upsert: true }
			);
		}
	}

	const totalMessages = await messagesCol.countDocuments();
	if (totalMessages > MAX_MESSAGE_HISTORY) {
		const extra = totalMessages - MAX_MESSAGE_HISTORY;
		const oldest = await messagesCol
			.find({}, { projection: { _id: 1 } })
			.sort({ timestamp: 1 })
			.limit(extra)
			.toArray();
		if (oldest.length) {
			await messagesCol.deleteMany({ _id: { $in: oldest.map((d) => d._id) } });
		}
	}

	return effectiveSessionId;
}

export async function getAnalyticsSnapshotMongo() {
	const db = getDb();
	if (!db) return null;
	const now = new Date();
	const sessionsCol = db.collection("sessions");
	const messagesCol = db.collection("messages");
	const refsCol = db.collection("references");
	const keywordsCol = db.collection("keywords");

	const sessions = await sessionsCol.find({}).toArray();
	const summary = {
		totalSessions: sessions.length,
		activeSessions24h: 0,
		userMessages: 0,
		assistantMessages: 0,
		averageMessagesPerSession: 0,
		uniqueLearners: 0,
		attachmentsUploaded: sessions.reduce((n, s) => n + (s.attachmentCount || 0), 0),
		sessionsWithAttachments: sessions.filter((s) => s.hasAttachment).length,
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

	for (const s of sessions) {
		const updatedAt = new Date(s.updatedAt || now);
		const createdAt = new Date(s.createdAt || now);
		if (now - updatedAt <= 24 * 60 * 60 * 1000) summary.activeSessions24h += 1;
		summary.userMessages += s?.messageCounts?.user || 0;
		summary.assistantMessages += s?.messageCounts?.assistant || 0;
		if (!summary.firstMessageAt || createdAt < new Date(summary.firstMessageAt)) summary.firstMessageAt = createdAt.toISOString();
		if (!summary.lastMessageAt || updatedAt > new Date(summary.lastMessageAt)) summary.lastMessageAt = updatedAt.toISOString();

		const profile = s.latestProfile;
		if (profile) {
			const learnerKey = `${(profile.name || "").trim().toLowerCase()}|${(profile.grade || "").trim().toLowerCase()}`;
			if (learnerKey.trim() !== "|") uniqueLearnerSet.add(learnerKey);
			if (profile.program) programCounts.set(profile.program, (programCounts.get(profile.program) || 0) + 1);
			if (profile.grade) gradeCounts.set(profile.grade, (gradeCounts.get(profile.grade) || 0) + 1);
			if (profile.goal) goalCounts.set(profile.goal, (goalCounts.get(profile.goal) || 0) + 1);
			if (profile.favoriteTopics) {
				for (const t of profile.favoriteTopics.split(/[,;\n]/).map((x) => x.trim()).filter(Boolean)) {
					favoriteTopicCounts.set(t, (favoriteTopicCounts.get(t) || 0) + 1);
				}
			}
		}
		const prefs = s.latestPreferences;
		if (prefs) {
			if (prefs.tone) toneCounts.set(prefs.tone, (toneCounts.get(prefs.tone) || 0) + 1);
			if (prefs.detail) detailCounts.set(prefs.detail, (detailCounts.get(prefs.detail) || 0) + 1);
			if (typeof prefs.includeScratchSteps === "boolean") prefs.includeScratchSteps ? includeScratchTrue++ : includeScratchFalse++;
			if (typeof prefs.includePracticeIdeas === "boolean") prefs.includePracticeIdeas ? includePracticeTrue++ : includePracticeFalse++;
		}
	}

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
		const d = new Date(today);
		d.setDate(today.getDate() - offset);
		const key = d.toISOString().slice(0, 10);
		dailyIndexMap.set(key, dailyBuckets.length);
		dailyBuckets.push({ date: key, label: d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" }), count: 0 });
	}

	const recentUserMessages = await messagesCol
		.find({ role: "user" }, { projection: { timestamp: 1 } })
		.sort({ timestamp: -1 })
		.limit(4000)
		.toArray();
	for (const m of recentUserMessages) {
		const ts = new Date(m.timestamp);
		hourlyBuckets[ts.getHours()].count += 1;
		weeklyBuckets[ts.getDay()].count += 1;
		const key = ts.toISOString().slice(0, 10);
		const idx = dailyIndexMap.get(key);
		if (idx !== undefined) dailyBuckets[idx].count += 1;
	}

	const guides = await refsCol.find({}).sort({ count: -1 }).limit(15).toArray();
	const keywords = await keywordsCol.find({}).sort({ count: -1 }).limit(20).toArray();

	const recentSessions = sessions
		.slice()
		.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
		.slice(0, 10)
		.map((s) => ({
			id: s.id,
			displayTitle: s.title || s.id,
			title: s.title || s.id,
			createdAt: s.createdAt,
			lastActiveAt: s.updatedAt,
			totalMessages: (s?.messageCounts?.user || 0) + (s?.messageCounts?.assistant || 0),
			userMessages: s?.messageCounts?.user || 0,
			assistantMessages: s?.messageCounts?.assistant || 0,
			topTopics: []
		}));

	const recentMessages = await messagesCol
		.find({}, { projection: { timestamp: 1, sessionId: 1, role: 1, content: 1, references: 1 } })
		.sort({ timestamp: -1 })
		.limit(40)
		.toArray();

	return {
		summary,
		usage: { hourly: hourlyBuckets, weekly: weeklyBuckets, daily: dailyBuckets },
		topics: {
			guides: guides.map((g) => ({ title: g.title, count: g.count })),
			keywords: keywords.map((k) => ({ keyword: k.keyword, count: k.count }))
		},
		audience: {
			programs: Array.from(programCounts.entries()).map(([label, count]) => ({ label, count })),
			grades: Array.from(gradeCounts.entries()).map(([label, count]) => ({ label, count })),
			goals: Array.from(goalCounts.entries()).map(([label, count]) => ({ label, count })),
			favoriteTopics: Array.from(favoriteTopicCounts.entries()).map(([label, count]) => ({ label, count })),
			preferences: {
				tone: Array.from(toneCounts.entries()).map(([label, count]) => ({ label, count })),
				detail: Array.from(detailCounts.entries()).map(([label, count]) => ({ label, count })),
				includeScratchSteps: { true: includeScratchTrue, false: includeScratchFalse },
				includePracticeIdeas: { true: includePracticeTrue, false: includePracticeFalse }
			}
		},
		sessions: { recent: recentSessions },
		messages: { recent: recentMessages },
		generatedAt: now.toISOString()
	};
}



