# 文件系统面板 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 打通 FileTree → bridge → DocPreview 数据管线，新增文件拖入对话框引用 AI 功能

**Architecture:** useAgent 新增通用 subscribe 机制，每个扩展独立订阅 WS 消息管理自身状态。bridge file.ts 加路径安全检查。扩展间通过 WS 消息松耦合，互不 import。

**Tech Stack:** SolidJS, TypeScript strict, Node.js fs, marked (已有)

---

### Task 1: Bridge 路径安全 + 图片 base64 支持

**Files:**
- Modify: `bridge/handlers/file.ts:1-63`
- Modify: `bridge/protocol.ts:23` (file.read 加 encoding 参数)

- [ ] **Step 1: 修改 protocol 给 file.read 加 encoding 参数**

修改 `bridge/protocol.ts:23`：
```ts
// before:
| ClientMsg<'file.read', { path: string }>
// after:
| ClientMsg<'file.read', { path: string; encoding?: 'utf8' | 'base64' }>
```

- [ ] **Step 2: 重写 file.ts 加入路径安全检查和 base64 支持**

用以下内容完全替换 `bridge/handlers/file.ts`：

```ts
import type { WebSocket } from 'ws'
import type { ClientMessage } from '../protocol'
import { readdirSync, statSync, readFileSync, existsSync } from 'fs'
import { join, resolve, normalize } from 'path'

const PROJECT_ROOT = resolve(join(__dirname, '..', '..'))

function resolveSafe(targetPath: string): string {
  const resolved = resolve(normalize(targetPath))
  if (!resolved.startsWith(PROJECT_ROOT + '/') && resolved !== PROJECT_ROOT) {
    throw new Error(`Path out of bounds: ${targetPath}`)
  }
  return resolved
}

export function handleFileList(msg: ClientMessage, ws: WebSocket): void {
  const payload = msg.payload as { path?: string }
  const rawPath = payload.path ?? '.'
  try {
    const safePath = resolveSafe(rawPath)
    const entries = readdirSync(safePath).map((name) => {
      const fullPath = join(safePath, name)
      const s = statSync(fullPath)
      return {
        name,
        type: s.isDirectory() ? ('directory' as const) : ('file' as const),
        size: s.isFile() ? s.size : undefined,
      }
    })
    entries.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
      return a.name.localeCompare(b.name)
    })

    ws.send(JSON.stringify({
      type: 'file.list',
      id: `srv-${Date.now()}`,
      sessionId: msg.sessionId,
      ts: Date.now(),
      payload: { path: safePath, entries },
    }))
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    ws.send(JSON.stringify({
      type: 'error',
      id: `srv-${Date.now()}`,
      sessionId: msg.sessionId,
      ts: Date.now(),
      payload: { code: 'FILE_ERROR', message, recoverable: true },
    }))
  }
}

export function handleFileRead(msg: ClientMessage, ws: WebSocket): void {
  const payload = msg.payload as { path: string; encoding?: 'utf8' | 'base64' }
  try {
    const safePath = resolveSafe(payload.path)
    if (!existsSync(safePath)) {
      throw new Error(`File not found: ${payload.path}`)
    }

    const stat = statSync(safePath)
    if (stat.isFile() && stat.size > 10 * 1024 * 1024) {
      throw new Error('File too large (>10MB)')
    }

    const encoding = payload.encoding ?? 'utf8'
    const content = readFileSync(safePath, encoding === 'base64' ? { encoding: 'base64' } : 'utf-8')
    const ext = safePath.split('.').pop() ?? ''

    ws.send(JSON.stringify({
      type: 'file.content',
      id: `srv-${Date.now()}`,
      sessionId: msg.sessionId,
      ts: Date.now(),
      payload: { path: safePath, content, language: ext, encoding },
    }))
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    ws.send(JSON.stringify({
      type: 'error',
      id: `srv-${Date.now()}`,
      sessionId: msg.sessionId,
      ts: Date.now(),
      payload: { code: 'FILE_ERROR', message, recoverable: true },
    }))
  }
}
```

- [ ] **Step 3: 验证 TypeScript 编译**

```bash
cd D:\claude\personal-agent\bridge && npx tsc --noEmit
```
Expected: 无错误（忽略 vendor/pi 的预存错误）

