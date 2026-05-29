# 代码审计修复代码：main.js / pa.bat / package.json / settings.json

## A. main.js 修复

### A.1 独立日志流 + 优雅关闭（修复 EPIPE + FD 泄漏）

替换第 21–24 行和第 72 行及退出逻辑：

```javascript
const outLog = path.join(LOG_DIR, `pa-main-out-${Date.now()}.log`);
const errLog = path.join(LOG_DIR, `pa-main-err-${Date.now()}.log`);
const outStream = fs.createWriteStream(outLog, { flags: "a" });
const errStream = fs.createWriteStream(errLog, { flags: "a" });

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  outStream.write(line + "\n", (e) => { if (e) console.error("outStream write error:", e.message); });
}
function logErr(msg) {
  const line = `[${new Date().toISOString()}] ERROR: ${msg}`;
  console.error(line);
  errStream.write(line + "\n", (e) => { if (e) console.error("errStream write error:", e.message); });
}

// spawn 配置
serverProc = spawn(process.execPath, [serverScript], {
  cwd: __dirname,
  env: { ...process.env, WGPI_CWD: __dirname, WGPI_PORT: String(PORT), WGPI_PI_BIN: "pi-node.cmd" },
  stdio: ["pipe", outStream, errStream],
  shell: false,
  windowsHide: true,
});

// before-quit
app.on("before-quit", async () => {
  isQuitting = true;
  if (serverProc && !serverProc.killed) {
    serverProc.kill();
    await Promise.race([new Promise((r) => serverProc.once("close", r)), new Promise((r) => setTimeout(r, 3000))]);
  }
  outStream.end();
  errStream.end();
  await Promise.race([new Promise((r) => outStream.once("finish", r)), new Promise((r) => setTimeout(r, 2000))]);
});
```

### A.2 `waitForServer` 防永久挂起（替换第 83–103 行）

```javascript
function waitForServer(retries = 50, interval = 500) {
  return new Promise((resolve, reject) => {
    let n = 0;
    const check = () => {
      if (serverProc && serverProc.exitCode != null) {
        return reject(new Error(`Server exited with code ${serverProc.exitCode}`));
      }
      const req = http.get(URL, { timeout: interval }, (res) => {
        if (res.statusCode === 200) resolve();
        else if (++n < retries) setTimeout(check, interval);
        else reject(new Error("Timeout waiting for server"));
      });
      req.on("error", () => { if (++n < retries) setTimeout(check, interval); else reject(new Error("Timeout")); });
      req.on("timeout", () => { req.destroy(); if (++n < retries) setTimeout(check, interval); else reject(new Error("Timeout")); });
    };
    check();
  });
}
```

### A.3 `killExistingPort` 安全化（替换第 40–54 行）

```javascript
const { execFileSync } = require("child_process");
function killExistingPort() {
  try {
    const out = execFileSync("cmd", ["/c", `netstat -ano | findstr :${PORT}`], { encoding: "utf8", timeout: 3000, windowsHide: true });
    const seen = new Set();
    for (const line of out.trim().split(/\r?\n/)) {
      const m = line.match(/\s+(\d+)\s*$/);
      if (m && !seen.has(m[1]) && /^\d+$/.test(m[1])) {
        seen.add(m[1]);
        try { execFileSync("taskkill", ["/PID", m[1], "/F", "/T"], { timeout: 3000, windowsHide: true }); log(`Killed PID ${m[1]}`); }
        catch (e) { logErr(`Failed to kill PID ${m[1]}: ${e.message}`); }
      }
    }
  } catch (e) { if (e.status !== 1) logErr("killExistingPort error: " + e.message); }
}
```

### A.4 `uncaughtException` 优雅退出 + 环境变量端口

```javascript
process.on("uncaughtException", (err) => {
  logErr(`UNCAUGHT: ${err.message}\n${err.stack}`);
  outStream?.end?.(); errStream?.end?.();
  if (serverProc && !serverProc.killed) serverProc.kill();
  setTimeout(() => process.exit(1), 500);
});

const PORT = parseInt(process.env.PA_PORT, 10) || 4815;
```

## B. pa.bat 修复

```bat
@echo off
cd /d "%~dp0"
where electron >nul 2>nul || (
  echo [ERROR] electron not found in PATH.
  echo Run: npm install -g electron
  pause
  exit /b 1
)
electron .
if errorlevel 1 pause
```

## C. package.json 修复

```json
{
  "devDependencies": { "electron": "^33.0.0" },
  "engines": { "node": ">=20.0.0" }
}
```

## D. .pi/settings.json 修复

改为相对路径：
```json
{
  "extensions": [
    "extensions/pa-sqlite/index.ts",
    "extensions/pa-usage/index.ts",
    "extensions/pa-files/index.ts",
    "extensions/pa-budget/index.ts",
    "extensions/pa-mio/index.ts",
    "extensions/pa-observe/index.ts"
  ],
  "skills": ["skills/personal-agent/agent.md"]
}
```

加载器使用 `path.resolve(settingsDir, relativeEntryPath)` 解析。
