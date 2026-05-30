import { createSignal, Switch, Match } from 'solid-js'
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
          // Close handled by parent App.tsx via double-click or drag
          window.dispatchEvent(new CustomEvent('close-right-panel'))
        }}>×</button>
      </div>
      <div class="tab-content active">
        <Switch>
          <Match when={activeTab() === 'files'}>
            <FileTree />
          </Match>
          <Match when={activeTab() === 'preview'}>
            <DocPreview />
          </Match>
          <Match when={activeTab() === 'memory'}>
            <MemoryView />
          </Match>
        </Switch>
      </div>
    </>
  )
}
