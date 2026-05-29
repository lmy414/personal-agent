import { createSignal } from 'solid-js'

export function DocPreview() {
  const [viewMode, setViewMode] = createSignal<'preview' | 'source'>('preview')
  const [content] = createSignal('')
  const [filePath] = createSignal('')

  return (
    <div class="p-3">
      <div class="flex items-center justify-between mb-3">
        <span class="text-xs text-[var(--text-secondary)] truncate flex-1">
          {filePath() || '选择文件以预览'}
        </span>
        <div class="flex gap-1">
          <button
            class="text-xs px-2 py-0.5 rounded"
            classList={{
              'bg-[var(--accent)]/20 text-[var(--accent)]': viewMode() === 'preview',
              'text-[var(--text-secondary)] hover:text-[var(--text-primary)]': viewMode() !== 'preview',
            }}
            onClick={() => setViewMode('preview')}
          >
            预览
          </button>
          <button
            class="text-xs px-2 py-0.5 rounded"
            classList={{
              'bg-[var(--accent)]/20 text-[var(--accent)]': viewMode() === 'source',
              'text-[var(--text-secondary)] hover:text-[var(--text-primary)]': viewMode() !== 'source',
            }}
            onClick={() => setViewMode('source')}
          >
            源码
          </button>
        </div>
      </div>
      <div class="bg-black/30 rounded-lg p-3 min-h-[120px]">
        {content() ? (
          <pre class="text-xs text-[var(--text-secondary)] font-mono whitespace-pre-wrap">
            {content()}
          </pre>
        ) : (
          <div class="text-xs text-[var(--text-secondary)] text-center">
            点击左侧文件树中的文件查看内容
          </div>
        )}
      </div>
    </div>
  )
}
