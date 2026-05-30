import { createSignal, For, onCleanup } from 'solid-js'
import { useAgent } from '@/shell/useAgent'

function formatTime(date: Date): string {
  const h = date.getHours().toString().padStart(2, '0')
  const m = date.getMinutes().toString().padStart(2, '0')
  const s = date.getSeconds().toString().padStart(2, '0')
  return `${h}:${m}:${s}`
}

export function StatusBar() {
  const { status, switchModel, isStreaming, send } = useAgent()
  const [time, setTime] = createSignal(new Date())

  const timer = setInterval(() => setTime(new Date()), 1000)
  onCleanup(() => clearInterval(timer))

  const contextPercent = () => {
    if (status.contextMax === 0) return 0
    return Math.round((status.contextUsed / status.contextMax) * 100)
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
    if (max === 0) return `${used} / --`
    if (used >= 1000) return `${(used / 1000).toFixed(1)}k / ${(max / 1000).toFixed(0)}k`
    return `${used} / ${(max / 1000).toFixed(0)}k`
  }

  const models = () => status.availableModels ?? []
  const currentModel = () => status.model ?? ''

  const getModelDisplayName = (id: string) => {
    const m = models().find((m) => m.id === id)
    return m?.name ?? id
  }

  return (
    <div class="glass-panel status-bar">
      <div class="status-row">
        <span class="status-label">⏱</span>
        <span class="status-value mono">{formatTime(time())}</span>
        <span class="status-spacer" />
        <span class="status-label">模型</span>
        <select
          class="model-select"
          disabled={isStreaming()}
          onChange={(e) => switchModel(e.currentTarget.value)}
        >
          {models().length > 0 ? (
            <For each={models()}>
              {(m) => (
                <option value={m.id} selected={m.id === currentModel()}>
                  {m.name}
                </option>
              )}
            </For>
          ) : (
            <option value={currentModel()}>{getModelDisplayName(currentModel()) || 'Loading...'}</option>
          )}
        </select>
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
        <span class="status-spacer" />
        <span class="status-label">轮次</span>
        <span class="status-value">{status.roundCount}</span>
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
