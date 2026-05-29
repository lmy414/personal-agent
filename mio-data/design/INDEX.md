# mio-data/design/ — 设计文档索引

> 本目录存放澪号角色系统的设计档案。超过 200 行的文档已保留原文件，本索引提供摘要和按需阅读引导。

## 快速导航

| 文档 | 行数 | 主题 | 按需读取场景 |
|------|------|------|-------------|
| `mio-design-simple.md` | 123 | 简化版整体设计 | 快速了解全貌 |
| `mio-system-prompt.md` | 77 | 系统提示词结构 | 了解 Prompt 组成 |
| `identity-vs-tools.md` | 163 | 身份与工具优先级 | 理解 Slot 0 元指令设计 |
| `audit-2026-05-27.md` | 202 | 前期架构审计 | 了解设计决策背景 |
| `agent-architecture-report.md` | 288 | Agent 架构调研报告 | 调研 SillyTavern/OpenClaw/Mem0 |
| `phased-injection-analysis.md` | 287 | 分阶段注入架构分析 | 三阶段注入模型 |
| `injection-implementation-comparison.md` | 297 | 三套注入方案对比 | 方案 A/B/C 落地对比 |
| `mio-architecture-design.md` | 295 | 系统架构设计 | 文件层 + SQLite + Pi 框架映射 |
| `mio-harness-design.md` | 288 | Harness 五层架构 | Harness Engineering 映射 |
| `skill-prompts-design.md` | 348 | Skill 提示词设计 | agent.md + 知识 Skill 结构 |
| `mio-implementation-blueprint.md` | 589 | 完整落地设计 | 实现细节 + 代码架构 |

## 按主题阅读路线

### 路线 A：快速入门（10 分钟）
1. `mio-design-simple.md` — 整体架构一句话总结
2. `mio-system-prompt.md` — 9-Slot 注入顺序
3. `identity-vs-tools.md` — 为什么身份 > 工具

### 路线 B：架构深度（30 分钟）
1. `agent-architecture-report.md` — 业界方案调研
2. `phased-injection-analysis.md` — 三阶段注入模型
3. `injection-implementation-comparison.md` — 方案对比与选择
4. `mio-architecture-design.md` — 系统架构映射

### 路线 C：实现细节（60 分钟）
1. `mio-harness-design.md` — Harness 五层架构
2. `skill-prompts-design.md` — Skill 文件结构
3. `mio-implementation-blueprint.md` — 完整落地蓝图

## 关联文件

- 角色卡 → `../character-v1.md`
- 扩展实现 → `../../extensions/pa-mio/index.ts`
- 角色文件 → `../../mio-harness/character/`
- 设计总览 → `../../docs/design/02-mio-harness.md`
