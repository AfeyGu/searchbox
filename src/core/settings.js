/**
 * 运行期设置。目前只有一项：每个来源取多少条。
 *
 * 注意「最多显示多少条」是另一个数（RESULT_LIMIT，合并后的总上限），
 * 它是产品形状的一部分，不对外开放。
 */

export const DEFAULT_PER_SOURCE_LIMIT = 10;
export const MIN_PER_SOURCE_LIMIT = 1;
export const MAX_PER_SOURCE_LIMIT = 50;

/** 把用户输入收敛到合法区间；非数字时回退默认值。纯函数，便于断言。 */
export function clampLimit(value, fallback = DEFAULT_PER_SOURCE_LIMIT) {
  const number = Number(value);
  if (!Number.isFinite(number) || value === "" || value === null) return fallback;
  return Math.min(MAX_PER_SOURCE_LIMIT, Math.max(MIN_PER_SOURCE_LIMIT, Math.round(number)));
}

export async function loadPerSourceLimit() {
  const { perSourceLimit } = await chrome.storage.local.get("perSourceLimit");
  return clampLimit(perSourceLimit);
}

export async function savePerSourceLimit(value) {
  const limit = clampLimit(value);
  await chrome.storage.local.set({ perSourceLimit: limit });
  return limit;
}