- [ ] **Step 4: 提交**

```bash
git add bridge/handlers/file.ts bridge/protocol.ts
git commit -m "feat: file handler 路径安全检查 + base64 图片支持"
```

---

### Task 2: useAgent 新增 subscribe 机制

**Files:**
- Modify: `frontend/src/shell/useAgent.tsx:41-55` (AgentContextValue 接口)
- Modify: `frontend/src/shell/useAgent.tsx:443-456` (value 对象)
- Modify: `frontend/src/shell/useAgent.tsx:362` (handleServerMessage 末尾 dispatch)

- [ ] **Step 1: 在 useAgent.tsx 顶部添加 listener 表和 ServerMessage 导入**

在 `useAgent.tsx` 文件顶部，import 中确认已导入 `ServerMessage`：
```ts
import type { ServerMessage, StatusPayload, SessionInfo } from '@bridge/protocol'
```

在 `AgentProvider` 函数体内（`connect()` 调用之前）添加：
```ts
const msgListeners = new Map<string, Set<(msg: ServerMessage) => void>>()

const subscribe = (type: string, handler: (msg: ServerMessage) => void): (() => void) => {
  let set = msgListeners.get(type)
  if (!set) {
    set = new Set()
    msgListeners.set(type, set)
  }
  set.add(handler)
  return () => {
    set?.delete(handler)
    if (set?.size === 0) msgListeners.delete(type)
  }
}
```

- [ ] **Step 2: 在 AgentContextValue 接口添加 subscribe**

修改 `AgentContextValue` 接口（约第 41-54 行），添加：
```ts
export interface AgentContextValue {
  // ... 现有字段 ...
  subscribe: (type: string, handler: (msg: ServerMessage) => void) => (() => void)
}
```

- [ ] **Step 3: 在 handleServerMessage 末尾 dispatch 到订阅者**

在 `handleServerMessage` 函数末尾的 `}` 闭合之前（约第 361 行，`error` case 后面），添加 dispatch 逻辑：
```ts
// dispatch to extension subscribers
const subs = msgListeners.get(msg.type)
if (subs) {
  subs.forEach((fn) => fn(msg))
}
```

- [ ] **Step 4: 在 value 对象中加入 subscribe**

修改 `AgentProvider` 内 `value` 对象（约第 443 行），添加：
```ts
const value: AgentContextValue = {
  // ... 现有字段 ...
  subscribe,
}
```

- [ ] **Step 5: 验证 TypeScript 编译**

```bash
cd D:\claude\personal-agent\frontend && npx tsc --noEmit
```
Expected: 无错误

- [ ] **Step 6: 提交**

```bash
git add frontend/src/shell/useAgent.tsx
git commit -m "feat: useAgent 新增通用 subscribe 机制"
```

---

### Task 3: FileTree 完全重写

**Files:**
- Rewrite: `frontend/src/extensions/file-tree/FileTree.tsx`

- [ ] **Step 1: 用以下内容完全替换 FileTree.tsx**

