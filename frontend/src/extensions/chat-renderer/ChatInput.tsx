import { createSignal, type Component } from 'solid-js'
import { Send, Paperclip } from 'lucide-solid'

interface ChatInputProps {
  onSend: (text: string) => void
  onAttach?: () => void
  disabled?: boolean
  placeholder?: string
}

export const ChatInput: Component<ChatInputProps> = (props) => {
  const [text, setText] = createSignal('')
  let textareaRef!: HTMLTextAreaElement

  const handleSend = () => {
    const trimmed = text().trim()
    if (!trimmed || props.disabled) return
    props.onSend(trimmed)
    setText('')
    textareaRef.style.height = 'auto'
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleInput = () => {
    textareaRef.style.height = 'auto'
    textareaRef.style.height = `${Math.min(textareaRef.scrollHeight, 120)}px`
  }

  return (
    <div class="chat-input-area">
      {props.onAttach && (
        <button
          class="chat-attach-btn"
          onClick={props.onAttach}
          title="附件"
          disabled={props.disabled}
        >
          <Paperclip size={14} />
        </button>
      )}
      <textarea
        ref={textareaRef}
        class="chat-input"
        placeholder={props.placeholder ?? '输入消息...'}
        value={text()}
        onInput={(e) => { setText(e.currentTarget.value); handleInput() }}
        onKeyDown={handleKeyDown}
        disabled={props.disabled}
        rows={1}
      />
      <button
        class="chat-send-btn"
        onClick={handleSend}
        disabled={props.disabled || !text().trim()}
        title="发送"
      >
        <Send size={16} />
      </button>
    </div>
  )
}
