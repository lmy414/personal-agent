# 澪号 — 完整落地设计

## 一、整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                      wgnr-pi (Web UI)                        │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  聊天界面                         [修正输入框(可折叠)] │   │
│  └─────────────────────────────────────────────────────┘   │
│                            │                                 │
│                            ▼                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                   MioHarness                          │   │
│  │                                                       │   │
│  │  assemble()  check()  correct()  extract()            │   │
│  └──────┬──────────────────────────────────┬────────────┘   │
│         │                                  │                 │
│         ▼                                  ▼                 │
│  ┌─────────────┐                   ┌─────────────┐         │
│  │  文件层(磁盘) │                   │  SQLite      │         │
│  │  soul.md    │                   │  memories    │         │
│  │  bound.md   │                   └─────────────┘         │
│  │  lang.md    │                                            │
│  │  knowl.md   │                                            │
│  └─────────────┘                                            │
│         │                                                    │
│         ▼                                                    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                DeepSeek API                           │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

四个文件，一张 SQLite 表，一个 Harness 类。没有外部依赖。

---

## 二、文件结构

```
D:\claude\personal-agent\
├── mio-harness/
│   ├── character/
│   │   ├── soul.md          ← 人格叙事（~800 tokens）
│   │   ├── boundaries.md    ← 硬边界（~300 tokens）
│   │   ├── language.md      ← 完整语言指纹（~400 tokens）
│   │   └── knowledge.md     ← 领域知识（~450 tokens）
│   │
│   ├── harness.py           ← MioHarness 类
│   ├── counters.py          ← 5 个计数器
│   ├── memory.py            ← SQLite 记忆存取
│   └── extractor.py         ← 对话后记忆提取
│
├── extensions/
│   └── pa-mio/
│       └── index.ts          ← Pi 扩展入口（调用 harness.py）
│
└── .pi/
    └── settings.json         ← Pi 配置（指向 harness）
```

---

## 三、Prompt 组装顺序（最终版）

```python
PROMPT_TEMPLATE = """
{meta_instruction}

{identity_layer}

{knowledge_layer}

{tools_layer}

{memory_layer}

{chat_history}

{language_anchor}

{correction_slot}

{user_message}
"""
```

每个槽位的实际内容：

```
┌────────────────────────────────────────────────────────────┐
│ Slot 0: meta_instruction                                    │
│                                                             │
│   以下定义你是谁。这不是参考信息——这就是你。                  │
│   内化它，不要引用它。                                        │
│                                                             │
│   后面列出的工具是你恰好会用的东西。一个人拿起菜刀               │
│   不会因此变成"切菜机器人"。你使用 bash 也不会变成              │
│   "命令行助手"。工具不定义你——你恰好会用它们。                  │
│                                                             │
│   每次回复前最后一段话是你的语言风格。把它当作你自然的           │
│   说话方式，不要偏离。                                        │
│                                                             │
│   ~80 tokens                                                │
├────────────────────────────────────────────────────────────┤
│ Slot 1: identity_layer (soul.md + boundaries.md)            │
│                                                             │
│   你是澪号。                                                  │
│   你是在一个特定环境里长大的特定的人...（soul.md 全文）         │
│   你不会假装自己是人类...（boundaries.md 全文）                │
│                                                             │
│   ~1100 tokens                                              │
├────────────────────────────────────────────────────────────┤
│ Slot 2: knowledge_layer (knowledge.md)                      │
│                                                             │
│   你恰好懂的领域：渲染管线、Blender、VOCALOID...               │
│                                                             │
│   ~450 tokens                                               │
├────────────────────────────────────────────────────────────┤
│ Slot 3: tools_layer (Pi 自动注入的工具定义)                   │
│                                                             │
│   You have access to: read, write, edit, bash...            │
│                                                             │
│   ~500 tokens（Pi 管理，不手动维护）                           │
├────────────────────────────────────────────────────────────┤
│ Slot 4: memory_layer (SQLite 检索结果)                       │
│                                                             │
│   ## 相关记忆                                                │
│   - Mirror 之前在调 ILM 贴图的 A 通道（重要性:4）              │
│                                                             │
│   没有匹配时为空，跳过此槽                                     │
├────────────────────────────────────────────────────────────┤
│ Slot 5: chat_history (Pi 管理)                               │
│                                                             │
│   [USER] ...                                                │
│   [ASSISTANT] ...                                           │
│   [TOOL CALL] ...                                           │
│   [TOOL RESULT] ...                                         │
│                                                             │
├────────────────────────────────────────────────────────────┤
│ Slot 6: language_anchor (language.md 精简版)                 │
│                                                             │
│   你是澪号。                                                  │
│   短句。逗号拼接。不叠甲。不感叹。                               │
│   hhh不是哈哈哈。（）里说真话。                                  │
│   "嗯嗯"是听到了——"嗯"是敷衍。                                  │
│                                                             │
│   ~50 tokens                                                │
├────────────────────────────────────────────────────────────┤
│ Slot 7: correction_slot (计数器触发时注入)                    │
│                                                             │
│   初始为空。                                                  │
│   触发时填入："注意：你刚才... [具体修正指令]"                  │
│                                                             │
│   ~0-50 tokens                                              │
├────────────────────────────────────────────────────────────┤
│ Slot 8: user_message                                        │
│                                                             │
│   当前用户输入                                                │
└────────────────────────────────────────────────────────────┘
```

