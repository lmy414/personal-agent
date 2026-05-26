# 三套分阶段注入方案 — 落地对比

> 2026-05-27 | SillyTavern / OpenClaw / Mem0 的实际实现对比

---

## 一、先看三家的核心差异

三家对"分阶段注入"的理解完全不同：

| | SillyTavern | OpenClaw | Mem0 |
|---|---|---|---|
| **注入粒度** | 每轮对话 | 每次会话启动 | 每轮对话 |
| **注入介质** | 代码拼接模板变量 | Markdown 文件 | API 调用 + 向量检索 |
| **谁控制注入** | 用户手动配置 | Agent 自己读写文件 | 框架自动处理 |
| **核心理念** | 用户是导演，Prompt是剧本 | 文件是持久身份，Agent自维护 | 记忆是独立服务，注入是管道步骤 |

---

## 二、SillyTavern：精确到位置的 Prompt 拼装流水线

### 实际的注入顺序（从Prompt顶部到底部）

```
┌──────────────────────────────────────────────────────┐
│ Position 1: World Info (Before Char)                  │  ← 角色定义之前的世界知识
├──────────────────────────────────────────────────────┤
│ Position 2: System Prompt                             │  ← "Write {{char}}'s next reply..."
├──────────────────────────────────────────────────────┤
│ Position 3: Character Description + Persona          │  ← 角色描述、性格、场景
│             + Scenario + User Persona                │
│             + Example Messages                       │
├──────────────────────────────────────────────────────┤
│ Position 4: World Info (After Char)                   │  ← 角色定义之后的世界知识
├──────────────────────────────────────────────────────┤
│ Position 5: World Info (@Depth)                       │  ← 精确插入到聊天记录中指定深度
├──────────────────────────────────────────────────────┤
│ Position 6: Chat History                              │  ← 历史消息
├──────────────────────────────────────────────────────┤
│ Position 7: World Info (AN位置) + Author's Note       │  ← "实时导演指令"
├──────────────────────────────────────────────────────┤
│ Position 8: Post-History Instructions                 │  ← 最后一条注入，最高优先级
└──────────────────────────────────────────────────────┘
```

### 关键机制

**Author's Note 的注入深度**（这是最巧妙的设计）：

```
@Depth = 0: 放在聊天记录的底部（最靠近模型输出） → 最强影响
@Depth = 4: 放在聊天记录中偏下方
@Depth = ∞: 不注入
```

用户可以在对话过程中随时修改 Author's Note 的内容和深度，**不需要重启会话**。角色开始话痨 → 调高 Depth → 注入"保持简洁" → 下一句就生效。

**World Info 的六种注入位置**：

| 位置 | 使用场景 |
|------|---------|
| Before Char | 世界规则（"这个世界没有手机"）——需要在角色定义之前确立 |
| After Char | 角色相关知识——放角色后面因为知识属于角色 |
| @Depth N | 精确控制——"这个话题在第 N 轮提到过，现在回想起来" |
| Top of AN | 全局提醒——每次回复前刷新 |
| Bottom of AN | 场景级提醒——比全局规则更靠近输出 |
| Outlet | 手动宏 `{{outlet::Name}}`——完全控制位置 |

### 这个方案的精髓

**不断让用户做"导演"**。注入什么、注入多少、注入在哪——全部可视化配置。不是自动化的，但给了用户最精确的控制力。

对澪号的启发：Author's Note 是轻量级行为修正的最佳实现——不是重写角色卡，是在输出前追加一条短指令。

---

## 三、OpenClaw：文件即身份，每次重启重新组装

### 实际操作流程

```
会话启动
  ↓
loadWorkspaceBootstrapFiles(dir)
  ↓ 按固定顺序读取 8 个 .md 文件
  ↓
  1. AGENTS.md       ← 操作手册（规则、记忆管理、安全、群聊行为）
  2. SOUL.md         ← 人格核心（价值观、表达哲学）
  3. TOOLS.md        ← 本地环境（SSH主机、TTS语音、设备）
  4. IDENTITY.md     ← 结构化元数据（名字、emoji、avatar）
  5. USER.md         ← 用户画像（姓名、时区、偏好）
  6. HEARTBEAT.md    ← 定期巡逻清单
  7. BOOTSTRAP.md    ← 首次运行引导（完成后删除）
  8. MEMORY.md       ← 长期精炼记忆
  ↓
filterBootstrapFilesForSession()
  ↓ 按会话类型过滤
  ↓
  主会话 → 全部 8 个
  子Agent/Cron → 去MEMORY + HEARTBEAT + BOOTSTRAP
  群聊 → 去MEMORY（防泄露隐私给群友）
  心跳模式 → 仅 HEARTBEAT.md（极致省token）
  ↓
buildBootstrapContextFiles()
  ↓ 预算控制 + 截断
  ↓ 单文件上限 20,000 字符，总额 150,000 字符
  ↓ 超限截断策略：留头70% + 尾20%，中间插入截断标记
  ↓
注入 system prompt 的 # Project Context 区域
  ↓
LLM 处理用户消息
```

