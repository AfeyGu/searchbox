// ==UserScript==
// @name         Searchbox
// @namespace    https://github.com/AfeyGu/searchbox
// @version      0.2.0
// @description  把 JSON 搜索 API 变成你自己的搜索结果页
// @author       AfeyGu
// @match        https://afeygu.github.io/searchbox/searchbox_script/host.html*
// @match        *://*/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @connect      *
// @run-at       document-idle
// ==/UserScript==

(function () {
"use strict";

const SB_CSS = ":root {\n  --bg: #ffffff;\n  --fg: #1a1a1a;\n  --muted: #5f6368;\n  --line: #e5e7eb;\n  --accent: #2b7cf4;\n  --card: #ffffff;\n  --hover: #f5f7fa;\n  --warn-bg: #fff8e1;\n  --warn-fg: #7a5b00;\n  --err-bg: #fdecea;\n  --err-fg: #a1201a;\n  --radius: 12px;\n}\n\n@media (prefers-color-scheme: dark) {\n  :root {\n    --bg: #14161a;\n    --fg: #e8eaed;\n    --muted: #9aa0a6;\n    --line: #2a2d33;\n    --accent: #7aa7ff;\n    --card: #1b1e23;\n    --hover: #22262c;\n    --warn-bg: #3a3113;\n    --warn-fg: #f2d675;\n    --err-bg: #3a1a17;\n    --err-fg: #ff9d94;\n  }\n}\n\n* { box-sizing: border-box; }\n\nhtml, body {\n  margin: 0;\n  padding: 0;\n  background: var(--bg);\n  color: var(--fg);\n  font: 16px/1.55 -apple-system, \"Segoe UI\", \"Microsoft YaHei\", system-ui, sans-serif;\n}\n\nbody[data-mode=\"home\"] {\n  min-height: 100vh;\n  display: grid;\n  place-items: center;\n}\n\n.wrap {\n  width: min(760px, 92vw);\n  margin: 0 auto;\n  padding: 24px 0 96px;\n}\n\nbody[data-mode=\"home\"] .wrap {\n  padding: 0;\n  transform: translateY(-6vh);\n}\n\n.brand {\n  text-align: center;\n  margin-bottom: 18px;\n}\n\nbody[data-mode=\"results\"] .brand { display: none; }\n\n.brand h1 {\n  margin: 0;\n  font-size: 34px;\n  font-weight: 650;\n  letter-spacing: 0.5px;\n}\n\n/* \u641c\u7d22\u6846 */\n\n.bar {\n  display: flex;\n  align-items: center;\n  gap: 10px;\n  background: var(--card);\n  border: 1px solid var(--line);\n  border-radius: 999px;\n  padding: 10px 16px;\n  transition: border-color 0.15s, box-shadow 0.15s;\n}\n\n.bar:focus-within {\n  border-color: var(--accent);\n  box-shadow: 0 1px 8px rgba(43, 124, 244, 0.16);\n}\n\nbody[data-mode=\"results\"] .bar {\n  border-radius: 14px;\n  margin-bottom: 18px;\n}\n\n.lens {\n  width: 18px;\n  height: 18px;\n  flex: 0 0 auto;\n  fill: none;\n  stroke: var(--muted);\n  stroke-width: 2;\n  stroke-linecap: round;\n}\n\n#q {\n  flex: 1 1 auto;\n  border: 0;\n  outline: none;\n  background: transparent;\n  color: var(--fg);\n  font: inherit;\n  font-size: 17px;\n  padding: 4px 0;\n}\n\n#q::-webkit-search-cancel-button { display: none; }\n\n#clear {\n  flex: 0 0 auto;\n  border: 0;\n  background: transparent;\n  color: var(--muted);\n  font-size: 20px;\n  line-height: 1;\n  cursor: pointer;\n  padding: 2px 6px;\n  border-radius: 50%;\n}\n\n#clear:hover { background: var(--hover); color: var(--fg); }\n\n.hint {\n  margin: 14px 0 0;\n  text-align: center;\n  color: var(--muted);\n  font-size: 13px;\n}\n\n/* \u6700\u8fd1\u641c\u7d22 */\n\n.history { margin-top: 26px; max-width: 520px; margin-left: auto; margin-right: auto; }\n\nbody[data-mode=\"results\"] .history { display: none; }\n\n.history-head {\n  display: flex;\n  justify-content: space-between;\n  align-items: center;\n  font-size: 12px;\n  color: var(--muted);\n  margin-bottom: 10px;\n  padding: 0 4px;\n}\n\n.history-head button {\n  border: 0;\n  background: none;\n  color: var(--muted);\n  font: inherit;\n  cursor: pointer;\n}\n\n.history-head button:hover { color: var(--fg); text-decoration: underline; }\n\n.history-list {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 8px;\n  justify-content: center;\n}\n\n.history-item {\n  max-width: 100%;\n  border: 1px solid var(--line);\n  background: var(--card);\n  color: var(--fg);\n  border-radius: 999px;\n  padding: 5px 12px;\n  font: inherit;\n  font-size: 13px;\n  cursor: pointer;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.history-item:hover { border-color: var(--accent); color: var(--accent); }\n\n/* \u72b6\u6001\u6761 */\n\n.status {\n  margin: 0 0 14px;\n  font-size: 13px;\n  color: var(--muted);\n  white-space: pre-line;\n}\n\nbody[data-mode=\"home\"] .status:empty { display: none; }\n\n.status.busy { color: var(--muted); }\n\n.status.warn,\n.status.error {\n  padding: 8px 12px;\n  border-radius: 10px;\n  font-size: 13px;\n}\n\n.status.warn { background: var(--warn-bg); color: var(--warn-fg); }\n.status.error { background: var(--err-bg); color: var(--err-fg); }\n\n/* \u6e90\u7ea7\u72b6\u6001\uff1a\u6bcf\u4e2a\u6e90\u4e00\u6761\uff0c\u6210\u529f\u62a5\u6761\u6570\u3001\u5931\u8d25\u62a5\u539f\u56e0 */\n\n.source-status {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 6px;\n  padding: 0;\n  background: none;\n}\n\n.chip {\n  font-size: 12px;\n  line-height: 20px;\n  padding: 0 10px;\n  border-radius: 999px;\n  border: 1px solid var(--line);\n  color: var(--muted);\n  background: var(--card);\n  font-family: inherit;\n}\n\n.chip.ok { color: var(--fg); background: var(--hover); }\n.chip.bad { color: var(--err-fg); background: var(--err-bg); border-color: transparent; }\n.chip.pending { color: var(--muted); border-style: dashed; background: transparent; }\n\n.source-status .chip:not(:disabled) { cursor: pointer; }\n.source-status .chip:not(:disabled):hover { border-color: var(--accent); color: var(--fg); }\n.chip.active { border-color: var(--accent); color: var(--accent); background: var(--bg); font-weight: 600; }\n.chip:disabled { cursor: default; }\n\n/* \u7ed3\u679c\u5217\u8868 */\n\n.results {\n  list-style: none;\n  margin: 0;\n  padding: 0;\n  display: flex;\n  flex-direction: column;\n  gap: 6px;\n}\n\n.hit {\n  display: grid;\n  grid-template-columns: 18px 1fr;\n  gap: 12px;\n  padding: 10px 12px;\n  border-radius: var(--radius);\n  border: 1px solid transparent;\n}\n\n.hit:hover { background: var(--hover); }\n\n.hit.selected {\n  background: var(--hover);\n  border-color: var(--accent);\n}\n\n.fav {\n  width: 18px;\n  height: 18px;\n  margin-top: 5px;\n  border-radius: 4px;\n  object-fit: contain;\n}\n\n.hit-link {\n  display: block;\n  text-decoration: none;\n  color: inherit;\n  min-width: 0; /* \u7f51\u683c\u9879\u9ed8\u8ba4 min-width:auto\uff0c\u4e0d\u8bbe\u4e3a 0 \u65f6\u957f\u6807\u9898\u4f1a\u628a\u6574\u884c\u6491\u7834 */\n}\n\n.hit-title {\n  margin: 0;\n  font-size: 17px;\n  font-weight: 550;\n  color: var(--accent);\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.hit.selected .hit-title,\n.hit:hover .hit-title { text-decoration: underline; }\n\n.hit-meta {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  margin-top: 2px;\n  font-size: 12px;\n  color: var(--muted);\n}\n\n.hit-source {\n  border: 1px solid var(--line);\n  border-radius: 999px;\n  padding: 0 6px;\n  font-size: 11px;\n  line-height: 16px;\n}\n\n.hit-source.more { border-style: dashed; }\n\n.hit-snippet {\n  grid-column: 2;\n  min-width: 0; /* \u540c\u4e0a\uff1a\u5426\u5219\u8d85\u957f\u6458\u8981\u4f1a\u6491\u7834\u7f51\u683c\u5217 */\n  margin: 4px 0 0;\n  font-size: 14px;\n  color: var(--muted);\n  display: -webkit-box;\n  -webkit-line-clamp: 2;\n  -webkit-box-orient: vertical;\n  overflow: hidden;\n}\n\n/* \u9aa8\u67b6\u5c4f */\n\n.hit.skeleton { grid-template-columns: 18px 1fr; }\n\n.sk-fav {\n  width: 18px;\n  height: 18px;\n  border-radius: 4px;\n  background: var(--line);\n}\n\n.sk-lines { display: block; }\n\n.sk-lines span {\n  display: block;\n  height: 12px;\n  border-radius: 6px;\n  background: var(--line);\n  margin-bottom: 8px;\n}\n\n.sk-lines span:first-child { width: 45%; }\n.sk-lines span:last-child { width: 80%; margin-bottom: 0; }\n\n@media (prefers-reduced-motion: no-preference) {\n  .hit.skeleton { animation: pulse 1.2s ease-in-out infinite; }\n  @keyframes pulse { 0%, 100% { opacity: 0.55; } 50% { opacity: 1; } }\n}\n\n/* \u8bbe\u7f6e\u5165\u53e3 */\n\n.settings {\n  position: fixed;\n  right: 20px;\n  bottom: 20px;\n  height: 32px;\n  padding: 0 14px;\n  border-radius: 999px;\n  border: 1px solid var(--line);\n  background: var(--card);\n  color: var(--muted);\n  font: inherit;\n  font-size: 13px;\n  cursor: pointer;\n  opacity: 0.85;\n  transition: opacity 0.15s, color 0.15s, border-color 0.15s;\n}\n\n.settings:hover { opacity: 1; color: var(--fg); border-color: var(--accent); }\n\nbody[data-mode=\"home\"] .settings { opacity: 0.7; }\n\n/* AI \u603b\u7ed3\u5361\u7247\uff1a\u72ec\u7acb\u4e8e\u7ed3\u679c\u5217\u8868\uff0c\u5931\u8d25\u4e0d\u5f71\u54cd\u7ed3\u679c\u5c55\u793a */\n\n.ai {\n  margin: 0 0 18px;\n  padding: 14px 16px;\n  border: 1px solid var(--line);\n  border-radius: var(--radius);\n  background: var(--hover);\n}\n\n.ai-head {\n  display: flex;\n  align-items: center;\n  gap: 10px;\n  margin-bottom: 8px;\n  font-size: 13px;\n  color: var(--muted);\n}\n\n.ai-badge {\n  font-weight: 600;\n  color: var(--fg);\n}\n\n.ai-meta {\n  flex: 1;\n  min-width: 0;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.ai-meta.error { color: var(--err-fg); }\n\n.ai-action {\n  border: 0;\n  background: none;\n  color: var(--accent);\n  font-size: 13px;\n  cursor: pointer;\n  padding: 2px 4px;\n  border-radius: 6px;\n}\n\n.ai-action:hover { background: var(--hover); }\n\n.ai-body { font-size: 15px; line-height: 1.7; }\n\n.ai-body p { margin: 0 0 10px; }\n\n.ai-body p:last-child { margin-bottom: 0; }\n\n.ai-body .ai-placeholder { color: var(--muted); }\n\n.ai-cite {\n  color: var(--accent);\n  text-decoration: none;\n  font-size: 0.92em;\n  vertical-align: super;\n}\n\n.ai-cite:hover { text-decoration: underline; }\n\n.ai.collapsed .ai-body { display: none; }\n\n@media (prefers-color-scheme: dark) {\n  .ai { background: var(--card); border-color: var(--line); }\n}\n\n\n.sb-panel {\n  position: fixed; right: 18px; bottom: 64px; width: min(560px, calc(100vw - 36px));\n  max-height: 76vh; overflow: auto; padding: 16px 18px; z-index: 20;\n  background: var(--card); color: var(--fg); border: 1px solid var(--line);\n  border-radius: var(--radius); box-shadow: 0 12px 32px rgba(0, 0, 0, 0.18);\n  font-size: 14px;\n}\n.sb-panel-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }\n.sb-panel h3 { margin: 16px 0 8px; font-size: 14px; }\n.sb-sources { display: grid; gap: 8px; }\n.sb-source { display: grid; grid-template-columns: auto 120px 1fr; gap: 10px; align-items: center; }\n.sb-source-name { font-weight: 550; }\n.sb-source input[type=\"password\"], .sb-field input, .sb-json, .sb-field textarea {\n  width: 100%; padding: 6px 8px; border: 1px solid var(--line); border-radius: 8px;\n  background: var(--bg); color: var(--fg); font: inherit; font-size: 13px;\n}\n.sb-json { font-family: ui-monospace, Consolas, monospace; font-size: 12.5px; }\n.sb-field { display: grid; gap: 6px; margin-bottom: 10px; }\n.sb-panel-actions { display: flex; align-items: center; justify-content: flex-end; gap: 12px; margin-top: 14px; }\n.sb-panel-status { color: var(--muted); font-size: 13px; }\n.sb-panel .btn { padding: 6px 12px; border-radius: 8px; border: 1px solid var(--line); background: var(--hover); color: var(--fg); cursor: pointer; }\n.sb-panel .btn.primary { background: var(--accent); border-color: var(--accent); color: #fff; }\n.sb-panel .btn.ghost { background: transparent; }\n.sb-panel .tip { color: var(--muted); font-size: 12.5px; margin: 8px 0; }\n";

/* ---- adapter: store.js ---- */
/**
 * 存储适配层：用 GM_setValue / GM_getValue 模拟 chrome.storage.local。
 *
 * 所有键都存在一个 GM 键下的 JSON 对象里，语义与 chrome.storage.local 的
 * get(null) / get("k") / get(["a","b"]) / get({a: 默认值}) / set / remove 对齐。
 * 这样 ../searchbox/src/core 里的代码可以原样复用。
 */

const ROOT_KEY = "searchbox.store";

function readAll() {
  try {
    const raw = GM_getValue(ROOT_KEY, "{}");
    const data = JSON.parse(raw);
    return data && typeof data === "object" ? data : {};
  } catch {
    return {};
  }
}

function writeAll(data) {
  GM_setValue(ROOT_KEY, JSON.stringify(data));
}

/** 把各种形式的 keys 归一成「要取哪些键」。 */
function normalizeKeys(keys, all) {
  if (keys === null || keys === undefined) return { names: Object.keys(all), defaults: {} };
  if (typeof keys === "string") return { names: [keys], defaults: {} };
  if (Array.isArray(keys)) return { names: keys.slice(), defaults: {} };
  if (typeof keys === "object") return { names: Object.keys(keys), defaults: keys };
  return { names: [], defaults: {} };
}

/** 造一个 chrome.storage.local 的等价物。 */
function createStorageLocal() {
  return {
    async get(keys) {
      const all = readAll();
      const { names, defaults } = normalizeKeys(keys, all);
      const out = {};
      for (const name of names) {
        if (Object.prototype.hasOwnProperty.call(all, name)) out[name] = all[name];
        else if (Object.prototype.hasOwnProperty.call(defaults, name)) out[name] = defaults[name];
      }
      return out;
    },
    async set(items) {
      const all = readAll();
      Object.assign(all, items || {});
      writeAll(all);
    },
    async remove(keys) {
      const all = readAll();
      for (const name of Array.isArray(keys) ? keys : [keys]) delete all[name];
      writeAll(all);
    }
  };
}

/** 页面里用得到的 chrome 子集：只包含被复用的代码会碰到的部分。 */
function createChromeStub(platform) {
  return {
    storage: { local: createStorageLocal() },
    runtime: {
      // 扩展里是 chrome://favicon，这里交给平台钩子（默认返回空串 → 首字母色块）
      getURL: () => "",
      openOptionsPage: () => platform.openSettings()
    }
  };
}

/* ---- adapter: net.js ---- */
/**
 * 请求适配层：用 GM_xmlhttpRequest 提供 fetch 的最小等价物。
 *
 * 负责两件事：
 *   1. 绕过跨域（绝大多数搜索/模型接口没有 CORS 放行头）
 *   2. 流式：把 GM 的 onprogress 增量转成 response.body.getReader()
 *
 * 只要满足被复用代码用到的那些成员：ok / status / url / headers.get / text / json / body.getReader
 */

/** 把 GM 的响应头字符串解析成 Map。 */
function parseHeaders(raw) {
  const map = new Map();
  for (const line of String(raw || "").split(/[\r\n]+/)) {
    const index = line.indexOf(":");
    if (index > 0) map.set(line.slice(0, index).trim().toLowerCase(), line.slice(index + 1).trim());
  }
  return map;
}

/** 队列式可读流：GM 推 chunk，消费方按需取。 */
function createChunkReader() {
  const queue = [];
  let pending = null;
  let closed = false;

  return {
    push(chunk) {
      if (!chunk) return;
      if (pending) {
        const resolve = pending;
        pending = null;
        resolve({ value: chunk, done: false });
      } else {
        queue.push(chunk);
      }
    },
    close() {
      closed = true;
      if (pending) {
        const resolve = pending;
        pending = null;
        resolve({ value: undefined, done: true });
      }
    },
    read() {
      if (queue.length) return Promise.resolve({ value: queue.shift(), done: false });
      if (closed) return Promise.resolve({ value: undefined, done: true });
      return new Promise((resolve) => {
        pending = resolve;
      });
    }
  };
}

/** 让文本走一遍 TextEncoder，好让复用代码里的 TextDecoder 正常工作。 */
const encoder = new TextEncoder();

/**
 * fetch 的等价物。
 * wantsStream 通过请求体里的 "stream":true 判断——这是我们唯一会用到流式的地方。
 */
function createFetch() {
  return function gmFetch(input, init = {}) {
    const url = String(input);
    const method = String(init.method || "GET").toUpperCase();
    const headers = init.headers || {};
    const body = init.body;
    const wantsStream = typeof body === "string" && body.indexOf('"stream":true') >= 0;

    return new Promise((resolve, reject) => {
      let text = "";
      let emitted = 0;
      let settled = false;
      const reader = wantsStream ? createChunkReader() : null;

      const emitDelta = () => {
        if (!reader || text.length <= emitted) return;
        reader.push(encoder.encode(text.slice(emitted)));
        emitted = text.length;
      };

      const handle = GM_xmlhttpRequest({
        method,
        url,
        headers,
        data: body,
        responseType: wantsStream ? "stream" : undefined,
        onprogress(event) {
          if (typeof event.responseText === "string" && event.responseText.length > text.length) {
            text = event.responseText;
            emitDelta();
          }
        },
        onload(response) {
          if (settled) return;
          settled = true;
          if (typeof response.responseText === "string" && response.responseText.length >= text.length) {
            text = response.responseText;
          }
          if (reader) {
            emitDelta();
            reader.close();
          }
          const headerMap = parseHeaders(response.responseHeaders);
          // 端点不返回 content-type 时，用内容形态兜底判断是不是 SSE
          if (!headerMap.has("content-type") && text.indexOf("data:") === 0) {
            headerMap.set("content-type", "text/event-stream");
          }
          resolve({
            ok: response.status >= 200 && response.status < 300,
            status: response.status,
            url: response.finalUrl || url,
            headers: { get: (name) => headerMap.get(String(name).toLowerCase()) ?? null },
            body: reader ? { getReader: () => reader } : null,
            text: async () => text,
            json: async () => JSON.parse(text)
          });
        },
        onerror() {
          if (settled) return;
          settled = true;
          if (reader) reader.close();
          reject(new TypeError("请求失败（网络不可达，或被拦截）"));
        },
        ontimeout() {
          if (settled) return;
          settled = true;
          if (reader) reader.close();
          reject(new Error("请求超时"));
        },
        onabort() {
          if (settled) return;
          settled = true;
          if (reader) reader.close();
          reject(Object.assign(new Error("已取消"), { name: "AbortError" }));
        }
      });

      if (init.signal) {
        if (init.signal.aborted) handle.abort();
        else init.signal.addEventListener("abort", () => handle.abort(), { once: true });
      }
    });
  };
}

/* ---- adapter: shell.js ---- */
/**
 * 外壳：把搜索页的 DOM 与样式注入宿主页面。
 *
 * 宿主页只需要一个空的 <body>，其余全部由这里生成——
 * 这样标记结构与扩展版的 search.html 保持一致，search.js 可以直接复用。
 */

const SHELL_HTML = `
<div class="wrap">
  <header class="brand"><h1>Searchbox</h1></header>
  <form id="form" class="bar" role="search" autocomplete="off">
    <svg class="lens" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="11" cy="11" r="7"></circle>
      <line x1="16.2" y1="16.2" x2="21" y2="21"></line>
    </svg>
    <input id="q" name="q" type="search" placeholder="搜索…" aria-label="搜索" spellcheck="false" autocomplete="off">
    <button id="clear" type="button" title="清空 (Esc)" hidden>×</button>
  </form>
  <p id="hint" class="hint">输入关键词，回车搜索 · 结果页可用 ↑↓ 选择、Enter 打开、Ctrl+Enter 新标签</p>
  <section id="history" class="history" hidden>
    <div class="history-head"><span>最近搜索</span><button id="history-clear" type="button">清空</button></div>
    <div id="history-list" class="history-list"></div>
  </section>
  <section id="status" class="status" hidden></section>
  <section id="ai" class="ai" hidden>
    <div class="ai-head">
      <span class="ai-badge">✨ AI 总结</span>
      <span id="ai-meta" class="ai-meta"></span>
      <button id="ai-retry" class="ai-action" type="button" hidden>重新总结</button>
      <button id="ai-toggle" class="ai-action" type="button">收起</button>
    </div>
    <div id="ai-body" class="ai-body"></div>
  </section>
  <ol id="results" class="results" hidden></ol>
</div>
<button id="settings" class="settings" type="button" title="打开设置">设置</button>
<div id="searchbox-panel" class="sb-panel" hidden></div>
`;

/** 把样式与 DOM 注入页面。已注入过则跳过。 */
function mountShell(css) {
  if (document.getElementById("searchbox-style")) return false;

  const style = document.createElement("style");
  style.id = "searchbox-style";
  style.textContent = css;
  document.head.append(style);

  document.body.dataset.mode = "home";
  document.body.insertAdjacentHTML("afterbegin", SHELL_HTML);
  return true;
}

/** 设置面板样式（只有油猴版需要）。 */
const PANEL_CSS = `
.sb-panel {
  position: fixed; right: 18px; bottom: 64px; width: min(560px, calc(100vw - 36px));
  max-height: 76vh; overflow: auto; padding: 16px 18px; z-index: 20;
  background: var(--card); color: var(--fg); border: 1px solid var(--line);
  border-radius: var(--radius); box-shadow: 0 12px 32px rgba(0, 0, 0, 0.18);
  font-size: 14px;
}
.sb-panel-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.sb-panel h3 { margin: 16px 0 8px; font-size: 14px; }
.sb-sources { display: grid; gap: 8px; }
.sb-source { display: grid; grid-template-columns: auto 120px 1fr; gap: 10px; align-items: center; }
.sb-source-name { font-weight: 550; }
.sb-source input[type="password"], .sb-field input, .sb-json, .sb-field textarea {
  width: 100%; padding: 6px 8px; border: 1px solid var(--line); border-radius: 8px;
  background: var(--bg); color: var(--fg); font: inherit; font-size: 13px;
}
.sb-json { font-family: ui-monospace, Consolas, monospace; font-size: 12.5px; }
.sb-field { display: grid; gap: 6px; margin-bottom: 10px; }
.sb-panel-actions { display: flex; align-items: center; justify-content: flex-end; gap: 12px; margin-top: 14px; }
.sb-panel-status { color: var(--muted); font-size: 13px; }
.sb-panel .btn { padding: 6px 12px; border-radius: 8px; border: 1px solid var(--line); background: var(--hover); color: var(--fg); cursor: pointer; }
.sb-panel .btn.primary { background: var(--accent); border-color: var(--accent); color: #fff; }
.sb-panel .btn.ghost { background: transparent; }
.sb-panel .tip { color: var(--muted); font-size: 12.5px; margin: 8px 0; }
`;

/* ---- adapter: panel.js ---- */
/**
 * 设置面板（宿主页版）：源开关 + Key + 源配置 JSON + AI 总结。
 *
 * 与扩展版的设置页相比是精简版：没有测试面板，源按 JSON 编辑。
 * 依赖由调用方注入（loadSources），因为它住在 __app 作用域里。
 */

const PANEL_ID = "searchbox-panel";

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** 打开设置面板。ctx.loadSources 来自共享核心。 */
async function openSettings(ctx) {
  const panel = document.getElementById(PANEL_ID);
  if (!panel) return;
  if (!panel.hidden) {
    panel.hidden = true;
    return;
  }

  const data = await ctx.storage.get({ sources: {}, keys: {}, ai: {} });
  const sources = await ctx.loadSources();
  const keys = data.keys || {};
  const ai = data.ai || {};

  panel.replaceChildren();
  panel.hidden = false;

  const head = el("div", "sb-panel-head");
  head.append(el("strong", "", "设置"));
  const close = el("button", "btn ghost", "关闭");
  close.type = "button";
  close.addEventListener("click", () => {
    panel.hidden = true;
  });
  head.append(close);
  panel.append(head);

  // ---- 搜索源 ----
  panel.append(el("h3", "", "搜索源"));
  const list = el("div", "sb-sources");
  const toggles = new Map();
  const keyInputs = new Map();

  for (const source of sources) {
    const row = el("label", "sb-source");
    const check = document.createElement("input");
    check.type = "checkbox";
    check.checked = source.enabled !== false;
    toggles.set(source.id, check);

    const name = el("span", "sb-source-name", source.name || source.id);
    const key = document.createElement("input");
    key.type = "password";
    key.placeholder = "API Key（可留空）";
    key.value = keys[source.id] || "";
    keyInputs.set(source.id, key);

    row.append(check, name, key);
    list.append(row);
  }
  panel.append(list);

  panel.append(el("p", "tip", "想新增或修改源的接口地址，直接改下面的 JSON（与扩展版同一套结构）。"));
  const json = document.createElement("textarea");
  json.className = "sb-json";
  json.rows = 8;
  json.spellcheck = false;
  json.value = JSON.stringify(data.sources || {}, null, 2);
  panel.append(json);

  // ---- AI 总结 ----
  panel.append(el("h3", "", "AI 总结"));
  const aiFields = {};
  const aiDefs = [
    ["url", "接口地址", "text", "https://open.bigmodel.cn/api/paas/v4/chat/completions"],
    ["model", "模型名", "text", "glm-4.7-flash"],
    ["key", "API Key", "password", "本地模型可留空"],
    ["detail", "结果条数", "number", "10"]
  ];
  for (const [name, label, type, placeholder] of aiDefs) {
    const row = el("label", "sb-field");
    row.append(el("span", "", label));
    const input = document.createElement("input");
    input.type = type;
    input.placeholder = placeholder;
    if (name === "key") input.value = keys.ai || "";
    else if (name === "detail") input.value = ai.detail || 10;
    else input.value = ai[name] || "";
    aiFields[name] = input;
    row.append(input);
    panel.append(row);
  }
  const promptRow = el("label", "sb-field");
  promptRow.append(el("span", "", "提示词（留空用默认）"));
  const prompt = document.createElement("textarea");
  prompt.rows = 3;
  prompt.value = ai.prompt || "";
  promptRow.append(prompt);
  panel.append(promptRow);

  const actions = el("div", "sb-panel-actions");
  const status = el("span", "sb-panel-status", "");
  const save = el("button", "btn primary", "保存");
  save.type = "button";
  actions.append(status, save);
  panel.append(actions);

  save.addEventListener("click", async () => {
    let overrides;
    try {
      overrides = JSON.parse(json.value || "{}");
    } catch (error) {
      status.textContent = "源配置 JSON 解析失败：" + error.message;
      return;
    }

    for (const source of sources) {
      const enabled = toggles.get(source.id).checked;
      overrides[source.id] = { ...(overrides[source.id] || source), enabled };
    }

    const nextKeys = { ...keys };
    for (const [id, input] of keyInputs) {
      const value = input.value.trim();
      if (value) nextKeys[id] = value;
      else delete nextKeys[id];
    }
    nextKeys.ai = aiFields.key.value.trim();

    const nextAi = {
      url: aiFields.url.value.trim(),
      model: aiFields.model.value.trim(),
      prompt: prompt.value.trim(),
      detail: Number(aiFields.detail.value) || 10
    };

    await ctx.storage.set({ sources: overrides, keys: nextKeys, ai: nextAi });
    status.textContent = "已保存";
    setTimeout(() => {
      status.textContent = "";
    }, 1500);
  });
}

/* ---- adapter: overlay.js ---- */
/**
 * 浮层：在任意页面按 Alt+K 唤起搜索。
 *
 * 实现方式是「iframe 承载宿主页」——不改动当前页面的 DOM 与样式，
 * 把所有 UI 冲突挡在 iframe 边界之外。
 * 按 Esc 关闭由被嵌入的宿主页通过 postMessage 通知（跨域下父页读不到子页按键）。
 */

const HOST_URL = "https://afeygu.github.io/searchbox/searchbox_script/host.html";

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
function installOverlay() {
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
function isEmbedded() {
  try {
    return window.top !== window.self;
  } catch (error) {
    return true;
  }
}

/* ---- 共享核心 + 搜索页（来自扩展版，未做任何改动） ---- */
function __app(chrome, fetch, platform) {
  /* extract.js */
  /**
   * 响应解析：把任意 JSON 响应按配置映射成统一的结果条目。
   * 纯函数，无副作用，可在 tests.html 里直接断言。
   */

  /** 按 "a.b.c" 取嵌套字段，取不到返回 undefined。 */
  function getPath(obj, path) {
    if (!obj || !path) return undefined;
    return String(path)
      .split(".")
      .reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
  }

  /** 按顺序取第一个非空值，作为字段兜底链。 */
  function pickFirst(item, paths) {
    for (const path of paths || []) {
      const value = getPath(item, path);
      if (value !== undefined && value !== null && value !== "") return value;
    }
    return undefined;
  }

  /** 成功判定：配了 okPath 才检查，否则有响应即视为成功。 */
  function isOk(raw, response) {
    if (!response || !response.okPath) return true;
    const expected = response.okValue === undefined ? 0 : response.okValue;
    return getPath(raw, response.okPath) === expected;
  }

  /**
   * 取出结果数组。
   * 返回 null 表示配置与实际响应不匹配（调用方据此报“配置错误”而不是“无结果”）。
   */
  function extractItems(raw, response) {
    if (!response || !response.itemsPath) return null;
    const list = getPath(raw, response.itemsPath);
    if (!Array.isArray(list)) return null;

    const fields = response.fields || {};
    return list
      .map((item) => ({
        title: String(pickFirst(item, fields.title) ?? "").trim(),
        url: String(pickFirst(item, fields.url) ?? "").trim(),
        snippet: String(pickFirst(item, fields.snippet) ?? "").trim()
      }))
      .filter((item) => item.url);
  }

  /* ---------- HTML 源（可选，用户自行编写） ---------- */

  /** 折叠空白并去首尾空格。 */
  function cleanText(value) {
    return String(value ?? "").replace(/\s+/g, " ").trim();
  }

  /** 把相对地址补成绝对地址；失败时原样返回。 */
  function absolutize(url, baseUrl) {
    if (!url) return "";
    try {
      return new URL(url, baseUrl || undefined).toString();
    } catch {
      return url;
    }
  }

  /** "h2 a@href" → { selector: "h2 a", attr: "href" } */
  function splitAttr(spec) {
    const match = String(spec).match(/^(.*?\S)\s*@([\w:-]+)$/);
    return match ? { selector: match[1], attr: match[2] } : { selector: String(spec), attr: null };
  }

  function readOne(node, spec, baseUrl) {
    const { selector, attr } = splitAttr(spec);
    const el = node.querySelector(selector);
    if (!el) return "";
    if (attr) return absolutize(el.getAttribute(attr) || "", baseUrl);
    return cleanText(el.textContent);
  }

  /** 字段支持单个选择器或选择器数组（依次兜底）。 */
  function readField(node, spec, baseUrl) {
    if (!spec) return "";
    for (const one of Array.isArray(spec) ? spec : [spec]) {
      const value = readOne(node, one, baseUrl);
      if (value) return value;
    }
    return "";
  }

  /**
   * 从 HTML 文档里按选择器取结果条目。
   * 配置形如： { items: "li.b_algo", fields: { title: "h2 a", url: "h2 a@href", snippet: ".b_lineclamp" } }
   * 返回 null 表示缺 items 选择器（配置错误），空数组表示没匹配到任何条目。
   */
  function extractHtmlItems(doc, response, baseUrl = "") {
    const itemSelector = response?.items;
    if (!itemSelector) return null;
    const fields = response.fields || {};

    return [...doc.querySelectorAll(itemSelector)]
      .map((node) => ({
        title: readField(node, fields.title, baseUrl),
        url: readField(node, fields.url, baseUrl),
        snippet: readField(node, fields.snippet, baseUrl)
      }))
      .filter((item) => item.url);
  }

  /* merge.js */
  /**
   * 结果合并：URL 归一化 → 去重 → 名次交错。
   * 纯函数，可在 tests.html 里直接断言。
   *
   * 为什么是名次交错而不是按分数排序：各家 score 没有共同尺度，
   * 混在一起排等于伪造排序。这里让每个源的第 1 条等权、第 2 条等权，
   * 同分时按源的先后顺序打破僵局。
   */

  /** 归一化 URL：去锚点、去 utm_* 追踪参数、去末尾斜杠。 */
  function normalizeUrl(input) {
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
  function interleave(groups, cap = 40) {
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

  /* history.js */
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
  const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

  /** 时间戳是否还在有效期内（纯函数，便于断言）。 */
  function isFresh(ts, now = Date.now()) {
    return Number(ts) > now - MAX_AGE_MS;
  }

  async function allEntries() {
    const everything = await chrome.storage.local.get(null);
    return Object.entries(everything)
      .filter(([key]) => key.startsWith(PREFIX))
      .map(([key, ts]) => ({ q: key.slice(PREFIX.length), ts: Number(ts) || 0 }))
      .sort((a, b) => b.ts - a.ts);
  }

  async function readHistory() {
    const now = Date.now();
    const all = await allEntries();
    const alive = all.filter((item) => isFresh(item.ts, now));

    const expired = all.filter((item) => !isFresh(item.ts, now));
    const overflow = alive.slice(MAX);
    const drop = [...expired, ...overflow].map((item) => PREFIX + item.q);
    if (drop.length) chrome.storage.local.remove(drop);

    return alive.slice(0, MAX);
  }

  async function recordHistory(query) {
    const text = String(query || "").trim();
    if (!text) return;
    await chrome.storage.local.set({ [PREFIX + text]: Date.now() });
  }

  async function clearHistory() {
    const items = await allEntries();
    if (items.length) await chrome.storage.local.remove(items.map((item) => PREFIX + item.q));
  }

  /* preset.js */
  /**
   * 内置搜索源（preset）。
   *
   * 用户改动存在 chrome.storage.local 的 `sources` 键下，按 id 覆盖这里同名条目；
   * 覆盖是整条替换，不做深合并——用户改了就由用户负责整份配置的完整性。
   *
   * 占位符只有三个：{{query}} {{key}} {{limit}}
   * 语义：含未解析占位符的 header / body 字段整条省略（用于 key 为空时自动走匿名）。
   */

  const PRESET_SOURCES = [
    {
      id: "anysearch",
      name: "AnySearch",
      origin: "https://api.anysearch.com",
      enabled: true,
      request: {
        url: "https://api.anysearch.com/v1/search",
        method: "POST",
        headers: { Authorization: "Bearer {{key}}" },
        body: { query: "{{query}}", max_results: "{{limit}}" }
      },
      response: {
        okPath: "code",
        okValue: 0,
        errorPath: "message",
        itemsPath: "data.results",
        fields: {
          title: ["title"],
          url: ["url"],
          snippet: ["snippet", "content"]
        },
        captureKeyPath: "data.auto_registered.api_key"
      },
      limits: { timeoutMs: 10000 }
    },
    {
      id: "tavily",
      name: "Tavily",
      origin: "https://api.tavily.com",
      enabled: false,
      request: {
        url: "https://api.tavily.com/search",
        method: "POST",
        headers: { Authorization: "Bearer {{key}}" },
        body: {
          query: "{{query}}",
          max_results: "{{limit}}"
        }
      },
      response: {
        itemsPath: "results",
        fields: {
          title: ["title"],
          url: ["url"],
          snippet: ["content"]
        }
      },
      limits: { timeoutMs: 10000 }
    }
  ];

  /** 读取生效的源列表：preset 打底，storage 中的用户版本按 id 覆盖，另加用户自定义源。 */
  async function loadSources() {
    const { sources = {} } = await chrome.storage.local.get("sources");
    const presetIds = new Set(PRESET_SOURCES.map((source) => source.id));

    const merged = PRESET_SOURCES.map((preset) => {
      const override = sources[preset.id];
      return override ? { ...preset, ...override } : { ...preset };
    });

    for (const [id, config] of Object.entries(sources)) {
      if (presetIds.has(id)) continue;
      merged.push({ ...config, id: config.id || id });
    }

    return merged;
  }

  /** 读取某个源的 key。 */
  async function loadKey(sourceId) {
    const { keys = {} } = await chrome.storage.local.get("keys");
    return keys[sourceId] || "";
  }

  /* request.js */
  /**
   * 请求构造与执行：把一份源配置 + 查询词，变成一次真实的 HTTP 调用。
   *
   * 占位符语义：
   *   {{query}} 查询词 | {{key}} 秘钥 | {{limit}} 条数
   *   字符串里含未解析占位符（值缺失或为空）时，该字段整条省略：
   *     - header 省略 → 例如 key 为空时不发 Authorization，自动走匿名
   *     - body 顶层字段省略 → 例如 Tavily 没填 key 时请求里的 api_key 不出现
   */


  const PLACEHOLDER = /\{\{\s*(\w+)\s*\}\}/g;
  const WHOLE_PLACEHOLDER = /^\{\{\s*(\w+)\s*\}\}$/;

  /** 填充单个字符串；有未解析的占位符则 ok=false。 */
  function fillString(text, vars) {
    let missing = false;
    const value = String(text).replace(PLACEHOLDER, (_, name) => {
      const v = vars[name];
      if (v === undefined || v === null || v === "") {
        missing = true;
        return "";
      }
      return String(v);
    });
    return { ok: !missing, value };
  }

  /**
   * 递归填充任意结构；失败的叶子/字段被丢弃。
   *
   * 整串就是一个占位符时保留原始类型：`"{{limit}}"` 里 limit 是数字，结果仍是数字。
   * 否则接口会把数字当字符串拒绝（anysearch 对 max_results 做 int 校验）。
   */
  function fillValue(value, vars) {
    if (typeof value === "string") {
      const whole = value.match(WHOLE_PLACEHOLDER);
      if (whole) {
        const raw = vars[whole[1]];
        if (raw === undefined || raw === null || raw === "") return { ok: false, value: undefined };
        return { ok: true, value: raw };
      }
      return fillString(value, vars);
    }
    if (Array.isArray(value)) {
      const out = [];
      for (const item of value) {
        const filled = fillValue(item, vars);
        if (filled.ok) out.push(filled.value);
      }
      return { ok: true, value: out };
    }
    if (value && typeof value === "object") {
      const out = {};
      for (const [key, item] of Object.entries(value)) {
        const filled = fillValue(item, vars);
        if (filled.ok) out[key] = filled.value;
      }
      return { ok: true, value: out };
    }
    return { ok: true, value };
  }

  /**
   * 取源需要授权的 origin 列表。
   * `origin` 可以是字符串，也可以是数组——抓网页时常被重定向到另一个域名
   * （例如 www.bing.com → cn.bing.com），每个落点都要单独授权。
   */
  function originsOf(source) {
    const raw = source?.origins ?? source?.origin ?? source?.request?.url ?? "";
    const list = Array.isArray(raw) ? raw : [raw];
    const seen = new Set();
    for (const item of list) {
      try {
        seen.add(new URL(String(item)).origin);
      } catch {
        // 非法地址忽略
      }
    }
    return [...seen];
  }

  /**
   * 执行一个源。
   * 返回 { ok, items?, error?, ms, newKey?, raw? }
   */
  async function runSource(source, query, options = {}) {
    const limit = options.limit ?? 10;
    const key = options.key ?? "";
    const vars = { query, key, limit };

    const request = source.request || {};
    const url = fillString(request.url || "", vars);
    if (!url.ok || !url.value) return { ok: false, error: "请求地址含未填充的占位符" };

    // 没有权限时，fetch 只会抛一句无从下手的 "Failed to fetch"，
    // 这里提前拦下来，直接说清楚是哪个域名没授权。
    const origins = originsOf(source);
    if (origins.length && chrome?.permissions?.contains) {
      const missing = [];
      for (const origin of origins) {
        if (!(await chrome.permissions.contains({ origins: [`${origin}/*`] }))) missing.push(origin);
      }
      if (missing.length) {
        return { ok: false, error: `未授权访问 ${missing.join("、")}，去设置页保存一次这个源即可授权` };
      }
    }

    const method = String(request.method || "GET").toUpperCase();
    const headers = {};
    for (const [name, raw] of Object.entries(request.headers || {})) {
      const filled = fillValue(raw, vars);
      if (filled.ok) headers[name] = String(filled.value);
    }

    let body;
    if (request.body !== undefined) {
      const filled = fillValue(request.body, vars);
      body = JSON.stringify(filled.value);
      if (!Object.keys(headers).some((h) => h.toLowerCase() === "content-type")) {
        headers["Content-Type"] = "application/json";
      }
    }

    const timeoutMs = source.limits?.timeoutMs ?? 10000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const started = performance.now();

    try {
      const response = await fetch(url.value, { method, headers, body, signal: controller.signal });
      const text = await response.text();
      const spec = source.response || {};
      const elapsed = () => Math.round(performance.now() - started);

      // HTML 源：按 CSS 选择器从页面里取条目（用户自行编写，不预置）
      if (source.type === "html") {
        const preview = text.slice(0, 20000);
        if (!response.ok) return { ok: false, error: `HTTP ${response.status}`, raw: preview };
        const doc = new DOMParser().parseFromString(text, "text/html");
        const htmlItems = extractHtmlItems(doc, spec, response.url || url.value);
        if (!htmlItems) {
          return { ok: false, error: "HTML 源缺少 response.items 选择器", raw: preview };
        }
        return { ok: true, items: htmlItems, ms: elapsed(), raw: preview };
      }

      let raw;
      try {
        raw = JSON.parse(text);
      } catch {
        return { ok: false, error: `响应不是 JSON（HTTP ${response.status}）` };
      }
      const apiMessage = getPath(raw, spec.errorPath);
      const describe = (typeof apiMessage === "string" && apiMessage) || "";

      if (!response.ok) {
        return { ok: false, error: describe ? `${response.status} · ${describe}` : `HTTP ${response.status}`, raw };
      }
      if (!isOk(raw, spec)) {
        return { ok: false, error: describe || "接口返回失败", raw };
      }

      const items = extractItems(raw, spec);
      if (!items) {
        return { ok: false, error: `未取到结果数组：${spec.itemsPath}`, raw };
      }

      const newKey = spec.captureKeyPath ? getPath(raw, spec.captureKeyPath) : undefined;
      return { ok: true, items, ms: elapsed(), newKey, raw };
    } catch (error) {
      if (error?.name === "AbortError") return { ok: false, error: `超时 ${timeoutMs}ms` };
      const message = String(error?.message || error);
      if (/failed to fetch|networkerror|load failed/i.test(message)) {
        return { ok: false, error: "请求失败（可能被重定向到未授权的域名，或网络不可达）" };
      }
      return { ok: false, error: message };
    } finally {
      clearTimeout(timer);
    }
  }

  /* settings.js */
  /**
   * 运行期设置。目前只有一项：每个来源取多少条。
   *
   * 注意「最多显示多少条」是另一个数（RESULT_LIMIT，合并后的总上限），
   * 它是产品形状的一部分，不对外开放。
   */

  const DEFAULT_PER_SOURCE_LIMIT = 10;
  const MIN_PER_SOURCE_LIMIT = 1;
  const MAX_PER_SOURCE_LIMIT = 50;

  /** 把用户输入收敛到合法区间；非数字时回退默认值。纯函数，便于断言。 */
  function clampLimit(value, fallback = DEFAULT_PER_SOURCE_LIMIT) {
    const number = Number(value);
    if (!Number.isFinite(number) || value === "" || value === null) return fallback;
    return Math.min(MAX_PER_SOURCE_LIMIT, Math.max(MIN_PER_SOURCE_LIMIT, Math.round(number)));
  }

  async function loadPerSourceLimit() {
    const { perSourceLimit } = await chrome.storage.local.get("perSourceLimit");
    return clampLimit(perSourceLimit);
  }

  async function savePerSourceLimit(value) {
    const limit = clampLimit(value);
    await chrome.storage.local.set({ perSourceLimit: limit });
    return limit;
  }

  /* ai.js */
  /**
   * AI 总结：把当前结果压成上下文交给模型，流式取回文本。
   *
   * 纯逻辑（构造 messages、解析 SSE）都放在这里，tests.html 可以直接断言；
   * 网络部分只依赖 fetch，没有任何第三方库。
   */

  const AI_STORAGE = "ai";
  const DEFAULT_DETAIL = 10;
  const DEFAULT_PROMPT =
    "你是搜索助手。只依据下面给出的搜索结果作答，不要编造；信息不足就直说。用中文，200 字以内，引用来源时用 [1][2] 这样的编号。";

  /** 从 URL 里取域名，取不到返回空串。 */
  function hostOf(url) {
    try {
      return new URL(url).host.replace(/^www[.]/, "");
    } catch {
      return "";
    }
  }

  /** 把「查询词 + 结果」压成 chat messages。纯函数。 */
  function buildMessages({ query, hits, detail = DEFAULT_DETAIL, prompt = DEFAULT_PROMPT }) {
    const picked = (hits || []).slice(0, Math.max(1, Number(detail) || DEFAULT_DETAIL));

    const blocks = picked.map((hit, index) => {
      const title = String(hit.title || "").trim() || hostOf(hit.url);
      const host = hostOf(hit.url);
      const snippet = String(hit.snippet || "").replace(/\s+/g, " ").trim().slice(0, 200);
      const head = `[${index + 1}] ${title}${host ? ` — ${host}` : ""}`;
      return snippet ? `${head}\n${snippet}` : head;
    });

    const user = `用户查询：${query}\n\n以下是搜索结果：\n${blocks.join("\n\n")}`;
    return [
      { role: "system", content: String(prompt || DEFAULT_PROMPT) },
      { role: "user", content: user }
    ];
  }

  /**
   * SSE 增量解析器：喂 chunk，逐条回调 delta 文本。
   * 只认 OpenAI 风格的 "data: {...}" 行，遇到 "[DONE]" 即结束。
   */
  function createSseParser(onDelta) {
    const LF = String.fromCharCode(10);
    let buffer = "";
    let finished = false;

    const handleLine = (line) => {
      const text = line.trim();
      if (!text || text.indexOf("data:") !== 0) return;
      const payload = text.slice(5).trim();
      if (payload === "[DONE]") {
        finished = true;
        return;
      }
      try {
        const json = JSON.parse(payload);
        const choice = (json.choices && json.choices[0]) || {};
        const delta = (choice.delta && choice.delta.content) || choice.text || "";
        if (delta) onDelta(delta);
      } catch {
        // 半行或非 JSON，忽略
      }
    };

    return {
      push(chunk) {
        buffer += chunk;
        let index;
        while ((index = buffer.indexOf(LF)) >= 0) {
          handleLine(buffer.slice(0, index));
          buffer = buffer.slice(index + 1);
        }
      },
      flush() {
        if (buffer) {
          handleLine(buffer);
          buffer = "";
        }
      },
      get finished() {
        return finished;
      }
    };
  }

  /** 读取 AI 配置；地址或模型缺失时返回 null（= 不启用）。 */
  async function loadAiConfig() {
    const data = await chrome.storage.local.get({ ai: {}, keys: {} });
    const ai = data.ai || {};
    const url = String(ai.url || "").trim();
    const model = String(ai.model || "").trim();
    if (!url || !model) return null;

    return {
      url,
      model,
      prompt: String(ai.prompt || "").trim() || DEFAULT_PROMPT,
      detail: Math.min(30, Math.max(1, Number(ai.detail) || DEFAULT_DETAIL)),
      key: String((data.keys || {}).ai || ""),
      name: String(ai.name || "").trim()
    };
  }

  /** AI 端点需要授权的 origin 列表。 */
  function aiOriginsOf(config) {
    try {
      return [new URL(config.url).origin];
    } catch {
      return [];
    }
  }

  /**
   * 跑一次总结。成功时通过 onDelta 增量吐出文本，返回耗时。
   * 断言：失败一定抛错，绝不影响调用方的搜索结果展示。
   */
  async function runSummary({ config, query, hits, signal, onDelta }) {
    const started = performance.now();
    const headers = { "Content-Type": "application/json" };
    if (config.key) headers.Authorization = `Bearer ${config.key}`;

    const response = await fetch(config.url, {
      method: "POST",
      headers,
      signal,
      body: JSON.stringify({
        model: config.model,
        messages: buildMessages({ query, hits, detail: config.detail, prompt: config.prompt }),
        stream: true,
        temperature: 0.3
      })
    });

    if (!response.ok) {
      const raw = await response.text().catch(() => "");
      throw new Error(`HTTP ${response.status}${raw ? ` · ${raw.slice(0, 120)}` : ""}`);
    }

    const type = response.headers.get("content-type") || "";
    if (response.body && type.indexOf("event-stream") >= 0) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      const parser = createSseParser(onDelta);
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        parser.push(decoder.decode(value, { stream: true }));
        if (parser.finished) break;
      }
      parser.flush();
      return { ok: true, ms: Math.round(performance.now() - started) };
    }

    // 端点忽略了 stream 参数：退回一次性解析
    const json = await response.json();
    const choice = (json.choices && json.choices[0]) || {};
    const text = (choice.message && choice.message.content) || choice.text || "";
    if (!text) throw new Error("模型返回为空");
    onDelta(text);
    return { ok: true, ms: Math.round(performance.now() - started) };
  }

  /* search.js */
  /**
   * 搜索页：首页与结果页是同一个页面。
   * 无 q 参数 = 首页（搜索框居中）；有 q 参数 = 结果页。
   */







  const form = document.getElementById("form");
  const input = document.getElementById("q");
  const clearButton = document.getElementById("clear");
  const hint = document.getElementById("hint");
  const statusEl = document.getElementById("status");
  const resultsEl = document.getElementById("results");
  const historyBox = document.getElementById("history");
  const historyList = document.getElementById("history-list");
  const historyClear = document.getElementById("history-clear");
  const aiEl = document.getElementById("ai");
  const aiMeta = document.getElementById("ai-meta");
  const aiBody = document.getElementById("ai-body");
  const aiRetry = document.getElementById("ai-retry");
  const aiToggle = document.getElementById("ai-toggle");

  const RESULT_LIMIT = 40;   // 合并去重后的总上限（不对外配置）

  let allHits = [];         // 合并去重后的全集
  let hits = [];            // 当前可见（受来源过滤影响）
  let selected = -1;
  let currentRun = 0;
  let filterSource = null;  // null = 全部来源
  let lastRun = { ms: 0, rawTotal: 0, settled: [] };
  let summary = { started: false, abort: null, hits: [], text: "" };

  /* ---------- 小工具 ---------- */

  function hostOf(url) {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return url;
    }
  }

  function faviconUrl(pageUrl) {
    // 宿主页（油猴版）拿不到 chrome://favicon，由平台注入替代实现
    const custom = globalThis.__SEARCHBOX_FAVICON__;
    if (typeof custom === "function") return custom(pageUrl);

    const url = new URL(chrome.runtime.getURL("/_favicon/"));
    url.searchParams.set("pageUrl", pageUrl);
    url.searchParams.set("size", "32");
    return url.toString();
  }

  function setMode(mode) {
    document.body.dataset.mode = mode;
    hint.hidden = mode !== "home";
    resultsEl.hidden = mode !== "results";
  }

  function setStatus(text, kind = "info") {
    statusEl.textContent = text || "";
    statusEl.className = `status ${kind}`;
    statusEl.hidden = !text;
  }

  /* ---------- 渲染 ---------- */

  function renderSkeleton() {
    resultsEl.replaceChildren();
    for (let i = 0; i < 4; i += 1) {
      const li = document.createElement("li");
      li.className = "hit skeleton";
      li.innerHTML = '<span class="sk-fav"></span><span class="sk-lines"><span></span><span></span></span>';
      resultsEl.append(li);
    }
  }

  function renderResults() {
    const scrollY = window.scrollY;
    resultsEl.replaceChildren();
    if (hits.length) paintHits();
    window.scrollTo({ top: scrollY });
  }

  function paintHits() {
    hits.forEach((hit, index) => {
      const li = document.createElement("li");
      li.className = "hit";
      li.dataset.index = String(index);

      const icon = document.createElement("img");
      icon.className = "fav";
      icon.loading = "lazy";
      icon.alt = "";
      icon.src = faviconUrl(hit.url);
      icon.addEventListener("error", () => icon.remove(), { once: true });

      const link = document.createElement("a");
      link.className = "hit-link";
      link.href = hit.url;

      const title = document.createElement("h2");
      title.className = "hit-title";
      // 有些接口的 title 直接就是一串链接，这种当域名显示，比裸 URL 可读
      const titleIsUrl = /^https?:\/\//i.test(hit.title || "");
      title.textContent = !hit.title || titleIsUrl ? hostOf(hit.url) : hit.title;

      const meta = document.createElement("div");
      meta.className = "hit-meta";
      const site = document.createElement("span");
      site.className = "hit-host";
      site.textContent = hostOf(hit.url);
      meta.append(site);
      if (hit.sourceName) {
        const names = (hit.sources?.length ? hit.sources : [{ id: hit.sourceId, name: hit.sourceName }]).map(
          (source) => source.name
        );
        const shown = names.slice(0, 3);
        for (const name of shown) {
          const badge = document.createElement("span");
          badge.className = "hit-source";
          badge.textContent = name;
          meta.append(badge);
        }
        if (names.length > shown.length) {
          const more = document.createElement("span");
          more.className = "hit-source more";
          more.textContent = `+${names.length - shown.length}`;
          more.title = names.join("、");
          meta.append(more);
        }
      }

      link.append(title, meta);

      const snippet = document.createElement("p");
      snippet.className = "hit-snippet";
      snippet.textContent = hit.snippet;

      li.append(icon, link, snippet);
      resultsEl.append(li);
    });
  }

  /* ---------- 搜索 ---------- */

  async function search(query) {
    const runId = ++currentRun;
    selected = -1;
    hits = [];
    allHits = [];
    recordHistory(query);
    setMode("results");
    renderSkeleton();
    setStatus(`正在搜索「${query}」…`, "busy");
    resetSummary();
    const aiConfig = await loadAiConfig();

    // 不写 enabled 视为启用，与设置页的 `enabled !== false` 保持一致
    const sources = (await loadSources()).filter((source) => source.enabled !== false);
    if (!sources.length) {
      resultsEl.replaceChildren();
      setStatus("没有启用的搜索源，去设置页开启一个", "error");
      return;
    }

    const perSourceLimit = await loadPerSourceLimit();
    const started = performance.now();
    const settled = new Array(sources.length).fill(null);

    /** 每有一个源返回就重算一次：先到的先显示，不用等最慢的那个。 */
    const paint = () => {
      if (runId !== currentRun) return;
      const done = settled.filter(Boolean);
      const groups = done
        .filter((item) => item.ok)
        .map((item) => ({ id: item.source.id, name: item.source.name, items: item.items }));
      const pending = sources.length - done.length;

      allHits = interleave(groups, RESULT_LIMIT);
      lastRun = {
        ms: Math.round(performance.now() - started),
        rawTotal: groups.reduce((sum, group) => sum + group.items.length, 0),
        settled: done
      };
      clearExtraStatus();
      renderChips(done, sources);

      if (!groups.length && pending > 0) {
        setStatus(`搜索「${query}」（${done.length}/${sources.length} 个来源已返回）…`, "busy");
        return; // 保留骨架屏
      }
      if (!groups.length) {
        resultsEl.replaceChildren();
        setStatus(done.map((item) => `${item.source.name}：${item.error}`).join("\n") || "全部搜索源都失败了", "error");
        return;
      }
      applyFilter({ pending });

      // 等所有来源都返回（含失败/超时）再总结，避免用残缺的结果下结论
      if (aiConfig && pending === 0 && allHits.length) {
        startSummary(runId, query, aiConfig);
      }
    };

    await Promise.all(
      sources.map(async (source, index) => {
        const key = await loadKey(source.id);
        const result = await runSource(source, query, { limit: perSourceLimit, key });
        if (result.ok && result.newKey) await rememberKey(source.id, result.newKey);
        settled[index] = { source, ...result };
        paint();
      })
    );
  }


  /* ---------- AI 总结 ----------
   * 独立于搜索链路：结果先渲染，总结在后台跑，失败只影响这一块卡片。
   */

  function resetSummary() {
    if (summary.abort) summary.abort.abort();
    summary = { started: false, abort: null, hits: [], text: "" };
    aiEl.hidden = true;
    aiEl.classList.remove("collapsed");
    aiBody.replaceChildren();
    aiMeta.textContent = "";
    aiMeta.className = "ai-meta";
    aiRetry.hidden = true;
    aiToggle.textContent = "收起";
  }

  async function startSummary(runId, query, aiConfig) {
    if (runId !== currentRun || summary.started || !allHits.length) return;

    summary.started = true;
    summary.text = "";
    summary.hits = allHits.slice(0, aiConfig.detail);
    aiEl.hidden = false;
    aiRetry.hidden = true;
    aiMeta.className = "ai-meta";
    aiMeta.textContent = `思考中… · 基于 ${summary.hits.length} 条结果`;
    aiBody.innerHTML = '<p class="ai-placeholder">正在总结…</p>';

    const controller = new AbortController();
    summary.abort = controller;

    try {
      const result = await runSummary({
        config: aiConfig,
        query,
        hits: summary.hits,
        signal: controller.signal,
        onDelta: (delta) => {
          if (runId !== currentRun) return;
          summary.text += delta;
          renderSummaryBody();
        }
      });
      if (runId !== currentRun) return;
      aiMeta.textContent = `基于 ${summary.hits.length} 条结果 · ${aiConfig.model} · ${result.ms} ms`;
      if (!summary.text) {
        aiMeta.className = "ai-meta error";
        aiMeta.textContent = "模型没有返回内容";
        aiRetry.hidden = false;
      }
    } catch (error) {
      if (controller.signal.aborted || runId !== currentRun) return;
      aiMeta.className = "ai-meta error";
      aiMeta.textContent = `AI 总结失败：${error.message}`;
      aiBody.replaceChildren();
      aiRetry.hidden = false;
    }
  }

  /** 极简渲染：段落、**加粗**、[n] 引用跳转。 */
  function renderSummaryBody() {
    const text = summary.text.trim();
    aiBody.replaceChildren();
    if (!text) {
      aiBody.innerHTML = '<p class="ai-placeholder">正在总结…</p>';
      return;
    }

    const token = /(\[[0-9]+\]|[*][*][^*]+[*][*])/g;

    for (const para of text.split(String.fromCharCode(10) + String.fromCharCode(10))) {
      const p = document.createElement("p");
      let last = 0;
      let match;
      token.lastIndex = 0;
      while ((match = token.exec(para)) !== null) {
        if (match.index > last) p.append(document.createTextNode(para.slice(last, match.index)));
        const piece = match[0];
        if (piece.charAt(0) === "[") {
          const index = Number(piece.slice(1, -1));
          const hit = summary.hits[index - 1];
          if (hit) {
            const link = document.createElement("a");
            link.className = "ai-cite";
            link.href = hit.url;
            link.textContent = piece;
            link.target = "_blank";
            link.rel = "noreferrer";
            p.append(link);
          } else {
            p.append(document.createTextNode(piece));
          }
        } else {
          const strong = document.createElement("strong");
          strong.textContent = piece.slice(2, -2);
          p.append(strong);
        }
        last = match.index + piece.length;
      }
      if (last < para.length) p.append(document.createTextNode(para.slice(last)));
      aiBody.append(p);
    }
  }

  /** 手动重跑（点「重新总结」）。 */
  function retrySummary() {
    const query = input.value.trim();
    if (!query) return;
    const runId = currentRun;
    summary.started = false;
    summary.text = "";
    summary.hits = [];
    aiRetry.hidden = true;
    loadAiConfig().then((config) => {
      if (!config) return;
      startSummary(runId, query, config);
    });
  }

  aiToggle.addEventListener("click", () => {
    const collapsed = aiEl.classList.toggle("collapsed");
    aiToggle.textContent = collapsed ? "展开" : "收起";
  });

  aiRetry.addEventListener("click", retrySummary);

  /** 按当前来源取结果。
   *  全部视图 → 合并去重后的全集；
   *  单源视图 → 该源原始返回，不参与跨源去重（点了哪家就该看到哪家的全部结果）。
   */
  function currentHits() {
    if (!filterSource) return allHits;
    const group = lastRun.settled.find((item) => item.ok && item.source.id === filterSource);
    if (!group) return [];
    return group.items.map((item) => ({
      ...item,
      sourceId: group.source.id,
      sourceName: group.source.name
    }));
  }

  /** 按当前来源过滤，重绘结果与状态文字。 */
  function applyFilter({ pending = 0 } = {}) {
    hits = currentHits();
    selected = -1;
    renderResults();

    document.querySelectorAll(".source-status .chip").forEach((chip) => {
      chip.classList.toggle("active", (chip.dataset.sourceId || null) === filterSource);
    });

    const waiting = pending > 0 ? `（还有 ${pending} 个来源在返回…）` : "";

    if (!hits.length) {
      setStatus(
        filterSource ? `${nameOfSource(filterSource)} 没有返回结果` : "没有结果，换个说法试试",
        "error"
      );
      return;
    }

    let summary;
    if (filterSource) {
      const kept = allHits.filter((hit) => hit.sources?.some((source) => source.id === filterSource)).length;
      summary = `${nameOfSource(filterSource)} · ${hits.length} 条 · ${lastRun.ms} ms（去重后并入「全部」${kept} 条）`;
    } else {
      const duplicates = lastRun.rawTotal - allHits.length;
      summary = `${hits.length} 条结果 · ${lastRun.ms} ms` +
        (duplicates > 0 ? `（${lastRun.rawTotal} 条合并去重 ${duplicates} 条）` : "");
    }
    setStatus(summary + waiting, pending > 0 ? "busy" : "info");
  }

  function nameOfSource(id) {
    return lastRun.settled.find((item) => item.source.id === id)?.source.name || id;
  }

  /** 来源标签：既是状态也是过滤器，点一下只看这一家，再点回到全部。 */
  function renderChips(done, sources) {
    const box = document.createElement("div");
    box.className = "status extra source-status";

    const all = document.createElement("button");
    all.type = "button";
    all.className = "chip all";
    all.dataset.sourceId = "";
    all.textContent = `全部 ${allHits.length}`;
    all.addEventListener("click", () => {
      filterSource = null;
      applyFilter();
    });
    box.append(all);

    for (const source of sources) {
      const item = done?.find((entry) => entry.source.id === source.id);
      const chip = document.createElement("button");
      chip.type = "button";
      chip.dataset.sourceId = source.id;

      if (!item) {
        chip.className = "chip pending";
        chip.disabled = true;
        chip.textContent = `${source.name} 搜索中…`;
      } else if (item.ok) {
        chip.className = "chip ok";
        chip.textContent = `${source.name} ${item.items.length} 条`;
        chip.title = `只看 ${source.name}`;
        chip.addEventListener("click", () => {
          filterSource = filterSource === source.id ? null : source.id;
          applyFilter();
        });
      } else {
        chip.className = "chip bad";
        chip.disabled = true;
        chip.textContent = `${source.name}：${item.error}`;
        chip.title = item.error;
      }
      box.append(chip);
    }

    statusEl.after(box);

    // 被过滤的源这一轮没结果时自动回到全部，避免空白页
    if (filterSource && !done?.some((item) => item.ok && item.source.id === filterSource)) {
      filterSource = null;
    }
  }

  /** 移除上一轮搜索留下的附加提示（失败横幅等），避免多次搜索后堆积。 */
  function clearExtraStatus() {
    document.querySelectorAll(".status.extra").forEach((el) => el.remove());
  }

  async function rememberKey(sourceId, apiKey) {
    const { keys = {} } = await chrome.storage.local.get("keys");
    if (keys[sourceId] === apiKey) return;
    keys[sourceId] = apiKey;
    await chrome.storage.local.set({ keys });
  }

  /* ---------- 最近搜索 ---------- */

  async function renderHistory() {
    const items = (await readHistory()).slice(0, 8);
    historyBox.hidden = !items.length;
    historyList.replaceChildren();
    for (const item of items) {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "history-item";
      chip.textContent = item.q;
      chip.title = item.q;
      chip.addEventListener("click", () => goTo(item.q));
      historyList.append(chip);
    }
  }

  historyClear.addEventListener("click", async () => {
    await clearHistory();
    await renderHistory();
    input.focus();
  });

  /* ---------- 导航与交互 ---------- */

  function goTo(query, { replace = false } = {}) {
    const url = new URL(location.href);
    url.search = "";
    url.searchParams.set("q", query);
    history[replace ? "replaceState" : "pushState"](null, "", url);
    input.value = query;
    clearButton.hidden = !query;
    search(query);
  }

  function goHome({ replace = false } = {}) {
    currentRun += 1;
    hits = [];
    selected = -1;
    input.value = "";
    clearButton.hidden = true;
    resultsEl.replaceChildren();
    setStatus("");
    setMode("home");
    const url = new URL(location.href);
    url.search = "";
    history[replace ? "replaceState" : "pushState"](null, "", url);
    renderHistory();
    input.focus();
  }

  function select(index) {
    const items = [...resultsEl.querySelectorAll(".hit:not(.skeleton)")];
    if (!items.length) return;
    const next = Math.max(0, Math.min(index, items.length - 1));
    items.forEach((el) => el.classList.remove("selected"));
    const target = items[next];
    target.classList.add("selected");
    target.scrollIntoView({ block: "nearest" });
    selected = next;
  }

  function openSelected({ newTab = false } = {}) {
    const hit = hits[selected];
    if (!hit) return false;
    if (newTab) window.open(hit.url, "_blank", "noopener");
    else location.href = hit.url;
    return true;
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const query = input.value.trim();
    if (query) goTo(query);
  });

  input.addEventListener("input", () => {
    selected = -1;
    clearButton.hidden = !input.value;
    resultsEl.querySelectorAll(".hit.selected").forEach((el) => el.classList.remove("selected"));
  });

  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && selected >= 0 && !event.shiftKey) {
      event.preventDefault();
      openSelected({ newTab: event.ctrlKey || event.metaKey || event.altKey });
      return;
    }
    if (event.key === "ArrowDown" && hits.length) {
      event.preventDefault();
      select(selected + 1);
    }
    if (event.key === "Escape") {
      event.preventDefault();
      if (input.value) {
        input.value = "";
        clearButton.hidden = true;
        goHome();
      }
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.target === input) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (!hits.length) return;
      event.preventDefault();
      select(selected + (event.key === "ArrowDown" ? 1 : -1));
    } else if (event.key === "Enter" && selected >= 0) {
      event.preventDefault();
      openSelected({ newTab: event.ctrlKey || event.metaKey || event.altKey });
    }
  });

  clearButton.addEventListener("click", () => {
    goHome();
  });

  document.getElementById("settings").addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });

  window.addEventListener("popstate", () => {
    const query = new URLSearchParams(location.search).get("q") || "";
    input.value = query;
    clearButton.hidden = !query;
    if (query) search(query);
    else goHome({ replace: true });
  });

  /* ---------- 启动 ---------- */

  /**
   * 尽量把焦点拉到搜索框。
   *
   * Ctrl+T 之后焦点在浏览器地址栏里，网页无法直接夺回（这是浏览器的焦点保护），
   * 但页面拿到焦点时（切换标签、按 Esc 从地址栏退回内容区）应该立刻落在输入框上，
   * 所以这里既主动尝试，也在获得焦点时补一次。
   */
  function focusSearchBox() {
    try {
      window.focus();
    } catch {
      /* 某些环境会拒绝，忽略 */
    }
    input.focus({ preventScroll: true });
  }

  function wireFocusRecovery() {
    window.addEventListener("focus", () => {
      if (document.body.dataset.mode === "home" && document.activeElement !== input) {
        input.focus({ preventScroll: true });
      }
    });
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden && document.body.dataset.mode === "home") {
        focusSearchBox();
      }
    });
  }

  function boot() {
    wireFocusRecovery();
    const query = (new URLSearchParams(location.search).get("q") || "").trim();
    if (query) {
      input.value = query;
      clearButton.hidden = false;
      search(query);
      return;
    }
    setMode("home");
    renderHistory();
    focusSearchBox();
    [0, 60, 200].forEach((delay) => setTimeout(focusSearchBox, delay));
  }

  boot();

  // 设置按钮走平台钩子
  platform.openSettings = () => openSettings({ loadSources, storage: chrome.storage.local });
}

