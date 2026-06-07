import type { JSX } from 'solid-js'
import { createSignal, For, Show, createMemo, createEffect } from 'solid-js'
import { useAgent } from '@/shell/useAgent'
import { THEMES, getThemeById, applyTheme, applyWallpaper, applyCustomAccent, applyGlassTint, applyTopBarTint, accentRgb, accentHex } from '@/shell/theme'
import { ColorPicker } from '@/components/color-picker'
import { Settings, Palette, Wrench, FolderOpen, Info, Globe, Monitor, Image, ExternalLink, Plus, Trash2, ChevronRight, ChevronDown } from 'lucide-solid'

function kbd(fn: () => void) { return { tabIndex: 0, role: 'button' as const, onKeyDown: (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn() } } } }

/** 精选色板 — 暗色系 UI 适用的 accent 色 */
const ACCENT_SWATCHES = [
  '#6B8FA8', '#5B8C5A', '#C8963E', '#8B7FB8', '#7A8B94',
  '#E8553D', '#D4766B', '#6BA3BE', '#8FA86B', '#BE8FA3',
  '#A89060', '#6090A8', '#A86B8F', '#6BA88F', '#A86B6B',
]

/** 玻璃色调色板 */
const GLASS_SWATCHES = [
  { name: '纯黑', rgb: '0,0,0' },
  { name: '深蓝', rgb: '8,12,24' },
  { name: '深灰', rgb: '18,18,18' },
  { name: '深绿', rgb: '6,14,10' },
  { name: '深紫', rgb: '14,8,20' },
  { name: '暖黑', rgb: '16,10,6' },
]

/** hex → "R,G,B" */
function hexToRgb(hex: string): string {
  const h = hex.replace('#', '')
  return `${parseInt(h.substring(0, 2), 16)},${parseInt(h.substring(2, 4), 16)},${parseInt(h.substring(4, 6), 16)}`
}

/** "R,G,B" → hex */
function rgbToHex(rgb: string): string {
  const [r, g, b] = rgb.split(',').map(Number)
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')
}

