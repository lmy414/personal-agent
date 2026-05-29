# Personal Agent — 代码审计报告：执行摘要

> 审计日期：2026-05-29  
> 审计范围：`main.js`、`pa.bat`、`package.json`、`.pi/settings.json`、`vendor/wgnr-pi/server.js`、全部 TypeScript 扩展（`pa-*`、`shared`）、`mio-harness` Python 模块  
> 运行平台：Windows

## 统计

| 等级 | 数量 | 已修复 | 待修复 | 说明 |
|------|------|--------|--------|------|
| 严重 | 11 | **11** | 0 | 全部已修复（2026-05-29） |
| 中危 | 20 | **6** | 14 | 随严重问题一并修复 6 项 |
| 轻微 | 15 | **2** | 13 | 随严重问题一并修复 2 项 |

## 修复记录（2026-05-29）

| Commit | 修复项 |
|--------|--------|
| `8e99013` | #1.1 EPIPE 崩溃 + 日志流混乱 |
| `780a7e7` | #1.2 shell:true 命令注入 + 孤儿进程 |
| `0888312` | .cmd 文件启动修复 |
| `6ae5494` | #1.3 SQL 注入（pa-usage） |
| `ea383d4` | #1.4 + #1.6 路径遍历（sessionId + observe_trace） |
| `7c5f529` | #1.5 路径遍历（Session API） |
| `11ba561` | #1.7 工作区根目录任意修改 |
| `f9833b1` | #1.8 SQL 注入（memory.py） |
| `0c667ea` | #1.9 pa.bat 硬编码路径 |
| `0fc6634` | #1.10 package.json 缺少 Electron 依赖 |
| `4f73a38` | #1.11 settings.json 硬编码路径 |
| `5c89472` | killExistingPort 匹配系统进程修复 |

## 关键运维发现（已解决）

`.personal-agent/wgnr-pi-crash.log` 揭示的不仅是 `EPIPE` 本身，还暴露了一个**运维层面的严重不一致**：

- `main.js` 明确启动的是 `./vendor/wgnr-pi/server.js`
- 但崩溃堆栈显示实际运行的是全局 npm 目录下的 `wgnr-pi/server.js`（`C:/Users/Mirror/AppData/Roaming/npm/node_modules/wgnr-pi/server.js`）

**这意味着本地 `vendor/wgnr-pi/` 中的任何安全修复或功能修改当前都不会生效。**

**已采取措施**：
1. 移除 `shell: true`，确保 spawn 直接启动本地 server.js
2. `.cmd` 文件通过 `spawn("cmd", ["/c", ...])` 启动
3. `killExistingPort` 改用 `execFileSync`，只匹配 LISTENING 状态，跳过系统进程

## 文档拆分

本报告已拆分为以下小文件（每份 < 200 行）：

- `01-critical.md` — 严重问题详情（✅ 全部已修复）
- `02-high.md` — 中危问题详情（6/20 已修复）
- `03-low.md` — 轻微问题详情（2/15 已修复）
- `04-fix-main.md` — main.js / pa.bat / package.json / settings.json 修复代码
- `05-fix-vendor.md` — vendor/wgnr-pi/server.js 修复代码
- `06-fix-extensions.md` — 6 个 TypeScript 扩展修复代码
- `07-fix-python.md` — mio-harness Python 模块修复代码
- `08-checklist.md` — 快速验证清单
