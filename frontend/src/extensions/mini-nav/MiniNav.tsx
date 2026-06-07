import type { JSX } from 'solid-js'
import { For } from 'solid-js'
import { MessageSquare, Users, ClipboardList, Coins, FolderOpen, Settings } from 'lucide-solid'
import { activeView, navigateTo, type ViewId } from '@/shell/nav-signal'
import { sidebarMode, setSidebarMode } from '@/shell/sidebar-mode'
import './mini-nav.css'

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

export function MiniNav() {
  const isActive = (id: ViewId) => {
    if (id === 'files') return sidebarMode() === 'files'
    return activeView() === id && sidebarMode() !== 'files'
  }

  const handleClick = (id: ViewId) => {
    if (id === 'files') {
      setSidebarMode(sidebarMode() === 'files' ? 'chat' : 'files')
    } else {
      setSidebarMode('chat')
      navigateTo(id)
    }
  }

  return (
    <nav class="mini-nav">
      <For each={NAV_ITEMS}>
        {(item) => (
          <button
            class="nav-item"
            classList={{ active: isActive(item.id) }}
            onClick={() => handleClick(item.id)}
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
