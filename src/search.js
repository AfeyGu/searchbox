/**
 * 搜索页：首页与结果页是同一个页面。
 * 无 q 参数 = 首页（搜索框居中）；有 q 参数 = 结果页。
 */

import { loadSources, loadKey } from "./core/preset.js";
import { runSource } from "./core/request.js";
import { interleave } from "./core/merge.js";

const form = document.getElementById("form");
const input = document.getElementById("q");
const clearButton = document.getElementById("clear");
const hint = document.getElementById("hint");
const statusEl = document.getElementById("status");
const resultsEl = document.getElementById("results");

const RESULT_LIMIT = 40;
const PER_SOURCE_LIMIT = 10;

let hits = [];
let selected = -1;
let currentRun = 0;

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

function renderResults(elapsedMs) {
  resultsEl.replaceChildren();
  if (!hits.length) {
    setStatus("没有结果，换个说法试试", "error");
    return;
  }

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
    title.textContent = hit.title || hostOf(hit.url);

    const meta = document.createElement("div");
    meta.className = "hit-meta";
    const site = document.createElement("span");
    site.className = "hit-host";
    site.textContent = hostOf(hit.url);
    meta.append(site);
    if (hit.sourceName) {
      const badge = document.createElement("span");
      badge.className = "hit-source";
      badge.textContent = hit.sourceName;
      meta.append(badge);
    }

    link.append(title, meta);

    const snippet = document.createElement("p");
    snippet.className = "hit-snippet";
    snippet.textContent = hit.snippet;

    li.append(icon, link, snippet);
    resultsEl.append(li);
  });

  setStatus(`${hits.length} 条结果 · ${elapsedMs} ms`, "info");
}

/* ---------- 搜索 ---------- */

async function search(query) {
  const runId = ++currentRun;
  selected = -1;
  hits = [];
  setMode("results");
  renderSkeleton();
  setStatus(`正在搜索「${query}」…`, "busy");

  const sources = (await loadSources()).filter((source) => source.enabled);
  if (!sources.length) {
    resultsEl.replaceChildren();
    setStatus("没有启用的搜索源，去设置页开启一个", "error");
    return;
  }

  const started = performance.now();
  const settled = await Promise.all(
    sources.map(async (source) => {
      const key = await loadKey(source.id);
      const result = await runSource(source, query, { limit: PER_SOURCE_LIMIT, key });
      if (result.ok && result.newKey) await rememberKey(source.id, result.newKey);
      return { source, ...result };
    })
  );

  if (runId !== currentRun) return; // 已有更新的搜索，丢弃这次结果

  const groups = settled
    .filter((item) => item.ok)
    .map((item) => ({ id: item.source.id, name: item.source.name, items: item.items }));
  const failures = settled.filter((item) => !item.ok);

  hits = interleave(groups, RESULT_LIMIT);
  clearExtraStatus();

  if (!groups.length) {
    resultsEl.replaceChildren();
    setStatus(failures.map((f) => `${f.source.name}：${f.error}`).join("\n") || "全部搜索源都失败了", "error");
    renderSourceStatus(settled);
    return;
  }

  renderResults(Math.round(performance.now() - started));
  renderSourceStatus(settled);
}

/** 每个源各给一条状态：成功报条数，失败报原因。合并结果对不对，一眼能看出来。 */
function renderSourceStatus(settled) {
  const box = document.createElement("div");
  box.className = "status extra source-status";
  for (const item of settled) {
    const chip = document.createElement("span");
    chip.className = `chip ${item.ok ? "ok" : "bad"}`;
    chip.textContent = item.ok
      ? `${item.source.name} ${item.items.length} 条`
      : `${item.source.name}：${item.error}`;
    box.append(chip);
  }
  statusEl.after(box);
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

function boot() {
  const query = (new URLSearchParams(location.search).get("q") || "").trim();
  if (query) {
    input.value = query;
    clearButton.hidden = false;
    search(query);
    return;
  }
  setMode("home");
  input.focus();
}

boot();
