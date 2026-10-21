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
export async function openSettings(ctx) {
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
