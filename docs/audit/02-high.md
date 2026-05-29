# 代码审计：中危问题（20 项）

| # | 模块 | 问题 | 位置 | 状态 |
|---|------|------|------|------|
| 1 | `main.js` | `waitForServer` Promise 可能永久挂起（超时未 reject） | 第 83–103 行 | ⬜ 待修复 |
| 2 | `main.js` | `killExistingPort` 使用裸 `execSync` 拼接系统命令，且完全不可移植 | 第 40–54 行 | ✅ 已修复（`5c89472`） |
| 3 | `main.js` | 子进程退出未与 Electron 生命周期同步，强制 kill 可能损坏数据 | 第 192 行 | ✅ 已修复（`8e99013`） |
| 4 | `vendor/wgnr-pi` | `sendRpc` 未处理 `EPIPE`，抛出未捕获异常导致进程崩溃 | 第 544 行 | ✅ 已修复（`780a7e7`） |
| 5 | `vendor/wgnr-pi` | 无限快速重启：pi 崩溃后每 3 秒无限制重启，无退避策略 | 第 530–537 行 | ⬜ 待修复 |
| 6 | `vendor/wgnr-pi` | `/api/restart` 与 `close` 事件竞态，可能双开 pi 进程 | 第 281–297 行 | ⬜ 待修复 |
| 7 | `vendor/wgnr-pi` | `CWD` 回退依赖 `process.env.HOME`，Windows cmd 下常为 `undefined` | 第 22–23 行 | ⬜ 待修复 |
| 8 | `extensions/pa-files` | `resolveSafe()` 在 Windows 上大小写敏感，存在路径分隔符绕过 | 第 15–23 行 | ✅ 已修复（`11ba561`） |
| 9 | `extensions/pa-files` | 二进制文件被强制 UTF-8 读取，大文件可导致内存耗尽 | 第 68–80 行 | ✅ 已修复（`11ba561`） |
| 10 | `extensions/pa-files` | 可执行扩展名黑名单不完整（缺 `.bat` `.cmd` `.ps1` `.vbs` `.js` `.scr` 等） | 第 76 行 | ✅ 已修复（`11ba561`） |
| 11 | `extensions/pa-mio` | `JSON.stringify(msg.content)` 遇循环引用直接抛错崩溃 | 第 209–210 行 | ⬜ 待修复 |
| 12 | `extensions/pa-sqlite` | `session_id` 缺失时 DB 已创建但未关闭，连接泄漏 | 第 83–86 行 | ⬜ 待修复 |
| 13 | `extensions/pa-budget` | `parseFloat` 可接受 `Infinity`，预算可被设为无穷大 | 第 84–86 行 | ⬜ 待修复 |
| 14 | `extensions/shared/logger` | `fs.createWriteStream` 未监听 `error` 事件，磁盘满/权限错误可能引发未捕获异常 | 第 30–31 行 | ⬜ 待修复 |
| 15 | `mio-harness/bridge.py` | 仅重定向 `stdout` 为 UTF-8，未重定向 `stdin`，Windows 下中文乱码 | 第 4 行 | ⬜ 待修复 |
| 16 | `mio-harness/bridge.py` | 命令行参数 `int()` 无异常防护，传入非数字直接崩溃 | 第 22 行 | ⬜ 待修复 |
| 17 | `mio-harness/bridge.py` | API 响应直接 `r.json()["choices"][0]...` 无结构校验，KeyError/IndexError 直接崩溃 | 第 70 行 | ⬜ 待修复 |
| 18 | `mio-harness/memory.py` | 数据库目录未预创建，首次运行直接 `OperationalError` | 第 8、12 行 | ✅ 已修复（`f9833b1`） |
| 19 | `mio-harness/memory.py` | 多处 `sqlite3.connect()` 未使用 `with` 语句，异常时连接泄漏 | 第 12、37、53、75 行 | ⬜ 待修复 |
| 20 | `mio-harness/harness.py` | 初始化读取字符文件无容错，任一文件缺失则整个 Harness 无法启动 | 第 18–35 行 | ⬜ 待修复 |

> 已修复 6 项，待修复 14 项

---

**修复代码参考**：
- main.js / pa.bat / package / settings → `04-fix-main.md`
- vendor/wgnr-pi → `05-fix-vendor.md`
- 扩展 → `06-fix-extensions.md`
- Python → `07-fix-python.md`
