# HTML 文档索引

> 本项目的可视化预览和归档设计文档以 HTML 形式存在。以下说明每个文件的用途和打开方式。

## mio-data/ 下的 HTML 预览文件

### `mio-data/preview.html`（1244 行）

**用途**：澪号角色卡 v1.1 的可视化预览页面。

**内容**：
- 角色基础信息卡片（头像占位、名称、属性标签）
- 成长环境面板
- 核心性格雷达图（外冷内热、技术自信、毒舌、低电量社交、括号吐槽）
- 知识领域三级清单（精通/熟悉/了解）
- 语言风格示例（句长节奏、标点系统、亲密标记）
- 行为准则对比表

**打开方式**：浏览器直接打开 `file:///D:/claude/personal-agent/mio-data/preview.html`

**技术**：纯 HTML + CSS，无 JavaScript 框架依赖，可直接在 Electron 中加载。

### `mio-data/preview-settings.html`（744 行）

**用途**：澪号系统设置面板预览。

**内容**：
- Prompt Slot 开关配置（Slot 0-8 独立启用/禁用）
- 计数器阈值调节（叠甲/emoj/感叹号/话痨/亲密溢出）
- 记忆系统参数（最大条数、衰减系数、提取触发条件）
- 语言锚强度滑块
- 实时 token 估算

**打开方式**：浏览器直接打开 `file:///D:/claude/personal-agent/mio-data/preview-settings.html`

## docs/archive/ 下的归档 HTML

这些文件是早期设计阶段的可视化原型，已归档保留：

| 文件 | 用途 | 状态 |
|------|------|------|
| `docs/archive/index.html` | 归档目录首页 | 历史参考 |
| `docs/archive/architecture.html` | 系统架构图（SVG） | 已合并到 DESIGN.md |
| `docs/archive/data-flow.html` | 数据流图（SVG） | 已合并到 DESIGN.md |
| `docs/archive/harness.html` | Harness 结构图 | 已合并到 02-mio-harness.md |
| `docs/archive/memory-design.html` | 记忆系统设计图 | 已合并到 02-mio-harness.md |
| `docs/archive/debug-panel-preview.html` | 流水线面板早期原型 | 已合并到 03-observe.md |

**阅读建议**：优先阅读 Markdown 拆分后的文档（`docs/design/`、`docs/state/`），HTML 归档文件仅在需要查看原始可视化设计时参考。

## 其他 HTML 文件

| 文件 | 用途 |
|------|------|
| `vendor/wgnr-pi/public/index.html` | wgnr-pi Web UI 主页面（汉化版） |
