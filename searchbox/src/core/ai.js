/**
 * AI 总结：把当前结果压成上下文交给模型，流式取回文本。
 *
 * 纯逻辑（构造 messages、解析 SSE）都放在这里，tests.html 可以直接断言；
 * 网络部分只依赖 fetch，没有任何第三方库。
 */

export const AI_STORAGE = "ai";
export const DEFAULT_DETAIL = 10;
export const DEFAULT_PROMPT =
  "你是搜索助手。只依据下面给出的搜索结果作答，不要编造；信息不足就直说。用中文，200 字以内，引用来源时用 [1][2] 这样的编号。";

/** 从 URL 里取域名，取不到返回空串。 */
export function hostOf(url) {
  try {
    return new URL(url).host.replace(/^www[.]/, "");
  } catch {
    return "";
  }
}

/** 把「查询词 + 结果」压成 chat messages。纯函数。 */
export function buildMessages({ query, hits, detail = DEFAULT_DETAIL, prompt = DEFAULT_PROMPT }) {
  const picked = (hits || []).slice(0, Math.max(1, Number(detail) || DEFAULT_DETAIL));

  const blocks = picked.map((hit, index) => {
    const title = String(hit.title || "").trim() || hostOf(hit.url);
    const host = hostOf(hit.url);
    const snippet = String(hit.snippet || "").replace(/\s+/g, " ").trim().slice(0, 200);
    const head = `[${index + 1}] ${title}${host ? ` — ${host}` : ""}`;
    return snippet ? `${head}\n${snippet}` : head;
  });

  const user = `用户查询：${query}\n\n以下是搜索结果：\n${blocks.join("\n\n")}`;
  return [
    { role: "system", content: String(prompt || DEFAULT_PROMPT) },
    { role: "user", content: user }
  ];
}

/**
 * SSE 增量解析器：喂 chunk，逐条回调 delta 文本。
 * 只认 OpenAI 风格的 "data: {...}" 行，遇到 "[DONE]" 即结束。
 */
export function createSseParser(onDelta) {
  const LF = String.fromCharCode(10);
  let buffer = "";
  let finished = false;

  const handleLine = (line) => {
    const text = line.trim();
    if (!text || text.indexOf("data:") !== 0) return;
    const payload = text.slice(5).trim();
    if (payload === "[DONE]") {
      finished = true;
      return;
    }
    try {
      const json = JSON.parse(payload);
      const choice = (json.choices && json.choices[0]) || {};
      const delta = (choice.delta && choice.delta.content) || choice.text || "";
      if (delta) onDelta(delta);
    } catch {
      // 半行或非 JSON，忽略
    }
  };

  return {
    push(chunk) {
      buffer += chunk;
      let index;
      while ((index = buffer.indexOf(LF)) >= 0) {
        handleLine(buffer.slice(0, index));
        buffer = buffer.slice(index + 1);
      }
    },
    flush() {
      if (buffer) {
        handleLine(buffer);
        buffer = "";
      }
    },
    get finished() {
      return finished;
    }
  };
}

/** 读取 AI 配置；地址或模型缺失时返回 null（= 不启用）。 */
export async function loadAiConfig() {
  const data = await chrome.storage.local.get({ ai: {}, keys: {} });
  const ai = data.ai || {};
  const url = String(ai.url || "").trim();
  const model = String(ai.model || "").trim();
  if (!url || !model) return null;

  return {
    url,
    model,
    prompt: String(ai.prompt || "").trim() || DEFAULT_PROMPT,
    detail: Math.min(30, Math.max(1, Number(ai.detail) || DEFAULT_DETAIL)),
    key: String((data.keys || {}).ai || ""),
    name: String(ai.name || "").trim()
  };
}

/** AI 端点需要授权的 origin 列表。 */
export function aiOriginsOf(config) {
  try {
    return [new URL(config.url).origin];
  } catch {
    return [];
  }
}

/**
 * 跑一次总结。成功时通过 onDelta 增量吐出文本，返回耗时。
 * 断言：失败一定抛错，绝不影响调用方的搜索结果展示。
 */
export async function runSummary({ config, query, hits, signal, onDelta }) {
  const started = performance.now();
  const headers = { "Content-Type": "application/json" };
  if (config.key) headers.Authorization = `Bearer ${config.key}`;

  const response = await fetch(config.url, {
    method: "POST",
    headers,
    signal,
    body: JSON.stringify({
      model: config.model,
      messages: buildMessages({ query, hits, detail: config.detail, prompt: config.prompt }),
      stream: true,
      temperature: 0.3
    })
  });

  if (!response.ok) {
    const raw = await response.text().catch(() => "");
    throw new Error(`HTTP ${response.status}${raw ? ` · ${raw.slice(0, 120)}` : ""}`);
  }

  const type = response.headers.get("content-type") || "";
  if (response.body && type.indexOf("event-stream") >= 0) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const parser = createSseParser(onDelta);
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      parser.push(decoder.decode(value, { stream: true }));
      if (parser.finished) break;
    }
    parser.flush();
    return { ok: true, ms: Math.round(performance.now() - started) };
  }

  // 端点忽略了 stream 参数：退回一次性解析
  const json = await response.json();
  const choice = (json.choices && json.choices[0]) || {};
  const text = (choice.message && choice.message.content) || choice.text || "";
  if (!text) throw new Error("模型返回为空");
  onDelta(text);
  return { ok: true, ms: Math.round(performance.now() - started) };
}
