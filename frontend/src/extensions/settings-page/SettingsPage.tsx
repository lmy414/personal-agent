import { createEffect, For, createSignal, onCleanup } from 'solid-js'
import { useAgent } from '@/shell/useAgent'
import { isSettingsOpen, setIsSettingsOpen } from '@/shell/settings-signal'
import { live2dWidth, setLive2dWidth, live2dHeight, setLive2dHeight, live2dScale, setLive2dScale, live2dOffsetX, setLive2dOffsetX, live2dOffsetY, setLive2dOffsetY } from '@/shell/live2d-signal'

type SettingsTab = 'agent' | 'live2d'

function getSetting(entries: { key: string; value: string }[], key: string): string {
  return entries.find((e) => e.key === key)?.value ?? ''
}

function formatCw(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '--'
  return n >= 1000 ? `${(n / 1000).toFixed(0)}k` : String(n)
}

export function SettingsPage() {
  const agent = useAgent()

  const [expandedModelId, setExpandedModelId] = createSignal<string | null>(null)
  const [settingsTab, setSettingsTab] = createSignal<SettingsTab>('agent')

  // 打开时拉取设置 + 自动发现模型
  createEffect(() => {
    if (isSettingsOpen()) {
      agent.getSettings()
      agent.send('settings.discover-models', {})
    }
  })

  // ESC 关闭
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') setIsSettingsOpen(false)
  }

  createEffect(() => {
    if (isSettingsOpen()) {
      window.addEventListener('keydown', handleKeyDown)
    }
  })

  onCleanup(() => {
    window.removeEventListener('keydown', handleKeyDown)
  })

  // ── 派生值 ──
  const entries = () => agent.settings()
  const defaultModel = () => getSetting(entries(), 'default_model') || 'deepseek-chat'
  const thinkingLevel = () => getSetting(entries(), 'thinking_level') || 'medium'
  const compactThreshold = () => getSetting(entries(), 'compact_threshold') || '80'
  const historyRetention = () => getSetting(entries(), 'history_retention') || '100'

  const [modelSearch, setModelSearch] = createSignal('')

  const modelList = () => {
    const provRaw = getSetting(entries(), 'providers')
    const models: { id: string; name: string; provider: string; contextWindow: number; enabled: boolean }[] = []
    if (provRaw) {
      try {
        const providers = JSON.parse(provRaw) as {
          id: string; name: string; models?: { id: string; name: string; contextWindow: number }[]
        }[]
        for (const p of providers) {
          if (p.models) {
            for (const m of p.models) {
              models.push({ ...m, provider: p.name, enabled: true })
            }
          }
        }
      } catch { /* fall through */ }
    }
    const q = modelSearch().toLowerCase()
    if (q) {
      return models.filter((m) =>
        m.id.toLowerCase().includes(q) ||
        m.name.toLowerCase().includes(q) ||
        m.provider.toLowerCase().includes(q)
      )
    }
    return models
  }

  const modelCount = () => modelList().length

  return (
    <div class="settings-page" classList={{ open: isSettingsOpen() }}>
      <div class="settings-page-header">
        <button class="settings-back-btn" onClick={() => setIsSettingsOpen(false)} title="返回">←</button>
        <span style="font-size:18px;">⚙</span>
        <span class="settings-page-title">设置</span>
        <span class="settings-page-subtitle">配置智能体行为和模型接入</span>
      </div>
      <div class="settings-page-body">
        <div class="settings-nav">
          <div
            class="settings-nav-item"
            classList={{ active: settingsTab() === 'agent' }}
            onClick={() => setSettingsTab('agent')}
          >
            <span class="nav-icon">🤖</span> 智能体基础设置
          </div>
          <div
            class="settings-nav-item"
            classList={{ active: settingsTab() === 'live2d' }}
            onClick={() => setSettingsTab('live2d')}
          >
            <span class="nav-icon">🎭</span> Live2D 设置
          </div>
        </div>

        <div class="settings-content">
          {/* ══════════ 智能体基础设置 ══════════ */}
          {settingsTab() === 'agent' && (
            <>
              <div class="settings-section">
                <div class="settings-section-title">🔌 已配置厂商</div>
                <div class="settings-section-desc">当前已接入的模型厂商。新对话将使用默认模型创建。</div>
                <div class="provider-grid">
                  <div class="provider-card">
                    <div class="provider-icon">🟢</div>
                    <div class="provider-info">
                      <div class="provider-name">DeepSeek</div>
                      <div class="provider-status">V3 / V4 Pro / R1</div>
                    </div>
                    <span class="provider-check">✓</span>
                  </div>
                </div>
                <button class="provider-add-btn" title="后续版本支持接入更多厂商">
                  <span style="font-size:16px;">+</span> 新增配置（即将推出）
                </button>
              </div>

              <div class="settings-section">
                <div class="settings-section-title">
                  📋 已接入模型
                  <span style="font-size:11px;color:var(--text-muted);font-weight:400;margin-left:8px;">
                    共 {modelCount()} 个
                  </span>
                </div>
                <div class="settings-section-desc">点击行展开独立参数，★ 设为默认。</div>
                <input
                  class="settings-model-search"
                  type="text"
                  placeholder="搜索模型..."
                  value={modelSearch()}
                  onInput={(e) => setModelSearch(e.currentTarget.value)}
                />
                <div class="model-table-wrap">
                  <table class="model-table">
                    <thead>
                      <tr><th>默认</th><th>模型</th><th>厂商</th><th>上下文</th><th>状态</th></tr>
                    </thead>
                    <tbody>
                      <For each={modelList()}>
                        {(m) => {
                          const isDefault = m.id === defaultModel()
                          const isExpanded = expandedModelId() === m.id
                          return (
                            <>
                              <tr classList={{ expanded: isExpanded }} onClick={() => setExpandedModelId(isExpanded ? null : m.id)}>
                                <td onClick={(e) => e.stopPropagation()}>
                                  <span
                                    class={`model-default-star${isDefault ? '' : ' inactive'}`}
                                    onClick={() => agent.setSetting('default_model', m.id)}
                                    title={isDefault ? '当前默认' : '设为默认'}
                                  >★</span>
                                </td>
                                <td class="model-name">{m.name}</td>
                                <td class="model-provider">{m.provider}</td>
                                <td class="model-cw">{formatCw(m.contextWindow)}</td>
                                <td style={{ 'font-size': '11px', color: m.enabled ? '#4ade80' : 'var(--text-muted)' }}>
                                  {m.enabled ? '可用' : '已禁用'}
                                </td>
                              </tr>
                              <tr class={`model-config-row${isExpanded ? ' open' : ''}`}>
                                <td colspan="5">
                                  <div class="model-params">
                                    <div class="model-param">
                                      <span class="model-param-label">思考强度</span>
                                      <span class="model-param-value">
                                        <select value={thinkingLevel()} onChange={(e) => agent.setSetting('thinking_level', e.currentTarget.value)}>
                                          <option value="low">Low</option>
                                          <option value="medium">Medium</option>
                                          <option value="high">High</option>
                                        </select>
                                      </span>
                                    </div>
                                    <div class="model-param">
                                      <span class="model-param-label">启用</span>
                                      <button class={`model-toggle${m.enabled ? ' on' : ''}`} onClick={(e) => { e.stopPropagation() }} />
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            </>
                          )
                        }}
                      </For>
                    </tbody>
                  </table>
                </div>
              </div>

              <div class="settings-section">
                <div class="settings-section-title">⚙ 默认参数</div>
                <div class="settings-form-row">
                  <span class="settings-form-label">思考强度</span>
                  <span class="settings-form-value">
                    <select class="settings-select" value={thinkingLevel()} onChange={(e) => agent.setSetting('thinking_level', e.currentTarget.value)}>
                      <option value="low">Low — 快速响应</option>
                      <option value="medium">Medium — 均衡</option>
                      <option value="high">High — 深度思考</option>
                    </select>
                  </span>
                </div>
                <div class="settings-form-row">
                  <span class="settings-form-label">压缩阈值</span>
                  <span class="settings-form-value">
                    <input class="settings-input" type="number" min="50" max="95"
                      value={compactThreshold()}
                      onChange={(e) => agent.setSetting('compact_threshold', e.currentTarget.value)} />
                    <span class="settings-input-unit">%</span>
                  </span>
                </div>
                <div class="settings-form-row">
                  <span class="settings-form-label">历史保留</span>
                  <span class="settings-form-value">
                    <input class="settings-input" type="number" min="10" max="500"
                      value={historyRetention()}
                      onChange={(e) => agent.setSetting('history_retention', e.currentTarget.value)} />
                    <span class="settings-input-unit">条</span>
                  </span>
                </div>
                <div class="settings-form-row">
                  <span class="settings-form-label">默认模型</span>
                  <span class="settings-form-value">
                    <span style="font-size:13px;color:var(--accent);font-weight:500;">{defaultModel()}</span>
                  </span>
                </div>
              </div>
            </>
          )}

          {/* ══════════ Live2D 设置 ══════════ */}
          {settingsTab() === 'live2d' && (
            <>
              <div class="settings-section">
                <div class="settings-section-title">📐 窗口尺寸</div>
                <div class="settings-form-row">
                  <span class="settings-form-label">宽度</span>
                  <span class="settings-form-value">
                    <input class="settings-input" type="number" min="200" max="500" step="10"
                      value={live2dWidth()} onChange={(e) => setLive2dWidth(parseInt(e.currentTarget.value) || 280)} />
                    <span class="settings-input-unit">px</span>
                    <input type="range" min="200" max="500" step="10"
                      value={live2dWidth()} onInput={(e) => setLive2dWidth(parseInt(e.currentTarget.value))}
                      style="flex:1;margin-left:8px;accent-color:var(--accent);cursor:pointer;" />
                  </span>
                </div>
                <div class="settings-form-row">
                  <span class="settings-form-label">高度</span>
                  <span class="settings-form-value">
                    <input class="settings-input" type="number" min="260" max="650" step="10"
                      value={live2dHeight()} onChange={(e) => setLive2dHeight(parseInt(e.currentTarget.value) || 380)} />
                    <span class="settings-input-unit">px</span>
                    <input type="range" min="260" max="650" step="10"
                      value={live2dHeight()} onInput={(e) => setLive2dHeight(parseInt(e.currentTarget.value))}
                      style="flex:1;margin-left:8px;accent-color:var(--accent);cursor:pointer;" />
                  </span>
                </div>
              </div>

              <div class="settings-section">
                <div class="settings-section-title">🎭 模型调节</div>
                <div class="settings-section-desc">
                  调节悬浮窗内模型的位置和大小。也可直接在悬浮窗上拖拽/滚轮操作。
                </div>
                <div class="settings-form-row">
                  <span class="settings-form-label">缩放</span>
                  <span class="settings-form-value">
                    <input class="settings-input" type="number" min="0" max="200" step="5"
                      value={live2dScale()}
                      onChange={(e) => setLive2dScale(parseInt(e.currentTarget.value) || 0)} />
                    <span class="settings-input-unit">%(0=自动)</span>
                    <input type="range" min="0" max="200" step="5"
                      value={live2dScale()}
                      onInput={(e) => setLive2dScale(parseInt(e.currentTarget.value))}
                      style="flex:1;margin-left:8px;accent-color:var(--accent);cursor:pointer;" />
                  </span>
                </div>
                <div class="settings-form-row">
                  <span class="settings-form-label">水平偏移</span>
                  <span class="settings-form-value">
                    <input class="settings-input" type="number" min="-500" max="500" step="1"
                      value={live2dOffsetX()}
                      onChange={(e) => setLive2dOffsetX(parseInt(e.currentTarget.value) || 0)} />
                    <span class="settings-input-unit">px</span>
                    <input type="range" min="-500" max="500" step="1"
                      value={live2dOffsetX()}
                      onInput={(e) => setLive2dOffsetX(parseInt(e.currentTarget.value))}
                      style="flex:1;margin-left:8px;accent-color:var(--accent);cursor:pointer;" />
                  </span>
                </div>
                <div class="settings-form-row">
                  <span class="settings-form-label">垂直偏移</span>
                  <span class="settings-form-value">
                    <input class="settings-input" type="number" min="-500" max="500" step="1"
                      value={live2dOffsetY()}
                      onChange={(e) => setLive2dOffsetY(parseInt(e.currentTarget.value) || 0)} />
                    <span class="settings-input-unit">px</span>
                    <input type="range" min="-500" max="500" step="1"
                      value={live2dOffsetY()}
                      onInput={(e) => setLive2dOffsetY(parseInt(e.currentTarget.value))}
                      style="flex:1;margin-left:8px;accent-color:var(--accent);cursor:pointer;" />
                  </span>
                </div>
                <div style="display:flex;gap:8px;margin-top:8px;">
                  <button class="provider-config-btn"
                    onClick={() => { setLive2dScale(0); setLive2dOffsetX(0); setLive2dOffsetY(0) }}
                    style="flex:1;">重置全部</button>
                  <button class="provider-add-btn" disabled title="后续版本支持" style="margin-top:0;">
                    <span style="font-size:14px;">+</span> 加载模型
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
