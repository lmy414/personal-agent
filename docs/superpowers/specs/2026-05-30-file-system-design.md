# 文件系统面板 — 设计 Spec

## 目标

让右侧面板的文件树和文档预览真正可用，打通 `FileTree → bridge → DocPreview` 数据管线。新增文件拖入对话框引用功能。

## 架构

每个扩展通过 `agent.subscribe(type, handler)` 订阅自己关心的 WS 消息，状态完全自治。删掉扩展文件夹不影响任何其他代码。

```
FileTree ──send('file.list')──→ bridge ──file.list──→ subscribe('file.list') → 更新自身 tree
  │
  └─点击文件──send('file.read')──→ bridge ──file.content──→ subscribe('file.content')
                                                                  ├─→ DocPreview 更新内容
                                                                  └─→ ChatRenderer 附件系统（如拖入）
```

## 协议（不变）

现有 `file.list` / `file.content` / `file.read` 消息类型不变。新增 `file.read` 支持 `encoding: 'utf8' | 'base64'` 参数，图片用 base64，文本用 utf8。

## 改动详解

### 1. useAgent.tsx — 新增 subscribe 机制

新增 `Map<string, Set<(msg) => void>>` 监听器表。在 `handleServerMessage` 处理完内置 case 后，dispatch 给匹配的订阅者。返回 unsubscribe 函数。

```ts
subscribe: (type: string, handler: (msg: ServerMessage) => void) => () => void
```

AgentContextValue 和 useAgent 返回值都新增 `subscribe`。

### 2. FileTree.tsx — 完全重写

- `onMount` 时 send `file.list` 加载根目录
- subscribe `file.list` 响应更新树数据
- 点击目录 → send `file.list` 加载子目录内容
- 点击文件 → send `file.read`（utf8）
- 空状态：加载中显示占位，目录为空显示"空目录"
- `onCleanup` 取消订阅
- 树节点支持 `draggable`，drag data 包含文件路径和名称

### 3. DocPreview.tsx — 完全重写

- subscribe `file.content` 和 `file.content.image` 消息
- 非图片文件：`content` 信号存文本，`language` 信号存扩展名，`filePath` 信号存路径
- 图片文件：`imageBase64` 信号存 base64，`imageType` 存 MIME
- 按扩展名决定默认模式：

| 扩展名 | 默认模式 | 可切换 |
|--------|---------|--------|
| .md .mdx | 预览（marked 渲染） | 源码 |
| .ts .tsx .js .jsx .json .css .html .py .rs .go .yaml .yml .toml | 源码 | — |
| .png .jpg .jpeg .gif .svg .webp | 图片 | — |
| 其他 | 源码 | — |

- 右上角显示文件名
- 加载中状态：文件路径 + "加载中..."
- 空状态：无文件选中时显示"点击左侧文件树中的文件查看内容"
- onCleanup 取消订阅

### 4. ChatRenderer.tsx — 拖放支持

- 输入区容器绑定 `onDragOver` / `onDragLeave` / `onDrop`，拖入高亮边框
- `attachments: { path, name, content }[]` 维护已拖入文件列表
- `onDrop` 从 event.dataTransfer 读取文件路径，自动发 `file.read` 读取内容，subscribe 响应后加入附件
- 气泡拆分：
  - 显示用：用户文本 + 附件徽章 `[📎 foo.ts]`（不渲染文件内容）
  - WS 发送用：`用户文本\n\n[Attached files:\n\`\`\`typescript path/to/file\n// full content\n\`\`\`]`
- 用户文字为空 + 有附件时，文本默认用"请帮我分析这些文件"
- 发送后清空附件列表

### 5. bridge/handlers/file.ts — 路径安全

- 新增 `PROJECT_ROOT = path.resolve(__dirname, '../..')`（即项目根 `personal-agent/`）
- `resolveSafe(target): string` 函数检查路径边界
- `file.list` 和 `file.read` 中调用 `resolveSafe`
- `file.read` 支持 encoding 参数，图片用 base64

### 6. App.css — 新增样式

- `.file-tree-empty` — 空状态文字
- `.file-tree-loading` — 加载脉动
- `.chat-attachments` — 附件列表容器
- `.chat-attachment-badge` — 附件徽章（文件名 + 删除按钮）
- `.chat-input-area.drop-target` — 拖入高亮边框

## 错误处理

- 文件不存在 → bridge 返回 `FILE_ERROR`，前端 toast 显示错误信息
- 路径越界 → bridge 返回 `FILE_ERROR: Path out of bounds`
- 图片过大（>10MB）→ bridge 拒绝读取
- 目录读取失败 → 节点显示错误图标

## 不改动

- `bridge/protocol.ts`（消息类型不变）
- `bridge/dispatcher.ts`（路由表不变）
- `bridge/index.ts`
- `RightPanelTabs.tsx`
- 所有其他扩展

## 技术约束

- 每个扩展独立文件夹，互不 import
- subscribe 的 unsubscribe 必须在 onCleanup 中调用
- 不直接在组件中操作 DOM（除 drag/drop 事件绑定外）
- TypeScript strict mode
