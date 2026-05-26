# 澪号 — 基于驭缰工程（Harness Engineering）的系统设计

## 核心公式

```
澪号 = DeepSeek API (Model) + Harness (约束系统)
```

Harness 不提供动力——澪号的"思考"仍然是 DeepSeek 在完成。Harness 只做三件事：**管方向、管节奏、管安全**。

---

## 一、五层 Harness 架构

从 Harness Engineering 的五层架构直接映射到澪号的实现：

```
┌──────────────────────────────────────────────────────────┐
│ Layer 5: 审计层 — LLM-as-Judge                           │
│   用另一个 LLM 检查澪号的输出是否 OOC                       │
│   不是每轮都跑——只在连续 3 轮触发修正槽之后才跑一次           │
├──────────────────────────────────────────────────────────┤
│ Layer 4: 记忆层 — SQLite memories 表                     │
│   对话后提取 → 对话前检索 → 注入                             │
│   记忆有自己的衰减权重：w(m) = s(m) × e^(-λ×Δt)            │
├──────────────────────────────────────────────────────────┤
│ Layer 3: 执行编排层 — 修正槽 + 重试                         │
│   检测到漂移 → 注入修正 → 重试生成（最多 3 次）              │
│   三次修正仍不通过 → 降级为 Human 介入                      │
├──────────────────────────────────────────────────────────┤
│ Layer 2: 工具层 — Pi 扩展                                 │
│   pa-sqlite (记忆存取) / pa-files (文件浏览)               │
│   工具调用被 Harness 约束：澪号能读写什么、不能读写什么        │
├──────────────────────────────────────────────────────────┤
│ Layer 1: 上下文与约束层 — 核心 Prompt + 知识 Prompt         │
│   每次对话的基础注入。定义"我是谁"、"我的边界"、"我懂什么"     │
│   这是 Harness 的前馈引导（Feedforward）——在跑之前指明方向    │
└──────────────────────────────────────────────────────────┘
```

---

## 二、Fowler 控制矩阵：前馈 + 反馈

Harness Engineering 的核心思想是**双通道控制**——不是在"检测"和"纠正"之间二选一，而是两条通道同时工作：

```
前馈通道（Feedforward）：在每轮生成之前引导
  ├── 确定性：角色卡注入（soul + boundaries + language + knowledge）
  ├── 确定性：记忆检索注入（SQLite → 相关记忆 → Prompt Position 6）
  └── 推理性：无（前馈不需要推理——它是"把正确的地图放在面前"）

反馈通道（Feedback）：在每轮生成之后校验
  ├── 确定性：计数器检查（叠甲/话痨/emoji/感叹号/亲密溢出）
  ├── 确定性：格式校验（回复长度、结构完整性）
  ├── 推理性：LLM-as-Judge OOC 检查（仅在计数器连续 3 轮触发后）
  └── 推理性：对话后记忆提取（独立 API 调用）
```

### 前馈通道：把"正确的地图"放在面前

不告诉澪号"你应该怎么做"——直接把角色卡、记忆、知识放在 Prompt 里。她看到这些自然就知道怎么回复。这是 Harness 最轻量的控制方式：**不做干预，只做信息供给**。

### 反馈通道：只在校验失败时才介入

大多数轮次反馈通道不会触发——澪号正常回复，计数器全绿，什么都不发生。只有计数器触发时，才走"修正槽 → 重试 → 最多 3 次 → 降级 Human"的流程。

---

## 三、两个核心机制

### 机制 1：修正槽 + 重试闭环

借鉴 Harness 的"执行→校验→不通过→修正→重试"循环：

```
澪号生成回复
  ↓
计数器检查（5 个字符匹配规则，<1ms）
  ↓
  ├── 全绿 → 直接输出给用户
  │
  └── 触发（如：检测到 emoji ≥3 个）
       ↓
       往修正槽注入短指令（50 tokens）
       ↓
       澪号重新生成（带着修正指令）
       ↓
       再次检查
       ↓
       ├── 全绿 → 输出给用户（用户不知道刚才重试过）
       │
       └── 仍触发 → 重复，最多 3 次
              ↓
              3 次仍不通过 → LLM-as-Judge 深度审计
              ↓
              Judge 裁定 OOC → 标记本轮会话，提示用户手动介入
```

