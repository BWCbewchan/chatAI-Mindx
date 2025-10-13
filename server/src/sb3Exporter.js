import { createHash, randomUUID } from "crypto";
import JSZip from "jszip";

const stageSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360" viewBox="0 0 480 360">
  <rect width="480" height="360" fill="#ffffff"/>
</svg>`;

const spriteSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
  <circle cx="50" cy="50" r="40" fill="#10b981"/>
  <text x="50" y="57" text-anchor="middle" font-family="Arial" font-size="28" fill="#ffffff">☆</text>
</svg>`;

function createAsset(svgSource, extension = "svg") {
  const buffer = Buffer.from(svgSource, "utf8");
  const assetId = createHash("md5").update(buffer).digest("hex");
  return {
    assetId,
    md5ext: `${assetId}.${extension}`,
    dataFormat: extension,
    data: buffer
  };
}

function buildSayScriptBlocks(sequences) {
  const blocks = {};
  const comments = {};

  sequences.forEach((sequence, index) => {
    const topLevelId = randomUUID();
    const sayId = randomUUID();
    const messageText = sequence.join(" -> ");

    blocks[topLevelId] = {
      opcode: "event_whenflagclicked",
      next: sayId,
      parent: null,
      inputs: {},
      fields: {},
      shadow: false,
      topLevel: true,
      x: 200,
      y: 120 + index * 120
    };

    blocks[sayId] = {
      opcode: "looks_say",
      next: null,
      parent: topLevelId,
      inputs: {
        MESSAGE: [1, [10, messageText]]
      },
      fields: {},
      shadow: false,
      topLevel: false
    };

    comments[randomUUID()] = {
      blockId: topLevelId,
      x: blocks[topLevelId].x + 20,
      y: blocks[topLevelId].y - 40,
      width: 200,
      height: 60,
      minimized: false,
      text: messageText
    };
  });

  return { blocks, comments };
}

export async function buildSb3FromSequences(sequences, projectTitle = "MindX Scratch Export") {
  if (!Array.isArray(sequences) || sequences.length === 0) {
    throw new Error("Không tìm thấy chuỗi khối Scratch để xuất.");
  }

  const stageAsset = createAsset(stageSvg);
  const spriteAsset = createAsset(spriteSvg);

  const { blocks, comments } = buildSayScriptBlocks(sequences);

  const project = {
    targets: [
      {
        isStage: true,
        name: "Stage",
        variables: {},
        lists: {},
        broadcasts: {},
        blocks: {},
        currentCostume: 0,
        costumes: [
          {
            name: "white",
            assetId: stageAsset.assetId,
            md5ext: stageAsset.md5ext,
            dataFormat: stageAsset.dataFormat,
            rotationCenterX: 240,
            rotationCenterY: 180
          }
        ],
        sounds: [],
        volume: 100,
        layerOrder: 0,
        tempo: 60,
        videoTransparency: 50,
        videoState: "on",
        textToSpeechLanguage: null
      },
      {
        isStage: false,
        name: "MindX Helper",
        variables: {},
        lists: {},
        broadcasts: {},
        blocks,
        currentCostume: 0,
        costumes: [
          {
            name: "helper",
            assetId: spriteAsset.assetId,
            md5ext: spriteAsset.md5ext,
            dataFormat: spriteAsset.dataFormat,
            rotationCenterX: 50,
            rotationCenterY: 50
          }
        ],
        sounds: [],
        layerOrder: 1,
        visible: true,
        x: 0,
        y: 0,
        size: 100,
        direction: 90,
        draggable: false,
        rotationStyle: "all around",
        comments
      }
    ],
    meta: {
      semver: "3.0.0",
      vm: "1.6.0",
      agent: "mindx-exporter",
      projectTitle
    }
  };

  const zip = new JSZip();
  zip.file("project.json", JSON.stringify(project));
  zip.file(stageAsset.md5ext, stageAsset.data);
  zip.file(spriteAsset.md5ext, spriteAsset.data);

  return zip.generateAsync({ type: "nodebuffer" });
}
