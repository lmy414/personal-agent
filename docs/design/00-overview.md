# Personal Agent — 设计文档：概述与架构

> v0.5.3 · Pi 架构 + 澪号 Harness + 流水线透视 · 2026-05-29

## 1. 概述

Personal Agent 是一个基于 Pi 编码 Agent 框架的个人 AI 助手。核心理念：**魔改 Pi**——保持 Pi 的极简核心，用扩展系统承载所有差异化功能。

## 2. 技术选型

| 层 | 选型 | 理由 |
|---|---|---|
| Agent 框架 | **Pi (pi-mono)** | MIT 开源，双层 Agent 循环，28 事件扩展系统，300+ 模型支持 |
| LLM | **DeepSeek V3 + R1** | 成本极低（V3: $0.27/M input），OpenAI 兼容协议，中文优秀 |
| Web UI | **wgnr-pi (fork)** | 原生 JS 零框架，WebSocket 实时流式，极易魔改，fork 在 vendor/ |
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
- Fork 在 `vendor/wgnr-pi/`，patch 永久可追溯

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

## 4. 数据流

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

## 5. 配色

| 颜色 | 色值 | 用途 |
|------|------|------|
| 背景 | `#1a1a2e` | 主背景 |
| 表面 | `#16213e` | 侧边栏、消息气泡 |
| 用户气泡 | `#1e3a5f` | 用户消息 |
| 强调色 | `#6EA8DB` | 按钮、链接、选中态 |
| 金色 | `#D4AF37` | AI 标签、工具调用 |
| 文字 | `#e0e0e0` | 正文 |
| 次级文字 | `#8892a4` | 时间戳、辅助信息 |

---

**相关文档**：
- 扩展设计 → `01-extensions.md`
- 澪号 Harness → `02-mio-harness.md`
- 流水线透视 → `03-observe.md`
- 架构债务与改进 → `04-debt-extensions.md` / `05-debt-system.md`
- 演进路线 → `06-roadmap.md`
