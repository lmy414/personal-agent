# Personal Agent

基于 Pi + DeepSeek 的个人 AI 助手。终端 Agent + Web UI + SQLite 持久化 + 用量追踪。

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
| pa-observe | ~308 行 | 流水线透视——API 请求/响应/工具/计数器全链路追踪 |

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

## 数据位置

| 数据 | 路径 |
|------|------|
| Pi 会话 | `~/.pi/agent/sessions/` |
| SQLite | `~/.personal-agent/agent.db` |
| 模型配置 | `~/.pi/agent/models.json` |
