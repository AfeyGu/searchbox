/**
 * 内置搜索源（preset）。
 *
 * 用户改动存在 chrome.storage.local 的 `sources` 键下，按 id 覆盖这里同名条目；
 * 覆盖是整条替换，不做深合并——用户改了就由用户负责整份配置的完整性。
 *
 * 占位符只有三个：{{query}} {{key}} {{limit}}
 * 语义：含未解析占位符的 header / body 字段整条省略（用于 key 为空时自动走匿名）。
 */

export const PRESET_SOURCES = [
  {
    id: "anysearch",
    name: "AnySearch",
    origin: "https://api.anysearch.com",
    enabled: true,
    request: {
      url: "https://api.anysearch.com/v1/search",
      method: "POST",
      headers: { Authorization: "Bearer {{key}}" },
      body: { query: "{{query}}", max_results: "{{limit}}" }
    },
    response: {
      okPath: "code",
      okValue: 0,
      errorPath: "message",
      itemsPath: "data.results",
      fields: {
        title: ["title"],
        url: ["url"],
        snippet: ["snippet", "content"]
      },
      captureKeyPath: "data.auto_registered.api_key"
    },
    limits: { timeoutMs: 10000 }
  },
  {
    id: "tavily",
    name: "Tavily",
    origin: "https://api.tavily.com",
    enabled: false,
    request: {
      url: "https://api.tavily.com/search",
      method: "POST",
      body: {
        api_key: "{{key}}",
        query: "{{query}}",
        max_results: "{{limit}}"
      }
    },
    response: {
      itemsPath: "results",
      fields: {
        title: ["title"],
        url: ["url"],
        snippet: ["content"]
      }
    },
    limits: { timeoutMs: 10000 }
  }
];

/** 读取生效的源列表：preset 打底，storage 中的用户版本按 id 覆盖。 */
export async function loadSources() {
  const { sources = {} } = await chrome.storage.local.get("sources");
  return PRESET_SOURCES.map((preset) => {
    const override = sources[preset.id];
    return override ? { ...preset, ...override } : { ...preset };
  });
}

/** 读取某个源的 key。 */
export async function loadKey(sourceId) {
  const { keys = {} } = await chrome.storage.local.get("keys");
  return keys[sourceId] || "";
}
