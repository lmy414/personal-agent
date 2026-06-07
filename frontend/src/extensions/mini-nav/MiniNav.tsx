import type { JSX } from 'solid-js'
import { For } from 'solid-js'
import { MessageSquare, Users, ClipboardList, Coins, FolderOpen, Settings } from 'lucide-solid'
import './mini-nav.css'

export type ViewId = 'chat' | 'agents' | 'records' | 'resources' | 'files' | 'settings'

interface NavItem {
  id: ViewId
  icon: () => JSX.Element
  label: string
}

const NAV_ITEMS: NavItem[] = [
  { id: 'chat', icon: () => <MessageSquare size={16} />, label: '通信' },
  { id: 'agents', icon: () => <Users size={16} />, label: '識別' },
  { id: 'records', icon: () => <ClipboardList size={16} />, label: '記録' },
  { id: 'resources', icon: () => <Coins size={16} />, label: '資源' },
  { id: 'files', icon: () => <FolderOpen size={16} />, label: 'ファイル' },
  { id: 'settings', icon: () => <Settings size={16} />, label: '設定' },
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
            <span class="nav-icon">{item.icon()}</span>
            <span class="nav-label">{item.label}</span>
          </button>
        )}
      </For>
      <div class="nav-divider" />
    </nav>
  )
}
