# Personal Agent — 项目状态：架构与部署

> 最后更新：2026-05-29  
> 当前阶段：v0.5.3 — wgnr-pi fork 纳入 vendor/ 目录

## 项目架构

基于 Pi + DeepSeek + wgnr-pi + Electron 的个人 AI 助手平台。

```
Electron 窗口 → wgnr-pi Web UI → WebSocket → Pi RPC → DeepSeek API
                                ├── pa-sqlite (SQLite 持久化)
                                ├── pa-usage  (Token 用量追踪)
                                ├── pa-files  (工作区文件浏览)
                                └── pa-budget (API 预算预警)
```

**启动**：双击 `pa.bat`（当前硬编码 `D:\claude\personal-agent`，需修复为 `"%~dp0"`）

**技术栈**：
- Pi v0.73.0 (MIT, Agent 循环 + 28 事件扩展系统)
- DeepSeek V3 + R1（配置在 `~/.pi/agent/models.json`）
- wgnr-pi 全中文 Web UI（`http://localhost:4815`）
- Electron 37.2.4 桌面壳 + 系统托盘
- 6 个自定义扩展 ~1,150 行 TypeScript
- Pi 配置文件：`.pi/settings.json`
- Pi 启动包装：`%APPDATA%\npm\pi-node.cmd`

**数据库**：
- Pi JSONL 会话：`~/.pi/agent/sessions/--D--claude-personal-agent--/`
- SQLite：`~/.personal-agent/agent.db`
- 旧 Electron 数据：`%APPDATA%/personal-agent/agent.db`（未迁移）

## wgnr-pi Fork 方案（v0.5.3）

wgnr-pi 的魔改版本以 fork 仓库形式存放在 `vendor/wgnr-pi/`。

**Fork 仓库**：https://github.com/lmy414/wgnr-pi

**修改内容（server.js）**：
- `spawn(PI_BIN, ...)` 加了 `shell: true`（Windows 兼容，但需移除）
- `parseSessions()` 路径编码正则改为 `replace(/[/\:*?"<>|]/g, "-")`
- `process.env.HOME` → `homedir()`（跨平台兼容）
- `parseSessions()` 的 `lastTimestamp` 添加 `new Date().toISOString()` fallback
- RPC 事件白名单过滤（只转发 10 个已知事件类型）
- `/api/sessions` 加了日志

**public/index.html**：
- 全部 UI 文字中文化
- `marked.setOptions` → `marked.use`（marked 18.x API 兼容）
- `loadSessions()` 加了 localStorage 缓存保护
- `groupByDate` NaN 时间戳防御

## Electron 壳

`main.js`（195 行）：
- spawn wgnr-pi → 等 HTTP 200 → 加载 `http://127.0.0.1:4815`
- F12 打开 DevTools（Menu Accelerator + before-input-event 双保险）
- 关闭窗口 → 最小化到托盘（Tray）
- 退出时 kill 子进程（当前有孤儿进程风险，需修复）

---

**下一章**：
- 澪号数据收集 → `01-mio-data.md`
