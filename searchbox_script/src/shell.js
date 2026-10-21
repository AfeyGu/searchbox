/**
 * 外壳：把搜索页的 DOM 与样式注入宿主页面。
 *
 * 宿主页只需要一个空的 <body>，其余全部由这里生成——
 * 这样标记结构与扩展版的 search.html 保持一致，search.js 可以直接复用。
 */

export const SHELL_HTML = `
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
export function mountShell(css) {
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
export const PANEL_CSS = `
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
