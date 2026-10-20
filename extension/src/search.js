/**
 * 搜索页：首页与结果页是同一个页面。
 * 无 q 参数 = 首页（搜索框居中）；有 q 参数 = 结果页。
 */

import { loadSources, loadKey } from "./core/preset.js";
import { runSource } from "./core/request.js";
import { interleave } from "./core/merge.js";
import { readHistory, recordHistory, clearHistory } from "./core/history.js";
import { loadPerSourceLimit } from "./core/settings.js";

const form = document.getElementById("form");
const input = document.getElementById("q");
const clearButton = document.getElementById("clear");
const hint = document.getElementById("hint");
const statusEl = document.getElementById("status");
const resultsEl = document.getElementById("results");
const historyBox = document.getElementById("history");
const historyList = document.getElementById("history-list");
const historyClear = document.getElementById("history-clear");

const RESULT_LIMIT = 40;   // 合并去重后的总上限（不对外配置）

let allHits = [];         // 合并去重后的全集
let hits = [];            // 当前可见（受来源过滤影响）
let selected = -1;
let currentRun = 0;
let filterSource = null;  // null = 全部来源
let lastRun = { ms: 0, rawTotal: 0, settled: [] };

/* ---------- 小工具 ---------- */

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function faviconUrl(pageUrl) {
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

  const sources = (await loadSources()).filter((source) => source.enabled);
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
