import { createEffect, For, createSignal, onCleanup, Show } from 'solid-js'
import { useAgent } from '@/shell/useAgent'
import { isSettingsOpen, setIsSettingsOpen } from '@/shell/settings-signal'
import { Toggle } from '@/components/toggle'
import { GlassInput } from '@/components/glass-input'
import {
  Settings, Bot, Puzzle, Palette, FolderOpen, Cpu, List, Sliders,
  PackageOpen, Download, Box, Star, Plus, X, ArrowLeft, Check, Trash2,
} from 'lucide-solid'
import './settings-page.css'
import type { ServerMessage, SkillSummary } from '@bridge/protocol'

type SettingsTab = 'agent' | 'appearance' | 'workspace' | 'skills'

function getSetting(entries: { key: string; value: string }[], key: string): string {
  return entries.find((e) => e.key === key)?.value ?? ''
}

function formatCw(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '--'
  return n >= 1000 ? `${(n / 1000).toFixed(0)}k` : String(n)
}

/** 默认文件后缀过滤列表 */
const DEFAULT_FILTERS = [
  { ext: 'js', enabled: true }, { ext: 'ts', enabled: true },
  { ext: 'jsx', enabled: true }, { ext: 'tsx', enabled: true },
  { ext: 'json', enabled: true }, { ext: 'md', enabled: true },
  { ext: 'css', enabled: true }, { ext: 'html', enabled: true },
  { ext: 'py', enabled: true }, { ext: 'go', enabled: true },
  { ext: 'rs', enabled: true }, { ext: 'java', enabled: true },
]

interface FilterEntry { ext: string; enabled: boolean }

function parseFilters(raw: string): FilterEntry[] {
  try {
    const arr = JSON.parse(raw)
    if (Array.isArray(arr)) return arr
  } catch { /* use defaults */ }
  return [...DEFAULT_FILTERS]
}

