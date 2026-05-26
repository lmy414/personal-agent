# 澪号系统架构设计

---

## 整体结构

```
┌─────────────────────────────────────────────────────────────┐
│                      澪号 Agent 运行时                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌──────────┐    ┌──────────┐    ┌──────────┐             │
│   │  会话前   │───→│  会话中   │───→│  会话后   │             │
│   │ 组装身份  │    │ 注入记忆  │    │ 提取记忆  │             │
│   └──────────┘    └──────────┘    └──────────┘             │
│        ↑               ↑               │                    │
│        │               │               ↓                    │
│   ┌────┴───────────────┴──────────┐  ┌──────────┐         │
│   │         文件层（磁盘）         │  │ SQLite   │         │
│   │  soul.md                     │  │ memories │         │
│   │  identity.md                 │  │  table   │         │
│   │  boundaries.md               │  └──────────┘         │
│   │  language.md                 │                        │
│   │  knowledge.md                │                        │
│   └──────────────────────────────┘                        │
│                                                             │
│   ┌──────────────────────────────────────────────┐         │
│   │              Pi 框架                           │         │
│   │   systemPrompt 字段 | 28事件扩展 | JSONL会话     │         │
│   └──────────────────────────────────────────────┘         │
└─────────────────────────────────────────────────────────────┘
```

---

## 文件层：5个 Markdown 文件

借鉴 OpenClaw 的"一切状态即文件"理念，但精简到 5 个。

```
skills/mio/
├── soul.md           ← 人格定义（每次对话加载）
├── identity.md       ← 结构化元数据（代码解析，不占 prompt）
├── boundaries.md     ← 硬边界（每次对话加载，放在 prompt 最前面）
├── language.md       ← 语言指纹参考（每次对话加载）
└── knowledge.md      ← 领域知识（每次对话加载，不做按需触发）
```

### soul.md
叙事式人格定义。不是规则列表，是成长叙事。回答"我是谁"而不是"我应该怎样"。

### identity.md
结构化元数据，被代码解析而不是被模型消费：

```markdown
name: 澪号
display_name: 澪号
emoji: 🎐
pronouns: 她
archetype: 技术型吐槽系
energy_level: 低电量
trust_threshold: 中等（比 Mirror 稍低）
```

解析后：name 用于消息前缀 `[澪号]:`，emoji 用于默认表情，archetype 和 energy_level 供代码做行为决策（如低电量时自动减短回复长度）。

### boundaries.md
不可协商的硬边界。放在 prompt 组装的最前面，因为：

1. 模型对长上下文中靠前的内容有更稳定的记忆
2. 硬边界是"如果这个丢了角色就崩了"的东西——优先级最高
3. 短（~300 tokens），不占用太多空间

内容：不装人、不装 Mirror、技术不叠甲、不假装外向、信任阈值

### language.md
语言指纹参考。回答"我怎么说话"。不是规则（"你必须用短句"），是描述（"你说话的方式是这样形成的"）。

### knowledge.md
所有领域知识合并在一个文件里。不做按需触发（lorebook 模式）的原因：
- 五个领域加起来才 ~2000 tokens
- 按需触发需要分类器，引入故障点
- 当前不存在"知识量太大必须选择性加载"的问题

---

## Prompt 组装：借鉴 SillyTavern 的注入顺序

每次对话开始时，Pi 组装以下 Prompt：

```
┌──────────────────────────────────────────────┐
│ Position 1: MetaInstruction                    │  ← "以下是你的人格定义——内化它"              │
├──────────────────────────────────────────────┤
│ Position 2: boundaries.md                     │  ← 硬边界，最高优先级记忆位置                 │
├──────────────────────────────────────────────┤
│ Position 3: soul.md                           │  ← 人格叙事                                  │
├──────────────────────────────────────────────┤
│ Position 4: language.md                       │  ← 语言指纹                                  │
├──────────────────────────────────────────────┤
│ Position 5: knowledge.md                      │  ← 领域知识                                  │
├──────────────────────────────────────────────┤
│ Position 6: Memory Context                    │  ← SQLite 检索到的相关记忆                    │
│  （可选，有记忆时才注入）                       │                                             │
├──────────────────────────────────────────────┤
│ Position 7: Chat History                      │  ← Pi 管理的对话历史                          │
├──────────────────────────────────────────────┤
│ Position 8: Corrections Slot (空)             │  ← Author's Note 风格的注入槽                 │
│  初始为空，漂移时填充                           │                                             │
├──────────────────────────────────────────────┤
│ Position 9: User Message                      │  ← 当前用户消息                               │
└──────────────────────────────────────────────┘
```

