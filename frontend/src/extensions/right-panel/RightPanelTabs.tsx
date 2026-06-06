import { createSignal, onMount, onCleanup, For } from 'solid-js'
import { registry } from '@/registry'
import './right-panel.css'

export function RightPanelTabs() {
  const tabs = () => registry.getBySlot('right-tab')
  const [activeTab, setActiveTab] = createSignal<string>(tabs()[0]?.id ?? '')

  onMount(() => {
    const handler = (e: Event) => {
      const tabId = (e as CustomEvent).detail as string
      if (tabs().some((t) => t.id === tabId)) setActiveTab(tabId)
    }
    window.addEventListener('switch-right-tab', handler)
    onCleanup(() => window.removeEventListener('switch-right-tab', handler))
  })

  return (
    <>
      <div class="right-panel-header">
        <For each={tabs()}>
          {(tab) => (
            <span
              class="right-panel-tab"
              classList={{ active: activeTab() === tab.id }}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </span>
          )}
        </For>
        <button class="right-panel-close" onClick={() => {
          window.dispatchEvent(new CustomEvent('close-right-panel'))
        }}>×</button>
      </div>
      <div class="tab-content-persist" style={{ position: 'relative', flex: '1', 'min-height': '0', overflow: 'hidden' }}>
        <For each={tabs()}>
          {(tab) => (
            <div style={{ display: activeTab() === tab.id ? 'block' : 'none', height: '100%', overflow: 'auto' }}>
              <tab.component />
            </div>
          )}
        </For>
      </div>
    </>
  )
}
