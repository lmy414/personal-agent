# 澪号 Personal Agent

基于 Pi SDK + DeepSeek 的个人 AI 助手。SolidJS 前端 + Node.js 桥接层 + Pi 扩展系统。

## 架构

```
浏览器 (SolidJS + Tailwind)
    ↕ WebSocket (ws://localhost:9229)
桥接服务器 (Node.js + Pi Agent SDK)
    ↕ HTTP                      ↕ MCP STDIO
DeepSeek API                    外部 MCP Server (可选)
    ↕
Pi 扩展层 (人格注入 + 记忆工具 + 文件工具 + MCP 桥接)
```

- `bridge/` — Node 桥接层，通过 Pi SDK 管理 AI 会话，WebSocket 推流，SQLite 持久化
- `frontend/` — SolidJS 单页应用，玻璃拟态 UI，9 个扩展组件按 Slot 机制组织
- `extensions/` — Pi 扩展：pa-mio（人格注入+记忆工具）、pa-files（文件浏览工具）、pa-mcp（通用 MCP 桥接）
- `mio-harness/` — 角色数据：SOUL.md（人格定义）、MEMORY.md/USER.md（持久记忆）
- `packages/live2d-pet/` — Live2D Electron 桌面宠物（独立项目，通过 MCP 协议接入）
- `vendor/pi/` — Pi SDK fork

## 功能

### 人格系统

澪号的人格通过 `mio-harness/SOUL.md` 定义（5 模块结构化人格，~3.3KB）。pa-mio v5 扩展在每次 LLM 调用前组装 4 层 System Prompt：

```
Layer 0: SOUL.md                         ← 人格定义，绝对顶部（实时读取，改文件立即生效）
Layer 1: 记忆全文（MEMORY.md + USER.md）  ← 每轮实时构建，<recall> 围栏
Layer 2: 检索记忆 + 工作目录              ← 每轮动态（关键词匹配 ≤3 条 + 工作目录感知）
Layer 3: Pi 工具定义                      ← Pi 自动注入（含 memory_add/read 等）
(+ Pi 底层: 对话历史)
```

- **SOUL.md**：实时读取，改文件立即生效
- **记忆**：`memory_add` 写入立即在下一轮 Prompt 中可见，无需重启或新会话
- **无意图分类**：不再用正则区分 chat/agent 模式，LLM 自行决定何时调用工具
- **工具隔离**：`<recall>` 围栏包裹记忆，防止被当作指令

### 记忆系统

照搬 Hermes Agent 设计——`mio-harness/memories/` 下两个 Markdown 文件：

- `MEMORY.md` — 环境/项目记忆（≤2200 chars）
- `USER.md` — 用户画像（≤1375 chars）

特性：
- § 分隔条目，声明式事实（不是命令式指令）
- 实时快照注入，写入原子持久化（tempfile + fsync + rename）
- LLM 通过 `memory_add` / `memory_read` 工具读写
- 写入前扫描 prompt injection 模式

### 工作目录系统

用户可在设置页配置工作目录，智能体自动感知并切换上下文：

- 文件面板自动显示工作目录内容
- LLM 工具（`list_directory` / `preview_file`）操作指向正确目录
- 系统 Prompt 注入工作目录上下文（`<recall>` 围栏）
- 空值时自动回退到项目根目录

### 设置系统

- 模型厂商接入（DeepSeek）
- 模型发现（自动扫描已配置 API Key 的厂商）
- 模型管理/切换（设置页面）
- 默认模型、思考强度、压缩阈值、历史保留条数、工作目录（SQLite 持久化）

### 会话管理

- 多会话创建/切换/删除/重命名
- 主会话「澪」默认存在
- 首次对话自动生成 3-5 字中文标题
- 上下文压缩（手动 + 超阈值自动 compact）
- 切换会话回填历史消息

### Live2D 角色系统（已移除）

> Live2D 集成已从主应用完全移除（2026-06-04）。`packages/live2d-pet/` 保留为独立 Electron 项目，可通过 MCP 协议由任意智能体调用。

## 本地运行

```bash
# 终端 1 — 桥接服务器 (端口 9229)
cd bridge && npm run dev

# 终端 2 — 前端 (端口 5173)
cd frontend && npm run dev
```

浏览器打开 `http://localhost:5173`。

环境变量（`.env`）：

```
DEEPSEEK_API_KEY=sk-...
# 可选: ANTHROPIC_API_KEY=sk-ant-...
```

## 自建内容

- 桥接服务器完整实现（WebSocket 协议、消息路由、会话管理、SQLite 持久化、文件监听）
- SolidJS 前端全套（Grid 布局 + 玻璃拟态 UI + 9 个扩展组件 + 可拖拽面板）
- 人格系统（SOUL.md + 4 层 Prompt 组装 + 工作目录感知，无意图分类）
- 记忆系统（Hermes 式 MEMORY.md/USER.md + memory_add/read 工具 + 原子写入）
- 工作目录系统（前端面板 + 智能体 prompt + LLM 工具 三线打通）
- 设置系统（多厂商模型管理 + 自动发现 + SQLite 持久化）
- Pi 扩展：pa-mio（人格注入+记忆工具）、pa-files（文件浏览/预览工具）、pa-mcp（通用 MCP 客户端桥接）
- 通用 MCP 桥接（任何 MCP Server 自动注册为 Pi 工具，懒启动子进程）

## 文档

- `CLAUDE.md` — 开发者指南（代码规范、扩展规范、Git 规则、查错流程）
- `CHANGELOG.md` — 变更日志（每次改动的意图和影响范围）
- `docs/mio-status-2026-06-05.md` — 最新项目状态（架构/已完成/已移除/进度表）
- `docs/architecture.html` — 交互式架构图（vis-network 可视化）
- `docs/superpowers/specs/` — 设计 Specs
- `docs/superpowers/plans/` — 实现计划
- `frontend-sketch/` — UI 原型（设计源）
