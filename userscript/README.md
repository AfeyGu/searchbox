# Searchbox 油猴版（Tampermonkey）

与 `../searchbox/`（浏览器扩展版）并列的第二个运行时。核心逻辑相同，外壳不同。

- 可行性调研：[`../.sisyph/notes/2026-10-21-userscript-feasibility.md`](../.sisyph/notes/2026-10-21-userscript-feasibility.md)
- 为什么需要它：`AnySearch` 等接口没有 CORS 放行头（实测），普通网页调不通；油猴的 `GM_xmlhttpRequest` 是唯一不装扩展也能绕开跨域的办法

## 与扩展版的差异

| 能力 | 扩展版 | 油猴版 |
|---|---|---|
| 新标签页接管 | ✅ | ❌ 无此 API（改用宿主页/浮层入口） |
| 原生划词右键 | ✅ | ⚠️ 只能做"选中后浮出按钮" |
| 站点图标 | ✅ `chrome://favicon` | ❌ 改首字母色块 |
| 流式 AI 总结 | ✅ fetch + reader | ⚠️ `GM_xmlhttpRequest` 的 `responseType: 'stream'`（TM 5.6.6242+） |
| 存储 | `chrome.storage.local` | `GM_setValue` / `GM_getValue` |
| 跨域请求 | host 权限 | `GM_xmlhttpRequest` + `@connect` |

## 复用策略

`../searchbox/src/core/` 里的纯逻辑（占位符替换、响应解析、合并去重、历史、AI messages 构造、SSE 解析）**原样复用**，通过打包拼进单文件。
需要重写的只有两层适配：存储（`chrome.storage` → `GM_*`）与请求（`fetch` → `GM_xmlhttpRequest`）。

## 目录规划

```
userscript/
├── README.md          ← 本文件
├── src/
│   ├── main.js        ← 入口：宿主页/浮层初始化
│   ├── store.js       ← chrome.storage → GM_* 适配
│   ├── net.js         ← fetch → GM_xmlhttpRequest 适配（含流式）
│   └── ui.js          ← 搜索页 UI（从扩展版改造）
├── build.py           ← 把 core + src 拼成单文件 .user.js
└── dist/
    └── searchbox.user.js
```

> 注意：单文件是油猴的硬约束，所以必须有构建步骤。`core/` 保持单一来源，不在两边各维护一份。

## 待定

- **形态**：宿主页（`@match` 一个固定地址，打开即搜索页）还是任意页面浮层（`Ctrl+K` 唤起）
- **图标**：首字母色块 or 第三方 favicon 服务
- **最低 Tampermonkey 版本**：接受 5.6.6242+ 才有流式
