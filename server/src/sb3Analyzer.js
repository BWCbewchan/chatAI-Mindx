import JSZip from "jszip";

function countBlocks(blocks = {}) {
  return Object.keys(blocks).length;
}

function countTopLevelScripts(blocks = {}) {
  return Object.values(blocks).filter((block) => block?.topLevel).length;
}

function toNameList(record = {}) {
  return Object.values(record)
    .map((item) => (Array.isArray(item) ? item[0] : item?.name))
    .filter(Boolean)
    .map((name) => name.toString().trim())
    .filter((name) => name.length > 0);
}

function buildBroadcastMaps(targets) {
  const idToName = new Map();

  targets.forEach((target) => {
    Object.entries(target.broadcasts || {}).forEach(([id, value]) => {
      const name = Array.isArray(value) ? value[1] : value?.name;
      if (name) {
        idToName.set(id, name.trim());
      }
    });
  });

  return idToName;
}

function analyzeBroadcastUsage(targets, broadcastIdToName) {
  const declaredIds = new Set(broadcastIdToName.keys());
  const usedIds = new Set();
  const missingIds = new Set();

  const markUsage = (id) => {
    if (!id) return;
    if (broadcastIdToName.has(id)) {
      usedIds.add(id);
    } else {
      missingIds.add(id);
    }
  };

  targets.forEach((target) => {
    Object.values(target.blocks || {}).forEach((block) => {
      if (!block) return;

      if (block.opcode === "event_broadcast" || block.opcode === "event_broadcastandwait") {
        const broadcastId = block.inputs?.BROADCAST_INPUT?.[1]?.[1];
        markUsage(broadcastId);
      }

      if (block.opcode === "event_whenbroadcastreceived") {
        const receivedId = block.fields?.BROADCAST_OPTION?.[1];
        markUsage(receivedId);
      }
    });
  });

  const unusedNames = [...declaredIds]
    .filter((id) => !usedIds.has(id))
    .map((id) => broadcastIdToName.get(id))
    .filter(Boolean);

  const undefinedNames = [...missingIds]
    .map((id) => broadcastIdToName.get(id) || id)
    .filter(Boolean);

  return {
    unusedNames,
    undefinedNames
  };
}

function summarizeSprite(sprite) {
  const blocks = sprite.blocks || {};
  const blockEntries = Object.values(blocks);
  const topLevelScripts = blockEntries.filter((block) => block?.topLevel) || [];
  const hatBlocks = topLevelScripts.filter((block) => block?.opcode?.startsWith("event_")).length;
  const customBlocks = blockEntries.filter((block) => block?.opcode === "procedures_definition").length;
  const variableNames = toNameList(sprite.variables || {});
  const listNames = toNameList(sprite.lists || {});

  return {
    name: sprite.name,
    costumes: sprite.costumes?.length || 0,
    sounds: sprite.sounds?.length || 0,
    blocks: countBlocks(blocks),
    scripts: topLevelScripts.length,
    hatBlocks,
    customBlocks,
    variables: variableNames,
    variableCount: variableNames.length,
    lists: listNames,
    listCount: listNames.length,
    comments: Object.keys(sprite.comments || {}).length
  };
}

