# Personal Agent — 设计文档

> v0.4.0 · Pi 架构 + 澪号 Harness + 流水线透视 · 2026-05-27

## 1. 概述

Personal Agent 是一个基于 Pi 编码 Agent 框架的个人 AI 助手。核心理念：**魔改 Pi**——保持 Pi 的极简核心，用扩展系统承载所有差异化功能。

## 2. 技术选型

| 层 | 选型 | 理由 |
|---|---|---|
| Agent 框架 | **Pi (pi-mono)** | MIT 开源，双层 Agent 循环，28 事件扩展系统，300+ 模型支持 |
| LLM | **DeepSeek V3 + R1** | 成本极低（V3: $0.27/M input），OpenAI 兼容协议，中文优秀 |
| Web UI | **wgnr-pi** | 原生 JS 零框架，WebSocket 实时流式，极易魔改 |
| 持久化 | **SQLite (better-sqlite3)** | 结构化查询，跨会话分析，零配置 |
| 通信 | **Pi RPC + WebSocket** | Pi RPC 模式驱动 Agent，WebSocket 推送流式响应到浏览器 |
| 扩展 | **Pi Extension API** | 28 个生命周期事件，registerTool/registerCommand/registerProvider |

### 为什么不用 Electron

- 自研 GUI 维护成本高（~2300 行前端代码）
- 需要从零实现 Agent 循环、工具系统、模型抽象
- Pi 已经提供了所有这些基础设施

### 为什么选 wgnr-pi 而不是自研 Web UI

- 原生 JS 零框架，一个 HTML 文件 1392 行
- 已实现会话管理、模型选择、思考级别、斜杠命令、图片支持
- 修改成本极低（已全部汉化）

## 3. 架构

```
┌─────────────────────────────────────────┐
│            浏览器 (wgnr-pi)               │
│  侧边栏 │ 对话区 │ 输入框 │ 模型选择       │
│         WebSocket ↑↓                     │
├─────────────────────────────────────────┤
│          wgnr-pi (Express)               │
│  spawn Pi RPC ←→ WebSocket 消息转发       │
├─────────────────────────────────────────┤
│            Pi Agent Core                 │
│  agent-loop (双层 while)                  │
│  4 内置工具: read / write / edit / bash   │
├─────────────────────────────────────────┤
│          Personal Agent Extensions       │
│  pa-sqlite │ pa-usage │ pa-files │ pa-budget │ pa-mio │ pa-observe │
├─────────────────────────────────────────┤
│            Pi AI (pi-ai)                 │
│  OpenAI 兼容协议 → DeepSeek API           │
└─────────────────────────────────────────┘
```

## 4. 扩展设计

每个扩展是一个 TypeScript 文件，通过 `export default function(pi: ExtensionAPI)` 注册。

### pa-sqlite（~158 行）

| 钩子 | 用途 |
|------|------|
| `session_start` | 创建/更新 SQLite 会话记录 |
| `message_end` | 持久化每条消息（role, content, tokens, model） |
| `session_shutdown` | 关闭数据库连接 |

### pa-usage（~135 行）

| 钩子 | 用途 |
|------|------|
| `message_end` | 从 assistant 消息提取 usage.input / usage.output |
| 命令 | `/usage [today|month|14d]` `/cost` |

### pa-files（~176 行）

| 注册 | 类型 |
|------|------|
| `list_directory` | LLM 工具 — TypeBox schema 校验参数 |
| `preview_file` | LLM 工具 — 路径安全校验 + 文件预览 |
| `/files` `/preview` `/workspace` | 用户命令 |

### pa-budget（~104 行）

| 钩子 | 用途 |
|------|------|
| `turn_start` | 检查当日/当月用量，>=80% 黄色警告，>=100% 红色错误 |
| 命令 | `/budget` `/budget set <月> <日>` |

### pa-observe（~308 行）— v0.4.0 新增

| 钩子 | 用途 |
|------|------|
| `before_agent_start` | 记录组装后的 systemPrompt |
| `context` | 记录 LLM 调用前的消息数组 |
| `before_provider_request` | 捕获完整 HTTP 请求体（JSON） |
| `after_provider_response` | 捕获 HTTP 状态码 |
| `tool_execution_start` | 记录工具名、开始时间 |
| `tool_execution_end` | 记录返回值、计算耗时 |
| `message_end` | 提取 assistant 回复，跑 5 项计数器 |
| `agent_end` | 组装 trace JSON，写入文件 |

## 5. 数据流

