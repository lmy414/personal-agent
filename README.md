# Personal Agent

基于 Pi + DeepSeek 的个人 AI 助手。终端 Agent + Web UI + SQLite 持久化 + 用量追踪。

## 📖 文档索引（新智能体请先看这里）

> 全部文档已拆分为 **< 200 行**的小文件，支持按需读取。

- **5 分钟快速上手** → [`docs/guide/QUICKSTART.md`](docs/guide/QUICKSTART.md)
- **按场景导航** → [`docs/INDEX.md`](docs/INDEX.md)
- **架构设计** → [`docs/design/00-overview.md`](docs/design/00-overview.md)
- **扩展开发** → [`docs/handbook/00-principles.md`](docs/handbook/00-principles.md)
- **安全审计** → [`docs/audit/00-summary.md`](docs/audit/00-summary.md)
- **项目状态** → [`docs/state/00-overview.md`](docs/state/00-overview.md)

## 前置依赖

`pa.bat` 通过 Electron 启动桌面窗口，依赖全局安装的 `electron`：

```
npm install -g electron
```

## 一键启动

```
双击 pa.bat → 浏览器打开 http://localhost:4815
```

## 架构

```
浏览器 ←→ WebSocket ←→ wgnr-pi ←→ Pi RPC ←→ DeepSeek
                              │
       ┌──────────────────────┼──────────────────────┐
  pa-sqlite    pa-usage    pa-files    pa-budget    pa-mio    pa-observe
  SQLite持久化   用量追踪    文件浏览     预算预警    Harness    流水线透视
```

## 扩展

| 扩展 | 代码 | 功能 |
|------|------|------|
| pa-sqlite | ~158 行 | 会话持久化到 SQLite，`/pa-sessions` |
| pa-usage | ~135 行 | Token 用量 + 成本追踪，`/usage` `/cost` |
| pa-files | ~176 行 | 工作区文件浏览器，`/files` `/preview` `/workspace` |
| pa-budget | ~104 行 | API 预算预警，`/budget` |
| pa-mio | ~263 行 | 澪号 Harness 角色控制系统（9-Slot Prompt + 5 计数器 + 记忆） |
| pa-observe | ~316 行 | 流水线透视——API 请求/响应/工具/计数器全链路追踪（v0.5.2 修复 Windows 路径兼容性） |

## 快捷键

| 键 | 功能 |
|----|------|
| Ctrl+N | 新建会话 |
| Enter | 发送 |
| Shift+Enter | 换行 |
| Escape | 中止 |
| Ctrl+L | 清空聊天 |
| / | 斜杠命令 |

## 文件结构

```
personal-agent/
├── pa.bat                         # 一键启动
├── main.js                        # Electron 桌面壳
├── .pi/settings.json              # Pi 配置（扩展 + 技能）
├── extensions/
│   ├── shared/db-config.ts        # 共享 DB 路径 + 定价常量
│   ├── pa-sqlite/index.ts         # SQLite 持久化
│   ├── pa-usage/index.ts          # 用量追踪
│   ├── pa-files/index.ts          # 文件浏览
│   ├── pa-budget/index.ts         # 预算预警
│   ├── pa-mio/index.ts            # 澪号 Harness
│   └── pa-observe/index.ts        # 流水线透视
├── skills/personal-agent/agent.md # Agent 角色定义
├── mio-harness/                   # Harness 系统（角色文件 + Python 自测）
│   └── character/                 # soul / boundaries / knowledge / language
└── mio-data/                      # 数据档案（角色卡 + 分析报告 + 设计档案）
```

## 文档位置说明

本项目所有文档已按主题拆分为 **< 200 行**的小文件，存放位置如下：

| 文档类别 | 目录 | 内容 | 入口文件 |
|----------|------|------|----------|
| **顶层索引** | `docs/` | 全项目文档导航 | [`docs/INDEX.md`](docs/INDEX.md) |
| **快速上手** | `docs/guide/` | 新智能体 5 分钟入门、HTML 文档索引 | [`docs/guide/QUICKSTART.md`](docs/guide/QUICKSTART.md) |
| **架构设计** | `docs/design/` | 技术选型、扩展设计、Harness、流水线透视、架构债务 | [`docs/design/00-overview.md`](docs/design/00-overview.md) |
| **扩展手册** | `docs/handbook/` | 扩展开发规范、API 速查、模板、反模式 | [`docs/handbook/00-principles.md`](docs/handbook/00-principles.md) |
| **代码审计** | `docs/audit/` | 安全问题（严重/中危/轻微）及修复代码 | [`docs/audit/00-summary.md`](docs/audit/00-summary.md) |
| **项目状态** | `docs/state/` | 部署状态、数据收集、角色卡、Harness 部署、路线图 | [`docs/state/00-overview.md`](docs/state/00-overview.md) |
| **问题记录** | `docs/` 根目录 | 当日已知问题、流水线透视问题 | `docs/issues-2026-05-29.md` / `docs/observe-issues.md` |
| **设计档案** | `mio-data/design/` | 澪号角色系统的 11 份设计文档 | [`mio-data/design/INDEX.md`](mio-data/design/INDEX.md) |
| **分析报告** | `mio-data/analysis/` | 平台分析（知乎/B站/GitHub/网易云/QQ 等） | `mio-data/analysis/` |
| **群聊分析** | `mio-data/groups/` | 5 个 QQ 群聊分析报告 | `mio-data/groups/` |

> **注意**：根目录下超过 200 行的大文件（`docs/DESIGN.md`、`docs/EXTENSION-HANDBOOK.md`、`docs/audit-report-2026-05-29.md`、`docs/SESSION-STATE.md`）仅为归档，**请勿直接阅读**。请按上表读取拆分后的小文件。

## 数据位置

| 数据 | 路径 |
|------|------|
| Pi 会话 | `~/.pi/agent/sessions/` |
| SQLite | `~/.personal-agent/agent.db` |
| 模型配置 | `~/.pi/agent/models.json` |
