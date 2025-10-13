import { config as loadEnv } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverRoot = path.resolve(__dirname, "..");
const workspaceRoot = path.resolve(serverRoot, "..");

const rootEnvPath = path.resolve(workspaceRoot, ".env");
const serverEnvPath = path.resolve(serverRoot, ".env");

loadEnv({ path: rootEnvPath });
loadEnv({ path: serverEnvPath });

const defaultGuideDir = path.resolve(workspaceRoot, "server", "knowledge");

function resolveGuideDir(targetPath) {
  if (!targetPath) {
    return defaultGuideDir;
  }

  return path.isAbsolute(targetPath) ? targetPath : path.resolve(workspaceRoot, targetPath);
}

const teachingGuideDir = resolveGuideDir(process.env.TEACHING_GUIDE_DIR);

const LEGACY_MODEL_ALIASES = {
  "gemini-pro": "gemini-2.5-flash",
  "models/gemini-pro": "gemini-2.5-flash",
  "gemini-pro-vision": "gemini-2.5-flash",
  "models/gemini-pro-vision": "gemini-2.5-flash",
  "gemini-1.5-pro": "gemini-1.5-pro-latest",
  "models/gemini-1.5-pro": "gemini-1.5-pro-latest",
  "gemini-1.5-pro-001": "gemini-1.5-pro-latest",
  "gemini-1.5-flash": "gemini-1.5-flash-latest",
  "models/gemini-1.5-flash": "gemini-1.5-flash-latest",
  "gemini-1.5-flash-001": "gemini-1.5-flash-latest"
};

function resolveModelName(rawModel) {
  const trimmed = (rawModel || "").trim();
  const fallback = "gemini-2.5-flash";

  if (!trimmed) {
    return fallback;
  }

  const normalizedKey = trimmed.toLowerCase();
  if (LEGACY_MODEL_ALIASES[normalizedKey]) {
    const resolved = LEGACY_MODEL_ALIASES[normalizedKey];
    console.warn(`GEMINI_MODEL "${trimmed}" không được hỗ trợ trên SDK mới. Đổi sang "${resolved}".`);
    return resolved;
  }

  return trimmed;
}

const resolvedModel = resolveModelName(process.env.GEMINI_MODEL);

export const appConfig = {
  port: Number(process.env.PORT || 5001),
  host: process.env.HOST || "0.0.0.0",
  apiKey: process.env.GEMINI_API_KEY || process.env.gemini_api_key || "",
  model: resolvedModel,
  teachingGuideDir,
  maxUploadSizeMb: Number(process.env.MAX_UPLOAD_MB || 10)
};

export const teacherPersona = `Bạn là một giáo viên STEM với 5 năm kinh nghiệm tại MindX, chuyên hỗ trợ học sinh cấp 1 và cấp 2.\n- Chủ động hỏi lại khi học sinh chưa cung cấp đủ thông tin.\n- Sử dụng lời nói nhẹ nhàng, thân thiện, ví dụ gần gũi và gợi ý hoạt động thực hành ngắn.\n- Khi trích dẫn giáo án, nêu rõ tên buổi học và tóm tắt ý chính.\n- Tôn trọng nội dung giáo án chính thức, chỉ sáng tạo thêm khi không mâu thuẫn.\n- Ưu tiên mô tả thao tác Scratch thật cụ thể vì học sinh làm việc với khối kéo-thả.\n- Diễn đạt bằng Markdown với tiêu đề, danh sách bullet, từ khóa in đậm và khối \`code\` để gọi tên lệnh Scratch.`;
