import { createSignal, For, onMount, onCleanup } from 'solid-js'
import { registry, type Extension } from '@/registry'
import { TopMenuBar } from '@/extensions/top-menu/TopMenuBar'
import { SettingsPage } from '@/extensions/settings-page/SettingsPage'
import { DragHandle } from '@/components/drag-handle'
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

  // P0-04: 监听右侧面板关闭事件
  onMount(() => {
    const handleClose = () => {
      setRightPanelW(0)
      setPanelVisible(false)
      savePanelState(0, false)
    }
    window.addEventListener('close-right-panel', handleClose)
    onCleanup(() => window.removeEventListener('close-right-panel', handleClose))
  })

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
          'grid-template-columns': `var(--left-col) 1fr ${effectiveWidth()}px`,
        }}
      >
        {/* 左上：会话面板 */}
        <div class="overlay-left-top">
          <For each={registry.getBySlot('left-top')}>{renderExtension}</For>
        </div>

        {/* 左中：工具/文件面板 */}
        <div class="overlay-left-bottom">
          <For each={registry.getBySlot('left-middle')}>{renderExtension}</For>
        </div>

        {/* 左下底：状态栏 */}
        <div class="overlay-left-status">
          <For each={registry.getBySlot('left-bottom')}>{renderExtension}</For>
        </div>

        {/* 中间：对话面板 */}
        <div class="overlay-center-main">
          <For each={registry.getBySlot('center')}>{renderExtension}</For>
        </div>

        {/* 右侧面板 */}
        <div class="overlay-right-panel">
          <div class="glass-panel right-panel">
            <DragHandle
              onDrag={(deltaX) => {
                const w = rightPanelW() - deltaX
                const clamped = Math.max(0, Math.min(900, w))
                setRightPanelW(clamped)
                if (clamped < 120 && w < 120) {
                  setPanelVisible(false)
                } else if (clamped > 0) {
                  setPanelVisible(true)
                }
              }}
              onDragEnd={() => savePanelState(rightPanelW(), panelVisible())}
              onDoubleClick={() => {
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
