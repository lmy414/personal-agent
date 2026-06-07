import type { JSX } from 'solid-js'
import { createSignal, For, Show, createMemo } from 'solid-js'
import { useAgent, type MessageEntry, type ToolCallEntry } from '@/shell/useAgent'
import type { SessionInfo, AgentInfo } from '@bridge/protocol'
import { Code2, FileText, Globe, Search, CirclePause, BarChart3, Brain, Paperclip, ChevronLeft, FolderOpen } from 'lucide-solid'

// ===== 类型 =====

interface ToolItem {
  name: string
  status: string
  desc: string
  time: string
  dot: 'ok' | 'err' | 'run'
}

interface Tab {
  icon: () => JSX.Element
  label: string
  active?: boolean
}

// ===== 工具函数 =====

/** 让 div 获得键盘可访问性 — 不改变布局或样式 */
function kbdHandlers(fn: () => void) {
  return {
    tabIndex: 0 as number,
    role: 'button' as const,
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn() }
    },
  }
}

function toolDot(tc: ToolCallEntry): 'ok' | 'err' | 'run' {
  if (tc.status === 'running') return 'run'
  if (tc.status === 'error') return 'err'
  return 'ok'
}

function toolStatusText(tc: ToolCallEntry): string {
  if (tc.status === 'running') return '执行中'
  if (tc.status === 'error') return '失败'
  return '成功'
}

