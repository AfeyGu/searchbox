/**
 * 请求构造与执行：把一份源配置 + 查询词，变成一次真实的 HTTP 调用。
 *
 * 占位符语义：
 *   {{query}} 查询词 | {{key}} 秘钥 | {{limit}} 条数
 *   字符串里含未解析占位符（值缺失或为空）时，该字段整条省略：
 *     - header 省略 → 例如 key 为空时不发 Authorization，自动走匿名
 *     - body 顶层字段省略 → 例如 Tavily 没填 key 时请求里的 api_key 不出现
 */

import { getPath, isOk, extractItems } from "./extract.js";

const PLACEHOLDER = /\{\{\s*(\w+)\s*\}\}/g;
const WHOLE_PLACEHOLDER = /^\{\{\s*(\w+)\s*\}\}$/;

/** 填充单个字符串；有未解析的占位符则 ok=false。 */
export function fillString(text, vars) {
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
export function fillValue(value, vars) {
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
 * 执行一个源。
 * 返回 { ok, items?, error?, ms, newKey?, raw? }
 */
export async function runSource(source, query, options = {}) {
  const limit = options.limit ?? 10;
  const key = options.key ?? "";
  const vars = { query, key, limit };

  const request = source.request || {};
  const url = fillString(request.url || "", vars);
  if (!url.ok || !url.value) return { ok: false, error: "请求地址含未填充的占位符" };

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
    let raw;
    try {
      raw = JSON.parse(text);
    } catch {
      return { ok: false, error: `响应不是 JSON（HTTP ${response.status}）` };
    }
    const spec = source.response || {};
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
    return { ok: true, items, ms: Math.round(performance.now() - started), newKey, raw };
  } catch (error) {
    if (error?.name === "AbortError") return { ok: false, error: `超时 ${timeoutMs}ms` };
    return { ok: false, error: String(error?.message || error) };
  } finally {
    clearTimeout(timer);
  }
}
