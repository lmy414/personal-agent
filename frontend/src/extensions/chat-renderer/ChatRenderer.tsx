import { For, createEffect } from 'solid-js'
import { useAgent } from '@/shell/useAgent'

export function ChatRenderer() {
  const { messages } = useAgent()
  let scrollRef!: HTMLDivElement

  createEffect(() => {
    void (messages.length)
    if (scrollRef) {
      scrollRef.scrollTop = scrollRef.scrollHeight
    }
  })

  return (
    <div class="flex-1 overflow-y-auto px-5 py-4" ref={scrollRef}>
      <For each={messages}>
        {(msg) => (
          <div
            class="flex gap-3 mb-5 message-enter"
            classList={{ 'flex-row-reverse': msg.role === 'user' }}
          >
            <div class="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 border-2 border-white/10">
              <div
                class="w-full h-full flex items-center justify-center text-xs"
                classList={{
                  'bg-[var(--accent)]': msg.role === 'assistant',
                  'bg-white/20': msg.role === 'user',
                }}
              >
                {msg.role === 'assistant' ? 'M' : '你'}
              </div>
            </div>
            <div
              class="max-w-[80%]"
              classList={{
                'flex flex-col items-end': msg.role === 'user',
              }}
            >
              <div class="text-xs text-[var(--text-secondary)] mb-1">
                {msg.role === 'assistant' ? 'Mio' : '你'}
              </div>
              <div
                class="px-3 py-2.5 rounded-2xl text-sm leading-relaxed"
                classList={{
                  'bg-[var(--accent)]/15 border border-[var(--accent)]/20': msg.role === 'user',
                  'bg-black/35 border border-white/5': msg.role === 'assistant',
                }}
              >
                {msg.content || (msg.partial ? '...' : '')}
              </div>
            </div>
          </div>
        )}
      </For>
    </div>
  )
}
