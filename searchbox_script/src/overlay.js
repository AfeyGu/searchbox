/**
 * 浮层：在任意页面按 Alt+K 唤起搜索。
 *
 * 实现方式是「iframe 承载宿主页」——不改动当前页面的 DOM 与样式，
 * 把所有 UI 冲突挡在 iframe 边界之外。
 * 按 Esc 关闭由被嵌入的宿主页通过 postMessage 通知（跨域下父页读不到子页按键）。
 */

export const HOST_URL = "https://afeygu.github.io/searchbox/searchbox_script/host.html";

/** 调试时可以用全局变量把宿主页指到本地。 */
function hostUrl() {
  return globalThis.__SEARCHBOX_HOST_URL__ || HOST_URL;
}
const SHORTCUT_KEY = "k";
const OVERLAY_ID = "searchbox-overlay";

const OVERLAY_CSS = `
#searchbox-overlay {
  position: fixed; inset: 0; z-index: 2147483647;
  display: flex; align-items: flex-start; justify-content: center;
  padding-top: 8vh; box-sizing: border-box;
}
#searchbox-overlay .sb-overlay-backdrop {
  position: absolute; inset: 0; background: rgba(15, 18, 22, 0.45);
  backdrop-filter: blur(2px);
}
#searchbox-overlay .sb-overlay-frame {
  position: relative; width: min(900px, 94vw); height: min(78vh, 820px);
  border: 0; border-radius: 14px; background: #fff;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.32);
}
`;

function ensureStyle() {
  if (document.getElementById("searchbox-overlay-style")) return;
  const style = document.createElement("style");
  style.id = "searchbox-overlay-style";
  style.textContent = OVERLAY_CSS;
  (document.head || document.documentElement).append(style);
}

function closeOverlay() {
  const box = document.getElementById(OVERLAY_ID);
  if (box) box.remove();
}

function openOverlay() {
  if (document.getElementById(OVERLAY_ID)) return;
  if (!document.body) return;
  ensureStyle();

  const box = document.createElement("div");
  box.id = OVERLAY_ID;

  const backdrop = document.createElement("div");
  backdrop.className = "sb-overlay-backdrop";
  backdrop.addEventListener("click", closeOverlay);

  const frame = document.createElement("iframe");
  frame.className = "sb-overlay-frame";
  frame.src = hostUrl() + (hostUrl().includes("?") ? "&" : "?") + "embed=1";
  frame.setAttribute("allow", "clipboard-write");

  box.append(backdrop, frame);
  document.body.append(box);
  frame.focus();
}

/** 宿主页被嵌入时，把自己的按键意图转告父页。 */
function wireEmbedClose() {
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    try {
      window.parent.postMessage({ type: "searchbox:close" }, "*");
    } catch (error) {
      /* 忽略 */
    }
  });
}

/** 在普通页面上安装快捷键与浮层。 */
export function installOverlay() {
  window.addEventListener("message", (event) => {
    if (event.data && event.data.type === "searchbox:close") closeOverlay();
  });

  document.addEventListener(
    "keydown",
    (event) => {
      if (!event.altKey || event.ctrlKey || event.metaKey) return;
      if (String(event.key).toLowerCase() !== SHORTCUT_KEY) return;
      event.preventDefault();
      event.stopPropagation();
      openOverlay();
    },
    true
  );

  if (typeof GM_registerMenuCommand === "function") {
    GM_registerMenuCommand("打开 Searchbox 搜索（Alt+K）", openOverlay);
  }
}

/** 被嵌入在浮层里时（同域的调试环境也会走这里）。 */
export function isEmbedded() {
  try {
    return window.top !== window.self;
  } catch (error) {
    return true;
  }
}

export { wireEmbedClose };
