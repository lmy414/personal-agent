import { createSignal, For, onMount, onCleanup } from 'solid-js'
import { useAgent } from '@/shell/useAgent'
import type { ServerMessage } from '@bridge/protocol'

interface MemoryItem {
  content: string
  category: string
  importance: number
}

export function MemoryView() {
  const { send, subscribe } = useAgent()
  const [query, setQuery] = createSignal('')
  const [memories, setMemories] = createSignal<MemoryItem[]>([])
  const [loading, setLoading] = createSignal(true)

  onMount(() => {
    // 订阅搜索结果
    const unsubResults = subscribe('memory.results', (msg: ServerMessage) => {
      const payload = msg.payload as { query: string; entries: MemoryItem[] }
      setMemories(payload.entries)
      setLoading(false)
    })
    // 订阅列表
    const unsubList = subscribe('memory.list', (msg: ServerMessage) => {
      const payload = msg.payload as { entries: MemoryItem[]; total: number }
      setMemories(payload.entries)
      setLoading(false)
    })

    onCleanup(() => {
      unsubResults()
      unsubList()
    })

    send('memory.list', { limit: 20, offset: 0 })
  })

  const handleSearch = () => {
    const q = query().trim()
    if (!q) {
      send('memory.list', { limit: 20, offset: 0 })
      return
    }
    setLoading(true)
    send('memory.search', { query: q })
  }

  return (
    <>
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:10px;">
        {query() ? `搜索: ${query()}` : '最近记忆'}
      </div>
      {loading() ? (
        <div style="font-size:12px;color:var(--text-muted);text-align:center;margin-top:16px;">
          加载中...
        </div>
      ) : (
        <>
          <For each={memories()}>
            {(mem) => (
              <div class="sub-item" style="margin-bottom:4px;">
                <span class="sub-title" style="color:var(--text-secondary)">{mem.content}</span>
                <span class="sub-time">{mem.category}</span>
              </div>
            )}
          </For>
          <div style="font-size:11px;color:var(--text-muted);margin-top:12px;text-align:center;">
            共 {memories.length} 条记忆
          </div>
        </>
      )}
      <div style="display:flex;gap:8px;margin-top:10px;">
        <input
          type="text"
          placeholder="搜索记忆..."
          class="sub-search"
          value={query()}
          onInput={(e) => setQuery(e.currentTarget.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
        />
      </div>
    </>
  )
}
