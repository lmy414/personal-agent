import { Show, For } from 'solid-js'
import { registry } from '@/registry'
import { FolderOpen } from 'lucide-solid'
import { FileTree } from '@/extensions/file-tree/FileTree'
import { navigateTo } from '@/shell/nav-signal'

/**
 * PencilMainView — 主工作区布局
 *
 * 从 registry sidebar 槽位读取 Sidebar / ChatPanel / EditorPanel 扩展，
 * 按注册顺序渲染。FileTree 视图内联处理。
 */
export default function PencilMainView(props: { sidebarMode?: 'chat' | 'files' }) {
  const showFileTree = () => props.sidebarMode === 'files'
  const sidebarExts = () => registry.getBySlot('sidebar')

  const renderSidebarExt = (id: string) => {
    const ext = sidebarExts().find((e) => e.id === id)
    if (!ext) return null
    const Comp = ext.component
    return <Comp />
  }

  return (
    <>
      <Show when={showFileTree()} fallback={renderSidebarExt('sidebar')}>
        <div class="glass-panel" style={{ width: '320px', 'flex-shrink': '0', display: 'flex', 'flex-direction': 'column', 'z-index': '5' }}>
          <div style={{ display: 'flex', 'align-items': 'center', 'justify-content': 'space-between', padding: '12px 16px', height: '54px', background: 'var(--panel-bg-top)', 'border-bottom': '1px solid rgba(255,255,255,0.03)', 'flex-shrink': '0' }}>
            <div style={{ 'font-family': '"Noto Serif SC", serif', 'font-size': '14px', 'font-weight': '600', display: 'flex', 'align-items': 'center', gap: '6px' }}><FolderOpen size={14} /> 工作目录</div>
            <button style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', 'font-size': '11px' }} onClick={() => navigateTo('chat')}>✕</button>
          </div>
          <div style={{ flex: '1', 'overflow-y': 'auto', padding: '8px 0' }}>
            <FileTree />
          </div>
        </div>
      </Show>
      {renderSidebarExt('chat-panel')}
      {renderSidebarExt('editor-panel')}
    </>
  )
}
