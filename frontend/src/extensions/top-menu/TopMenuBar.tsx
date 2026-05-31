import { createSignal } from 'solid-js'
import { setIsSettingsOpen } from '@/shell/settings-signal'

export function TopMenuBar() {
  const [menuOpen, setMenuOpen] = createSignal(false)

  const handleToggle = () => setMenuOpen(!menuOpen())

  const handleOpenSettings = () => {
    setIsSettingsOpen(true)
    setMenuOpen(false)
  }

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
        <button class="top-menu-item" onClick={handleOpenSettings}>
          <span class="menu-icon">⚙</span>
          <span class="menu-label">设置</span>
        </button>
        <button class="top-menu-item" onClick={() => { setIsSettingsOpen(false); setMenuOpen(false) }}>
          <span class="menu-icon">🎐</span>
          <span class="menu-label">主会话</span>
        </button>
      </div>
    </>
  )
}
