import { For } from 'solid-js'
import './index.css'

export interface TabBarProps {
  tabs: { id: string; label: string }[]
  activeTab: string
  onTabChange: (id: string) => void
}

export function TabBar(props: TabBarProps) {
  return (
    <div class="tab-bar-header">
      <For each={props.tabs}>
        {(tab) => (
          <button
            class="tab-bar-item"
            classList={{ active: tab.id === props.activeTab }}
            onClick={() => props.onTabChange(tab.id)}
          >
            {tab.label}
          </button>
        )}
      </For>
    </div>
  )
}