### 关键机制

**SOUL.md 的特殊待遇**：8 个文件中，SOUL.md 在系统提示词中有一条额外的加持指令：

> "If SOUL.md is present, embody its persona and tone..."

其他文件没有这个待遇。这意味着 SOUL.md 不仅是内容注入，还有一条**元指令告诉模型"把它当真"**——这是把 Soul Document 哲学工程化的最简洁方式。

**IDENTITY.md 的结构化解析**：8 个文件中唯一被代码解析的。其余全是原文注入。

```markdown
# IDENTITY.md 示例
name: Luna
emoji: 🌙
creature: digital moon spirit
vibe: calm, mysterious, poetic
avatar: luna.png
```

解析后，name 用于消息前缀 `[Luna]:`，emoji 用于默认表情回应。**不占用 prompt 空间**。

**Agent 自维护记忆**：AGENTS.md 里写了一条规则——在心跳（定期自检）时，Agent 自己阅读 `memory/` 下的日记 → 提炼重要事件 → 更新 MEMORY.md → 删除过期信息。**不是框架代码在做这件事，是 Agent 自己在做**。

**Post-Compaction 重新注入**：对话过长被压缩（Compaction）后，Agent 会失去上下文。OpenClaw 的处理方式是：

```
压缩后 →
  [system] Your workspace contains these bootstrap files — re-read them now:
    - AGENTS.md
    - SOUL.md
    - IDENTITY.md
    - USER.md
    - MEMORY.md
    - TOOLS.md
    - memory/2026-05-27.md
```

**不是重新注入内容，是告诉 Agent "去重读这些文件"**。Agent 用 read 工具自己去读——节省了重新注入的 token。

### 这个方案的精髓

**一切状态都是 Markdown 文件**。身份、记忆、规则、配置全部以明文存储在磁盘上。Agent 跨 session 的连续性不来自模型"记住"，而来自每次启动重新加载文件。

对澪号的启发：SOUL.md + 元指令的模式非常干净——一个文件定义人格，一条指令告诉模型"把它当真"。另外，让 Agent 自己维护记忆文件而不是框架自动提取，长期来看更灵活。

---

## 四、Mem0：记忆作为独立服务，四步循环

### 实际集成代码模式

```python
# 初始化：记忆是独立服务
from mem0 import MemoryClient
client = MemoryClient(api_key="...")

# 标准对话循环（4步）
def chat_with_memory(user_id, question):
    # ① 检索：根据当前问题搜索相关记忆
    memories = client.search(
        query=question, 
        user_id=user_id, 
        limit=10
    )

    # ② 注入：记忆拼接到 system prompt
    memory_context = "\n".join(
        [f"- {m['memory']}" for m in memories]
    )
    system_prompt = f"""## Memories
{memory_context}

You are a helpful assistant."""

    # ③ 推理：LLM 带着记忆生成回复
    response = llm.invoke(system_prompt, question)

    # ④ 存储：本轮对话异步写入记忆库
    client.add([
        {"role": "user", "content": question},
        {"role": "assistant", "content": response}
    ], user_id=user_id)

    return response
```

### 记忆更新的双阶段管线

```
新对话到达
  ↓
Phase 1: Fact Extraction（事实提取）
  ↓ LLM 从对话中提取"原子事实"
  ↓ 例："用户喜欢短句回答"、"用户在用 Blender 4.2"
  ↓
Phase 2: Memory Update（记忆更新）
  ↓ 向量检索找到 Top-K 已有记忆
  ↓ LLM 对比新旧 → 决定 ADD / UPDATE / DELETE / NOOP
  ↓ 更新向量数据库
```

### 记忆冲突自动处理

当用户说"我不想看视频了，太慢了"，Mem0 自动：
- 检索到旧记忆"用户喜欢看 B 站视频"
- 不删除旧记忆
- 更新权重：新偏好（文字 > 视频）权重更高
- 下次检索时，新记忆排在前面

