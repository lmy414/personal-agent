import { For } from 'solid-js'
import { registry, type Extension } from '@/registry'
import { activeView } from '@/shell/nav-signal'
import './App.css'

export function App() {
  // ── Registry-driven slot rendering ──
  // All slots are populated by extension registrations (P1-3 → P1-6).

  const renderOverlay = () => {
    const exts = registry.getBySlot('overlay')
    return <For each={exts}>{ext => { const Comp = ext.component; return <Comp /> }}</For>
  }

  const renderNav = () => {
    const exts = registry.getBySlot('nav')
    if (exts.length === 0) return null
    return <For each={exts}>{ext => { const Comp = ext.component; return <Comp /> }}</For>
  }

  const renderMainView = () => {
    const exts = registry.getBySlot('main-view')
    const match = exts.find((e: Extension) => e.id === activeView()) || exts[0]
    if (match) {
      const Comp = match.component
      return <Comp />
    }
    return null
  }

  return (
    <>
      {/* ── Overlay slot ── */}
      {renderOverlay()}
      <div
        style={{
          position: 'relative',
          'z-index': '1',
          display: 'flex',
          height: '100vh',
          gap: '0',
        }}
      >
        {/* ── Nav slot (52px) ── */}
        <div class="glass-panel" style={{ width: '52px', 'flex-shrink': '0', 'z-index': '10' }}>
          {renderNav()}
        </div>

        {/* ── Main content area ── */}
        <div
          style={{
            flex: '1',
            display: 'flex',
            overflow: 'visible',
            'min-width': '0',
          }}
        >
          {renderMainView()}
        </div>
      </div>
    </>
  )
}