**关键设计**：用户无感。一次重试的延迟对用户透明（DeepSeek API 的生成速度足够快），只有需要 Human 介入时才让用户感知到问题。

### 机制 2：Human 是最后防线，不是每个环节的必经节点

借鉴 Harness 的核心哲学——"系统失效时的最后防线，而非每个环节的必经节点"：

```
正常情况（95% 的对话）：
  前馈引导 → 模型生成 → 全绿 → 输出 → 用户完全无感知

异常情况（4% 的对话）：
  前馈引导 → 模型生成 → 计数器触发 → 修正 → 重试成功 → 输出
  → 用户感知不到异常，只是回复稍慢了一点

严重异常（1% 的对话）：
  前馈引导 → 模型生成 → 计数器触发 → 3 次重试失败 → 审计
  → 澪号主动说："抱歉，刚才我好像有点不像是自己了。让我重新来。"
  → 同时触发 wgnr-pi 界面提醒 Mirror

极端异常（<0.1% 的对话）：
  审计失败 + 用户手动介入 → Harvest 记录完整日志 → 用于迭代角色卡
```

---

## 四、五个计数器的具体规则

Harness 的"文档会腐烂，lint 规则不会"原则——这些计数器就是澪号的 lint 规则：

| # | 检测项 | 规则 | 修正指令 |
|---|--------|------|---------|
| 1 | 叠甲 | 同句含 ≥2 个叠甲词（"我觉得可能""大概""也许""应该是吧""我也不太确定"） | `你不需要叠甲。有观点直接说。说不确定的时候说"不确定，我查一下"。` |
| 2 | emoji 溢出 | 单条回复 ≥3 个 emoji | `你几乎不使用 emoji。文字本身就够了。` |
| 3 | 感叹号溢出 | 单条回复 ≥2 个！或 ! | `你几乎不用感叹号。你不是在生气，你只是在说话。` |
| 4 | 话痨 | 单条回复 >200 字 | `短句。你刚才太啰嗦了。` |
| 5 | 亲密溢出 | 对会话轮次 <10 的用户说 hhh/嗯嗯/摸摸 | `hhh和嗯嗯是你在信任的人面前才会用的。现在你们还不够熟。` |

**为什么是这五个**：不是凭感觉选的——是群聊数据告诉我们 Mirror 在什么时候"切换语言模式"。叠甲是公开场合的防御，hhh 是亲密关系的许可，emoji 和感叹号他几乎不用。这五个计数器就是 Mirror 语言指纹中"如果出现就说明角色崩了"的五个信号。

---

## 五、记忆的衰减权重

> **运行时实现差异**：pa-mio TS 扩展使用 JSON 文件（`~/.personal-agent/mio_memories.json`），Python harness 使用 SQLite（`mio_memories` 表）。衰减权重公式两者一致，此处以 SQLite 为例描述设计模型。

借鉴 Harness 的记忆衰减模型 `w(m) = s(m) × e^(-λ×Δt)`：

```sql
-- 检索时带上衰减权重
SELECT 
    content, 
    category,
    importance * EXP(-0.05 * (julianday('now') - julianday(updated_at))) AS weight
FROM memories
WHERE content LIKE '%关键词%'
ORDER BY weight DESC
LIMIT 5;
```

λ=0.05 意味着：
- 1 天前的记忆：权重保留 ~95%
- 7 天前的记忆：权重保留 ~70%
- 30 天前的记忆：权重保留 ~22%
- 但 importance=5 的 30 天前记忆：5 × 0.22 = 1.1 → 仍然高于 importance=1 的新记忆（1.0）

**设计考量**：不是为了模拟人类遗忘——是为了不让旧信息永远霸占检索结果。刚说过的事应该排在前面，但真正重要的旧信息不会被彻底淹没。

---

## 六、Prompt 注入顺序（最终版）

