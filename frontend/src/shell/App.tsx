import { createSignal, For } from 'solid-js'
import { SceneLayer } from './SceneLayer'
import { registry, type Extension } from '@/registry'
import './App.css'

function renderExtension(ext: Extension) {
  return <ext.component />
}

export function App() {
  const [rightPanelW, setRightPanelW] = createSignal(320)
  const [panelVisible, setPanelVisible] = createSignal(true)

  const handleDragStart = (e: MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startW = rightPanelW()

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
        <div class="glass slot-left-top rounded-lg overflow-hidden">
          <For each={registry.getBySlot('left-top')}>{renderExtension}</For>
        </div>
        <div class="glass slot-left-middle rounded-lg overflow-hidden flex flex-col">
          <For each={registry.getBySlot('left-middle')}>{renderExtension}</For>
        </div>
        <div class="glass slot-left-bottom rounded-lg overflow-hidden">
          <For each={registry.getBySlot('left-bottom')}>{renderExtension}</For>
        </div>

        <div class="glass slot-center rounded-lg overflow-hidden flex flex-col">
          <For each={registry.getBySlot('center')}>{renderExtension}</For>
        </div>

        <div class="glass slot-right rounded-lg right-panel" style={{ overflow: 'visible' }}>
          <div
            class="drag-handle"
            classList={{ active: false }}
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
            展开面板
          </div>
          <div class="right-panel-body">
            <For each={registry.getBySlot('right')}>{renderExtension}</For>
          </div>
        </div>
      </div>
    </>
  )
}
