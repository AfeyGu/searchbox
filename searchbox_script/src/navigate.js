/**
 * 快捷键：任意页面按 Alt+K 打开搜索。
 *
 * 行为：
 *   - 普通页面：新标签页打开宿主页；有选中文字就带上（?q=）
 *   - 宿主页内：直接把焦点放回搜索框
 *
 * 之所以跳转而不是浮层：浮层用 iframe 承载宿主页，打开时有一段空白加载、
 * 且丢掉 Ctrl+F / 缩放 / 地址栏等原生能力。新标签页跳转没有这些问题，
 * 原来的页面也不会被覆盖。
 */

export const HOST_URL = "https://afeygu.github.io/searchbox/searchbox_script/host.html";
const SHORTCUT_KEY = "k";
const MAX_SELECTION = 200;

function hostUrl(query) {
  const url = new URL(globalThis.__SEARCHBOX_HOST_URL__ || HOST_URL);
  if (query) url.searchParams.set("q", query);
  return url.toString();
}

/** 取当前选区，压成一行并截断。 */
export function currentSelection() {
  try {
    const raw = window.getSelection ? String(window.getSelection()) : "";
    return raw.replace(/\s+/g, " ").trim().slice(0, MAX_SELECTION);
  } catch (error) {
    return "";
  }
}

/** 打开搜索页：优先用 GM_openInTab（不受弹窗拦截影响），退化为 window.open。 */
export function openSearch(query) {
  const url = hostUrl(query);
  if (typeof GM_openInTab === "function") {
    GM_openInTab(url, { active: true, insert: true, setParent: true });
    return url;
  }
  window.open(url, "_blank", "noopener");
  return url;
}

function isHotkey(event) {
  return event.altKey && !event.ctrlKey && !event.metaKey && String(event.key).toLowerCase() === SHORTCUT_KEY;
}

/** 普通页面：Alt+K 新标签打开宿主页，带上选中的文字。 */
export function installHotkey() {
  document.addEventListener(
    "keydown",
    (event) => {
      if (!isHotkey(event)) return;
      event.preventDefault();
      event.stopPropagation();
      openSearch(currentSelection());
    },
    true
  );

  if (typeof GM_registerMenuCommand === "function") {
    GM_registerMenuCommand("用 Searchbox 搜索（Alt+K）", () => openSearch(currentSelection()));
  }
}

/** 宿主页内：Alt+K 把焦点放回搜索框。 */
export function installFocusShortcut() {
  document.addEventListener(
    "keydown",
    (event) => {
      if (!isHotkey(event)) return;
      const input = document.getElementById("q");
      if (!input) return;
      event.preventDefault();
      input.focus();
      input.select();
    },
    true
  );

  if (typeof GM_registerMenuCommand === "function") {
    GM_registerMenuCommand("聚焦搜索框（Alt+K）", () => {
      const input = document.getElementById("q");
      if (input) {
        input.focus();
        input.select();
      }
    });
  }
}
