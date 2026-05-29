# Personal Agent 代码审计报告

> 审计日期：2026-05-29  
> 审计范围：`main.js`、`pa.bat`、`package.json`、`.pi/settings.json`、`vendor/wgnr-pi/server.js`、全部 TypeScript 扩展（`pa-*`、`shared`）、`mio-harness` Python 模块  
> 运行平台：Windows

---

## 0. 关键运维发现（优先处理）

`.personal-agent/wgnr-pi-crash.log` 揭示的不仅是 `EPIPE` 本身，还暴露了一个**运维层面的严重不一致**：

- `main.js` 明确启动的是 `./vendor/wgnr-pi/server.js`
- 但崩溃堆栈显示实际运行的是全局 npm 目录下的 `wgnr-pi/server.js`（`C:/Users/Mirror/AppData/Roaming/npm/node_modules/wgnr-pi/server.js`）

**这意味着本地 `vendor/wgnr-pi/` 中的任何安全修复或功能修改当前都不会生效。**

**建议**：
1. 卸载全局 `wgnr-pi`（`npm uninstall -g wgnr-pi`）
2. 或在 `main.js` 启动前通过 `wmic`/`tasklist` 检查并强制终止非本地路径的 `wgnr-pi` 进程
3. 或给本地实例使用非冲突端口，并在启动日志中自证实际加载的绝对路径

---

## 1. 严重问题（需立即修复）

### 1.1 EPIPE 崩溃 + 日志流混乱（`main.js`）

- **位置**：第 24、72 行
- **问题**：`stdio: ["pipe", logStream, logStream]` 将子进程 stdout/stderr 同时写入同一个 `fs.WriteStream`。当 Electron 退出或磁盘异常时，子进程继续写入触发 `EPIPE: broken pipe`——与日志中的崩溃完全一致。同时 `logStream` 全程不关闭，导致文件描述符泄漏。
- **修复**：stdout/stderr 分独立流；Electron 退出前显式 `end()` 并等待 `finish` 事件；为 `write` 添加 error callback。

### 1.2 `shell: true` 命令注入与孤儿进程（`main.js` / `vendor/wgnr-pi/server.js`）

- **位置**：`main.js` 第 63–74 行；`vendor/wgnr-pi/server.js` 第 471–476 行
- **问题**：两处 `spawn` 均使用 `shell: true`。在 Windows 上这会经过 `cmd.exe` 解析，路径中的空格、`&`、`|`、`%` 可导致命令截断/注入。更致命的是 `SIGTERM` 只会杀掉 `cmd.exe`，真正的子进程会被孤儿化——直接解释了为何需要暴力清理端口。
- **修复**：两处均移除 `shell: true`；Windows 下用 `taskkill /T /F` 级联终止子进程树；添加 `windowsHide: true`。

### 1.3 SQL 注入（`extensions/pa-usage/index.ts`）

- **位置**：第 38–47 行
- **问题**：`getStats()` 将用户输入的 `period` 直接拼接到 SQL 字符串中。
- **修复**：改用参数化分支查询，彻底拒绝字符串拼接。

### 1.4 路径遍历——sessionId 直接拼接到文件路径（`extensions/pa-observe/index.ts`）

- **位置**：第 100–102 行
- **问题**：`traceKey()` 直接返回 `sessionId` 原值并拼接到文件路径。若 sessionId 为 `../../../Windows/evil`，可写入系统任意目录。
- **修复**：对 sessionId 做 `sha256` 哈希后再作为文件名。

### 1.5 路径遍历——Session API（`vendor/wgnr-pi/server.js`）

