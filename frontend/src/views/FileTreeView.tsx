import { FolderOpen } from 'lucide-solid'
import { FileTree } from '@/extensions/file-tree/FileTree'

export default function FileTreeView() {
  return (
    <div class="glass-panel-full" style={{ display: 'flex', 'flex-direction': 'column', 'max-width': '480px', margin: '0 auto' }}>
      <div class="bracket-tr"><div class="bracket-h" /><div class="bracket-v" /></div>
      <div style={{
        display: 'flex', 'align-items': 'center', 'justify-content': 'space-between',
        padding: '12px 16px', height: '54px', background: 'var(--panel-bg-top)',
        'border-bottom': '1px solid rgba(255,255,255,0.03)', 'flex-shrink': '0',
      }}>
        <div style={{ 'font-family': '"Noto Serif SC", serif', 'font-size': '14px', 'font-weight': '600', display: 'flex', 'align-items': 'center', gap: '6px' }}><FolderOpen size={14} /> 工作目录</div>
        <div style={{ 'font-family': '"JetBrains Mono", monospace', 'font-size': '10px', color: 'rgba(255,255,255,0.30)' }}>
          browser
        </div>
      </div>
      <div style={{ flex: '1', 'overflow-y': 'auto', padding: '8px 16px' }}>
        <FileTree />
      </div>
    </div>
  )
}