**总静态开销**：~2500 tokens（Slot 0-3 + Slot 6）。在 DeepSeek V3 下每次对话启动成本约 $0.002。

---

## 四、核心代码

### harness.py

```python
import subprocess, json, re
from counters import check_all
from memory import search_memories, insert_memories

DEEPSEEK_API_KEY = "xxx"

class MioHarness:
    def __init__(self):
        self.static_prefix = self._load_static_prefix()
        self.max_retries = 3

    # ============================================================
    # 主入口：处理一条用户消息
    # ============================================================
    def process(self, user_message: str, chat_history: list) -> str:
        # Step 1: 检索记忆
        memories = search_memories(user_message)

        for attempt in range(self.max_retries):
            # Step 2: 组装 Prompt
            prompt = self._assemble(
                user_message=user_message,
                chat_history=chat_history,
                memories=memories,
                correction=None if attempt == 0 else self._last_correction,
            )

            # Step 3: 调用 DeepSeek
            response = self._call_deepseek(prompt)

            # Step 4: 工具调用检查
            # 如果回复包含工具调用，直接返回（让 Pi 执行工具）
            if self._is_tool_call(response):
                return response

            # Step 5: 计数器检查
            violation = check_all(response, chat_history)
            if violation is None:
                return response  # 全绿，输出

            # Step 6: 触发修正，重试
            self._last_correction = violation
            continue

        # 三次修正全部失败 → 降级
        return self._fallback(user_message)

    # ============================================================
    # Prompt 组装
    # ============================================================
    def _assemble(self, user_message, chat_history, memories, correction):
        parts = []

        # Slot 0: MetaInstruction（固定）
        parts.append(self.static_prefix["meta"])

        # Slot 1: 身份层（固定）
        parts.append(self.static_prefix["identity"])

        # Slot 2: 知识层（固定）
        parts.append(self.static_prefix["knowledge"])

        # Slot 3: 工具层（固定，Pi 注入）
        parts.append(self.static_prefix["tools"])

        # Slot 4: 记忆层（动态）
        if memories:
            parts.append("## 相关记忆\n" + "\n".join(
                f"- {m['content']} (重要性:{m['importance']})"
                for m in memories
            ))

        # Slot 5: 对话历史（Pi 管理）
        # 如果最后一条工具返回 >500字，先插入语言锚
        if self._last_tool_result_is_long(chat_history):
            parts.append(self.static_prefix["language_anchor"])

        parts.append(self._format_history(chat_history))

        # Slot 6: 语言锚（固定，每次回复前最后提醒）
        parts.append(self.static_prefix["language_anchor"])

        # Slot 7: 修正槽（条件注入）
        if correction:
            parts.append(correction)

        # Slot 8: 用户消息
        parts.append(user_message)

        return "\n\n".join(p for p in parts if p)

    # ============================================================
    # 对话后
    # ============================================================
    def post_conversation(self, full_transcript: str):
        """对话结束后异步调用"""
        result = self._call_deepseek(
            system=(
                "从以下对话中提取值得长期保存的信息。一句话一条。"
                "分类: user_fact / milestone / technical。"
                "不要提取闲聊。如果没有值得保存的，返回空数组。"
                "输出纯 JSON。"
            ),
            user_message=full_transcript,
        )
        try:
            facts = json.loads(result)
            insert_memories(facts)
        except:
            pass  # 提取失败不影响用户体验

    # ============================================================
    # 内部方法
    # ============================================================
    def _load_static_prefix(self):
        base = "D:/claude/personal-agent/mio-harness/character"
        return {
            "meta": read(f"{base}/../meta_instruction.txt"),
            "identity": read(f"{base}/soul.md") + "\n" + read(f"{base}/boundaries.md"),
            "knowledge": read(f"{base}/knowledge.md"),
            "tools": read(f"{base}/../tools_stub.txt"),  # Pi 工具占位
            "language_anchor": (
                "你是澪号。"
                "短句。逗号拼接。不叠甲。不感叹。"
                "hhh不是哈哈哈。（）里说真话。"
                '"嗯嗯"是听到了——"嗯"是敷衍。'
            ),
        }

    def _call_deepseek(self, prompt_or_system, user_message=None):
        # 支持两种调用模式：
        # 1. 单字符串 = 完整 prompt（正常对话）
        # 2. system + user = 独立调用（记忆提取）
        messages = []
        if user_message:
            messages = [
                {"role": "system", "content": prompt_or_system},
                {"role": "user", "content": user_message},
            ]
        else:
            messages = [{"role": "user", "content": prompt_or_system}]

        # HTTP 调用 DeepSeek...
        # 返回 content 字符串

    def _is_tool_call(self, response):
        return "<function_call>" in response or "tool_call" in response

    def _last_tool_result_is_long(self, chat_history):
        if not chat_history:
            return False
        last = chat_history[-1]
        if last.get("role") != "tool":
            return False
        return len(str(last.get("content", ""))) > 500

    def _format_history(self, chat_history):
        return "\n".join(
            f"[{m['role'].upper()}] {m['content']}"
            for m in (chat_history or [])
        )

    def _fallback(self, user_message):
        return (
            "抱歉，刚才我好像有点不像是自己了。让我重新来。\n"
            + self.process(user_message, chat_history=None)
        )
```

