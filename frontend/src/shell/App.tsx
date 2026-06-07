import { createSignal } from 'solid-js'
import { TopMenuBar } from '@/extensions/top-menu/TopMenuBar'
import { SettingsPage } from '@/extensions/settings-page/SettingsPage'
import { MiniNav, type ViewId } from '@/extensions/mini-nav/MiniNav'
import PencilMainView from '@/views/PencilMainView'
import CharacterView from '@/views/CharacterView'
import SessionRecordsView from '@/views/SessionRecordsView'
import CostDashboardView from '@/views/CostDashboardView'
import FileTreeView from '@/views/FileTreeView'
import SettingsLayoutView from '@/views/SettingsLayoutView'
import './App.css'

export function App() {
  const [activeView, setActiveView] = createSignal<ViewId>('chat')

  const renderView = () => {
    switch (activeView()) {
      case 'chat':       return <PencilMainView />
      case 'agents':     return <CharacterView />
      case 'records':    return <SessionRecordsView />
      case 'resources':  return <CostDashboardView />
      case 'files':      return <FileTreeView />
      case 'settings':   return <SettingsLayoutView />
      default:           return <PencilMainView />
    }
  }

  return (
    <>
      <TopMenuBar />
      <SettingsPage />
      <div
        style={{
          position: 'relative',
          'z-index': '1',
          display: 'flex',
          height: '100vh',
          gap: '0',
        }}
      >
        {/* ===== Mini Nav (52px) — glass-panel 背景 + mini-nav 内部布局 ===== */}
        <div class="glass-panel" style={{ width: '52px', 'flex-shrink': '0', 'z-index': '10' }}>
          <MiniNav activeView={activeView()} onNavigate={setActiveView} />
        </div>

        {/* ===== Main Content Area ===== */}
        <div
          style={{
            flex: '1',
            display: 'flex',
            overflow: 'visible',
            'min-width': '0',
          }}
        >
          {renderView()}
        </div>
      </div>
    </>
  )
}
