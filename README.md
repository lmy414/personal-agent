# 澪号 Personal Agent

基于 [Pi SDK](https://github.com/earendilworks/pi)（Earendil Works）构建的个人 AI 助手。SolidJS 前端 + Node.js 桥接层 + DeepSeek API。

## 架构

```
浏览器 (SolidJS + Tailwind)
    ↕ WebSocket (ws://localhost:9229)
桥接服务器 (Node.js + Pi Agent SDK)
    ↕ HTTP
DeepSeek API
```

- `bridge/` — Node 桥接层，通过 Pi SDK 管理 AI 会话，WebSocket 推流
- `frontend/` — SolidJS 单页应用，玻璃拟态 UI，按扩展方式组织功能面板
- `extensions/` — Pi 原生扩展（角色人设、SQLite 持久化、用量统计、文件系统）
- `vendor/pi/` — Pi SDK fork，含自定义安全补丁

## 本地运行

```bash
# 终端 1 — 桥接服务器
cd bridge && npx tsx --env-file ../.env index.ts

# 终端 2 — 前端 dev
cd frontend && npm run dev
```

浏览器打开 `http://localhost:5173`。

环境变量（`~/.personal-agent/.env`）：

```
DEEPSEEK_API_KEY=sk-...
```

## 自建内容

- 桥接服务器完整实现（WebSocket 协议、消息路由、会话管理、持久化）
- SolidJS 前端全套（Grid 布局、流式对话渲染、工具面板、文件树、状态栏）
- Pi 原生扩展：pa-mio（角色人设注入）、pa-sqlite（SQLite 持久化）、pa-observe（文件监控）、pa-files（工作目录读写）、pa-budget（Token 预算）、pa-usage（用量日志）
- Pi SDK fork 安全修复（路径穿越、命令注入等审计补丁）
