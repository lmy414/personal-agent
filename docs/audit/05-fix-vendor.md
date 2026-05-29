# 代码审计修复代码：vendor/wgnr-pi/server.js

## E.1 移除 `shell: true` + 级联终止 pi 进程

替换 spawn 调用：

```javascript
const { execSync } = require("child_process");

function killPiTree() {
  if (!piProc) return;
  if (process.platform === "win32") {
    try { execSync(`taskkill /PID ${piProc.pid} /T /F`, { timeout: 5000, windowsHide: true }); } catch {}
  } else {
    piProc.kill("SIGTERM");
  }
}

piProc = spawn(PI_BIN, ["--mode", "rpc"], {
  cwd: CWD,
  stdio: ["pipe", "pipe", "pipe"],
  env: { ...process.env },
  shell: false,
  windowsHide: true,
});
```

## E.2 `sendRpc` EPIPE 防护

```javascript
function sendRpc(command, params) {
  if (!piProc || piProc.killed) return;
  const id = `${++requestId}`;
  const msg = JSON.stringify({ id, type: command, ...params }) + "\n";
  try {
    piProc.stdin.write(msg, (err) => { if (err) console.error("[sendRpc] write error:", err.message); });
  } catch (err) { console.error("[sendRpc] sync write error:", err.message); }
}
```

## E.3 Session API 路径安全校验

```javascript
const path = require("path");
function assertSafePath(inputPath, baseDir) {
  const resolved = path.resolve(inputPath);
  const resolvedBase = path.resolve(baseDir);
  const isInside = process.platform === "win32"
    ? resolved.toLowerCase().startsWith(resolvedBase.toLowerCase())
    : resolved.startsWith(resolvedBase);
  if (!isInside || !inputPath.endsWith(".jsonl")) throw new Error("Invalid path");
  return resolved;
}
```

## E.4 `observe_trace` sessionId 白名单

```javascript
const SAFE_ID_RE = /^[a-zA-Z0-9_-]+$/;
app.get("/api/observe_trace", (req, res) => {
  const sid = req.query.sessionId;
  if (!sid || typeof sid !== "string" || !SAFE_ID_RE.test(sid)) {
    return res.status(400).json({ error: "Invalid sessionId" });
  }
  const sessionFile = path.join(paDir, "observe_traces", sid + ".json");
  // ... 后续读取
});
```

## E.5 重启退避策略

```javascript
let restartAttempts = 0;
const MAX_RESTARTS = 10;
const BASE_DELAY = 3000;

piProc.on("close", (code, signal) => {
  piProc = null; busy = false; setPiHealth(false);
  if (restartAttempts >= MAX_RESTARTS) {
    console.error("Max restart attempts reached.");
    broadcast({ type: "error", message: "Pi failed repeatedly." });
    return;
  }
  const delay = Math.min(BASE_DELAY * Math.pow(2, restartAttempts), 60000);
  restartAttempts++;
  setTimeout(() => { if (!piProc) ensurePi(); }, delay);
});

function setPiHealth(connected) { if (connected) restartAttempts = 0; /* ... */ }
```

## E.6 `ensurePi` 竞态锁

```javascript
let ensurePiPromise = null;
async function ensurePi() {
  if (ensurePiPromise) return ensurePiPromise;
  if (piProc && !piProc.killed) return;
  ensurePiPromise = doSpawnPi();
  try { await ensurePiPromise; } finally { ensurePiPromise = null; }
}
```

## E.7 `CWD` 安全回退

```javascript
const { homedir } = require("os");
const CWD = process.env.WGPI_CWD || homedir();
```