- **位置**：第 198–239 行
- **问题**：Session restore/archive/delete API 使用 `startsWith` 校验路径，可被 `..\` 或大小写绕过；`join(dirname(file), "..", basename(file))` 组合后 dest 可能跳出 sessions 目录。
- **修复**：统一使用 `path.resolve` + 大小写不敏感的 `startsWith` 校验。

### 1.6 路径遍历——`observe_trace` API（`vendor/wgnr-pi/server.js`）

- **位置**：第 242–272 行
- **问题**：`/api/observe_trace?sessionId=../../any_file` 可直接读取任意 `.json` 文件，仅检查后缀和长度。
- **修复**：`sessionId` 使用 `^[a-zA-Z0-9_-]+$` 白名单限制。

### 1.7 工作区根目录任意修改（`extensions/pa-files/index.ts`）

- **位置**：第 167–181 行
- **问题**：`/workspace` 命令允许用户将 `workspaceRoot` 设为任意目录，无任何白名单限制。一旦修改，`resolveSafe()` 的所有安全检查形同虚设。
- **修复**：禁止运行时修改，或限制在预定白名单目录内。

### 1.8 SQL 注入（`mio-harness/memory.py`）

- **位置**：第 49–50 行
- **问题**：`search_memories()` 使用 f-string 拼接 `LIKE` 子句和 `LIMIT`。
- **修复**：改用 `sqlite3` 参数化查询，`?` 占位符。

### 1.9 `pa.bat` 硬编码绝对路径

- **位置**：第 2 行
- **问题**：`cd /d D:\claude\personal-agent` 锁定固定目录，项目移动即失效。
- **修复**：改为 `cd /d "%~dp0"`。

### 1.10 `package.json` 缺少 Electron 依赖

- **问题**：项目依赖全局 Electron，版本不可控，其他机器 `npm install` 后无法运行。
- **修复**：添加 `"devDependencies": { "electron": "^x.y.z" }`。

### 1.11 `.pi/settings.json` 全量硬编码绝对路径

- **问题**：所有扩展/技能路径写死为 `D:/claude/personal-agent/...`，可移植性为零。
- **修复**：使用相对路径，运行时基于 `settings.json` 所在目录解析为绝对路径。

---

## 2. 中危问题（尽快修复）

| # | 模块 | 问题 | 位置 |
|---|------|------|------|
| 1 | `main.js` | `waitForServer` Promise 可能永久挂起（超时未 reject） | 第 83–103 行 |
| 2 | `main.js` | `killExistingPort` 使用裸 `execSync` 拼接系统命令，且完全不可移植 | 第 40–54 行 |
| 3 | `main.js` | 子进程退出未与 Electron 生命周期同步，强制 kill 可能损坏数据 | 第 192 行 |
| 4 | `vendor/wgnr-pi` | `sendRpc` 未处理 `EPIPE`，抛出未捕获异常导致进程崩溃 | 第 544 行 |
| 5 | `vendor/wgnr-pi` | 无限快速重启：pi 崩溃后每 3 秒无限制重启，无退避策略 | 第 530–537 行 |
| 6 | `vendor/wgnr-pi` | `/api/restart` 与 `close` 事件竞态，可能双开 pi 进程 | 第 281–297 行 |
| 7 | `vendor/wgnr-pi` | `CWD` 回退依赖 `process.env.HOME`，Windows cmd 下常为 `undefined` | 第 22–23 行 |
| 8 | `extensions/pa-files` | `resolveSafe()` 在 Windows 上大小写敏感，存在路径分隔符绕过 | 第 15–23 行 |
| 9 | `extensions/pa-files` | 二进制文件被强制 UTF-8 读取，大文件可导致内存耗尽 | 第 68–80 行 |
| 10 | `extensions/pa-files` | 可执行扩展名黑名单不完整（缺 `.bat` `.cmd` `.ps1` `.vbs` `.js` `.scr` 等） | 第 76 行 |
| 11 | `extensions/pa-mio` | `JSON.stringify(msg.content)` 遇循环引用直接抛错崩溃 | 第 209–210 行 |
| 12 | `extensions/pa-sqlite` | `session_id` 缺失时 DB 已创建但未关闭，连接泄漏 | 第 83–86 行 |
| 13 | `extensions/pa-budget` | `parseFloat` 可接受 `Infinity`，预算可被设为无穷大 | 第 84–86 行 |
| 14 | `extensions/shared/logger` | `fs.createWriteStream` 未监听 `error` 事件，磁盘满/权限错误可能引发未捕获异常 | 第 30–31 行 |
| 15 | `mio-harness/bridge.py` | 仅重定向 `stdout` 为 UTF-8，未重定向 `stdin`，Windows 下中文乱码 | 第 4 行 |
| 16 | `mio-harness/bridge.py` | 命令行参数 `int()` 无异常防护，传入非数字直接崩溃 | 第 22 行 |
| 17 | `mio-harness/bridge.py` | API 响应直接 `r.json()["choices"][0]...` 无结构校验，KeyError/IndexError 直接崩溃 | 第 70 行 |
| 18 | `mio-harness/memory.py` | 数据库目录未预创建，首次运行直接 `OperationalError` | 第 8、12 行 |
| 19 | `mio-harness/memory.py` | 多处 `sqlite3.connect()` 未使用 `with` 语句，异常时连接泄漏 | 第 12、37、53、75 行 |
| 20 | `mio-harness/harness.py` | 初始化读取字符文件无容错，任一文件缺失则整个 Harness 无法启动 | 第 18–35 行 |

---

## 3. 轻微问题（建议优化）

| # | 模块 | 问题 |
|---|------|------|
| 1 | `main.js` | Tray 图标 `nativeImage.createEmpty()` 完全不可见 |
| 2 | `main.js` | 日志文件按 `Date.now()` 无限累积，无轮转清理 |
| 3 | `main.js` | `uncaughtException` 仅记录不退出，进程可能僵尸运行 |
| 4 | `main.js` | 服务器已 200 仍盲目延迟 1500ms |
| 5 | `main.js` | `PORT = 4815` 硬编码，不支持环境变量 |
| 6 | `extensions/*` | 大量空 `catch {}` 静默吞掉关键错误（权限拒绝、磁盘 I/O 等） |
| 7 | `extensions/*` | 滥用 `as any` / `as Record<string, any>`，运行时结构不符会崩溃 |
| 8 | `extensions/pa-mio` / `pa-files` | 硬编码 `D:/claude/personal-agent/...` 绝对路径 |
| 9 | `vendor/wgnr-pi` | 多处空 `catch {}`，损坏数据/权限错误被静默跳过 |
| 10 | `mio-harness/counters.py` | Emoji 正则 `☀-➿` 范围过宽，误判普通符号 |
| 11 | `mio-harness/memory.py` | CJK 正则仅覆盖 U+4E00–U+9FFF，Extension A 生僻字被过滤 |
| 12 | `mio-harness/harness.py` | 存在未使用的导入（`json`, `re`, `subprocess`） |
| 13 | `mio-harness/harness.py` | `language.md` 存在但代码未加载，配置漂移 |
| 14 | `mio-harness/test_counters.py` | `[{"role":"user"}] * 3` 产生同一 dict 引用 |
| 15 | `mio-harness/show_flow.py` | 模块导入时立即 `print(FLOW)` 且篡改 stdout，缺少 `if __name__ == "__main__"` |

---

## 4. 修复优先级建议

### P0（立即）
1. `main.js` 修复 `stdio` 双写同一流 + `shell: true` 问题（直接关联现有崩溃日志）
2. `pa.bat` 改为 `"%~dp0"`
3. `extensions/pa-usage` 修复 SQL 注入
4. `extensions/pa-observe` 修复 sessionId 路径遍历
5. `vendor/wgnr-pi/server.js` 修复 Session API 和 observe_trace 路径遍历
6. `mio-harness/memory.py` 修复 SQL 注入

### P1（本周内）
1. 解决全局 `wgnr-pi` 与本地 `vendor/wgnr-pi` 的运行时漂移
2. `vendor/wgnr-pi` 添加 EPIPE 防护和重启退避策略
3. `extensions/pa-files` 修复 `resolveSafe` 和 `/workspace` 命令
4. `package.json` 补全 Electron 依赖
5. `.pi/settings.json` 改为相对路径
6. `mio-harness` 修复 stdin 编码、DB 目录预创建、连接泄漏

### P2（近期）
1. 统一清理所有空 `catch {}`
2. 移除不必要的 `as any` 类型断言
3. 补充错误日志与运行时校验
4. 清理未使用导入与模块级副作用

---

## 附录：修复代码示例

> 以下代码可直接复制到对应文件中替换原有实现。

---

### A. `main.js` 修复

#### A.1 独立日志流 + 优雅关闭（修复 EPIPE + FD 泄漏）

```javascript
// 替换原有第 21-24 行
const LOG_DIR = path.join(os.homedir(), ".personal-agent", "logs");
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

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

// 替换原有第 72 行 spawn 配置
serverProc = spawn(process.execPath, [serverScript], {
  cwd: __dirname,
  env: {
    ...process.env,
    WGPI_CWD: __dirname,
    WGPI_PORT: String(PORT),
    WGPI_PI_BIN: "pi-node.cmd",
  },
  stdio: ["pipe", outStream, errStream],
  shell: false,        // 关闭 shell
  windowsHide: true,
});

// 在 app.on("before-quit") 中（替换原有第 190-193 行）
app.on("before-quit", async () => {
  isQuitting = true;
  if (serverProc && !serverProc.killed) {
    serverProc.kill();
    await Promise.race([
      new Promise((r) => serverProc.once("close", r)),
      new Promise((r) => setTimeout(r, 3000)),
    ]);
  }
  outStream.end();
  errStream.end();
  await Promise.race([
    new Promise((r) => outStream.once("finish", r)),
    new Promise((r) => setTimeout(r, 2000)),
  ]);
});
```

#### A.2 `waitForServer` 防永久挂起（替换第 83–103 行）

```javascript
function waitForServer(retries = 50, interval = 500) {
  return new Promise((resolve, reject) => {
    let n = 0;
    const check = () => {
      if (serverProc && serverProc.exitCode != null) {
        logErr(`Server exited prematurely (code ${serverProc.exitCode}), aborting wait`);
        return reject(new Error(`Server exited with code ${serverProc.exitCode}`));
      }
      const req = http.get(URL, { timeout: interval }, (res) => {
        if (res.statusCode === 200) {
          resolve();
        } else if (++n < retries) {
          setTimeout(check, interval);
        } else {
          reject(new Error("Server did not respond with 200 after " + retries + " retries"));
        }
      });
      req.on("error", () => {
        if (++n < retries) setTimeout(check, interval);
        else {
          logErr("Server did not start after " + retries + " retries");
          reject(new Error("Timeout waiting for server"));
        }
      });
      req.on("timeout", () => {
        req.destroy();
        if (++n < retries) setTimeout(check, interval);
        else reject(new Error("Timeout waiting for server"));
      });
    };
    check();
  });
}
```

#### A.3 `killExistingPort` 安全化（替换第 40–54 行）

```javascript
const { execFileSync } = require("child_process");

function killExistingPort() {
  try {
    const out = execFileSync("cmd", ["/c", `netstat -ano | findstr :${PORT}`], {
      encoding: "utf8",
      timeout: 3000,
      windowsHide: true,
    });
    const lines = out.trim().split(/\r?\n/);
    const seen = new Set();
    for (const line of lines) {
      const m = line.match(/\s+(\d+)\s*$/);
      if (m && !seen.has(m[1]) && /^\d+$/.test(m[1])) {
        seen.add(m[1]);
        try {
          execFileSync("taskkill", ["/PID", m[1], "/F", "/T"], { timeout: 3000, windowsHide: true });
          log(`Killed PID ${m[1]} holding port ${PORT}`);
        } catch (e) {
          logErr(`Failed to kill PID ${m[1]}: ${e.message}`);
        }
      }
    }
    if (seen.size > 0) log(`Cleaned up ${seen.size} process(es) holding port ${PORT}`);
  } catch (e) {
    // netstat 无结果时会抛错，属正常情况
    if (e.status !== 1) logErr("killExistingPort error: " + e.message);
  }
}
```

#### A.4 `uncaughtException` 优雅退出（替换第 36 行）

```javascript
process.on("uncaughtException", (err) => {
  logErr(`UNCAUGHT: ${err.message}\n${err.stack}`);
  outStream?.end?.();
  errStream?.end?.();
  if (serverProc && !serverProc.killed) serverProc.kill();
  setTimeout(() => process.exit(1), 500);
});
```

#### A.5 支持环境变量端口（替换第 12 行）

```javascript
const PORT = parseInt(process.env.PA_PORT, 10) || 4815;
```

---

### B. `pa.bat` 修复

替换原有内容：

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

---

### C. `package.json` 修复

在根 `package.json` 中添加：

```json
{
  "devDependencies": {
    "electron": "^33.0.0"
  },
  "engines": {
    "node": ">=20.0.0"
  }
}
```

> 将 `"^33.0.0"` 替换为你实际使用的 Electron 版本。

---

### D. `.pi/settings.json` 修复示例

原配置：
```json
{
  "extensions": ["D:/claude/personal-agent/extensions/pa-sqlite/index.ts"]
}
```

改为相对路径（由加载器解析）：
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
  "skills": [
    "skills/personal-agent/agent.md"
  ]
}
```

加载器端（wgnr-pi 或扩展加载逻辑）应使用：
```javascript
const path = require("path");
const settingsDir = path.dirname(settingsFilePath); // settings.json 所在目录
const resolved = path.resolve(settingsDir, relativeEntryPath);
// 校验 resolved 必须在项目根目录内
```

---

### E. `vendor/wgnr-pi/server.js` 修复

#### E.1 移除 `shell: true` + 级联终止 pi 进程（替换第 471–476 行附近）

```javascript
const { execSync } = require("child_process");

function killPiTree() {
  if (!piProc) return;
  if (process.platform === "win32") {
    try {
      execSync(`taskkill /PID ${piProc.pid} /T /F`, { timeout: 5000, windowsHide: true });
    } catch {}
  } else {
    piProc.kill("SIGTERM");
  }
}

// spawn 调用改为：
piProc = spawn(PI_BIN, ["--mode", "rpc"], {
  cwd: CWD,
  stdio: ["pipe", "pipe", "pipe"],
  env: { ...process.env },
  shell: false,
  windowsHide: true,
});
```

#### E.2 `sendRpc` EPIPE 防护（替换第 544 行附近）

```javascript
function sendRpc(command, params) {
  if (!piProc || piProc.killed) return;
  const id = `${++requestId}`;
  const msg = JSON.stringify({ id, type: command, ...params }) + "\n";
  try {
    piProc.stdin.write(msg, (err) => {
      if (err) console.error("[sendRpc] write error:", err.message);
    });
  } catch (err) {
    console.error("[sendRpc] sync write error:", err.message);
  }
}
```

#### E.3 Session API 路径安全校验（替换第 198–239 行相关逻辑）

```javascript
const path = require("path");

function assertSafePath(inputPath, baseDir) {
  const resolved = path.resolve(inputPath);
  const resolvedBase = path.resolve(baseDir);
  const isInside = process.platform === "win32"
    ? resolved.toLowerCase().startsWith(resolvedBase.toLowerCase())
    : resolved.startsWith(resolvedBase);
  if (!isInside || !inputPath.endsWith(".jsonl")) {
    throw new Error("Invalid path: outside sessions directory or bad extension");
  }
  return resolved;
}

// restore 端点示例
app.post("/api/sessions/restore", (req, res) => {
  try {
    const { file } = req.body || {};
    const sessionBaseDir = path.join(homedir(), ".pi", "agent", "sessions");
    const safeFile = assertSafePath(file, sessionBaseDir);
    // ... 后续操作
  } catch (e) {
    res.status(403).json({ error: e.message });
  }
});
```

#### E.4 `observe_trace` sessionId 白名单（替换第 242–272 行相关逻辑）

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

#### E.5 重启退避策略（替换第 530–537 行附近）

```javascript
let restartAttempts = 0;
const MAX_RESTARTS = 10;
const BASE_DELAY = 3000;

piProc.on("close", (code, signal) => {
  console.log(`→ pi exited (code ${code}, signal ${signal})`);
  piProc = null;
  busy = false;
  setPiHealth(false);
  broadcast({ type: "status", busy: false, connected: false });

  if (restartAttempts >= MAX_RESTARTS) {
    console.error("Max restart attempts reached. Stopping auto-restart.");
    broadcast({ type: "error", message: "Pi failed repeatedly. Manual restart required." });
    return;
  }
  const delay = Math.min(BASE_DELAY * Math.pow(2, restartAttempts), 60000);
  restartAttempts++;
  setTimeout(() => { if (!piProc) ensurePi(); }, delay);
});

function setPiHealth(connected) {
  if (connected) restartAttempts = 0;
  // ... 原有逻辑
}
```

#### E.6 `ensurePi` 竞态锁（替换第 466–468 行附近）

```javascript
let ensurePiPromise = null;

async function ensurePi() {
  if (ensurePiPromise) return ensurePiPromise;
  if (piProc && !piProc.killed) return;
  ensurePiPromise = doSpawnPi(); // 将原有 spawn 逻辑抽为 doSpawnPi
  try { await ensurePiPromise; } finally { ensurePiPromise = null; }
}
```

#### E.7 `CWD` 安全回退（替换第 22–23 行）

```javascript
const { homedir } = require("os");
const CWD = process.env.WGPI_CWD || homedir();
```

---

### F. `extensions/pa-usage/index.ts` 修复

#### F.1 SQL 注入修复（替换 `getStats`）

```typescript
function getStats(period: string) {
  if (period === "today") {
    return db.prepare(
      `SELECT date, SUM(prompt_tokens) AS prompt_tokens, SUM(completion_tokens) AS completion_tokens, SUM(cost) AS cost
       FROM usage_log WHERE date = date('now','localtime') ORDER BY date DESC`
    ).all() as Array<{ date: string; prompt_tokens: number; completion_tokens: number; cost: number }>;
  } else if (period === "week") {
    return db.prepare(
      `SELECT date, SUM(prompt_tokens) AS prompt_tokens, SUM(completion_tokens) AS completion_tokens, SUM(cost) AS cost
       FROM usage_log WHERE date >= date('now','-7 days','localtime') ORDER BY date DESC`
    ).all() as Array<{ date: string; prompt_tokens: number; completion_tokens: number; cost: number }>;
  } else if (period === "month") {
    return db.prepare(
      `SELECT date, SUM(prompt_tokens) AS prompt_tokens, SUM(completion_tokens) AS completion_tokens, SUM(cost) AS cost
       FROM usage_log WHERE date >= date('now','start of month','localtime') ORDER BY date DESC`
    ).all() as Array<{ date: string; prompt_tokens: number; completion_tokens: number; cost: number }>;
  }
  // 默认返回全部
  return db.prepare(
    `SELECT date, SUM(prompt_tokens) AS prompt_tokens, SUM(completion_tokens) AS completion_tokens, SUM(cost) AS cost
     FROM usage_log GROUP BY date ORDER BY date DESC`
  ).all() as Array<{ date: string; prompt_tokens: number; completion_tokens: number; cost: number }>;
}
```

---

### G. `extensions/pa-observe/index.ts` 修复

#### G.1 `traceKey` 哈希化（替换第 100–102 行）

```typescript
import crypto from "crypto";

function traceKey(sessionId: string): string {
  return crypto.createHash("sha256").update(sessionId).digest("hex").slice(0, 32);
}
```

---

### H. `extensions/pa-files/index.ts` 修复

#### H.1 `resolveSafe` 路径安全化（替换第 15–23 行）

```typescript
function resolveSafe(filePath: string): string | null {
  const target = path.resolve(workspaceRoot, filePath);
  const rel = path.relative(workspaceRoot, target);
  if (rel.startsWith("..") || path.isAbsolute(rel)) return null;
  return target;
}
```

#### H.2 `/workspace` 命令白名单限制（替换第 167–181 行）

```typescript
const ALLOWED_ROOTS = [
  process.cwd(),
  path.join(os.homedir(), "Documents"),
  path.join(os.homedir(), "Desktop"),
  "D:\\claude", // 保留向后兼容，实际应从配置读取
];

pi.onCommand("/workspace", async (_event, args) => {
  const trimmed = args.trim();
  if (!trimmed) return `Current workspace: ${workspaceRoot}`;
  const newRoot = path.resolve(trimmed);
  const allowed = ALLOWED_ROOTS.some((r) => {
    const rel = path.relative(r, newRoot);
    return !rel.startsWith("..") && !path.isAbsolute(rel);
  });
  if (!allowed) return `❌ Workspace root "${newRoot}" is not in the allowed list.`;
  workspaceRoot = newRoot;
  return `Workspace set to: ${workspaceRoot}`;
});
```

#### H.3 `previewFile` 二进制文件防护（替换第 68–80 行）

```typescript
function previewFile(filePath: string): string {
  const stat = fs.statSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const binaryExts = [
    ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".ico", ".webp",
    ".pdf", ".exe", ".dll", ".obj", ".bat", ".cmd", ".ps1",
    ".vbs", ".js", ".wsf", ".scr", ".com", ".msi", ".reg",
    ".zip", ".rar", ".7z", ".tar", ".gz",
  ];
  if (binaryExts.includes(ext) || stat.size > 10 * 1024 * 1024) {
    return `[Binary file: ${ext || "unknown"} — ${(stat.size / 1024).toFixed(1)} KB]`;
  }
  let content: string;
  try {
    content = fs.readFileSync(filePath, "utf-8");
  } catch (e) {
    return `❌ Failed to read file: ${e.message}`;
  }
  const lines = content.split("\n");
  if (lines.length > 100) {
    return lines.slice(0, 100).join("\n") + "\n\n... (truncated)";
  }
  return content;
}
```

---

### I. `extensions/pa-mio/index.ts` 修复

#### I.1 安全 JSON 序列化（替换第 209–210 行附近）

```typescript
function safeStringify(obj: unknown): string {
  try {
    return JSON.stringify(obj);
  } catch {
    return "[unserializable object]";
  }
}

// 使用处
const content = typeof msg.content === "string" ? msg.content : safeStringify(msg.content || "");
```

---

### J. `extensions/pa-sqlite/index.ts` 修复

#### J.1 `session_id` 缺失时关闭 DB（替换第 83–86 行）

```typescript
pi.on("session_start", async (_event, ctx) => {
  db = createDB();
  const sid = ctx.sessionManager.getSessionId();
  if (!sid) {
    db?.close();
    db = null;
    console.warn("[pa-sqlite] session_id missing, skipping");
    return;
  }
  // ... 原有逻辑
});
```

---

### K. `extensions/pa-budget/index.ts` 修复

#### K.1 `Infinity` 防护（替换第 84–86 行）

```typescript
const m = parseFloat(parts[1]);
const d = parseFloat(parts[2]);
if (!isFinite(m) || !isFinite(d) || isNaN(m) || isNaN(d) || m <= 0 || d <= 0) {
  return "❌ Invalid budget. Format: `/budget monthly daily` (positive numbers).";
}
```

---

### L. `extensions/shared/logger.ts` 修复

#### L.1 监听 `error` 事件（替换第 30–31 行）

```typescript
stream = fs.createWriteStream(DIAG_FILE, { flags: "a" });
stream.on("error", (err) => {
  console.error("[pa-diag] stream error:", err.message);
});
```

---

### M. `mio-harness/bridge.py` 修复

#### M.1 `stdin` UTF-8 重定向（插入到文件顶部 `import` 之后）

```python
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
sys.stdin  = io.TextIOWrapper(sys.stdin.buffer,  encoding="utf-8")
```

#### M.2 命令行参数安全转换（替换第 22 行）

```python
try:
    rounds = int(args[0]) if args else 0
except (ValueError, IndexError):
    rounds = 0
```

#### M.3 API 响应结构校验（替换第 70 行）

```python
data = r.json()
try:
    content = data["choices"][0]["message"]["content"]
except (KeyError, IndexError, TypeError) as e:
    raise RuntimeError(f"Unexpected API response structure: {data}") from e
return content
```

#### M.4 SQLite 写入异常捕获（替换第 74 行附近）

```python
try:
    insert_memories(facts)
    print(f"[pa-mio] 已提取 {len(facts)} 条记忆")
except Exception as e:
    print(f"[pa-mio] 记忆写入失败: {e}", file=sys.stderr)
```

---

### N. `mio-harness/memory.py` 修复

#### N.1 参数化查询（替换 `search_memories`）

```python
def search_memories(keywords, limit=10):
    limit = min(max(int(limit), 1), 100)
    if not keywords:
        return []
    like_params = [f"%{kw}%" for kw in keywords[:10]]
    like_clauses = " OR ".join("content LIKE ?" for _ in like_params)
    sql = f"""
        SELECT id, content, weight, created_at FROM mio_memories
        WHERE {like_clauses}
        ORDER BY weight DESC
        LIMIT ?
    """
    params = like_params + [limit]
    with sqlite3.connect(DB) as conn:
        rows = conn.execute(sql, params).fetchall()
    return [{"id": r[0], "content": r[1], "weight": r[2], "created_at": r[3]} for r in rows]
```

#### N.2 数据库目录预创建（文件顶部）

```python
import os
DB_DIR = os.path.join(os.path.expanduser("~"), ".personal-agent")
DB = os.path.join(DB_DIR, "agent.db")

def ensure_table():
    os.makedirs(DB_DIR, exist_ok=True)
    with sqlite3.connect(DB) as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS mio_memories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                content TEXT NOT NULL,
                weight REAL DEFAULT 1.0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        "")
```

#### N.3 统一使用 `with` 语句（所有 `sqlite3.connect` 调用处）

```python
# 原有：
# conn = sqlite3.connect(DB)
# ...
# conn.close()

# 改为：
with sqlite3.connect(DB) as conn:
    # ... 操作
# 退出 with 时自动 commit（正常退出）
```

#### N.4 CJK 正则扩展（替换第 88 行）

```python
def _extract_keywords(text):
    # 覆盖 CJK Unified Ideographs + Extension A
    clean = re.sub(r"[^\u4e00-\u9fff\u3400-\u4dbf]", "", text)
    return list(set(clean))
```

---

### O. `mio-harness/harness.py` 修复

#### O.1 字符文件读取容错（替换 `read` 函数）

```python
def read(path):
    try:
        with open(path, encoding="utf-8") as f:
            return f.read().strip()
    except (FileNotFoundError, PermissionError) as e:
        print(f"[pa-mio] Warning: failed to read {path}: {e}", file=sys.stderr)
        return ""
```

#### O.2 加载 `language.md`（替换第 29–34 行相关逻辑）

```python
"language_anchor": read(os.path.join(CHARS, "language.md")),
```

#### O.3 清理未使用导入

删除顶部的 `import json`、`import re`、`import subprocess` 以及未使用的 `from memory import count_memories`。

---

### P. `mio-harness/test_counters.py` 修复

#### P.1 避免 dict 引用共享（替换第 37、42 行）

```python
messages = [{"role": "user"} for _ in range(3)]
```

---

### Q. `mio-harness/show_flow.py` 修复

#### Q.1 添加主入口保护（替换文件末尾）

```python
if __name__ == "__main__":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
    print(FLOW)
```

---

## 附录：快速检查清单

修复后可按以下清单验证：

- [ ] `pa.bat` 能在任意目录下双击启动
- [ ] `npm install` 后无需全局 Electron 即可运行
- [ ] `.pi/settings.json` 使用相对路径，项目整体移动后扩展仍加载成功
- [ ] 终止 Electron 时子进程（wgnr-pi、pi-node）同步退出，无孤儿进程
- [ ] `vendor/wgnr-pi/server.js` 崩溃日志中的堆栈显示本地 vendor 路径而非全局 npm 路径
- [ ] `pa-usage /usage today` 等命令无法注入 SQL
- [ ] `pa-observe` 的 trace 文件名与用户输入的 sessionId 无直接对应关系
- [ ] `pa-files /workspace C:\Windows` 被白名单拒绝
- [ ] `pa-files /preview large.exe` 返回二进制提示而非尝试读取
- [ ] `mio-harness` 首次运行时自动创建 `~/.personal-agent/` 目录
- [ ] 向 `mio-harness` 发送中文消息无乱码
