# Personal Agent 扩展开发手册

> 版本：v1.0  
> 目标：新增一个扩展时，只需理解本手册 + ExtensionAPI 接口，无需阅读其他扩展的源码。

---

## 1. 核心设计原则

### 1.1 独立解耦

每个扩展是一个**自包含的 TypeScript 文件**，遵循以下约束：

| 规则 | 说明 |
|------|------|
| 不直接 import 其他 `pa-*` 扩展 | 禁止 `import { foo } from "../pa-xxx/index.ts"` |
| 不依赖其他扩展的加载顺序 | 不能假设 pa-sqlite 一定在 pa-usage 之前加载 |
| 不共享可变全局状态 | 禁止在 `shared/` 之外创建被多个扩展修改的变量 |
| 自给自足 | 扩展自己负责打开/关闭自己的资源（DB、文件、定时器） |

### 1.2 最小化影响

- 修改一个扩展的**内部逻辑**，不应影响其他扩展的运行
- 修改一个扩展的**数据库表结构**，必须通过**新表**或**新字段**实现，禁止删除/重命名其他扩展已使用的表/字段
- 扩展之间通过**宿主事件总线**间接通信，不直接调用

### 1.3 新增即插即用

新增扩展只需要：
1. 创建 `extensions/pa-<name>/index.ts`
2. 在 `.pi/settings.json` 的 `extensions` 数组中追加一行路径
3. 运行 `pi`（宿主会自动编译并加载）

不需要修改：wgnr-pi server.js、其他扩展、package.json、shared/ 模块。

---

## 2. 扩展加载生命周期

```
settings.json 列出扩展路径
      ↓
Pi 宿主按顺序读取每个路径
      ↓
jiti 运行时编译 TypeScript
      ↓
调用 export default function(api)  —— 扩展在此注册事件/命令/工具
      ↓
扩展运行期：通过事件回调响应宿主行为
      ↓
宿主退出 / 扩展热重载 → 扩展生命周期结束（无显式 unload hook）
```

**关键认知**：扩展是**工厂函数**，被调用一次即完成初始化。没有 `deactivate` 钩子，因此必须在 `session_shutdown` 事件中清理资源。

---

## 3. 最小扩展模板

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

---

## 4. 接口速查

### 4.1 事件订阅 (`pi.on`)

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

### 4.2 斜杠命令 (`pi.registerCommand`)

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

### 4.3 LLM 工具 (`pi.registerTool`)

```typescript
import { Type } from "@mariozechner/pi-ai";
import { defineTool } from "@mariozechner/pi-coding-agent";

const tool = defineTool({
  name: "tool_name",          // LLM 看到的函数名
  label: "Human Label",       // UI 显示名
  description: "告诉 LLM 这个工具是干什么的",
  parameters: Type.Object({
    path: Type.String({ description: "文件路径" }),
    limit: Type.Number({ description: "最大数量", default: 10 }),
  }),
  execute: async (toolCallId, params, signal, onUpdate, ctx) => {
    // params 已做类型校验
    return {
      content: [{ type: "text", text: "结果" }],
      details: { path: params.path },   // 供追踪/观察使用
    };
  },
});

pi.registerTool(tool);
```

### 4.4 UI 交互 (`ctx.ui`)

```typescript
ctx.ui.notify("消息", "info");           // 气泡通知（info | warning | error）
ctx.ui.setStatus("key", "状态文本");     // 状态栏
ctx.ui.setStatus("key", undefined);      // 清除状态
ctx.ui.setWorkingVisible(true);          // 显示"工作中"
ctx.ui.setWorkingMessage("处理中...");   // 工作提示文字
```

### 4.5 Session 信息

仅在 `session_start` / `session_shutdown` 等事件的 `ctx` 中可用：

```typescript
pi.on("session_start", async (_event, ctx) => {
  const sid = ctx.sessionManager.getSessionId();      // 会话 UUID
  const sfile = ctx.sessionManager.getSessionFile();  // .jsonl 路径
});
```

