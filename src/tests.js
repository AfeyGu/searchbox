/**
 * 纯函数断言页：打开就跑，全绿表示核心逻辑没被改坏。
 * 只测无副作用的函数（不碰 chrome.* / 不碰 DOM），所以能在这里安心执行。
 */

import { fillString, fillValue } from "./core/request.js";
import { getPath, pickFirst, isOk, extractItems } from "./core/extract.js";
import { normalizeUrl, interleave } from "./core/merge.js";

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function eq(actual, expected, message) {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) throw new Error(`${message || "不相等"}\n  实际: ${a}\n  期望: ${b}`);
}

/* ---------- 占位符替换 ---------- */

test("fillString：替换单个占位符", () => {
  eq(fillString("Bearer {{key}}", { key: "abc" }), { ok: true, value: "Bearer abc" });
});

test("fillString：缺值的占位符让 ok=false", () => {
  const result = fillString("Bearer {{key}}", { key: "" });
  assert(result.ok === false, "key 为空时应判定为未解析");
});

test("fillValue：整串占位符保留原始类型（数字）", () => {
  // 回归：max_results 若变成字符串，anysearch 会返回 400
  eq(fillValue("{{limit}}", { limit: 10 }), { ok: true, value: 10 });
});

test("fillValue：整串占位符缺值时整条丢弃", () => {
  const result = fillValue({ api_key: "{{key}}", query: "{{query}}" }, { query: "hi" });
  eq(result.value, { query: "hi" });
});

test("fillValue：局部占位符仍返回字符串", () => {
  eq(fillValue("Bearer {{key}}", { key: "k" }), { ok: true, value: "Bearer k" });
});

test("fillValue：非字符串原样保留（数字/布尔）", () => {
  eq(fillValue({ a: 1, b: true }, {}), { ok: true, value: { a: 1, b: true } });
});

test("fillValue：嵌套对象里的失败字段被单独丢弃", () => {
  const result = fillValue({ outer: { keep: "{{query}}", drop: "{{key}}" } }, { query: "q" });
  eq(result.value, { outer: { keep: "q" } });
});

/* ---------- 响应解析 ---------- */

test("getPath：按点号取深层字段", () => {
  eq(getPath({ data: { results: [1, 2] } }, "data.results"), [1, 2]);
});

test("getPath：路径不存在返回 undefined", () => {
  eq(getPath({ a: 1 }, "a.b.c"), undefined);
});

test("pickFirst：按顺序兜底", () => {
  eq(pickFirst({ snippet: "S", content: "C" }, ["snippet", "content"]), "S");
  eq(pickFirst({ content: "C" }, ["snippet", "content"]), "C");
  eq(pickFirst({ snippet: "" }, ["snippet", "content"]), undefined);
});

test("isOk：无 okPath 时永远成功", () => {
  assert(isOk({ anything: 1 }, {}) === true, "没配 okPath 应视为成功");
});

test("isOk：okPath 与 okValue 比对", () => {
  assert(isOk({ code: 0 }, { okPath: "code", okValue: 0 }) === true, "code=0 应成功");
  assert(isOk({ code: -1 }, { okPath: "code", okValue: 0 }) === false, "code=-1 应失败");
});

test("isOk：okValue 缺省按 0 处理", () => {
  assert(isOk({ code: 0 }, { okPath: "code" }) === true, "缺省应为 0");
});

test("extractItems：正常映射标题/链接/摘要", () => {
  const raw = { results: [{ title: "T", url: "https://a.com", content: "C" }] };
  const items = extractItems(raw, { itemsPath: "results", fields: { title: ["title"], url: ["url"], snippet: ["content"] } });
  eq(items, [{ title: "T", url: "https://a.com", snippet: "C" }]);
});

test("extractItems：路径不是数组时返回 null（配置错误信号）", () => {
  eq(extractItems({ results: "nope" }, { itemsPath: "results" }), null);
});

test("extractItems：丢掉没有链接的条目", () => {
  const raw = { hits: [{ title: "无链接" }, { title: "有", url: "https://b.com" }] };
  const items = extractItems(raw, { itemsPath: "hits", fields: { title: ["title"], url: ["url"] } });
  eq(items.length, 1);
  eq(items[0].url, "https://b.com");
});

/* ---------- 合并 ---------- */

test("normalizeUrl：去锚点、去 utm 参数", () => {
  eq(normalizeUrl("https://A.com/p/?utm_source=x&id=1#frag"), "https://a.com/p/?id=1");
});

test("normalizeUrl：无查询串时去掉结尾斜杠", () => {
  eq(normalizeUrl("https://a.com/p/"), "https://a.com/p");
});

test("normalizeUrl：非法输入原样返回", () => {
  eq(normalizeUrl("not a url"), "not a url");
});

test("interleave：按名次交错，而不是整段拼接", () => {
  const groups = [
    { id: "a", name: "A", items: [{ url: "https://a/1" }, { url: "https://a/2" }] },
    { id: "b", name: "B", items: [{ url: "https://b/1" }, { url: "https://b/2" }] }
  ];
  eq(interleave(groups).map((hit) => hit.url), ["https://a/1", "https://b/1", "https://a/2", "https://b/2"]);
});

test("interleave：跨源重复链接只保留先出现的那条", () => {
  const groups = [
    { id: "a", name: "A", items: [{ url: "https://same.com/x" }] },
    { id: "b", name: "B", items: [{ url: "https://same.com/x/?utm_medium=y" }, { url: "https://b/other" }] }
  ];
  const merged = interleave(groups);
  eq(merged.length, 2);
  eq(merged[0].sourceId, "a");
});

test("interleave：结果上限生效", () => {
  const items = Array.from({ length: 50 }, (_, i) => ({ url: `https://a/${i}` }));
  eq(interleave([{ id: "a", name: "A", items }], 40).length, 40);
});

test("interleave：空输入返回空数组", () => {
  eq(interleave([]), []);
});

/* ---------- 执行 ---------- */

const summary = document.getElementById("summary");
const list = document.getElementById("list");
let passed = 0;

for (const { name, fn } of tests) {
  const li = document.createElement("li");
  const mark = document.createElement("span");
  mark.className = "mark";
  const body = document.createElement("div");
  body.textContent = name;
  li.append(mark, body);

  try {
    fn();
    passed += 1;
    li.classList.add("pass");
    mark.textContent = "✓";
  } catch (error) {
    li.classList.add("fail");
    mark.textContent = "✗";
    if (error?.message !== name) {
      const detail = document.createElement("div");
      detail.className = "detail";
      detail.textContent = error?.message || String(error);
      body.append(detail);
    }
  }
  list.append(li);
}

const allPassed = passed === tests.length;
summary.className = allPassed ? "ok" : "bad";
summary.textContent = allPassed
  ? `全部通过：${passed} / ${tests.length}`
  : `有失败：${passed} / ${tests.length} 通过`;
