# Personal Agent — 设计文档：澪号 Harness

## pa-mio 扩展设计

核心机制：9-Slot Prompt 注入 + 5 计数器反馈校验 + JSON 记忆系统。

## Prompt 注入顺序（9 个 Slot）

| Slot | 内容 | 来源 | 性质 |
|------|------|------|------|
| 0 | 元指令（身份 > 工具） | `meta_instruction.txt` | 静态 |
| 1 | 身份层（soul + boundaries） | `soul.md` + `boundaries.md` | 静态 |
| 2 | 知识层 | `knowledge.md` | 静态 |
| 3 | 运行环境（Pi 原生提示词 + 工具定义） | Pi 注入 | 动态 |
| 4 | 记忆层 | `mio_memories.json` 检索 | 按需 |
| 5 | Chat History | Pi 管理 | 动态 |
| 6 | 语言锚（~50 tokens） | 硬编码 | 静态（最靠近输出） |
| 7 | 修正槽 | 计数器触发时注入 | 按需 |
| 8 | 用户消息 | 用户输入 | 动态 |

## 5 个计数器（字符级，不跑 LLM）

| # | 检测项 | 规则 | 修正指令 |
|---|--------|------|---------|
| 1 | 叠甲 | ≥2 个叠甲词 | 不叠甲，有观点直接说 |
| 2 | emoji 溢出 | ≥3 个 emoji | 不使用 emoji |
| 3 | 感叹号溢出 | ≥2 个！ | 不用感叹号 |
| 4 | 话痨 | >200 字 | 短句 |
| 5 | 亲密溢出 | <10 轮出现 hhh/嗯嗯/摸摸 | 不够熟，克制 |

## 记忆系统

- 存储：`~/.personal-agent/mio_memories.json`（JSON 数组，最多 500 条）
- 检索：CJK 2-4 字关键词 → 包含匹配 → 衰减权重 `importance × e^(-0.05×天数)` → top 5
- 提取：对话 >10 条后，独立 DeepSeek 调用提取 → 写入 JSON

## 关键设计决策

- Pi 原生 systemPrompt 退化为 Slot 3 内的 `[运行环境]` 标签，不与澪号身份竞争权重
- Slot 0-3 形成静态前缀（~2100 tokens），可被 Prompt Cache 命中
- Slot 6 语言锚在 Chat History 之后、用户消息之前——注意力权重最高
- 长工具返回（>500字）时自动在 history 前额外插入语言锚，对抗稀释

## 文件清单

| 文件 | 用途 |
|------|------|
| `mio-harness/character/soul.md` | 人格叙事 + 外观 |
| `mio-harness/character/boundaries.md` | 硬边界 |
| `mio-harness/character/language.md` | 语言指纹 |
| `mio-harness/character/knowledge.md` | 领域知识 |
| `mio-harness/meta_instruction.txt` | Slot 0 元指令 |
| `mio-harness/tools_stub.txt` | Slot 3 工具层占位 |
| `extensions/pa-mio/index.ts` | Pi 扩展 |

---

**相关文档**：
- 扩展设计概览 → `01-extensions.md`
- 架构债务（pa-observe 复制计数器问题） → `04-debt-extensions.md`
- 角色卡 → `../../mio-data/character-v1.md`
