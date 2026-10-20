/**
 * 后台：不发起搜索请求（搜索由页面内直连完成），只负责两件事：
 * 1. 新标签页软接管：检测到新标签页时跳到自己的搜索页（可用设置开关）
 * 2. 划词右键菜单：把选中文字带到搜索页
 *
 * 为什么是软接管而不是 manifest 的 chrome_url_overrides：
 * 后者装的时候才生效，运行时无法开关。
 */

const NEW_TAB = /^(?:chrome|edge):\/\/newtab\/?$/i;
const handled = new Set();

const MENU_ID = "searchbox-selection-search";
const MAX_SELECTION = 300;

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

/* ---------- 划词右键 ---------- */

/** 折叠空白并截断，避免超长选区把 URL 撑爆。 */
function normalizeSelection(text) {
  return String(text || "").replace(/\s+/g, " ").trim().slice(0, MAX_SELECTION);
}

function searchUrlFor(text) {
  const url = new URL(chrome.runtime.getURL("src/search.html"));
  url.searchParams.set("q", text);
  return url.toString();
}

/**
 * 确保右键菜单存在。
 * 注意：Edge/Chrome 的 contextMenus.create 走回调式，不返回 Promise，
 * 重复创建只会在 lastError 里报错，所以这里必须显式读取它再吞掉。
 */
function ensureMenu() {
  chrome.contextMenus.create(
    {
      id: MENU_ID,
      title: "用 Searchbox 搜索「%s」",
      contexts: ["selection"]
    },
    () => {
      void chrome.runtime.lastError; // 已存在时无需处理
    }
  );
}

// 每次后台唤醒都确保菜单在；已存在时 create 会失败并被吞掉，无副作用
ensureMenu();
chrome.runtime.onInstalled.addListener(ensureMenu);
chrome.runtime.onStartup.addListener(ensureMenu);

chrome.contextMenus.onClicked.addListener(handleMenuClick);

function handleMenuClick(info) {
  if (info.menuItemId !== MENU_ID) return undefined;
  const text = normalizeSelection(info.selectionText);
  if (!text) return undefined;
  return chrome.tabs.create({ url: searchUrlFor(text) });
}
