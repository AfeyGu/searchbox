/**
 * 设置页：源列表、配置编辑、Key、测试面板。
 *
 * 数据：
 *   chrome.storage.local.sources  { [id]: 完整的源配置 }  ← 只存用户改动
 *   chrome.storage.local.keys     { [id]: apiKey }
 *   chrome.storage.local.newtabTakeover  boolean
 *
 * 测试面板是这个架构的验收支点：左边原始响应、右边解析结果，
 * 对不上就是配置写错了，不用猜。
 */

import { PRESET_SOURCES } from "./core/preset.js";
import { runSource } from "./core/request.js";
import { loadPerSourceLimit, savePerSourceLimit, MAX_PER_SOURCE_LIMIT, MIN_PER_SOURCE_LIMIT } from "./core/settings.js";

const els = {
  newtab: document.getElementById("newtab-toggle"),
  limit: document.getElementById("limit-input"),
  limitHint: document.getElementById("limit-hint"),
  list: document.getElementById("source-list"),
  editorBlock: document.getElementById("editor-block"),
  editorTitle: document.getElementById("editor-title"),
  editor: document.getElementById("editor"),
  key: document.getElementById("key-input"),
  keyHint: document.getElementById("key-hint"),
  reveal: document.getElementById("btn-reveal"),
  save: document.getElementById("btn-save"),
  reset: document.getElementById("btn-reset"),
  newSource: document.getElementById("btn-new"),
  saveStatus: document.getElementById("save-status"),
  testBlock: document.getElementById("test-block"),
  testQuery: document.getElementById("test-query"),
  test: document.getElementById("btn-test"),
  testStatus: document.getElementById("test-status"),
  testRaw: document.getElementById("test-raw"),
  testParsed: document.getElementById("test-parsed")
};

const state = {
  overrides: {},
  keys: {},
  selectedId: null,
  isNew: false
};

/* ---------- 存取 ---------- */

async function load() {
  const data = await chrome.storage.local.get({ sources: {}, keys: {}, newtabTakeover: true });
  state.overrides = data.sources;
  state.keys = data.keys;
  els.newtab.checked = data.newtabTakeover !== false;
  els.limit.value = await loadPerSourceLimit();
}

async function persist() {
  await chrome.storage.local.set({ sources: state.overrides, keys: state.keys });
}

function presetOf(id) {
  return PRESET_SOURCES.find((source) => source.id === id) || null;
}

function effectiveOf(id) {
  return state.overrides[id] || presetOf(id);
}

function entries() {
  const presetIds = PRESET_SOURCES.map((source) => source.id);
  const customIds = Object.keys(state.overrides).filter((id) => !presetIds.includes(id));
  return [...presetIds, ...customIds].map((id) => ({
    id,
    config: effectiveOf(id),
    isPreset: Boolean(presetOf(id)),
    modified: Boolean(state.overrides[id])
  }));
}

/* ---------- 列表 ---------- */

function renderList() {
  els.list.replaceChildren();
  for (const entry of entries()) {
    const li = document.createElement("li");
    li.className = "source" + (entry.id === state.selectedId ? " active" : "");
    li.dataset.id = entry.id;

    const name = document.createElement("div");
    name.className = "source-name";
    const label = document.createElement("span");
    label.textContent = entry.config?.name || entry.id;
    const idTag = document.createElement("span");
    idTag.className = "source-id";
    idTag.textContent = entry.id;
    name.append(label, idTag);
    if (entry.isPreset) {
      const badge = document.createElement("span");
      badge.className = "badge";
      badge.textContent = "内置";
      name.append(badge);
    }
    if (entry.modified) {
      const badge = document.createElement("span");
      badge.className = "badge modified";
      badge.textContent = "已修改";
      name.append(badge);
    }

    const toggleLabel = document.createElement("label");
    toggleLabel.className = "source-toggle";
    const toggle = document.createElement("input");
    toggle.type = "checkbox";
    toggle.checked = entry.config?.enabled !== false;
    toggle.addEventListener("click", (event) => event.stopPropagation());
    toggle.addEventListener("change", async () => {
      const config = structuredClone(effectiveOf(entry.id));
      config.enabled = toggle.checked;
      state.overrides[entry.id] = config;
      await persist();
      renderList();
    });
    toggleLabel.append(toggle, document.createTextNode("启用"));

    const edit = document.createElement("button");
    edit.className = "btn ghost";
    edit.type = "button";
    edit.textContent = "编辑";
    edit.addEventListener("click", (event) => {
      event.stopPropagation();
      select(entry.id);
    });

    li.append(name, toggleLabel, edit);
    li.addEventListener("click", () => select(entry.id));
    els.list.append(li);
  }
}

