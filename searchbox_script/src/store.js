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
export function createStorageLocal() {
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
export function createChromeStub(platform) {
  return {
    storage: { local: createStorageLocal() },
    runtime: {
      // 扩展里是 chrome://favicon，这里交给平台钩子（默认返回空串 → 首字母色块）
      getURL: () => "",
      openOptionsPage: () => platform.openSettings()
    }
  };
}