### 4.6 中止控制流

```typescript
pi.on("turn_start", async (_event, ctx) => {
  if (shouldBlock) {
    ctx.ui.notify("已阻断", "error");
    ctx.abort();   // 阻止本轮 Agent 执行
  }
});
```

---

## 5. 数据持久化规范

### 5.1 优先使用独立存储

| 存储方式 | 适用场景 | 优点 |
|----------|----------|------|
| **独立 JSON/文本文件** | 配置、缓存、简单状态 | 零耦合，随时可读 |
| **扩展专属 SQLite 表** | 结构化数据、查询需求 | schema 自治 |
| **共享 SQLite 数据库（新表）** | 需要与宿主或其他扩展共享的数据 | 统一备份 |

**禁止**：直接读写其他扩展的私有文件或表。

### 5.2 共享数据库使用约定

若必须使用共享数据库（`~/.personal-agent/agent.db`），遵守以下契约：

```typescript
// 1. 只操作自己创建的表
// 2. 表名加前缀，避免冲突
const MY_TABLE = "pa_hello_logs";

// 3. 建表时加 IF NOT EXISTS，不假设其他扩展已建表
db.exec(`
  CREATE TABLE IF NOT EXISTS ${MY_TABLE} (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    content TEXT
  )
`);

// 4. 不删除/不修改其他扩展的表结构
```

### 5.3 文件存储位置

```typescript
import os from "os";
import path from "path";

// 推荐：扩展专属子目录
const EXT_DIR = path.join(os.homedir(), ".personal-agent", "pa-hello");
```

---

## 6. 解耦通信模式

扩展之间**不直接调用**，通过以下方式间接协作：

### 6.1 事件总线（推荐）

扩展 A 产生事件 → 宿主广播 → 扩展 B 监听。

但注意：**Pi 宿主目前不提供自定义事件广播 API**。扩展只能通过宿主预定义的事件（`message_end`, `agent_start` 等）间接感知其他扩展的行为。

### 6.2 文件/数据库作为共享媒介（有限使用）

```
扩展 A 写入 ~/.personal-agent/shared-state.json
扩展 B 读取 ~/.personal-agent/shared-state.json
```

**约束**：
- 文件格式必须是稳定的（JSON Schema 版本化）
- 写操作应使用原子写入（先写临时文件再 rename）
- 不要假设其他扩展一定存在

### 6.3 完全不通信（最佳）

大多数扩展应该独立运行，彼此无感知。例如 pa-usage 和 pa-budget 虽然共用 `usage_log` 表，但它们各自只关心自己的读写逻辑，不直接交互。

---

## 7. 与 wgnr-pi Web UI 的通信

ExtensionAPI **没有 WebSocket / HTTP 客户端 API**。若扩展需要向前端推送数据，有两种方式：

### 7.1 方式一：写文件 + wgnr-pi 暴露 REST 端点（pa-observe 模式）

**扩展侧**（`pa-observe/index.ts`）：
```typescript
const TRACE_FILE = path.join(os.homedir(), ".personal-agent", "observe_last_trace.json");
fs.writeFileSync(TRACE_FILE, JSON.stringify(traceData));
```

**wgnr-pi 侧**（`vendor/wgnr-pi/server.js`）：
```javascript
app.get("/api/observe_trace", (req, res) => {
  const raw = fs.readFileSync(LAST_TRACE, "utf-8");
  res.json(JSON.parse(raw));
});
```

**缺点**：新增扩展需要修改 `vendor/wgnr-pi/server.js`，违反解耦原则。

### 7.2 方式二：纯扩展内实现（推荐）

扩展不直接向前端推送数据，而是：
- 通过 `ctx.ui.notify` 发送即时通知
- 通过 `details` 字段在工具结果中附加元数据（前端可展示）
- 将复杂面板数据写入扩展自己的文件，由前端通过独立的 HTTP 服务器（如扩展内部起一个 express 子服务器）或命令查询

