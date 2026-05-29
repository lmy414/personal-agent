# 代码审计：严重问题（11 项）

## 1.1 EPIPE 崩溃 + 日志流混乱（`main.js`）

- **位置**：第 24、72 行
- **问题**：`stdio: ["pipe", logStream, logStream]` 将子进程 stdout/stderr 同时写入同一个 `fs.WriteStream`。当 Electron 退出或磁盘异常时，子进程继续写入触发 `EPIPE: broken pipe`——与日志中的崩溃完全一致。同时 `logStream` 全程不关闭，导致文件描述符泄漏。
- **修复**：stdout/stderr 分独立流；Electron 退出前显式 `end()` 并等待 `finish` 事件；为 `write` 添加 error callback。

## 1.2 `shell: true` 命令注入与孤儿进程（`main.js` / `vendor/wgnr-pi/server.js`）

- **位置**：`main.js` 第 63–74 行；`vendor/wgnr-pi/server.js` 第 471–476 行
- **问题**：两处 `spawn` 均使用 `shell: true`。在 Windows 上这会经过 `cmd.exe` 解析，路径中的空格、`&`、`|`、`%` 可导致命令截断/注入。更致命的是 `SIGTERM` 只会杀掉 `cmd.exe`，真正的子进程会被孤儿化——直接解释了为何需要暴力清理端口。
- **修复**：两处均移除 `shell: true`；Windows 下用 `taskkill /T /F` 级联终止子进程树；添加 `windowsHide: true`。

## 1.3 SQL 注入（`extensions/pa-usage/index.ts`）

- **位置**：第 38–47 行
- **问题**：`getStats()` 将用户输入的 `period` 直接拼接到 SQL 字符串中。
- **修复**：改用参数化分支查询，彻底拒绝字符串拼接。

## 1.4 路径遍历——sessionId 直接拼接到文件路径（`extensions/pa-observe/index.ts`）

- **位置**：第 100–102 行
- **问题**：`traceKey()` 直接返回 `sessionId` 原值并拼接到文件路径。若 sessionId 为 `../../../Windows/evil`，可写入系统任意目录。
- **修复**：对 sessionId 做 `sha256` 哈希后再作为文件名。

## 1.5 路径遍历——Session API（`vendor/wgnr-pi/server.js`）

- **位置**：第 198–239 行
- **问题**：Session restore/archive/delete API 使用 `startsWith` 校验路径，可被 `..\` 或大小写绕过；`join(dirname(file), "..", basename(file))` 组合后 dest 可能跳出 sessions 目录。
- **修复**：统一使用 `path.resolve` + 大小写不敏感的 `startsWith` 校验。

## 1.6 路径遍历——`observe_trace` API（`vendor/wgnr-pi/server.js`）

- **位置**：第 242–272 行
- **问题**：`/api/observe_trace?sessionId=../../any_file` 可直接读取任意 `.json` 文件，仅检查后缀和长度。
- **修复**：`sessionId` 使用 `^[a-zA-Z0-9_-]+$` 白名单限制。

## 1.7 工作区根目录任意修改（`extensions/pa-files/index.ts`）

- **位置**：第 167–181 行
- **问题**：`/workspace` 命令允许用户将 `workspaceRoot` 设为任意目录，无任何白名单限制。一旦修改，`resolveSafe()` 的所有安全检查形同虚设。
- **修复**：禁止运行时修改，或限制在预定白名单目录内。

## 1.8 SQL 注入（`mio-harness/memory.py`）

- **位置**：第 49–50 行
- **问题**：`search_memories()` 使用 f-string 拼接 `LIKE` 子句和 `LIMIT`。
- **修复**：改用 `sqlite3` 参数化查询，`?` 占位符。

## 1.9 `pa.bat` 硬编码绝对路径

- **位置**：第 2 行
- **问题**：`cd /d D:\claude\personal-agent` 锁定固定目录，项目移动即失效。
- **修复**：改为 `cd /d "%~dp0"`。

## 1.10 `package.json` 缺少 Electron 依赖

- **问题**：项目依赖全局 Electron，版本不可控，其他机器 `npm install` 后无法运行。
- **修复**：添加 `"devDependencies": { "electron": "^x.y.z" }`。

## 1.11 `.pi/settings.json` 全量硬编码绝对路径

- **问题**：所有扩展/技能路径写死为 `D:/claude/personal-agent/...`，可移植性为零。
- **修复**：使用相对路径，运行时基于 `settings.json` 所在目录解析为绝对路径。

---

**修复代码**：
- main.js / pa.bat / package / settings → `04-fix-main.md`
- vendor/wgnr-pi → `05-fix-vendor.md`
- 扩展 → `06-fix-extensions.md`
- Python → `07-fix-python.md`
