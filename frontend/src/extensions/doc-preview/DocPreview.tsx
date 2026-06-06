import { createSignal, Show, onMount, onCleanup } from 'solid-js'
import { useAgent } from '@/shell/useAgent'
import { marked } from 'marked'
import './doc-preview.css'
import type { ServerMessage } from '@bridge/protocol'

marked.setOptions({ breaks: true, gfm: true })

const MARKDOWN_EXTS = new Set(['md', 'mdx'])
const HTML_EXTS = new Set(['html', 'htm'])
const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico'])

type PreviewMode = 'rendered' | 'source'

function safeMarkdown(text: string): string {
  try {
    return marked.parse(text) as string
  } catch {
    return `<pre>${text}</pre>`
  }
}

export function DocPreview() {
  const agent = useAgent()
  const [viewMode, setViewMode] = createSignal<PreviewMode>('source')
  const [content, setContent] = createSignal('')
  const [filePath, setFilePath] = createSignal('')
  const [language, setLanguage] = createSignal('')
  const [imageSrc, setImageSrc] = createSignal('')
  const [loading, setLoading] = createSignal(false)
  const [isMarkdown, setIsMarkdown] = createSignal(false)
  const [isHtml, setIsHtml] = createSignal(false)

  onMount(() => {
    const unsub = agent.subscribe('file.content', (msg: ServerMessage) => {
      // P1-08: 仅处理当前 session 的文件内容
      if (msg.sessionId && msg.sessionId !== agent.sessionId()) return
      setLoading(true)
      const payload = msg.payload as {
        path: string
        content: string
        language: string
        encoding?: 'utf8' | 'base64'
      }
      setFilePath(payload.path)
      setLanguage(payload.language)

      const ext = payload.language.toLowerCase()
      if (payload.encoding === 'base64' || IMAGE_EXTS.has(ext)) {
        const mimeMap: Record<string, string> = {
          png: 'image/png',
          jpg: 'image/jpeg',
          jpeg: 'image/jpeg',
          gif: 'image/gif',
          svg: 'image/svg+xml',
          webp: 'image/webp',
          ico: 'image/x-icon',
        }
        const mime = mimeMap[ext] ?? 'image/png'
        setImageSrc(`data:${mime};base64,${payload.content}`)
        setContent('')
        setIsMarkdown(false)
      } else {
        setContent(payload.content)
        setImageSrc('')
        if (MARKDOWN_EXTS.has(ext)) {
          setIsMarkdown(true)
          setIsHtml(false)
          setViewMode('rendered')
        } else if (HTML_EXTS.has(ext)) {
          setIsMarkdown(false)
          setIsHtml(true)
          setViewMode('rendered')
        } else {
          setIsMarkdown(false)
          setIsHtml(false)
          setViewMode('source')
        }
      }
      setLoading(false)
    })

    onCleanup(() => {
      unsub()
    })
  })

  const fileName = () => {
    if (!filePath()) return ''
    return filePath().split(/[\\/]/).pop() ?? filePath()
  }

  return (
    <div style="display:flex;flex-direction:column;height:100%;">
      <Show when={filePath()}>
        <div
          style={{
            'font-size': '11px',
            color: 'var(--text-muted)',
            'margin-bottom': '4px',
            'white-space': 'nowrap',
            overflow: 'hidden',
            'text-overflow': 'ellipsis',
            'flex-shrink': '0',
          }}
        >
          {fileName()}
        </div>
      </Show>

      <Show when={isMarkdown() || isHtml()}>
        <div class="view-toggle" style="flex-shrink:0;">
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
      </Show>

      <Show
        when={filePath()}
        fallback={
          <div style="font-size:12px;color:var(--text-muted);text-align:center;margin-top:32px;">
            点击左侧文件树中的文件查看内容
          </div>
        }
      >
        <Show
          when={!loading()}
          fallback={
            <div style="font-size:12px;color:var(--text-muted);text-align:center;margin-top:16px;">
              加载中...
            </div>
          }
        >
          <div style="flex:1;min-height:0;overflow:hidden;">
            <Show when={imageSrc()}>
              <img
                src={imageSrc()}
                alt={fileName()}
                style="max-width:100%;max-height:100%;object-fit:contain;border-radius:6px;"
              />
            </Show>
            <Show when={!imageSrc() && viewMode() === 'rendered' && !isHtml()}>
              <div class="preview-rendered" innerHTML={safeMarkdown(content())} />
            </Show>
            <Show when={!imageSrc() && viewMode() === 'rendered' && isHtml()}>
              <iframe
                srcdoc={content()}
                sandbox="allow-same-origin"
                style="width:100%;height:100%;border:none;border-radius:6px;"
              />
            </Show>
            <Show when={!imageSrc() && viewMode() === 'source'}>
              <pre class="preview-source">{content()}</pre>
            </Show>
          </div>
        </Show>
      </Show>
    </div>
  )
}
