# 流水线透视 — 当前问题清单

> 2026-05-28 · pa-observe 扩展 + wgnr-pi 前端

## 已修复

| # | 问题 | 修复方式 |
|---|------|----------|
| 1 | **切换会话不跟随** | `session_state` 处理中切换时重置 `lastObserveTimestamp` / `lastSavedTraceTimestamp` + 清空面板 DOM；`fetchObserveTrace` 用快照 `currentSessionFile` 做竞态守卫，`await` 后比较丢弃过期响应 |
| 2 | **新会话不渲染** | 同上竞态守卫修复 |
| 3 | **后端不知道当前会话** | pa-observe 扩展 `session_start` 处理器接收 `ctx` 参数，捕获 `ctx.sessionManager.getSessionFile()` / `getSessionId()` 写入 trace JSON |
| 4 | **跨会话数据污染** | API 匹配 key 从 `sessionId` (UUID) 改为 `sessionFile` (文件路径精确匹配)；server GET/POST 均校验 `trace.sessionFile === requestSessionFile`；POST 守卫拒绝 sessionFile 不匹配的写入；前端 `fetchObserveTrace` 竞态守卫杜绝旧请求污染 |

## 修改涉及文件

| 文件 | 改动 |
|------|------|
| `extensions/pa-observe/index.ts` | `session_start` 捕获 `currentSessionFile` / `currentSessionId`；`sendTrace()` 写入 `sessionFile` / `sessionId` 字段 |
| `wgnr-pi/server.js` | GET/POST `/api/observe_trace` 参数改为 `sessionFile`；filter 精确路径匹配 `trace.sessionFile === sfile`；保存文件 key 为 base64url 哈希；POST 守卫 |
| `wgnr-pi/public/index.html` | `fetchObserveTrace` 传 `currentSessionFile`；`await` 后竞态守卫；`session_state` 切换时清面板 + 重置时间戳 |

## 架构总结

pa-observe（Pi 扩展）和前端现在通过 **sessionFile（完整文件路径）** 对齐：

- pa-observe 写入 trace 时附带 `sessionFile`
- server 按 `sessionFile` 过滤和存储
- 前端传 `currentSessionFile` 查询，竞态守卫防止过时请求污染面板
- `sessionId` 仅作辅助信息保留在 trace 中，不参与匹配逻辑
