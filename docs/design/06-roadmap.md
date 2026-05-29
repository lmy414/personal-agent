# Personal Agent — 演进路线图

> 来源：2026-05-29 代码审计后更新

## 版本规划

| 版本 | 目标 | 关键改动 |
|------|------|----------|
| v0.5.4 | 安全加固 | 修复路径遍历、SQL 注入、`shell: true`、EPIPE 崩溃 |
| v0.5.5 | 配置治理 | settings.json 相对路径、package.json 补全 Electron、pa.bat 相对路径 |
| v0.6.0 | 架构解耦 | shared counter-engine、扩展表名前缀自治、systemPrompt Slot 化、pa-observe 去 mio 化 |
| v0.6.5 | 进程治理 | 移除全局 wgnr-pi 依赖、本地 vendor 独立端口、孤儿进程清零 |
| v0.7.0 | 扩展生态 | 扩展 unload hook、api.broadcast 前端通道、扩展市场清单格式 |

## 参考文档

| 文档 | 路径 | 内容 |
|------|------|------|
| 代码审计报告 | `../audit/00-summary.md` | 全项目安全与架构审计 |
| 扩展开发手册 | `../handbook/00-principles.md` | 扩展开发规范与 API |
| 设计总览 | `00-overview.md` | 架构与数据流 |
| 扩展设计 | `01-extensions.md` | 6 个扩展示例 |
| 澪号 Harness | `02-mio-harness.md` | 9-Slot Prompt + 计数器 |
| 流水线透视 | `03-observe.md` | pa-observe 面板设计 |
| 扩展层债务 | `04-debt-extensions.md` | 扩展间耦合问题 |
| 系统层债务 | `05-debt-system.md` | 进程/配置/安全问题 |

## 原始文档归档

> 以下文档因超过 200 行已拆分为上述小文件，原始文件仍保留作为参考：

- `docs/DESIGN.md`（已拆分为 `design/*.md`）
- `docs/EXTENSION-HANDBOOK.md`（已拆分为 `handbook/*.md`）
- `docs/audit-report-2026-05-29.md`（已拆分为 `audit/*.md`）
- `docs/SESSION-STATE.md`（已拆分为 `state/*.md`）
