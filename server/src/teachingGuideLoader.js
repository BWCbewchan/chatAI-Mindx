import fs from "fs/promises";
import mammoth from "mammoth";
import path from "path";

const MAX_CHUNK_LENGTH = 1200;

function prettifyGuideTitle(rawTitle) {
  if (!rawTitle) return "";

  const withoutPrefix = rawTitle.replace(/^\[[^\]]+\]\s*/u, "");
  const withSpaces = withoutPrefix
    .replace(/[_]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();

  const normalized = withSpaces.replace(/(Buổi\s+\d+)(\s+)/iu, "$1 – ");
  return normalized || rawTitle;
}

function slugify(str) {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function createChunks(rawText) {
  const paragraphs = rawText
    .split(/\n{2,}/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const chunks = [];
  let buffer = "";

  paragraphs.forEach((paragraph) => {
    if ((buffer + " " + paragraph).trim().length > MAX_CHUNK_LENGTH) {
      if (buffer) {
        chunks.push(buffer.trim());
        buffer = "";
      }
    }
    buffer = `${buffer}\n${paragraph}`.trim();
  });

  if (buffer) {
    chunks.push(buffer.trim());
  }

  return chunks;
}

async function collectDocxFiles(directory) {
  const discovered = [];
  let entries;

  try {
    entries = await fs.readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") {
      console.warn(`Thư mục giáo án không tồn tại: ${directory}`);
      return discovered;
    }
    throw error;
  }

  for (const entry of entries) {
    const absolutePath = path.resolve(directory, entry.name);
    if (entry.isDirectory()) {
      const nested = await collectDocxFiles(absolutePath);
      discovered.push(...nested);
      continue;
    }

    if (entry.isFile() && entry.name.toLowerCase().endsWith(".docx")) {
      discovered.push(absolutePath);
    }
  }

  return discovered;
}

export async function loadTeachingGuides(directory) {
  const guides = [];
  const docxFiles = await collectDocxFiles(directory);

  for (const absolutePath of docxFiles) {
    const filename = path.basename(absolutePath);
    const title = filename.replace(/\.docx$/i, "").trim();
    try {
      const { value } = await mammoth.extractRawText({ path: absolutePath });
      const cleaned = value.replace(/\r/g, "").trim();
      const chunks = createChunks(cleaned);
      guides.push({
        id: slugify(title),
        title,
        displayTitle: prettifyGuideTitle(title),
        path: absolutePath,
        chunks
      });
    } catch (error) {
      console.error(`Không thể đọc giáo án ${filename}:`, error.message);
    }
  }

  return guides;
}
