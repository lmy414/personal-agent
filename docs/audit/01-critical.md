# 代码审计：严重问题（11 项）

> **修复状态**：全部 11 项已修复（2026-05-29）

## 1.1 EPIPE 崩溃 + 日志流混乱（`main.js`） ✅ 已修复

- **位置**：第 24、72 行
- **问题**：`stdio: ["pipe", logStream, logStream]` 将子进程 stdout/stderr 同时写入同一个 `fs.WriteStream`。当 Electron 退出或磁盘异常时，子进程继续写入触发 `EPIPE: broken pipe`——与日志中的崩溃完全一致。同时 `logStream` 全程不关闭，导致文件描述符泄漏。
- **修复**：stdout/stderr 分独立流 `outStream`/`errStream`；Electron 退出前显式 `end()` 并等待 `finish` 事件；为 `write` 添加 error callback；`uncaughtException` 中关闭流和子进程。
- **Commit**：`8e99013`

## 1.2 `shell: true` 命令注入与孤儿进程（`main.js` / `vendor/wgnr-pi/server.js`） ✅ 已修复

- **位置**：`main.js` 第 63–74 行；`vendor/wgnr-pi/server.js` 第 471–476 行
- **问题**：两处 `spawn` 均使用 `shell: true`。在 Windows 上这会经过 `cmd.exe` 解析，路径中的空格、`&`、`|`、`%` 可导致命令截断/注入。更致命的是 `SIGTERM` 只会杀掉 `cmd.exe`，真正的子进程会被孤儿化——直接解释了为何需要暴力清理端口。
- **修复**：两处均移除 `shell: true`，添加 `windowsHide: true`；`.cmd` 文件通过 `spawn("cmd", ["/c", ...])` 启动；`main.js` 的 `killExistingPort` 改用 `execFileSync`；`server.js` 新增 `killPiTree()` 用 `taskkill /T /F` 级联终止；`sendRpc` 加 EPIPE 防护。
- **Commit**：`780a7e7`、`0888312`（.cmd 修复）

## 1.3 SQL 注入（`extensions/pa-usage/index.ts`） ✅ 已修复

- **位置**：第 38–47 行
- **问题**：`getStats()` 将用户输入的 `period` 直接拼接到 SQL 字符串中。
- **修复**：改用白名单校验 + 静态 SQL map（`sqlByPeriod`），彻底拒绝字符串拼接。
- **Commit**：`6ae5494`

## 1.4 路径遍历——sessionId 直接拼接到文件路径（`extensions/pa-observe/index.ts`） ✅ 已修复

- **位置**：第 100–102 行
- **问题**：`traceKey()` 直接返回 `sessionId` 原值并拼接到文件路径。若 sessionId 为 `../../../Windows/evil`，可写入系统任意目录。
- **修复**：在 `traceKey()` 和 `/api/observe_trace` API 中添加 UUID 格式校验（`/^[0-9a-f]{8}-...-[0-9a-f]{12}$/i`），保留 sessionId → 文件名的直接映射以支持跨 session trace 恢复。
- **Commit**：`ea383d4`

## 1.5 路径遍历——Session API（`vendor/wgnr-pi/server.js`） ✅ 已修复

- **位置**：第 198–239 行
- **问题**：Session restore/archive/delete API 使用 `startsWith` 校验路径，可被 `..\` 或大小写绕过；`join(dirname(file), "..", basename(file))` 组合后 dest 可能跳出 sessions 目录。
- **修复**：新增 `assertSafePath()` 函数，使用 `path.resolve` + 大小写不敏感的 `startsWith` 校验，源路径和目标路径均验证。
- **Commit**：`7c5f529`

## 1.6 路径遍历——`observe_trace` API（`vendor/wgnr-pi/server.js`） ✅ 已修复

- **位置**：第 242–272 行
- **问题**：`/api/observe_trace?sessionId=../../any_file` 可直接读取任意 `.json` 文件，仅检查后缀和长度。
- **修复**：与 #1.4 一并修复，添加 UUID 格式校验，非 UUID 格式返回 400。
- **Commit**：`ea383d4`（与 #1.4 同一提交）

## 1.7 工作区根目录任意修改（`extensions/pa-files/index.ts`） ✅ 已修复

- **位置**：第 167–181 行
- **问题**：`/workspace` 命令允许用户将 `workspaceRoot` 设为任意目录，无任何白名单限制。一旦修改，`resolveSafe()` 的所有安全检查形同虚设。
- **修复**：新增 `ALLOWED_ROOTS` 白名单（`process.cwd()` + `~/Documents`）；`resolveSafe()` 改用 `path.resolve` + `path.relative` 校验；扩展二进制文件防护列表（增加 `.bat` `.cmd` `.ps1` 等）。
- **Commit**：`11ba561`

## 1.8 SQL 注入（`mio-harness/memory.py`） ✅ 已修复

- **位置**：第 49–50 行
- **问题**：`search_memories()` 使用 f-string 拼接 `LIKE` 子句和 `LIMIT`。
- **修复**：改用 `sqlite3` 参数化查询（`?` 占位符），`LIMIT` 也参数化并 clamp 到 [1, 100]；DB 路径改用 `os.path.expanduser` 替代 `expandvars`；`ensure_table()` 预创建目录。
- **Commit**：`f9833b1`

## 1.9 `pa.bat` 硬编码绝对路径 ✅ 已修复

- **位置**：第 2 行
- **问题**：`cd /d D:\claude\personal-agent` 锁定固定目录，项目移动即失效。
- **修复**：改为 `cd /d "%~dp0"`；添加 `where electron` 检查和错误提示；添加 `if errorlevel 1 pause`。
- **Commit**：`0c667ea`

## 1.10 `package.json` 缺少 Electron 依赖 ✅ 已修复

- **问题**：项目依赖全局 Electron，版本不可控，其他机器 `npm install` 后无法运行。
- **修复**：添加 `"devDependencies": { "electron": "^33.0.0" }` 和 `"engines": { "node": ">=20.0.0" }`。
- **Commit**：`0fc6634`

## 1.11 `.pi/settings.json` 全量硬编码绝对路径 ✅ 已修复

- **问题**：所有扩展/技能路径写死为 `D:/claude/personal-agent/...`，可移植性为零。
- **修复**：改为相对路径（如 `extensions/pa-sqlite/index.ts`），运行时基于 `settings.json` 所在目录解析为绝对路径。
- **Commit**：`4f73a38`

---

**额外修复**（修复过程中发现的问题）：

- `killExistingPort` 匹配系统进程：添加 `| findstr LISTENING` 过滤，跳过 PID ≤ 4，移除 `/T` 标志 — Commit `5c89472`

**修复代码参考**：
- main.js / pa.bat / package / settings → `04-fix-main.md`
- vendor/wgnr-pi → `05-fix-vendor.md`
- 扩展 → `06-fix-extensions.md`
- Python → `07-fix-python.md`