function timeStr(): string {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function formatTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

// ===== 静态配置 =====

const TABS: Tab[] = [
  { icon: () => <Code2 size={12} />, label: 'app.tsx' },
  { icon: () => <FileText size={12} />, label: 'readme.md', active: true },
  { icon: () => <Globe size={12} />, label: 'index.html' },
]

const INPUT_TAGS = ['MCP 工具', '代码片段', '图片', '文件']

// ===== Sidebar 组件 =====

function Sidebar() {
  const a = useAgent()
  const [searchQuery, setSearchQuery] = createSignal('')
  const [expandedAgents, setExpandedAgents] = createSignal<string[]>(['default'])

  const toggleExpand = (id: string) => {
    setExpandedAgents((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  // must be defined before activeAgent and sessionsByAgent
  const allAgents = createMemo(() => {
    const list = a.agents()
    if (list.length > 0) return list
    return [{
      id: 'default', name: '澪', provider: 'DeepSeek', modelId: '',
      avatarColor: '#6B8FA8', roleDescription: '技術顧問 · 戦術支援',
      isDefault: true, createdAt: 0, sessionCount: 0,
    } as AgentInfo]
  })

  const activeAgent = createMemo(() => {
    const sessions = a.sessions()
    const curSid = a.sessionId()
    const curSession = sessions.find((s) => s.id === curSid)
    const agents = allAgents()
    const linked = curSession?.agentId
      ? agents.find((ag) => ag.id === curSession.agentId)
      : undefined
    return linked ?? agents.find((ag) => ag.isDefault) ?? agents[0]
  })

  const sessionsByAgent = createMemo(() => {
    const map = new Map<string, SessionInfo[]>()
    const agents = allAgents()
    const defaultId = agents.find((ag) => ag.isDefault)?.id ?? agents[0]?.id ?? 'default'
    for (const s of a.sessions()) {
      const key = s.agentId || defaultId
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(s)
    }
    return map
  })

  const handleAgentClick = (agentId: string) => {
    const agentSessions = sessionsByAgent().get(agentId) ?? []
    if (agentSessions.length > 0) {
      a.switchSession(agentSessions[0].id)
    } else {
      // 没有会话时，为该角色新建一个
      a.createSession()
    }
  }

  const tools = createMemo((): ToolItem[] =>
    a.toolCalls().slice(-5).reverse().map((tc) => ({
      name: tc.toolName,
      status: toolStatusText(tc),
      desc: `${tc.toolName} · ${(tc.input as Record<string, unknown>)['path'] as string ?? ''}`,
      time: timeStr(),
      dot: toolDot(tc),
    }))
  )

  const handleCreateSession = () => a.createSession()

  return (
    <div
      class="glass-panel"
      style={{
        width: '320px',
        'flex-shrink': '0',
        display: 'flex',
        'flex-direction': 'column',
        'z-index': '5',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          'align-items': 'center',
          'justify-content': 'space-between',
          padding: '12px 16px',
          height: '54px',
          background: 'var(--panel-bg-top)',
          'border-bottom': '1px solid rgba(255,255,255,0.03)',
          'flex-shrink': '0',
        }}
      >
        <div style={{ display: 'flex', 'align-items': 'center', gap: '12px' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              'border-radius': '4px',
              background: 'rgba(255,255,255,0.05)',
              display: 'flex',
              'align-items': 'center',
              'justify-content': 'center',
              'font-family': '"JetBrains Mono", monospace',
              'font-size': '16px',
              'font-weight': 'bold',
              color: '#fff',
              'flex-shrink': '0',
            }}
          >
            {(activeAgent()?.name ?? '澪')[0]}
          </div>
          <div style={{ display: 'flex', 'flex-direction': 'column', gap: '2px' }}>
            <div
              style={{
                'font-family': '"Noto Serif SC", serif',
                'font-size': '15px',
                'font-weight': 'bold',
                color: '#fff',
              }}
            >
              {activeAgent()?.name ?? '澪号'}
            </div>
            <div style={{ 'font-size': '11px', color: 'rgba(255,255,255,0.40)' }}>
              {activeAgent()?.roleDescription ?? '技術顧問'}
            </div>
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            'flex-direction': 'column',
            'align-items': 'flex-end',
            gap: '2px',
          }}
        >
          <div
            style={{
              'font-size': '13px',
              color: 'var(--text-primary)',
              'font-variant-numeric': 'tabular-nums',
            }}
          >
            {timeStr()}
          </div>
          <div style={{ 'font-size': '10px', color: 'var(--text-muted)' }}>
            通信 #{a.sessions().length}
          </div>
        </div>
      </div>
      <div class="divider" />

      {/* Search */}
      <div
        style={{
          display: 'flex',
          'align-items': 'center',
          gap: '8px',
          padding: '8px 16px',
          height: '40px',
          'border-bottom': '1px solid rgba(255,255,255,0.03)',
          'flex-shrink': '0',
        }}
      >
        <span style={{ color: 'var(--text-muted)', display: 'flex' }}><Search size={14} /></span>
        <input
          placeholder="搜索通信记录..."
          value={searchQuery()}
          onInput={(e) => setSearchQuery(e.currentTarget.value)}
          style={{
            flex: '1',
            background: 'transparent',
            border: 'none',
            color: 'var(--text-primary)',
            'font-size': '13px',
            'font-family': 'inherit',
            outline: 'none',
          }}
        />
      </div>
      <div class="divider" />

      {/* Scroll Area — flex column: agent list fills, tool log sinks to bottom */}
      <div style={{ flex: '1', display: 'flex', 'flex-direction': 'column', 'min-height': '0' }}>
        {/* Agent List — scrollable */}
        <div style={{ flex: '1', 'overflow-y': 'auto', 'min-height': '0' }}>
        <For each={allAgents()}>
          {(agentItem: AgentInfo) => {
            const agentSessions = () => {
              const q = searchQuery().toLowerCase()
              const list = sessionsByAgent().get(agentItem.id) ?? []
              if (!q) return list
              return list.filter((s) => s.title.toLowerCase().includes(q))
            }
            const isExpanded = () => expandedAgents().includes(agentItem.id) || agentItem.isDefault
            return (
              <>
                <div
                  style={{
                    display: 'flex',
                    'align-items': 'center',
                    gap: '12px',
                    padding: '8px 16px',
                    background: agentItem.isDefault ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.012)',
                    cursor: 'pointer',
                    transition: 'background 0.12s',
                  }}
                  {...kbdHandlers(() => toggleExpand(agentItem.id))}
                  onClick={() => toggleExpand(agentItem.id)}
                >
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      'border-radius': '4px',
                      background: 'rgba(255,255,255,0.025)',
                      border: '1px solid rgba(255,255,255,0.025)',
                      display: 'flex',
                      'align-items': 'center',
                      'justify-content': 'center',
                      'font-family': '"JetBrains Mono", monospace',
                      'font-size': '13px',
                      'font-weight': 'bold',
                      color: '#fff',
                      'flex-shrink': '0',
                    }}
                  >
                    {agentItem.name[0]}
                  </div>
                  <div
                    style={{
                      flex: '1',
                      display: 'flex',
                      'flex-direction': 'column',
                      gap: '1px',
                      'min-width': '0',
                    }}
                  >
                    <div style={{ 'font-size': '13px', 'font-weight': '500', color: 'var(--text-primary)' }}>
                      {agentItem.name}
                    </div>
                    <div style={{ 'font-size': '11px', color: 'var(--text-muted)' }}>
                      {agentItem.roleDescription || agentItem.provider}
                    </div>
                  </div>
                  <span style={{ 'font-size': '10px', color: 'var(--text-muted)', 'flex-shrink': '0' }}>
                    {agentSessions().length}
                  </span>
                  <span
                    style={{
                      'font-size': '10px',
                      color: 'var(--text-muted)',
                      'flex-shrink': '0',
                      transform: isExpanded() ? 'rotate(90deg)' : 'none',
                      transition: 'transform 0.15s',
                    }}
                  >
                    ›
                  </span>
                </div>
                {/* Sessions under agent — always visible for default, toggle for others */}
                <Show when={isExpanded()}>
                  <div style={{ background: 'rgba(255,255,255,0.015)' }}>
                    <Show
                      when={agentSessions().length > 0}
                      fallback={
                        <div
                          style={{
                            padding: '10px 16px',
                            'font-size': '11px',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                          }}
                          onClick={handleCreateSession}
                        >
                          + 新建会话
                        </div>
                      }
                    >
                      <For each={agentSessions()}>
                        {(s: SessionInfo) => (
                          <div
                            style={{
                              display: 'flex',
                              'align-items': 'center',
                              padding: '8px 12px',
                              cursor: 'pointer',
                              transition: 'background 0.12s',
                              background:
                                s.id === a.sessionId()
                                  ? 'rgba(255,255,255,0.02)'
                                  : 'transparent',
                              'border-left':
                                s.id === a.sessionId()
                                  ? '3px solid var(--text-muted)'
                                  : '3px solid transparent',
                            }}
                            {...kbdHandlers(() => a.switchSession(s.id))}
                            onClick={() => a.switchSession(s.id)}
                          >
                            <span style={{ 'font-size': '12px', color: 'var(--text-secondary)' }}>
                              {s.title}
                            </span>
                            <span
                              style={{
                                'font-size': '10px',
                                color: 'var(--text-muted)',
                                'margin-left': 'auto',
                                'white-space': 'nowrap',
                              }}
                            >
                              {s.roundCount}轮
                            </span>
                          </div>
                        )}
                      </For>
                    </Show>
                  </div>
                </Show>
                <div class="divider" />
              </>
            )
          }}
        </For>
        </div>

        <div class="divider" />

        {/* Tool Log — max 5 items, scrollable */}
        <div style={{ 'flex-shrink': '0', padding: '12px 16px 8px' }}>
          <div
            style={{
              display: 'flex',
              'align-items': 'center',
              'justify-content': 'space-between',
              'margin-bottom': '10px',
            }}
          >
            <span
              style={{
                'font-family': '"Noto Serif SC", serif',
                'font-size': '12px',
                color: 'var(--text-muted)',
              }}
            >
              作戦記録
            </span>
            <button
              style={{
                display: 'flex',
                'align-items': 'center',
                gap: '4px',
                padding: '3px 10px',
                'border-radius': '4px',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.06)',
                color: 'var(--text-secondary)',
                'font-size': '11px',
                cursor: 'pointer',
                'font-family': 'inherit',
              }}
            >
              <CirclePause size={12} />
            </button>
          </div>
          <div style={{ display: 'flex', 'flex-direction': 'column', gap: '6px', 'max-height': '190px', 'overflow-y': 'auto' }}>
            <Show when={tools().length === 0}>
              <div style={{ 'font-size': '11px', color: 'var(--text-muted)', 'text-align': 'center', padding: '8px' }}>
                暂无工具执行记录
              </div>
            </Show>
            <For each={tools()}>
              {(tool) => (
                <div
                  style={{
                    display: 'flex',
                    'align-items': 'center',
                    gap: '8px',
                    padding: '6px 8px',
                    'border-radius': '4px',
                    cursor: 'pointer',
                    transition: 'background 0.12s',
                  }}
                >
                  <div
                    style={{
                      width: '6px',
                      height: '6px',
                      'border-radius': '50%',
                      'flex-shrink': '0',
                      background:
                        tool.dot === 'ok'
                          ? 'var(--success)'
                          : tool.dot === 'err'
                            ? 'var(--error)'
                            : 'var(--warning)',
                    }}
                  />
                  <span
                    style={{
                      'font-family': '"JetBrains Mono", monospace',
                      'font-size': '12px',
                      'font-weight': '600',
                      color: 'var(--text-primary)',
                    }}
                  >
                    {tool.name}
                  </span>
                  <span
                    style={{
                      'font-size': '11px',
                      'margin-left': '4px',
                      color:
                        tool.dot === 'ok'
                          ? 'var(--success)'
                          : tool.dot === 'err'
                            ? 'var(--error)'
                            : 'var(--warning)',
                    }}
                  >
                    {tool.status}
                  </span>
                  <span style={{ 'font-size': '11px', color: 'var(--text-muted)' }}>{tool.desc}</span>
                  <span
                    style={{
                      'font-size': '10px',
                      color: 'var(--text-muted)',
                      'margin-left': 'auto',
                      'font-variant-numeric': 'tabular-nums',
                    }}
                  >
                    {tool.time}
                  </span>
                </div>
              )}
            </For>
          </div>
        </div>
      </div>

      {/* Dashboard — 底部固定，紧贴工具栏 */}
      <div style={{ 'flex-shrink': '0', 'border-top': '1px solid rgba(255,255,255,0.03)' }}>
        <div
          style={{
            padding: '12px 16px',
            display: 'flex',
            'flex-direction': 'column',
            gap: '12px',
          }}
        >
          <div
            style={{
              display: 'flex',
              'align-items': 'center',
              'justify-content': 'space-between',
            }}
          >
            <span
              style={{
                'font-family': '"Noto Serif SC", serif',
                'font-size': '12px',
                color: 'var(--text-muted)',
              }}
            >
              資源監視
            </span>
            <span style={{ color: 'var(--text-muted)', display: 'flex' }}><BarChart3 size={12} /></span>
          </div>

          {/* Token Card */}
          <div
            style={{
              background: 'var(--card-bg)',
              'border-radius': '6px',
              padding: '12px',
              display: 'flex',
              'flex-direction': 'column',
              gap: '8px',
            }}
          >
            <div
              style={{
                display: 'flex',
                'justify-content': 'space-between',
                'align-items': 'center',
              }}
            >
              <span style={{ 'font-size': '11px', color: 'var(--text-muted)' }}>上下文用量</span>
              <span
                style={{
                  'font-size': '13px',
                  color: 'var(--text-primary)',
                  'font-weight': '600',
                }}
              >
                {formatTokens(a.status.contextUsed)} / {formatTokens(a.status.contextMax)}
              </span>
            </div>
            <div style={{ 'margin-top': '2px' }}>
              <div
                style={{
                  display: 'flex',
                  'justify-content': 'space-between',
                  'font-size': '10px',
                  color: 'var(--text-muted)',
                  'margin-bottom': '4px',
                }}
              >
                <span>{a.status.contextMax > 0 ? Math.round((a.status.contextUsed / a.status.contextMax) * 100) : 0}%</span>
                <span>剩余 {formatTokens(Math.max(0, a.status.contextMax - a.status.contextUsed))}</span>
              </div>
              <div
                style={{
                  height: '3px',
                  'border-radius': '2px',
                  background: 'rgba(255,255,255,0.06)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    'border-radius': '2px',
                    background: 'var(--accent)',
                    width: `${a.status.contextMax > 0 ? Math.min(100, (a.status.contextUsed / a.status.contextMax) * 100) : 0}%`,
                  }}
                />
              </div>
            </div>
            <button
              style={{
                width: '100%',
                padding: '8px',
                'border-radius': '4px',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.06)',
                color: 'var(--text-secondary)',
                'font-size': '12px',
                cursor: 'pointer',
                'text-align': 'center',
                'font-family': 'inherit',
              }}
              onClick={() => a.send('agent.compact', {})}
            >
              压缩上下文
            </button>
          </div>

          {/* Cost Card */}
          <div
            style={{
              background: 'var(--card-bg)',
              'border-radius': '6px',
              padding: '12px',
              display: 'flex',
              'flex-direction': 'column',
              gap: '8px',
            }}
          >
            <div
              style={{
                display: 'flex',
                'justify-content': 'space-between',
                'align-items': 'center',
              }}
            >
              <span style={{ 'font-size': '12px', color: 'var(--text-secondary)' }}>费用信息</span>
              <span
                style={{
                  'font-size': '16px',
                  color: 'var(--accent)',
                  'font-weight': '600',
                }}
              >
                ${a.status.cost.toFixed(2)}
              </span>
            </div>
            <div
              style={{
                display: 'flex',
                'justify-content': 'space-between',
                'align-items': 'center',
              }}
            >
              <span style={{ 'font-size': '11px', color: 'var(--text-muted)' }}>本轮消耗</span>
              <span style={{ 'font-size': '11px', color: 'var(--text-muted)' }}>
                {formatTokens(a.status.tokens)} tokens
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ===== Chat Panel 组件 =====

