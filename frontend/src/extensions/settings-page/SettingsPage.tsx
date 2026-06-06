import { createEffect, For, createSignal, onCleanup, Show } from 'solid-js'
import { useAgent } from '@/shell/useAgent'
import { isSettingsOpen, setIsSettingsOpen } from '@/shell/settings-signal'
import './settings-page.css'
import type { ServerMessage, SkillSummary } from '@bridge/protocol'

type SettingsTab = 'agent' | 'skills'

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

  const [skills, setSkills] = createSignal<SkillSummary[]>([])
  const [userSkillDir, setUserSkillDir] = createSignal('~/.pi/agent/skills/')
  const [projectSkillDir, setProjectSkillDir] = createSignal('.pi/skills/')
  const [installPath, setInstallPath] = createSignal('')
  const [installTarget, setInstallTarget] = createSignal<'user' | 'project'>('user')
  const [installStatus, setInstallStatus] = createSignal<'idle' | 'installing' | 'ok' | 'error'>('idle')
  const [installMsg, setInstallMsg] = createSignal('')
  let installTimer: ReturnType<typeof setTimeout> | undefined

  // 打开时拉取设置 + 自动发现模型
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

  // 订阅技能状态推送（实时更新）
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

  // 订阅安装完成通知
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
      onCleanup(() => {
        unsub()
        if (installTimer) clearTimeout(installTimer)
      })
    }
  })

  // 订阅安装错误
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

  // ── 派生值 ──
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
            classList={{ active: settingsTab() === 'skills' }}
            onClick={() => setSettingsTab('skills')}
          >
            <span class="nav-icon">🧩</span> 技能管理
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
                <div class="settings-form-row">
                  <span class="settings-form-label">工作目录</span>
                  <span class="settings-form-value">
                    <input
                      class="settings-input"
                      type="text"
                      placeholder="默认项目根目录"
                      value={getSetting(entries(), 'work_dir')}
                      style="width: 320px; text-align: left;"
                      onBlur={(e) => {
                        const v = e.currentTarget.value.trim()
                        agent.setSetting('work_dir', v)
                        setWorkDirSaved(true)
                        setTimeout(() => setWorkDirSaved(false), 2000)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const v = e.currentTarget.value.trim()
                          agent.setSetting('work_dir', v)
                          setWorkDirSaved(true)
                          setTimeout(() => setWorkDirSaved(false), 2000)
                        }
                      }}
                    />
                    <Show when={workDirSaved()}>
                      <span style="font-size:12px;color:#4ade80;margin-left:8px;">✓ 已保存</span>
                    </Show>
                  </span>
                </div>
              </div>
            </>
          )}

          {/* ══════════ 技能管理 ══════════ */}
          {settingsTab() === 'skills' && (
            <>
              <div class="settings-section">
                <div class="settings-section-title">
                  📦 已安装技能
                  <span style="font-size:11px;color:var(--text-muted);font-weight:400;margin-left:8px;">
                    共 {skills().length} 个 / 已启用 {skills().filter((s: SkillSummary) => s.enabled).length} 个
                  </span>
                </div>
                <div class="settings-section-desc">管理已安装的技能。禁用后下次对话生效。</div>

                <Show when={skills().length > 0} fallback={
                  <div style="padding:32px;text-align:center;color:var(--text-muted);font-size:13px;">
                    <div style="font-size:32px;margin-bottom:8px;">📭</div>
                    暂无已安装的技能
                    <div style="margin-top:4px;font-size:11px;">
                      将技能文件夹放入
                    </div>
                    <div style="margin-top:2px;font-size:11px;">
                      <code style="background:var(--surface);padding:2px 6px;border-radius:4px;">{userSkillDir()}</code>
                      <span style="margin:0 6px;">或</span>
                      <code style="background:var(--surface);padding:2px 6px;border-radius:4px;">{projectSkillDir()}</code>
                    </div>
                  </div>
                }>
                  <div class="skill-list">
                    <For each={skills()}>
                      {(skill) => (
                        <div class="skill-card">
                          <div class="skill-card-body">
                            <div class="skill-card-name">
                              {skill.name}
                              <span class={`skill-source-badge ${skill.source}`}>
                                {skill.source === 'user' ? '用户' : '项目'}
                              </span>
                            </div>
                            <div class="skill-card-desc">
                              {skill.description || '(无描述)'}
                            </div>
                          </div>
                          <div class="skill-card-actions">
                            <button
                              class={`skill-toggle${skill.enabled ? ' on' : ''}`}
                              onClick={() => agent.send('skills.toggle', {
                                name: skill.name,
                                source: skill.source,
                                enabled: !skill.enabled,
                              })}
                              title={skill.enabled ? '已启用，点击禁用' : '已禁用，点击启用'}
                            >
                              <span class="toggle-track">
                                <span class="toggle-thumb" />
                              </span>
                            </button>
                            <button
                              class="skill-remove-btn"
                              onClick={() => {
                                if (window.confirm(`确定删除技能 "${skill.name}"？此操作不可撤销。`)) {
                                  agent.send('skills.remove', {
                                    name: skill.name,
                                    source: skill.source,
                                    dirName: skill.dirName,
                                  })
                                }
                              }}
                              title="删除技能"
                            >🗑</button>
                          </div>
                        </div>
                      )}
                    </For>
                  </div>
                </Show>
              </div>

              <div class="settings-section">
                <div class="settings-section-title">📥 安装技能</div>
                <div class="settings-section-desc">输入 .zip 技能包的本地路径，选择安装目标后点击安装。</div>
                <div class="settings-form-row">
                  <span class="settings-form-label">技能包路径</span>
                  <span class="settings-form-value">
                    <input
                      class="settings-input"
                      type="text"
                      placeholder="D:\downloads\my-skill.zip"
                      value={installPath()}
                      onInput={(e) => setInstallPath(e.currentTarget.value)}
                      style="width: 320px; text-align: left;"
                    />
                  </span>
                </div>
                <div class="settings-form-row">
                  <span class="settings-form-label">安装到</span>
                  <span class="settings-form-value">
                    <select
                      class="settings-select"
                      value={installTarget()}
                      onChange={(e) => setInstallTarget(e.currentTarget.value as 'user' | 'project')}
                    >
                      <option value="user">用户级（{userSkillDir()}）— 全局可用</option>
                      <option value="project">项目级（{projectSkillDir()}）— 仅当前项目</option>
                    </select>
                  </span>
                </div>
                <div style="display:flex;align-items:center;gap:12px;">
                  <button
                    class="settings-btn primary"
                    disabled={installPath().length === 0 || installStatus() === 'installing'}
                    onClick={() => {
                      setInstallStatus('installing')
                      setInstallMsg('正在安装...')
                      agent.send('skills.install', {
                        zipPath: installPath(),
                        target: installTarget(),
                      })
                    }}
                  >
                    {installStatus() === 'installing' ? '安装中...' : '安装'}
                  </button>
                  <Show when={installStatus() === 'ok'}>
                    <span style="font-size:12px;color:#4ade80;">✓ {installMsg()}</span>
                  </Show>
                  <Show when={installStatus() === 'error'}>
                    <span style="font-size:12px;color:#ef4444;">✗ {installMsg()}</span>
                  </Show>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
