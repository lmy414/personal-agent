# Personal Agent — 扩展开发手册：最小模板

## 完整最小扩展示例

```typescript
// extensions/pa-hello/index.ts
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@mariozechner/pi-ai";
import { defineTool } from "@mariozechner/pi-coding-agent";
import path from "path";
import fs from "fs";

// ── 1. 模块级常量（只读）─────────────────────────
const EXT_NAME = "pa-hello";
const DATA_DIR = path.join(require("os").homedir(), ".personal-agent", EXT_NAME);

// ── 2. 模块级状态（仅在当前扩展内使用）───────────
let messageCount = 0;

// ── 3. 辅助函数 ──────────────────────────────────
function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

// ── 4. 工厂函数（唯一导出）───────────────────────
export default function (pi: ExtensionAPI) {
  // 4.1 生命周期事件
  pi.on("session_start", async (_event, ctx) => {
    ensureDir();
    console.log(`[${EXT_NAME}] session started:`, ctx.sessionManager.getSessionId());
  });

  pi.on("session_shutdown", async () => {
    // 清理资源：关闭文件句柄、清除定时器等
    messageCount = 0;
  });

  pi.on("message_end", async (event) => {
    const msg = event.message as any;
    if (msg?.role === "assistant") messageCount++;
  });

  // 4.2 斜杠命令
  pi.registerCommand("hello", {
    description: "Say hello and show message count",
    handler: async (args, ctx) => {
      const name = args.trim() || "world";
      ctx.ui.notify(`Hello ${name}! Assistant messages this session: ${messageCount}`, "info");
    },
  });

  // 4.3 LLM 可调工具（可选）
  const helloTool = defineTool({
    name: "say_hello",
    label: "Say Hello",
    description: "Greet a user by name",
    parameters: Type.Object({
      name: Type.String({ description: "User name" }),
    }),
    execute: async (_id, params) => ({
      content: [{ type: "text", text: `Hello, ${params.name}!` }],
      details: {},
    }),
  });

  pi.registerTool(helloTool);
}
```

## 关键约定

- 必须 `export default` 一个函数，签名为 `(api: ExtensionAPI) => void | Promise<void>`
- 参数命名不统一：4 个扩展用 `pi`，2 个用 `api`
- 生命周期通过 `pi.on("event_name", handler)` 订阅
- 某些事件可返回值影响宿主行为（如 `before_agent_start` → `{ systemPrompt }`）
- 命令 handler 接收 `(args: string, ctx: ExtensionCommandContext)`
- 事件 handler 接收 `(event, ctx: ExtensionContext)`

---

**下一章**：
- API 速查 → `02-api.md`
