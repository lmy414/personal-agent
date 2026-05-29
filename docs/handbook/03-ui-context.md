# Personal Agent — 扩展开发手册：UI 交互与上下文

## UI 交互 (`ctx.ui`)

```typescript
ctx.ui.notify("消息", "info");           // 气泡通知（info | warning | error）
ctx.ui.setStatus("key", "状态文本");     // 状态栏
ctx.ui.setStatus("key", undefined);      // 清除状态
ctx.ui.setWorkingVisible(true);          // 显示"工作中"
ctx.ui.setWorkingMessage("处理中...");   // 工作提示文字
```

## 上下文对象 `ctx` 提供的能力

- `ctx.ui.notify(message, type)` — 显示通知
- `ctx.ui.setStatus(key, text)` — 设置状态栏
- `ctx.ui.setWorkingVisible(boolean)` — 显示/隐藏工作指示器
- `ctx.sessionManager.getSessionId()` / `getSessionFile()` — 会话信息
- `ctx.abort()` — 中止当前操作
- `ctx.model` — 当前模型信息
- `ctx.exec(command, args)` — 执行外部命令

## 向前端推送数据的最佳实践

ExtensionAPI **没有直接的 WebSocket / HTTP 客户端 API**。扩展通过以下两种机制间接与前端通信：

| 方式 | 适用场景 | 实现 |
|------|----------|------|
| **`ctx.ui.notify`** | 即时通知、命令结果 | 直接调用，前端显示气泡 |
| **写文件 + HTTP API** | 复杂结构化数据、状态面板 | 扩展写 JSON 到 `~/.personal-agent/`；wgnr-pi server 提供 `/api/xxx` 端点；前端轮询或 WS 转发 |

### 案例：pa-observe 的 trace 面板

```ts
// 扩展侧：写入文件
const LAST_TRACE = path.join(os.homedir(), ".personal-agent", "observe_last_trace.json");
fs.writeFileSync(LAST_TRACE, JSON.stringify(traceData));
```

```js
// wgnr-pi server 侧：提供 REST 端点
app.get("/api/observe", (req, res) => {
  const raw = fs.readFileSync(LAST_TRACE, "utf-8");
  res.json(JSON.parse(raw));
});
```

**缺点**：新增扩展需要修改 `vendor/wgnr-pi/server.js`，违反解耦原则。

**推荐**：扩展不直接向前端推送数据，而是通过 `ctx.ui.notify` 发送即时通知，或通过 `details` 字段在工具结果中附加元数据。

---

**下一章**：
- 数据持久化 → `04-persistence.md`
