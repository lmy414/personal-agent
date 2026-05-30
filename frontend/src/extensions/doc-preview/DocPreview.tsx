import { createSignal } from 'solid-js'

export function DocPreview() {
  const [viewMode, setViewMode] = createSignal<'rendered' | 'source'>('rendered')
  const [content] = createSignal('')
  const [filePath] = createSignal('')

  return (
    <>
      <div class="view-toggle">
        <button
          class="view-toggle-btn"
          classList={{ active: viewMode() === 'rendered' }}
          onClick={() => setViewMode('rendered')}
        >
          预览
        </button>
        <button
          class="view-toggle-btn"
          classList={{ active: viewMode() === 'source' }}
          onClick={() => setViewMode('source')}
        >
          源码
        </button>
      </div>
      {content() ? (
        viewMode() === 'rendered' ? (
          <div class="preview-rendered" innerHTML={content()} />
        ) : (
          <div class="preview-source">{content()}</div>
        )
      ) : (
        <div style="font-size:12px;color:var(--text-muted);text-align:center;margin-top:32px;">
          {filePath() ? `加载中...` : '点击左侧文件树中的文件查看内容'}
        </div>
      )}
    </>
  )
}
