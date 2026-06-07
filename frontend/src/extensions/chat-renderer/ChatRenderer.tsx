import { For, Show, createEffect, createSignal, onCleanup } from 'solid-js'
import { useAgent } from '@/shell/useAgent'
import { accentRgb } from '@/shell/theme'
import { marked } from 'marked'
import type { ServerMessage } from '@bridge/protocol'
import './chat-renderer.css'
import { MessageBubble } from './MessageBubble'
import { ChatInput } from './ChatInput'
import type { AvatarStatus } from './Avatar'
import { Paperclip, Image } from 'lucide-solid'

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

  // Avatar status: idle (default), thinking (streaming + no content), speaking (streaming + content)
  const avatarStatus = (): AvatarStatus => {
    if (!agent.isStreaming()) return 'idle'
    const msgs = agent.messages()
    const last = msgs[msgs.length - 1]
    if (last?.role === 'assistant' && last.partial && !last.content) return 'thinking'
    if (last?.role === 'assistant' && last.partial) return 'speaking'
    return 'idle'
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

  const handleSend = (text?: string) => {
    const txt = text ?? content().trim()
    const atts = attachments()
    if (!txt && atts.length === 0) return

    if (atts.length > 0) {
      const badges = atts.map((a) => `[附件: ${a.name}]`).join(' ')
      const displayText = txt || '请帮我分析这些文件'

      const fileBlocks = atts.map((a) => {
        const ext = a.name.split('.').pop() ?? ''
        const isImg = IMAGE_EXTS.has(ext.toLowerCase())
        if (isImg) return `![${a.name}](${a.path})`
        return `\`\`\`${ext} ${a.name}\n${a.content}\n\`\`\``
      }).join('\n\n')

      const fullText = txt
        ? `${txt}\n\n[Attached files:]\n${fileBlocks}`
        : `请帮我分析这些文件:\n${fileBlocks}`

      const attsMeta = atts.map((a) => {
        const ext = a.name.split('.').pop()?.toLowerCase() ?? ''
        return { path: a.path, name: a.name, isImage: IMAGE_EXTS.has(ext) }
      })
      agent.sendMessage(fullText, displayText + ' ' + badges, attsMeta)
      setAttachments([])
    } else if (txt) {
      agent.sendMessage(txt)
    }

    setContent('')
    if (textareaRef) {
      textareaRef.style.height = 'auto'
    }
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

    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0]
      const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
      const isImage = IMAGE_EXTS.has(ext)

      if (isImage) {
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
        setAttachments((prev) => {
          if (prev.some((a) => a.name === file.name)) return prev
          return [...prev, { path: file.name, name: file.name, content: `[Binary file: ${file.name}]` }]
        })
        textareaRef?.focus()
      }
      return
    }

    if (!path) return

    pendingPaths.add(path)
    const ext = path.split('.').pop()?.toLowerCase() ?? ''
    const isImage = IMAGE_EXTS.has(ext)
    agent.send('file.read', { path, encoding: isImage ? 'base64' : 'utf8' })
  }

  const removeAttachment = (path: string) => {
    setAttachments((prev) => prev.filter((a) => a.path !== path))
  }

  const getS = (key: string) => agent.settings().find((e) => e.key === key)?.value ?? ''
  const avatarName = () => getS('avatar_name') || '澪'
  const avatarImage = () => getS('avatar_image')
  const visibleMessages = () => agent.messages().filter((m) => m.content || m.partial)

  /** 同角色连续消息中，仅第一条显示头像 */
  const shouldShowAvatar = (idx: number, msgs: ReturnType<typeof visibleMessages>) => {
    if (idx === 0) return true
    return msgs[idx].role !== msgs[idx - 1].role
  }

  return (
    <div class="glass-panel chat-panel" style="flex:1">
      <div class="chat-header">
        <span>{avatarName()}</span>
        <span class="chat-subtitle">
          ·{' '}
          {agent.isStreaming() ? (
            <span class="praying-indicator">
              <span class="praying-dot" />
              <span class="praying-text">少女祈祷中</span>
            </span>
          ) : (
            agent.connected() ? '在线' : '离线'
          )}
        </span>
        <span class="chat-header-right">
          <span class="energy-dot" style={{background: agent.connected() ? `rgba(${accentRgb()},0.6)` : 'rgba(var(--error-rgb),0.6)'}} />
          {agent.connected() ? '就绪' : '断连'}
        </span>
      </div>

      <div class="chat-messages" ref={scrollRef}>
        <Show
          when={visibleMessages().length > 0}
          fallback={
            <div class="chat-empty">
              向澪发送消息开始对话
            </div>
          }
        >
          <For each={visibleMessages()}>
            {(msg, idx) => {
              const isAssistant = msg.role === 'assistant'
              const hasAttachments = msg.attachments?.length
              const showAvatar = shouldShowAvatar(idx(), visibleMessages())
              const isLast = () => idx() === visibleMessages().length - 1

              const thinking = (isAssistant && (msg as any).thinking)
                ? (msg as any).thinking as string
                : undefined

              return (
                <MessageBubble
                  role={msg.role as 'user' | 'assistant'}
                  showAvatar={showAvatar}
                  avatarStatus={isLast() ? avatarStatus() : 'idle'}
                  avatarLabel={avatarName()}
                  avatarImage={avatarImage()}
                  thinking={thinking}
                >
                  {msg.role === 'user' && hasAttachments ? (
                    <>
                      <span>{(msg.content ?? '').split(/\[Attached files[:\]]/)[0].trim() || '请帮我分析这些文件'}</span>
                      <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:6px;">
                        <For each={msg.attachments}>
                          {(att) => (
                            <span class="chat-attachment-badge">
                              {att.isImage ? <Image size={12} /> : <Paperclip size={12} />} {att.name}
                            </span>
                          )}
                        </For>
                      </div>
                    </>
                  ) : isAssistant && msg.content && !msg.partial && !hasAttachments ? (
                    <div innerHTML={renderMarkdownStable(msg.messageId, msg.content)} />
                  ) : (
                    <>{msg.content || (msg.partial ? '...' : '')}</>
                  )}
                </MessageBubble>
              )
            }}
          </For>
        </Show>
      </div>

      {/* attachment badges */}
      <Show when={attachments().length > 0}>
        <div class="chat-attachments">
          <For each={attachments()}>
            {(att) => (
              <span class="chat-attachment-badge">
                <Paperclip size={12} /> {att.name}
                <button class="chat-attachment-remove" onClick={() => removeAttachment(att.path)}>
                  ×
                </button>
              </span>
            )}
          </For>
        </div>
      </Show>

      <div
        classList={{ 'drop-target': dragOver() }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <ChatInput
          onSend={handleSend}
          onAttach={() => { /* future: file picker dialog */ }}
          disabled={!agent.connected()}
          placeholder={attachments().length > 0 ? '输入消息或直接发送引用文件...' : '输入消息...'}
        />
      </div>
    </div>
  )
}