function ChatPanel() {
  const agent = useAgent()
  const [inputValue, setInputValue] = createSignal('')
  let textareaRef: HTMLTextAreaElement | undefined

  const handleSend = () => {
    const text = inputValue().trim()
    if (!text) return
    agent.sendMessage(text)
    setInputValue('')
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const messages = createMemo(() => agent.messages())

  return (
    <div
      class="glass-panel"
      style={{
        flex: '1',
        'min-width': '0',
        display: 'flex',
        'flex-direction': 'column',
        'z-index': '4',
      }}
    >
      {/* Bracket */}
      <div class="bracket-tr">
        <div class="bracket-h" />
        <div class="bracket-v" />
      </div>

      {/* Chat Header */}
      <div
        style={{
          display: 'flex',
          'align-items': 'center',
          'justify-content': 'space-between',
          padding: '12px 16px',
          height: '54px',
          background: 'var(--panel-bg-top)',
          'border-bottom': '1px solid rgba(255,255,255,0.03)',
          'flex-shrink': '0',
        }}
      >
        <div
          style={{
            'font-family': '"Noto Serif SC", serif',
            'font-size': '17px',
            'font-weight': '600',
            color: '#fff',
          }}
        >
          澪号端末 · MIO-TERMINAL
        </div>
        <div
          style={{
            display: 'flex',
            'align-items': 'center',
            gap: '8px',
            'font-size': '11px',
            color: 'var(--text-muted)',
          }}
        >
          <div
            style={{
              width: '5px',
              height: '5px',
              'border-radius': '50%',
              background: agent.isStreaming() ? 'var(--warning)' : 'var(--success)',
              animation: agent.isStreaming() ? 'pulse 2s infinite' : 'none',
            }}
          />
          <span>{agent.isStreaming() ? '思考中...' : '待機中'}</span>
        </div>
      </div>
      <div class="divider" />

      {/* Chat Area */}
      <div
        style={{
          flex: '1',
          'overflow-y': 'auto',
          padding: '20px 24px',
          display: 'flex',
          'flex-direction': 'column',
          gap: '20px',
          'min-height': '0',
        }}
      >
        <Show
          when={messages().length > 0}
          fallback={
            <div
              style={{
                flex: '1',
                display: 'flex',
                'align-items': 'center',
                'justify-content': 'center',
                color: 'var(--text-muted)',
                'font-size': '13px',
              }}
            >
              新しい会話を始めましょう
            </div>
          }
        >
          <For each={messages()}>
            {(msg: MessageEntry) => (
              <>
                <Show
                  when={msg.role === 'user'}
                  fallback={
                    /* Assistant */
                    <div
                      style={{
                        display: 'flex',
                        gap: '12px',
                        width: '100%',
                        'justify-content': 'flex-start',
                      }}
                    >
                      <div
                        style={{
                          width: '32px',
                          height: '32px',
                          'border-radius': '4px',
                          display: 'flex',
                          'align-items': 'center',
                          'justify-content': 'center',
                          'font-family': '"JetBrains Mono", monospace',
                          'font-size': '12px',
                          'font-weight': 'bold',
                          color: '#fff',
                          'flex-shrink': '0',
                          background: 'rgba(255,255,255,0.04)',
                        }}
                      >
                        A
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          'flex-direction': 'column',
                          gap: '2px',
                          'max-width': '100%',
                          flex: '1',
                        }}
                      >
                        {/* Thinking block */}
                        <Show when={msg.thinking}>
                          <div
                            style={{
                              background: 'rgba(10,10,16,0.25)',
                              'border-radius': '6px',
                              padding: '8px 12px',
                              width: '100%',
                              'margin-bottom': '4px',
                            }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                'align-items': 'center',
                                gap: '8px',
                                'margin-bottom': '4px',
                              }}
                            >
                              <span style={{ color: 'var(--text-muted)', display: 'flex' }}><Brain size={11} /></span>
                              <span style={{ 'font-size': '11px', color: 'var(--text-muted)' }}>
                                思考过程
                              </span>
                            </div>
                            <div
                              style={{
                                'font-size': '12px',
                                color: 'var(--text-muted)',
                                'line-height': '1.5',
                              }}
                            >
                              {msg.thinking}
                            </div>
                          </div>
                        </Show>
                        {/* Bubble */}
                        <div
                          style={{
                            'border-radius': '8px',
                            padding: '12px 16px',
                            'font-size': '13px',
                            'line-height': '1.6',
                            color: 'var(--text-primary)',
                            background: 'rgba(255,255,255,0.03)',
                            border: '1px solid rgba(255,255,255,0.04)',
                          }}
                        >
                          {msg.content || (msg.partial ? '...' : '')}
                        </div>
                      </div>
                    </div>
                  }
                >
                  {/* User */}
                  <div
                    style={{
                      display: 'flex',
                      gap: '12px',
                      width: '100%',
                      'justify-content': 'flex-end',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        'flex-direction': 'column',
                        gap: '2px',
                        'max-width': '80%',
                        'align-items': 'flex-end',
                      }}
                    >
                      <div
                        style={{
                          'border-radius': '8px',
                          padding: '12px 16px',
                          'font-size': '13px',
                          'line-height': '1.6',
                          color: 'var(--text-primary)',
                          background: 'rgba(20,20,30,0.50)',
                        }}
                      >
                        {msg.content}
                      </div>
                    </div>
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        'border-radius': '4px',
                        display: 'flex',
                        'align-items': 'center',
                        'justify-content': 'center',
                        'font-family': '"JetBrains Mono", monospace',
                        'font-size': '12px',
                        'font-weight': 'bold',
                        color: '#fff',
                        'flex-shrink': '0',
                        background: 'rgba(255,255,255,0.03)',
                      }}
                    >
                      我
                    </div>
                  </div>
                </Show>
              </>
            )}
          </For>
        </Show>
      </div>

      {/* Input Area */}
      <div
        style={{
          'border-top': '1px solid rgba(255,255,255,0.03)',
          padding: '16px 24px 12px',
          display: 'flex',
          'flex-direction': 'column',
          gap: '12px',
          'flex-shrink': '0',
        }}
      >
        <div style={{ display: 'flex', 'align-items': 'center', gap: '12px' }}>
          <button
            style={{
              width: '36px',
              height: '36px',
              'border-radius': '4px',
              background: 'rgba(255,255,255,0.03)',
              border: 'none',
              color: 'var(--text-muted)',
              'font-size': '16px',
              cursor: 'pointer',
              display: 'flex',
              'align-items': 'center',
              'justify-content': 'center',
              'flex-shrink': '0',
            }}
          >
            <Paperclip size={16} />
          </button>
          <textarea
            ref={textareaRef}
            placeholder="输入消息..."
            rows="1"
            value={inputValue()}
            onInput={(e) => setInputValue(e.currentTarget.value)}
            onKeyDown={handleKeyDown}
            style={{
              flex: '1',
              'min-height': '44px',
              'max-height': '120px',
              background: 'rgba(0,0,0,0.40)',
              border: '1px solid transparent',
              'border-radius': '4px',
              padding: '12px 16px',
              color: 'var(--text-primary)',
              'font-size': '13px',
              'font-family': 'inherit',
              'line-height': '1.5',
              resize: 'none',
              outline: 'none',
            }}
          />
          <button
            style={{
              padding: '12px 20px',
              'border-radius': '4px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.06)',
              color: 'var(--text-secondary)',
              'font-size': '13px',
              cursor: 'pointer',
              display: 'flex',
              'align-items': 'center',
              gap: '4px',
              'flex-shrink': '0',
            }}
            onClick={handleSend}
          >
            发送 ↑
          </button>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <For each={INPUT_TAGS}>
            {(tag) => (
              <span
                style={{
                  padding: '4px 12px',
                  'border-radius': '4px',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.04)',
                  color: 'var(--text-muted)',
                  'font-size': '11px',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {tag}
              </span>
            )}
          </For>
        </div>
        <div
          style={{
            width: '100%',
            height: '1px',
            background: 'rgba(255,255,255,0.06)',
            opacity: '0.5',
            'margin-top': '4px',
          }}
        />
      </div>
    </div>
  )
}