```tsx
import { createSignal, For, Show, onMount, onCleanup } from 'solid-js'
import { useAgent } from '@/shell/useAgent'
import type { FileEntry, ServerMessage } from '@bridge/protocol'

interface TreeNode {
  name: string
  type: 'file' | 'directory'
  path: string
  children?: TreeNode[]
  loaded: boolean
  empty: boolean
}

const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico'])

function fileIcon(name: string, type: 'file' | 'directory'): string {
  if (type === 'directory') return '📁'
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  if (ext === 'md' || ext === 'mdx') return '📝'
  if (ext === 'ts' || ext === 'tsx' || ext === 'js' || ext === 'jsx') return '🟦'
  if (ext === 'json') return '{}'
  if (ext === 'css') return '🎨'
  if (ext === 'html') return '🌐'
  if (ext === 'py' || ext === 'rs' || ext === 'go') return '⚙️'
  if (IMAGE_EXTS.has(ext)) return '🖼️'
  return '📄'
}

export function FileTree() {
  const agent = useAgent()
  const [tree, setTree] = createSignal<TreeNode[]>([])
  const [loading, setLoading] = createSignal(true)
  const [error, setError] = createSignal<string | null>(null)

  const loadDir = (path: string): TreeNode[] | null => {
    // returns children for a node, or null if not loaded
    // This is called when expanding a directory
    return null // handled via send + subscribe
  }

  let unsub: (() => void) | null = null

  onMount(() => {
    unsub = agent.subscribe('file.list', (msg: ServerMessage) => {
      const payload = msg.payload as { path: string; entries: FileEntry[] }
      const entries: TreeNode[] = payload.entries
        .filter((e) => !e.name.startsWith('.') || e.name === '.gitignore')
        .map((e) => ({
          name: e.name,
          type: e.type,
          path: payload.path ? `${payload.path}/${e.name}`.replace(/\/\//g, '/') : e.name,
          loaded: false,
          empty: false,
        }))

      setTree((prev) => {
        if (prev.length === 0) return entries
        // merge into existing tree
        const updateNode = (nodes: TreeNode[]): TreeNode[] =>
          nodes.map((n) => {
            if (n.path === payload.path || (n.path === payload.path.replace(/\/$/, ''))) {
              return { ...n, children: entries, loaded: true, empty: entries.length === 0 }
            }
            if (n.children) return { ...n, children: updateNode(n.children) }
            return n
          })
        return updateNode(prev)
      })
      setLoading(false)
    })

    // also listen for file.content to auto-switch to preview tab
    const unsubContent = agent.subscribe('file.content', (_msg: ServerMessage) => {
      window.dispatchEvent(new CustomEvent('switch-right-tab', { detail: 'preview' }))
    })

    // listen for errors
    const unsubError = agent.subscribe('error', (msg: ServerMessage) => {
      const payload = msg.payload as { code: string; message: string }
      if (payload.code === 'FILE_ERROR') {
        setError(payload.message)
        setTimeout(() => setError(null), 3000)
      }
    })

    onCleanup(() => {
      unsub?.()
      unsubContent?.()
      unsubError?.()
    })

    agent.send('file.list', {})
  })

  const handleClick = (node: TreeNode, e: MouseEvent) => {
    e.stopPropagation()
    if (node.type === 'directory') {
      if (!node.loaded) {
        agent.send('file.list', { path: node.path })
      }
      // toggle expand by updating children visibility via signal
      setTree((prev) => toggleExpand(prev, node.path))
    } else {
      const ext = node.name.split('.').pop()?.toLowerCase() ?? ''
      const isImage = IMAGE_EXTS.has(ext)
      agent.send('file.read', { path: node.path, encoding: isImage ? 'base64' : 'utf8' })
    }
  }

  const toggleExpand = (nodes: TreeNode[], path: string): TreeNode[] =>
    nodes.map((n) => {
      if (n.path === path) {
        if (!n.loaded) return n // will be updated by subscribe
        const wasExpanded = n.children !== undefined
        return wasExpanded ? { ...n, children: undefined } : { ...n, children: n.children ?? undefined }
      }
      if (n.children) return { ...n, children: toggleExpand(n.children, path) }
      return n
    })

  const handleDragStart = (node: TreeNode, e: DragEvent) => {
    e.dataTransfer?.setData('text/plain', node.path)
    e.dataTransfer?.setData('application/x-file-path', node.path)
    e.dataTransfer?.setData('application/x-file-name', node.name)
    e.dataTransfer!.effectAllowed = 'copy'
  }

  const RenderNode = (props: { node: TreeNode; depth: number }) => {
    const isExpanded = () => props.node.children !== undefined

    return (
      <>
        <div
          class="file-tree-item"
          classList={{ dir: props.node.type === 'directory' }}
          style={{ 'padding-left': `${props.depth * 16 + 4}px` }}
          draggable={props.node.type === 'file'}
          onDragStart={(e) => handleDragStart(props.node, e)}
          onClick={(e) => handleClick(props.node, e)}
        >
          <span class="ft-icon">
            {props.node.type === 'directory'
              ? (isExpanded() ? '📂' : '📁')
              : fileIcon(props.node.name, 'file')}
          </span>
          <span class="ft-name">{props.node.name}</span>
        </div>
        <Show when={props.node.type === 'directory' && isExpanded()}>
          <Show when={props.node.children && props.node.children.length > 0} fallback={
            <div class="file-tree-empty" style={{ 'padding-left': `${(props.depth + 1) * 16 + 4}px` }}>
              空目录
            </div>
          }>
            <For each={props.node.children!}>
              {(child) => <RenderNode node={child} depth={props.depth + 1} />}
            </For>
          </Show>
        </Show>
      </>
    )
  }

  return (
    <div class="file-tree">
      <Show when={!loading()} fallback={
        <div class="file-tree-loading">加载中...</div>
      }>
        <Show when={!error()} fallback={
          <div class="file-tree-error">{error()}</div>
        }>
          <Show when={tree().length > 0} fallback={
            <div class="file-tree-empty">空目录</div>
          }>
            <For each={tree()}>
              {(node) => <RenderNode node={node} depth={0} />}
            </For>
          </Show>
        </Show>
      </Show>
    </div>
  )
}
```