export function SettingsPage() {
  const agent = useAgent()

  const [expandedModelId, setExpandedModelId] = createSignal<string | null>(null)
  const [settingsTab, setSettingsTab] = createSignal<SettingsTab>('agent')

  // 技能
  const [skills, setSkills] = createSignal<SkillSummary[]>([])
  const [userSkillDir, setUserSkillDir] = createSignal('~/.pi/agent/skills/')
  const [projectSkillDir, setProjectSkillDir] = createSignal('.pi/skills/')
  const [installPath, setInstallPath] = createSignal('')
  const [installTarget, setInstallTarget] = createSignal<'user' | 'project'>('user')
  const [installStatus, setInstallStatus] = createSignal<'idle' | 'installing' | 'ok' | 'error'>('idle')
  const [installMsg, setInstallMsg] = createSignal('')
  let installTimer: ReturnType<typeof setTimeout> | undefined

  // 文件过滤器
  const [newFilterExt, setNewFilterExt] = createSignal('')

  // 打开时拉取设置
  createEffect(() => {
    if (isSettingsOpen()) {
      agent.getSettings()
      agent.send('settings.discover-models', {})
      agent.send('skills.list', {})
    }
  })

  // ESC 关闭
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') setIsSettingsOpen(false)
  }
  createEffect(() => {
    if (isSettingsOpen()) {
      window.addEventListener('keydown', handleKeyDown)
      onCleanup(() => window.removeEventListener('keydown', handleKeyDown))
    }
  })

  // 订阅技能
  createEffect(() => {
    if (isSettingsOpen()) {
      const handler = (msg: ServerMessage) => {
        if (msg.type === 'skills.state') {
          setSkills(msg.payload.skills)
          setUserSkillDir(msg.payload.userSkillDir)
          setProjectSkillDir(msg.payload.projectSkillDir)
        }
      }
      const unsub = agent.subscribe('skills.state', handler)
      onCleanup(unsub)
    }
  })
  createEffect(() => {
    if (isSettingsOpen()) {
      const handler = (msg: ServerMessage) => {
        if (msg.type === 'skills.installed') {
          setInstallStatus('ok')
          setInstallMsg(`技能 "${msg.payload.name}" 安装成功`)
          if (installTimer) clearTimeout(installTimer)
          installTimer = setTimeout(() => setInstallStatus('idle'), 3000)
        }
      }
      const unsub = agent.subscribe('skills.installed', handler)
      onCleanup(() => { unsub(); if (installTimer) clearTimeout(installTimer) })
    }
  })
  createEffect(() => {
    if (isSettingsOpen()) {
      const handler = (msg: ServerMessage) => {
        if (msg.type === 'error' && installStatus() === 'installing') {
          setInstallStatus('error')
          setInstallMsg(msg.payload.message || '安装失败')
          setTimeout(() => setInstallStatus('idle'), 5000)
        }
      }
      const unsub = agent.subscribe('error', handler)
      onCleanup(unsub)
    }
  })

  // ── 派生 ──
  const entries = () => agent.settings()
  const defaultModel = () => getSetting(entries(), 'default_model') || 'deepseek-chat'
  const thinkingLevel = () => getSetting(entries(), 'thinking_level') || 'medium'
  const compactThreshold = () => getSetting(entries(), 'compact_threshold') || '80'
  const historyRetention = () => getSetting(entries(), 'history_retention') || '100'

  const [modelSearch, setModelSearch] = createSignal('')
  const [workDirSaved, setWorkDirSaved] = createSignal(false)

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
    if (q) return models.filter((m) => m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q) || m.provider.toLowerCase().includes(q))
    return models
  }

  const modelCount = () => modelList().length
  const enabledSkillCount = () => skills().filter((s) => s.enabled).length

  // 文件过滤
  const [filterSearch, setFilterSearch] = createSignal('')
  const fileFilters = () => parseFilters(getSetting(entries(), 'file_filters'))
  const setFilters = (list: FilterEntry[]) => agent.setSetting('file_filters', JSON.stringify(list))

  const sortedFilters = () => {
    const all = fileFilters()
    const q = filterSearch().toLowerCase()
    const filtered = q ? all.filter((f) => f.ext.includes(q)) : all
    return [...filtered].sort((a, b) => Number(b.enabled) - Number(a.enabled))
  }

  // 模型排序：已启用置顶
  const sortedModels = () => {
    return [...modelList()].sort((a, b) => Number(b.enabled) - Number(a.enabled))
  }

  const toggleFilter = (ext: string) => {
    const next = fileFilters().map((f) => f.ext === ext ? { ...f, enabled: !f.enabled } : f)
    setFilters(next)
  }
  const addFilter = () => {
    const ext = newFilterExt().trim().replace(/^\./, '').toLowerCase()
    if (!ext) return
    if (fileFilters().some((f) => f.ext === ext)) return
    setFilters([...fileFilters(), { ext, enabled: true }])
    setNewFilterExt('')
  }
  const removeFilter = (ext: string) => {
    setFilters(fileFilters().filter((f) => f.ext !== ext))
  }

  // 预设配置
  const applyPreset = (name: string) => {
    const presets: Record<string, FilterEntry[]> = {
      'web': [
        { ext: 'js', enabled: true }, { ext: 'ts', enabled: true }, { ext: 'jsx', enabled: true }, { ext: 'tsx', enabled: true },
        { ext: 'json', enabled: true }, { ext: 'css', enabled: true }, { ext: 'html', enabled: true }, { ext: 'md', enabled: true },
        { ext: 'vue', enabled: true }, { ext: 'svelte', enabled: true },
      ],
      'python': [
        { ext: 'py', enabled: true }, { ext: 'ipynb', enabled: true }, { ext: 'json', enabled: true }, { ext: 'md', enabled: true },
        { ext: 'toml', enabled: true }, { ext: 'yaml', enabled: true }, { ext: 'cfg', enabled: true }, { ext: 'txt', enabled: true },
      ],
      'godot': [
        { ext: 'gd', enabled: true }, { ext: 'tscn', enabled: true }, { ext: 'tres', enabled: true },
        { ext: 'gdshader', enabled: true }, { ext: 'import', enabled: true }, { ext: 'json', enabled: true },
      ],
      'all': [...DEFAULT_FILTERS],
    }
    setFilters(presets[name] ?? [...DEFAULT_FILTERS])
  }

  return (
    <div class="settings-page" classList={{ open: isSettingsOpen() }}>
      <div class="settings-page-header">
        <button class="settings-back-btn" onClick={() => setIsSettingsOpen(false)} title="返回">
          <ArrowLeft size={18} />
        </button>
        <Settings size={20} class="settings-header-icon" />
        <span class="settings-page-title">设置</span>
        <span class="settings-page-subtitle">配置智能体行为和模型接入</span>
      </div>
      <div class="settings-page-body">
        <div class="settings-nav">
          <div class="settings-nav-item" classList={{ active: settingsTab() === 'agent' }} onClick={() => setSettingsTab('agent')}>
            <Bot size={16} class="nav-icon-svg" /> 智能体
          </div>
          <div class="settings-nav-item" classList={{ active: settingsTab() === 'appearance' }} onClick={() => setSettingsTab('appearance')}>
            <Palette size={16} class="nav-icon-svg" /> 主界面
          </div>
          <div class="settings-nav-item" classList={{ active: settingsTab() === 'workspace' }} onClick={() => setSettingsTab('workspace')}>
            <FolderOpen size={16} class="nav-icon-svg" /> 工作目录
          </div>
          <div class="settings-nav-item" classList={{ active: settingsTab() === 'skills' }} onClick={() => setSettingsTab('skills')}>
            <Puzzle size={16} class="nav-icon-svg" /> 技能
          </div>
        </div>

        <div class="settings-content">
          {/* ══════════ 智能体 ══════════ */}
          {settingsTab() === 'agent' && (
            <>
              <div class="settings-section">
                <div class="settings-section-title"><Cpu size={16} class="section-icon" /> 已配置厂商</div>
                <div class="settings-section-desc">当前已接入的模型厂商。新对话将使用默认模型创建。</div>
                <div class="provider-grid">
                  <div class="provider-card">
                    <div class="provider-icon"><Cpu size={20} /></div>
                    <div class="provider-info">
                      <div class="provider-name">DeepSeek</div>
                      <div class="provider-status">V3 / V4 Pro / R1</div>
                    </div>
                    <span class="provider-check"><Check size={14} /></span>
                  </div>
                </div>
                <button class="provider-add-btn" title="后续版本支持接入更多厂商">
                  <Plus size={16} /> 新增配置（即将推出）
                </button>
              </div>

              <div class="settings-section">
                <div class="settings-section-title"><List size={16} class="section-icon" /> 已接入模型 <span class="settings-section-badge">共 {modelCount()} 个</span></div>
                <div class="settings-section-desc">点击行展开独立参数，★ 设为默认。</div>
                <GlassInput type="search" placeholder="搜索模型..." value={modelSearch()} onInput={setModelSearch} />
                <div class="model-table-wrap">
                  <table class="model-table">
                    <thead><tr><th>默认</th><th>模型</th><th>厂商</th><th>上下文</th><th>状态</th></tr></thead>
                    <tbody>
                      <For each={sortedModels()}>
                        {(m) => {
                          const isDefault = m.id === defaultModel()
                          const isExpanded = expandedModelId() === m.id
                          return (
                            <>
                              <tr classList={{ expanded: isExpanded }} onClick={() => setExpandedModelId(isExpanded ? null : m.id)}>
                                <td onClick={(e) => e.stopPropagation()}>
                                  <span class={`model-default-star${isDefault ? '' : ' inactive'}`} onClick={() => agent.setSetting('default_model', m.id)} title={isDefault ? '当前默认' : '设为默认'}>
                                    <Star size={14} fill={isDefault ? 'var(--accent)' : 'none'} />
                                  </span>
                                </td>
                                <td class="model-name">{m.name}</td>
                                <td class="model-provider">{m.provider}</td>
                                <td class="model-cw">{formatCw(m.contextWindow)}</td>
                                <td style={{ 'font-size': '11px', color: m.enabled ? '#4ade80' : 'var(--text-muted)' }}>{m.enabled ? '可用' : '已禁用'}</td>
                              </tr>
                              <tr class={`model-config-row${isExpanded ? ' open' : ''}`}>
                                <td colspan="5">
                                  <div class="model-params">
                                    <div class="model-param">
                                      <span class="model-param-label">思考强度</span>
                                      <span class="model-param-value">
                                        <select value={thinkingLevel()} onChange={(e) => agent.setSetting('thinking_level', e.currentTarget.value)}>
                                          <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
                                        </select>
                                      </span>
                                    </div>
                                    <div class="model-param">
                                      <span class="model-param-label">启用</span>
                                      <Toggle checked={m.enabled} onChange={() => {}} />
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
                <div class="settings-section-title"><Sliders size={16} class="section-icon" /> 默认参数</div>
                <div class="settings-form-row">
                  <span class="settings-form-label">思考强度</span>
                  <span class="settings-form-value">
                    <select class="settings-select" value={thinkingLevel()} onChange={(e) => agent.setSetting('thinking_level', e.currentTarget.value)}>
                      <option value="low">Low — 快速响应</option><option value="medium">Medium — 均衡</option><option value="high">High — 深度思考</option>
                    </select>
                  </span>
                </div>
                <div class="settings-form-row">
                  <span class="settings-form-label">压缩阈值</span>
                  <span class="settings-form-value">
                    <input class="settings-input" type="number" min="50" max="95" inputmode="numeric" value={compactThreshold()} onChange={(e) => agent.setSetting('compact_threshold', e.currentTarget.value)} />
                    <span class="settings-input-unit">%</span>
                  </span>
                </div>
                <div class="settings-form-row">
                  <span class="settings-form-label">历史保留</span>
                  <span class="settings-form-value">
                    <input class="settings-input" type="number" min="10" max="500" inputmode="numeric" value={historyRetention()} onChange={(e) => agent.setSetting('history_retention', e.currentTarget.value)} />
                    <span class="settings-input-unit">条</span>
                  </span>
                </div>
                <div class="settings-form-row">
                  <span class="settings-form-label">默认模型</span>
                  <span class="settings-form-value"><span class="settings-current-model">{defaultModel()}</span></span>
                </div>
              </div>
            </>
          )}

          {/* ══════════ 主界面 ══════════ */}
          {settingsTab() === 'appearance' && (
            <>
              <div class="settings-section">
                <div class="settings-section-title"><Palette size={16} class="section-icon" /> 角色头像</div>
                <div class="settings-section-desc">设置聊天区域 AI 角色显示的头像。支持本地图片路径。</div>
                <div class="settings-form-row">
                  <span class="settings-form-label">头像图片</span>
                  <span class="settings-form-value">
                    <input
                      class="settings-input settings-input--wide"
                      type="text" placeholder="D:\pictures\avatar.png（留空使用默认字符）"
                      value={getSetting(entries(), 'avatar_image')}
                      onBlur={(e) => agent.setSetting('avatar_image', e.currentTarget.value.trim())}
                      onKeyDown={(e) => { if (e.key === 'Enter') agent.setSetting('avatar_image', e.currentTarget.value.trim()) }}
                    />
                  </span>
                </div>
                <div class="settings-form-row">
                  <span class="settings-form-label">角色名称</span>
                  <span class="settings-form-value">
                    <input
                      class="settings-input settings-input--wide"
                      type="text" placeholder="澪"
                      value={getSetting(entries(), 'avatar_name') || '澪'}
                      onBlur={(e) => agent.setSetting('avatar_name', e.currentTarget.value || '澪')}
                      onKeyDown={(e) => { if (e.key === 'Enter') agent.setSetting('avatar_name', e.currentTarget.value || '澪') }}
                    />
                  </span>
                </div>
              </div>

              <div class="settings-section">
                <div class="settings-section-title"><Palette size={16} class="section-icon" /> 主界面背景</div>
                <div class="settings-section-desc">设置主界面背景。支持色盘选取或本地图片路径。</div>
                <div class="settings-form-row">
                  <span class="settings-form-label">背景颜色</span>
                  <span class="settings-form-value">
                    <input
                      class="color-swatch"
                      type="color"
                      value={getSetting(entries(), 'bg_color') || '#0a0a12'}
                      onInput={(e) => agent.setSetting('bg_color', e.currentTarget.value)}
                    />
                    <input
                      class="settings-input"
                      type="text" placeholder="#0a0a12"
                      value={getSetting(entries(), 'bg_color') || '#0a0a12'}
                      style="width:100px;text-align:left;font-family:monospace;"
                      onBlur={(e) => agent.setSetting('bg_color', e.currentTarget.value || '#0a0a12')}
                      onKeyDown={(e) => { if (e.key === 'Enter') agent.setSetting('bg_color', e.currentTarget.value || '#0a0a12') }}
                    />
                  </span>
                </div>
                <div class="settings-form-row">
                  <span class="settings-form-label">背景图片</span>
                  <span class="settings-form-value">
                    <input
                      class="settings-input settings-input--wide"
                      type="text" placeholder="D:\wallpapers\bg.png（留空使用纯色）"
                      value={getSetting(entries(), 'bg_image')}
                      onBlur={(e) => agent.setSetting('bg_image', e.currentTarget.value.trim())}
                      onKeyDown={(e) => { if (e.key === 'Enter') agent.setSetting('bg_image', e.currentTarget.value.trim()) }}
                    />
                  </span>
                </div>
              </div>

              <div class="settings-section">
                <div class="settings-section-title"><Sliders size={16} class="section-icon" /> 透明度</div>
                <div class="settings-section-desc">调整玻璃拟态面板的透明度。</div>
                <div class="settings-form-row">
                  <span class="settings-form-label">面板透明度</span>
                  <span class="settings-form-value" style="flex:1; gap:12px;">
                    <input
                      class="opacity-slider"
                      type="range" min="10" max="90" step="5"
                      value={getSetting(entries(), 'glass_opacity') || '45'}
                      onInput={(e) => agent.setSetting('glass_opacity', e.currentTarget.value)}
                    />
                    <span class="opacity-value">{getSetting(entries(), 'glass_opacity') || '45'}%</span>
                  </span>
                </div>
              </div>
            </>
          )}

          {/* ══════════ 工作目录 ══════════ */}
          {settingsTab() === 'workspace' && (
            <>
              <div class="settings-section">
                <div class="settings-section-title"><FolderOpen size={16} class="section-icon" /> 工作目录路径</div>
                <div class="settings-section-desc">设置智能体操作文件的根目录。修改后文件面板将自动切换。</div>
                <div class="settings-form-row">
                  <span class="settings-form-label">路径</span>
                  <span class="settings-form-value">
                    <input
                      class="settings-input settings-input--wide"
                      type="text"
                      placeholder="默认项目根目录"
                      value={getSetting(entries(), 'work_dir')}
                      onBlur={(e) => { const v = e.currentTarget.value.trim(); agent.setSetting('work_dir', v); setWorkDirSaved(true); setTimeout(() => setWorkDirSaved(false), 2000) }}
                      onKeyDown={(e) => { if (e.key === 'Enter') { const v = e.currentTarget.value.trim(); agent.setSetting('work_dir', v); setWorkDirSaved(true); setTimeout(() => setWorkDirSaved(false), 2000) } }}
                    />
                    <Show when={workDirSaved()}><span class="save-feedback"><Check size={14} /> 已保存</span></Show>
                  </span>
                </div>
              </div>

              <div class="settings-section">
                <div class="settings-section-title"><List size={16} class="section-icon" /> 文件过滤规则</div>
                <div class="settings-section-desc">
                  控制文件面板中显示的后缀格式。关闭的类型将不在文件树中出现。
                </div>

                {/* 预设 */}
                <div class="filter-presets">
                  <span class="preset-label">预设：</span>
                  <button class="preset-chip" onClick={() => applyPreset('web')}>Web</button>
                  <button class="preset-chip" onClick={() => applyPreset('python')}>Python</button>
                  <button class="preset-chip" onClick={() => applyPreset('godot')}>Godot</button>
                  <button class="preset-chip" onClick={() => applyPreset('all')}>全部</button>
                </div>

                {/* 搜索 */}
                <GlassInput
                  type="search"
                  placeholder="搜索后缀..."
                  value={filterSearch()}
                  onInput={setFilterSearch}
                />

                {/* 过滤列表 — enabled 置顶 */}
                <div class="filter-list">
                  <For each={sortedFilters()}>
                    {(f) => (
                      <div class="filter-row" classList={{ 'filter-row--off': !f.enabled }}>
                        <span class="filter-row-ext">.{f.ext}</span>
                        <Toggle checked={f.enabled} onChange={() => toggleFilter(f.ext)} />
                        <button class="filter-row-remove" onClick={() => removeFilter(f.ext)} title="删除">
                          <X size={12} />
                        </button>
                      </div>
                    )}
                  </For>
                </div>

                {/* 新增格式 */}
                <div class="filter-add-row">
                  <input
                    class="settings-input"
                    type="text"
                    placeholder="新后缀 (如: vue)"
                    value={newFilterExt()}
                    onInput={(e) => setNewFilterExt(e.currentTarget.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') addFilter() }}
                    style="width:140px;text-align:left;font-family:inherit;"
                  />
                  <button class="settings-btn" onClick={addFilter} disabled={!newFilterExt().trim()}>
                    <Plus size={14} /> 新增
                  </button>
                </div>
              </div>
            </>
          )}

          {/* ══════════ 技能 ══════════ */}
          {settingsTab() === 'skills' && (
            <>
              <div class="settings-section">
                <div class="settings-section-title"><PackageOpen size={16} class="section-icon" /> 已安装技能 <span class="settings-section-badge">共 {skills().length} 个 / 已启用 {enabledSkillCount()} 个</span></div>
                <div class="settings-section-desc">管理已安装的技能。禁用后下次对话生效。</div>
                <Show when={skills().length > 0} fallback={
                  <div class="skill-empty"><Box size={36} class="skill-empty-icon" /><span>暂无已安装的技能</span><span class="skill-empty-hint">将技能文件夹放入&nbsp;<code>{userSkillDir()}</code>&nbsp;或&nbsp;<code>{projectSkillDir()}</code></span></div>
                }>
                  <div class="skill-list">
                    <For each={skills()}>
                      {(skill) => (
                        <div class="skill-card">
                          <div class="skill-card-body">
                            <div class="skill-card-name">{skill.name}<span class={`skill-source-badge ${skill.source}`}>{skill.source === 'user' ? '用户' : '项目'}</span></div>
                            <div class="skill-card-desc">{skill.description || '(无描述)'}</div>
                          </div>
                          <div class="skill-card-actions">
                            <Toggle checked={skill.enabled} onChange={(checked) => agent.send('skills.toggle', { name: skill.name, source: skill.source, enabled: checked })} />
                            <button class="skill-remove-btn" onClick={() => { if (window.confirm(`确定删除技能 "${skill.name}"？此操作不可撤销。`)) { agent.send('skills.remove', { name: skill.name, source: skill.source, dirName: skill.dirName }) } }} title="删除技能"><Trash2 size={14} /></button>
                          </div>
                        </div>
                      )}
                    </For>
                  </div>
                </Show>
              </div>
              <div class="settings-section">
                <div class="settings-section-title"><Download size={16} class="section-icon" /> 安装技能</div>
                <div class="settings-section-desc">输入 .zip 技能包的本地路径，选择安装目标后点击安装。</div>
                <div class="settings-form-row">
                  <span class="settings-form-label">技能包路径</span>
                  <span class="settings-form-value"><GlassInput placeholder="D:\downloads\my-skill.zip" value={installPath()} onInput={setInstallPath} style="min-width:320px" /></span>
                </div>
                <div class="settings-form-row">
                  <span class="settings-form-label">安装到</span>
                  <span class="settings-form-value">
                    <select class="settings-select" value={installTarget()} onChange={(e) => setInstallTarget(e.currentTarget.value as 'user' | 'project')}>
                      <option value="user">用户级（{userSkillDir()}）— 全局可用</option>
                      <option value="project">项目级（{projectSkillDir()}）— 仅当前项目</option>
                    </select>
                  </span>
                </div>
                <div class="install-action-row">
                  <button class="settings-btn primary" disabled={installPath().length === 0 || installStatus() === 'installing'} onClick={() => { setInstallStatus('installing'); setInstallMsg('正在安装...'); agent.send('skills.install', { zipPath: installPath(), target: installTarget() }) }}>{installStatus() === 'installing' ? '安装中...' : '安装'}</button>
                  <Show when={installStatus() === 'ok'}><span class="install-ok"><Check size={14} /> {installMsg()}</span></Show>
                  <Show when={installStatus() === 'error'}><span class="install-error">{installMsg()}</span></Show>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