// ===== Editor Panel 组件 =====

function EditorPanel() {
  return (
    <div
      class="glass-panel"
      style={{
        width: '340px',
        'flex-shrink': '0',
        display: 'flex',
        'flex-direction': 'column',
        'z-index': '3',
      }}
    >
      {/* Bracket */}
      <div class="bracket-tr">
        <div class="bracket-h" />
        <div class="bracket-v" />
      </div>

      {/* Editor Header */}
      <div
        style={{
          display: 'flex',
          'align-items': 'center',
          'justify-content': 'space-between',
          padding: '12px 16px',
          height: '54px',
          background: 'var(--panel-bg-top)',
          'border-bottom': '1px solid rgba(255,255,255,0.03)',
          'flex-shrink': '0',
        }}
      >
        <div
          style={{
            'font-family': '"Noto Serif SC", serif',
            'font-size': '14px',
            'font-weight': '600',
            color: '#fff',
          }}
        >
          資料閲覧
        </div>
        <button
          style={{
            display: 'flex',
            'align-items': 'center',
            gap: '4px',
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            'font-size': '11px',
            cursor: 'pointer',
            'font-family': 'inherit',
          }}
        >
          收起 <ChevronLeft size={11} />
        </button>
      </div>
      <div class="divider" />

      {/* Tab Bar */}
      <div
        style={{
          display: 'flex',
          'align-items': 'center',
          'justify-content': 'space-between',
          padding: '0 12px 0 8px',
          height: '31px',
          'border-bottom': '1px solid rgba(255,255,255,0.03)',
          'flex-shrink': '0',
        }}
      >
        <div style={{ display: 'flex', 'align-items': 'center', gap: '0' }}>
          <For each={TABS}>
            {(tab) => (
              <div
                style={{
                  display: 'flex',
                  'align-items': 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  'font-size': '12px',
                  color: tab.active ? 'var(--text-primary)' : 'var(--text-muted)',
                  cursor: 'pointer',
                  'border-bottom': tab.active ? '2px solid var(--accent)' : '2px solid transparent',
                  background: tab.active ? 'rgba(255,255,255,0.04)' : 'transparent',
                  transition: 'all 0.15s',
                }}
              >
                <span style={{ display: 'flex', 'align-items': 'center' }}>{tab.icon()}</span>
                <span>{tab.label}</span>
              </div>
            )}
          </For>
        </div>
      </div>

      {/* Editor Toolbar */}
      <div
        style={{
          display: 'flex',
          'align-items': 'center',
          'justify-content': 'space-between',
          padding: '8px 16px',
          height: '32px',
          'border-bottom': '1px solid rgba(255,255,255,0.03)',
          'flex-shrink': '0',
        }}
      >
        <span
          style={{
            'font-family': '"JetBrains Mono", monospace',
            'font-size': '10px',
            color: 'rgba(255,255,255,0.40)',
            'text-transform': 'uppercase',
            'letter-spacing': '0.5px',
          }}
        >
          Markdown · 18 Lines
        </span>
        <div style={{ display: 'flex', 'align-items': 'center', gap: '8px', 'font-size': '11px' }}>
          <span style={{ color: 'var(--text-muted)', cursor: 'pointer' }}>Source</span>
          <span
            style={{
              color: 'var(--text-primary)',
              'font-weight': '600',
              cursor: 'pointer',
            }}
          >
            Preview
          </span>
        </div>
      </div>
      <div class="divider" />

      {/* Markdown Preview */}
      <div
        style={{
          flex: '1',
          'overflow-y': 'auto',
          padding: '8px 16px',
          'min-height': '0',
        }}
      >
        <div style={{ display: 'flex', 'flex-direction': 'column', gap: '10px' }}>
          <h1
            style={{
              'font-family': '"Noto Serif SC", serif',
              'font-size': '18px',
              'font-weight': '600',
              color: '#D0D0D0',
              margin: '4px 0',
            }}
          >
            使用文档
          </h1>
          <p style={{ 'font-size': '12px', 'line-height': '1.7', color: 'var(--text-secondary)' }}>
            在左侧面板选择文件或在聊天中发送消息，相关内容将在此处显示。
          </p>
        </div>
      </div>
    </div>
  )
}

// ===== 主入口 =====

export default function PencilMainView() {
  return (
    <>
      <Sidebar />
      <ChatPanel />
      <EditorPanel />
    </>
  )
}