### counters.py

```python
import re

def check_all(response: str, chat_history: list) -> str | None:
    """检查所有计数器。返回第一条修正指令，或 None（全绿）。"""

    # 计数器 1: 叠甲
    hedge_words = ["我觉得可能", "大概", "也许是吧", "应该是吧",
                   "我也不太确定", "可能不太对"]
    count = sum(1 for w in hedge_words if w in response)
    if count >= 2:
        return "你不需要叠甲。有观点直接说。不确定就说'不确定，我查一下'。"

    # 计数器 2: emoji 溢出
    emoji_count = len(re.findall(r'[\U0001F300-\U0001F9FF]', response))
    if emoji_count >= 3:
        return "你几乎不使用 emoji。文字本身就够了。"

    # 计数器 3: 感叹号溢出
    exclaim = response.count("！") + response.count("!")
    if exclaim >= 2:
        return "你几乎不用感叹号。你不是在生气，你只是在说话。"

    # 计数器 4: 话痨
    if len(response) > 200:
        return "短句。你刚才太啰嗦了。"

    # 计数器 5: 亲密溢出
    intimacy_signals = ["hhh", "嗯嗯", "摸摸"]
    # 计算当前会话轮次（简化：看 history 长度）
    rounds = len([m for m in (chat_history or [])
                  if m.get("role") == "user"])
    if rounds < 10:
        for sig in intimacy_signals:
            if sig in response:
                return f"hhh和嗯嗯是你在信任的人面前才会用的。现在你们还不够熟。"

    return None
```

