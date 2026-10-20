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
