# 澪号 Personal Agent

基于 Pi SDK + DeepSeek 的个人 AI 助手。SolidJS 前端 + Node.js 桥接层。

## 架构

```
浏览器 (SolidJS + Tailwind)
    ↕ WebSocket (ws://localhost:9229)
桥接服务器 (Node.js + Pi Agent SDK)
    ↕ HTTP
DeepSeek API
    ↕
Pi 扩展层 (人格注入 + 记忆工具 + 文件工具)
```

- `bridge/` — Node 桥接层，通过 Pi SDK 管理 AI 会话，WebSocket 推流
- `frontend/` — SolidJS 单页应用，玻璃拟态 UI，按扩展方式组织功能面板
- `extensions/` — Pi 扩展：pa-mio（人格注入+记忆工具）、pa-files（文件浏览工具）
- `mio-harness/` — 角色数据：SOUL.md（人格定义）、MEMORY.md/USER.md（持久记忆）
- `vendor/pi/` — Pi SDK fork，含自定义安全补丁

## 本地运行

```bash
# 终端 1 — 桥接服务器
cd bridge && npm run dev

# 终端 2 — 前端 dev
cd frontend && npm run dev
```

浏览器打开 `http://localhost:5173`。

环境变量（`.env`）：

```
DEEPSEEK_API_KEY=sk-...
```

## 人格系统

澪号的人格通过 `mio-harness/SOUL.md` 定义（行为规则，<1KB）。pa-mio 扩展在每次 LLM 调用前组装 4 层 System Prompt，SOUL.md 在绝对顶部。

记忆系统照搬 Hermes Agent 设计：`MEMORY.md`（≤2200 chars）和 `USER.md`（≤1375 chars），§ 分隔条目，冻结快照注入，原子写入磁盘。

## 自建内容

- 桥接服务器完整实现（WebSocket 协议、消息路由、会话管理、持久化、文件监听）
- SolidJS 前端全套（Grid 布局、流式对话渲染、工具面板、文件树、状态栏、设置页面）
- 人格系统（SOUL.md + 4 层 Prompt 组装 + 思考过程折叠）
- 记忆系统（Hermes 式 MEMORY.md/USER.md + memory_add/read 工具）
- Pi 扩展：pa-mio（人格注入+记忆工具）、pa-files（文件浏览/预览工具）
- Pi SDK fork 安全修复（路径穿越、命令注入等审计补丁）
