import type { JSX } from 'solid-js'
import { createSignal, For, Show, createMemo, onMount, onCleanup } from 'solid-js'
import { useAgent } from '@/shell/useAgent'
import type { ServerMessage } from '@bridge/protocol'
import { Code2, FileText, Globe, ChevronLeft } from 'lucide-solid'
import { marked } from 'marked'
import './editor-panel.css'

interface OpenFile {
  path: string
  name: string
  content: string
  viewMode: 'source' | 'preview'
}

const PREVIEW_EXTS = new Set(['md', 'html', 'htm'])

function fileIconName(name: string): () => JSX.Element {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  if (ext === 'ts' || ext === 'tsx' || ext === 'js' || ext === 'jsx') return () => <Code2 size={12} />
  if (ext === 'md') return () => <FileText size={12} />
  if (ext === 'html' || ext === 'htm') return () => <Globe size={12} />
  return () => <FileText size={12} />
}

export function EditorPanel() {
  const agent = useAgent()
  const [openFiles, setOpenFiles] = createSignal<OpenFile[]>([])
  const [activeIdx, setActiveIdx] = createSignal(0)
  const [panelW, setPanelW] = createSignal(340)
  let dragStartX = 0
  let dragStartW = 0

  // Subscribe to file content
  onMount(() => {
    const unsub = agent.subscribe('file.content', (msg: ServerMessage) => {
      const p = msg.payload as { path: string; content: string; language?: string; encoding?: string }
      const name = p.path.replace(/\\/g, '/').split('/').pop() ?? p.path
      const ext = name.split('.').pop()?.toLowerCase() ?? ''
      const isMd = ext === 'md' || ext === 'html' || ext === 'htm'
      setOpenFiles((prev) => {
        const existing = prev.findIndex((f) => f.path === p.path)
        if (existing >= 0) {
          const next = [...prev]
          next[existing] = { ...next[existing], content: p.content }
          setActiveIdx(existing)
          return next
        }
        setActiveIdx(prev.length)
        return [...prev, { path: p.path, name, content: p.content, viewMode: isMd ? 'preview' as const : 'source' as const }]
      })
    })
    onCleanup(() => unsub())
  })

  const handleClose = (idx: number) => {
    setOpenFiles((prev) => {
      const next = prev.filter((_, i) => i !== idx)
      if (activeIdx() >= next.length) setActiveIdx(Math.max(0, next.length - 1))
      return next
    })
  }

  const active = () => openFiles()[activeIdx()]
  const isMd = () => {
    const f = active()
    if (!f) return false
    return PREVIEW_EXTS.has(f.name.split('.').pop()?.toLowerCase() ?? '')
  }

  // Drag resize
  const onDragStart = (e: MouseEvent) => {
    e.preventDefault()
    dragStartX = e.clientX
    dragStartW = panelW()
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    const onMove = (ev: MouseEvent) => { setPanelW(Math.max(0, Math.min(900, dragStartW - (ev.clientX - dragStartX)))) }
    const onUp = () => { document.body.style.cursor = ''; document.body.style.userSelect = ''; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  const markdownContent = createMemo(() => {
    const f = active()
    if (!f || !f.content) return ''
    const ext = f.name.split('.').pop()?.toLowerCase() ?? ''
    if (ext === 'html' || ext === 'htm') return f.content
    return marked.parse(f.content) as string
  })

  return (
    <div class="glass-panel editor-panel" style={{ width: `${panelW()}px`, 'flex-shrink': '0', display: 'flex', 'flex-direction': 'column', 'z-index': '3', overflow: 'visible' }}>
      {/* Drag handle */}
      <div style={{ position: 'absolute', left: '-5px', top: '0', bottom: '0', width: '10px', cursor: 'col-resize', 'z-index': '10' }} onMouseDown={onDragStart} onDblClick={() => setPanelW(340)} />

      <Show when={panelW() > 0} fallback={
        <div onClick={() => setPanelW(340)} style={{ position: 'absolute', top: '45%', right: '-28px', 'writing-mode': 'vertical-lr', padding: '8px 6px', background: 'var(--glass-bg)', 'backdrop-filter': 'var(--glass-blur)', '-webkit-backdrop-filter': 'var(--glass-blur)', border: '1px solid rgba(255,255,255,0.10)', 'border-radius': '4px 4px 0 0', color: 'var(--text-secondary)', 'font-size': '11px', cursor: 'pointer', 'z-index': '99' }}>資料閲覧</div>
      }>
        <div class="bracket-tr"><div class="bracket-h" /><div class="bracket-v" /></div>

        {/* Editor Header */}
        <div style={{ display: 'flex', 'align-items': 'center', 'justify-content': 'space-between', padding: '12px 16px', height: '54px', background: 'rgb(var(--top-bar-tint-rgb))', 'border-bottom': '1px solid rgba(255,255,255,0.03)', 'flex-shrink': '0' }}>
          <div style={{ 'font-family': '"Noto Serif SC", serif', 'font-size': '14px', 'font-weight': '600', color: '#fff' }}>資料閲覧</div>
          <button style={{ display: 'flex', 'align-items': 'center', gap: '4px', background: 'none', border: 'none', color: 'var(--text-muted)', 'font-size': '11px', cursor: 'pointer', 'font-family': 'inherit' }} onClick={() => setPanelW(0)}>
            收起 <ChevronLeft size={11} />
          </button>
        </div>
        <div class="divider" />

        {/* File Tabs */}
        <div style={{ display: 'flex', 'align-items': 'center', padding: '0 4px', height: '31px', 'border-bottom': '1px solid rgba(255,255,255,0.03)', 'flex-shrink': '0', 'overflow-x': 'auto', gap: '0' }}>
          <For each={openFiles()}>{(f, idx) => (
            <div onClick={() => setActiveIdx(idx())} style={{ display: 'flex', 'align-items': 'center', gap: '5px', padding: '4px 8px', 'font-size': '12px', cursor: 'pointer', 'white-space': 'nowrap', color: activeIdx() === idx() ? 'var(--text-primary)' : 'var(--text-muted)', 'border-bottom': activeIdx() === idx() ? '2px solid var(--accent)' : '2px solid transparent', background: activeIdx() === idx() ? 'rgba(255,255,255,0.04)' : 'transparent', 'flex-shrink': '0' }}>
              <span style={{ display: 'flex' }}>{fileIconName(f.name)()}</span>
              <span style={{ 'max-width': '120px', overflow: 'hidden', 'text-overflow': 'ellipsis' }}>{f.name}</span>
              <span onClick={(e) => { e.stopPropagation(); handleClose(idx()) }} style={{ 'font-size': '14px', opacity: '0.4', cursor: 'pointer', 'line-height': '1' }} onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0.8' }} onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0.4' }}>×</span>
            </div>
          )}</For>
          <Show when={openFiles().length === 0}>
            <div style={{ 'font-size': '12px', color: 'var(--text-muted)', padding: '0 8px' }}>未打开文件</div>
          </Show>
        </div>

        {/* Toolbar */}
        <Show when={active()}>
          <div style={{ display: 'flex', 'align-items': 'center', 'justify-content': 'space-between', padding: '6px 16px', height: '28px', 'border-bottom': '1px solid rgba(255,255,255,0.03)', 'flex-shrink': '0' }}>
            <span style={{ 'font-family': '"JetBrains Mono", monospace', 'font-size': '10px', color: 'rgba(255,255,255,0.40)', 'text-transform': 'uppercase' }}>
              {active()?.name.split('.').pop()?.toUpperCase()} · {active()?.content.split('\n').length} LINES
            </span>
            <Show when={isMd()}>
              <div style={{ display: 'flex', 'align-items': 'center', gap: '8px', 'font-size': '11px' }}>
                <span onClick={() => setOpenFiles((p) => { const n = [...p]; if (n[activeIdx()]) n[activeIdx()] = { ...n[activeIdx()], viewMode: 'source' }; return n })} style={{ color: active()?.viewMode === 'source' ? 'var(--text-primary)' : 'var(--text-muted)', 'font-weight': active()?.viewMode === 'source' ? '600' : '400', cursor: 'pointer' }}>Source</span>
                <span onClick={() => setOpenFiles((p) => { const n = [...p]; if (n[activeIdx()]) n[activeIdx()] = { ...n[activeIdx()], viewMode: 'preview' }; return n })} style={{ color: active()?.viewMode === 'preview' ? 'var(--text-primary)' : 'var(--text-muted)', 'font-weight': active()?.viewMode === 'preview' ? '600' : '400', cursor: 'pointer' }}>Preview</span>
              </div>
            </Show>
          </div>
          <div class="divider" />
        </Show>

        {/* Content */}
        <div style={{ flex: '1', 'overflow-y': 'auto', padding: '8px 16px', 'min-height': '0' }}>
          <Show when={active()} fallback={
            <div style={{ 'font-size': '12px', color: 'var(--text-muted)', 'text-align': 'center', 'margin-top': '40px' }}>在文件树中点击文件打开</div>
          }>
            <Show when={isMd() && active()?.viewMode === 'preview'} fallback={
              <pre style={{ 'font-family': '"JetBrains Mono", monospace', 'font-size': '11px', 'line-height': '1.6', color: 'var(--text-secondary)', 'white-space': 'pre-wrap', 'word-break': 'break-all', margin: '0', 'user-select': 'text' }}>{active()?.content}</pre>
            }>
              <Show when={(active()?.name.split('.').pop()?.toLowerCase() ?? '') === 'html'} fallback={
                <div class="msg-content" innerHTML={markdownContent()} style={{ 'font-size': '13px', 'line-height': '1.7', color: 'var(--text-primary)', 'user-select': 'text' }} />
              }>
                <iframe srcdoc={active()?.content} style={{ width: '100%', height: '100%', border: 'none', background: '#050508' }} sandbox="allow-scripts" />
              </Show>
            </Show>
          </Show>
        </div>
      </Show>
    </div>
  )
}
