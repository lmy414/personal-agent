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
    {
      name: 'personal-agent', type: 'directory', children: [
        { name: 'extensions', type: 'directory', children: [
          { name: 'pa-mio', type: 'directory' },
          { name: 'pa-sqlite', type: 'directory' },
        ]},
        { name: '.gitignore', type: 'file' },
        { name: 'package.json', type: 'file' },
        { name: 'CLAUDE.md', type: 'file' },
      ],
    },
    { name: 'frontend-sketch', type: 'directory', children: [
      { name: 'layout-mockup-v2.html', type: 'file' },
    ]},
    { name: 'mio-harness', type: 'directory', children: [
      { name: 'character', type: 'directory', children: [
        { name: 'soul.md', type: 'file' },
        { name: 'boundaries.md', type: 'file' },
      ]},
    ]},
  ])

  const handleClick = (node: TreeNode, e: MouseEvent) => {
    e.stopPropagation()
    if (node.type === 'file') {
      send('file.read', { path: node.name })
    }
  }

  const RenderNode = (props: { node: TreeNode; depth: number }) => {
    const [expanded, setExpanded] = createSignal(false)
    const icon = props.node.type === 'directory'
      ? (expanded() ? '📂' : '📁')
      : (props.node.name.endsWith('.md') ? '📝' : props.node.name.endsWith('.html') ? '🌐' : '📄')

    return (
      <>
        <div
          class="file-tree-item"
          classList={{ dir: props.node.type === 'directory' }}
          style={{ 'padding-left': `${props.depth * 16 + 4}px` }}
          onClick={(e) => {
            if (props.node.type === 'directory') {
              setExpanded(!expanded())
            } else {
              handleClick(props.node, e)
            }
          }}
        >
          <span class="ft-icon">{icon}</span>
          <span class="ft-name">{props.node.name}</span>
        </div>
        <Show when={props.node.type === 'directory' && expanded() && props.node.children}>
          <For each={props.node.children!}>
            {(child) => <RenderNode node={child} depth={props.depth + 1} />}
          </For>
        </Show>
      </>
    )
  }

  return (
    <div class="file-tree">
      <For each={tree()}>
        {(node) => <RenderNode node={node} depth={0} />}
      </For>
    </div>
  )
}
