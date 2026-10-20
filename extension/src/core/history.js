/**
 * 最近搜索记录。
 *
 * 存储形态：一个查询词一个键 —— `hist:<查询词>` → 时间戳。
 * 为什么不用「一个数组来回读写」：多个搜索页可能同时记录，
 * 读-改-写在跨标签页时会产生竞态，实测并发搜索会丢掉记录。
 * 单键写入没有这个问题，同词重复写入天然覆盖。
 *
 * 保留策略：30 天过期 + 最多 50 条，两者取严。
 * 清理发生在读取时（打开首页），不额外占用写入路径。
 */

const PREFIX = "hist:";
const MAX = 50;
export const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/** 时间戳是否还在有效期内（纯函数，便于断言）。 */
export function isFresh(ts, now = Date.now()) {
  return Number(ts) > now - MAX_AGE_MS;
}

async function allEntries() {
  const everything = await chrome.storage.local.get(null);
  return Object.entries(everything)
    .filter(([key]) => key.startsWith(PREFIX))
    .map(([key, ts]) => ({ q: key.slice(PREFIX.length), ts: Number(ts) || 0 }))
    .sort((a, b) => b.ts - a.ts);
}

export async function readHistory() {
  const now = Date.now();
  const all = await allEntries();
  const alive = all.filter((item) => isFresh(item.ts, now));

  const expired = all.filter((item) => !isFresh(item.ts, now));
  const overflow = alive.slice(MAX);
  const drop = [...expired, ...overflow].map((item) => PREFIX + item.q);
  if (drop.length) chrome.storage.local.remove(drop);

  return alive.slice(0, MAX);
}

export async function recordHistory(query) {
  const text = String(query || "").trim();
  if (!text) return;
  await chrome.storage.local.set({ [PREFIX + text]: Date.now() });
}

export async function clearHistory() {
  const items = await allEntries();
  if (items.length) await chrome.storage.local.remove(items.map((item) => PREFIX + item.q));
}