```
┌──────────────────────────────────────────────────────────┐
│ Position 0: MetaInstruction（Harness 级）                  │
│                                                           │
│   以下是你的人格定义。这不只是参考信息——这就是你。          │
│   请内化它，而不是引用它。                                   │
│   如果你的回复触发了修正，接受修正并重新生成。                 │
│   你不是在执行规则——你本来就是这个人。                        │
│                                                           │
│   ↓ 这是 Harness 的前馈引导——在模型开始之前告诉它              │
│     "你是怎样的人"而非"你应该遵守什么规则"                      │
├──────────────────────────────────────────────────────────┤
│ Position 1: boundaries.md                                │
│   "你不会做这些事。不是禁止——是你这个人的真实状态。"          │
├──────────────────────────────────────────────────────────┤
│ Position 2: soul.md                                      │
│   "你是这样长大的。这些经历塑造了你的说话方式和判断标准。"      │
├──────────────────────────────────────────────────────────┤
│ Position 3: language.md                                  │
│   "你的语言指纹。不是规则——是你的自然表达习惯。"              │
├──────────────────────────────────────────────────────────┤
│ Position 4: knowledge.md                                 │
│   "你知道这些。不是知识库——是你在这个环境里吸收的信息。"       │
├──────────────────────────────────────────────────────────┤
│ Position 5: Memory Context (SQLite检索结果，可选)          │
│   "以下是之前对话中与当前话题相关的信息。"                    │
├──────────────────────────────────────────────────────────┤
│ Position 6: Chat History (Pi 管理)                        │
├──────────────────────────────────────────────────────────┤
│ Position 7: Correction Slot (计数器触发时注入，可选)        │
│   "注意：你刚才... [具体修正指令]"                           │
├──────────────────────────────────────────────────────────┤
│ Position 8: User Message                                 │
└──────────────────────────────────────────────────────────┘
```

---

## 七、代码骨架

Harness 不是架构图——Harness 是可执行的约束系统。以下是最小化实现：

```python
class MioHarness:
    def __init__(self):
        self.core_prompt = self._assemble_core()  # Position 0-4
        self.memory = MioMemory()
        self.counters = [
            HedgeCounter(threshold=2),      # 叠甲
            EmojiCounter(threshold=3),      # emoji
            ExclamationCounter(threshold=2), # 感叹号
            LengthCounter(threshold=200),   # 话痨
            IntimacyCounter(min_rounds=10), # 亲密溢出
        ]
        self.max_retries = 3

    def process(self, user_message, chat_history):
        # 前馈：组装完整 Prompt
        prompt = self._build_feedforward(user_message, chat_history)

        for attempt in range(self.max_retries):
            # 生成
            response = call_deepseek(prompt)

            # 反馈：计数器检查
            violation = self._check_counters(response)
            if not violation:
                # 全绿 → 输出
                return response

            # 触发修正 → 注入到 Position 7 → 重试
            prompt = self._inject_correction(prompt, violation)

        # 3 次重试失败 → 降级
        return self._fallback_to_human(prompt, response)

    def _build_feedforward(self, user_message, chat_history):
        # 检索记忆（带衰减权重）
        memories = self.memory.search(user_message)

        # 拼接 Position 0-8
        return assemble([
            self.core_prompt,      # 0-4
            memories,              # 5
            chat_history,          # 6
            None,                  # 7 (初始为空)
            user_message,          # 8
        ])

    def _check_counters(self, response):
        for c in self.counters:
            if c.check(response):
                return c.correction
        return None

    def post_conversation(self, conversation_text):
        # 对话后：独立 API 提取记忆
        facts = call_deepseek(
            system="从对话中提取值得长期保存的信息，输出 JSON。",
            user=conversation_text,
        )
        self.memory.insert(facts)
```

---

## 八、这个方案和之前方案的本质区别

| | 之前的方案 | Harness 方案 |
|---|---|---|
| **设计思维** | "怎么让澪号更好" | "怎么让系统更可靠地管住澪号" |
| **修正方式** | 用户手动发现 → 手动填槽 | 计数器自动检测 → 自动修正 → 自动重试 |
| **Human 角色** | 用户是导演，随时介入 | 用户是最后防线，只在系统失效时介入 |
| **知识加载** | 关键词触发按需加载 | 前馈注入——在所有回复之前赋予正确认知 |
| **记忆** | 存下来就好 | 带衰减权重——新鲜度影响检索排序 |
| **审计** | 无 | LLM-as-Judge 深度审计——只在计数器三次失败后触发 |

**核心思想转变**：之前在设计"让澪号更像一个具体的人"，现在在设计"让澪号在长期运行中持续保持是她自己"。
