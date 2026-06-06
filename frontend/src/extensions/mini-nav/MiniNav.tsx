import { createSignal, For } from 'solid-js'
import './mini-nav.css'

interface NavItem {
  id: string
  icon: string
  label: string
}

const NAV_ITEMS: NavItem[] = [
  { id: 'chat', icon: '💬', label: '通信' },
  { id: 'agents', icon: '👥', label: '識別' },
  { id: 'records', icon: '📋', label: '記録' },
  { id: 'resources', icon: '💰', label: '資源' },
  { id: 'files', icon: '📁', label: 'ファイル' },
  { id: 'settings', icon: '⚙', label: '設定' },
]

export function MiniNav() {
  const [activeId, setActiveId] = createSignal('files')

  return (
    <nav class="mini-nav">
      <div class="mini-nav-top-line" />
      <For each={NAV_ITEMS}>
        {(item) => (
          <button
            class="mini-nav-item"
            classList={{ active: activeId() === item.id }}
            onClick={() => setActiveId(item.id)}
            title={item.label}
          >
            <span class="mini-nav-icon">{item.icon}</span>
            <span class="mini-nav-label">{item.label}</span>
          </button>
        )}
      </For>
    </nav>
  )
}
