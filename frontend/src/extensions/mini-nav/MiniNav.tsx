import { For } from 'solid-js'
import './mini-nav.css'

export type ViewId = 'chat' | 'agents' | 'records' | 'resources' | 'files' | 'settings'

interface NavItem {
  id: ViewId
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

interface MiniNavProps {
  activeView: ViewId
  onNavigate: (view: ViewId) => void
}

export function MiniNav(props: MiniNavProps) {
  return (
    <nav class="mini-nav">
      <For each={NAV_ITEMS}>
        {(item) => (
          <button
            class="nav-item"
            classList={{ active: props.activeView === item.id }}
            onClick={() => props.onNavigate(item.id)}
            title={item.label}
          >
            <span class="nav-icon">{item.icon}</span>
            <span class="nav-label">{item.label}</span>
          </button>
        )}
      </For>
      <div class="nav-divider" />
    </nav>
  )
}
