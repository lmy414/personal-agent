import { For, createEffect, createSignal } from 'solid-js'
import { useAgent } from '@/shell/useAgent'
import { marked } from 'marked'

// 配置 marked
marked.setOptions({
  breaks: true,
  gfm: true,
})

function renderMarkdown(text: string): string {
  return marked.parse(text) as string
}

export function ChatRenderer() {
  const agent = useAgent()
  const [content, setContent] = createSignal('')
  let scrollRef!: HTMLDivElement
  let textareaRef!: HTMLTextAreaElement

  createEffect(() => {
    void agent.messages().length
    void agent.sessionId()
    if (scrollRef) {
      scrollRef.scrollTop = scrollRef.scrollHeight
    }
  })

  const handleSend = () => {
    const text = content().trim()
    if (!text) return
    agent.sendMessage(text)
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
      <div class="chat-input-area">
        <textarea
          ref={textareaRef}
          class="chat-input"
          placeholder="输入消息..."
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
