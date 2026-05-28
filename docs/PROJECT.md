# Personal Agent — 项目总览

> v0.5.2 · 2026-05-29 · ~1178 行扩展代码 + Pi + wgnr-pi + 澪号 Harness + 流水线透视

## 当前状态

| 模块 | 功能 | 状态 |
|------|------|------|
| **对话** | DeepSeek V3/R1 流式对话 | 正常 |
| **会话** | 多会话管理（新建/切换/归档/删除） | 正常（v0.5.2 修复 Windows 路径兼容性） |
| **持久化** | SQLite 自动保存所有消息 | 正常 |
| **用量** | Token 统计 + 成本计算（USD/CNY） | 正常 |
| **文件** | 工作区浏览 + 文件预览（Markdown/代码/HTML） | 正常 |
| **预算** | 月度/日预算预警 | 正常 |
| **模型** | DeepSeek V3 + R1 双模型切换 | 正常 |
| **UI** | 全中文 Web 界面，实时流式渲染 | 正常 |
| **启动** | 一键 bat 启动，自动打开浏览器 | 正常 |
| **澪号** | Harness 角色控制系统（9-Slot Prompt + 5 计数器 + 记忆） | 正常 |
| **流水线** | 右侧可展开面板，7 步全链路追踪（Prompt → API → 工具 → 计数器） | 正常 |

## 技术架构

```
Personal Agent v0.5.2
├── Pi v0.73.0               Agent 框架（Agent 循环 + 工具系统 + RPC）
├── DeepSeek API             V3 (chat) + R1 (reasoner)
├── wgnr-pi                  Web UI（原生 JS + WebSocket）
├── 6 个 Pi 扩展             ~1170 行 TypeScript
├── 澪号 Harness              角色控制系统（9-Slot Prompt + 5 计数器 + 记忆）
└── SQLite                   会话 + 用量数据
```

## 扩展清单

| 扩展 | 代码量 | 注册内容 |
|------|--------|----------|
| pa-sqlite | ~158 行 | 3 事件 + 1 命令 |
| pa-usage | ~135 行 | 1 事件 + 2 命令 |
| pa-files | ~176 行 | 2 工具 + 3 命令 |
| pa-budget | ~104 行 | 1 事件 + 1 命令 |
| pa-mio | ~263 行 | 5 事件（Harness 角色控制系统） |
| pa-observe | ~308 行 | 7 事件（流水线透视） |
| shared/db-config | ~27 行 | DB 路径 + 定价常量共享模块 |

## 启动方式

```bash
# 方式一：双击 pa.bat

# 方式二：终端
wgnr-pi

# 方式三：Pi TUI 模式
pi
```

## 文件清单

```
personal-agent/
├── pa.bat                         # 一键启动
├── README.md                      # 项目说明
├── main.js                        # Electron 桌面壳
├── vendor/
│   └── wgnr-pi/                   # Web UI fork（github.com/lmy414/wgnr-pi）
│       ├── server.js              # Express 服务端（Windows 兼容 + observe API）
│       ├── public/index.html      # 前端（全中文 + 流水线透视面板）
│       └── bin/wgnr-pi.js         # CLI 入口
├── docs/
│   ├── ROADMAP.md                 # 路线图
│   ├── DESIGN.md                  # 设计文档
│   ├── PROJECT.md                 # 本文件
│   ├── TEST_CHECKLIST.md          # 测试清单
│   ├── SESSION-STATE.md           # 项目状态总览
│   ├── observe-issues.md          # 流水线透视问题清单
│   ├── issues-2026-05-29.md       # 问题日志
│   └── archive/                   # 归档文档（v0.3.0 HTML 等）
├── .pi/
│   └── settings.json              # Pi 配置（扩展 + 技能 + 模型默认值）
├── extensions/
│   ├── shared/
│   │   └── db-config.ts           # DB 路径 + 定价常量
│   ├── pa-sqlite/
│   │   ├── index.ts               # SQLite 持久化扩展
│   │   └── package.json
│   ├── pa-usage/
│   │   ├── index.ts               # 用量追踪扩展
│   │   └── package.json
│   ├── pa-files/
│   │   └── index.ts               # 文件浏览扩展
│   ├── pa-budget/
│   │   ├── index.ts               # 预算预警扩展
│   │   └── package.json
│   ├── pa-mio/
│       └── index.ts               # 澪号 Harness 扩展
│   └── pa-observe/
│       └── index.ts               # 流水线透视扩展
├── skills/
│   └── personal-agent/
│       └── agent.md               # Agent 角色定义（默认人格，pa-mio 加载时覆盖）
├── mio-harness/
│   ├── character/                 # 角色文件
│   │   ├── soul.md                # 人格叙事 + 外观
│   │   ├── boundaries.md          # 硬边界（7 条）
│   │   ├── knowledge.md           # 领域知识
│   │   └── language.md            # 语言指纹（供参考）
│   ├── meta_instruction.txt       # Slot 0 元指令
│   ├── tools_stub.txt             # Slot 3 工具层占位
│   ├── harness.py                 # Python Harness（开发自测）
│   ├── counters.py                # 5 计数器（开发自测）
│   ├── memory.py                  # 记忆系统（开发自测，SQLite 版）
│   ├── extractor.py               # 记忆提取（开发自测）
│   ├── bridge.py                  # Python 桥接（开发自测）
│   ├── show_flow.py               # 数据流图
│   └── test_counters.py           # 计数器测试（7/7 通过）
└── mio-data/
    ├── character-v1.md            # 澪号角色卡 v1.1
    ├── design/                    # 设计文档（历史档案）
    ├── analysis/                  # 平台分析报告
    ├── groups/                    # 群聊分析
    └── scripts/                   # 分析脚本（归档）
```

## 外部依赖配置

| 文件 | 用途 |
|------|------|
| `~/.pi/agent/models.json` | DeepSeek provider + 模型定义 |
| `~/.pi/agent/sessions/` | Pi JSONL 会话文件 |
| `~/.personal-agent/agent.db` | SQLite 数据库（4 张表） |
| `~/.personal-agent/mio_memories.json` | 澪号记忆存储（JSON 数组，最多 500 条） |
| `C:/Users/Mirror/AppData/Roaming/npm/pi-node.cmd` | Pi 启动包装脚本 |
| `vendor/wgnr-pi/` | Web UI fork（已汉化 + 工具渲染修复 + Windows 路径兼容 + 流水线透视面板） |

## 调试

- **Pi 日志**：wgnr-pi 终端输出
- **浏览器控制台**：F12 → Console
- **WebSocket 消息**：浏览器 Console 有 `[WS]` 前缀日志
- **SQLite 数据库**：`~/.personal-agent/agent.db`，可用 DB Browser 打开
- **Pi 会话文件**：`~/.pi/agent/sessions/` 下的 JSONL 文件
