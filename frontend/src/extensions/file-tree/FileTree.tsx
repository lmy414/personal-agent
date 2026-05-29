import { createSignal, For, Show } from 'solid-js'
import { useAgent } from '@/shell/useAgent'

interface TreeNode {
  name: string
  type: 'file' | 'directory'
  children?: TreeNode[]
}

export function FileTree() {
  const { send } = useAgent()
  const [tree] = createSignal<TreeNode[]>([
    { name: 'project', type: 'directory', children: [
      { name: 'main.ts', type: 'file' },
      { name: 'config.json', type: 'file' },
    ]},
    { name: 'docs', type: 'directory', children: [
      { name: 'readme.md', type: 'file' },
    ]},
  ])

  const handleClick = (node: TreeNode) => {
    if (node.type === 'file') {
      send('file.read', { path: node.name })
    }
  }

  const renderNode = (node: TreeNode, depth: number) => {
    const [expanded, setExpanded] = createSignal(false)
    const icon = node.type === 'directory' ? (expanded() ? '📂' : '📁') : '📄'

    return (
      <>
        <div
          class="flex items-center gap-1.5 py-1 px-1.5 rounded cursor-pointer hover:bg-white/5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          style={{ 'padding-left': `${depth * 14 + 6}px` }}
          onClick={() => {
            if (node.type === 'directory') {
              setExpanded(!expanded())
            } else {
              handleClick(node)
            }
          }}
        >
          <span class="text-xs">{icon}</span>
          <span class="truncate">{node.name}</span>
        </div>
        <Show when={node.type === 'directory' && expanded() && node.children}>
          <For each={node.children!}>
            {(child) => renderNode(child, depth + 1)}
          </For>
        </Show>
      </>
    )
  }

  return (
    <div class="p-2">
      <For each={tree()}>
        {(node) => renderNode(node, 0)}
      </For>
    </div>
  )
}
