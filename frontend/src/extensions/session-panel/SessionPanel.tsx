import { createSignal, For, Show } from 'solid-js'
import { useAgent } from '@/shell/useAgent'
import './session-panel.css'

export function SessionPanel() {
  const agent = useAgent()
  const [expanded, setExpanded] = createSignal(true)
  const [searchQuery, setSearchQuery] = createSignal('')
  const [deleteTarget, setDeleteTarget] = createSignal<string | null>(null)

  const getS = (key: string) => agent.settings().find((e) => e.key === key)?.value ?? ''
  const avatarName = () => getS('avatar_name') || '澪'
  const mainSession = () => agent.sessions().find((s) => s.title === '澪')
  const subSessions = () => {
    const q = searchQuery().toLowerCase()
    return agent.sessions().filter((s) => {
      if (s.title === '澪') return false
      if (!q) return true
      return s.title.toLowerCase().includes(q) || s.id.includes(q)
    })
  }

  const handleDelete = (sid: string) => {
    if (deleteTarget() === sid) {
      agent.send('session.delete', { sessionId: sid })
      setDeleteTarget(null)
    } else {
      setDeleteTarget(sid)
    }
  }

  return (
    <div class="glass-panel session-panel" classList={{ expanded: expanded() }}>
      {/* 主会话头部 — 始终可见，点击进入澪 */}
      <div
        class="session-header"
        onClick={() => {
          const m = mainSession()
          if (m) agent.switchSession(m.id)
        }}
        style={{ cursor: 'pointer' }}
      >
        <div class="avatar">{avatarName()[0] || '?'}</div>
        <div class="meta">
          <div class="title">{avatarName()}</div>
          <div class="time">
            最后活跃{' '}
            {new Date(mainSession()?.lastActive ?? 0).toLocaleTimeString('zh-CN', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </div>
        </div>
        <Show when={agent.isStreaming() && mainSession()?.id === agent.sessionId()}>
          <div class="praying-indicator" onClick={(e) => e.stopPropagation()}>
            <span class="praying-dot" />
            <span class="praying-text">少女祈祷中</span>
          </div>
        </Show>
      </div>

      {/* 操作栏：新建 + 搜索 + 折叠箭头 */}
      <div
        class="sub-toolbar"
        style={{
          display: 'flex',
          'align-items': 'center',
          gap: '8px',
          padding: '0 16px',
          'flex-shrink': '0',
        }}
      >
        <button
          onClick={(e) => {
            e.stopPropagation()
            agent.createSession()
          }}
          style={{
            background: 'rgba(139,156,240,0.12)',
            border: 'none',
            color: 'var(--accent)',
            cursor: 'pointer',
            'border-radius': '6px',
            padding: '4px 8px',
            'font-size': '13px',
          }}
          title="新建会话"
        >
          +
        </button>
        <input
          class="sub-search"
          type="text"
          placeholder="搜索会话..."
          value={searchQuery()}
          onInput={(e) => setSearchQuery(e.currentTarget.value)}
          style={{ flex: '1' }}
        />
        <span
          class="expand-arrow"
          onClick={(e) => {
            e.stopPropagation()
            setExpanded(!expanded())
          }}
          style={{
            cursor: 'pointer',
            'font-size': '10px',
            color: 'var(--text-secondary)',
            'flex-shrink': '0',
          }}
        >
          {expanded() ? '▼' : '▶'}
        </span>
      </div>

      {/* 子会话列表 — 可折叠 */}
      <Show when={expanded()}>
        <div class="sub-sessions">
          <div class="sub-list">
            <For each={subSessions()}>
              {(s) => (
                <div
                  class="sub-item"
                  classList={{ active: s.id === agent.sessionId() }}
                  onClick={() => agent.switchSession(s.id)}
                  onMouseEnter={(e) => {
                    if (deleteTarget() !== s.id) {
                      const el = e.currentTarget.querySelector('.del-btn') as HTMLElement | null
                      if (el) el.style.opacity = '1'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (deleteTarget() !== s.id) {
                      const el = e.currentTarget.querySelector('.del-btn') as HTMLElement | null
                      if (el) el.style.opacity = '0'
                    }
                  }}
                >
                  <Show
                    when={deleteTarget() === s.id}
                    fallback={
                      <>
                        <span class="dot" />
                        <span class="sub-title">{s.title}</span>
                        <span class="sub-time">{s.roundCount}轮</span>
                        <span
                          class="del-btn"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDelete(s.id)
                          }}
                          style={{
                            'margin-left': 'auto',
                            cursor: 'pointer',
                            opacity: '0',
                            transition: 'opacity 0.15s',
                            color: 'var(--text-muted)',
                            'font-size': '14px',
                            'flex-shrink': '0',
                          }}
                        >
                          ×
                        </span>
                      </>
                    }
                  >
                    <span class="dot" style={{ color: '#f87171' }}>!</span>
                    <span
                      onClick={(e) => {
                        e.stopPropagation()
                        setDeleteTarget(null)
                      }}
                      style={{
                        cursor: 'pointer',
                        'font-size': '12px',
                        color: 'var(--text-secondary)',
                        padding: '2px 8px',
                        'border-radius': '4px',
                        background: 'rgba(255,255,255,0.06)',
                        'flex-shrink': '0',
                      }}
                    >
                      取消
                    </span>
                    <span
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(s.id)
                      }}
                      style={{
                        cursor: 'pointer',
                        'font-size': '12px',
                        color: '#f87171',
                        padding: '2px 10px',
                        'border-radius': '4px',
                        background: 'rgba(248,113,113,0.15)',
                        'font-weight': '500',
                        'flex-shrink': '0',
                      }}
                    >
                      确认删除
                    </span>
                  </Show>
                </div>
              )}
            </For>
            <Show when={subSessions().length === 0}>
              <div class="sub-item" style={{ color: 'var(--text-muted)', cursor: 'default' }}>
                <span class="sub-title" style="color:var(--text-muted)">
                  {searchQuery() ? '无匹配会话' : '暂无子会话，点击 + 创建'}
                </span>
              </div>
            </Show>
          </div>
        </div>
      </Show>
    </div>
  )
}