**最佳实践**：尽量避免扩展与 wgnr-pi 的耦合。wgnr-pi 应该只负责 Web UI 和 WebSocket 代理，扩展的业务逻辑完全自治。

---

## 8. 共享模块 (`extensions/shared/`) 使用规范

`shared/` 提供**稳定的、只读的、无状态的工具函数和常量**。当前包含：

| 模块 | 导出 | 说明 |
|------|------|------|
| `db-config.ts` | `PA_DIR`, `DB_PATH`, `USD_CNY_RATE`, `getPricing()` | 数据库路径和定价常量 |
| `counters.ts` | `HEDGE_WORDS` | 叠甲关键词列表 |
| `logger.ts` | `log/debug/info/warn/error`, `registerCheck()`, `close()` | 结构化诊断日志 |

**使用规则**：
- ✅ 可以 import shared 模块获取常量和工具函数
- ❌ 禁止修改 shared 模块的内部状态
- ❌ 禁止在 shared 模块中创建依赖特定扩展的逻辑

---

## 9. 新增扩展 checklist

复制以下清单，完成一项勾一项：

- [ ] 创建 `extensions/pa-<name>/index.ts`，使用第 3 节的最小模板
- [ ] 扩展内部所有文件操作使用 `path.join()`，不使用字符串拼接路径
- [ ] 扩展所有 SQL 查询使用参数化查询（`?` 占位符），禁止字符串拼接
- [ ] 扩展的数据库表名加 `pa_<name>_` 前缀
- [ ] 扩展的敏感配置（API Key 等）通过 `process.env` 读取，不硬编码
- [ ] 扩展的本地状态/数据存放在 `~/.personal-agent/pa-<name>/` 子目录
- [ ] 在 `session_shutdown` 中关闭数据库、清除定时器、释放文件句柄
- [ ] 在 `.pi/settings.json` 的 `extensions` 数组中追加相对路径
- [ ] **不修改**任何其他 `pa-*` 扩展的代码
- [ ] **不修改** `vendor/wgnr-pi/server.js`（除非绝对必要）
- [ ] **不修改** `shared/` 下的现有模块（可以新增文件）

---

## 10. 常见反模式（不要这样做）

### ❌ 反模式 1：假设其他扩展已加载

```typescript
// 错误：假设 pa-sqlite 一定存在且已创建表
db.prepare("SELECT * FROM messages").all();   // messages 是 pa-sqlite 的表
```

**正确**：自己的扩展自己建表，或使用宿主提供的事件数据。

### ❌ 反模式 2：直接读写其他扩展的文件

```typescript
// 错误：直接读取 pa-observe 的 trace 文件
const trace = fs.readFileSync("~/.personal-agent/observe_last_trace.json");
```

**正确**：通过宿主事件获取你需要的数据，或自己独立采集。

### ❌ 反模式 3：返回 systemPrompt 时假设自己是唯一修改者

```typescript
// 错误：直接覆盖，不保留原有内容
pi.on("before_agent_start", () => {
  return { systemPrompt: "我是唯一的系统提示词" };   // 可能覆盖 pa-mio 的提示词
});
```

**正确**：拼接而非覆盖，或仅在确认无冲突时修改。

```typescript
pi.on("before_agent_start", (event) => {
  const original = event.systemPrompt || "";
  return { systemPrompt: original + "\n\n[附加规则]..." };
});
```

### ❌ 反模式 4：在模块顶层执行副作用

```typescript
// 错误：模块加载时就创建文件/连接
db = new Database(DB_PATH);   // 模块级执行
```

**正确**：延迟到 `session_start` 或命令 handler 中初始化。

```typescript
let db: Database | null = null;
pi.on("session_start", () => { db = new Database(DB_PATH); });
```

### ❌ 反模式 5：静默吞掉所有错误

```typescript
// 错误
try { doSomething(); } catch {}   // 完全不知道发生了什么
```

**正确**：至少记录到 stderr 或日志文件。

