import { createSignal, onCleanup } from 'solid-js'
import { useAgent } from '@/shell/useAgent'
import './status-bar.css'

function formatTime(date: Date): string {
  const h = date.getHours().toString().padStart(2, '0')
  const m = date.getMinutes().toString().padStart(2, '0')
  const s = date.getSeconds().toString().padStart(2, '0')
  return `${h}:${m}:${s}`
}

function formatTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

export function StatusBar() {
  const { status, isStreaming, send, subscribe } = useAgent()
  const [time, setTime] = createSignal(new Date())
  const [compactFeedback, setCompactFeedback] = createSignal<{ type: 'success' | 'error'; message: string } | null>(null)

  let feedbackTimer: ReturnType<typeof setTimeout> | null = null

  const showFeedback = (type: 'success' | 'error', message: string) => {
    if (feedbackTimer) clearTimeout(feedbackTimer)
    setCompactFeedback({ type, message })
    feedbackTimer = setTimeout(() => setCompactFeedback(null), 4000)
  }

  // 订阅 compaction 结果 + 错误
  const unsubCompacted = subscribe('session.compacted', (msg) => {
    const p = msg.payload as { tokensBefore: number; tokensAfter: number; tokensSaved: number }
    const saved = p.tokensSaved ?? (p.tokensBefore - p.tokensAfter)
    if (saved > 0) {
      showFeedback('success', `已压缩，释放 ${formatTokens(saved)} tokens`)
    } else {
      showFeedback('success', '压缩完成，当前上下文已是最简')
    }
  })

  const unsubError = subscribe('error', (msg) => {
    const p = msg.payload as { code: string; message: string }
    if (p.code === 'COMPACTION_FAILED' || p.code === 'COMPACTION_NOT_SUPPORTED' || p.code === 'BUSY') {
      showFeedback('error', p.message)
    }
  })

  const timer = setInterval(() => setTime(new Date()), 1000)
  onCleanup(() => {
    clearInterval(timer)
    if (feedbackTimer) clearTimeout(feedbackTimer)
    unsubCompacted()
    unsubError()
  })

  const contextPercent = () => {
    const max = status.contextMax
    if (!Number.isFinite(max) || max <= 0) return 0
    const used = status.contextUsed
    if (!Number.isFinite(used)) return 0
    return Math.round((used / max) * 100)
  }

  const barColor = () => {
    const p = contextPercent()
    if (p > 80) return 'danger'
    if (p > 60) return 'warn'
    return ''
  }

  const contextText = () => {
    const used = status.contextUsed
    const max = status.contextMax
    if (!Number.isFinite(max) || max <= 0) return `${Number.isFinite(used) ? used : '--'} / --`
    const fmt = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n)
    return `${Number.isFinite(used) ? fmt(used) : '--'} / ${fmt(max)}`
  }

  const currentModel = () => status.model ?? ''

  const getModelDisplayName = (id: string) => {
    const models = status.availableModels ?? []
    const m = models.find((m) => m.id === id)
    return m?.name ?? id
  }

  return (
    <div class="glass-panel status-bar">
      <div class="status-row">
        <span class="status-label">⏱</span>
        <span class="status-value mono">{formatTime(time())}</span>
        <span class="status-spacer" />
        <span class="status-label">模型</span>
        <span class="status-value">{getModelDisplayName(currentModel()) || 'Loading...'}</span>
      </div>
      <div class="status-row">
        <span class="status-label">本次消耗</span>
        <span class="status-value mono">{status.tokens.toLocaleString()}</span>
        <span class="status-label">token</span>
        <span class="status-spacer" />
        <span class="status-label">≈ ¥</span>
        <span class="status-value">{status.cost.toFixed(4)}</span>
      </div>
      <div class="status-row">
        <span class="status-label">上下文</span>
        <span class="status-value mono">{contextText()}</span>
      </div>
      <div class="ctx-bar-wrap">
        <div class="ctx-bar-label">
          <span>上下文用量</span>
          <span>
            {contextPercent()}%
            <button
              class="compact-btn"
              title="压缩上下文"
              disabled={isStreaming()}
              onClick={() => send('session.compact', {})}
              style={{
                background: 'none', border: 'none', color: isStreaming() ? 'var(--text-muted)' : 'var(--accent)',
                cursor: isStreaming() ? 'default' : 'pointer', 'font-size': '14px', 'margin-left': '6px',
                padding: '0', 'line-height': '1',
              }}
            >
              ⟳
            </button>
          </span>
        </div>
        {compactFeedback() && (
          <div
            class={`compact-feedback compact-feedback--${compactFeedback()!.type}`}
            onClick={() => {
              navigator.clipboard.writeText(compactFeedback()!.message)
              showFeedback('success', '已复制到剪贴板')
            }}
            title="点击复制"
          >
            <span class="compact-feedback-text">{compactFeedback()!.message}</span>
            <span class="compact-feedback-copy" style="font-size:10px;margin-left:6px;opacity:0.5;flex-shrink:0;">📋</span>
          </div>
        )}
        <div class="ctx-bar">
          <div
            class={`ctx-bar-fill ${barColor()}`}
            style={{ width: `${contextPercent()}%` }}
          />
        </div>
      </div>
    </div>
  )
}
