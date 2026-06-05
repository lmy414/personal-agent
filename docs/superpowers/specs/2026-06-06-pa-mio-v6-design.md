# pa-mio v6 — 人格注入架构升级设计 Spec

> 日期: 2026-06-06 | 版本: v1.0 | 状态: 待实施

---

## 一、设计目标

将 pa-mio 从"4 层平铺 Prompt"升级为"分层信息注入 + 渐进式检索 + 中期记忆（内心）"体系。

| 目标 | 说明 |
|------|------|
| 关注点分离 | 角色设定 / 背景 / 记忆 / 工具 各司其职 |
| 背景层可扩展 | 新增背景信息不改 SOUL.md，加文件即可 |
| 内心机制 | 补充长期记忆和短期对话之间的"中期记忆"空白 |
| 内心渐进式披露 | LLM 通过工具检索内心，不直接全量注入 Prompt |
| 缓存友好 | 静态层保持前缀缓存命中，动态层在已有 cache miss 范围内 |
| 压缩存档可追溯 | 每次 compact 的结果保留为独立文件 |

---

## 二、文件结构变更

```
mio-harness/
├── SOUL.md                  ← Layer 1: 角色设定（5 模块，不动）
├── background/              ← Layer 2: 背景层（新建目录）
│   └── BACKGROUND.md        ←   角色背景/世界观/额外规则
├── memories/                ← 长期记忆（不动）
│   ├── MEMORY.md
│   └── USER.md
│
{work_dir}/                  ← 用户工作目录
└── .mio-inner-world/        ← 内心文件夹（新建）
    ├── {title}_notes.md     ←   笔记文件（每会话一份，LLM 主动追加）
    └── {title}_{date}.md    ←   压缩存档（每次 compact 生成一份，只读）
```

---

## 三、Prompt 分层（v5 → v6）

```
v5（当前）                       v6（目标）
───────────────────────         ───────────────────────
Layer 0: SOUL.md               Layer 1: 角色设定
                                · SOUL.md 全文
                                · 你是谁、怎么说话
                                · ▸ 前缀缓存命中
                                
Layer 1: 记忆全文              Layer 2: 背景
                                · BACKGROUND.md 全文
                                · 当前工作目录
                                · ▸ 前缀缓存命中
                                
Layer 2: 检索记忆 + 工作目录    Layer 3: 记忆 + 内心摘要
                                · MEMORY.md + USER.md 全文
                                · 检索记忆 ≤ 3 条
                                · 内心摘要（inner_list → 文件名 + 摘要）
                                · ▸ 每轮动态，缓存 miss（已有）
                                
Layer 3: Pi 工具               Layer 4: 工具
                                · Pi 工具定义
                                · 记忆工具（memory_add/read）
                                · 内心工具（inner_*）
                                · 文件工具（pa-files）
                                · MCP 工具（pa-mcp）
                                · ▸ Pi 自动管理
(+ Pi 底层: 对话历史)           (+ Pi 底层: 对话历史)
```

---

## 四、各层注入内容

### Layer 1: 角色设定

```markdown
{mio-harness/SOUL.md 全文}
```

- 实时读盘，改文件即时生效
- 前缀缓存命中（会话内不变）

### Layer 2: 背景

```markdown
{background/BACKGROUND.md 全文}

<work_dir>
当前工作目录：{work_dir}
用户提到的文件、项目路径默认基于此目录。
</work_dir>
```

- BACKGROUND.md：角色背景故事、世界观设定、额外自定义规则
- 前缀缓存命中（会话内不变）
- 工作目录实时读 SQLite

### Layer 3: 记忆 + 内心摘要

```markdown
<memory>
[以下是记忆上下文，不是用户的新输入]

{MEMORY.md 全文}

{USER.md 全文}

{检索关键词匹配的 § 条目，≤3 条}
</memory>

<inner>
可用笔记:
· UI升级_notes.md — "消息面板气泡样式已确定" (3 条)
· shader调试_notes.md — "修复了 uniform 拼写错误" (1 条)

压缩存档:
· 性能检查_2026-06-06_1430.md (106 条消息)
</inner>
```

