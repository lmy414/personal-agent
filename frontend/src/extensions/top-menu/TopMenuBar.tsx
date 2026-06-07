import { createSignal } from 'solid-js'
import { navigateTo } from '@/shell/nav-signal'
import { Settings, Wind } from 'lucide-solid'
import './top-menu.css'

export function TopMenuBar() {
  const [menuOpen, setMenuOpen] = createSignal(false)

  const handleToggle = () => setMenuOpen(!menuOpen())

  return (
    <>
      <div
        class="top-menu-toggle"
        classList={{ open: menuOpen() }}
        onClick={handleToggle}
        title="菜单"
      >
        <span class="toggle-arrow">▼</span>
      </div>
      <div class="top-menu-bar" classList={{ open: menuOpen() }}>
        <button class="top-menu-item" onClick={() => { navigateTo('settings'); setMenuOpen(false) }}>
          <Settings size={18} class="menu-icon-svg" />
          <span class="menu-label">设置</span>
        </button>
        <button class="top-menu-item" onClick={() => { navigateTo('chat'); setMenuOpen(false) }}>
          <Wind size={18} class="menu-icon-svg" />
          <span class="menu-label">主会话</span>
        </button>
      </div>
    </>
  )
}
