import { createSignal, For, onMount, onCleanup } from 'solid-js'
import { registry, type Extension } from '@/registry'
import { TopMenuBar } from '@/extensions/top-menu/TopMenuBar'
import { SettingsPage } from '@/extensions/settings-page/SettingsPage'
import { MiniNav } from '@/extensions/mini-nav/MiniNav'
import './App.css'

function renderExtension(ext: Extension) {
  if (ext.id === 'top-menu' || ext.id === 'settings-page') return null
  return <ext.component />
}

const STORAGE_KEY_W = 'mio:right-panel-w'
const STORAGE_KEY_V = 'mio:right-panel-visible'

function loadPanelState(): { w: number; visible: boolean } {
  try {
    const w = localStorage.getItem(STORAGE_KEY_W)
    const v = localStorage.getItem(STORAGE_KEY_V)
    return {
      w: w ? parseInt(w) : 400,
      visible: v !== null ? v === '1' : true,
    }
  } catch { return { w: 400, visible: true } }
}

function savePanelState(w: number, visible: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY_W, String(w))
    localStorage.setItem(STORAGE_KEY_V, visible ? '1' : '0')
  } catch { /* localStorage not available */ }
}

export function App() {
  const saved = loadPanelState()
  const [rightPanelW, setRightPanelW] = createSignal(saved.w)
  const [panelVisible, setPanelVisible] = createSignal(saved.visible)

  onMount(() => {
    const handleClose = () => {
      setRightPanelW(0)
      setPanelVisible(false)
      savePanelState(0, false)
    }
    window.addEventListener('close-right-panel', handleClose)
    onCleanup(() => window.removeEventListener('close-right-panel', handleClose))
  })

  const handleDragStart = (e: MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startW = rightPanelW()
    const handle = e.currentTarget as HTMLElement
    handle.classList.add('dragging')
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'col-resize'

    const onMove = (ev: MouseEvent) => {
      const w = startW - (ev.clientX - startX)
      const clamped = Math.max(0, Math.min(900, w))
      setRightPanelW(clamped)

      if (clamped < 120 && w < 120) {
        setPanelVisible(false)
      } else if (clamped > 0) {
        setPanelVisible(true)
      }
    }

    const onUp = () => {
      handle.classList.remove('dragging')
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      savePanelState(rightPanelW(), panelVisible())
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  const handleExpandClick = () => {
    setRightPanelW(400)
    setPanelVisible(true)
    savePanelState(400, true)
  }

  const effectiveWidth = () => panelVisible() ? rightPanelW() : 0

  return (
    <>
      <TopMenuBar />
      <SettingsPage />
      <div
        class="overlay"
        style={{
          'grid-template-columns': `52px var(--left-col) 1fr ${effectiveWidth()}px`,
        }}
      >
        <div class="overlay-nav-left">
          <MiniNav />
        </div>

        <div class="overlay-left-top">
          <For each={registry.getBySlot('left-top')}>{renderExtension}</For>
        </div>

        <div class="overlay-left-bottom">
          <For each={registry.getBySlot('left-middle')}>{renderExtension}</For>
        </div>

        <div class="overlay-left-status">
          <For each={registry.getBySlot('left-bottom')}>{renderExtension}</For>
        </div>

        <div class="overlay-center-main">
          <For each={registry.getBySlot('center')}>{renderExtension}</For>
        </div>

        <div class="overlay-right-panel">
          <div class="glass-panel right-panel">
            <div
              class="panel-drag-handle"
              onMouseDown={handleDragStart}
              onDblClick={() => {
                setRightPanelW(0)
                setPanelVisible(false)
                savePanelState(0, false)
              }}
            />
            <div
              class="expand-tab"
              classList={{ hidden: panelVisible() }}
              onClick={handleExpandClick}
            >
              文件
            </div>
            <div class="right-panel-body">
              <For each={registry.getBySlot('right')}>{renderExtension}</For>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
