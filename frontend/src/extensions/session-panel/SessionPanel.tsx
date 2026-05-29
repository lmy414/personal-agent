import { createSignal, For, Show } from 'solid-js'
import { useAgent } from '@/shell/useAgent'

export function SessionPanel() {
  const { sessions, switchSession, sessionId, createSession } = useAgent()
  const [expanded, setExpanded] = createSignal(false)
  const [searchQuery, setSearchQuery] = createSignal('')

  const filtered = () => {
    const q = searchQuery().toLowerCase()
    if (!q) return sessions
    return sessions.filter((s) => s.title.toLowerCase().includes(q) || s.id.includes(q))
  }

  const visible = () => filtered().slice(0, 3)
  const currentSession = () => sessions.find((s) => s.id === sessionId)

  return (
    <div class="p-3">
      {/* Header — always visible */}
      <div
        class="flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded())}
      >
        <div class="flex items-center gap-2">
          <span class="text-xs text-[var(--text-secondary)]">💬</span>
          <span class="text-sm font-medium">{currentSession()?.title ?? '会话'}</span>
          <span class="text-xs text-[var(--text-secondary)]">
            {currentSession()?.roundCount ?? 0} 轮
          </span>
        </div>
        <div class="flex items-center gap-1">
          <button
            class="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] w-5 h-5 flex items-center justify-center rounded"
            onClick={(e) => { e.stopPropagation(); createSession() }}
          >
            +
          </button>
          <span class="text-xs text-[var(--text-secondary)] transform transition-transform"
            classList={{ 'rotate-90': expanded() }}
          >
            ▶
          </span>
        </div>
      </div>

      {/* Expanded sub-session list */}
      <Show when={expanded()}>
        <div class="mt-3">
          <input
            type="text"
            placeholder="搜索会话..."
            class="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] outline-none mb-2"
            value={searchQuery()}
            onInput={(e) => setSearchQuery(e.currentTarget.value)}
          />
          <div class="max-h-40 overflow-y-auto space-y-1">
            <For each={visible()}>
              {(s) => (
                <div
                  class="flex items-center gap-2 px-2 py-1.5 rounded text-xs cursor-pointer transition-colors"
                  classList={{
                    'bg-[var(--accent)]/15 text-[var(--accent)]': s.id === sessionId,
                    'text-[var(--text-secondary)] hover:bg-white/5 hover:text-[var(--text-primary)]': s.id !== sessionId,
                  }}
                  onClick={() => switchSession(s.id)}
                >
                  <span>💬</span>
                  <span class="truncate flex-1">{s.title}</span>
                  <span class="text-[var(--text-secondary)]">{s.roundCount}轮</span>
                </div>
              )}
            </For>
          </div>
        </div>
      </Show>
    </div>
  )
}
