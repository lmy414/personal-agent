import { createSignal, onMount, onCleanup, Show } from 'solid-js'
import { FileTree } from '@/extensions/file-tree/FileTree'
import { DocPreview } from '@/extensions/doc-preview/DocPreview'
import { MemoryView } from '@/extensions/memory-view/MemoryView'

type TabId = 'files' | 'preview' | 'memory'

const TABS: { id: TabId; label: string }[] = [
  { id: 'files', label: '文件' },
  { id: 'preview', label: '预览' },
  { id: 'memory', label: '记忆' },
]

export function RightPanelTabs() {
  const [activeTab, setActiveTab] = createSignal<TabId>('files')

  onMount(() => {
    const handler = (e: Event) => {
      const tab = (e as CustomEvent).detail as TabId
      if (TABS.some((t) => t.id === tab)) setActiveTab(tab)
    }
    window.addEventListener('switch-right-tab', handler)
    onCleanup(() => window.removeEventListener('switch-right-tab', handler))
  })

  return (
    <>
      <div class="right-panel-header">
        {TABS.map((tab) => (
          <span
            class="right-panel-tab"
            classList={{ active: activeTab() === tab.id }}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </span>
        ))}
        <button class="right-panel-close" onClick={() => {
          window.dispatchEvent(new CustomEvent('close-right-panel'))
        }}>×</button>
      </div>
      <div class="tab-content-persist" style={{ position: 'relative', flex: '1', 'min-height': '0', overflow: 'hidden' }}>
        <div style={{ display: activeTab() === 'files' ? 'block' : 'none', height: '100%', overflow: 'auto' }}>
          <FileTree />
        </div>
        <div style={{ display: activeTab() === 'preview' ? 'block' : 'none', height: '100%', overflow: 'auto' }}>
          <DocPreview />
        </div>
        <div style={{ display: activeTab() === 'memory' ? 'block' : 'none', height: '100%', overflow: 'auto' }}>
          <MemoryView />
        </div>
      </div>
    </>
  )
}
