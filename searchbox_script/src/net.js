/**
 * 请求适配层：用 GM_xmlhttpRequest 提供 fetch 的最小等价物。
 *
 * 负责两件事：
 *   1. 绕过跨域（绝大多数搜索/模型接口没有 CORS 放行头）
 *   2. 流式：把 GM 的 onprogress 增量转成 response.body.getReader()
 *
 * 只要满足被复用代码用到的那些成员：ok / status / url / headers.get / text / json / body.getReader
 */

/** 把 GM 的响应头字符串解析成 Map。 */
function parseHeaders(raw) {
  const map = new Map();
  for (const line of String(raw || "").split(/[\r\n]+/)) {
    const index = line.indexOf(":");
    if (index > 0) map.set(line.slice(0, index).trim().toLowerCase(), line.slice(index + 1).trim());
  }
  return map;
}

/** 队列式可读流：GM 推 chunk，消费方按需取。 */
export function createChunkReader() {
  const queue = [];
  let pending = null;
  let closed = false;

  return {
    push(chunk) {
      if (!chunk) return;
      if (pending) {
        const resolve = pending;
        pending = null;
        resolve({ value: chunk, done: false });
      } else {
        queue.push(chunk);
      }
    },
    close() {
      closed = true;
      if (pending) {
        const resolve = pending;
        pending = null;
        resolve({ value: undefined, done: true });
      }
    },
    read() {
      if (queue.length) return Promise.resolve({ value: queue.shift(), done: false });
      if (closed) return Promise.resolve({ value: undefined, done: true });
      return new Promise((resolve) => {
        pending = resolve;
      });
    }
  };
}

/** 让文本走一遍 TextEncoder，好让复用代码里的 TextDecoder 正常工作。 */
const encoder = new TextEncoder();

/**
 * fetch 的等价物。
 * wantsStream 通过请求体里的 "stream":true 判断——这是我们唯一会用到流式的地方。
 */
export function createFetch() {
  return function gmFetch(input, init = {}) {
    const url = String(input);
    const method = String(init.method || "GET").toUpperCase();
    const headers = init.headers || {};
    const body = init.body;
    const wantsStream = typeof body === "string" && body.indexOf('"stream":true') >= 0;

    return new Promise((resolve, reject) => {
      let text = "";
      let emitted = 0;
      let settled = false;
      const reader = wantsStream ? createChunkReader() : null;

      const emitDelta = () => {
        if (!reader || text.length <= emitted) return;
        reader.push(encoder.encode(text.slice(emitted)));
        emitted = text.length;
      };

      const handle = GM_xmlhttpRequest({
        method,
        url,
        headers,
        data: body,
        responseType: wantsStream ? "stream" : undefined,
        onprogress(event) {
          if (typeof event.responseText === "string" && event.responseText.length > text.length) {
            text = event.responseText;
            emitDelta();
          }
        },
        onload(response) {
          if (settled) return;
          settled = true;
          if (typeof response.responseText === "string" && response.responseText.length >= text.length) {
            text = response.responseText;
          }
          if (reader) {
            emitDelta();
            reader.close();
          }
          const headerMap = parseHeaders(response.responseHeaders);
          // 端点不返回 content-type 时，用内容形态兜底判断是不是 SSE
          if (!headerMap.has("content-type") && text.indexOf("data:") === 0) {
            headerMap.set("content-type", "text/event-stream");
          }
          resolve({
            ok: response.status >= 200 && response.status < 300,
            status: response.status,
            url: response.finalUrl || url,
            headers: { get: (name) => headerMap.get(String(name).toLowerCase()) ?? null },
            body: reader ? { getReader: () => reader } : null,
            text: async () => text,
            json: async () => JSON.parse(text)
          });
        },
        onerror() {
          if (settled) return;
          settled = true;
          if (reader) reader.close();
          reject(new TypeError("请求失败（网络不可达，或被拦截）"));
        },
        ontimeout() {
          if (settled) return;
          settled = true;
          if (reader) reader.close();
          reject(new Error("请求超时"));
        },
        onabort() {
          if (settled) return;
          settled = true;
          if (reader) reader.close();
          reject(Object.assign(new Error("已取消"), { name: "AbortError" }));
        }
      });

      if (init.signal) {
        if (init.signal.aborted) handle.abort();
        else init.signal.addEventListener("abort", () => handle.abort(), { once: true });
      }
    });
  };
}
