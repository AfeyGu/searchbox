/**
 * 仅供本地开发：把 GM_* 用 localStorage / fetch 模拟出来，
 * 好在没有 Tampermonkey 的环境里跑一遍构建产物。
 *
 * 注意：这里用 fetch，所以只能访问带 CORS 放行头的地址；
 * 真实油猴环境里 GM_xmlhttpRequest 不受此限制。
 */

(function () {
  window.GM_getValue = function (key, fallback) {
    const raw = localStorage.getItem("gm:" + key);
    return raw === null ? fallback : raw;
  };

  window.GM_setValue = function (key, value) {
    localStorage.setItem("gm:" + key, String(value));
  };

  window.GM_xmlhttpRequest = function (options) {
    const controller = new AbortController();
    let text = "";

    (async () => {
      try {
        const response = await fetch(options.url, {
          method: options.method || "GET",
          headers: options.headers || {},
          body: options.data,
          signal: controller.signal
        });
        const headerText = [...response.headers].map(([k, v]) => k + ": " + v).join("\r\n");

        if (options.responseType === "stream" && response.body) {
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            text += decoder.decode(value, { stream: true });
            if (options.onprogress) options.onprogress({ responseText: text });
          }
        } else {
          text = await response.text();
        }

        if (options.onload) {
          options.onload({
            status: response.status,
            responseText: text,
            responseHeaders: headerText,
            finalUrl: response.url
          });
        }
      } catch (error) {
        if (controller.signal.aborted) {
          if (options.onabort) options.onabort();
        } else if (options.onerror) {
          options.onerror(error);
        }
      }
    })();

    return { abort: () => controller.abort() };
  };
})();