/* ---------- 编辑 ---------- */

function select(id) {
  state.selectedId = id;
  state.isNew = false;
  const config = effectiveOf(id);
  els.editorTitle.textContent = `编辑：${config?.name || id}`;
  els.editor.value = JSON.stringify(config, null, 2);
  els.key.value = state.keys[id] || "";
  els.key.type = "password";
  els.reveal.textContent = "显示";
  els.keyHint.textContent = id === "anysearch" ? "留空则使用匿名访问（有限流）" : "";
  els.reset.hidden = !presetOf(id) || !state.overrides[id];
  els.editorBlock.hidden = false;
  els.testBlock.hidden = false;
  els.testStatus.hidden = true;
  els.testRaw.textContent = "（还没跑）";
  els.testParsed.replaceChildren();
  showSaveStatus("");
  renderList();
}

function selectNew() {
  state.selectedId = null;
  state.isNew = true;
  els.editorTitle.textContent = "新增源";
  els.editor.value = JSON.stringify(
    {
      id: "",
      name: "新搜索源",
      origin: "https://api.example.com",
      enabled: true,
      request: {
        url: "https://api.example.com/search",
        method: "POST",
        headers: { Authorization: "Bearer {{key}}" },
        body: { query: "{{query}}", limit: "{{limit}}" }
      },
      response: {
        itemsPath: "results",
        fields: { title: ["title"], url: ["url"], snippet: ["snippet"] }
      },
      limits: { timeoutMs: 10000 }
    },
    null,
    2
  );
  els.key.value = "";
  els.reset.hidden = true;
  els.editorBlock.hidden = false;
  els.testBlock.hidden = false;
  showSaveStatus("填好后点保存；保存时会为它申请接口地址的访问权限", "warn");
}

/* ---------- 校验 ---------- */

function originOf(config) {
  const raw = config?.origin || config?.request?.url || "";
  try {
    return new URL(raw).origin;
  } catch {
    return "";
  }
}

function validate(config) {
  const problems = [];
  if (!config || typeof config !== "object") return ["配置必须是一个 JSON 对象"];
  if (!config.name) problems.push("缺少 name");
  if (!config.request?.url) problems.push("缺少 request.url");
  else if (!/^https?:/i.test(config.request.url)) problems.push("request.url 必须是 http(s) 地址");
  if (!config.response?.itemsPath) problems.push("缺少 response.itemsPath");
  const fields = config.response?.fields || {};
  if (!Array.isArray(fields.url) || !fields.url.length) problems.push("response.fields.url 需要一个取值路径");
  if (fields.title && !Array.isArray(fields.title)) problems.push("response.fields.title 必须是数组");
  if (fields.snippet && !Array.isArray(fields.snippet)) problems.push("response.fields.snippet 必须是数组");
  return problems;
}

function showSaveStatus(text, kind = "ok") {
  els.saveStatus.textContent = text;
  els.saveStatus.className = `status ${kind}`;
  els.saveStatus.hidden = !text;
}

/* ---------- 保存 ---------- */

async function save() {
  try {
    await saveInner();
  } catch (error) {
    showSaveStatus(`保存失败：${error?.message || error}`, "error");
  }
}

