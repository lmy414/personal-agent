import { createSignal, For } from 'solid-js'
import { useAgent } from '@/shell/useAgent'

export function MemoryView() {
  const { send } = useAgent()
  const [query, setQuery] = createSignal('')
  const [memories, setMemories] = createSignal<Array<{ content: string; category: string; importance: number }>>([
    { content: 'Mirror 在调 Blender NPR', category: '项目', importance: 3 },
    { content: '偏好 Half Lambert 而非 Ramp Map', category: '偏好', importance: 2 },
    { content: '喜欢 VOCALOID 暗色系曲风', category: '偏好', importance: 2 },
    { content: '项目用 Godot 4.x + GDScript', category: '项目', importance: 3 },
  ])

  const handleSearch = () => {
    const q = query().trim()
    if (!q) return
    send('memory.search', { query: q })
  }

  return (
    <>
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:10px;">最近记忆</div>
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