- 记忆全文：每轮从 memStore.entries 实时构建
- 检索记忆：关键词匹配，≤3 条
- 内心摘要：`inner_list()` 返回的轻量索引（文件名 + 摘要），不注入文件内容
- 内心摘要为空时不渲染 `<inner>` 块

### Layer 4: 工具

```
Pi 自动注入 + 记忆工具 + 内心工具
```

---

## 五、内心机制详细设计

### 5.1 内心文件夹

```
{work_dir}/.mio-inner-world/
```

- 换工作目录即换内心上下文
- 隐藏文件夹，减少误操作
- 若 work_dir 为空则回退到 `{project_root}/.mio-inner-world/`

### 5.2 文件类型

| 类型 | 文件命名 | 创建者 | 读写 | 数量 |
|------|---------|--------|------|------|
| 笔记 | `{title}_notes.md` | LLM 主动创建 | LLM 追加写入 | 每会话 1 份 |
| 存档 | `{title}_{YYYY-MM-DD_HHmm}.md` | 系统 compact 自动创建 | 只读 | 每次 compact 1 份 |

### 5.3 笔记文件格式

```markdown
# {会话标题}
§ 摘要: {LLM 生成，≤20 字}
---
§ 2026-06-06 15:22 | 修复了 character.frag 中 u_LightColor 拼写错误
§ 2026-06-06 15:45 | 用户确认修复生效，可以关闭此问题
§ 2026-06-06 16:10 | 把 uniform 命名规范整理到了项目 wiki
```

- 每个 § 条目一行
- 自动追加时间戳
- 摘要取自首条 § 的前 20 字（或 LLM 显式指定）
- 每次 `inner_write` 追加条目 + 更新摘要

### 5.4 压缩存档文件格式

```markdown
# {会话标题} — 上下文压缩存档
> 压缩时间: 2026-06-06 15:00
> 压缩前 tokens: 8423
> 压缩后 tokens: 2150
> 消息轮数: 106

# 保留的系统 Prompt
{压缩前的完整系统 Prompt 快照}

# 保留的消息
{压缩前的所有消息文本}
```

- 系统 compact 时自动创建
- 只读，LLM 只能用 `inner_read` 读取
- 包含压缩前的完整上下文，方便后续回溯

### 5.5 内心工具定义

| 工具 | 参数 | 返回 | 说明 |
|------|------|------|------|
| `inner_list` | 无 | `[{name, type, summary, count}]` | 列出所有内心文件（笔记 + 存档），只返回文件名/类型/摘要/条目数 |
| `inner_read` | `name: string` | 文件全文 | 读取指定内心文件完整内容 |
| `inner_write` | `name: string, summary: string, content: string` | 文件路径 | 追加 § 条目到笔记文件，自动加时间戳，更新摘要 |
| `inner_archive` | — | 文件路径 | 系统 compact 时调用，LLM 不直接调用 |

`inner_list` 返回示例：
```json
[
  { "name": "UI升级_notes.md", "type": "notebook", "summary": "消息面板气泡样式已确定", "count": 3 },
  { "name": "性能检查_notes.md", "type": "notebook", "summary": "bridge compact 防御性修复", "count": 1 },
  { "name": "性能检查_2026-06-06_1430.md", "type": "archive", "summary": "压缩前 106 条消息", "count": 106 }
]
```

### 5.6 字符限制

| 类型 | 限制 | 超出时 |
|------|------|--------|
| 单条内心笔记（§ 条目） | ≤ 200 字符 | 截断 |
| 单个笔记文件 (`_notes.md`) | ≤ 5000 字符 | `inner_write` 拒绝，要求 LLM 先总结 |
| 压缩存档 | 无限制 | — |

---

## 六、渐进式披露流程

