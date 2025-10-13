import cors from "cors";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

import { appConfig, teacherPersona } from "./config.js";
import { buildContextIndex } from "./contextRetriever.js";
import createChatRouter from "./routes/chat.js";
import createExportRouter from "./routes/export.js";
import createUploadRouter from "./routes/upload.js";
import { createAdminRouter } from "./routes/admin.js";
import { loadTeachingGuides } from "./teachingGuideLoader.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverRoot = path.resolve(__dirname, "..");
const clientDist = path.resolve(serverRoot, "..", "client", "dist");

async function bootstrap() {
  console.log("Đang khởi tạo máy chủ STEM Chat...");
  console.log("Thư mục giáo án:", appConfig.teachingGuideDir);
  console.log("Sử dụng mô hình Gemini:", appConfig.model);

  const guides = await loadTeachingGuides(appConfig.teachingGuideDir);
  console.log(`Đã nạp ${guides.length} giáo án.`);

  const contextIndex = buildContextIndex(guides);
  console.log(`Đã tạo chỉ mục với ${contextIndex.length} đoạn nội dung.`);

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "2mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      guides: guides.length,
      contextChunks: contextIndex.length
    });
  });

  app.use(
    "/api/chat",
    createChatRouter({
      contextIndex,
      persona: teacherPersona,
      apiKey: appConfig.apiKey,
      model: appConfig.model
    })
  );

  app.use(
    "/api/upload",
    createUploadRouter({
      apiKey: appConfig.apiKey,
      model: appConfig.model,
      persona: teacherPersona,
      maxUploadSizeMb: appConfig.maxUploadSizeMb
    })
  );

  app.use("/api/export-sb3", createExportRouter());
  app.use("/api/admin", createAdminRouter());

  // Phục vụ giao diện đã build nếu tồn tại
  app.use(express.static(clientDist));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    res.sendFile(path.join(clientDist, "index.html"), (err) => {
      if (err) next();
    });
  });

  app.listen(appConfig.port, appConfig.host, () => {
    console.log(`Máy chủ đang lắng nghe tại http://${appConfig.host}:${appConfig.port}`);
  });
}

bootstrap().catch((error) => {
  console.error("Không thể khởi động máy chủ:", error);
  process.exit(1);
});
