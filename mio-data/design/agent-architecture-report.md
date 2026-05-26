# 澪号 — AI Agent 架构方案报告

> 2026-05-27 | 调研范围：2024-2026 年主流开源 Agent 系统提示词与记忆系统设计

---

## 一、系统提示词组成模式

当前业界有三套成熟范式，从轻到重：

### 方案 A：角色卡驱动（SillyTavern / CharaCard v2）

**结构**：单一 JSON/Markdown 文件，拆分为 7 个字段，运行时拼接注入 Prompt。

```
┌──────────────────────────────────────────┐
│  chat_history                             │
│  ┌──────────────────────────────────────┐ │
│  │ post_history_instructions            │ │ ← 角色行为修正（如角色漂移时注入）  │
│  ├──────────────────────────────────────┤ │
│  │ system_prompt (override)             │ │ ← 全局规则（可选）                │
│  ├──────────────────────────────────────┤ │
│  │ char_persona + description           │ │ ← 性格 + 背景（200-350 tokens）  │
│  ├──────────────────────────────────────┤ │
│  │ world_scenario + lorebook entries    │ │ ← 世界观 + 关键词触发的知识条目    │
│  ├──────────────────────────────────────┤ │
│  │ first_mes + example_dialogue         │ │ ← 开场白 + 对话示例（风格锚定）    │
│  └──────────────────────────────────────┘ │
│  ┌──────────────────────────────────────┐ │
│  │ user persona                         │ │ ← 用户身份定义                    │
│  └──────────────────────────────────────┘ │
└──────────────────────────────────────────┘
```

**适用**：角色扮演场景，需要固定人设不漂移。
**参考**：SillyTavern 社区，chara_card_v2 spec，CardProjector 3B/24B 模型。

### 方案 B：Soul Document（Claude / Anthropic）

**结构**：长篇叙事式系统提示词，不用字段拆分，而用"理解原则"替代"遵守规则"。

核心设计理念（来自 Claude Opus 4.5 Soul Document）：

> "Rather than outlining a simplified set of rules for Claude to adhere to, we want Claude to have such a thorough understanding of our goals, knowledge, circumstances, and reasoning that it could construct any rules we might come up with itself."

**组成部分**：
- 身份定义：不是工具，是"恰好有医生/律师/顾问知识的朋友"
- 诚实框架：7 维度（真实、校准、透明、坦率、非欺骗、非操纵、维护自主）
- 行为边界：四层信任层级（Anthropic > 操作者 > 用户 > 第三方内容）
- 灰色决策框架：贝叶斯式权衡因素 + "双重报纸测试"

**适用**：需要角色有内在判断力的场景——不是"遵守规则"而是"内化价值观"。

### 方案 C：Skill 文件系统（Pi / Memento-Skills / Claude Code）

**结构**：角色卡拆分到多个独立 Markdown 文件中，Agent 运行时按需加载。

```
agent.md（入口 Skill）
  ├── character-v1.md（角色卡）
  ├── skills/mio-chat.md（日常对话 Skill）
  ├── skills/mio-tech.md（技术讨论 Skill）
  ├── skills/mio-music.md（音乐推荐 Skill）
  └── memory/（记忆目录，按需加载）
       ├── MEMORY.md（记忆索引）
       ├── user-knowledge.md
       └── session-notes.md
```

**优势**：
- Memento-Skills 证明此方法在 General AI Assistants 上提升 26.2%，在 Humanity's Last Exam 上提升 116.2%
- Skill 文件本身成为持久记忆（不是一次性注入）
- 按需加载，不占用主提示词空间

**适用**：需要持续运行、动态加载知识、长期迭代的 Agent 角色。

---

## 二、记忆系统架构模式

### 三元组记忆（业界共识基线）

几乎所有 2025-2026 顶级方案都收敛到三层或四层：

```
┌────────────────────────────────────────────────────┐
│ Layer 1: Episodic（情节记忆）                        │
│ - 原始对话片段、关键上下文                              │
│ - 生命周期：数小时到数天                                │
│ - 存储：原始文本 + embedding + 时间戳                  │
│ - 代表项目：MemMachine（存完整episode，不做损失压缩）    │
├────────────────────────────────────────────────────┤
│ Layer 2: Semantic（语义记忆）                         │
│ - 从情节中提取的事实、决策、偏好                         │
│ - 生命周期：数周到数月                                  │
│ - 存储：结构化事实 + 冲突解决                           │
│ - 代表项目：LightMem（conflict resolution + knowledge  │
│             fusion，ICLR 2026 accepted）              │
├────────────────────────────────────────────────────┤
│ Layer 3: Identity / Profile（身份记忆）               │
│ - 角色定义、核心事实、长期偏好、行为约束                  │
│ - 生命周期：永久                                       │
│ - 存储：角色卡文件（即 character-v1.md）                │
│ - 代表项目：TriMem（progressive per-entity            │
│             profile builder, arXiv May 2026）        │
└────────────────────────────────────────────────────┘
```

