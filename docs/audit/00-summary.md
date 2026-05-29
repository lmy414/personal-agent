# Personal Agent — 代码审计报告：执行摘要

> 审计日期：2026-05-29  
> 审计范围：`main.js`、`pa.bat`、`package.json`、`.pi/settings.json`、`vendor/wgnr-pi/server.js`、全部 TypeScript 扩展（`pa-*`、`shared`）、`mio-harness` Python 模块  
> 运行平台：Windows

## 统计

| 等级 | 数量 | 说明 |
|------|------|------|
| 严重 | 11 | 需立即修复，含安全漏洞和崩溃风险 |
| 中危 | 20 | 尽快修复，含资源泄漏和逻辑缺陷 |
| 轻微 | 15 | 建议优化，含代码风格和可维护性问题 |

## 关键运维发现（优先处理）

`.personal-agent/wgnr-pi-crash.log` 揭示的不仅是 `EPIPE` 本身，还暴露了一个**运维层面的严重不一致**：

- `main.js` 明确启动的是 `./vendor/wgnr-pi/server.js`
- 但崩溃堆栈显示实际运行的是全局 npm 目录下的 `wgnr-pi/server.js`（`C:/Users/Mirror/AppData/Roaming/npm/node_modules/wgnr-pi/server.js`）

**这意味着本地 `vendor/wgnr-pi/` 中的任何安全修复或功能修改当前都不会生效。**

**建议**：
1. 卸载全局 `wgnr-pi`（`npm uninstall -g wgnr-pi`）
2. 或在 `main.js` 启动前通过 `wmic`/`tasklist` 检查并强制终止非本地路径的 `wgnr-pi` 进程
3. 或给本地实例使用非冲突端口，并在启动日志中自证实际加载的绝对路径

## 文档拆分

本报告已拆分为以下小文件（每份 < 200 行）：

- `01-critical.md` — 严重问题详情
- `02-high.md` — 中危问题详情
- `03-low.md` — 轻微问题详情
- `04-fix-main.md` — main.js / pa.bat / package.json / settings.json 修复代码
- `05-fix-vendor.md` — vendor/wgnr-pi/server.js 修复代码
- `06-fix-extensions.md` — 6 个 TypeScript 扩展修复代码
- `07-fix-python.md` — mio-harness Python 模块修复代码
- `08-checklist.md` — 快速验证清单