- [ ] **Step 2: 验证 TypeScript 编译**

```bash
cd D:\claude\personal-agent\frontend && npx tsc --noEmit
```
Expected: 无错误

- [ ] **Step 3: 提交**

```bash
git add frontend/src/extensions/file-tree/FileTree.tsx
git commit -m "feat: FileTree 动态加载 + 拖拽支持"
```

---

### Task 4: DocPreview 完全重写

**Files:**
- Rewrite: `frontend/src/extensions/doc-preview/DocPreview.tsx`

- [ ] **Step 1: 用以下内容完全替换 DocPreview.tsx**

```tsx
import { createSignal, Show, onMount, onCleanup } from 'solid-js'
import { useAgent } from '@/shell/useAgent'
import { marked } from 'marked'
import type { ServerMessage } from '@bridge/protocol'

marked.setOptions({ breaks: true, gfm: true })

const MARKDOWN_EXTS = new Set(['md', 'mdx'])
const CODE_EXTS = new Set([
  'ts', 'tsx', 'js', 'jsx', 'json', 'css', 'html', 'py', 'rs', 'go',
  'yaml', 'yml', 'toml', 'xml', 'sql', 'sh', 'bash', 'env', 'gitignore',
])
const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico'])

type PreviewMode = 'rendered' | 'source'

export function DocPreview() {
  const agent = useAgent()
  const [viewMode, setViewMode] = createSignal<PreviewMode>('source')
  const [content, setContent] = createSignal('')
  const [filePath, setFilePath] = createSignal('')
  const [language, setLanguage] = createSignal('')
  const [imageSrc, setImageSrc] = createSignal('')
  const [loading, setLoading] = createSignal(false)
  const [isMarkdown, setIsMarkdown] = createSignal(false)

  let unsubContent: (() => void) | null = null

  onMount(() => {
    unsubContent = agent.subscribe('file.content', (msg: ServerMessage) => {
      const payload = msg.payload as {
        path: string
        content: string
        language: string
        encoding?: 'utf8' | 'base64'
      }
      setFilePath(payload.path)
      setLanguage(payload.language)
      setLoading(false)

      const ext = payload.language.toLowerCase()
      if (payload.encoding === 'base64' || IMAGE_EXTS.has(ext)) {
        const mimeMap: Record<string, string> = {
          png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
          gif: 'image/gif', svg: 'image/svg+xml', webp: 'image/webp',
          ico: 'image/x-icon',
        }
        const mime = mimeMap[ext] ?? 'image/png'
        setImageSrc(`data:${mime};base64,${payload.content}`)
        setContent('')
        setIsMarkdown(false)
        setViewMode('source')
      } else {
        setContent(payload.content)
        setImageSrc('')
        if (MARKDOWN_EXTS.has(ext)) {
          setIsMarkdown(true)
          setViewMode('rendered')
        } else {
          setIsMarkdown(false)
          setViewMode('source')
        }
      }
    })

    onCleanup(() => {
      unsubContent?.()
    })
  })

  const fileName = () => {
    if (!filePath()) return ''
    return filePath().split('/').pop() ?? filePath()
  }

  return (
    <>
      <Show when={filePath()}>
        <div
          style={{
            'font-size': '11px',
            color: 'var(--text-muted)',
            'margin-bottom': '8px',
            'white-space': 'nowrap',
            overflow: 'hidden',
            'text-overflow': 'ellipsis',
          }}
        >
          {fileName()}
        </div>
      </Show>

      <Show when={isMarkdown()}>
        <div class="view-toggle">
          <button
            class="view-toggle-btn"
            classList={{ active: viewMode() === 'rendered' }}
            onClick={() => setViewMode('rendered')}
          >
            预览
          </button>
          <button
            class="view-toggle-btn"
            classList={{ active: viewMode() === 'source' }}
            onClick={() => setViewMode('source')}
          >
            源码
          </button>
        </div>
      </Show>

      <Show
        when={filePath()}
        fallback={
          <div style="font-size:12px;color:var(--text-muted);text-align:center;margin-top:32px;">
            点击左侧文件树中的文件查看内容
          </div>
        }
      >
        <Show when={!loading()} fallback={
          <div style="font-size:12px;color:var(--text-muted);text-align:center;margin-top:16px;">
            加载中...
          </div>
        }>
          <Show when={imageSrc()}>
            <img
              src={imageSrc()}
              alt={fileName()}
              style="max-width:100%;border-radius:6px;"
            />
          </Show>
          <Show when={!imageSrc() && viewMode() === 'rendered'}>
            <div class="preview-rendered" innerHTML={marked.parse(content()) as string} />
          </Show>
          <Show when={!imageSrc() && viewMode() === 'source'}>
            <pre class="preview-source">{content()}</pre>
          </Show>
        </Show>
      </Show>
    </>
  )
}
```

