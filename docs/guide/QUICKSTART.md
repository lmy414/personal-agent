# Personal Agent — 新智能体快速上手指南

> 阅读时间：5 分钟  
> 目标：让你能在 5 分钟内理解本项目结构，并知道去哪里找需要的信息。

## 1. 这是什么项目？

Personal Agent 是一个基于 **Pi 编码 Agent 框架** + **DeepSeek LLM** 的个人 AI 助手，运行在 Windows 上，通过 Electron 提供桌面窗口。

**核心特色**：
- **6 个扩展**提供持久化、用量追踪、文件浏览、预算预警、角色控制（澪号）、流水线透视
- **澪号 Harness** —— 一个基于 9-Slot Prompt 注入的 AI 角色控制系统
- **wgnr-pi** —— 汉化版 Web UI，带实时调试面板

## 2. 项目结构（只记关键目录）

```
personal-agent/
├── docs/                    ← 你在这里。所有文档已拆分为 <200 行小文件
│   ├── INDEX.md            ← 文档总索引（按场景导航）
│   ├── design/             ← 架构设计文档
│   ├── handbook/           ← 扩展开发手册
│   ├── audit/              ← 代码审计报告
│   ├── state/              ← 项目状态与部署信息
│   └── guide/              ← 本文件 + HTML 文档索引
├── extensions/             ← 6 个扩展源码
│   ├── pa-sqlite/
│   ├── pa-usage/
│   ├── pa-files/
│   ├── pa-budget/
│   ├── pa-mio/            ← 澪号 Harness
│   ├── pa-observe/        ← 流水线透视
│   └── shared/            ← db-config.ts / logger.ts / counters.ts
├── mio-harness/           ← 角色文件（soul/boundaries/knowledge/language）
├── mio-data/              ← 澪号数据档案与分析报告
│   ├── design/            ← 11 个设计文档（INDEX.md 导航）
│   ├── analysis/          ← 平台分析报告（10 个）
│   └── groups/            ← 群聊分析（5 群）
├── vendor/wgnr-pi/        ← Web UI（fork，server.js + public/index.html）
├── main.js                ← Electron 入口
├── pa.bat                 ← 一键启动（Windows）
└── .pi/settings.json      ← Pi 配置（扩展列表 + 技能）
```

## 3. 5 分钟阅读路线

### 如果你要改代码

1. 改扩展 → 读 `docs/handbook/00-principles.md` + `01-template.md`
2. 改 UI → 读 `docs/guide/HTML-DOCS.md`
3. 改架构 → 读 `docs/design/04-debt-extensions.md`

### 如果你要排查问题

1. 安全漏洞 → `docs/audit/00-summary.md`
2. 已知 Bug → `docs/issues-2026-05-29.md` + `docs/observe-issues.md`
3. 启动失败 → `docs/state/00-overview.md`

### 如果你要了解澪号

1. 快速 → `docs/design/02-mio-harness.md`
2. 深度 → `mio-data/design/INDEX.md`（按路线阅读）

## 4. 关键文件位置（速查）

| 找什么 | 去哪里 |
|--------|--------|
| 扩展 API 接口 | `docs/handbook/02-api.md` |
| 安全漏洞列表 | `docs/audit/01-critical.md` |
| 修复代码示例 | `docs/audit/04-fix-main.md` 到 `07-fix-python.md` |
| 架构改进方向 | `docs/design/04-debt-extensions.md` |
| 项目当前状态 | `docs/state/05-roadmap.md` |
| 测试清单 | `docs/TEST_CHECKLIST.md` |

## 5. 记住一个规则

> **所有文档都已拆分为 < 200 行的小文件。** 不要读取根目录下的大文件（`DESIGN.md`、`EXTENSION-HANDBOOK.md`、`audit-report-2026-05-29.md`、`SESSION-STATE.md`），它们只是归档。请按本索引指向的拆分后文件读取。