/** 自定义色板组件 — 色块网格 + hex 输入框，风格与暗色玻璃 UI 统一 */
function AccentColorPicker(props: { value: string; onChange: (hex: string) => void }) {
  const [hexInput, setHexInput] = createSignal(props.value)

  createEffect(() => setHexInput(props.value))

  const handleHexSubmit = () => {
    let v = hexInput().trim()
    if (!v.startsWith('#')) v = '#' + v
    if (/^#[0-9a-fA-F]{6}$/.test(v)) props.onChange(v)
  }

  return (
    <div style={{ display: 'flex', 'flex-direction': 'column', gap: '10px' }}>
      {/* 色块网格 */}
      <div style={{ display: 'grid', 'grid-template-columns': 'repeat(5, 1fr)', gap: '8px' }}>
        <For each={ACCENT_SWATCHES}>
          {(swatch) => {
            const isActive = createMemo(() => props.value.toUpperCase() === swatch.toUpperCase())
            return (
              <div
                onClick={() => props.onChange(swatch)}
                {...kbd(() => props.onChange(swatch))}
                style={{
                  width: '100%', 'aspect-ratio': '1', 'border-radius': '6px',
                  background: swatch,
                  border: `1.5px solid ${isActive() ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.06)'}`,
                  'box-shadow': isActive() ? `0 0 0 2px ${swatch}40` : 'none',
                  cursor: 'pointer', transition: 'all 0.15s',
                  transform: isActive() ? 'scale(1.08)' : 'scale(1)',
                }}
              />
            )
          }}
        </For>
      </div>
      {/* hex 输入框 */}
      <div style={{ display: 'flex', 'align-items': 'center', gap: '8px' }}>
        <div style={{
          width: '24px', height: '24px', 'border-radius': '4px', 'flex-shrink': '0',
          background: props.value, border: '1px solid rgba(255,255,255,0.10)',
        }} />
        <input
          type="text"
          value={hexInput()}
          onInput={(e) => setHexInput(e.currentTarget.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleHexSubmit() }}
          onBlur={handleHexSubmit}
          maxLength={7}
          style={{
            width: '80px', padding: '5px 8px', 'font-size': '12px',
            'font-family': '"JetBrains Mono", monospace',
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
            'border-radius': '4px', color: 'var(--text-primary)',
            outline: 'none',
          }}
        />
        <span style={{ 'font-size': '11px', color: 'var(--text-muted)' }}>HEX</span>
      </div>
    </div>
  )
}

/** 玻璃色调色板 — 预设 + 自定义 hex */
function GlassTintPicker(props: { value: string; onChange: (rgb: string) => void }) {
  const hexInput = createMemo(() => rgbToHex(props.value))

  const handleHexSubmit = (hex: string) => {
    if (/^#[0-9a-fA-F]{6}$/.test(hex)) props.onChange(hexToRgb(hex))
  }

  return (
    <div style={{ display: 'flex', 'flex-direction': 'column', gap: '10px' }}>
      {/* 预设色块 */}
      <div style={{ display: 'flex', gap: '10px', 'flex-wrap': 'wrap' }}>
        <For each={GLASS_SWATCHES}>
          {(t) => {
            const isActive = createMemo(() => props.value === t.rgb)
            return (
              <div
                onClick={() => props.onChange(t.rgb)}
                {...kbd(() => props.onChange(t.rgb))}
                style={{
                  padding: '10px 14px', background: `rgba(${t.rgb},0.80)`,
                  border: `1.5px solid ${isActive() ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.06)'}`,
                  'box-shadow': isActive() ? '0 0 0 2px rgba(255,255,255,0.08)' : 'none',
                  'border-radius': '6px', cursor: 'pointer', transition: 'all 0.15s',
                  display: 'flex', 'flex-direction': 'column', 'align-items': 'center', gap: '6px',
                }}>
                <div style={{ width: '36px', height: '24px', 'border-radius': '4px', background: `rgba(${t.rgb},0.90)`, border: '1px solid rgba(255,255,255,0.06)' }} />
                <div style={{ 'font-size': '11px', color: isActive() ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{t.name}</div>
              </div>
            )
          }}
        </For>
      </div>
      {/* 自定义 hex */}
      <div style={{ display: 'flex', 'align-items': 'center', gap: '8px' }}>
        <div style={{
          width: '24px', height: '24px', 'border-radius': '4px', 'flex-shrink': '0',
          background: `rgba(${props.value},0.90)`, border: '1px solid rgba(255,255,255,0.10)',
        }} />
        <input
          type="text"
          value={hexInput()}
          onKeyDown={(e) => { if (e.key === 'Enter') handleHexSubmit(e.currentTarget.value) }}
          onBlur={(e) => handleHexSubmit(e.currentTarget.value)}
          maxLength={7}
          style={{
            width: '80px', padding: '5px 8px', 'font-size': '12px',
            'font-family': '"JetBrains Mono", monospace',
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
            'border-radius': '4px', color: 'var(--text-primary)',
            outline: 'none',
          }}
        />
        <span style={{ 'font-size': '11px', color: 'var(--text-muted)' }}>HEX</span>
      </div>
    </div>
  )
}

type SettingsPage = 'model' | 'display' | 'skills' | 'workdir' | 'system'

const NAV_ITEMS: { id: SettingsPage; icon: () => JSX.Element; label: string; desc: string }[] = [
  { id: 'model',   icon: () => <Settings size={14} />, label: '模型管理',   desc: 'API 密钥 · 模型选择 · 参数配置' },
  { id: 'display', icon: () => <Palette size={14} />,  label: '显示设置',   desc: '主题 · 壁纸 · 字体 · 布局' },
  { id: 'skills',  icon: () => <Wrench size={14} />,   label: '技能管理',   desc: 'MCP 接入 · 扩展管理' },
  { id: 'workdir', icon: () => <FolderOpen size={14} />, label: '工作目录', desc: '项目路径 · 文件索引' },
  { id: 'system',  icon: () => <Info size={14} />,     label: '系统信息',   desc: '版本 · 日志 · 关于澪号' },
]

// ── 复用小组件 ──

function ToggleSmall(props: { initialOn: boolean }) {
  const [on, setOn] = createSignal(props.initialOn)
  return (
    <div {...kbd(() => setOn(!on()))} onClick={() => setOn(!on())} style={{
      width: '32px', height: '18px', 'border-radius': '9px', cursor: 'pointer',
      background: on() ? `rgba(${accentRgb()},0.40)` : 'rgba(255,255,255,0.10)',
      border: 'none', position: 'relative', transition: 'background 0.2s',
    }}>
      <div style={{
        position: 'absolute', top: '2px', left: '2px', width: '14px', height: '14px',
        'border-radius': '50%', background: 'white', transition: 'transform 0.2s',
        transform: on() ? 'translateX(14px)' : 'translateX(0)',
      }} />
    </div>
  )
}

// Controlled toggle for model enable/disable — reads from model_configs
function ModelToggle(props: { enabled: boolean; onToggle: () => void }) {
  return (
    <div {...kbd(props.onToggle)} onClick={props.onToggle} style={{
      width: '32px', height: '18px', 'border-radius': '9px', cursor: 'pointer',
      background: props.enabled ? `rgba(${accentRgb()},0.40)` : 'rgba(255,255,255,0.10)',
      border: 'none', position: 'relative', transition: 'background 0.2s',
    }}>
      <div style={{
        position: 'absolute', top: '2px', left: '2px', width: '14px', height: '14px',
        'border-radius': '50%', background: 'white', transition: 'transform 0.2s',
        transform: props.enabled ? 'translateX(14px)' : 'translateX(0)',
      }} />
    </div>
  )
}

function SectionTitle(props: { children: string }) {
  return <div style={{ 'font-family': '"Noto Serif SC", serif', 'font-size': '14px', 'font-weight': '600', 'margin-bottom': '16px' }}>{props.children}</div>
}

function Btn(props: { children: JSX.Element; primary?: boolean; onClick?: () => void }) {
  return (
    <button onClick={props.onClick} style={{
      padding: '6px 14px', 'border-radius': '4px', cursor: 'pointer', 'font-family': 'inherit', 'font-size': '12px',
      background: props.primary ? `rgba(${accentRgb()},0.15)` : 'rgba(255,255,255,0.04)',
      border: props.primary ? `1px solid rgba(${accentRgb()},0.20)` : '1px solid rgba(255,255,255,0.06)',
      color: props.primary ? 'var(--accent)' : 'var(--text-secondary)',
    }}>{props.children}</button>
  )
}

// ── ModelPage: 厂商 & 模型管理 ──

// ── 受控开关（技能/MCP 用） ──
function SkillToggle(props: { enabled: boolean; onToggle: () => void }) {
  return (
    <div {...kbd(props.onToggle)} onClick={props.onToggle} style={{
      width: '32px', height: '18px', 'border-radius': '9px', cursor: 'pointer',
      background: props.enabled ? `rgba(${accentRgb()},0.40)` : 'rgba(255,255,255,0.10)',
      border: 'none', position: 'relative', transition: 'background 0.2s',
    }}>
      <div style={{
        position: 'absolute', top: '2px', left: '2px', width: '14px', height: '14px',
        'border-radius': '50%', background: 'white', transition: 'transform 0.2s',
        transform: props.enabled ? 'translateX(14px)' : 'translateX(0)',
      }} />
    </div>
  )
}

const excludeRules = [
  { name: '日志文件', pattern: '*.log' },
  { name: '依赖目录', pattern: 'node_modules' },
  { name: '构建输出', pattern: 'dist' },
  { name: '数据库文件', pattern: '*.db, *.sqlite' },
  { name: '环境变量', pattern: '.env' },
  { name: '临时文件', pattern: '*.tmp' },
  { name: '版本控制', pattern: '.git' },
]

const logs = [
  { time: '14:32:15', level: 'INFO' as const, msg: '会话 #52 已创建 · 模型 Claude Opus 4.6' },
  { time: '14:31:52', level: 'INFO' as const, msg: 'File_exec 完成 · App.tsx L42-58 · 1.2s' },
  { time: '14:31:28', level: 'WARN' as const, msg: 'shell_exec 超时 · npm run build · 30s' },
  { time: '14:31:05', level: 'INFO' as const, msg: '上下文压缩完成 · 释放 8,450 tokens' },
  { time: '14:30:40', level: 'INFO' as const, msg: 'MCP 服务重连成功 · 7 工具可用' },
  { time: '14:29:07', level: 'ERR'  as const, msg: '连接 v3.1.0 启动 · PID 8241 · 端口 9229' },
]

const links = [
  { icon: () => <ExternalLink size={16} />, name: 'GitHub',  url: 'github.com/layyck' },
  { icon: () => <Monitor size={16} />, name: 'Bilibili', url: 'space.bilibili.com/2529362295' },
]

// ── 子页面 ──

// ── 厂商 ID → 显示名 ──
const PROVIDER_NAMES: Record<string, string> = {
  deepseek: 'DeepSeek', anthropic: 'Anthropic', openai: 'OpenAI', google: 'Google Gemini',
  groq: 'Groq', xai: 'xAI', mistral: 'Mistral', openrouter: 'OpenRouter', cerebras: 'Cerebras',
  fireworks: 'Fireworks', together: 'Together AI', minimax: 'MiniMax', moonshotai: 'Moonshot AI',
  kimi: 'Kimi', zai: 'ZAI',
}

const THINKING_LEVELS = ['off', 'minimal', 'low', 'medium', 'high'] as const
const THINKING_DOTS: Record<string, number> = { off: 0, minimal: 1, low: 2, medium: 3, high: 4 }

interface ProviderConfig { id: string; name: string; apiUrl?: string; apiKey?: string; active?: boolean; models?: { id: string; name: string; contextWindow: number }[] }

function ModelPage() {
  const agent = useAgent()
  const [expandedProvider, setExpandedProvider] = createSignal<string | null>(null)
  const [showNewForm, setShowNewForm] = createSignal(false)
  const [newProviderId, setNewProviderId] = createSignal('')
  const [newApiKey, setNewApiKey] = createSignal('')
  const [newApiUrl, setNewApiUrl] = createSignal('')
  const [deleteConfirm, setDeleteConfirm] = createSignal<string | null>(null)

  const providers = createMemo<ProviderConfig[]>(() => {
    const entry = agent.settings().find(e => e.key === 'providers')
    if (!entry?.value) return []
    try {
      const raw = JSON.parse(entry.value)
      // discover writes [{id, name, models:[...]}], saveProvider writes [{id,name,apiKey,active}]
      // Normalize: ensure active defaults to true
      return raw.map((p: any) => ({ ...p, active: p.active !== false }))
    } catch { return [] }
  })

  const modelConfigs = createMemo<Record<string, { thinkingLevel?: string; compactThreshold?: number; enabled?: boolean; visible?: boolean }>>(() => {
    const entry = agent.settings().find(e => e.key === 'model_configs')
    if (!entry?.value) return {}
    try { return JSON.parse(entry.value) } catch { return {} }
  })

  // Models come from providers JSON (written by settings.discover via Pi).
  // DO NOT sort — stable order prevents <For> index-based DOM reuse bugs.
  const getProviderModels = (providerId: string) => {
    const p = providers().find(p => p.id === providerId)
    return (p?.models ?? []).filter(m => getModelConfig(m.id).visible !== false)
  }

  const availableProviderIds = createMemo(() => {
    const existing = new Set(providers().map(p => p.id))
    return Object.keys(PROVIDER_NAMES).filter(id => !existing.has(id))
  })

  const handleAddProvider = () => {
    if (!newProviderId()) return
    const name = PROVIDER_NAMES[newProviderId()] ?? newProviderId()
    agent.saveProvider(newProviderId(), name, {
      apiKey: newApiKey() || undefined,
      apiUrl: newApiUrl() || undefined,
    })
    setShowNewForm(false)
    setNewProviderId('')
    setNewApiKey('')
    setNewApiUrl('')
  }

  const handleDeleteProvider = (id: string) => {
    agent.deleteProvider(id)
    setDeleteConfirm(null)
    setExpandedProvider(null)
  }

  // ── 配置弹窗状态 ──
  const [configModalProviderId, setConfigModalProviderId] = createSignal<string | null>(null)

  const configModalProvider = () => providers().find(p => p.id === configModalProviderId())
  const visibleModelIds = () => new Set(getProviderModels(configModalProviderId() ?? '').map(m => m.id))
  const removableModels = () => getProviderModels(configModalProviderId() ?? '')
  // All models from providers JSON that are NOT currently visible
  const addableModels = () => {
    const p = configModalProvider()
    if (!p?.models) return []
    const visible = visibleModelIds()
    return p.models.filter(m => !visible.has(m.id))
  }

  const handleRemoveModel = (modelId: string) => {
    agent.configureModel(modelId, { visible: false })
  }

  const handleAddModel = (modelId: string) => {
    agent.configureModel(modelId, { visible: true })
  }

  const handleToggleModel = (modelId: string, currentEnabled: boolean) => {
    agent.configureModel(modelId, { enabled: !currentEnabled })
  }

  const handleThinkingChange = (modelId: string, currentLevel: string) => {
    const idx = THINKING_LEVELS.indexOf(currentLevel as any)
    const next = THINKING_LEVELS[(idx + 1) % THINKING_LEVELS.length]
    agent.configureModel(modelId, { thinkingLevel: next })
  }

  const getModelConfig = (modelId: string) => modelConfigs()[modelId] ?? {}
  const isModelEnabled = (modelId: string) => getModelConfig(modelId).enabled !== false

  return (
    <>
      {/* ── Provider Cards ── */}
      <div style={{ 'margin-bottom': '32px' }}>
        <div style={{ display: 'flex', 'align-items': 'center', 'justify-content': 'space-between', 'margin-bottom': '16px' }}>
          <SectionTitle>模型提供商</SectionTitle>
          <Show when={!showNewForm()}>
            <Btn primary onClick={() => setShowNewForm(true)}><Plus size={14} style="margin-right:4px" />新增提供商</Btn>
          </Show>
        </div>

        {/* New provider form */}
        <Show when={showNewForm()}>
          <div style={{ padding: '16px', background: 'var(--card-bg)', border: '1px solid rgba(255,255,255,0.06)', 'border-radius': '8px', 'margin-bottom': '16px', display: 'flex', 'flex-direction': 'column', gap: '12px' }}>
            <div style={{ 'font-size': '13px', 'font-weight': '600' }}>添加厂商</div>
            <div style={{ display: 'flex', gap: '12px', 'flex-wrap': 'wrap' }}>
              <select value={newProviderId()} onChange={(e) => setNewProviderId(e.currentTarget.value)}
                style={{ ...inputStyle, width: '180px' }}>
                <option value="">选择厂商...</option>
                <For each={availableProviderIds()}>{(id) =>
                  <option value={id}>{PROVIDER_NAMES[id] ?? id}</option>
                }</For>
              </select>
              <input placeholder="API Key" value={newApiKey()} onInput={(e) => setNewApiKey(e.currentTarget.value)}
                style={{ ...inputStyle, flex: '1', 'min-width': '200px' }} />
              <input placeholder="API URL (可选)" value={newApiUrl()} onInput={(e) => setNewApiUrl(e.currentTarget.value)}
                style={{ ...inputStyle, flex: '1', 'min-width': '200px' }} />
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <Btn primary onClick={handleAddProvider}>确认添加</Btn>
              <Btn onClick={() => setShowNewForm(false)}>取消</Btn>
            </div>
          </div>
        </Show>

        <div style={{ display: 'grid', 'grid-template-columns': 'repeat(4, 1fr)', gap: '12px' }}>
          <For each={providers()}>
            {(p) => {
              const modelCount = getProviderModels(p.id).length
              const isExpanded = expandedProvider() === p.id
              return (
                <div>
                  <div
                    onClick={() => setExpandedProvider(isExpanded ? null : p.id)}
                    style={{
                      padding: '14px', background: 'var(--card-bg)', border: isExpanded ? '1px solid var(--accent)' : '1px solid rgba(255,255,255,0.04)',
                      'border-radius': '6px', display: 'flex', 'align-items': 'center', gap: '10px',
                      cursor: 'pointer', transition: 'all 0.15s',
                    }}>
                    <div style={{
                      width: '7px', height: '7px', 'border-radius': '50%', 'flex-shrink': '0',
                      background: p.active ? 'var(--success)' : 'var(--text-muted)',
                      'box-shadow': p.active ? '0 0 4px rgba(91,140,90,0.3)' : 'none',
                    }} />
                    <div style={{ flex: '1' }}>
                      <div style={{ 'font-size': '13px', 'font-weight': '500' }}>{p.name}</div>
                      <div style={{ 'font-size': '10px', color: 'var(--text-muted)', 'margin-top': '1px' }}>
                        {modelCount} 个模型{p.active ? ' · 已连接' : ' · 未配置'}
                      </div>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); setConfigModalProviderId(p.id) }}
                      style={{ padding: '2px 8px', 'border-radius': '3px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: 'var(--text-muted)', 'font-size': '10px', cursor: 'pointer', 'font-family': 'inherit' }}>
                      配置
                    </button>
                    <span style={{ 'font-size': '10px', color: 'var(--text-muted)' }}>
                      {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </span>
                  </div>

                  {/* Expanded model list */}
                  <Show when={isExpanded}>
                    <div style={{ 'margin-top': '8px', padding: '12px', background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.04)', 'border-radius': '6px' }}>
                      <table style={{ width: '100%', 'border-collapse': 'collapse', 'font-size': '12px' }}>
                        <thead>
                          <tr>
                            <th style={thStyle}>模型</th>
                            <th style={{ ...thStyle, width: '100px' }}>思考强度</th>
                            <th style={{ ...thStyle, width: '60px' }}>启用</th>
                          </tr>
                        </thead>
                        <tbody>
                          <For each={getProviderModels(p.id)}>
                            {(model) => {
                              const cfg = getModelConfig(model.id)
                              const level = cfg.thinkingLevel ?? 'medium'
                              const dots = THINKING_DOTS[level] ?? 3
                              const enabled = isModelEnabled(model.id)
                              const supportsThinking = ['deepseek', 'anthropic'].includes(p.id)
                              return (
                                <tr style={{ opacity: enabled ? 1 : 0.4, transition: 'opacity 0.15s' }}>
                                  <td style={tdStyle}>
                                    <div style={{ 'font-weight': '500', color: 'var(--text-primary)' }}>{model.name}</div>
                                    <div style={{ 'font-size': '11px', color: 'var(--text-muted)' }}>{model.id}</div>
                                  </td>
                                  <td style={tdStyle}>
                                    {supportsThinking ? (
                                      <div onClick={() => handleThinkingChange(model.id, level)}
                                        style={{ display: 'flex', gap: '3px', cursor: 'pointer' }}
                                        title={`当前: ${level} — 点击切换`}>
                                        {[1,2,3,4].map((d) => (
                                          <div style={{ width: '5px', height: '5px', 'border-radius': '50%', background: d <= dots ? 'var(--accent)' : 'rgba(255,255,255,0.10)' }} />
                                        ))}
                                      </div>
                                    ) : (
                                      <span style={{ 'font-size': '10px', color: 'var(--text-muted)' }}>不支持</span>
                                    )}
                                  </td>
                                  <td style={tdStyle}>
                                    <ModelToggle enabled={enabled} onToggle={() => handleToggleModel(model.id, enabled)} />
                                  </td>
                                </tr>
                              )
                            }}
                          </For>
                        </tbody>
                      </table>

                      {/* Delete provider button */}
                      <div style={{ 'margin-top': '12px', 'border-top': '1px solid rgba(255,255,255,0.04)', 'padding-top': '10px' }}>
                        <Show when={deleteConfirm() === p.id}
                          fallback={
                            <button onClick={() => setDeleteConfirm(p.id)}
                              style={{ display: 'flex', 'align-items': 'center', gap: '4px', padding: '4px 10px', 'border-radius': '4px', background: 'transparent', border: '1px solid rgba(239,68,68,0.15)', color: 'var(--text-muted)', 'font-size': '11px', cursor: 'pointer', 'font-family': 'inherit' }}>
                              <Trash2 size={11} /> 删除厂商
                            </button>
                          }>
                          <div style={{ display: 'flex', 'align-items': 'center', gap: '8px', 'font-size': '11px' }}>
                            <span style={{ color: '#EF4444' }}>该厂商下的角色将切换到首个可用模型，确认删除？</span>
                            <button onClick={() => handleDeleteProvider(p.id)}
                              style={{ padding: '3px 8px', 'border-radius': '3px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.25)', color: '#EF4444', cursor: 'pointer', 'font-size': '11px', 'font-weight': '600' }}>确认</button>
                            <button onClick={() => setDeleteConfirm(null)}
                              style={{ padding: '3px 8px', 'border-radius': '3px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: 'var(--text-muted)', cursor: 'pointer', 'font-size': '11px' }}>取消</button>
                          </div>
                        </Show>
                      </div>
                    </div>
                  </Show>
                </div>
              )
            }}
          </For>
        </div>
      </div>

      {/* ── Global Model List ── */}
      <SectionTitle>全部模型</SectionTitle>
      <table style={{ width: '100%', 'border-collapse': 'collapse', 'font-size': '12px' }}>
        <thead>
          <tr>
            <th style={thStyle}>模型名称</th>
            <th style={thStyle}>厂商</th>
            <th style={{ ...thStyle, width: '100px' }}>思考强度</th>
            <th style={{ ...thStyle, width: '60px' }}>状态</th>
          </tr>
        </thead>
        <tbody>
          <For each={providers()}>
            {(p) => (
              <For each={getProviderModels(p.id)}>
                {(model) => {
                  const cfg = getModelConfig(model.id)
                  const level = cfg.thinkingLevel ?? 'medium'
                  const dots = THINKING_DOTS[level] ?? 3
                  const enabled = isModelEnabled(model.id)
                  const supportsThinking = ['deepseek', 'anthropic'].includes(p.id)
                  return (
                    <tr style={{ opacity: enabled ? 1 : 0.4, transition: 'opacity 0.15s', cursor: 'pointer' }}>
                      <td style={tdStyle}>
                        <div style={{ 'font-weight': '500', color: 'var(--text-primary)' }}>{model.name}</div>
                        <div style={{ 'font-size': '11px', color: 'var(--text-muted)' }}>{model.id}</div>
                      </td>
                      <td style={tdStyle}>{p.name}</td>
                      <td style={tdStyle}>
                        {supportsThinking ? (
                          <div onClick={() => handleThinkingChange(model.id, level)}
                            style={{ display: 'flex', gap: '3px', cursor: 'pointer' }}
                            title={`当前: ${level} — 点击切换`}>
                            {[1,2,3,4].map((d) => (
                              <div style={{ width: '5px', height: '5px', 'border-radius': '50%', background: d <= dots ? 'var(--accent)' : 'rgba(255,255,255,0.10)' }} />
                            ))}
                          </div>
                        ) : (
                          <span style={{ 'font-size': '10px', color: 'var(--text-muted)' }}>不支持</span>
                        )}
                      </td>
                      <td style={tdStyle}>
                        <ModelToggle enabled={enabled} onToggle={() => handleToggleModel(model.id, enabled)} />
                      </td>
                    </tr>
                  )
                }}
              </For>
            )
          }</For>
        </tbody>
      </table>

      {/* ── Config Modal ── */}
      <Show when={configModalProviderId()}>
        <div onClick={() => setConfigModalProviderId(null)}
          style={{ position: 'fixed', inset: '0', background: 'rgba(0,0,0,0.60)', 'z-index': '100', display: 'flex', 'align-items': 'center', 'justify-content': 'center' }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ width: '720px', 'max-height': '80vh', background: 'var(--bg-card)', border: '1px solid rgba(255,255,255,0.08)', 'border-radius': '10px', padding: '24px', display: 'flex', 'flex-direction': 'column', gap: '16px', overflow: 'hidden' }}>
            <div style={{ display: 'flex', 'align-items': 'center', 'justify-content': 'space-between' }}>
              <div style={{ 'font-family': '"Noto Serif SC", serif', 'font-size': '16px', 'font-weight': '600' }}>
                配置 {configModalProvider()?.name} 模型
              </div>
              <button onClick={() => setConfigModalProviderId(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', 'font-size': '18px' }}>✕</button>
            </div>
            <div style={{ display: 'grid', 'grid-template-columns': '1fr 1fr', gap: '16px', 'overflow-y': 'auto', flex: '1' }}>
              <div>
                <div style={{ 'font-size': '12px', 'font-weight': '600', 'margin-bottom': '8px', color: 'var(--text-secondary)' }}>
                  已加入 ({removableModels().length})
                </div>
                <div style={{ display: 'flex', 'flex-direction': 'column', gap: '4px' }}>
                  <Show when={removableModels().length > 0} fallback={
                    <div style={{ 'font-size': '11px', color: 'var(--text-muted)', padding: '8px' }}>无模型</div>
                  }>
                    <For each={removableModels()}>
                      {(m) => (
                        <div onClick={() => handleRemoveModel(m.id)}
                          style={{ display: 'flex', 'align-items': 'center', 'justify-content': 'space-between', padding: '8px 10px', 'border-radius': '4px', cursor: 'pointer', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.03)' }}>
                          <div>
                            <div style={{ 'font-size': '12px', color: 'var(--text-primary)' }}>{m.name}</div>
                            <div style={{ 'font-size': '10px', color: 'var(--text-muted)' }}>{m.id}</div>
                          </div>
                          <span style={{ 'font-size': '10px', color: '#EF4444' }}>移除</span>
                        </div>
                      )}
                    </For>
                  </Show>
                </div>
              </div>
              <div>
                <div style={{ 'font-size': '12px', 'font-weight': '600', 'margin-bottom': '8px', color: 'var(--text-secondary)' }}>
                  可添加 ({addableModels().length})
                </div>
                <div style={{ display: 'flex', 'flex-direction': 'column', gap: '4px' }}>
                  <Show when={addableModels().length > 0} fallback={
                    <div style={{ 'font-size': '11px', color: 'var(--text-muted)', padding: '8px' }}>全部已加入</div>
                  }>
                    <For each={addableModels()}>
                      {(m) => (
                        <div onClick={() => handleAddModel(m.id)}
                          style={{ display: 'flex', 'align-items': 'center', 'justify-content': 'space-between', padding: '8px 10px', 'border-radius': '4px', cursor: 'pointer', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.03)' }}>
                          <div>
                            <div style={{ 'font-size': '12px', color: 'var(--text-muted)' }}>{m.name}</div>
                            <div style={{ 'font-size': '10px', color: 'var(--text-muted)' }}>{m.id}</div>
                          </div>
                          <span style={{ 'font-size': '10px', color: 'var(--accent)' }}>加入</span>
                        </div>
                      )}
                    </For>
                  </Show>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Show>
    </>
  )
}

function DisplayPage() {
  const agent = useAgent()
  const titleStyle: Record<string, string> = { 'font-family': '"Noto Serif SC", serif', 'font-size': '15px', 'font-weight': '600', color: 'var(--text-primary)' }
  const cardStyle: Record<string, string> = { background: '#0E0E1640', border: '1px solid rgba(255,255,255,0.024)', 'border-radius': '6px' }

  // ── 当前主题 ID ──
  const currentThemeId = createMemo(() => {
    const entry = agent.settings().find(e => e.key === 'theme')
    return entry?.value ?? 'mio-blue'
  })

  const handleThemeClick = (themeId: string) => {
    const theme = getThemeById(themeId)
    applyTheme(theme)
    agent.setSetting('theme', themeId)
    agent.setSetting('custom-accent', '')
  }

  // ── 壁纸 ──
  const currentWallpaper = createMemo(() => {
    const entry = agent.settings().find(e => e.key === 'wallpaper')
    return entry?.value ?? '/wallpapers/default-bg.jpg'
  })

  const handleWallpaperBrowse = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = () => {
        const dataUrl = reader.result as string
        applyWallpaper(dataUrl)
        // 持久化：存 data URL 到 settings（小文件可行，大文件后续优化为文件写入）
        agent.setSetting('wallpaper', dataUrl)
      }
      reader.readAsDataURL(file)
    }
    input.click()
  }

  const handleWallpaperReset = () => {
    const defaultPath = '/wallpapers/default-bg.jpg'
    applyWallpaper(defaultPath)
    agent.setSetting('wallpaper', defaultPath)
  }

  return (
    <>
      <div style={{ ...titleStyle, 'margin-bottom': '16px' }}>主题颜色</div>
      <div style={{ display: 'grid', 'grid-template-columns': 'repeat(5, 1fr)', gap: '16px', 'margin-bottom': '20px' }}>
        <For each={THEMES}>
          {(t) => {
            const isActive = createMemo(() => currentThemeId() === t.id)
            return (
              <div
                onClick={() => handleThemeClick(t.id)}
                {...kbd(() => handleThemeClick(t.id))}
                style={{
                  padding: '20px', background: 'var(--card-bg)',
                  border: `1px solid ${isActive() ? 'var(--accent)' : 'rgba(255,255,255,0.04)'}`,
                  'border-radius': '8px', display: 'flex', 'flex-direction': 'column', 'align-items': 'center',
                  gap: '10px', cursor: 'pointer', transition: 'all 0.15s',
                }}>
                <div style={{ width: '48px', height: '48px', 'border-radius': '6px', background: t.color }} />
                <div style={{ 'font-size': '12px', color: isActive() ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{t.name}</div>
              </div>
            )
          }}
        </For>
      </div>

      {/* divider */}
      <div style={{ height: '0.5px', background: 'rgba(255,255,255,0.06)', opacity: '0.35', 'margin-bottom': '20px' }} />

      {/* ── 自定义颜色 ── */}
      <div style={{ ...titleStyle, 'margin-bottom': '12px' }}>自定义颜色</div>
      <div style={{ 'font-size': '12px', color: 'var(--text-muted)', 'margin-bottom': '12px' }}>选择任意颜色覆盖当前主题的强调色</div>
      <div style={{ display: 'flex', 'align-items': 'center', 'justify-content': 'space-between', padding: '14px 16px', ...cardStyle }}>
        <div style={{ display: 'flex', 'flex-direction': 'column', gap: '4px' }}>
          <div style={{ 'font-size': '13px', 'font-weight': '500' }}>强调色</div>
          <div style={{ 'font-size': '11px', color: 'var(--text-muted)' }}>
            {(() => {
              const custom = agent.settings().find(e => e.key === 'custom-accent')
              return custom?.value ? custom.value : '跟随主题'
            })()}
          </div>
        </div>
        <ColorPicker
          value={accentHex()}
          onChange={(hex) => { applyCustomAccent(hex); agent.setSetting('custom-accent', hex) }}
          onReset={() => { applyTheme(getThemeById(currentThemeId())); agent.setSetting('custom-accent', '') }}
          showReset={!!agent.settings().find(e => e.key === 'custom-accent')}
        />
      </div>

      {/* divider */}
      <div style={{ height: '0.5px', background: 'rgba(255,255,255,0.06)', opacity: '0.35', 'margin-bottom': '20px' }} />

      {/* ── 背景颜色（玻璃色调） ── */}
      <div style={{ ...titleStyle, 'margin-bottom': '12px' }}>背景颜色</div>
      <div style={{ 'font-size': '12px', color: 'var(--text-muted)', 'margin-bottom': '12px' }}>半透明玻璃面板的底色调</div>
      <div style={{ display: 'flex', gap: '12px', 'margin-bottom': '12px', 'flex-wrap': 'wrap' }}>
        <For each={[
          { name: '纯黑', rgb: '0,0,0' },
          { name: '深蓝', rgb: '8,12,24' },
          { name: '深灰', rgb: '18,18,18' },
          { name: '深绿', rgb: '6,14,10' },
          { name: '深紫', rgb: '14,8,20' },
          { name: '暖黑', rgb: '16,10,6' },
        ]}>
          {(t) => {
            const currentGlassTint = createMemo(() => {
              const entry = agent.settings().find(e => e.key === 'glass-tint')
              return entry?.value ?? '0,0,0'
            })
            const isActive = createMemo(() => currentGlassTint() === t.rgb)
            return (
              <div
                onClick={() => { applyGlassTint(t.rgb); agent.setSetting('glass-tint', t.rgb) }}
                {...kbd(() => { applyGlassTint(t.rgb); agent.setSetting('glass-tint', t.rgb) })}
                style={{
                  padding: '12px 16px', background: `rgba(${t.rgb},0.80)`,
                  border: `1px solid ${isActive() ? 'var(--accent)' : 'rgba(255,255,255,0.06)'}`,
                  'border-radius': '6px', cursor: 'pointer', transition: 'all 0.15s',
                  display: 'flex', 'flex-direction': 'column', 'align-items': 'center', gap: '6px',
                }}>
                <div style={{ width: '40px', height: '28px', 'border-radius': '4px', background: `rgba(${t.rgb},0.90)`, border: '1px solid rgba(255,255,255,0.08)' }} />
                <div style={{ 'font-size': '11px', color: isActive() ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{t.name}</div>
              </div>
            )
          }}
        </For>
      </div>
      <div style={{ display: 'flex', 'align-items': 'center', gap: '8px' }}>
        <span style={{ 'font-size': '12px', color: 'var(--text-muted)' }}>自定义</span>
        <ColorPicker
          value={(() => {
            const entry = agent.settings().find(e => e.key === 'glass-tint')
            const rgb = entry?.value ?? '0,0,0'
            const [r, g, b] = rgb.split(',').map(Number)
            return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')
          })()}
          onChange={(hex) => {
            const h = hex.replace('#', '')
            const rgb = `${parseInt(h.substring(0, 2), 16)},${parseInt(h.substring(2, 4), 16)},${parseInt(h.substring(4, 6), 16)}`
            applyGlassTint(rgb)
            agent.setSetting('glass-tint', rgb)
          }}
        />
      </div>

      {/* divider */}
      <div style={{ height: '0.5px', background: 'rgba(255,255,255,0.06)', opacity: '0.35', 'margin-bottom': '20px' }} />

      {/* ── 顶部标题栏颜色 ── */}
      <div style={{ ...titleStyle, 'margin-bottom': '12px' }}>顶部标题栏</div>
      <div style={{ 'font-size': '12px', color: 'var(--text-muted)', 'margin-bottom': '12px' }}>自定义顶部菜单栏的玻璃底色</div>
      <div style={{ display: 'flex', 'align-items': 'center', gap: '8px' }}>
        <For each={[
          { name: '纯黑', rgb: '0,0,0' },
          { name: '深蓝', rgb: '8,12,24' },
          { name: '深灰', rgb: '18,18,18' },
          { name: '深紫', rgb: '14,8,20' },
          { name: '暖黑', rgb: '16,10,6' },
        ]}>
          {(t) => {
            const currentTopBarTint = createMemo(() => {
              const entry = agent.settings().find(e => e.key === 'top-bar-tint')
              return entry?.value ?? '0,0,0'
            })
            const isActive = createMemo(() => currentTopBarTint() === t.rgb)
            return (
              <div
                onClick={() => { applyTopBarTint(t.rgb); agent.setSetting('top-bar-tint', t.rgb) }}
                {...kbd(() => { applyTopBarTint(t.rgb); agent.setSetting('top-bar-tint', t.rgb) })}
                style={{
                  padding: '10px 14px', background: `rgba(${t.rgb},0.80)`,
                  border: `1.5px solid ${isActive() ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.06)'}`,
                  'box-shadow': isActive() ? '0 0 0 2px rgba(255,255,255,0.08)' : 'none',
                  'border-radius': '6px', cursor: 'pointer', transition: 'all 0.15s',
                  display: 'flex', 'flex-direction': 'column', 'align-items': 'center', gap: '6px',
                }}>
                <div style={{ width: '36px', height: '24px', 'border-radius': '4px', background: `rgba(${t.rgb},0.90)`, border: '1px solid rgba(255,255,255,0.06)' }} />
                <div style={{ 'font-size': '11px', color: isActive() ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{t.name}</div>
              </div>
            )
          }}
        </For>
        <ColorPicker
          value={(() => {
            const entry = agent.settings().find(e => e.key === 'top-bar-tint')
            const rgb = entry?.value ?? '0,0,0'
            const [r, g, b] = rgb.split(',').map(Number)
            return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')
          })()}
          onChange={(hex) => {
            const h = hex.replace('#', '')
            const rgb = `${parseInt(h.substring(0, 2), 16)},${parseInt(h.substring(2, 4), 16)},${parseInt(h.substring(4, 6), 16)}`
            applyTopBarTint(rgb)
            agent.setSetting('top-bar-tint', rgb)
          }}
        />
      </div>

      {/* divider */}
      <div style={{ height: '0.5px', background: 'rgba(255,255,255,0.06)', opacity: '0.35', 'margin-bottom': '20px' }} />

      <div style={{ ...titleStyle, 'margin-bottom': '12px' }}>界面背景图</div>
      <div style={{ 'font-size': '12px', color: 'var(--text-muted)', 'margin-bottom': '12px' }}>选择一张图片作为全局背景</div>
      <div style={{
        display: 'flex', 'align-items': 'center', 'justify-content': 'space-between',
        padding: '14px 16px', ...cardStyle,
      }}>
        <div style={{ display: 'flex', 'flex-direction': 'column', gap: '4px' }}>
          <div style={{ 'font-size': '13px', 'font-weight': '500' }}>全局背景</div>
          <div style={{ 'font-size': '11px', color: 'var(--text-muted)' }}>
            {currentWallpaper().startsWith('data:') ? '自定义图片' : currentWallpaper()}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {/* 缩略图预览 */}
          <div style={{
            width: '64px', height: '40px', display: 'flex', 'align-items': 'center', 'justify-content': 'center',
            background: 'rgba(255,255,255,0.024)', border: '1px solid rgba(255,255,255,0.05)',
            'border-radius': '4px', overflow: 'hidden',
          }}>
            <Show when={currentWallpaper()} fallback={<Image size={16} />}>
              <img src={currentWallpaper()} style={{ width: '100%', height: '100%', 'object-fit': 'cover' }} />
            </Show>
          </div>
          {/* 浏览按钮 */}
          <div
            onClick={handleWallpaperBrowse}
            {...kbd(handleWallpaperBrowse)}
            style={{
              display: 'flex', 'align-items': 'center', padding: '7px 16px',
              background: 'transparent', border: '1px solid rgba(255,255,255,0.08)',
              'border-radius': '4px', cursor: 'pointer',
            }}>
            <span style={{ 'font-size': '11px', 'font-weight': '500', color: 'var(--text-secondary)' }}>浏览</span>
          </div>
          {/* 重置按钮 */}
          <Show when={currentWallpaper() !== '/wallpapers/default-bg.jpg'}>
            <div
              onClick={handleWallpaperReset}
              {...kbd(handleWallpaperReset)}
              style={{
                display: 'flex', 'align-items': 'center', padding: '7px 16px',
                background: 'transparent', border: '1px solid rgba(255,255,255,0.08)',
                'border-radius': '4px', cursor: 'pointer',
              }}>
              <span style={{ 'font-size': '11px', 'font-weight': '500', color: 'var(--text-muted)' }}>重置</span>
            </div>
          </Show>
        </div>
      </div>
    </>
  )
}

function SkillsPage() {
  const agent = useAgent()
  const [showInstall, setShowInstall] = createSignal(false)
  const [installTarget, setInstallTarget] = createSignal<'user' | 'project'>('project')
  const [zipPath, setZipPath] = createSignal('')

  const userSkills = createMemo(() => agent.skills().filter((s) => s.source === 'user'))
  const projectSkills = createMemo(() => agent.skills().filter((s) => s.source === 'project'))

  const handleFileSelect = (e: Event) => {
    const input = e.target as HTMLInputElement
    if (input.files && input.files[0]) {
      setZipPath((input.files[0] as any).path ?? input.files[0].name)
    }
  }

  const handleInstall = () => {
    if (!zipPath()) return
    agent.installSkill(zipPath(), installTarget())
    setShowInstall(false)
    setZipPath('')
  }

  return (
    <>
      {/* ── 技能 ── */}
      <div style={{ display: 'flex', 'align-items': 'center', 'justify-content': 'space-between', 'margin-bottom': '16px' }}>
        <SectionTitle>已安装技能</SectionTitle>
        <Btn onClick={() => setShowInstall(true)}>+ 安装技能</Btn>
      </div>

      <Show when={showInstall()}>
        <div style={{
          padding: '14px', background: 'var(--card-bg)', border: '1px solid rgba(255,255,255,0.06)',
          'border-radius': '6px', 'margin-bottom': '16px',
        }}>
          <div style={{ 'font-size': '12px', 'margin-bottom': '10px', color: 'var(--text-secondary)' }}>
            选择安装位置与技能包（.zip）
          </div>
          <div style={{ display: 'flex', 'align-items': 'center', gap: '10px', 'margin-bottom': '10px' }}>
            <select
              value={installTarget()}
              onChange={(e) => setInstallTarget(e.currentTarget.value as 'user' | 'project')}
              style={{
                padding: '5px 8px', 'font-size': '12px', background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)', 'border-radius': '4px', color: 'var(--text-primary)',
              }}
            >
              <option value="project">项目级（.pi/skills）</option>
              <option value="user">全局（~/.pi/agent/skills）</option>
            </select>
            <span style={{ 'font-size': '11px', color: 'var(--text-muted)' }}>
              {installTarget() === 'project' ? agent.skillDirs().project : agent.skillDirs().user}
            </span>
          </div>
          <div style={{ display: 'flex', 'align-items': 'center', gap: '10px' }}>
            <input
              type="file"
              accept=".zip"
              onChange={handleFileSelect}
              style={{ 'font-size': '12px', color: 'var(--text-secondary)' }}
            />
            <Btn primary onClick={handleInstall}>安装</Btn>
            <Btn onClick={() => setShowInstall(false)}>取消</Btn>
          </div>
        </div>
      </Show>

      {/* 全局技能 */}
      <div style={{ 'margin-bottom': '16px' }}>
        <div style={{ display: 'flex', 'align-items': 'center', gap: '8px', 'margin-bottom': '10px' }}>
          <Globe size={14} />
          <span style={{ 'font-size': '12px', 'font-weight': '500' }}>全局技能</span>
          <span style={{ 'font-size': '11px', color: 'var(--text-muted)', 'margin-left': 'auto' }}>所有项目可用</span>
        </div>
        <Show when={userSkills().length > 0}>
          <div style={{ display: 'flex', 'flex-direction': 'column', gap: '6px' }}>
            <For each={userSkills()}>
              {(skill) => (
                <div style={{
                  display: 'flex', 'align-items': 'center', 'justify-content': 'space-between',
                  padding: '10px 14px', background: 'var(--card-bg)',
                  border: '1px solid rgba(255,255,255,0.03)', 'border-radius': '4px',
                }}>
                  <div style={{ display: 'flex', 'flex-direction': 'column', gap: '2px' }}>
                    <div style={{ 'font-size': '12px' }}>{skill.name}</div>
                    <div style={{ 'font-size': '11px', color: 'var(--text-muted)' }}>{skill.description}</div>
                  </div>
                  <div style={{ display: 'flex', 'align-items': 'center', gap: '10px' }}>
                    <SkillToggle
                      enabled={skill.enabled}
                      onToggle={() => agent.toggleSkill(skill.name, 'user', !skill.enabled)}
                    />
                    <span
                      onClick={() => agent.removeSkill(skill.name, 'user', skill.dirName)}
                      style={{ color: 'var(--text-muted)', cursor: 'pointer', 'font-size': '11px' }}
                    >
                      删除
                    </span>
                  </div>
                </div>
              )}
            </For>
          </div>
        </Show>
        <Show when={userSkills().length === 0}>
          <div style={{ 'font-size': '12px', color: 'var(--text-muted)', padding: '12px 0' }}>
            暂无全局技能
          </div>
        </Show>
      </div>

      {/* 项目技能 */}
      <div style={{ 'margin-bottom': '16px' }}>
        <div style={{ display: 'flex', 'align-items': 'center', gap: '8px', 'margin-bottom': '10px' }}>
          <FolderOpen size={14} />
          <span style={{ 'font-size': '12px', 'font-weight': '500' }}>项目技能</span>
          <span style={{ 'font-size': '11px', color: 'var(--text-muted)', 'margin-left': 'auto' }}>仅当前项目可用</span>
        </div>
        <Show when={projectSkills().length > 0}>
          <div style={{ display: 'flex', 'flex-direction': 'column', gap: '6px' }}>
            <For each={projectSkills()}>
              {(skill) => (
                <div style={{
                  display: 'flex', 'align-items': 'center', 'justify-content': 'space-between',
                  padding: '10px 14px', background: 'var(--card-bg)',
                  border: '1px solid rgba(255,255,255,0.03)', 'border-radius': '4px',
                }}>
                  <div style={{ display: 'flex', 'flex-direction': 'column', gap: '2px' }}>
                    <div style={{ 'font-size': '12px' }}>{skill.name}</div>
                    <div style={{ 'font-size': '11px', color: 'var(--text-muted)' }}>{skill.description}</div>
                  </div>
                  <div style={{ display: 'flex', 'align-items': 'center', gap: '10px' }}>
                    <SkillToggle
                      enabled={skill.enabled}
                      onToggle={() => agent.toggleSkill(skill.name, 'project', !skill.enabled)}
                    />
                    <span
                      onClick={() => agent.removeSkill(skill.name, 'project', skill.dirName)}
                      style={{ color: 'var(--text-muted)', cursor: 'pointer', 'font-size': '11px' }}
                    >
                      删除
                    </span>
                  </div>
                </div>
              )}
            </For>
          </div>
        </Show>
        <Show when={projectSkills().length === 0}>
          <div style={{ 'font-size': '12px', color: 'var(--text-muted)', padding: '12px 0' }}>
            暂无项目技能
          </div>
        </Show>
      </div>

      {/* ── MCP ── */}
      <McpSection />
    </>
  )
}

function McpSection() {
  const agent = useAgent()
  const [showAdd, setShowAdd] = createSignal(false)
  const [jsonInput, setJsonInput] = createSignal('')
  const [expandedId, setExpandedId] = createSignal<string | null>(null)
  const [jsonError, setJsonError] = createSignal('')

  const EXAMPLE_JSON = `{
  "id": "filesystem",
  "name": "文件系统",
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/dir"],
  "tools": [
    {
      "name": "read_file",
      "description": "读取文件内容",
      "params": {
        "path": { "type": "string", "required": true, "description": "文件路径" }
      }
    }
  ],
  "enabled": true
}`

  const handleSave = () => {
    setJsonError('')
    try {
      const cfg = JSON.parse(jsonInput())
      if (!cfg.id || !cfg.name || !cfg.command || !Array.isArray(cfg.args) || !Array.isArray(cfg.tools)) {
        setJsonError('缺少必要字段：id, name, command, args, tools')
        return
      }
      agent.saveMcp(cfg as import('@bridge/protocol').MCPServerConfig)
      setShowAdd(false)
      setJsonInput('')
    } catch {
      setJsonError('JSON 格式错误')
    }
  }

  return (
    <>
      <div style={{ display: 'flex', 'align-items': 'center', 'justify-content': 'space-between', 'margin-bottom': '16px', 'margin-top': '24px' }}>
        <SectionTitle>MCP 工具管理</SectionTitle>
        <Btn primary onClick={() => { setShowAdd(true); setJsonInput(EXAMPLE_JSON) }}>+ 添加 MCP</Btn>
      </div>

      <Show when={showAdd()}>
        <div style={{
          padding: '14px', background: 'var(--card-bg)', border: '1px solid rgba(255,255,255,0.06)',
          'border-radius': '6px', 'margin-bottom': '16px',
        }}>
          <div style={{ 'font-size': '12px', 'margin-bottom': '8px', color: 'var(--text-secondary)' }}>
            输入 MCP Server JSON 配置（参考示例）
          </div>
          <textarea
            value={jsonInput()}
            onInput={(e) => setJsonInput(e.currentTarget.value)}
            style={{
              width: '100%', height: '180px', padding: '10px', 'font-size': '12px',
              'font-family': '"JetBrains Mono", monospace', background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)', 'border-radius': '4px', color: 'var(--text-primary)',
              resize: 'vertical', 'box-sizing': 'border-box' as const,
            }}
          />
          <Show when={jsonError()}>
            <div style={{ 'font-size': '11px', color: 'var(--error)', 'margin-top': '6px' }}>{jsonError()}</div>
          </Show>
          <div style={{ display: 'flex', 'align-items': 'center', gap: '10px', 'margin-top': '10px' }}>
            <Btn primary onClick={handleSave}>保存</Btn>
            <Btn onClick={() => { setShowAdd(false); setJsonError('') }}>取消</Btn>
          </div>
        </div>
      </Show>

      <Show when={agent.mcpServers().length === 0 && !showAdd()}>
        <div style={{ 'font-size': '12px', color: 'var(--text-muted)', padding: '20px', 'text-align': 'center' }}>
          暂无 MCP 配置，点击右上角添加
        </div>
      </Show>

      <div style={{ display: 'flex', 'flex-direction': 'column', gap: '6px' }}>
        <For each={agent.mcpServers()}>
          {(server) => {
            const isExpanded = createMemo(() => expandedId() === server.id)
            return (
              <div style={{
                padding: '10px 14px', background: 'var(--card-bg)',
                border: '1px solid rgba(255,255,255,0.03)', 'border-radius': '4px',
              }}>
                <div style={{
                  display: 'flex', 'align-items': 'center', 'justify-content': 'space-between',
                }}>
                  <div style={{ display: 'flex', 'align-items': 'center', gap: '10px', cursor: 'pointer' }}
                    onClick={() => setExpandedId(isExpanded() ? null : server.id)}
                  >
                    <span style={{ color: 'var(--text-muted)', 'font-size': '11px' }}>
                      {isExpanded() ? '▼' : '▶'}
                    </span>
                    <div>
                      <div style={{ 'font-size': '12px' }}>{server.name}</div>
                      <div style={{ 'font-size': '11px', color: 'var(--text-muted)' }}>
                        {server.command} {server.args.join(' ')}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', 'align-items': 'center', gap: '10px' }}>
                    <SkillToggle
                      enabled={server.enabled}
                      onToggle={() => agent.toggleMcp(server.id, !server.enabled)}
                    />
                    <span
                      onClick={() => agent.removeMcp(server.id)}
                      style={{ color: 'var(--text-muted)', cursor: 'pointer', 'font-size': '11px' }}
                    >
                      删除
                    </span>
                  </div>
                </div>
                <Show when={isExpanded()}>
                  <div style={{
                    'margin-top': '10px', 'padding-top': '10px',
                    'border-top': '1px solid rgba(255,255,255,0.04)',
                  }}>
                    <div style={{ 'font-size': '11px', color: 'var(--text-muted)', 'margin-bottom': '6px' }}>
                      工具列表（{server.tools.length} 个）
                    </div>
                    <div style={{ display: 'flex', 'flex-direction': 'column', gap: '4px' }}>
                      <For each={server.tools}>
                        {(tool) => (
                          <div style={{
                            padding: '6px 10px', background: 'rgba(255,255,255,0.02)',
                            'border-radius': '3px',
                          }}>
                            <div style={{ 'font-size': '12px', 'font-weight': '500' }}>{tool.name}</div>
                            <div style={{ 'font-size': '11px', color: 'var(--text-muted)' }}>{tool.description}</div>
                            <Show when={Object.keys(tool.params).length > 0}>
                              <div style={{ 'font-size': '10px', color: 'var(--text-muted)', 'margin-top': '4px', 'font-family': '"JetBrains Mono", monospace' }}>
                                参数: {Object.entries(tool.params).map(([k, v]) => `${k}(${v.type}${v.required ? '' : '?'})`).join(', ')}
                              </div>
                            </Show>
                          </div>
                        )}
                      </For>
                    </div>
                  </div>
                </Show>
              </div>
            )
          }}
        </For>
      </div>
    </>
  )
}

function WorkdirPage() {
  const agent = useAgent()
  const [editPath, setEditPath] = createSignal('')
  const [isEditing, setIsEditing] = createSignal(false)
  const [newRule, setNewRule] = createSignal('')

  const handleStartEdit = () => {
    setEditPath(agent.workdir())
    setIsEditing(true)
  }

  const handleSaveWorkdir = () => {
    if (editPath().trim()) {
      agent.setWorkdir(editPath().trim())
    }
    setIsEditing(false)
  }

  const handleAddRule = () => {
    const p = newRule().trim()
    if (p) {
      agent.addExcludeRule(p)
      setNewRule('')
    }
  }

  return (
    <>
      <SectionTitle>工作目录</SectionTitle>
      <div style={{
        display: 'flex', 'align-items': 'center', gap: '12px', padding: '12px 16px',
        background: 'var(--card-bg)', border: '1px solid rgba(255,255,255,0.04)',
        'border-radius': '6px', 'margin-bottom': '8px',
      }}>
        <span style={{ 'font-size': '12px', color: 'var(--text-muted)', 'min-width': '80px' }}>项目根目录</span>
        <Show when={!isEditing()}>
          <input readOnly value={agent.workdir()} style={inputStyle} />
          <Btn onClick={handleStartEdit}>更改目录</Btn>
        </Show>
        <Show when={isEditing()}>
          <input
            value={editPath()}
            onInput={(e) => setEditPath(e.currentTarget.value)}
            placeholder="输入绝对路径，如 D:\\project"
            style={inputStyle}
          />
          <Btn primary onClick={handleSaveWorkdir}>保存</Btn>
          <Btn onClick={() => setIsEditing(false)}>取消</Btn>
        </Show>
      </div>
      <div style={{ 'font-size': '11px', color: 'var(--text-muted)', 'margin-left': '8px', 'margin-bottom': '32px' }}>
        已忽略文件将在文件浏览器中隐藏
      </div>

      <div style={{ display: 'flex', 'align-items': 'center', 'justify-content': 'space-between', 'margin-bottom': '12px' }}>
        <SectionTitle>文件排除规则</SectionTitle>
      </div>
      <div style={{
        display: 'flex', 'align-items': 'center', gap: '12px', padding: '12px 16px',
        background: 'var(--card-bg)', border: '1px solid rgba(255,255,255,0.04)',
        'border-radius': '6px', 'margin-bottom': '16px',
      }}>
        <input
          value={newRule()}
          onInput={(e) => setNewRule(e.currentTarget.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleAddRule() }}
          placeholder="输入排除规则，如 *.log 或 node_modules"
          style={inputStyle}
        />
        <Btn primary onClick={handleAddRule}>添加规则</Btn>
      </div>
      <div style={{ display: 'flex', gap: '8px', 'margin-bottom': '16px', 'flex-wrap': 'wrap' }}>
        <For each={agent.excludeRules()}>
          {(tag) => (
            <span style={{
              padding: '4px 10px', 'border-radius': '4px', 'font-size': '11px',
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
              color: 'var(--text-secondary)', 'font-family': '"JetBrains Mono", monospace',
            }}>{tag}</span>
          )}
        </For>
      </div>
      <Show when={agent.excludeRules().length > 0}>
        <table style={{ width: '100%', 'border-collapse': 'collapse', 'font-size': '12px', 'margin-top': '12px' }}>
          <thead>
            <tr>
              <th style={thStyle}>匹配规则</th>
              <th style={thStyle}>操作</th>
            </tr>
          </thead>
          <tbody>
            <For each={agent.excludeRules()}>
              {(rule) => (
                <tr>
                  <td style={{ ...tdStyle, 'font-family': '"JetBrains Mono", monospace' }}>{rule}</td>
                  <td style={tdStyle}>
                    <span
                      onClick={() => agent.removeExcludeRule(rule)}
                      style={{ color: 'var(--text-muted)', cursor: 'pointer' }}
                    >
                      移除
                    </span>
                  </td>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </Show>
      <Show when={agent.excludeRules().length === 0}>
        <div style={{ 'font-size': '12px', color: 'var(--text-muted)', padding: '12px 0' }}>
          暂无排除规则
        </div>
      </Show>
    </>
  )
}

function SystemPage() {
  return (
    <>
      <div style={{
        display: 'flex', 'align-items': 'center', gap: '20px', padding: '20px',
        background: 'var(--card-bg)', border: '1px solid rgba(255,255,255,0.04)',
        'border-radius': '8px', 'margin-bottom': '24px',
      }}>
        <div style={{
          width: '56px', height: '56px', 'border-radius': '8px',
          background: `rgba(${accentRgb()},0.15)`, border: `1px solid rgba(${accentRgb()},0.20)`,
          display: 'flex', 'align-items': 'center', 'justify-content': 'center', 'font-size': '24px', 'flex-shrink': '0',
        }}>澪</div>
        <div style={{ flex: '1' }}>
          <div style={{ 'font-family': '"Noto Serif SC", serif', 'font-size': '18px', 'font-weight': '600', 'margin-bottom': '4px' }}>澪号 · MIO Terminal</div>
          <div style={{ 'font-family': '"JetBrains Mono", monospace', 'font-size': '11px', color: 'var(--text-muted)' }}>v3.1.0 · PRTS Build 2026.06.07</div>
        </div>
        <div style={{ display: 'flex', 'flex-direction': 'column', 'align-items': 'flex-end', gap: '4px' }}>
          <div style={{ 'font-size': '11px', color: 'var(--text-muted)' }}>前端框架: SolidJS + Tailwind</div>
          <div style={{ 'font-size': '11px', color: 'var(--text-muted)' }}>后端桥接: Node.js + Pi SDK</div>
          <div style={{ 'font-size': '11px', color: 'var(--text-muted)' }}>AI 引擎: DeepSeek V4 · Claude · GPT-4o</div>
          <div style={{ 'font-size': '11px', color: 'var(--text-muted)' }}>数据库: SQLite · ~/.personal-agent/</div>
        </div>
      </div>

      <SectionTitle>最近运行日志</SectionTitle>
      <div style={{
        background: 'var(--card-bg)', border: '1px solid rgba(255,255,255,0.04)',
        'border-radius': '6px', padding: '12px 16px', 'margin-bottom': '24px',
      }}>
        <For each={logs}>
          {(log) => (
            <div style={{ display: 'flex', 'align-items': 'center', gap: '12px', padding: '6px 0', 'font-size': '12px' }}>
              <span style={{ 'font-family': '"JetBrains Mono", monospace', 'font-size': '10px', color: 'var(--text-muted)', width: '60px', 'flex-shrink': '0' }}>{log.time}</span>
              <span style={{ 'font-size': '10px', 'font-weight': '600', width: '40px', 'flex-shrink': '0', color: log.level === 'INFO' ? 'var(--accent)' : log.level === 'WARN' ? 'var(--warning)' : '#E8553D' }}>{log.level}</span>
              <span style={{ color: 'var(--text-secondary)', flex: '1' }}>{log.msg}</span>
            </div>
          )}
        </For>
      </div>

      <div style={{ display: 'flex', gap: '24px' }}>
        <div style={{ flex: '1' }}>
          <SectionTitle>关于澪号</SectionTitle>
          <div style={{ 'font-size': '12px', 'line-height': '1.7', color: 'var(--text-secondary)' }}>
            澪号是一个面向开发者的个人 AI 助手终端。融合了玻璃拟态视觉设计与多模型 AI 调度能力，通过统一的 WebSocket 桥接层，将 Pi SDK 的能力以插件化方式扩展到前端。
          </div>
        </div>
        <div style={{ flex: '1' }}>
          <SectionTitle>开发者链接</SectionTitle>
          <div style={{ display: 'flex', 'flex-direction': 'column', gap: '10px' }}>
            <For each={links}>
              {(link) => (
                <div style={{
                  display: 'flex', 'align-items': 'center', 'justify-content': 'space-between',
                  padding: '10px 14px', background: 'var(--card-bg)',
                  border: '1px solid rgba(255,255,255,0.04)', 'border-radius': '6px',
                }}>
                  <div style={{ display: 'flex', 'align-items': 'center', gap: '10px' }}>
                    <span style={{ display: 'flex', 'align-items': 'center' }}>{link.icon()}</span>
                    <div>
                      <div style={{ 'font-size': '13px', 'font-weight': '500' }}>{link.name}</div>
                      <div style={{ 'font-size': '10px', color: 'var(--text-muted)', 'font-family': '"JetBrains Mono", monospace' }}>{link.url}</div>
                    </div>
                  </div>
                  <span style={{ 'font-size': '11px', color: 'var(--text-muted)', cursor: 'pointer' }}>打开 →</span>
                </div>
              )}
            </For>
          </div>
        </div>
      </div>
    </>
  )
}

// ── 共享样式 ──

const thStyle: Record<string, string> = {
  'text-align': 'left', padding: '10px 12px', 'font-size': '10px', color: 'var(--text-muted)',
  'text-transform': 'uppercase', 'letter-spacing': '1px', 'border-bottom': '1px solid rgba(255,255,255,0.06)',
  'font-weight': '500',
}

const tdStyle: Record<string, string> = {
  padding: '12px', 'border-bottom': '1px solid rgba(255,255,255,0.03)',
  'vertical-align': 'middle', color: 'var(--text-secondary)',
}

const inputStyle: Record<string, string> = {
  flex: '1', background: 'rgba(0,0,0,0.40)', border: '1px solid rgba(255,255,255,0.06)',
  'border-radius': '4px', padding: '8px 12px', color: 'var(--text-primary)', 'font-size': '13px',
  'font-family': '"JetBrains Mono", monospace', outline: 'none',
}

// ── 主组件 ──

export default function SettingsLayoutView() {
  const [page, setPage] = createSignal<SettingsPage>('model')

  return (
    <div class="glass-panel-full" style={{ display: 'flex' }}>
      <div class="bracket-tr"><div class="bracket-h" /><div class="bracket-v" /></div>

      {/* 左侧导航 */}
      <div style={{
        width: '260px', 'flex-shrink': '0', display: 'flex', 'flex-direction': 'column',
        'border-right': '1px solid rgba(255,255,255,0.06)',
      }}>
        <div style={{
          display: 'flex', 'align-items': 'center', padding: '12px 16px', height: '54px',
          'font-family': '"Noto Serif SC", serif',
          'font-size': '15px', 'font-weight': '600',
          background: 'rgb(var(--top-bar-tint-rgb))',
          'border-bottom': '1px solid rgba(255,255,255,0.03)', 'flex-shrink': '0',
        }}>設定</div>
        <div style={{ flex: '1', 'overflow-y': 'auto', padding: '8px 0' }}>
          <For each={NAV_ITEMS}>
            {(item) => (
              <div {...kbd(() => setPage(item.id))} onClick={() => setPage(item.id)} style={{
                display: 'flex', 'align-items': 'center', gap: '10px', padding: '10px 16px',
                cursor: 'pointer', transition: 'all 0.15s',
                'border-left': page() === item.id ? '2px solid var(--accent)' : '2px solid transparent',
                background: page() === item.id ? `rgba(${accentRgb()},0.06)` : 'transparent',
              }}>
                <span style={{ 'font-size': '14px', width: '20px', 'text-align': 'center', display: 'flex', 'align-items': 'center', 'justify-content': 'center' }}>{item.icon()}</span>
                <div style={{ display: 'flex', 'flex-direction': 'column', gap: '1px' }}>
                  <div style={{ 'font-size': '13px' }}>{item.label}</div>
                  <div style={{ 'font-size': '10px', color: 'var(--text-muted)' }}>{item.desc}</div>
                </div>
              </div>
            )}
          </For>
        </div>
      </div>

      {/* 右侧内容 */}
      <div style={{ flex: '1', display: 'flex', 'flex-direction': 'column', 'min-width': '0' }}>
        <div style={{
          display: 'flex', 'align-items': 'center', 'justify-content': 'space-between',
          padding: '12px 16px', height: '54px',
          background: 'rgb(var(--top-bar-tint-rgb))',
          'border-bottom': '1px solid rgba(255,255,255,0.03)', 'flex-shrink': '0',
        }}>
          <div style={{ 'font-family': '"Noto Serif SC", serif', 'font-size': '16px', 'font-weight': '600' }}>
            {NAV_ITEMS.find((n) => n.id === page())?.label ?? '设置'}
          </div>
          <div style={{ 'font-size': '11px', color: 'var(--text-muted)' }}>
            設定 &gt; {NAV_ITEMS.find((n) => n.id === page())?.label ?? ''}
          </div>
        </div>
        <div style={{ flex: '1', 'overflow-y': 'auto', padding: '20px 24px' }}>
          <Show when={page() === 'model'}><ModelPage /></Show>
          <Show when={page() === 'display'}><DisplayPage /></Show>
          <Show when={page() === 'skills'}><SkillsPage /></Show>
          <Show when={page() === 'workdir'}><WorkdirPage /></Show>
          <Show when={page() === 'system'}><SystemPage /></Show>
        </div>
      </div>
    </div>
  )
}