async function saveInner() {
  let config;
  try {
    config = JSON.parse(els.editor.value);
  } catch (error) {
    showSaveStatus(`JSON 语法错误：${error.message}`, "error");
    return;
  }

  const problems = validate(config);
  if (problems.length) {
    showSaveStatus(problems.join("；"), "error");
    return;
  }

  if (!config.id) {
    config.id = (config.name || "source").toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-|-$/g, "") || `source-${Date.now()}`;
  }

  // 必须在用户手势内同步发起，所以放在任何 await 之前
  const origin = originOf(config);
  const request = origin
    ? chrome.permissions.request({ origins: [`${origin}/*`] }).catch(() => false)
    : Promise.resolve(true);
  const granted = await request;

  state.overrides[config.id] = config;
  state.keys[config.id] = els.key.value.trim();
  await persist();

  state.selectedId = config.id;
  state.isNew = false;
  els.editorTitle.textContent = `编辑：${config.name}`;
  els.reset.hidden = !presetOf(config.id) || !state.overrides[config.id];
  renderList();

  if (!granted) {
    showSaveStatus(`已保存，但没有获得 ${origin} 的访问权限，请求会被拦截`, "warn");
  } else {
    showSaveStatus(`已保存：${config.name}`, "ok");
  }
}

async function resetToPreset() {
  const id = state.selectedId;
  if (!id || !presetOf(id)) return;
  delete state.overrides[id];
  await persist();
  select(id);
  showSaveStatus("已恢复内置配置", "ok");
}

/* ---------- 测试 ---------- */

function setTestStatus(text, kind) {
  els.testStatus.textContent = text;
  els.testStatus.className = `status ${kind}`;
  els.testStatus.hidden = !text;
}

function renderParsed(items) {
  els.testParsed.replaceChildren();
  items.slice(0, 5).forEach((item) => {
    const li = document.createElement("li");
    const title = document.createElement("div");
    title.className = "t";
    title.textContent = item.title || "（无标题）";
    const url = document.createElement("div");
    url.className = "u";
    url.textContent = item.url;
    const snippet = document.createElement("div");
    snippet.className = "s";
    snippet.textContent = item.snippet;
    li.append(title, url, snippet);
    els.testParsed.append(li);
  });
  if (items.length > 5) {
    const more = document.createElement("li");
    more.textContent = `…还有 ${items.length - 5} 条`;
    els.testParsed.append(more);
  }
}

async function runTest() {
  let config;
  try {
    config = JSON.parse(els.editor.value);
  } catch (error) {
    setTestStatus(`JSON 语法错误：${error.message}`, "error");
    return;
  }

  const query = els.testQuery.value.trim() || "electron";
  setTestStatus("正在请求…", "warn");
  els.testRaw.textContent = "";
  els.testParsed.replaceChildren();

  const result = await runSource(config, query, { limit: 5, key: els.key.value.trim() });

  if (result.raw !== undefined) {
    els.testRaw.textContent = JSON.stringify(result.raw, null, 2).slice(0, 30000);
  } else {
    els.testRaw.textContent = "（没有拿到可解析的响应体）";
  }

  if (!result.ok) {
    setTestStatus(`失败：${result.error}`, "error");
    return;
  }
  setTestStatus(`成功：解析到 ${result.items.length} 条 · ${result.ms} ms`, "ok");
  renderParsed(result.items);
}

/* ---------- 事件绑定 ---------- */

els.limit.addEventListener("change", async () => {
  const saved = await savePerSourceLimit(els.limit.value);
  els.limit.value = saved;
  els.limitHint.textContent = `已保存：每个来源 ${saved} 条（范围 ${MIN_PER_SOURCE_LIMIT}–${MAX_PER_SOURCE_LIMIT}）`;
  setTimeout(() => { els.limitHint.textContent = ""; }, 2500);
});

els.newtab.addEventListener("change", async () => {
  await chrome.storage.local.set({ newtabTakeover: els.newtab.checked });
});

els.reveal.addEventListener("click", () => {
  const hidden = els.key.type === "password";
  els.key.type = hidden ? "text" : "password";
  els.reveal.textContent = hidden ? "隐藏" : "显示";
});

els.save.addEventListener("click", save);
els.reset.addEventListener("click", resetToPreset);
els.test.addEventListener("click", runTest);
els.newSource.addEventListener("click", selectNew);
els.testQuery.addEventListener("keydown", (event) => {
  if (event.key === "Enter") runTest();
});

/* ---------- 启动 ---------- */

(async function start() {
  await load();
  renderList();
  const firstId = PRESET_SOURCES[0]?.id;
  if (firstId) select(firstId);
})();
