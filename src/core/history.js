/**
 * 最近搜索记录。
 *
 * 存储形态：一个查询词一个键 —— `hist:<查询词>` → 时间戳。
 * 为什么不用「一个数组来回读写」：多个搜索页可能同时记录，
 * 读-改-写在跨标签页时会产生竞态，实测并发搜索会丢掉记录。
 * 单键写入没有这个问题，同词重复写入天然覆盖。
 */

const PREFIX = "hist:";
const MAX = 50;

async function allEntries() {
  const everything = await chrome.storage.local.get(null);
  return Object.entries(everything)
    .filter(([key]) => key.startsWith(PREFIX))
    .map(([key, ts]) => ({ q: key.slice(PREFIX.length), ts: Number(ts) || 0 }))
    .sort((a, b) => b.ts - a.ts);
}

export async function readHistory() {
  const items = await allEntries();
  if (items.length > MAX) {
    chrome.storage.local.remove(items.slice(MAX).map((item) => PREFIX + item.q));
  }
  return items.slice(0, MAX);
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