```
用户输入 → WebSocket → wgnr-pi → Pi RPC stdin
                                    ↓
                              agent-loop
                              ↓           ↓
                           LLM 调用    工具执行
                              ↓           ↓
                           DeepSeek    read/edit/write/bash
                              ↓
Pi RPC stdout → wgnr-pi → WebSocket → 浏览器实时渲染
                              ↓
                         扩展事件钩子
                              ↓
                    pa-sqlite 写 SQLite
                    pa-usage 记录用量
                    pa-budget 检查预算
```

## 5. 澪号 Harness 设计

### pa-mio（~263 行）

澪号 Harness 扩展。核心机制：9-Slot Prompt 注入 + 5 计数器反馈校验 + JSON 记忆系统。

**Prompt 注入顺序**（9 个 Slot）：
| Slot | 内容 | 来源 | 性质 |
|------|------|------|------|
| 0 | 元指令（身份 > 工具） | `meta_instruction.txt` | 静态 |
| 1 | 身份层（soul + boundaries） | `soul.md` + `boundaries.md` | 静态 |
| 2 | 知识层 | `knowledge.md` | 静态 |
| 3 | 运行环境（Pi 原生提示词 + 工具定义） | Pi 注入 | 动态 |
| 4 | 记忆层 | `mio_memories.json` 检索 | 按需 |
| 5 | Chat History | Pi 管理 | 动态 |
| 6 | 语言锚（~50 tokens） | 硬编码 | 静态（最靠近输出） |
| 7 | 修正槽 | 计数器触发时注入 | 按需 |
| 8 | 用户消息 | 用户输入 | 动态 |

**5 个计数器**（字符级，不跑 LLM）：
| # | 检测项 | 规则 | 修正指令 |
|---|--------|------|---------|
| 1 | 叠甲 | ≥2 个叠甲词 | 不叠甲，有观点直接说 |
| 2 | emoji 溢出 | ≥3 个 emoji | 不使用 emoji |
| 3 | 感叹号溢出 | ≥2 个！ | 不用感叹号 |
| 4 | 话痨 | >200 字 | 短句 |
| 5 | 亲密溢出 | <10 轮出现 hhh/嗯嗯/摸摸 | 不够熟，克制 |

**记忆系统**：
- 存储：`~/.personal-agent/mio_memories.json`（JSON 数组，最多 500 条）
- 检索：CJK 2-4 字关键词 → 包含匹配 → 衰减权重 `importance × e^(-0.05×天数)` → top 5
- 提取：对话 >10 条后，独立 DeepSeek 调用提取 → 写入 JSON

### 关键设计决策

- Pi 原生 systemPrompt 退化为 Slot 3 内的 `[运行环境]` 标签，不与澪号身份竞争权重
- Slot 0-3 形成静态前缀（~2100 tokens），可被 Prompt Cache 命中
- Slot 6 语言锚在 Chat History 之后、用户消息之前——注意力权重最高
- 长工具返回（>500字）时自动在 history 前额外插入语言锚，对抗稀释

## 6. 流水线透视（pa-observe）

### 设计目标

将 Agent 内部黑盒操作可视化——用户能看到每轮对话中系统执行了什么、API 发了什么、工具调了什么、计数器有没有触发。

### 架构

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

### 数据传递方案

选择文件 + HTTP 轮询而非 WebSocket 推送，原因：
- Pi 的 `api.sendMessage()` 自定义消息经过 RPC 序列化后，`details` 字段可能丢失或格式变化
- 文件写入 + HTTP 端点更可靠，前端控制拉取节奏
- wgnr-pi server.js 只需加一个 ~10 行的 Express 路由

### 前端面板

- `position: fixed` 脱离文档流，不影响聊天区布局
- `transform: translateX` 实现滑入/滑出动画
- 面板宽度 420px，移动端 360px
- 每个步骤折叠显示标题行（图标 + 标题 + 徽章 + 箭头），展开显示描述 + 指标 + 详细内容
- 使用字符串拼接而非模板字面量，避免内联 HTML 中的转义问题

## 7. 配色

沿用原 Personal Agent 配色：

| 颜色 | 色值 | 用途 |
|------|------|------|
| 背景 | `#1a1a2e` | 主背景 |
| 表面 | `#16213e` | 侧边栏、消息气泡 |
| 用户气泡 | `#1e3a5f` | 用户消息 |
| 强调色 | `#6EA8DB` | 按钮、链接、选中态 |
| 金色 | `#D4AF37` | AI 标签、工具调用 |
| 文字 | `#e0e0e0` | 正文 |
| 次级文字 | `#8892a4` | 时间戳、辅助信息 |
