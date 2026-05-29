# Personal Agent — 扩展开发手册：Checklist、反模式与示例

## 新增扩展 Checklist

- [ ] 创建 `extensions/pa-<name>/index.ts`，使用最小模板
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

## 常见反模式

### ❌ 反模式 1：假设其他扩展已加载

```typescript
// 错误：假设 pa-sqlite 一定存在且已创建表
db.prepare("SELECT * FROM messages").all();
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
  return { systemPrompt: "我是唯一的系统提示词" };
});
```

**正确**：拼接而非覆盖。

```typescript
pi.on("before_agent_start", (event) => {
  const original = event.systemPrompt || "";
  return { systemPrompt: original + "\n\n[附加规则]..." };
});
```

### ❌ 反模式 4：在模块顶层执行副作用

```typescript
// 错误：模块加载时就创建文件/连接
db = new Database(DB_PATH);
```

**正确**：延迟到 `session_start` 或命令 handler 中初始化。

```typescript
let db: Database | null = null;
pi.on("session_start", () => { db = new Database(DB_PATH); });
```

### ❌ 反模式 5：静默吞掉所有错误

```typescript
// 错误
try { doSomething(); } catch {}
```

**正确**：至少记录到 stderr 或日志文件。

```typescript
try { doSomething(); } catch (e) {
  console.error(`[pa-hello] Error:`, e);
}
```

## 完整示例：pa-reminder

```typescript
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import path from "path";
import fs from "fs";

const DATA_DIR = path.join(require("os").homedir(), ".personal-agent", "pa-reminder");
const REMINDER_FILE = path.join(DATA_DIR, "reminders.json");

interface Reminder { id: string; text: string; createdAt: string; }

function loadReminders(): Reminder[] {
  if (!fs.existsSync(REMINDER_FILE)) return [];
  try { return JSON.parse(fs.readFileSync(REMINDER_FILE, "utf-8")); }
  catch { return []; }
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
    if (list.length > 0) ctx.ui.notify(`📌 ${list.length} reminders active`, "info");
  });

  pi.registerCommand("remind", {
    description: "Add a reminder (/remind <text>)",
    handler: async (args, ctx) => {
      const text = args.trim();
      if (!text) { ctx.ui.notify("Usage: /remind <text>", "warning"); return; }
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
      if (list.length === 0) { ctx.ui.notify("No reminders.", "info"); return; }
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
        ctx.ui.notify("Invalid reminder index.", "error"); return;
      }
      const removed = list.splice(idx, 1)[0];
      saveReminders(list);
      ctx.ui.notify(`Removed: ${removed.text}`, "info");
    },
  });
}
```

---

**返回**：
- 核心原则 → `00-principles.md`
