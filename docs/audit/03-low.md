# 代码审计：轻微问题（15 项）

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

**修复代码**：
- main.js / pa.bat / package / settings → `04-fix-main.md`
- vendor/wgnr-pi → `05-fix-vendor.md`
- 扩展 → `06-fix-extensions.md`
- Python → `07-fix-python.md`