- [ ] **Step 2: 验证 TypeScript 编译**

```bash
cd D:\claude\personal-agent\frontend && npx tsc --noEmit
```
Expected: 无错误

- [ ] **Step 3: 提交**

```bash
git add frontend/src/extensions/doc-preview/DocPreview.tsx
git commit -m "feat: DocPreview 订阅渲染 + markdown/代码/图片支持"
```

---

### Task 5: ChatRenderer 拖放文件引用

**Files:**
- Modify: `frontend/src/extensions/chat-renderer/ChatRenderer.tsx`

- [ ] **Step 1: 重写 ChatRenderer.tsx**

用以下内容完全替换 `ChatRenderer.tsx`：

```tsx
import { For, createEffect, createSignal, onCleanup } from 'solid-js'
import { useAgent } from '@/shell/useAgent'
import { marked } from 'marked'

marked.setOptions({ breaks: true, gfm: true })

function renderMarkdown(text: string): string {
  return marked.parse(text) as string
}

interface Attachment {
  path: string
  name: string
  content: string
}

const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'])

export function ChatRenderer() {
  const agent = useAgent()
  const [content, setContent] = createSignal('')
  const [attachments, setAttachments] = createSignal<Attachment[]>([])
  const [dragOver, setDragOver] = createSignal(false)
  let scrollRef!: HTMLDivElement
  let textareaRef!: HTMLTextAreaElement
  let unsubFile: (() => void) | null = null
  let pendingFilePath: string | null = null

  createEffect(() => {
    void agent.messages().length
    void agent.sessionId()
    if (scrollRef) {
      scrollRef.scrollTop = scrollRef.scrollHeight
    }
  })

  // subscribe for file.content (from drag-drop or FileTree click)
  createEffect(() => {
    const agentRef = agent // access once to track dependency
    void agentRef
    if (unsubFile) unsubFile()
    unsubFile = agent.subscribe('file.content', (msg: any) => {
      const payload = msg.payload as { path: string; content: string; language: string; encoding?: string }
      if (!pendingFilePath) return
      const name = payload.path.split('/').pop() ?? payload.path
      setAttachments((prev) => {
        if (prev.some((a) => a.path === payload.path)) return prev
        return [...prev, { path: payload.path, name, content: payload.content }]
      })
      pendingFilePath = null

      // auto focus textarea after drop
      textareaRef?.focus()
    })
  })

  onCleanup(() => {
    unsubFile?.()
  })

  const handleSend = () => {
    const text = content().trim()
    const atts = attachments()
    if (!text && atts.length === 0) return

    // build display message (short) and send message (full)
    if (atts.length > 0) {
      const badges = atts.map((a) => `[📎 ${a.name}]`).join(' ')
      const displayText = text || '请帮我分析这些文件'
      const fullText = text
        ? `${text}\n\n[Attached files:]\n${atts.map((a) => {
            const ext = a.name.split('.').pop() ?? ''
            const isImg = IMAGE_EXTS.has(ext.toLowerCase())
            if (isImg) return `![${a.name}](${a.path})`
            return `\`\`\`${ext} ${a.name}\n${a.content}\n\`\`\``
          }).join('\n\n')}`
        : `${atts.map((a) => {
            const ext = a.name.split('.').pop() ?? ''
            const isImg = IMAGE_EXTS.has(ext.toLowerCase())
            if (isImg) return `![${a.name}](${a.path})`
            return `请帮我分析这个文件:\n\`\`\`${ext} ${a.name}\n${a.content}\n\`\`\``
          }).join('\n\n')}`

      // set user message display
      agent.send('message.send', { content: fullText, displayContent: displayText + ' ' + badges })
      setAttachments([])
    } else {
      agent.send('message.send', { content: text })
    }

    setContent('')
    if (textareaRef) {
      textareaRef.style.height = 'auto'
    }
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleInput = () => {
    const el = textareaRef
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
    setDragOver(true)
  }

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
  }

  const handleDrop = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)

    const path = e.dataTransfer?.getData('application/x-file-path')
      || e.dataTransfer?.getData('text/plain')

    // handle OS file drop (File objects)
    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0]
      const reader = new FileReader()
      reader.onload = () => {
        const result = reader.result as string
        setAttachments((prev) => {
          if (prev.some((a) => a.name === file.name)) return prev
          return [...prev, { path: file.name, name: file.name, content: result }]
        })
        textareaRef?.focus()
      }
      reader.readAsDataURL(file)
      return
    }

    if (!path) return

    // handle internal FileTree drag: read via bridge
    pendingFilePath = path
    const ext = path.split('.').pop()?.toLowerCase() ?? ''
    const isImage = IMAGE_EXTS.has(ext)
    agent.send('file.read', { path, encoding: isImage ? 'base64' : 'utf8' })
  }

  const removeAttachment = (path: string) => {
    setAttachments((prev) => prev.filter((a) => a.path !== path))
  }

  return (
    <div class="glass-panel chat-panel" style="flex:1">
      <div class="chat-header">
        <span>澪号</span>
        <span class="chat-subtitle">· {agent.connected() ? '在线' : '离线'}</span>
        <span class="chat-header-right">
          <span class="energy-dot" style={{background: agent.connected() ? 'rgba(139,156,240,0.6)' : 'rgba(255,80,80,0.6)'}} />
          {agent.connected() ? '就绪' : '断连'}
        </span>
      </div>
      <div class="chat-messages" ref={scrollRef}>
        <For each={agent.messages().filter((m) => m.content || m.partial)}>
          {(msg) => (
            <div class={`msg ${msg.role} message-enter`}>
              <div
                class="msg-bubble"
                innerHTML={
                  msg.role === 'assistant' && msg.content
                    ? renderMarkdown(msg.content)
                    : undefined
                }
              >
                {msg.role === 'assistant' && msg.content
                  ? null
                  : msg.content || (msg.partial ? '...' : '')}
              </div>
            </div>
          )}
        </For>
      </div>

      {/* attachment badges */}
      <Show when={attachments().length > 0}>
        <div class="chat-attachments">
          <For each={attachments()}>
            {(att) => (
              <span class="chat-attachment-badge">
                📎 {att.name}
                <button
                  class="chat-attachment-remove"
                  onClick={() => removeAttachment(att.path)}
                >
                  ×
                </button>
              </span>
            )}
          </For>
        </div>
      </Show>

      <div
        class="chat-input-area"
        classList={{ 'drop-target': dragOver() }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <textarea
          ref={textareaRef}
          class="chat-input"
          placeholder={attachments().length > 0 ? '输入消息或直接发送引用文件...' : '输入消息...'}
          rows="1"
          value={content()}
          onInput={(e) => { setContent(e.currentTarget.value); handleInput() }}
          onKeyDown={handleKeyDown}
        />
        <button class="send-btn" onClick={handleSend}>↑</button>
      </div>
    </div>
  )
}
```