**关键设计选择**：
- **存原始对话还是提取摘要？** MemMachine 证明存完整 episode 比损失性摘要效果好（93% LongMemEval-S）。但代价是存储更大、检索更贵。
- **存原子事实还是人物画像？** TriMem 提出了"渐进式画像构建"——从原子事实逐步聚合为人格画像，效果优于纯事实存储。

### 检索策略对比

| 策略 | 代表项目 | 核心思路 | 成本 |
|------|---------|---------|------|
| **搜索式检索** | Mem0, LightMem | Vector + BM25 + Graph traversal → RRF 融合 | 每次检索 1-3 个 API call |
| **推荐式关联** | Loom | 把记忆当作推荐问题而非搜索问题，目标是最小充分上下文 | 维持认知模型 |
| **程序式导航** | ReMEM | 模型写 JavaScript 遍历记忆，不是 dump 到上下文 | 499x 上下文压缩 |
| **权重内化** | MemoRable | 超网络 LoRA → 知识直接写入模型权重，O(1) 成本 | 需要 fine-tune 基础设施 |

### 记忆更新策略

- **离线批处理**（LightMem）：定时运行冲突解决和知识融合，非实时
- **重要性评分**（Mem0）：每条记忆有优先级，低优先级随时间衰减
- **人类审批门**（mneme）：长期事实变更需要 human approval
- **情节压缩**（ReMEM）：用 LLM 压缩多个 episode 为摘要，而非 TTL 淘汰

---

## 三、针对澪号的推荐方案

澪号的实际约束：
- 运行在 Pi v0.73.0 + DeepSeek API
- 已有 `mio-data/character-v1.md` 角色卡
- 已有 `skills/personal-agent/agent.md` Skill 文件
- SQLite 持久化（pa-sqlite 扩展）
- wgnr-pi Web UI

### 推荐组合：方案 C（Skill 文件）+ 轻量二层记忆

理由：
1. Pi 框架本身是 Skill 驱动，不需要也不应该改用 JSON 角色卡格式
2. 澪号不是纯角色扮演——她需要动态加载技术/音乐/创作知识，方案 C 天然适合
3. 二层记忆够用：澪号的"长期事实"已在角色卡文件中，不需要复杂的 graph DB。需要的是**会话记忆**。

### 具体架构

```
┌─────────────────────────────────────────────────────┐
│                每次对话的 Prompt 组装                   │
├─────────────────────────────────────────────────────┤
│  1. agent.md（Pi Skill 入口，定义"你是谁+怎么工作"）    │
│  2. character-v2.md（角色卡，升级到 v2.0）              │
│  3. 按需加载的 Skill 文件（mio-tech / mio-music 等）    │
│  4. 本次会话相关的记忆条目（SQLite → 前端加载）          │
├─────────────────────────────────────────────────────┤
│                 记忆系统（二层）                         │
├─────────────────────────────────────────────────────┤
│  Layer 1 — Session Memory（会话记忆）                  │
│  - 当前对话的原始上下文（Pi JSONL 已有）                 │
│  - 生命周期：单次会话                                   │
│  - 不需要额外开发，Pi 已内置                            │
├─────────────────────────────────────────────────────┤
│  Layer 2 — Semantic Memory（语义记忆）                 │
│  - 从会话中提取的关键事实 → SQLite                      │
│  - 生命周期：持久                                       │
│  - 实现：pa-sqlite 扩展 + 简单的事实提取 prompt          │
│  - 表结构：                                            │
│    - memories(id, content, category, importance,       │
│      source_session, created_at, updated_at)           │
│    - categories: user_fact / mio_preference /          │
│      conversation_milestone / technical_note           │
├─────────────────────────────────────────────────────┤
│                 知识文件（静态）                          │
├─────────────────────────────────────────────────────┤
│  character-v2.md  角色卡                               │
│  mio-music.md     音乐人格（独立 Skill）                │
│  mio-tech.md      技术领域知识                          │
│  mio-language.md  语言指纹参考                          │
└─────────────────────────────────────────────────────┘
```

### Skill 文件拆分建议

当前 `character-v1.md` 是一个 280 行的单体文件。建议拆分：

