import { createSignal, For, Show, createMemo, createEffect } from 'solid-js'
import { useAgent } from '@/shell/useAgent'
import type { SessionInfo, AgentInfo } from '@bridge/protocol'
import { Search, CirclePause, BarChart3 } from 'lucide-solid'
import { kbdHandlers, toolDot, toolStatusText, timeStr, formatDuration, formatTokens } from '@/extensions/pencil-utils'
import type { ToolItem } from '@/extensions/pencil-utils'
import './sidebar.css'

export function Sidebar() {
  const a = useAgent()
  const [searchQuery, setSearchQuery] = createSignal('')
  const [expandedAgents, setExpandedAgents] = createSignal<string[]>(['default'])
  const [deleteTarget, setDeleteTarget] = createSignal<string | null>(null)

  const toggleExpand = (id: string) => {
    setExpandedAgents((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

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

  createEffect(() => {
    void a.toolCalls().length
    if (toolScrollRef) {
      toolScrollRef.scrollTop = toolScrollRef.scrollHeight
    }
  })

  return (
    <div
      class="glass-panel sidebar-panel"
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

      {/* Scroll Area */}
      <div style={{ flex: '1', display: 'flex', 'flex-direction': 'column', 'min-height': '0' }}>
        {/* Agent List */}
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
                  <div style={{ flex: '1', display: 'flex', 'flex-direction': 'column', gap: '1px', 'min-width': '0' }}>
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
                <Show when={isExpanded()}>
                  <div style={{ background: 'rgba(255,255,255,0.015)' }}>
                    <Show
                      when={agentSessions().length > 0}
                      fallback={
                        <div
                          style={{ padding: '10px 16px', 'font-size': '11px', color: 'var(--text-muted)', cursor: 'pointer' }}
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
                              background: s.id === a.sessionId() ? 'rgba(255,255,255,0.02)' : 'transparent',
                              'border-left': s.id === a.sessionId() ? '3px solid var(--text-muted)' : '3px solid transparent',
                            }}
                            {...kbdHandlers(() => a.switchSession(s.id))}
                            onClick={() => a.switchSession(s.id)}
                          >
                            <span style={{ 'font-size': '12px', color: 'var(--text-secondary)' }}>{s.title}</span>
                            <span style={{ 'font-size': '10px', color: 'var(--text-muted)', 'margin-left': 'auto', 'white-space': 'nowrap' }}>
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

        {/* Tool Log */}
        <div style={{ 'flex-shrink': '0', padding: '12px 16px 8px' }}>
          <div style={{ display: 'flex', 'align-items': 'center', 'justify-content': 'space-between', 'margin-bottom': '10px' }}>
            <span style={{ 'font-family': '"Noto Serif SC", serif', 'font-size': '12px', color: 'var(--text-muted)' }}>
              作戦記録
            </span>
            <Show when={a.isStreaming()}>
              <button
                onClick={() => a.cancelMessage()}
                title="中断当前操作"
                style={{
                  display: 'flex', 'align-items': 'center', gap: '4px', padding: '3px 10px',
                  'border-radius': '4px', background: 'rgba(239,68,68,0.12)',
                  border: '1px solid rgba(239,68,68,0.25)', color: '#EF4444',
                  'font-size': '11px', cursor: 'pointer', 'font-family': 'inherit',
                  animation: 'pulse 2s infinite',
                }}
              >
                <CirclePause size={12} />
              </button>
            </Show>
          </div>
          <div ref={toolScrollRef} style={{ display: 'flex', 'flex-direction': 'column', gap: '6px', 'max-height': '280px', 'overflow-y': 'auto' }}>
            <Show when={tools().length === 0}>
              <div style={{ 'font-size': '11px', color: 'var(--text-muted)', 'text-align': 'center', padding: '8px' }}>
                暂无工具执行记录
              </div>
            </Show>
            <For each={tools()}>
              {(tool) => (
                <div style={{ display: 'flex', 'align-items': 'center', gap: '8px', padding: '6px 8px', 'border-radius': '4px', cursor: 'pointer', transition: 'background 0.12s' }}>
                  <div style={{ width: '6px', height: '6px', 'border-radius': '50%', 'flex-shrink': '0',
                    background: tool.dot === 'ok' ? 'var(--success)' : tool.dot === 'err' ? 'var(--error)' : 'var(--warning)',
                  }} />
                  <span style={{ 'font-family': '"JetBrains Mono", monospace', 'font-size': '12px', 'font-weight': '600', color: 'var(--text-primary)' }}>{tool.name}</span>
                  <span style={{ 'font-size': '11px', 'margin-left': '4px',
                    color: tool.dot === 'ok' ? 'var(--success)' : tool.dot === 'err' ? 'var(--error)' : 'var(--warning)',
                  }}>{tool.status}</span>
                  <span style={{ 'font-size': '11px', color: 'var(--text-muted)' }}>{tool.desc}</span>
                  <span style={{ 'font-size': '10px', color: 'var(--text-muted)', 'margin-left': 'auto', 'font-variant-numeric': 'tabular-nums' }}>{tool.time}</span>
                </div>
              )}
            </For>
          </div>
        </div>
      </div>

      {/* Dashboard */}
      <div style={{ 'flex-shrink': '0', 'border-top': '1px solid rgba(255,255,255,0.03)' }}>
        <div style={{ padding: '10px 16px', display: 'flex', 'flex-direction': 'column', gap: '8px' }}>
          <div style={{ display: 'flex', 'align-items': 'center', 'justify-content': 'space-between' }}>
            <span style={{ 'font-family': '"Noto Serif SC", serif', 'font-size': '12px', color: 'var(--text-muted)' }}>資源監視</span>
            <span style={{ color: 'var(--text-muted)', display: 'flex' }}><BarChart3 size={12} /></span>
          </div>
          {/* Token Card */}
          <div style={{ background: 'var(--card-bg)', 'border-radius': '6px', padding: '10px 12px', display: 'flex', 'flex-direction': 'column', gap: '6px' }}>
            <div style={{ display: 'flex', 'justify-content': 'space-between', 'align-items': 'center' }}>
              <span style={{ 'font-size': '11px', color: 'var(--text-muted)' }}>上下文用量</span>
              <span style={{ 'font-size': '13px', color: 'var(--text-primary)', 'font-weight': '600' }}>
                {formatTokens(a.status.contextUsed)}
              </span>
            </div>
            <div style={{ display: 'flex', 'align-items': 'center', gap: '8px' }}>
              <div style={{ flex: '1', height: '3px', 'border-radius': '2px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                <div style={{ height: '100%', 'border-radius': '2px', background: 'var(--accent)',
                  width: `${a.status.contextMax > 0 ? Math.min(100, (a.status.contextUsed / a.status.contextMax) * 100) : 0}%`,
                }} />
              </div>
              <button style={{ padding: '2px 8px', 'border-radius': '3px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: 'var(--text-muted)', 'font-size': '10px', cursor: 'pointer', 'font-family': 'inherit', 'white-space': 'nowrap', 'flex-shrink': '0' }}
                onClick={() => a.send('agent.compact', {})}
              >压缩</button>
            </div>
          </div>
          {/* Cost Card */}
          <div style={{ background: 'var(--card-bg)', 'border-radius': '6px', padding: '10px 12px', display: 'flex', 'flex-direction': 'column', gap: '6px' }}>
            <div style={{ display: 'flex', 'justify-content': 'space-between', 'align-items': 'center' }}>
              <span style={{ 'font-size': '12px', color: 'var(--text-secondary)' }}>费用信息</span>
              <span style={{ 'font-size': '16px', color: 'var(--accent)', 'font-weight': '600' }}>
                ${a.status.cost.toFixed(2)}
              </span>
            </div>
            <div style={{ display: 'flex', 'justify-content': 'space-between', 'align-items': 'center' }}>
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
