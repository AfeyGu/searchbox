# Searchbox

把 JSON 搜索 API 变成浏览器里的搜索结果页。插件是解释器，搜索源是可配置数据。

## 安装

1. 打开 `edge://extensions`（或 `chrome://extensions`），开启「开发人员模式」
2. 「加载解压缩的扩展」→ 选择本仓库的 **`extension/`** 子目录
3. `Ctrl+T` 打开新标签页，应看到搜索框

## 使用

| 操作 | 说明 |
|---|---|
| 输入后回车 | 搜索；结果按来源名次交错合并，跨源重复链接只保留一条 |
| `↑` `↓` | 在结果间移动 |
| `Enter` / `Ctrl+Enter` | 当前标签打开 / 新标签打开 |
| `Esc` | 清空并回到首页 |

> `Ctrl+T` 打开新标签时，焦点会直接落在搜索框里（靠"扩展重建标签页"实现）。如果某次焦点仍在地址栏，按一下 `Esc` 即可把焦点交还给页面。
| 点来源标签 | 只看这一家的原始结果（不做跨源去重），再点一次回到「全部」 |
| 结果上的来源标签 | 一条链接被多个源同时收录时会并列显示（超过 3 个用「+N」折叠） |
| 划词右键 | 「用 Searchbox 搜索」→ 新标签页直接出结果 |
| 右下角「设置」 | 配 key、编辑源、调「每个来源取多少条」、跑单源测试 |

## 加一个搜索源

设置页 → 新增源 → 编辑 JSON → 保存（会为该接口地址申请访问权限）。内置源不可删除但可禁用/重置；自己添加的源可以随时删除。字段说明：

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

改过 `extension/src/core/` 里的解析或合并逻辑后，打开 `extension/src/tests.html`（设置页底部有入口）跑一遍断言，应全绿。

## 结果数量

- **每个来源取多少条**：设置页可调，范围 1–50，默认 10。通过配置里的 `{{limit}}` 注入；某个源若把 `{{limit}}` 换成固定数字，以它为准
- **合并后的总上限**：40 条，写死在代码里，不对外开放（它是产品形状，不是参数）
- 调大每源条数会让首屏更慢：源要返回更多数据，慢源尤其明显

## 数据与保留

- 搜索历史存在本机 `chrome.storage.local`：**30 天自动过期**、最多 50 条（两者取严），首页显示最近 8 条，可一键清空
- API Key 同样只存本机，不上传任何地方
- 过期与超限的清理发生在打开首页读取历史时
- 卸载扩展会一并清空上述数据

## 结构

```
extension/                  ← 这一层才是被浏览器加载的扩展目录
  manifest.json             MV3 清单；扩展 ID 由 key 固定
  src/search.*              首页与结果页（同一个页面）
  src/options.*             设置页：源列表、配置编辑、Key、测试面板
  src/bg.js                 新标签页软接管 + 划词右键菜单（不发请求）
  src/core/preset.js        内置源
  src/core/request.js       占位符替换 + 请求执行 + 权限预检
  src/core/extract.js       响应解析
  src/core/merge.js         URL 归一化 + 去重 + 名次交错
  src/core/history.js       最近搜索（一个查询词一个键）
  src/core/settings.js      每个来源取多少条
  src/tests.*               纯函数断言页
.sisyph/notes/              架构与决策记录
README.md
```

扩展目录与仓库其余内容分开：浏览器会扫描整个被加载的目录，把笔记、私钥、git 元数据放在里面既不必要，也会触发浏览器告警。

架构与决策记录见 `.sisyph/notes/2026-10-20-plan.md`。
