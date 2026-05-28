# 流水线透视 — 当前问题清单

> 2026-05-29 · pa-observe 扩展 + wgnr-pi 前端

## 已修复

| # | 问题 | 修复方式 |
|---|------|----------|
| 1 | **切换会话不跟随** | `session_state` 处理中切换时重置 `lastObserveTimestamp` / `lastSavedTraceTimestamp` + 清空面板 DOM；`fetchObserveTrace` 用快照 `currentSessionFile` 做竞态守卫，`await` 后比较丢弃过期响应 |
| 2 | **新会话不渲染** | 同上竞态守卫修复 |
| 3 | **后端不知道当前会话** | pa-observe 扩展 `session_start` 处理器接收 `ctx` 参数，捕获 `ctx.sessionManager.getSessionFile()` / `getSessionId()` 写入 trace JSON |
| 4 | **跨会话数据污染** | API 匹配 key 从 `sessionId` (UUID) 改为 `sessionFile` (文件路径精确匹配)；server GET/POST 均校验 `trace.sessionFile === requestSessionFile`；POST 守卫拒绝 sessionFile 不匹配的写入；前端 `fetchObserveTrace` 竞态守卫杜绝旧请求污染 |
| 5 | **新会话侧边栏消失 (Windows)** | `cwdKey` 正则扩展 `replace(/[/\\:*?"<>|]/g, "-")` 处理 Windows 路径字符；`process.env.HOME` → `homedir()`；`groupByDate()` 添加 `isNaN` 防御；`lastTimestamp` 添加 fallback |

## 修改涉及文件

| 文件 | 改动 |
|------|------|
| `extensions/pa-observe/index.ts` | `session_start` 捕获 `currentSessionFile` / `currentSessionId`；`sendTrace()` 写入 `sessionFile` / `sessionId` 字段 |
| `wgnr-pi/server.js` | GET/POST `/api/observe_trace` 参数改为 `sessionFile`；filter 精确路径匹配 `trace.sessionFile === sfile`；保存文件 key 为 base64url 哈希；POST 守卫；`cwdKey` Windows 兼容；`process.env.HOME` → `homedir()`；`lastTimestamp` fallback |
| `wgnr-pi/public/index.html` | `fetchObserveTrace` 传 `currentSessionFile`；`await` 后竞态守卫；`session_state` 切换时清面板 + 重置时间戳；`groupByDate()` NaN 防御 |

## 架构总结

pa-observe（Pi 扩展）和前端现在通过 **sessionFile（完整文件路径）** 对齐：

- pa-observe 写入 trace 时附带 `sessionFile`
- server 按 `sessionFile` 过滤和存储
- 前端传 `currentSessionFile` 查询，竞态守卫防止过时请求污染面板
- `sessionId` 仅作辅助信息保留在 trace 中，不参与匹配逻辑

## Windows 兼容性修复 (v0.5.2)

### 根因分析

新会话在侧边栏消失是三个 bug 叠加的结果：

1. **`cwdKey` 计算只处理 Unix 路径**：原 `replace(/\//g, "-")` 不替换 `\` 和 `:`，导致 Windows 路径 `D:\claude\personal-agent` 生成 `--D:\claude\personal-agent--`（目录不存在），`parseSessions()` 返回空数组
2. **`process.env.HOME` 不可靠**：Windows 上 `HOME` 环境变量可能未设置，`join("", ...)` 生成相对路径
3. **`groupByDate()` 不处理 NaN**：`+new Date(undefined)` = `NaN`，`NaN >= threshold` 永远为 `false`，会话不落入任何日期分组

### 修复详情

| 位置 | 修改 |
|------|------|
| `server.js` L49 | `cwdKey` 正则：`replace(/[/\\:*?"<>|]/g, "-")` |
| `server.js` L46 | `process.env.HOME \|\| ""` → `homedir()` |
| `server.js` L104 | `lastTimestamp` 添加 `new Date().toISOString()` fallback |
| `server.js` L162/201/214/231 | 所有 `process.env.HOME` → `homedir()` |
| `index.html` L806 | `isNaN(raw) ? 0 : raw` |
