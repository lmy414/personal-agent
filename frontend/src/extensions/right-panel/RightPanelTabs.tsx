import { createSignal, Switch, Match } from 'solid-js'
import { FileTree } from '@/extensions/file-tree/FileTree'
import { DocPreview } from '@/extensions/doc-preview/DocPreview'
import { MemoryView } from '@/extensions/memory-view/MemoryView'

type TabId = 'file' | 'preview' | 'memory'

const TABS: { id: TabId; label: string }[] = [
  { id: 'file', label: '文件' },
  { id: 'preview', label: '预览' },
  { id: 'memory', label: '记忆' },
]

export function RightPanelTabs() {
  const [activeTab, setActiveTab] = createSignal<TabId>('file')

  return (
    <div class="flex flex-col h-full">
      <div class="tab-bar">
        {TABS.map((tab) => (
          <button
            class="tab-btn"
            classList={{ active: activeTab() === tab.id }}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div class="flex-1 overflow-y-auto">
        <Switch>
          <Match when={activeTab() === 'file'}>
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
    </div>
  )
}