/* ---- 启动 ---- */
const platform = { openSettings() {} };
const chromeStub = createChromeStub(platform);
const gmFetch = createFetch();

// 扩展用 chrome://favicon，宿主页拿不到；这里退化成首字母色块
globalThis.__SEARCHBOX_FAVICON__ = function faviconOf(pageUrl) {
  let letter = "?";
  try {
    const host = new URL(pageUrl).hostname.replace(/^www[.]/, "");
    letter = (host[0] || "?").toUpperCase();
  } catch (error) {
    letter = "?";
  }
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32">' +
    '<rect width="32" height="32" rx="7" fill="#e3e7ee"/>' +
    '<text x="16" y="22" font-size="16" font-family="sans-serif" text-anchor="middle" fill="#5f6368">' +
    letter +
    "</text></svg>";
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot, { once: true });
} else {
  boot();
}

function isHostPage() {
  return /host(-dev)?[.]html$/.test(location.pathname);
}

function boot() {
  // 嵌入式（浮层里的 iframe）：正常渲染，并把 Esc 转告父页
  if (isEmbedded()) {
    if (!mountShell(SB_CSS)) return;
    __app(chromeStub, gmFetch, platform);
    wireEmbedClose();
    return;
  }

  // 宿主页：正常渲染
  if (isHostPage()) {
    if (!mountShell(SB_CSS)) return;
    __app(chromeStub, gmFetch, platform);
    return;
  }

  // 其他页面：只装一个快捷键，按 Alt+K 弹出浮层
  installOverlay();
}
})();
