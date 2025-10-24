import { GoogleGenAI } from "@google/genai";
import { Router } from "express";
import multer from "multer";
import { recordChatExchange } from "../analyticsStore.js";
import { recordChatExchangeMongo } from "../analyticsStore.mongo.js";
import { findRelevantChunks } from "../contextRetriever.js";

export default function createChatRouter({ contextIndex, persona, apiKey, model }) {
  const router = Router();
  let currentModel = model;
  const fallbackModel = "gemini-2.5-flash";
  const MAX_ATTACHMENTS = 4;
  const MAX_ATTACHMENT_SIZE_MB = 4;
  const MAX_ATTACHMENT_BYTES = MAX_ATTACHMENT_SIZE_MB * 1024 * 1024;
  const SUPPORTED_IMAGE_TYPES = new Set([
    "image/png",
    "image/jpeg",
    "image/webp",
    "image/gif"
  ]);
  const SUPPORTED_TEXT_TYPES = new Set([
    "text/plain",
    "text/markdown",
    "application/json"
  ]);

  const parseJsonField = (value) => {
    if (!value) return null;
    if (typeof value === "object") return value;
    if (typeof value !== "string") return null;
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  };

  if (!apiKey) {
    console.warn("GEMINI_API_KEY chưa được cấu hình. Chat API sẽ phản hồi lỗi.");
  }

  const attachmentUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: MAX_ATTACHMENT_BYTES,
      files: MAX_ATTACHMENTS
    }
  });

  const genAI = apiKey
    ? new GoogleGenAI({ apiKey })
    : null;

  router.post(
    "/",
    (req, res, next) => {
      const contentType = String(req.headers["content-type"] || "");
      if (contentType.includes("multipart/form-data")) {
        attachmentUpload.array("attachments", MAX_ATTACHMENTS)(req, res, (err) => {
          if (!err) {
            return next();
          }

          if (err.code === "LIMIT_FILE_SIZE") {
            return res.status(400).json({
              error: `Tệp đính kèm vượt quá giới hạn ${MAX_ATTACHMENT_SIZE_MB}MB.`
            });
          }

          return next(err);
        });
      } else {
        next();
      }
    },
    async (req, res) => {
    try {
      if (!genAI) {
        return res.status(500).json({ error: "Máy chủ chưa cấu hình GEMINI_API_KEY." });
      }

      const { message: rawMessage, sb3Report: rawSb3Report } = req.body || {};
      let history = req.body?.history;

      if (typeof history === "string") {
        try {
          history = JSON.parse(history);
        } catch {
          history = [];
        }
      }

      if (!Array.isArray(history)) {
        history = [];
      }

      const message = typeof rawMessage === "string" ? rawMessage : "";
      const trimmedMessage = message.trim();

      const sb3RawText = typeof rawSb3Report === "string" ? rawSb3Report.trim() : null;
      const sb3Report =
        sb3RawText && sb3RawText.toLowerCase() !== "null" && sb3RawText.toLowerCase() !== "undefined"
          ? sb3RawText
          : null;
      const attachments = Array.isArray(req.files) ? req.files : [];
      const attachmentsMetadata = attachments.map((file) => ({
        name: file.originalname,
        size: file.size,
        mimetype: file.mimetype
      }));

      const preferences = parseJsonField(req.body?.preferences);
      const profile = parseJsonField(req.body?.profile);
      const sessionId = typeof req.body?.sessionId === "string" ? req.body.sessionId : undefined;

      const attachmentTextNotes = [];
      const attachmentParts = [];

      for (let index = 0; index < attachments.length; index += 1) {
        const file = attachments[index];
        const label = `Tệp ${index + 1}: ${file.originalname}`;

        if (SUPPORTED_IMAGE_TYPES.has(file.mimetype)) {
          attachmentTextNotes.push(`${label} (hình ảnh, ${Math.round(file.size / 1024)} KB).`);
          attachmentParts.push({
            inlineData: {
              mimeType: file.mimetype,
              data: file.buffer.toString("base64")
            }
          });
          continue;
        }

        if (SUPPORTED_TEXT_TYPES.has(file.mimetype)) {
          const textContent = file.buffer.toString("utf-8");
          const truncatedContent = textContent.slice(0, 4000);
          attachmentTextNotes.push(`${label} (văn bản, đã gửi tối đa 4000 ký tự cho mô hình).`);
          attachmentParts.push({
            text: `Nội dung tệp ${file.originalname} (độ dài ${textContent.length} ký tự, đã cắt bớt nếu quá dài):\n${truncatedContent}`
          });
          continue;
        }

        return res.status(400).json({
          error: `Tệp "${file.originalname}" có định dạng ${file.mimetype} chưa được hỗ trợ. Vui lòng gửi hình ảnh (PNG/JPG/WebP/GIF) hoặc văn bản (.txt, .md, .json).`
        });
      }

      if (!trimmedMessage && attachments.length === 0) {
        return res.status(400).json({ error: "Vui lòng viết câu hỏi hoặc gửi ít nhất một tệp." });
      }

      const retrievalHint = trimmedMessage
        ? trimmedMessage
        : attachmentTextNotes.join(" ") || attachments.map((file) => file.originalname).join(" ");

      const relevantChunks = findRelevantChunks(retrievalHint || "phân tích tệp đính kèm", contextIndex, 4);
      const contextText = relevantChunks
        .map(
          (chunk, idx) =>
            `Tài liệu ${idx + 1}: ${chunk.sourceTitle}\nMức độ liên quan: ${(chunk.rating * 100).toFixed(1)}%\n${chunk.text}`
        )
        .join("\n---\n");

      const sb3Section = sb3Report
        ? `\n\nPhân tích dự án Scratch mà học sinh gửi:\n${sb3Report}`
        : "";

      const questionText =
        trimmedMessage ||
        "Học sinh không nhập câu hỏi trực tiếp mà chỉ gửi tệp đính kèm. Hãy đọc tệp và giải thích bằng ngôn ngữ dễ hiểu phù hợp học sinh cấp 1-2.";

      const attachmentsSummary = attachmentTextNotes.length
        ? `\n\nHọc sinh gửi kèm ${attachmentTextNotes.length} tệp:\n- ${attachmentTextNotes.join("\n- ")}`
        : "";

      const userLogContent =
        trimmedMessage ||
        (attachments.length
          ? `Học sinh gửi ${attachments.length} tệp: ${attachments
              .map((file) => file.originalname)
              .join(", ")}.`
          : null) ||
        (sb3Report
          ? "Học sinh yêu cầu phân tích dự án Scratch đã đính kèm."
          : "Học sinh gửi yêu cầu nhưng không có nội dung văn bản.");

      // Tạo thông tin profile để cá nhân hóa câu trả lời
      const profileInfo = profile ? `
Thông tin học sinh:
- Tên: ${profile.name || 'Chưa cung cấp'}
- Lớp: ${profile.grade || 'Chưa cung cấp'}
- Độ tuổi: ${profile.age || 'Chưa cung cấp'}
- Khóa học: ${profile.program || 'Chưa cung cấp'}
- Mục tiêu hiện tại: ${profile.goal || 'Chưa cung cấp'}
- Chủ đề yêu thích: ${profile.favoriteTopics || 'Chưa cung cấp'}
- Ghi chú: ${profile.notes || 'Không có'}
` : '';

  const prompt = `Dưới đây là các đoạn giáo án liên quan (bằng tiếng Việt). Hãy ưu tiên sử dụng thông tin này khi hỗ trợ học sinh.\n${contextText}\n\n${profileInfo}Học sinh hỏi: ${questionText}\n${sb3Section}${attachmentsSummary}\n\nYêu cầu trình bày:\n- Luôn trả lời bằng tiếng Việt thân thiện, cấp độ học sinh cấp 1-2.\n- Sử dụng tên học sinh khi có thể để tạo sự gần gũi.\n- Cá nhân hóa câu trả lời dựa trên mục tiêu và sở thích của học sinh.\n- Dùng Markdown rõ ràng: mở đầu bằng tiêu đề cấp 2 (##) có emoji chào hỏi, sau đó chia thành các mục với tiêu đề cấp 3 (###).\n- Bao gồm lần lượt các mục: "🎯 Mục tiêu chính", "🧠 Giải thích nhanh", "🛠️ Bước làm Scratch" (chỉ khi phù hợp) và "🎒 Gợi ý luyện tập".\n- Trong mục "🛠️ Bước làm Scratch", hướng dẫn học sinh kéo từng khối từ danh mục tương ứng, rồi kết thúc mục bằng đoạn tóm tắt ghép các khối theo thứ tự thực hiện.\n- Khi nêu tên lệnh Scratch, viết trong dấu \`\` theo cấu trúc "Category > Block" và dùng tiếng Anh chuẩn Scratch (ví dụ: \`Events > When Green Flag Clicked\`).\n- Khi ghép các khối, trình bày chuỗi lệnh bằng dạng "Category > Block -> Category > Block" để học sinh dễ nhìn.\n- Làm nổi bật từ khóa quan trọng bằng **chữ in đậm**; dùng blockquote với emoji (ví dụ: "> 💡") để ghi chú hoặc lưu ý.\n- Kết thúc bằng mục "❓Hỏi lại cô" liệt kê 1-2 câu hỏi gợi ý để học sinh tiếp tục trao đổi.\n- Nếu thông tin chưa đủ, hãy hỏi lại ngắn gọn trong mục cuối.`;

      const formattedHistory = [];

      const originalHistory = Array.isArray(history) ? [...history] : [];
      const latestEntry = originalHistory[originalHistory.length - 1];

      if (
        latestEntry &&
        typeof latestEntry.content === "string" &&
        latestEntry.role === "user" &&
        latestEntry.content.trim() === message.trim()
      ) {
        originalHistory.pop();
      }

      for (const item of originalHistory) {
        if (!item || typeof item.content !== "string") {
          continue;
        }

        const trimmedText = item.content.slice(0, 4000).trim();

        if (!trimmedText) {
          continue;
        }

        const role = item.role === "assistant" ? "model" : "user";
        formattedHistory.push({
          role,
          parts: [{ text: trimmedText }]
        });
      }

      while (formattedHistory.length > 0 && formattedHistory[0].role !== "user") {
        formattedHistory.shift();
      }

      const recentHistory = formattedHistory.slice(-10);

      const conversation = [
        ...recentHistory,
        {
          role: "user",
          parts: [
            { text: prompt },
            ...attachmentParts
          ]
        }
      ];

      const executeRequest = async (modelName) =>
        genAI.models.generateContent({
          model: modelName,
          systemInstruction: persona,
          contents: conversation
        });

      let targetModel = currentModel || fallbackModel;
      let result;

      try {
        result = await executeRequest(targetModel);
      } catch (err) {
        const statusCode = err?.status || err?.code;
        const messageText = String(err?.message || "").toLowerCase();
        const isModelMissing =
          statusCode === 404 ||
          messageText.includes("not found") ||
          messageText.includes("does not exist");

        if (isModelMissing && targetModel !== fallbackModel) {
          console.warn(
            `Gemini model "${targetModel}" không khả dụng. Thử chuyển sang "${fallbackModel}".`
          );
          currentModel = fallbackModel;
          targetModel = fallbackModel;
          result = await executeRequest(targetModel);
        } else {
          throw err;
        }
      }
      const responseTextRaw = result?.text;
      const responseText =
        typeof responseTextRaw === "function" ? responseTextRaw() : responseTextRaw ?? "";

      const referencesPayload = relevantChunks.map((chunk) => ({
        id: chunk.id,
        title: chunk.displayTitle || chunk.sourceTitle,
        score: Number(chunk.rating.toFixed(4))
      }));

      const responsePayload = {
        reply: responseText,
        references: referencesPayload,
        model: targetModel
      };

      try {
        // Prefer Mongo if available; fall back to in-memory store
        const mongoResult = await recordChatExchangeMongo({
          sessionId,
          userMessage: { content: userLogContent },
          assistantMessage: { content: responseText },
          attachments: attachmentsMetadata,
          preferences,
          profile,
          references: referencesPayload
        });
        if (!mongoResult) {
          recordChatExchange({
            sessionId,
            userMessage: { content: userLogContent },
            assistantMessage: { content: responseText },
            attachments: attachmentsMetadata,
            preferences,
            profile,
            references: referencesPayload
          });
        }
      } catch (analyticsError) {
        console.warn("Không thể ghi thống kê admin:", analyticsError);
      }

      res.json(responsePayload);
    } catch (error) {
      console.error("Lỗi xử lý chat:", error);
      res.status(500).json({ error: "Không thể kết nối tới Gemini API." });
    }
  }
  );

  return router;
}