注意：需要增加 `Show` 导入 — 在顶部 import 行添加 `Show`。

- [ ] **Step 2: 修改 sendMessage 支持 displayContent**

在 `useAgent.tsx` 的 `sendMessage` 函数中（约第 376 行），修改为接受 displayContent 参数：

```ts
const sendMessage = (content: string) => {
  const displayContent = (arguments as any)[1]?.displayContent as string | undefined
  const userMsg: MessageEntry = {
    messageId: `msg-${crypto.randomUUID()}`,
    role: 'user',
    content: displayContent || content,
    partial: false,
  }
  // ... 其余不变 ...
  send('message.send', { content })
}
```

实际实现需要在 `MessageEntry` 加 `displayContent` 字段。更简单的方案：sendMessage 的签名改为 `sendMessage(content: string, displayContent?: string)`，气泡显示 `displayContent || content`。

在 `AgentContextValue` 中同步更新签名：
```ts
sendMessage: (content: string, displayContent?: string) => void
```

- [ ] **Step 3: 验证 TypeScript 编译**

```bash
cd D:\claude\personal-agent\frontend && npx tsc --noEmit
```
Expected: 无错误

- [ ] **Step 4: 提交**

```bash
git add frontend/src/extensions/chat-renderer/ChatRenderer.tsx frontend/src/shell/useAgent.tsx
git commit -m "feat: ChatRenderer 拖放文件引用 + 附件徽章"
```

