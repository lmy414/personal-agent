import { createSignal, For } from 'solid-js'
import { useAgent } from '@/shell/useAgent'

export function MemoryView() {
  const { send } = useAgent()
  const [query, setQuery] = createSignal('')
  const [memories, setMemories] = createSignal<Array<{ content: string; category: string; importance: number }>>([])

  const handleSearch = () => {
    const q = query().trim()
    if (!q) return
    send('memory.search', { query: q })
  }

  return (
    <div class="p-3">
      <div class="flex gap-2 mb-3">
        <input
          type="text"
          placeholder="搜索记忆..."
          class="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] outline-none"
          value={query()}
          onInput={(e) => setQuery(e.currentTarget.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
        />
        <button
          class="px-2 py-1 bg-[var(--accent)]/20 text-[var(--accent)] rounded text-xs hover:bg-[var(--accent)]/30 transition-colors"
          onClick={handleSearch}
        >
          搜索
        </button>
      </div>
      <div class="space-y-2">
        <For each={memories()}>
          {(mem) => (
            <div class="glass rounded-lg p-2.5 text-xs">
              <div class="text-[var(--text-primary)] leading-relaxed mb-1">{mem.content}</div>
              <div class="flex items-center justify-between text-[var(--text-secondary)]">
                <span>{mem.category}</span>
                <span>重要性: {mem.importance}</span>
              </div>
            </div>
          )}
        </For>
      </div>
    </div>
  )
}
