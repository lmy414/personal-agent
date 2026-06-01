# 澪号 Personal Agent

基于 Pi SDK + DeepSeek 的个人 AI 助手。SolidJS 前端 + Node.js 桥接层 + Live2D 角色系统。

## 架构

```
浏览器 (SolidJS + Tailwind + PIXI/Cubism)
    ↕ WebSocket (ws://localhost:9229)
桥接服务器 (Node.js + Pi Agent SDK)
    ↕ HTTP                      ↕ STDIO (JSON-RPC)
DeepSeek / Anthropic API        MCP Server (Live2D 控制)
    ↕
Pi 扩展层 (人格注入 + 记忆工具 + 文件工具 + Live2D 工具)
```

- `bridge/` — Node 桥接层，通过 Pi SDK 管理 AI 会话，WebSocket 推流
- `frontend/` — SolidJS 单页应用，玻璃拟态 UI，11 个扩展组件按 Slot 机制组织
- `extensions/` — Pi 扩展：pa-mio（人格注入+记忆工具）、pa-files（文件浏览工具）、pa-live2d（Live2D 控制工具）
- `mcp-servers/` — MCP Server：Live2D 表情/动作控制（STDIO JSON-RPC）
- `mio-harness/` — 角色数据：SOUL.md（人格定义）、MEMORY.md/USER.md（持久记忆）
- `vendor/pi/` — Pi SDK fork，含自定义安全补丁

## 功能

### 人格系统

澪号的人格通过 `mio-harness/SOUL.md` 定义（行为规则，<1KB）。pa-mio 扩展在每次 LLM 调用前组装 5 层 System Prompt：

```
Layer 0: SOUL.md                    ← 人格（实时读取，改文件立即生效）
Layer 1: 记忆快照（MEMORY + USER）   ← <recall> 围栏，会话启动冻结
Layer 2: 注入上下文（检索记忆）      ← 每轮动态
Layer 3: Pi 工具定义                ← Pi 自动注入
Layer 4: 模式指令（chat/agent）      ← 18 条正则意图分类
```

- **chat 模式**：闲聊，不需要调用工具
- **agent 模式**：允许调用工具，完成后汇报结果
- **思考分离**：`thinking_delta` 与 `text_delta` 分开处理，前端默认折叠

### 记忆系统

照搬 Hermes Agent 设计——`mio-harness/memories/` 下两个 Markdown 文件：

- `MEMORY.md` — 环境/项目记忆（≤2200 chars），当前 6 条 § 条目
- `USER.md` — 用户画像（≤1375 chars），当前 17 条 § 条目

特性：
- § 分隔条目，声明式事实（不是命令式指令）
- 冻结快照注入（保护 prefix cache），写入原子持久化（tempfile + fsync + rename）
- LLM 通过 `memory_add` / `memory_read` 工具读写
- 写入前扫描 prompt injection 模式

### Live2D 角色系统

卡拉模型悬浮看板，右下角可拖拽缩放：

- **16 个内置表情** — 爱心眼、星星眼、脸红、嘟嘴、汗、泪…
- **5 个自定义参数表情** — 微笑、大笑、生气、难过、惊讶
- **LLM 工具** — `live2d_expression` / `live2d_motion` / `live2d_status`
- **MCP Server** — STDIO JSON-RPC 协议，Bridge WebSocket 中继到浏览器
- **鬼影模式** — 降低透明度，不遮挡工作区

### 设置系统

- 模型厂商接入（DeepSeek + Anthropic，架构预留 15 厂商）
- 模型发现（自动扫描已配置 API Key 的厂商）
- 模型管理/切换（设置页面）
- 默认模型、思考强度、压缩阈值（SQLite 持久化）
- Live2D 面板参数控制（尺寸、缩放、偏移、重置）

### 会话管理

- 多会话创建/切换/删除/重命名
- 主会话「澪」默认存在
- 首次对话自动生成 3-5 字中文标题
- 上下文自动压缩（可配置阈值）
- 切换会话回填历史消息

## 本地运行

```bash
# 终端 1 — 桥接服务器 (端口 9229)
cd bridge && npm run dev

# 终端 2 — 前端 (端口 5173)
cd frontend && npm run dev

# 终端 3 — EchoBot (端口 8000, Live2D SDK + 模型)
cd bot/EchoBot && python -m echobot app
```

浏览器打开 `http://localhost:5173`。

环境变量（`.env`）：

```
DEEPSEEK_API_KEY=sk-...
```

## 自建内容

- 桥接服务器完整实现（WebSocket 协议、消息路由、会话管理、SQLite 持久化、文件监听、Live2D 中继）
- SolidJS 前端全套（Grid 布局 + 玻璃拟态 UI + 11 个扩展组件 + 可拖拽面板）
- 人格系统（SOUL.md + 5 层 Prompt 组装 + 18 条正则意图分类 + 思考折叠）
- 记忆系统（Hermes 式 MEMORY.md/USER.md + memory_add/read 工具 + 原子写入）
- Live2D 角色系统（Cubism SDK + PIXI 渲染 + 16 内置表情 + 5 自定义参数表情 + MCP Server）
- 设置系统（多厂商模型管理 + 自动发现 + SQLite 持久化）
- Pi 扩展：pa-mio（人格注入+记忆工具）、pa-files（文件浏览/预览工具）、pa-live2d（Live2D 控制工具）
- Pi SDK fork 安全修复（路径穿越、命令注入等审计补丁）

## 文档

- `CLAUDE.md` — 开发者指南（代码规范、扩展规范、Git 规则、查错流程）
- `docs/mio-status-2026-06-02.md` — 项目状态（架构/已完成/待完成/文件索引）
- `docs/superpowers/specs/` — 设计 Specs（7 份）
- `docs/superpowers/plans/` — 实现计划（6 份）
- `frontend-sketch/` — UI 原型（设计源，9 个 HTML 原型）
