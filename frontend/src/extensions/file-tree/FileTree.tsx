import { createSignal, For, Show, onMount, onCleanup } from 'solid-js'
import { useAgent } from '@/shell/useAgent'
import type { FileEntry, ServerMessage } from '@bridge/protocol'
import './file-tree.css'

interface TreeNode {
  name: string
  type: 'file' | 'directory'
  path: string
  children?: TreeNode[]
  loaded: boolean
}

const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico'])

function getSettingFromList(entries: { key: string; value: string }[], key: string): string {
  return entries.find((e) => e.key === key)?.value ?? ''
}

function fileIcon(name: string, type: 'file' | 'directory'): string {
  if (type === 'directory') return '📁'
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  if (ext === 'md' || ext === 'mdx') return '📝'
  if (ext === 'ts' || ext === 'tsx' || ext === 'js' || ext === 'jsx') return '🟦'
  if (ext === 'json') return '{}'
  if (ext === 'css') return '🎨'
  if (ext === 'html') return '🌐'
  if (ext === 'py' || ext === 'rs' || ext === 'go') return '⚙️'
  if (IMAGE_EXTS.has(ext)) return '🖼️'
  return '📄'
}

export function FileTree() {
  const agent = useAgent()
  const [tree, setTree] = createSignal<TreeNode[]>([])
  const [loading, setLoading] = createSignal(true)
  const [error, setError] = createSignal<string | null>(null)

  // store expanded children per directory path
  const [dirChildren, setDirChildren] = createSignal<Record<string, TreeNode[]>>({})
  const [expandedDirs, setExpandedDirs] = createSignal<Set<string>>(new Set())
  const [displayRoot, setDisplayRoot] = createSignal('')
  let rootPath = ''
  let currentWorkDir = ''
  let pendingRoot = ''  // 跟踪预期的根路径，解决初始响应竞态

  onMount(() => {
    // 读取工作目录设置作为根路径
    const settingsEntries = agent.settings()
    currentWorkDir = getSettingFromList(settingsEntries, 'work_dir')
    // 仅当已有工作目录时才发初始请求，否则等 settings.state 订阅触发
    if (currentWorkDir) pendingRoot = currentWorkDir

    const unsub = agent.subscribe('file.list', (msg: ServerMessage) => {
      const payload = msg.payload as { path: string; entries: FileEntry[] }
      console.log('[file-tree] file.list received, path:', payload.path, 'entries:', payload.entries.length)
      const entries: TreeNode[] = payload.entries
        .filter((e) => !e.name.startsWith('.') || e.name === '.gitignore')
        .map((e) => {
          // P1-12: 统一用 / 分隔，避免 Windows 路径混用
          const basePath = payload.path ? payload.path.replace(/\\/g, '/') : ''
          const childPath = basePath ? `${basePath}/${e.name}` : e.name
          return {
            name: e.name,
            type: e.type,
            path: childPath,
            loaded: false,
          }
        })

      // 路径归一化：bridge 返回 \ 但 tree node.path 用 /，统一 key
      const normPath = payload.path.replace(/\\/g, '/')
      console.log('[file-tree] normPath:', normPath, 'tree.len:', tree().length, 'rootPath:', rootPath, 'pendingRoot:', pendingRoot)
      // 若是预期的根路径响应，或 tree 为空，则替换整棵树
      if (tree().length === 0 || normPath === rootPath || normPath === pendingRoot) {
        if (normPath === pendingRoot) pendingRoot = ''  // 仅匹配时才清除
        rootPath = normPath
        setDisplayRoot(normPath)
        setTree(entries)
      } else {
        // subdirectory — store children keyed by normalized path
        setDirChildren((prev) => ({ ...prev, [normPath]: entries }))
      }
      setLoading(false)
    })

    // 自动刷新：bridge 推送 file.changed 时重新加载可见目录
    const unsubChange = agent.subscribe('file.changed', (msg: ServerMessage) => {
      const changedPath = (msg.payload as { path: string }).path
      const rootSendPath = currentWorkDir || '.'
      agent.send('file.list', { path: rootSendPath })
      // 如果变化的目录正好是已展开的子目录，也刷新它
      if (expandedDirs().has(changedPath)) {
        agent.send('file.list', { path: changedPath })
      }
    })

    // 监听工作目录设置变更
    const unsubSettings = agent.subscribe('settings.state', (_msg: ServerMessage) => {
      const entries = (_msg.payload as { entries: { key: string; value: string }[] }).entries
      const newWorkDir = getSettingFromList(entries, 'work_dir')
      console.log('[file-tree] settings.state received, work_dir:', newWorkDir, 'current:', currentWorkDir)
      if (newWorkDir !== currentWorkDir) {
        console.log('[file-tree] work_dir changed, sending file.list for:', newWorkDir)
        currentWorkDir = newWorkDir
        pendingRoot = newWorkDir
        setTree([])
        setDirChildren({})
        setExpandedDirs(new Set<string>())
        rootPath = ''
        setDisplayRoot(newWorkDir)
        setLoading(true)
        const sendPath = newWorkDir || '.'
        agent.send('file.list', { path: sendPath })
      }
    })

    let errorTid: ReturnType<typeof setTimeout> | undefined

    const unsubError = agent.subscribe('error', (msg: ServerMessage) => {
      const payload = msg.payload as { code: string; message: string }
      if (payload.code === 'FILE_ERROR') {
        setError(payload.message)
        errorTid = setTimeout(() => setError(null), 3000)
      }
    })

    onCleanup(() => {
      unsub()
      unsubChange()
      unsubSettings()
      unsubError()
      if (errorTid !== undefined) clearTimeout(errorTid)
    })

    // 仅当已有工作目录时才发初始请求，否则等 settings.state 订阅触发
    if (currentWorkDir) {
      agent.send('file.list', { path: currentWorkDir })
    } else {
      setLoading(false)
    }
  })

  const handleToggleDir = (node: TreeNode, e: MouseEvent) => {
    e.stopPropagation()
    const path = node.path
    const expanded = expandedDirs()
    const isOpen = expanded.has(path)

    if (!isOpen && !(path in dirChildren())) {
      // not loaded yet — fetch
      agent.send('file.list', { path })
    }

    if (isOpen) {
      const next = new Set(expanded)
      next.delete(path)
      setExpandedDirs(next)
    } else {
      const next = new Set(expanded)
      next.add(path)
      setExpandedDirs(next)
    }
  }

  const handleFileClick = (node: TreeNode, e: MouseEvent) => {
    e.stopPropagation()
    const ext = node.name.split('.').pop()?.toLowerCase() ?? ''
    const isImage = IMAGE_EXTS.has(ext)
    agent.send('file.read', { path: node.path, encoding: isImage ? 'base64' : 'utf8' })
    window.dispatchEvent(new CustomEvent('switch-right-tab', { detail: 'doc-preview' }))
  }

  const handleDragStart = (node: TreeNode, e: DragEvent) => {
    e.dataTransfer?.setData('text/plain', node.path)
    e.dataTransfer?.setData('application/x-file-path', node.path)
    e.dataTransfer?.setData('application/x-file-name', node.name)
    e.dataTransfer!.effectAllowed = 'copy'
  }

  const getChildren = (node: TreeNode): TreeNode[] | undefined => {
    const expanded = expandedDirs()
    if (!expanded.has(node.path)) return undefined
    return dirChildren()[node.path]
  }

  const RenderNode = (props: { node: TreeNode; depth: number }) => {
    const children = () => getChildren(props.node)
    const isExpanded = () => children() !== undefined

    return (
      <>
        <div
          class="file-tree-item"
          classList={{ dir: props.node.type === 'directory' }}
          style={{ 'padding-left': `${props.depth * 16 + 4}px` }}
          draggable={props.node.type === 'file'}
          onDragStart={(e) => handleDragStart(props.node, e)}
          onClick={(e) => {
            if (props.node.type === 'directory') {
              handleToggleDir(props.node, e)
            } else {
              handleFileClick(props.node, e)
            }
          }}
        >
          <span class="ft-icon">
            {props.node.type === 'directory'
              ? (isExpanded() ? '📂' : '📁')
              : fileIcon(props.node.name, 'file')}
          </span>
          <span class="ft-name">{props.node.name}</span>
        </div>
        <Show when={props.node.type === 'directory' && isExpanded()}>
          <Show
            when={children()!.length > 0}
            fallback={
              <div class="file-tree-empty" style={{ 'padding-left': `${(props.depth + 1) * 16 + 4}px` }}>
                空目录
              </div>
            }
          >
            <For each={children()!}>
              {(child) => <RenderNode node={child} depth={props.depth + 1} />}
            </For>
          </Show>
        </Show>
      </>
    )
  }

  return (
    <div class="file-tree">
      <div class="file-tree-toolbar">
        <span class="file-tree-root-path" title="当前工作目录">📁 {displayRoot() || '加载中...'}</span>
        <button
          class="file-tree-refresh-btn"
          title="刷新文件列表"
          onClick={() => {
            // 清空子目录缓存后，展开的目录会显示为空；立即重新请求
            const rootSendPath = currentWorkDir || '.'
            agent.send('file.list', { path: rootSendPath })
            const expanded = expandedDirs()
            for (const path of expanded) {
              agent.send('file.list', { path })
            }
          }}
        >
          ↻
        </button>
      </div>
      <Show when={!loading()} fallback={
        <div class="file-tree-loading">加载中...</div>
      }>
        <Show when={!error()} fallback={
          <div class="file-tree-error">{error()}</div>
        }>
          <Show when={tree().length > 0} fallback={
            <div class="file-tree-empty">空目录</div>
          }>
            <For each={tree()}>
              {(node) => <RenderNode node={node} depth={0} />}
            </For>
          </Show>
        </Show>
      </Show>
    </div>
  )
}
