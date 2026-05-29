# Personal Agent — 设计文档：流水线透视（pa-observe）

> v0.4.0 新增，v0.5.2 Windows 路径兼容性修复

## 设计目标

将 Agent 内部黑盒操作可视化——用户能看到每轮对话中系统执行了什么、API 发了什么、工具调了什么、计数器有没有触发。

## 架构

```
pa-observe (Pi 扩展, ~230 行)
  ├── before_agent_start  → 捕获组装后的 systemPrompt
  ├── context             → 捕获消息列表
  ├── before_provider_request → 捕获 HTTP 请求体 (DeepSeek API)
  ├── after_provider_response → 捕获 HTTP 状态码
  ├── tool_execution_start/end → 记录工具名、参数、耗时
  ├── message_end         → 提取 assistant 回复，跑 5 项计数器
  └── agent_end           → 组装 trace JSON → 写入文件
                              ↓
              ~/.personal-agent/observe_last_trace.json
                              ↓
           wgnr-pi GET /api/observe_trace → 前端 fetch (3s 轮询)
                              ↓
                      renderTrace() → DOM 渲染
```

## 数据传递方案（v0.5.2）

选择文件 + HTTP 轮询而非 WebSocket 推送，原因：
- Pi 的 `api.sendMessage()` 自定义消息经过 RPC 序列化后，`details` 字段可能丢失或格式变化
- 文件写入 + HTTP 端点更可靠，前端控制拉取节奏
- wgnr-pi server.js 只需加一个 ~10 行的 Express 路由

## Session 匹配机制（v0.5.2）

- pa-observe 将 `sessionId`（ULID）写入 trace JSON，API 使用 `sessionId` 查询
- server 端 `cwdKey` 使用 `replace(/[/\:*?"<>|]/g, "-")` 兼容 Windows 路径
- server 端 `homedir()` 替代 `process.env.HOME`，跨平台可靠
- 前端 `groupByDate()` 添加 `isNaN` 防御，防止无效时间戳导致会话不可见

## 前端面板

- `position: fixed` 脱离文档流，不影响聊天区布局
- `transform: translateX` 实现滑入/滑出动画
- 面板宽度 420px，移动端 360px
- 每个步骤折叠显示标题行（图标 + 标题 + 徽章 + 箭头），展开显示描述 + 指标 + 详细内容
- 使用字符串拼接而非模板字面量，避免内联 HTML 中的转义问题

## 7 个追踪步骤

| # | 步骤 | 数据来源 |
|---|------|---------|
| 1 | System Prompt 组装 | `before_agent_start` |
| 2 | Context 消息列表 | `context` |
| 3 | API 请求体 | `before_provider_request` |
| 4 | API 响应 | `after_provider_response` |
| 5 | 工具调用 | `tool_execution_start/end` |
| 6 | 计数器检查 | `message_end` |
| 7 | 记忆提取 | `agent_end`（pa-mio 处理，pa-observe 仅报告状态） |

---

**相关文档**：
- 扩展设计概览 → `01-extensions.md`
- 已知问题 → `../observe-issues.md`
- 架构债务（扩展与 wgnr-pi 耦合） → `04-debt-extensions.md` / `05-debt-system.md`
