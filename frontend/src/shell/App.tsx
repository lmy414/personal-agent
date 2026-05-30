import { createSignal, For, onMount, onCleanup } from 'solid-js'
import { SceneLayer } from './SceneLayer'
import { registry, type Extension } from '@/registry'
import './App.css'

function renderExtension(ext: Extension) {
  return <ext.component />
}

export function App() {
  const [rightPanelW, setRightPanelW] = createSignal(320)
  const [panelVisible, setPanelVisible] = createSignal(true)

  // P0-04: 监听右侧面板关闭事件
  onMount(() => {
    const handleClose = () => {
      setRightPanelW(0)
      setPanelVisible(false)
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
      const clamped = Math.max(0, Math.min(640, w))
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
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  const handleExpandClick = () => {
    setRightPanelW(320)
    setPanelVisible(true)
  }

  const effectiveWidth = () => panelVisible() ? rightPanelW() : 0

  return (
    <>
      <SceneLayer />
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

        {/* 左下：工具面板 */}
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
            <div
              class="panel-drag-handle"
              onMouseDown={handleDragStart}
              onDblClick={() => {
                setRightPanelW(0)
                setPanelVisible(false)
              }}
            />
            <div
              class="expand-tab"
              classList={{ hidden: panelVisible() }}
              onClick={handleExpandClick}
            >
              记 忆 检 索
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
