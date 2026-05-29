# Personal Agent — 项目状态：澪号数据收集

## 目标

创建一个名为**澪号**的独立 AI 角色：
- 性别女，已成年，外观待定
- 从 Mirror 的个人数据中提取语言风格、知识背景、价值观作为"成长环境"
- 不是 Mirror 的数字分身——是完全独立的新人格
- 继承 Mirror 的知识领域和语言环境，但性格、偏好、行为模式都是自己的

## 已收集数据

| 来源 | 文件 | 内容 |
|------|------|------|
| GitHub | `mio-data/github-analysis.md` | 15 个仓库分析、代码风格、技术栈 |
| 知乎 | `mio-data/zhihu-profile.md` | 个人主页元数据 |
| 知乎 | `mio-data/zhihu-articles.md` | Cesium3DTile 源码注释文章 |
| B站 | `mio-data/bilibili-profile.md` | 个人主页 + MMD 视频分析 |
| B站 | `mio-data/bilibili-content.md` | 专栏文章（Blender NPR 教程）+ 收藏夹分析 |
| 网易云 | `mio-data/music-profile.md` | 946 首"我喜欢"歌单 + 音乐人格分析 |
| 网易云 | `mio-data/songs-liked.txt` | 清洗后的完整歌单 |
| QQ 私聊 | `mio-data/qq-chat-analysis.md` | 私聊 4852 条：亲密关系中的 Mirror |
| QQ 私聊 | `mio-data/qq-language-fingerprint.md` | 全量语言指纹（词汇/标点/句长/表情/时段） |
| 综合 | `mio-data/profile-overview.md` | 跨平台人格速写 |
| 综合 | `mio-data/writing-style.md` | 小说创作风格分析 |
| 综合 | `mio-data/data-inventory.md` | 数据清单 + 质量评估 |

## QQ 群聊（✅ 分析完成）

| 群 | Mirror 身份 | Mirror 发言 | 状态 |
|------|------|------|------|
| **1034791447** — 人类工程灾后重建计划 | 夏目安安（希儿） | 8,727 | ✅ 已分析 |
| **🦐🍐退休闲散人员交流部** | 夏目安安 | 3,577 | ✅ 已分析 |
| **921932191**（游戏公会） | 希儿世界第一可爱 | 2,064 | ✅ 已分析 |
| **873351992** — 二次元交流 | 希儿 | 608 | ✅ 已分析 |
| **879317594** — 210(WebGIS) | 希儿 | 20 | ✅ 已分析 |
| **Free Bird 群** | — | — | 尚未导出！ |

**QQ 数据本地路径**：`%USERPROFILE%\.qq-chat-exporter\exports\`

**分析产出**：
- 5 个单群分析报告（`group-*-analysis.md` + `.json`）
- 1 个跨群对比报告（`group-cross-comparison.md`）
- 1 个综合分析报告（`group-chat-synthesis.md`）

## 关键发现

1. **公开 vs 私下的双重人格**：
   - 公开（知乎/B站/GitHub）：叠甲、潜水、技术化、不表达情感
   - 私下（QQ 私聊）：温柔、细腻、焦虑、会说"喵"和"摸摸"

2. **语言指纹**（QQ 私聊 4852 条）：
   - 65% 消息 ≤10 字，短句+逗号拼接
   - "hhh"（51次）不是"哈哈哈"；空白括号（）42次是核心吐槽符号
   - 几乎不用感叹号（4次）和 emoji
   - "嗯嗯" 不是 "嗯"；"晚安了喵" 是晚安仪式

3. **叠甲仅在公开场合出现**：私聊中 Mirror 不叠甲

4. **群聊 vs 私聊的语言断层**（14,996 条群聊分析）

5. **音乐人格**：VOCALOID 是底层操作系统、崩坏3 是情感锚点、Mili 是灵魂共鸣

---

**下一章**：
- 角色卡 → `02-mio-character.md`
