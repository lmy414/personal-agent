# Personal Agent — 项目状态：澪号 Harness 系统

> 2026-05-27 部署

## 架构

```
wgnr-pi → Pi → pa-mio 扩展（TypeScript）
               ├── before_agent_start → 组装澪号 Prompt → 替换 systemPrompt
               ├── message_end → 5 个计数器检查
               ├── tool_execution_start/end → 工具执行进度反馈
               ├── agent_end → 记忆提取（DeepSeek 独立调用 → JSON 文件）
               └── session_start → 重置状态
```

**Prompt 注入顺序**（9 个 Slot）：
```
Slot 0: meta_instruction（身份 > 工具）
Slot 1: soul + boundaries（身份层）
Slot 2: knowledge（知识层）
Slot 3: [运行环境] Pi 原生提示词 + 工具定义
Slot 4: 记忆层（JSON 文件检索）
Slot 5: Chat History（Pi 管理）
Slot 6: 语言锚（50 tokens，最靠近输出）
Slot 7: 修正槽（计数器触发时注入）
Slot 8: 用户消息
```

## 关键设计

- Pi 原生提示词退化为 Slot 3 内的 `[运行环境]` 标签，不再作为独立 SYSTEM 块与澪号身份竞争
- 工具层在身份层之后——身份先立住，工具后补充
- 语言锚在 chat history 之后、用户消息之前——最靠近输出，注意力权重最高
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

## 记忆系统

- 存储：`~/.personal-agent/mio_memories.json`（最多 500 条）
- 检索：CJK 2-4 字片段提取关键词 → 匹配 → 衰减权重排序 `importance × e^(-0.05 × 天数)`
- 提取：对话结束后独立 DeepSeek API 调用（不受澪号人格限制）
- 触发条件：对话 >10 条消息 + 尚未提取过

## wgnr-pi Fork 修改

| Commit | 变更 |
|--------|------|
| `227f2b2` | 原始 wgnr-ai/wgnr-pi v1.5.2 |
| `cb0a429` | Windows 兼容 + 全中文汉化 + 流水线透视面板 + /api/observe_trace 端点 + 多项 bug 修复 |

---

**下一章**：
- 流水线透视面板 → `04-observe.md`