### 这个方案的精髓

**记忆是完全独立的服务，不嵌入 Agent 代码**。Agent 只是调用 `search()` 和 `add()` 两个方法。向量检索、事实提取、冲突解决——全部在 Mem0 服务内部完成。

代价是引入了外部依赖（需要 API key 或自建 Qdrant 数据库），对澪号来说太重了。但**"检索→注入→推理→存储"四步循环**是通用模式，PCI 也可以实现——只是存储层从 Vector DB 换成 SQLite。

---

## 五、三家对"分阶段注入"的不同答案

| 问题 | SillyTavern | OpenClaw | Mem0 |
|------|------------|----------|------|
| 对话前加载什么？ | System Prompt + 角色描述 + 用户人设 + 示例对话 | 8个.md文件（AGENTS→SOUL→TOOLS→ID→USER→HEARTBEAT→BOOT→MEMORY） | 无（每次对话独立，靠检索串联） |
| 对话中注入什么？ | World Info（关键词触发）+ Author's Note（用户手动） | 无（Agent自己read文件） | 检索到的Top-K记忆条目 |
| 对话后做什么？ | 无（用户手动总结） | Agent更新MEMORY.md + 写日记 | 事实提取 + ADD/UPDATE/DELETE |
| 对话中断/压缩后怎么办？ | 无效——用户需要重新触发 | 通知Agent重读所有bootstrap文件 | 无效——只能重新检索 |
| 角色漂移怎么修？ | Author's Note 手动调整 | Agent在AGENTS.md里有行为规则，自行纠正 | 不负责角色漂移（记忆不存角色定义） |

---

## 六、对澪号可以直接用的模式

### 从 SillyTavern 学：Author's Note 机制

最简单的漂移修正不需要分类器。**在 Prompt 组装管线的最后一步（chat history 之后、用户消息之前），留一个可选的注入槽**。初始为空。当检测到问题（叠甲/话痨/emoji泛滥），往槽里填一条短指令。

```
[SYSTEM] 注意：你刚才开始叠甲了。你不需要叠甲。有观点直接说。
[USER] 《原来的用户消息》
```

这比引入完整的漂移检测系统简单一百倍，但效果一样。

### 从 OpenClaw 学：SOUL.md + 一条元指令

字符卡本身 + 一条额外的系统指令让它"当真"：

```
[SYSTEM] 以下是你的人格定义。这不只是参考信息——这就是你。
请内化它，而不是引用它。
[SYSTEM] 《澪号系统提示词全文》
```

OpenClaw 对 SOUL.md 的处理就是多了一条这样的指令。

### 从 Mem0 学：四步循环

即使不用 Vector DB，这个循环本身是通用的：

```
① 检索相关记忆（SQLite LIKE + 关键词匹配）
② 注入到 system prompt 的 ## 记忆 区域
③ LLM 推理
④ 异步提取新事实 → 写入 SQLite
```

澪号不需要第④步做复杂的 ADD/UPDATE/DELETE 决策——只需要在对话结束后，把"这个对话中可能重要的信息"用一句话存下来，下次对话时用关键词匹配加载。简单但不简陋。

---

## 七、三个方案对澪号的适配度

| 维度 | SillyTavern | OpenClaw | Mem0 |
|------|------------|----------|------|
| 架构复杂度 | 中 | 高 | 低（SDK）— 高（自建） |
| 是否依赖外部服务 | 否 | 否 | 是（API/Vector DB） |
| 是否适合 Pi 框架 | 需移植 | 理念可直接用 | 需引入新依赖 |
| 记忆检索方式 | 关键词正则 | Agent自己read | 向量语义检索 |
| 是否需要用户手动操作 | 是 | 否 | 否 |
| 角色漂移修正 | 手动（Author's Note） | Agent自律 | 不覆盖 |
| 部署难度 | 低 | 中 | 低（API版） |

**澪号最接近的是 OpenClaw 路线**——角色卡文件 + 记忆文件 + Agent 自维护。因为 Pi 框架本身不支持 SillyTavern 的可视化 Prompt 组装，也不需要 Mem0 的向量检索规模。

**可以直接照搬的**：OpenClaw 的 SOUL.md 元指令模式 + SillyTavern 的 Author's Note 注入位置（chat history 之后）+ Mem0 的检索→注入→推理→存储四步循环（用 SQLite 替代 Vector DB）。
