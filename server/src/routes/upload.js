import { GoogleGenAI } from "@google/genai";
import { Router } from "express";
import multer from "multer";
import { analyzeSb3 } from "../sb3Analyzer.js";

export default function createUploadRouter({ apiKey, model, persona, maxUploadSizeMb }) {
  const router = Router();

  if (!apiKey) {
    console.warn("GEMINI_API_KEY chưa được cấu hình. Upload API sẽ chỉ trả về báo cáo kỹ thuật.");
  }

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxUploadSizeMb * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (!file.originalname.toLowerCase().endsWith(".sb3")) {
        return cb(new Error("Chỉ chấp nhận tệp Scratch .sb3"));
      }
      cb(null, true);
    }
  });

  const genAI = apiKey ? new GoogleGenAI({ apiKey }) : null;

  router.post("/", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "Vui lòng tải lên tệp .sb3." });
      }

      const { summary, textReport } = await analyzeSb3(req.file.buffer);

      let aiFeedback = null;
      if (genAI) {
        const prompt = `Học sinh vừa tải lên dự án Scratch và đây là báo cáo tự động:\n${textReport}\n\nHãy phản hồi chi tiết (tối đa 220 từ) dành cho học sinh cấp 1-2.\nYêu cầu trình bày:\n- Dùng Markdown rõ ràng, mở đầu bằng tiêu đề cấp 2 (##) có emoji chào hỏi.\n- Chia thành các mục cấp 3 với tiêu đề: "🎯 Điểm đã làm tốt", "🛠️ Cần chỉnh sửa", "🎒 Bài tập luyện thêm".\n- Nêu tên khối Scratch trong dấu \`\` theo dạng "Nhóm > Tên khối".\n- Làm nổi bật từ khóa bằng **chữ in đậm** và dùng blockquote "> 💡" cho mẹo nhỏ.\n- Kết thúc bằng mục "❓Hỏi lại cô" với 1 câu hỏi gợi mở.`;
        const result = await genAI.models.generateContent({
          model,
          systemInstruction: persona,
          contents: [
            {
              role: "user",
              parts: [{ text: prompt }]
            }
          ]
        });
        const responseTextRaw = result?.text;
        aiFeedback =
          typeof responseTextRaw === "function" ? responseTextRaw() : responseTextRaw ?? null;
      }

      res.json({
        summary,
        report: textReport,
        aiFeedback
      });
    } catch (error) {
      console.error("Lỗi phân tích sb3:", error);
      res.status(400).json({ error: error.message || "Không thể xử lý tệp .sb3" });
    }
  });

  return router;
}
