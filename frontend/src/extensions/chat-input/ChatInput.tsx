import { createSignal } from 'solid-js'
import { useAgent } from '@/shell/useAgent'

export function ChatInput() {
  const { sendMessage } = useAgent()
  const [content, setContent] = createSignal('')
  let textareaRef!: HTMLTextAreaElement

  const handleSend = () => {
    const text = content().trim()
    if (!text) return
    sendMessage(text)
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
    <div class="px-5 pb-5 flex-shrink-0">
      <div class="glass rounded-2xl flex items-end gap-2.5 px-3.5 py-2.5">
        <textarea
          ref={textareaRef}
          rows="1"
          placeholder="给 Mio 发送消息..."
          class="flex-1 bg-transparent border-none text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] resize-none outline-none leading-relaxed max-h-[120px] min-h-[20px]"
          style={{ 'font-family': 'inherit' }}
          value={content()}
          onInput={(e) => { setContent(e.currentTarget.value); handleInput() }}
          onKeyDown={handleKeyDown}
        />
        <button
          class="w-8 h-8 rounded-xl bg-[var(--accent)] text-white flex items-center justify-center hover:opacity-85 transition-opacity flex-shrink-0"
          onClick={handleSend}
        >
          ➤
        </button>
      </div>
    </div>
  )
}
