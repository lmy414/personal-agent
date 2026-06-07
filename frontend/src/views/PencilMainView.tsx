import type { JSX } from 'solid-js'
import { createSignal, For, Show, createMemo, onMount, onCleanup, createEffect } from 'solid-js'
import { useAgent, type MessageEntry, type ToolCallEntry } from '@/shell/useAgent'
import type { SessionInfo, AgentInfo, ServerMessage } from '@bridge/protocol'
import { Code2, FileText, Globe, Search, CirclePause, BarChart3, Brain, Paperclip, ChevronLeft, FolderOpen } from 'lucide-solid'
import { marked } from 'marked'
import { FileTree } from '@/extensions/file-tree/FileTree'

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

function formatDuration(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`
  if (ms > 0) return `${ms}ms`
  return '...'
}

function formatTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

// ===== 静态配置 =====

const INPUT_TAGS = ['MCP 工具', '代码片段', '图片', '文件']

// ===== Sidebar 组件 =====

function Sidebar() {
  const a = useAgent()
  const [searchQuery, setSearchQuery] = createSignal('')
  const [expandedAgents, setExpandedAgents] = createSignal<string[]>(['default'])
  const [deleteTarget, setDeleteTarget] = createSignal<string | null>(null)

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
    a.toolCalls().slice(-8).reverse().map((tc) => ({
      name: tc.toolName,
      status: toolStatusText(tc),
      desc: `${tc.toolName} · ${(tc.input as Record<string, unknown>)['path'] as string ?? ''}`,
      time: formatDuration(tc.duration),
      dot: toolDot(tc),
    }))
  )

  let toolScrollRef: HTMLDivElement | undefined

  // 工具列表 → 自动滚到底部
  createEffect(() => {
    void a.toolCalls().length
    if (toolScrollRef) {
      toolScrollRef.scrollTop = toolScrollRef.scrollHeight
    }
  })

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
            const isExpanded = () => expandedAgents().includes(agentItem.id)
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
                    onClick={(e) => { e.stopPropagation(); a.createSession() }}
                    style={{ 'font-size': '11px', color: 'var(--text-muted)', cursor: 'pointer', 'margin-left': '4px', 'line-height': '1' }}
                    title="新建会话"
                  >+</span>
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
                          onClick={() => a.createSession()}
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
                            <Show
                              when={deleteTarget() === s.id}
                              fallback={
                                <span
                                  onClick={(e) => { e.stopPropagation(); setDeleteTarget(s.id) }}
                                  style={{ 'font-size': '11px', color: 'var(--text-muted)', cursor: 'pointer', 'margin-left': '4px', 'line-height': '1' }}
                                  title="删除会话"
                                >×</span>
                              }
                            >
                              <span
                                onClick={(e) => { e.stopPropagation(); a.send('session.delete', { sessionId: s.id }); setDeleteTarget(null) }}
                                style={{ 'font-size': '10px', color: '#f87171', cursor: 'pointer', 'margin-left': '4px', 'white-space': 'nowrap', 'font-weight': '500' }}
                              >确认</span>
                              <span
                                onClick={(e) => { e.stopPropagation(); setDeleteTarget(null) }}
                                style={{ 'font-size': '10px', color: 'var(--text-muted)', cursor: 'pointer', 'margin-left': '2px' }}
                              >取消</span>
                            </Show>
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
          <div ref={toolScrollRef} style={{ display: 'flex', 'flex-direction': 'column', gap: '6px', 'max-height': '280px', 'overflow-y': 'auto' }}>
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
            padding: '10px 16px',
            display: 'flex',
            'flex-direction': 'column',
            gap: '8px',
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

          {/* Token Card — compact */}
          <div
            style={{
              background: 'var(--card-bg)',
              'border-radius': '6px',
              padding: '10px 12px',
              display: 'flex',
              'flex-direction': 'column',
              gap: '6px',
            }}
          >
            <div style={{ display: 'flex', 'justify-content': 'space-between', 'align-items': 'center' }}>
              <span style={{ 'font-size': '11px', color: 'var(--text-muted)' }}>上下文用量</span>
              <span style={{ 'font-size': '13px', color: 'var(--text-primary)', 'font-weight': '600' }}>
                {formatTokens(a.status.contextUsed)}
              </span>
            </div>
            <div style={{ display: 'flex', 'align-items': 'center', gap: '8px' }}>
              <div style={{
                flex: '1', height: '3px', 'border-radius': '2px',
                background: 'rgba(255,255,255,0.06)', overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%', 'border-radius': '2px', background: 'var(--accent)',
                  width: `${a.status.contextMax > 0 ? Math.min(100, (a.status.contextUsed / a.status.contextMax) * 100) : 0}%`,
                }} />
              </div>
              <button
                style={{
                  padding: '2px 8px', 'border-radius': '3px',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  color: 'var(--text-muted)', 'font-size': '10px',
                  cursor: 'pointer', 'font-family': 'inherit',
                  'white-space': 'nowrap', 'flex-shrink': '0',
                }}
                onClick={() => a.send('agent.compact', {})}
              >
                压缩
              </button>
            </div>
          </div>

          {/* Cost Card */}
          <div
            style={{
              background: 'var(--card-bg)',
              'border-radius': '6px',
              padding: '10px 12px',
              display: 'flex',
              'flex-direction': 'column',
              gap: '6px',
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
  const [collapsedThinkings, setCollapsedThinkings] = createSignal<Set<string>>(new Set())
  let textareaRef: HTMLTextAreaElement | undefined
  let chatScrollRef: HTMLDivElement | undefined

  // 启动时自动创建 session（如果还没有）
  onMount(() => {
    if (agent.sessions().length === 0) {
      agent.createSession()
    }
  })

  // 消息变化 / 切换会话 → 滚到底部
  createEffect(() => {
    void agent.messages().length
    void agent.sessionId()
    if (chatScrollRef) {
      chatScrollRef.scrollTop = chatScrollRef.scrollHeight
    }
  })

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

  // 过滤掉纯工具调用的空气泡
  const messages = createMemo(() =>
    agent.messages().filter((m) => m.content || m.thinking || m.partial)
  )

  const toggleThinking = (msgId: string) => {
    setCollapsedThinkings((prev) => {
      const next = new Set(prev)
      if (next.has(msgId)) next.delete(msgId)
      else next.add(msgId)
      return next
    })
  }

  // 当前会话标题
  const sessionTitle = createMemo(() => {
    const s = agent.sessions().find((s) => s.id === agent.sessionId())
    return s?.title ?? '新会话'
  })

  // 当前角色名
  const agentName = createMemo(() => {
    const sessions = agent.sessions()
    const curSid = agent.sessionId()
    const curSession = sessions.find((s) => s.id === curSid)
    const agentList = agent.agents()
    const linked = curSession?.agentId
      ? agentList.find((a) => a.id === curSession.agentId)
      : undefined
    return linked?.name ?? agentList.find((a) => a.isDefault)?.name ?? agentList[0]?.name ?? '澪'
  })

  // 内容渲染 — HTML 直出，Markdown 走 marked
  marked.setOptions({ breaks: true, gfm: true })
  const mdCache = new Map<string, string>()
  const isFullDoc = (t: string) => /<!DOCTYPE\s+html/i.test(t)
  const isRawHtml = (t: string) => /<\s*(\w+|!|!--)/.test(t)
  const renderContent = (msgId: string, text: string) => {
    if (!text) return text
    const cached = mdCache.get(msgId)
    if (cached === text) {
      if (isFullDoc(text)) return mdCache.get(`r:${msgId}`) ?? text
      return mdCache.get(`r:${msgId}`) ?? ''
    }
    mdCache.set(msgId, text)
    let html: string
    if (isFullDoc(text)) {
      html = text  // iframe srcdoc 直接用原文
    } else if (isRawHtml(text)) {
      html = text
    } else {
      html = marked.parse(text) as string
    }
    mdCache.set(`r:${msgId}`, html)
    return html
  }

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
          {agentName()} · {sessionTitle()}
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
        ref={chatScrollRef}
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
                        {/* Thinking block — collapsible */}
                        <Show when={msg.thinking}>
                          <div
                            style={{
                              background: 'rgba(10,10,16,0.25)',
                              'border-radius': '6px',
                              padding: '6px 10px',
                              width: '100%',
                              'margin-bottom': '4px',
                              cursor: 'pointer',
                            }}
                            onClick={() => toggleThinking(msg.messageId)}
                          >
                            <div style={{ display: 'flex', 'align-items': 'center', gap: '6px' }}>
                              <span style={{ color: 'var(--text-muted)', display: 'flex' }}><Brain size={11} /></span>
                              <span style={{ 'font-size': '11px', color: 'var(--text-muted)', flex: '1' }}>
                                思考过程 {collapsedThinkings().has(msg.messageId) ? '(点击展开)' : '(点击收起)'}
                              </span>
                              <span style={{ 'font-size': '10px', color: 'var(--text-muted)' }}>
                                {collapsedThinkings().has(msg.messageId) ? '▶' : '▼'}
                              </span>
                            </div>
                            <Show when={!collapsedThinkings().has(msg.messageId)}>
                              <div style={{ 'font-size': '12px', color: 'var(--text-muted)', 'line-height': '1.5', 'margin-top': '4px' }}>
                                {msg.thinking}
                              </div>
                            </Show>
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
                          <div class="msg-content" style={{ 'font-size': '13px', 'line-height': '1.6', color: 'var(--text-primary)', 'user-select': 'text' }}>
                            <Show when={isFullDoc(msg.content)} fallback={
                              <span innerHTML={renderContent(msg.messageId, msg.content) || (msg.partial ? '...' : '')} />
                            }>
                              <iframe srcdoc={msg.content} style={{ width: '100%', height: '400px', border: 'none', background: '#050508', 'border-radius': '8px' }} sandbox="allow-scripts" />
                            </Show>
                          </div>
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
                          'user-select': 'text',
                        }}>
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

function EditorPanel() {
  const agent = useAgent()
  const [openFiles, setOpenFiles] = createSignal<OpenFile[]>([])
  const [activeIdx, setActiveIdx] = createSignal(0)
  const [panelW, setPanelW] = createSignal(340)
  let dragStartX = 0
  let dragStartW = 0

  // 订阅文件内容
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
    if (ext === 'html' || ext === 'htm') return f.content  // HTML 直出
    return marked.parse(f.content) as string
  })

  return (
    <div class="glass-panel" style={{ width: `${panelW()}px`, 'flex-shrink': '0', display: 'flex', 'flex-direction': 'column', 'z-index': '3', overflow: 'visible' }}>
      {/* Drag handle — left edge */}
      <div style={{ position: 'absolute', left: '-5px', top: '0', bottom: '0', width: '10px', cursor: 'col-resize', 'z-index': '10' }} onMouseDown={onDragStart} onDblClick={() => setPanelW(340)} />

      <Show when={panelW() > 0} fallback={
        <div onClick={() => setPanelW(340)} style={{ position: 'absolute', top: '45%', right: '-28px', 'writing-mode': 'vertical-lr', padding: '8px 6px', background: 'var(--glass-bg)', 'backdrop-filter': 'var(--glass-blur)', '-webkit-backdrop-filter': 'var(--glass-blur)', border: '1px solid rgba(255,255,255,0.10)', 'border-radius': '4px 4px 0 0', color: 'var(--text-secondary)', 'font-size': '11px', cursor: 'pointer', 'z-index': '99' }}>資料閲覧</div>
      }>
        <div class="bracket-tr"><div class="bracket-h" /><div class="bracket-v" /></div>

        {/* Editor Header */}
        <div style={{ display: 'flex', 'align-items': 'center', 'justify-content': 'space-between', padding: '12px 16px', height: '54px', background: 'var(--panel-bg-top)', 'border-bottom': '1px solid rgba(255,255,255,0.03)', 'flex-shrink': '0' }}>
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

        {/* Toolbar — file info + view toggle (md/html only) */}
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

// ===== 主入口 =====

export default function PencilMainView(props: { sidebarMode?: 'chat' | 'files' }) {
  const showFileTree = () => props.sidebarMode === 'files'

  return (
    <>
      <Show when={showFileTree()} fallback={<Sidebar />}>
        <div class="glass-panel" style={{ width: '320px', 'flex-shrink': '0', display: 'flex', 'flex-direction': 'column', 'z-index': '5' }}>
          <div style={{ display: 'flex', 'align-items': 'center', 'justify-content': 'space-between', padding: '12px 16px', height: '54px', background: 'var(--panel-bg-top)', 'border-bottom': '1px solid rgba(255,255,255,0.03)', 'flex-shrink': '0' }}>
            <div style={{ 'font-family': '"Noto Serif SC", serif', 'font-size': '14px', 'font-weight': '600', display: 'flex', 'align-items': 'center', gap: '6px' }}><FolderOpen size={14} /> 工作目录</div>
            <button style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', 'font-size': '11px' }} onClick={() => { window.dispatchEvent(new CustomEvent('mio:navigate', { detail: 'chat' })) }}>✕</button>
          </div>
          <div style={{ flex: '1', 'overflow-y': 'auto', padding: '8px 0' }}>
            <FileTree />
          </div>
        </div>
      </Show>
      <ChatPanel />
      <EditorPanel />
    </>
  )
}
