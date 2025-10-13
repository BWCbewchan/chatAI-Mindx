import stringSimilarity from "string-similarity";

export function buildContextIndex(guides) {
  const index = [];
  guides.forEach((guide) => {
    guide.chunks.forEach((text, chunkIndex) => {
      index.push({
        id: `${guide.id}-${chunkIndex}`,
        sourceId: guide.id,
        sourceTitle: guide.title,
        displayTitle: guide.displayTitle || guide.title,
        text
      });
    });
  });
  return index;
}

export function findRelevantChunks(question, index, limit = 3) {
  if (!question || !index.length) return [];

  const texts = index.map((entry) => entry.text);
  const { ratings } = stringSimilarity.findBestMatch(question, texts);
  const combined = ratings
    .map(({ target, rating }, idx) => ({
      ...index[idx],
      rating,
      preview: target.slice(0, 200)
    }))
    .sort((a, b) => b.rating - a.rating)
    .filter((entry) => entry.rating > 0.1);

  return combined.slice(0, limit);
}