export async function analyzeSb3(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const projectFile = zip.file("project.json");

  if (!projectFile) {
    throw new Error("Không tìm thấy project.json trong file .sb3");
  }

  const projectContent = await projectFile.async("string");
  const project = JSON.parse(projectContent);
  const targets = project.targets || [];
  const stage = targets.find((target) => target.isStage) || null;
  const sprites = targets.filter((target) => !target.isStage);

  const broadcastIdToName = buildBroadcastMaps(targets);
  const { unusedNames: unusedBroadcasts, undefinedNames: undefinedBroadcasts } =
    analyzeBroadcastUsage(targets, broadcastIdToName);

  const spriteSummaries = sprites.map(summarizeSprite);
  const emptySprites = spriteSummaries.filter((sprite) => sprite.scripts === 0).map((sprite) => sprite.name);

  const stageSummary = stage
    ? {
        name: stage.name || "Stage",
        backdrops: stage.costumes?.length || 0,
        sounds: stage.sounds?.length || 0,
        blocks: countBlocks(stage.blocks),
        scripts: countTopLevelScripts(stage.blocks),
        variables: toNameList(stage.variables || {}),
        lists: toNameList(stage.lists || {})
      }
    : null;

  const totalScripts = spriteSummaries.reduce((sum, sprite) => sum + sprite.scripts, 0) + (stageSummary?.scripts || 0);
  const totalBlocks = spriteSummaries.reduce((sum, sprite) => sum + sprite.blocks, 0) + (stageSummary?.blocks || 0);

  const summary = {
    projectName: project.meta?.projectTitle || stageSummary?.name || "Dự án Scratch",
    scratchVersion: project.meta?.semver || null,
    spriteCount: sprites.length,
    totalScripts,
    totalBlocks,
    emptySprites,
    unusedBroadcasts,
    undefinedBroadcasts,
    broadcasts: Array.from(broadcastIdToName.values()),
    globalVariables: stageSummary?.variables || [],
    globalLists: stageSummary?.lists || [],
    variables: stageSummary?.variables || [],
    spriteSummaries,
    stage: stageSummary
  };

  const lines = [];

  lines.push(
    `Dự án: ${summary.projectName}${summary.scratchVersion ? ` (Scratch ${summary.scratchVersion})` : ""}.`
  );

  if (stageSummary) {
    lines.push(
      `Sân khấu "${stageSummary.name}" có ${stageSummary.backdrops} phông nền, ${stageSummary.sounds} âm thanh, ${stageSummary.scripts} kịch bản (${stageSummary.blocks} khối lệnh).`
    );
  }

  lines.push(
    `Toàn dự án gồm ${summary.spriteCount} nhân vật, ${summary.totalScripts} kịch bản và ${summary.totalBlocks} khối lệnh.`
  );

  if (summary.globalVariables.length > 0) {
    lines.push(`Biến toàn cục: ${summary.globalVariables.join(", ")}.`);
  } else {
    lines.push("Không có biến toàn cục.");
  }

  if (summary.globalLists.length > 0) {
    lines.push(`Danh sách toàn cục: ${summary.globalLists.join(", ")}.`);
  } else {
    lines.push("Không có danh sách toàn cục.");
  }

  if (summary.broadcasts.length > 0) {
    lines.push(`Tín hiệu broadcast đã khai báo: ${summary.broadcasts.join(", ")}.`);
  } else {
    lines.push("Chưa khai báo tín hiệu broadcast nào.");
  }

  if (unusedBroadcasts.length > 0) {
    lines.push(`Tín hiệu chưa được sử dụng: ${unusedBroadcasts.join(", ")}.`);
  }

  if (undefinedBroadcasts.length > 0) {
    lines.push(
      `Phát hiện tín hiệu được dùng nhưng chưa khai báo: ${undefinedBroadcasts.join(", ")}.`
    );
  }

  lines.push(
    emptySprites.length > 0
      ? `Nhân vật chưa có kịch bản: ${emptySprites.join(", ")}.`
      : "Tất cả nhân vật đều có ít nhất một kịch bản."
  );

  lines.push("\nChi tiết từng nhân vật:");

  spriteSummaries.forEach((sprite) => {
    const detailParts = [
      `${sprite.scripts} kịch bản (${sprite.blocks} khối lệnh, ${sprite.hatBlocks} khối sự kiện)`,
      `${sprite.costumes} trang phục`,
      `${sprite.sounds} âm thanh`
    ];

    if (sprite.customBlocks > 0) {
      detailParts.push(`${sprite.customBlocks} khối lệnh tự tạo`);
    }

    if (sprite.variables.length > 0) {
      detailParts.push(`biến: ${sprite.variables.join(", ")}`);
    }

    if (sprite.lists.length > 0) {
      detailParts.push(`danh sách: ${sprite.lists.join(", ")}`);
    }

    if (sprite.comments > 0) {
      detailParts.push(`${sprite.comments} ghi chú`);
    }

    lines.push(`- ${sprite.name}: ${detailParts.join("; ")}.`);
  });

  return {
    summary,
    textReport: lines.join("\n")
  };
}