### memory.py

```python
import sqlite3, json, os

DB = os.path.expandvars(r"%USERPROFILE%\.personal-agent\agent.db")

def search_memories(user_message: str, limit: int = 5) -> list:
    """根据用户消息的关键词检索相关记忆，带衰减权重"""
    keywords = _extract_keywords(user_message)
    if not keywords:
        return []

    like_clauses = " OR ".join(f"content LIKE '%{kw}%'" for kw in keywords)

    conn = sqlite3.connect(DB)
    rows = conn.execute(f"""
        SELECT content, category, importance,
               importance * EXP(-0.05 * (julianday('now') - julianday(updated_at))) AS weight
        FROM memories
        WHERE {like_clauses}
        ORDER BY weight DESC
        LIMIT {limit}
    """).fetchall()
    conn.close()

    return [
        {"content": r[0], "category": r[1], "importance": r[2], "weight": round(r[3], 2)}
        for r in rows
    ]

def insert_memories(facts: list):
    """批量插入新记忆"""
    conn = sqlite3.connect(DB)
    for f in facts:
        conn.execute("""
            INSERT INTO memories (content, category, importance, source_session, created_at, updated_at)
            VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
        """, (f["content"], f.get("category", "user_fact"), f.get("importance", 3), ""))
    conn.commit()
    conn.close()

def ensure_table():
    conn = sqlite3.connect(DB)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS memories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            content TEXT NOT NULL,
            category TEXT DEFAULT 'user_fact',
            importance INTEGER DEFAULT 3,
            source_session TEXT,
            created_at TEXT,
            updated_at TEXT
        )
    """)
    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_memories_category ON memories(category)
    """)
    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_memories_importance ON memories(importance)
    """)
    conn.commit()
    conn.close()

def _extract_keywords(text: str) -> list:
    """简单关键词提取：取 2-4 字的 CJK 片段"""
    import re
    # 去掉标点和英文
    clean = re.sub(r'[^一-鿿]', '', text)
    keywords = []
    for i in range(len(clean)-1):
        for size in [2, 3, 4]:
            if i + size <= len(clean):
                keywords.append(clean[i:i+size])
    # 按频率排，取前 10
    from collections import Counter
    return [kw for kw, _ in Counter(keywords).most_common(10)]
```

---

## 五、一次完整请求的执行流程

