# Searchbox

把 JSON 搜索 API 变成浏览器里的搜索结果页。插件是解释器，搜索源是可配置数据。

## 安装

1. 打开 `edge://extensions`（或 `chrome://extensions`），开启「开发人员模式」
2. 「加载解压缩的扩展」→ 选择本目录
3. `Ctrl+T` 打开新标签页，应看到搜索框

## 使用

| 操作 | 说明 |
|---|---|
| 输入后回车 | 搜索；结果按来源名次交错合并，跨源重复链接只保留一条 |
| `↑` `↓` | 在结果间移动 |
| `Enter` / `Ctrl+Enter` | 当前标签打开 / 新标签打开 |
| `Esc` | 清空并回到首页 |
| 点来源标签 | 只看这一家的原始结果（不做跨源去重），再点一次回到「全部」 |
| 划词右键 | 「用 Searchbox 搜索」→ 新标签页直接出结果 |
| 右下角「设置」 | 配 key、编辑源、跑单源测试 |

## 加一个搜索源

设置页 → 编辑 JSON → 保存（会为该接口地址申请访问权限）。字段说明：

```jsonc
{
  "id": "my-source",              // 唯一标识，留空则按 name 生成
  "name": "显示名",
  "origin": "https://api.example.com",   // 用于申请权限
  "enabled": true,
  "request": {
    "url": "https://api.example.com/search",
    "method": "POST",
    "headers": { "Authorization": "Bearer {{key}}" },
    "body": { "query": "{{query}}", "limit": "{{limit}}" }
  },
  "response": {
    "okPath": "code", "okValue": 0,        // 可选：接口的成功标志
    "errorPath": "message",                // 可选：错误信息字段
    "itemsPath": "data.results",           // 结果数组的路径
    "fields": {
      "title": ["title"],
      "url": ["url"],
      "snippet": ["snippet", "content"]    // 依次兜底
    },
    "captureKeyPath": "data.api_key"       // 可选：响应里回传新 key 时自动保存
  },
  "limits": { "timeoutMs": 10000 }
}
```

规则：

- 占位符只有 `{{query}}`、`{{key}}`、`{{limit}}` 三个
- 某个值**整串**就是一个占位符时保留原始类型；缺值则整个字段省略（key 为空即不发送鉴权头，自动走匿名）
- 配置里不写逻辑：没有条件、循环、表达式。表达不了的源就是不支持

## 自检

改过 `src/core/` 里的解析或合并逻辑后，打开 `src/tests.html`（设置页底部有入口）跑一遍断言，应全绿。

## 结构

```
manifest.json        MV3 清单；扩展 ID 由 key 固定
src/search.*         首页与结果页（同一个页面）
src/options.*        设置页：源列表、配置编辑、Key、测试面板
src/bg.js            新标签页软接管 + 划词右键菜单（不发请求）
src/core/preset.js   内置源
src/core/request.js  占位符替换 + 请求执行 + 权限预检
src/core/extract.js  响应解析
src/core/merge.js    URL 归一化 + 去重 + 名次交错
src/core/history.js  最近搜索（一个查询词一个键）
src/tests.*          纯函数断言页
```

架构与决策记录见 `.sisyph/notes/2026-10-20-plan.md`。
