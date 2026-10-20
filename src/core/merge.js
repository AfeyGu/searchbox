/**
 * 结果合并：URL 归一化 → 去重 → 名次交错。
 * 纯函数，可在 tests.html 里直接断言。
 *
 * 为什么是名次交错而不是按分数排序：各家 score 没有共同尺度，
 * 混在一起排等于伪造排序。这里让每个源的第 1 条等权、第 2 条等权，
 * 同分时按源的先后顺序打破僵局。
 */

/** 归一化 URL：去锚点、去 utm_* 追踪参数、去末尾斜杠。 */
export function normalizeUrl(input) {
  try {
    const url = new URL(input);
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (/^utm_/i.test(key)) url.searchParams.delete(key);
    }
    return url.toString().replace(/\/$/, "");
  } catch {
    return String(input || "").trim();
  }
}

/**
 * 名次交错合并。
 * @param {Array<{id:string,name:string,items:Array}>} groups 按优先级排列的源结果
 * @param {number} cap 结果上限
 */
export function interleave(groups, cap = 40) {
  const seen = new Set();
  const merged = [];
  const depth = Math.max(0, ...groups.map((group) => group.items.length));

  for (let rank = 0; rank < depth; rank += 1) {
    for (const group of groups) {
      const item = group.items[rank];
      if (!item) continue;
      const identity = normalizeUrl(item.url);
      if (!identity || seen.has(identity)) continue;
      seen.add(identity);
      merged.push({ ...item, sourceId: group.id, sourceName: group.name });
      if (merged.length >= cap) return merged;
    }
  }
  return merged;
}
