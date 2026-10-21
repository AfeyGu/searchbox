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
 *
 * 同一链接被多个源返回时只保留一条（先出现的那个），
 * 但把其余来源记在 `sources` 里，方便界面显示"这条也被谁收录了"。
 *
 * @param {Array<{id:string,name:string,items:Array}>} groups 按优先级排列的源结果
 * @param {number} cap 结果上限
 */
export function interleave(groups, cap = 40) {
  const byIdentity = new Map();
  const merged = [];
  const depth = Math.max(0, ...groups.map((group) => group.items.length));

  for (let rank = 0; rank < depth; rank += 1) {
    for (const group of groups) {
      const item = group.items[rank];
      if (!item) continue;
      const identity = normalizeUrl(item.url);
      if (!identity) continue;

      const existing = byIdentity.get(identity);
      if (existing) {
        if (!existing.sources.some((source) => source.id === group.id)) {
          existing.sources.push({ id: group.id, name: group.name });
        }
        continue;
      }

      const hit = {
        ...item,
        sourceId: group.id,
        sourceName: group.name,
        sources: [{ id: group.id, name: group.name }]
      };
      byIdentity.set(identity, hit);
      merged.push(hit);
      if (merged.length >= cap) return merged;
    }
  }
  return merged;
}
