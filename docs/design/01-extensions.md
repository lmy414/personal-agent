# Personal Agent — 设计文档：扩展设计

> 每个扩展是一个 TypeScript 文件，通过 `export default function(pi: ExtensionAPI)` 注册。

## pa-sqlite（~158 行）

| 钩子 | 用途 |
|------|------|
| `session_start` | 创建/更新 SQLite 会话记录 |
| `message_end` | 持久化每条消息（role, content, tokens, model） |
| `session_shutdown` | 关闭数据库连接 |

## pa-usage（~135 行）

| 钩子 | 用途 |
|------|------|
| `message_end` | 从 assistant 消息提取 usage.input / usage.output |
| 命令 | `/usage [today|month|14d]` `/cost` |

## pa-files（~176 行）

| 注册 | 类型 |
|------|------|
| `list_directory` | LLM 工具 — TypeBox schema 校验参数 |
| `preview_file` | LLM 工具 — 路径安全校验 + 文件预览 |
| `/files` `/preview` `/workspace` | 用户命令 |

## pa-budget（~104 行）

| 钩子 | 用途 |
|------|------|
| `turn_start` | 检查当日/当月用量，>=80% 黄色警告，>=100% 红色错误 |
| 命令 | `/budget` `/budget set <月> <日>` |

## pa-mio（~263 行）

澪号 Harness 扩展。核心机制：9-Slot Prompt 注入 + 5 计数器反馈校验 + JSON 记忆系统。

详见 `02-mio-harness.md`。

## pa-observe（~316 行）— v0.4.0 新增，v0.5.2 修复

| 钩子 | 用途 |
|------|------|
| `session_start` | 捕获 `sessionFile` / `sessionId`，写入 trace 用于跨会话过滤 |
| `before_agent_start` | 记录组装后的 systemPrompt |
| `context` | 记录 LLM 调用前的消息数组 |
| `before_provider_request` | 捕获完整 HTTP 请求体（JSON） |
| `after_provider_response` | 捕获 HTTP 状态码 |
| `tool_execution_start` | 记录工具名、开始时间 |
| `tool_execution_end` | 记录返回值、计算耗时 |
| `message_end` | 提取 assistant 回复，跑 5 项计数器 |
| `agent_end` | 组装 trace JSON，写入文件 |

详见 `03-observe.md`。

---

**相关文档**：
- 扩展开发手册 → `../handbook/00-principles.md`
- 架构债务（扩展耦合问题） → `04-debt-extensions.md`
