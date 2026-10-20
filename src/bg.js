/**
 * 后台：只做两件事，不发起搜索请求（搜索由页面内直连完成）。
 * 1. 新标签页软接管：检测到新标签页时跳到自己的搜索页（可用设置开关）
 * 2. 维护右键菜单（M3 接入具体行为）
 *
 * 为什么是软接管而不是 manifest 的 chrome_url_overrides：
 * 后者装的时候才生效，运行时无法开关。
 */

const NEW_TAB = /^(?:chrome|edge):\/\/newtab\/?$/i;
const handled = new Set();

async function takeoverEnabled() {
  const { newtabTakeover } = await chrome.storage.local.get({ newtabTakeover: true });
  return newtabTakeover;
}

async function maybeRedirect(tabId, url) {
  if (!url || !NEW_TAB.test(url)) return;
  if (handled.has(tabId)) return;
  handled.add(tabId);
  if (!(await takeoverEnabled())) return;
  try {
    await chrome.tabs.update(tabId, { url: chrome.runtime.getURL("src/search.html") });
  } catch {
    // 标签页可能已被关闭或不可更新，忽略
  }
}

chrome.tabs.onCreated.addListener((tab) => {
  maybeRedirect(tab.id, tab.pendingUrl || tab.url);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.url) maybeRedirect(tabId, changeInfo.url);
});

chrome.tabs.onRemoved.addListener((tabId) => {
  handled.delete(tabId);
});
