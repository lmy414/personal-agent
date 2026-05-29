# 澪号 — 数据档案 · GitHub 仓库分析

> 收集日期：2026-05-27
> 账号：lmy414 / 15 个仓库

## 仓库清单

| 仓库 | 语言 | 说明 | 活跃度 |
|------|------|------|--------|
| personal-agent | HTML/JS | Personal AI Agent，Electron → Pi 迁移 | 2026-05 |
| EmaoNovel-Noel | — | 诺艾尔 奇幻百合小说 | 2026-05 |
| EmaoKeyWord | Python | SEO 关键词发现工具，customtkinter GUI | 2026-05 |
| EmaoNovel | — | AI 驱动小说创作工作流 | 2026-05 |
| Noel | — | 异世界百合小说 | 2026-05 |
| MioYuri | — | 澪与佑莉 百合小说设定 | 2026-05 |
| Sela | — | 骑士与女仆 后宫 R18 设定 | 2026-05 |
| - | — | 空仓库 | 2026-05 |
| ImageTool | — | 个人用效率工具 | 2025-08 |
| E-MaoEngine | C++ | OpenGL 3D Tiles 渲染实现 | 2025-06 |
| Cesium- | JS | Cesium 相关项目 | 2025-06 |
| MMD_Helper | Python | Blender MMD 插件 | 2025-06 |
| Mirror | C++ | Mirror Engine 自研游戏引擎 | 2025-01 |
| air-quality | JS | 空气品质相关 | 2024-07 |
| demo | JS | 演示项目 | 2024-07 |

## 技术栈

| 领域 | 技术 | 水平判断 |
|------|------|----------|
| 3D 渲染 | OpenGL, GLM, GLFW, Assimp, 3D Tiles, GLB/B3DM 解析 | 中高级：自研引擎、手写解析器 |
| GUI | C++ ImGui, Python customtkinter | 熟练：非专业前端但够用 |
| 游戏工具 | Blender Python API, Unity C#/Shaders (推测) | 熟练 |
| AI 工具 | Electron, Pi Agent 框架, SQLite, WebSocket | 快速上手，实用导向 |
| 构建 | CMake, MSBuild, PyInstaller | 生产级别（注意 frozen 兼容） |

## 代码风格特征

- C++：`namespace Mirror {}` DLL 架构，中文注释，`cout`/`cerr` 调试而非 logger
- Python：函数式为主，顶部定义颜色常量，现代库（customtkinter, yaml, requests）
- 整体：实用主义、不过度工程化、先写对再优化
- 硬编码路径在开发阶段不避讳
- 注释语言：C++ 用中文，Python 用中文，小说直接用中文

## 项目模式

1. **自研引擎 → 止步 → 转向工具**：Mirror Engine 和 E-MaoEngine 都是 C++ 渲染项目，但更新停在 2025 年。2026 年重心转向 AI 工具和创作
2. **小说项目平铺**：Sela / Noel / MioYuri / EmaoNovel-Noel 四个 repo 都是创作项目，采用 Markdown 设定 + 文本并行的方式
3. **一个工具解决一个问题**：EmaoKeyWord 就是 SEO 关键词，ImageTool 就是图片处理，不搞大而全