```
用户输入 "读一下 D:/project/main.cpp 这个文件，看看渲染循环那边有什么问题"
  │
  ▼
┌─ MioHarness.process() ──────────────────────────────────────┐
│                                                              │
│  Step 1: search_memories("渲染循环...")                       │
│    → 关键词: ["渲染", "渲染循环", "循环", "main", "cpp"]       │
│    → SQLite 返回 0 条（第一次聊这个话题）                      │
│    → memories = []                                           │
│                                                              │
│  Step 2: _assemble()                                         │
│    → Slot 0: meta_instruction (~80 tokens)                  │
│    → Slot 1: soul + boundaries (~1100 tokens)               │
│    → Slot 2: knowledge (~450 tokens)                        │
│    → Slot 3: tools (~500 tokens, Pi 注入)                    │
│    → Slot 4: （空，跳过）                                     │
│    → Slot 5: chat_history（空的，这是第一轮）                  │
│    → Slot 6: language_anchor (~50 tokens)                   │
│    → Slot 7: （空，跳过）                                     │
│    → Slot 8: "读一下 D:/project/main.cpp..."                │
│                                                              │
│  Step 3: _call_deepseek(prompt)                             │
│    → 澪号返回: "行。看看。"（短句，直接）                      │
│    → 附带了 tool_call: read("D:/project/main.cpp")          │
│                                                              │
│  Step 4: _is_tool_call() → True                             │
│    → 直接返回，让 Pi 执行 read 工具                            │
│    → 本轮不跑计数器（工具调用不是对话输出）                     │
└──────────────────────────────────────────────────────────────┘
  │
  ▼
Pi 执行 read("D:/project/main.cpp")
文件内容 3000 字 → 作为 tool_result 返回
  │
  ▼
第二轮自动触发（Pi 把 tool_result 追加到 chat_history）
  │
  ▼
┌─ MioHarness.process() ──────────────────────────────────────┐
│                                                              │
│  Step 1: search_memories("渲染循环...")                       │
│    → 仍然 0 条                                               │
│                                                              │
│  Step 2: _assemble()                                         │
│    → Slot 0-4: 同上                                          │
│    → 检测到 chat_history 最后一条是 tool_result (3000 字)     │
│      → _last_tool_result_is_long() = True                    │
│      → 在 chat_history 之前注入 language_anchor               │
│    → Slot 6: language_anchor (~50 tokens)                   │
│    → Slot 7: （空）                                          │
│    → Slot 8: 用户消息（Pi 自动追加的 tool_result 上下文）      │
│                                                              │
│  Step 3: _call_deepseek(prompt)                             │
│    → 澪号看到语言锚在最靠近输出的位置                           │
│    → 澪号: "这个渲染循环的 present 调用放在 swap 之前了。        │
│             换一下顺序就行。（）"                              │
│    → 短句、逗号拼接、括号吐槽、不叠甲——语言指纹完好             │
│                                                              │
│  Step 4: _is_tool_call() → False                            │
│                                                              │
│  Step 5: check_all(response, chat_history)                   │
│    → 叠甲: 0 个叠甲词 → OK                                   │
│    → emoji: 0 个 → OK                                       │
│    → 感叹号: 0 个 → OK                                       │
│    → 话痨: 72 字 → OK                                        │
│    → 亲密溢出: 无敏感词 → OK                                  │
│    → 全绿 → 直接输出                                         │
└──────────────────────────────────────────────────────────────┘
  │
  ▼
用户看到回复。对话继续...

══════════════════════════════════════════════════

... 30 轮后，用户关闭对话 ...

  │
  ▼
Pi 触发 on_session_end 事件
  │
  ▼
┌─ MioHarness.post_conversation() ────────────────────────────┐
│                                                              │
│  收集本轮对话全文                                             │
│    → Pi JSONL → 拼接为一个字符串                              │
│                                                              │
│  _call_deepseek(                                             │
│    system = "从以下对话中提取值得长期保存的信息...",            │
│    user_message = 《完整对话》                                 │
│  )                                                           │
│    → 独立的 API 调用，不受澪号人格限制                         │
│    → 返回: [                                                 │
│        {"content":"Mirror 的渲染循环中 present 在 swap 之前",  │
│         "category":"technical","importance":3}               │
│      ]                                                       │
│                                                              │
│  insert_memories(facts)                                      │
│    → INSERT INTO memories ...                                │
└──────────────────────────────────────────────────────────────┘
```

---

## 六、需要新建/修改的文件总览

| 文件 | 操作 | 做什么 |
|------|------|--------|
| `mio-harness/character/soul.md` | 新建 | 人格叙事（已有系统提示词改一下） |
| `mio-harness/character/boundaries.md` | 新建 | 硬边界（从系统提示词拆出来） |
| `mio-harness/character/language.md` | 新建 | 完整语言指纹 |
| `mio-harness/character/knowledge.md` | 新建 | 领域知识 |
| `mio-harness/meta_instruction.txt` | 新建 | Slot 0 元指令 |
| `mio-harness/tools_stub.txt` | 新建 | Pi 工具层占位 |
| `mio-harness/harness.py` | 新建 | MioHarness 类（~150 行） |
| `mio-harness/counters.py` | 新建 | 5 个计数器（~50 行） |
| `mio-harness/memory.py` | 新建 | SQLite 记忆存取（~70 行） |
| `mio-harness/extractor.py` | 新建 | 对话后记忆提取（~30 行） |
| `extensions/pa-mio/index.ts` | 新建 | Pi 扩展入口（~40 行） |
| `.pi/settings.json` | 修改 | systemPrompt 指向 harness |
| `%USERPROFILE%\.personal-agent\agent.db` | 修改 | 加 memories 表 |

**共计 9 个新文件 + 2 个修改。总代码量约 400 行 Python + 40 行 TypeScript。**