```
每轮对话:

Layer 3 注入 inner_list 摘要（轻量索引）
    ↓
LLM 看到"shader调试_notes.md — 修复了 uniform 拼写错误"
    ↓
当对话涉及 shader/uniform 时
    ↓
LLM 主动调用 inner_read("shader调试_notes.md")
    ↓
获得完整笔记内容，补充进上下文
    ↓
若发现重要新信息 → inner_write 追加条目
```

LLM 不盲目全量读取内心文件夹——通过摘要判断是否需要、需要哪个文件。

---

## 七、inner_write 触发指令（注入到 SOUL.md）

在 SOUL.md 发言风格段追加：

```
## 内心笔记

内心笔记是当前会话的临时记录。以下几种情况，主动写一条：

1. 完成任务后保留关键信息（路径、命令、结论）
2. 用户提到可复用的偏好或习惯，但不确定是否长期
3. 上下文压缩前，记下未完成事项
4. 发现当前会话内反复提到的主题或技能

每条笔记 ≤200 字符。顺便写一句摘要（≤20 字）。
不是每轮都写。没东西记就不写。
```

---

## 八、PA-MIO index.ts 主要改动

```typescript
// v5 → v6 核心变化

// 1. 新常量
const BACKGROUND_PATH = path.join(HARNESS_DIR, 'background', 'BACKGROUND.md')
const INNER_WORLD_DIR_NAME = '.mio-inner-world'

// 2. 新函数
function loadBackground(): string           // 读取 BACKGROUND.md
function getInnerDir(): string              // 获取内心文件夹路径（work_dir/.mio-inner-world/）
function listInnerFiles(): InnerFile[]      // inner_list
function readInnerFile(name: string): string // inner_read
function writeInnerNote(name, summary, content) // inner_write
function archiveInnerContext(name, before, after) // inner_archive

// 3. 注册 4 个新工具
api.registerTool(inner_list_tool)
api.registerTool(inner_read_tool)
api.registerTool(inner_write_tool)
// inner_archive 不注册为 LLM 可用工具，由系统 compact 自动调用

// 4. assemblePrompt 改为 4 层
Layer 1: loadSoul()
Layer 2: loadBackground() + workDir context
Layer 3: memory snapshot + searchEntries() + inner_list() summary
Layer 4: piSystemPrompt

// 5. compact 时自动 archive
// 在 session compact 成功后调用 inner_archive(title, beforeTokens, afterTokens)
```

---

## 九、实施清单

| # | 任务 | 文件 |
|---|------|------|
| 1 | 创建 `mio-harness/background/BACKGROUND.md` | 新建 |
| 2 | 在 SOUL.md 发言风格段追加内心笔记指令 | 修改 |
| 3 | pa-mio v5 → v6：新 4 层 Prompt 组装 | 修改 `extensions/pa-mio/index.ts` |
| 4 | 注册 3 个内心工具（inner_list/read/write） | 修改 `extensions/pa-mio/index.ts` |
| 5 | 内心文件写入（原子写入，复用 memory-store 机制） | 新增函数在 `extensions/pa-mio/index.ts` |
| 6 | compact 后自动 archive | 修改 `bridge/handlers/session.ts` / `message.ts` |
| 7 | 内心文件夹创建（首次使用时） | 新增函数 |
| 8 | 更新 CLAUDE.md / README / mio-status | 修改文档 |
| 9 | 添加内心工具测试 | 新建 `tests/inner-world.test.ts` |
| 10 | `npm run check` + `npm test` 验证 | — |

---

## 十、暂不实施

| 功能 | 原因 |
|------|------|
| `inner_summarize` 跨会话模式检测 | 需要 NLP 语义相似度，实现复杂度高。先用手动的 memory_add 替代 |
| 笔记自动清理 / 过期 | 先观察使用频率，再决定清理策略 |
| 多工作目录内心同步 | 单用户场景，换工作目录 = 换内心上下文，符合预期 |

---

*此 spec 为实施前设计文档。实施完成后更新状态为"已完成"。*