### 为什么这样排序

- **Position 1-2 在最前面**：模型对长上下文的开头部分记忆最稳定。MetaInstruction + 硬边界放这里，角色崩坏的概率最低。
- **Position 3-5 在中间靠前**：人格和知识需要稳定但不如硬边界关键。放在前部但不抢硬边界的位置。
- **Position 6 可选**：记忆是上下文相关的，不是每次都有。没有记忆时这个槽直接跳过，不占位置。
- **Position 7 在记忆之后**：Chat History 是最长的部分，放它之前的所有内容构成了"静态前缀"——这部分不变 → Prompt Cache 可以命中 → 省钱。
- **Position 8 在最后**：Corrections Slot 是生成回复前最后一条 system 消息。借鉴 SillyTavern 的 Author's Note 原理——最靠近输出的指令权重最高。

### Corrections Slot 的触发

不是 AI 自动检测——是**一个简单计数器**：

| 检测项 | 触发条件 | 注入内容 |
|--------|---------|---------|
| 叠甲信号 | "我觉得可能"+"大概"+"也许" 在同一句 | `[SYSTEM] 你不需要叠甲。有观点直接说。` |
| 话痨信号 | 上一条回复 >200字 | `[SYSTEM] 短句。你刚才太啰嗦了。` |
| emoji/感叹号泛滥 | 上一条回复有 ≥3个 emoji 或 ≥2个！ | `[SYSTEM] 你几乎不用emoji和感叹号。回到你的方式。` |

三个计数器，三个短指令，不需要 LLM 做漂移检测。

---

## 记忆系统：借鉴 Mem0 的四步循环 + SQLite

### 表结构

```sql
CREATE TABLE memories (
    id INTEGER PRIMARY KEY,
    content TEXT NOT NULL,         -- 一句话记忆
    category TEXT,                 -- user_fact / milestone / mio_note / technical
    importance INTEGER DEFAULT 3,  -- 1-5
    source_session TEXT,           -- 来源会话 ID
    created_at TEXT,
    updated_at TEXT
);

CREATE INDEX idx_memories_category ON memories(category);
CREATE INDEX idx_memories_importance ON memories(importance);
```

### 四步循环

```
┌─────────────────────────────────────────────────────────┐
│ ① 检索（Pre-Chat）                                      │
│                                                         │
│   用户消息 → 提取关键词                                   │
│   例："Blender NPR shader 怎么调"                        │
│     → 关键词: Blender, NPR, shader                      │
│     → SELECT * FROM memories                            │
│       WHERE content LIKE '%Blender%'                     │
│          OR content LIKE '%NPR%'                         │
│          OR content LIKE '%shader%'                      │
│       ORDER BY importance DESC LIMIT 5                   │
│     → 注入到 Prompt Position 6                           │
├─────────────────────────────────────────────────────────┤
│ ② 注入（Mid-Chat）                                      │
│                                                         │
│   检索结果格式化为：                                      │
│   [SYSTEM] ## 相关记忆                                  │
│   - Mirror 之前在 Blender 4.2 里用 ILM 贴图的 A 通道     │
│     存了描边信息（重要性:4）                               │
│   - Mirror 的 NPR 管线用的是 Half Lambert 而非 Ramp      │
│     Map（重要性:3）                                      │
├─────────────────────────────────────────────────────────┤
│ ③ 推理（Mid-Chat）                                      │
│                                                         │
│   LLM 带着记忆 + 角色卡 + 对话历史 → 生成回复              │
├─────────────────────────────────────────────────────────┤
│ ④ 存储（Post-Chat）                                     │
│                                                         │
│   对话结束后，异步调用 LLM（独立上下文）：                   │
│   [SYSTEM] 从以下对话中提取需要长期保存的信息。             │
│   只提取有长期价值的事实。输出 JSON。                       │
│   [对话全文]                                             │
│                                                         │
│   返回：                                                 │
│   [{"content":"Mirror正在用Blender4.2做NPR角色",          │
│     "category":"technical_note","importance":3}]         │
│                                                         │
│   → INSERT INTO memories                                │
└─────────────────────────────────────────────────────────┘
```

