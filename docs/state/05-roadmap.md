# Personal Agent — 项目状态：后续路线与文件索引

## 短期

- [x] 分析五个 QQ 群聊的 Mirror 发言 → 14,996条，7个产出文件 ✅
- [x] 更新澪号角色卡 v1.1（融入 QQ 私聊+群聊数据）✅
- [x] 创建 pa-mio 扩展（Harness 角色控制 + 记忆系统）✅
- [x] 澪号 System Prompt（Harness 注入管线）✅
- [x] wgnr-pi 历史工具渲染修复 ✅
- [x] 流水线透视面板（pa-observe + Debug 面板 UI） ✅
- [x] Windows 路径兼容性修复（新会话侧边栏消失） ✅
- [ ] 导出 Free Bird 群数据

## 中期

- [ ] wgnr-pi 角色选择面板
- [ ] 外观设计落实（163cm 灰发红瞳双马尾）
- [ ] Harness 自动重试闭环（计数器触发 → 修正 → 重新生成）
- [ ] 长时间运行验证（记忆膨胀、角色漂移、token 成本）

## 长期

- [ ] 记忆检索升级（SQLite → Vector）
- [ ] 多角色切换
- [ ] 澪号立绘/Live2D

## 常见重启命令

```bash
# 启动桌面应用
cd D:\claude\personal-agent && taskkill //F //IM electron.exe 2>&1; taskkill //F //IM node.exe 2>&1; sleep 2 && electron .

# 删除临时文件
rm D:/claude/personal-agent/qq_analyze.js D:/claude/personal-agent/qq_deep_analyze.js D:/claude/personal-agent/find_mirror.js D:/claude/personal-agent/group_identity.js 2>/dev/null
```

## 文件索引

| 文件 | 用途 |
|------|------|
| `README.md` | 项目说明 |
| `docs/ROADMAP.md` | 路线图 |
| `docs/DESIGN.md` | 设计文档（已拆分为 `design/*.md`） |
| `docs/PROJECT.md` | 项目总览 |
| `docs/TEST_CHECKLIST.md` | 测试清单 |
| `docs/SESSION-STATE.md` | 项目状态总览（本文件已拆分为 `state/*.md`） |
| `docs/audit-report-2026-05-29.md` | 代码审计（已拆分为 `audit/*.md`） |
| `docs/EXTENSION-HANDBOOK.md` | 扩展手册（已拆分为 `handbook/*.md`） |
| `pa.bat` | 一键启动 |
| `.pi/settings.json` | Pi 配置 |
| `main.js` | Electron 入口 |
| `extensions/pa-*/index.ts` | 6 个扩展 |
| `skills/personal-agent/agent.md` | Agent Skill |
| `mio-harness/character/` | 角色文件 |
| `mio-data/character-v1.md` | 澪号角色卡 v1.1 |
| `mio-data/analysis/` | 平台分析报告（10 个） |
| `mio-data/design/` | 设计文档档案（11 个） |
| `mio-data/groups/` | 群聊分析（5 群 + 跨群对比） |
| `~/.pi/agent/models.json` | DeepSeek 配置 |
| `~/.personal-agent/agent.db` | SQLite 数据库 |
| `~/.personal-agent/mio_memories.json` | 澪号记忆存储 |
