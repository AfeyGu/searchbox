/**
 * 响应解析：把任意 JSON 响应按配置映射成统一的结果条目。
 * 纯函数，无副作用，可在 tests.html 里直接断言。
 */

/** 按 "a.b.c" 取嵌套字段，取不到返回 undefined。 */
export function getPath(obj, path) {
  if (!obj || !path) return undefined;
  return String(path)
    .split(".")
    .reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
}

/** 按顺序取第一个非空值，作为字段兜底链。 */
export function pickFirst(item, paths) {
  for (const path of paths || []) {
    const value = getPath(item, path);
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
}

/** 成功判定：配了 okPath 才检查，否则有响应即视为成功。 */
export function isOk(raw, response) {
  if (!response || !response.okPath) return true;
  const expected = response.okValue === undefined ? 0 : response.okValue;
  return getPath(raw, response.okPath) === expected;
}

/**
 * 取出结果数组。
 * 返回 null 表示配置与实际响应不匹配（调用方据此报“配置错误”而不是“无结果”）。
 */
export function extractItems(raw, response) {
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
export function absolutize(url, baseUrl) {
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
export function extractHtmlItems(doc, response, baseUrl = "") {
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