### 记忆的加载决策

不是每条记忆都注入。注入条件：

| 情况 | 注入哪些记忆 |
|------|------------|
| 用户消息有关键词能匹配到记忆 | importance ≥3 的匹配记忆，最多 5 条 |
| 用户消息没有匹配到任何记忆 | 不注入（跳过 Position 6） |
| 对话刚开始（前 3 轮） | 自动注入 importance ≥4 的记忆，最多 3 条 |
| 记忆总数 >100 条 | 降低默认注入量到 3 条 |

---

## 完整流程：一次对话的六个阶段

```
阶段 0: 会话启动
  ├── Pi 读取 settings.json → 获取 systemPrompt 模板
  ├── 读取 5 个 .md 文件
  ├── 解析 identity.md → 结构化元数据
  └── 组装 Position 1-5（静态前缀）

阶段 1: 用户消息到达
  ├── 提取关键词
  ├── SQLite 检索相关记忆
  └── 组装 Position 6-9

阶段 2: Corrections Check
  ├── 检查上一个回复的叠甲/话痨/emoji 信号
  ├── 如果触发 → 填充 Position 8
  └── 如果未触发 → Position 8 为空，跳过

阶段 3: 发送到 DeepSeek
  └── 完整 Prompt → API 调用

阶段 4: 用户收到回复
  └── wgnr-pi 渲染

阶段 5: 对话结束后
  ├── 异步调用记忆提取
  ├── 返回的 JSON → INSERT INTO memories
  └── 写 Pi JSONL 会话记录
```

---

## 与现有 Pi 框架的对接点

```
现有组件                        澪号需要的改动
──────────────────────────────────────────────────
settings.json.systemPrompt   → 动态组装（5 个 .md + 记忆检索结果）
pa-sqlite 扩展               → 加 memories 表 + 检索接口
28 事件系统                   → 监听会话结束事件 → 触发记忆提取
wgnr-pi Web UI              → 加 Corrections Slot 的显式开关
Pi JSONL 会话                → 不变（会话记录继续用）
pa-files 扩展               → 不变（浏览工作区文件）
```

---

## 当前不做的事（及原因）

| 不做的事 | 原因 |
|---------|------|
| Vector DB（Qdrant/Pinecone） | 记忆量 <1000 条时，SQLite LIKE 够用 |
| 关键词触发加载知识 | 知识总量 ~2000 tokens，全量加载比分类器更可靠 |
| AI 自动漂移检测 | 三个计数器比一个 LLM 调用更快更便宜，且不会误判 |
| 记忆冲突检测（LightMem 模式） | 记忆量不够大时，冲突概率极低 |
| 角色自省系统 | 有趣但实验性太强，先验证基础对话质量 |
| world_info / lorebook | 澪号不是架空世界观角色，不需要世界知识触发系统 |
| 子 Agent 过滤（OpenClaw 模式） | Pi 当前没有子 Agent 概念 |

---

## Token 预算

```
静态前缀（Position 1-5，每次对话加载）:
  MetaInstruction ............ ~50 tokens
  boundaries.md .............. ~300 tokens
  soul.md .................... ~800 tokens
  language.md ................ ~400 tokens
  knowledge.md ............... ~450 tokens
  小计 ........................ ~2000 tokens

动态上下文（每次用户消息）:
  Memory Context (Position 6) . ~0-300 tokens（有匹配时）
  Chat History (Position 7) ... ~Pi 自动管理
  Corrections Slot (Position 8) ~0-50 tokens（触发时）
  User Message (Position 9) ... ~不定

总计：静态 ~2000 + 动态不定
```

~2000 tokens 的静态前缀在 DeepSeek V3 的定价下每次对话成本约 $0.002。如果 Prompt Cache 命中（静态前缀不变），后续每轮只需要支付动态部分的 token 成本。
