# Personal Agent — 扩展开发手册：API 速查

## 1. 事件订阅 (`pi.on`)

```typescript
pi.on("session_start",        async (event, ctx) => { ... });
pi.on("session_shutdown",     async (event, ctx) => { ... });
pi.on("turn_start",           async (event, ctx) => { ... });
pi.on("before_agent_start",   (event) => { return { systemPrompt: "..." }; });
pi.on("agent_start",          async (event, ctx) => { ... });
pi.on("agent_end",            async (event, ctx) => { ... });
pi.on("message_end",          async (event, ctx) => { ... });
pi.on("context",              async (event, ctx) => { ... });
pi.on("before_provider_request", async (event, ctx) => { ... });
pi.on("after_provider_response", async (event, ctx) => { ... });
pi.on("tool_execution_start", async (event, ctx) => { ... });
pi.on("tool_execution_end",   async (event, ctx) => { ... });
```

**注意**：`before_agent_start` 可以返回 `{ systemPrompt: string }` 来覆盖系统提示词。若多个扩展都返回，宿主按**加载顺序链式拼接**。因此扩展不应假设自己的 systemPrompt 是唯一的。

## 2. 斜杠命令 (`pi.registerCommand`)

```typescript
pi.registerCommand("cmd-name", {
  description: "说明文字",
  getArgumentCompletions?: () => [
    { value: "today", label: "Today" },
    { value: "month", label: "This month" },
  ],
  handler: async (args: string, ctx) => {
    // args = 用户输入的参数（不含命令名）
    ctx.ui.notify("结果", "info");
  },
});
```

## 3. LLM 工具 (`pi.registerTool`)

```typescript
import { Type } from "@mariozechner/pi-ai";
import { defineTool } from "@mariozechner/pi-coding-agent";

const tool = defineTool({
  name: "tool_name",
  label: "Human Label",
  description: "告诉 LLM 这个工具是干什么的",
  parameters: Type.Object({
    path: Type.String({ description: "文件路径" }),
    limit: Type.Number({ description: "最大数量", default: 10 }),
  }),
  execute: async (toolCallId, params, signal, onUpdate, ctx) => {
    return {
      content: [{ type: "text", text: "结果" }],
      details: { path: params.path },
    };
  },
});

pi.registerTool(tool);
```

## 4. Session 信息

仅在 `session_start` / `session_shutdown` 等事件的 `ctx` 中可用：

```typescript
pi.on("session_start", async (_event, ctx) => {
  const sid = ctx.sessionManager.getSessionId();      // 会话 UUID
  const sfile = ctx.sessionManager.getSessionFile();  // .jsonl 路径
});
```

## 5. 中止控制流

```typescript
pi.on("turn_start", async (_event, ctx) => {
  if (shouldBlock) {
    ctx.ui.notify("已阻断", "error");
    ctx.abort();   // 阻止本轮 Agent 执行
  }
});
```

---

**下一章**：
- UI 交互 → `03-ui-context.md`
