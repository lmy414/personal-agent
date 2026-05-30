import { For, Show, createEffect, createSignal, onCleanup } from 'solid-js'
import { useAgent } from '@/shell/useAgent'
import { marked } from 'marked'
import type { ServerMessage } from '@bridge/protocol'

marked.setOptions({ breaks: true, gfm: true })

// 缓存 markdown 渲染结果，避免已完成的静态消息被重复解析 → 消除闪烁
const mdCache = new Map<string, string>()
function renderMarkdownStable(msgId: string, text: string): string {
  const cached = mdCache.get(msgId)
  if (cached === text) return mdCache.get(`rendered:${msgId}`) ?? ''
  mdCache.set(msgId, text)
  const rendered = marked.parse(text) as string
  mdCache.set(`rendered:${msgId}`, rendered)
  return rendered
}

interface Attachment {
  path: string
  name: string
  content: string
}

const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp'])

export function ChatRenderer() {
  const agent = useAgent()
  const [content, setContent] = createSignal('')
  const [attachments, setAttachments] = createSignal<Attachment[]>([])
  const [dragOver, setDragOver] = createSignal(false)
  let scrollRef!: HTMLDivElement
  let textareaRef!: HTMLTextAreaElement
  const pendingPaths = new Set<string>()
  let unsubFile: (() => void) | null = null

  const isMainSession = () => {
    return agent.sessions().find((s) => s.title === '澪')?.id === agent.sessionId()
  }

  createEffect(() => {
    void agent.messages().length
    void agent.sessionId()
    if (scrollRef) {
      scrollRef.scrollTop = scrollRef.scrollHeight
    }
  })

  // subscribe for file.content responses (for drag-drop from internal FileTree)
  const setupFileSub = () => {
    if (unsubFile) unsubFile()
    unsubFile = agent.subscribe('file.content', (msg: ServerMessage) => {
      const payload = msg.payload as { path: string; content: string; language?: string; encoding?: string }
      // 路径归一化：bridge 返回 \ (Windows) 但 pendingPaths 用 / (FileTree)
      const normPath = payload.path.replace(/\\/g, '/')
      if (!pendingPaths.has(normPath) && !pendingPaths.has(payload.path)) return
      const name = payload.path.split(/[\\/]/).pop() ?? payload.path
      setAttachments((prev) => {
        if (prev.some((a) => a.path.replace(/\\/g, '/') === normPath)) return prev
        return [...prev, { path: payload.path, name, content: payload.content }]
      })
      pendingPaths.delete(normPath)
      pendingPaths.delete(payload.path)
      textareaRef?.focus()
    })
  }
  setupFileSub()

  onCleanup(() => {
    unsubFile?.()
  })

  const handleSend = () => {
    const text = content().trim()
    const atts = attachments()
    if (!text && atts.length === 0) return

    if (atts.length > 0) {
      const badges = atts.map((a) => `[📎 ${a.name}]`).join(' ')
      const displayText = text || '请帮我分析这些文件'

      const fileBlocks = atts.map((a) => {
        const ext = a.name.split('.').pop() ?? ''
        const isImg = IMAGE_EXTS.has(ext.toLowerCase())
        if (isImg) return `![${a.name}](${a.path})`
        return `\`\`\`${ext} ${a.name}\n${a.content}\n\`\`\``
      }).join('\n\n')

      const fullText = text
        ? `${text}\n\n[Attached files:]\n${fileBlocks}`
        : `请帮我分析这些文件:\n${fileBlocks}`

      const attsMeta = atts.map((a) => {
        const ext = a.name.split('.').pop()?.toLowerCase() ?? ''
        return { path: a.path, name: a.name, isImage: IMAGE_EXTS.has(ext) }
      })
      agent.sendMessage(fullText, displayText + ' ' + badges, attsMeta)
      setAttachments([])
    } else {
      agent.sendMessage(text)
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

    // try internal FileTree drag first (custom data)
    const path = e.dataTransfer?.getData('application/x-file-path')

    // OS file drop (File objects from file explorer)
    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0]
      const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
      const isImage = IMAGE_EXTS.has(ext)

      if (isImage) {
        // Images: read as data URL
        const reader = new FileReader()
        reader.onload = () => {
          setAttachments((prev) => {
            if (prev.some((a) => a.name === file.name)) return prev
            return [...prev, { path: file.name, name: file.name, content: reader.result as string }]
          })
          textareaRef?.focus()
        }
        reader.readAsDataURL(file)
      } else if (file.type.startsWith('text/') || file.type === '' || file.type === 'application/json') {
        // Text/JSON: read as text
        const reader = new FileReader()
        reader.onload = () => {
          setAttachments((prev) => {
            if (prev.some((a) => a.name === file.name)) return prev
            return [...prev, { path: file.name, name: file.name, content: reader.result as string }]
          })
          textareaRef?.focus()
        }
        reader.readAsText(file)
      } else {
        // Binary/unreadable: attach as reference only (no content)
        setAttachments((prev) => {
          if (prev.some((a) => a.name === file.name)) return prev
          return [...prev, { path: file.name, name: file.name, content: `[Binary file: ${file.name}]` }]
        })
        textareaRef?.focus()
      }
      return
    }

    if (!path) return

    // internal FileTree drag: read via bridge
    pendingPaths.add(path)
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
        <span class="chat-subtitle">
          ·{' '}
          {agent.isStreaming() && !isMainSession() ? (
            <span class="praying-indicator">
              <span class="praying-dot" />
              <span class="praying-text">少女祈祷中</span>
            </span>
          ) : (
            agent.connected() ? '在线' : '离线'
          )}
        </span>
        <span class="chat-header-right">
          <span class="energy-dot" style={{background: agent.connected() ? 'rgba(139,156,240,0.6)' : 'rgba(255,80,80,0.6)'}} />
          {agent.connected() ? '就绪' : '断连'}
        </span>
      </div>
      <div class="chat-messages" ref={scrollRef}>
        <Show
          when={agent.messages().some((m) => m.content || m.partial)}
          fallback={
            <div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-muted);font-size:13px;">
              向澪发送消息开始对话
            </div>
          }
        >
          <For each={agent.messages().filter((m) => m.content || m.partial)}>
            {(msg, idx) => {
              const isLast = () => idx() === agent.messages().filter((m) => m.content || m.partial).length - 1
              return (
              <div class={`msg ${msg.role}`} classList={{ 'message-enter': isLast() && msg.partial }}>
                <div
                  class="msg-bubble"
                  innerHTML={
                    msg.role === 'assistant' && msg.content && !msg.attachments?.length
                      ? renderMarkdownStable(msg.messageId, msg.content)
                      : undefined
                  }
                >
                  {msg.role === 'user' && msg.attachments?.length ? (
                    // 附件消息不展开内容，仅显示徽章；裁剪旧消息中嵌入的文件内容
                    <div>
                      <span>{(msg.content ?? '').split(/\[Attached files[:\]]/)[0].trim() || '请帮我分析这些文件'}</span>
                      <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:6px;">
                        <For each={msg.attachments}>
                          {(att) => (
                            <span class="chat-attachment-badge">
                              {att.isImage ? '🖼️' : '📎'} {att.name}
                            </span>
                          )}
                        </For>
                      </div>
                    </div>
                  ) : msg.role === 'assistant' && msg.content ? null
                    : msg.content || (msg.partial ? '...' : '')}
                </div>
              </div>
            )}}
          </For>
        </Show>
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
