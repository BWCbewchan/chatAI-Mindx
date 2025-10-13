import { Router } from "express";
import { buildSb3FromSequences } from "../sb3Exporter.js";

function parseSequenceText(rawText) {
  if (typeof rawText !== "string") {
    return [];
  }

  const sequences = [];
  const addSequence = (sequenceText) => {
    const cleaned = sequenceText.replace(/`/g, "").trim();
    if (!cleaned.includes(">")) return;
    const segments = cleaned
      .split(/\s*(?:->|→|⇒|=>|\+|,|;)\s*/)
      .map((segment) => segment.trim())
      .filter(Boolean);
    if (segments.length) {
      sequences.push(segments);
    }
  };

  const inlineRegex = /`([^`]+>`[^`]+)`/g;
  let match;
  while ((match = inlineRegex.exec(rawText)) !== null) {
    addSequence(match[1]);
  }

  rawText
    .split(/\n+/)
    .map((line) => line.trim())
    .forEach((line) => {
      if (!line) return;
      if (line.startsWith("`") && line.endsWith("`")) {
        addSequence(line.slice(1, -1));
        return;
      }
      if (line.includes("->") || line.includes("⇒") || line.includes("→")) {
        addSequence(line);
      }
    });

  return sequences;
}

export default function createExportRouter() {
  const router = Router();

  router.post("/", async (req, res) => {
    try {
      const { content, projectName } = req.body || {};
      const sequences = parseSequenceText(content);

      if (!sequences.length) {
        return res.status(400).json({ error: "Không tìm thấy chuỗi lệnh Scratch trong nội dung gần nhất." });
      }

      const sb3Buffer = await buildSb3FromSequences(sequences, projectName);
      res.setHeader("Content-Type", "application/octet-stream");
      res.setHeader("Content-Disposition", "attachment; filename=MindX-Assistant.sb3");
      return res.send(sb3Buffer);
    } catch (error) {
      console.error("Lỗi xuất SB3:", error);
      return res.status(500).json({ error: "Không thể tạo file .sb3" });
    }
  });

  return router;
}
