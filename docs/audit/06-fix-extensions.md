# 代码审计修复代码：TypeScript 扩展

## F. pa-usage SQL 注入修复

```typescript
function getStats(period: string) {
  if (period === "today") {
    return db.prepare(`SELECT date, SUM(prompt_tokens) AS prompt_tokens, SUM(completion_tokens) AS completion_tokens, SUM(cost) AS cost FROM usage_log WHERE date = date('now','localtime') ORDER BY date DESC`).all();
  } else if (period === "week") {
    return db.prepare(`SELECT ... FROM usage_log WHERE date >= date('now','-7 days','localtime') ORDER BY date DESC`).all();
  } else if (period === "month") {
    return db.prepare(`SELECT ... FROM usage_log WHERE date >= date('now','start of month','localtime') ORDER BY date DESC`).all();
  }
  return db.prepare(`SELECT ... FROM usage_log GROUP BY date ORDER BY date DESC`).all();
}
```

## G. pa-observe 路径遍历修复

```typescript
import crypto from "crypto";
function traceKey(sessionId: string): string {
  return crypto.createHash("sha256").update(sessionId).digest("hex").slice(0, 32);
}
```

## H. pa-files 修复

### H.1 `resolveSafe`

```typescript
function resolveSafe(filePath: string): string | null {
  const target = path.resolve(workspaceRoot, filePath);
  const rel = path.relative(workspaceRoot, target);
  if (rel.startsWith("..") || path.isAbsolute(rel)) return null;
  return target;
}
```

### H.2 `/workspace` 白名单

```typescript
const ALLOWED_ROOTS = [process.cwd(), path.join(os.homedir(), "Documents")];
pi.onCommand("/workspace", async (_event, args) => {
  const newRoot = path.resolve(args.trim());
  const allowed = ALLOWED_ROOTS.some((r) => {
    const rel = path.relative(r, newRoot);
    return !rel.startsWith("..") && !path.isAbsolute(rel);
  });
  if (!allowed) return `❌ Not in allowed list.`;
  workspaceRoot = newRoot;
  return `Workspace set to: ${workspaceRoot}`;
});
```

### H.3 `previewFile` 二进制防护

```typescript
function previewFile(filePath: string): string {
  const stat = fs.statSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const binaryExts = [".jpg", ".png", ".gif", ".pdf", ".exe", ".dll", ".obj", ".bat", ".cmd", ".ps1", ".vbs", ".js", ".wsf", ".scr", ".com", ".msi", ".reg", ".zip", ".rar", ".7z"];
  if (binaryExts.includes(ext) || stat.size > 10 * 1024 * 1024) {
    return `[Binary file: ${ext || "unknown"} — ${(stat.size / 1024).toFixed(1)} KB]`;
  }
  return fs.readFileSync(filePath, "utf-8");
}
```

## I. pa-mio safeStringify

```typescript
function safeStringify(obj: unknown): string {
  try { return JSON.stringify(obj); } catch { return "[unserializable object]"; }
}
const content = typeof msg.content === "string" ? msg.content : safeStringify(msg.content || "");
```

## J. pa-sqlite DB 泄漏修复

```typescript
pi.on("session_start", async (_event, ctx) => {
  db = createDB();
  const sid = ctx.sessionManager.getSessionId();
  if (!sid) { db?.close(); db = null; console.warn("[pa-sqlite] session_id missing"); return; }
  // ...
});
```

## K. pa-budget Infinity 修复

```typescript
const m = parseFloat(parts[1]);
const d = parseFloat(parts[2]);
if (!isFinite(m) || !isFinite(d) || isNaN(m) || isNaN(d) || m <= 0 || d <= 0) {
  return "❌ Invalid budget. Format: `/budget monthly daily` (positive numbers).";
}
```

## L. shared/logger error 事件

```typescript
stream = fs.createWriteStream(DIAG_FILE, { flags: "a" });
stream.on("error", (err) => { console.error("[pa-diag] stream error:", err.message); });
```
