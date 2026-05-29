# Personal Agent — 文档索引

> 项目：Personal Agent（基于 Pi + DeepSeek 的个人 AI 助手）  
> 平台：Windows  
> 最后更新：2026-05-29

---

## 🚀 新智能体快速上手

如果你是第一次接触本项目，按以下顺序阅读：

1. **`../README.md`**（2 分钟）— 项目是什么、怎么启动
2. **`design/00-overview.md`**（5 分钟）— 技术选型与架构图
3. **`handbook/00-principles.md`**（3 分钟）— 扩展开发核心原则

---

## 📚 文档地图

### 设计文档（`docs/design/`）

> 原 `DESIGN.md`（399 行）已拆分为以下小文件：

| 文件 | 行数 | 内容 | 何时读取 |
|------|------|------|----------|
| `00-overview.md` | ~80 | 概述、技术选型、架构图、配色 | 了解项目全貌 |
| `01-extensions.md` | ~60 | 6 个扩展示例（pa-sqlite/usage/files/budget/mio/observe） | 了解现有扩展功能 |
| `02-mio-harness.md` | ~70 | 澪号 Harness：9-Slot Prompt + 5 计数器 + 记忆系统 | 了解角色控制机制 |
| `03-observe.md` | ~80 | 流水线透视面板设计 | 了解调试面板 |
| `04-debt-extensions.md` | ~90 | 扩展层架构债务（耦合问题） | 改进扩展架构时 |
| `05-debt-system.md` | ~100 | 系统层架构债务（进程/配置/安全） | 改进系统稳定性时 |
| `06-roadmap.md` | ~40 | 演进路线 v0.5.4 → v0.7.0 | 规划迭代时 |

### 扩展开发手册（`docs/handbook/`）

> 原 `EXTENSION-HANDBOOK.md`（558 行）已拆分为以下小文件：

| 文件 | 行数 | 内容 | 何时读取 |
|------|------|------|----------|
| `00-principles.md` | ~40 | 独立解耦、最小影响、即插即用 | 开发新扩展前 |
| `01-template.md` | ~60 | 最小扩展模板（可直接复制） | 创建新扩展时 |
| `02-api.md` | ~80 | 事件/命令/工具 API 速查 | 查接口时 |
| `03-ui-context.md` | ~60 | UI 交互、Session、中止控制 | 需要前端交互时 |
| `04-persistence.md` | ~40 | 数据持久化规范（SQLite/文件） | 扩展需要存数据时 |
| `05-communication.md` | ~50 | 解耦通信模式、共享模块 | 扩展间需要协作时 |
| `06-patterns.md` | ~120 | Checklist、反模式、完整示例 | 开发扩展时对照 |

### 代码审计报告（`docs/audit/`）

> 原 `audit-report-2026-05-29.md`（892 行）已拆分为以下小文件：

| 文件 | 行数 | 内容 | 何时读取 |
|------|------|------|----------|
| `00-summary.md` | ~40 | 执行摘要 + 关键运维发现 | 了解安全问题全貌 |
| `01-critical.md` | ~100 | 11 项严重问题（安全/崩溃） | 紧急修复时 |
| `02-high.md` | ~50 | 20 项中危问题 | 排期修复时 |
| `03-low.md` | ~40 | 15 项轻微问题 | 优化代码时 |
| `04-fix-main.md` | ~120 | main.js / pa.bat / package / settings 修复代码 | 修复启动层时 |
| `05-fix-vendor.md` | ~100 | vendor/wgnr-pi/server.js 修复代码 | 修复后端时 |
| `06-fix-extensions.md` | ~100 | 6 个 TypeScript 扩展修复代码 | 修复扩展时 |
| `07-fix-python.md` | ~80 | mio-harness Python 修复代码 | 修复 Harness 时 |
| `08-checklist.md` | ~40 | 快速验证清单 | 修复后验收 |

### 项目状态（`docs/state/`）

> 原 `SESSION-STATE.md`（376 行）已拆分为以下小文件：

| 文件 | 行数 | 内容 | 何时读取 |
|------|------|------|----------|
| `00-overview.md` | ~70 | 项目架构、Fork 方案、Electron 壳 | 了解部署状态 |
| `01-mio-data.md` | ~80 | 澪号数据收集（QQ/知乎/B站/GitHub/网易云） | 了解数据来源 |
| `02-mio-character.md` | ~30 | 角色卡 v1.1 摘要 | 了解角色设定 |
| `03-mio-harness.md` | ~70 | Harness 系统部署状态 | 了解实现状态 |
| `04-observe.md` | ~70 | 流水线透视面板部署状态 | 了解面板状态 |
| `05-roadmap.md` | ~70 | 后续路线 + 文件索引 | 了解 TODO |

### 其他文档（`docs/` 根目录，< 200 行，保留原样）

| 文件 | 行数 | 内容 |
|------|------|------|
| `PROJECT.md` | ~140 | 项目总览（背景、目标、范围） |
| `ROADMAP.md` | ~70 | 功能路线图（短期/中期/长期） |
| `TEST_CHECKLIST.md` | ~100 | 发布前测试清单 |
| `issues-2026-05-29.md` | ~100 | 已知问题清单（当日） |
| `observe-issues.md` | ~50 | 流水线透视已知问题 |

### HTML 文档索引

| 文件 | 内容 |
|------|------|
| `guide/HTML-DOCS.md` | 所有 HTML 文件说明（preview.html、archive/ 等） |

### mio-data 设计档案

| 文件 | 内容 |
|------|------|
| `mio-data/design/INDEX.md` | 11 个设计文档的摘要和阅读路线 |
| `mio-data/character-v1.md` | 澪号角色卡 v1.1 |

---

## 🎯 按需读取路线

### 场景：我要开发一个新扩展

→ `handbook/00-principles.md` → `handbook/01-template.md` → `handbook/02-api.md` → `handbook/06-patterns.md`

### 场景：我要修复安全漏洞

→ `audit/00-summary.md` → `audit/01-critical.md` → 按模块选读 `04-fix-*` 到 `07-fix-*`

### 场景：我要了解澪号角色系统

→ `design/02-mio-harness.md` → `state/02-mio-character.md` → `mio-data/design/INDEX.md` → 选读具体设计文档

### 场景：我要改进系统架构

→ `design/04-debt-extensions.md` → `design/05-debt-system.md` → `design/06-roadmap.md`

### 场景：我要调试前端/UI

→ `guide/HTML-DOCS.md` → `vendor/wgnr-pi/public/index.html`

---

## 📁 原始大文件归档

以下文件因超过 200 行已被拆分为上述小文件，原始文件仍保留作为参考：

- `docs/DESIGN.md` → 拆分为 `docs/design/*.md`
- `docs/EXTENSION-HANDBOOK.md` → 拆分为 `docs/handbook/*.md`
- `docs/audit-report-2026-05-29.md` → 拆分为 `docs/audit/*.md`
- `docs/SESSION-STATE.md` → 拆分为 `docs/state/*.md`

---

## 🔗 外部依赖

| 依赖 | 路径/位置 | 说明 |
|------|----------|------|
| Pi 框架 | `~/.pi/` | Agent 核心 + 配置 |
| wgnr-pi | `vendor/wgnr-pi/` | Web UI（fork） |
| Electron | 全局/npm | 桌面壳（main.js） |
| DeepSeek API | 云端 | LLM 服务 |
| SQLite | `~/.personal-agent/agent.db` | 持久化 |