| 文件 | 内容 | 何时加载 |
|------|------|---------|
| `agent.md` | 入口 Skill：定义澪号的元指令 | 每次对话 |
| `character-core.md` | 性格 + 行为准则 + Mirror vs 澪号 | 每次对话 |
| `language-profile.md` | 语言指纹（句长/标点/亲密标记/通用标记） | 每次对话 |
| `knowledge-tech.md` | 技术领域（渲染/GIS/Blender） | 技术话题触发时 |
| `knowledge-music.md` | 音乐人格（VOCALOID/崩坏3/Mili） | 音乐话题触发时 |
| `knowledge-games.md` | 二次元手游 + 百合文学 | 相关话题触发时 |
| `memory/` 目录 | 用户事实 + 澪号偏好 + 会话里程碑 | 按关键词检索加载 |

### 记忆检索流程

```
用户输入 "你还记得我上次说的那个 Blender shader 问题吗"

1. QueryClassifier：判断 T1（需要检索记忆）
2. MemoryRouter：
   - 关键词匹配："Blender" → 触发 knowledge-tech.md 加载
   - 语义检索：SQLite 搜索 "Blender shader" → 返回相关记忆条目
3. Prompt Synthesizer：组装
   - agent.md + character-core.md + language-profile.md
   - knowledge-tech.md（按需）
   - 检索到的 2-3 条相关记忆
4. LLM 生成回答
5. 事后：提取本次对话的关键事实 → 写入 SQLite（离线）
```

### 与 Pi 框架的对接

Pi 的扩展系统已经提供了基础：
- `pa-sqlite` → 记忆存储（已有，只需加表）
- `pa-files` → Skill 文件管理（已有）
- 新增 `pa-mio` 扩展：
  - 对话后自动提取关键事实 (`extract_memories`)
  - 检索接口 (`search_memories`)
  - 记忆重要性评分和清理 (`memory_maintenance`)

---

## 四、Prompt 组装优先级（从高到低）

参考 Claude Soul Document 的层级设计：

```
Layer 1 — 不可违背的底线（宪章级）
├── 澪号永远不声称自己是人类
├── 澪号是 AI 角色，不是 Mirror 的数字分身
├── 不与用户进行浪漫/性角色扮演
└── 不确定时说"不确定"

Layer 2 — 身份与人格（高优先级，不可漂移）
├── 核心性格（外冷内热、技术自信、偶尔毒舌、低电量社交）
├── 语言风格（短句、括号吐槽、hhh/嗯嗯/摸摸仅在近人面前）
└── 知识领域边界（精通什么/熟悉什么/了解什么）

Layer 3 — 行为准则（中优先级，灵活执行）
├── 技术问题追到底
├── 给明确意见不叠甲
└── 累了就不聊

Layer 4 — 记忆与知识（低优先级，按需加载）
├── 用户事实（从对话中学习的）
├── 会话历史（本次对话）
└── 领域知识（渲染/GIS/音乐等）
```

---

## 五、业界参考速览

| 项目 | 核心贡献 | 对澪号的价值 |
|------|---------|------------|
| **Claude Soul Document** | 原则理解 > 规则遵守；7维诚实框架 | Prompt 组装层级设计 |
| **SillyTavern CharaCard v2** | 角色卡标准化；漂移检测+Author's Note 修正 | 语言风格锚定技巧 |
| **LightMem** (ICLR 2026) | 冲突解决+知识融合；MCP 协议支持 | 记忆更新策略（离线批处理） |
| **MemMachine** (2026.4) | 存完整episode不做损失压缩 | 记忆不丢失（93% 准确率） |
| **TriMem** (2026.5) | 渐进式画像构建 | 从事实→人格画像的方法 |
| **Memento-Skills** | Skill 文件即记忆；Agent 设计 Agent | 技能文件可自迭代 |
| **ReMEM** | 程序式记忆导航；499x 压缩 | 大规模记忆的检索思路 |
| **Pi + wgnr-pi** | 已有框架；扩展系统 | 澪号的实际运行时 |

---

## 六、实施路线

```
Phase 1（即刻）：
├── 拆分 character-v1.md → character-core + language-profile
├── 创建 agent.md 入口 Skill（参考 Claude Soul Document 层级）
└── 在 wgnr-pi 中手动测试

Phase 2（本周）：
├── 创建 knowledge-tech / knowledge-music / knowledge-games
├── pa-sqlite 加 memories 表
└── 设计记忆提取 prompt

Phase 3（下周起）：
├── 开发 pa-mio 扩展（自动提取+检索+清理）
├── 角色选择面板（wgnr-pi UI）
└── 长期运行 → 积累记忆 → 迭代角色卡
```