```typescript
try { doSomething(); } catch (e) {
  console.error(`[pa-hello] Error:`, e);
}
```

---

## 11. 示例：完整的新增扩展示例

下面是一个符合本手册规范的完整扩展示例：`pa-reminder`（会话提醒器）。

```typescript
// extensions/pa-reminder/index.ts
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import path from "path";
import fs from "fs";
import os from "os";

const EXT_NAME = "pa-reminder";
const DATA_DIR = path.join(os.homedir(), ".personal-agent", EXT_NAME);
const REMINDER_FILE = path.join(DATA_DIR, "reminders.json");

interface Reminder {
  id: string;
  text: string;
  createdAt: string;
}

function loadReminders(): Reminder[] {
  if (!fs.existsSync(REMINDER_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(REMINDER_FILE, "utf-8"));
  } catch {
    return [];
  }
}

function saveReminders(list: Reminder[]) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = REMINDER_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(list, null, 2));
  fs.renameSync(tmp, REMINDER_FILE);
}

export default function (pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => {
    const list = loadReminders();
    if (list.length > 0) {
      ctx.ui.notify(`📌 ${list.length} reminders active`, "info");
    }
  });

  pi.registerCommand("remind", {
    description: "Add a reminder (/remind <text>)",
    handler: async (args, ctx) => {
      const text = args.trim();
      if (!text) {
        ctx.ui.notify("Usage: /remind <text>", "warning");
        return;
      }
      const list = loadReminders();
      list.push({ id: crypto.randomUUID(), text, createdAt: new Date().toISOString() });
      saveReminders(list);
      ctx.ui.notify(`Reminder added: ${text}`, "info");
    },
  });

  pi.registerCommand("reminders", {
    description: "List all reminders",
    handler: async (_args, ctx) => {
      const list = loadReminders();
      if (list.length === 0) {
        ctx.ui.notify("No reminders.", "info");
        return;
      }
      const lines = list.map((r, i) => `${i + 1}. ${r.text}`).join("\n");
      ctx.ui.notify(`Reminders:\n${lines}`, "info");
    },
  });

  pi.registerCommand("forget", {
    description: "Remove a reminder (/forget <index>)",
    handler: async (args, ctx) => {
      const idx = parseInt(args.trim(), 10) - 1;
      const list = loadReminders();
      if (isNaN(idx) || idx < 0 || idx >= list.length) {
        ctx.ui.notify("Invalid reminder index.", "error");
        return;
      }
      const removed = list.splice(idx, 1)[0];
      saveReminders(list);
      ctx.ui.notify(`Removed: ${removed.text}`, "info");
    },
  });
}
```

配置追加：

```json
{
  "extensions": [
    "extensions/pa-sqlite/index.ts",
    "extensions/pa-usage/index.ts",
    "extensions/pa-files/index.ts",
    "extensions/pa-budget/index.ts",
    "extensions/pa-mio/index.ts",
    "extensions/pa-observe/index.ts",
    "extensions/pa-reminder/index.ts"
  ]
}
```

---

## 12. 故障排查

| 现象 | 原因 | 解决 |
|------|------|------|
| 扩展未加载 | settings.json 路径错误或扩展抛出异常 | 检查 Pi 宿主控制台输出 |
| 命令不响应 | 命令名冲突或 handler 抛异常 | 确保命令名唯一，try/catch 记录错误 |
| 工具不被 LLM 调用 | description 不清晰或参数 schema 错误 | 优化 description，检查 Type.Object 定义 |
| DB locked | 多个扩展/进程同时打开 SQLite | 使用 `better-sqlite3` 的单连接模式，或确保及时 close |
| 中文乱码 | Windows 默认编码为 GBK | 文件读写显式指定 `utf-8`，bridge.py 重定向 stdin/stdout 编码 |

---

## 13. 版本历史

| 版本 | 日期 | 说明 |
|------|------|------|
| v1.0 | 2026-05-29 | 初始版本，基于 6 个现有扩展的架构逆向分析 |