---

### Task 6: CSS 样式

**Files:**
- Modify: `frontend/src/shell/App.css`

- [ ] **Step 1: 在 App.css 末尾追加样式**

在 `App.css` 文件末尾追加：

```css
/* ====== 文件树状态 ====== */
.file-tree-empty {
  font-size: 11px; color: var(--text-muted);
  padding: 6px 4px; font-style: italic;
}
.file-tree-loading {
  font-size: 11px; color: var(--text-muted);
  padding: 6px 4px;
  animation: pulse-text 1.5s ease-in-out infinite;
}
.file-tree-error {
  font-size: 11px; color: #f87171;
  padding: 6px 4px;
}
@keyframes pulse-text {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 1; }
}

/* ====== 附件徽章 ====== */
.chat-attachments {
  display: flex; flex-wrap: wrap; gap: 6px;
  padding: 6px 12px 0; flex-shrink: 0;
}
.chat-attachment-badge {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 11px; color: var(--accent);
  background: rgba(139,156,240,0.10);
  border: 1px solid rgba(139,156,240,0.15);
  border-radius: 6px; padding: 2px 6px 2px 8px;
}
.chat-attachment-remove {
  border: none; background: none;
  color: var(--text-muted); cursor: pointer;
  font-size: 14px; line-height: 1;
  padding: 0 2px;
}
.chat-attachment-remove:hover { color: #f87171; }

/* ====== 拖放高亮 ====== */
.chat-input-area.drop-target .chat-input {
  border-color: var(--accent);
  box-shadow: 0 0 0 1px rgba(139,156,240,0.2);
}
```

- [ ] **Step 2: 验证 dev server 无报错**

```bash
# 启动 dev server 检查 CSS 是否正常加载
cd D:\claude\personal-agent\frontend && npm run dev
# 浏览器打开 http://localhost:5173，检查扩展面板
```

- [ ] **Step 3: 提交**

```bash
git add frontend/src/shell/App.css
git commit -m "style: 文件树状态 + 附件徽章 + 拖放高亮样式"
```

---

### 验证清单

完成所有 Task 后：
- [ ] `npm run check` (frontend) — TypeScript 无错误
- [ ] `npm run check` (bridge, 忽略 vendor/pi 预存错误) — TypeScript 无新错误
- [ ] 启动 bridge + frontend，浏览器测试：
  - [ ] 展开右侧面板，文件树显示项目根目录文件
  - [ ] 点击目录展开/折叠
  - [ ] 点击 .md 文件，预览面板显示渲染的 markdown
  - [ ] 点击 .ts 文件，预览面板显示源码
  - [ ] 从文件树拖 .ts 文件到对话框，显示附件徽章
  - [ ] 发送带附件的消息，气泡只显示文件名
  - [ ] AI 收到包含文件内容的消息
