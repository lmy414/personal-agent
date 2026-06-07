import { createSignal, For, Show, createMemo, onMount, onCleanup, createEffect } from 'solid-js'
import { useAgent, type MessageEntry } from '@/shell/useAgent'
import { Brain, Paperclip } from 'lucide-solid'
import { marked } from 'marked'
import { INPUT_TAGS } from '@/extensions/pencil-utils'
import './chat-panel.css'

export function ChatPanel() {
  const agent = useAgent()
  const [inputValue, setInputValue] = createSignal('')
  const [collapsedThinkings, setCollapsedThinkings] = createSignal<Set<string>>(new Set())
  let textareaRef: HTMLTextAreaElement | undefined
  let chatScrollRef: HTMLDivElement | undefined

  // Auto-create session
  onMount(() => {
    const tid = setInterval(() => {
      if (agent.connected() && agent.sessions().length === 0) {
        agent.createSession()
        clearInterval(tid)
      }
    }, 500)
    onCleanup(() => clearInterval(tid))
  })

  // Scroll to bottom on message/session change
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

  const sessionTitle = createMemo(() => {
    const s = agent.sessions().find((s) => s.id === agent.sessionId())
    return s?.title ?? '新会话'
  })

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

  // Content rendering
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
      html = text
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
      class="glass-panel chat-panel"
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
        <div style={{ 'font-family': '"Noto Serif SC", serif', 'font-size': '17px', 'font-weight': '600', color: '#fff' }}>
          {agentName()} · {sessionTitle()}
        </div>
        <div style={{ display: 'flex', 'align-items': 'center', gap: '8px', 'font-size': '11px', color: 'var(--text-muted)' }}>
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
        style={{ flex: '1', 'overflow-y': 'auto', padding: '20px 24px', display: 'flex', 'flex-direction': 'column', gap: '20px', 'min-height': '0' }}
      >
        <Show
          when={messages().length > 0}
          fallback={
            <div style={{ flex: '1', display: 'flex', 'align-items': 'center', 'justify-content': 'center', color: 'var(--text-muted)', 'font-size': '13px' }}>
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
                    <div style={{ display: 'flex', gap: '12px', width: '100%', 'justify-content': 'flex-start' }}>
                      <div style={{ width: '32px', height: '32px', 'border-radius': '4px', display: 'flex', 'align-items': 'center', 'justify-content': 'center', 'font-family': '"JetBrains Mono", monospace', 'font-size': '12px', 'font-weight': 'bold', color: '#fff', 'flex-shrink': '0', background: 'rgba(255,255,255,0.04)' }}>A</div>
                      <div style={{ display: 'flex', 'flex-direction': 'column', gap: '2px', 'max-width': '100%', flex: '1' }}>
                        {/* Thinking block */}
                        <Show when={msg.thinking}>
                          <div style={{ background: 'rgba(10,10,16,0.25)', 'border-radius': '6px', padding: '6px 10px', width: '100%', 'margin-bottom': '4px', cursor: 'pointer' }}
                            onClick={() => toggleThinking(msg.messageId)}>
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
                              <div style={{ 'font-size': '12px', color: 'var(--text-muted)', 'line-height': '1.5', 'margin-top': '4px' }}>{msg.thinking}</div>
                            </Show>
                          </div>
                        </Show>
                        {/* Bubble */}
                        <div style={{ 'border-radius': '8px', padding: '12px 16px', 'font-size': '13px', 'line-height': '1.6', color: 'var(--text-primary)', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.04)' }}>
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
                  <div style={{ display: 'flex', gap: '12px', width: '100%', 'justify-content': 'flex-end' }}>
                    <div style={{ display: 'flex', 'flex-direction': 'column', gap: '2px', 'max-width': '80%', 'align-items': 'flex-end' }}>
                      <div style={{ 'border-radius': '8px', padding: '12px 16px', 'font-size': '13px', 'line-height': '1.6', color: 'var(--text-primary)', background: 'rgba(20,20,30,0.50)', 'user-select': 'text' }}>
                        {msg.content}
                      </div>
                    </div>
                    <div style={{ width: '32px', height: '32px', 'border-radius': '4px', display: 'flex', 'align-items': 'center', 'justify-content': 'center', 'font-family': '"JetBrains Mono", monospace', 'font-size': '12px', 'font-weight': 'bold', color: '#fff', 'flex-shrink': '0', background: 'rgba(255,255,255,0.03)' }}>我</div>
                  </div>
                </Show>
              </>
            )}
          </For>
        </Show>
      </div>

      {/* Input Area */}
      <div style={{ 'border-top': '1px solid rgba(255,255,255,0.03)', padding: '16px 24px 12px', display: 'flex', 'flex-direction': 'column', gap: '12px', 'flex-shrink': '0' }}>
        <div style={{ display: 'flex', 'align-items': 'center', gap: '12px' }}>
          <button style={{ width: '36px', height: '36px', 'border-radius': '4px', background: 'rgba(255,255,255,0.03)', border: 'none', color: 'var(--text-muted)', 'font-size': '16px', cursor: 'pointer', display: 'flex', 'align-items': 'center', 'justify-content': 'center', 'flex-shrink': '0' }}>
            <Paperclip size={16} />
          </button>
          <textarea
            ref={textareaRef}
            placeholder="输入消息..."
            rows="1"
            value={inputValue()}
            onInput={(e) => setInputValue(e.currentTarget.value)}
            onKeyDown={handleKeyDown}
            style={{ flex: '1', 'min-height': '44px', 'max-height': '120px', background: 'rgba(0,0,0,0.40)', border: '1px solid transparent', 'border-radius': '4px', padding: '12px 16px', color: 'var(--text-primary)', 'font-size': '13px', 'font-family': 'inherit', 'line-height': '1.5', resize: 'none', outline: 'none' }}
          />
          <button style={{ padding: '12px 20px', 'border-radius': '4px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.06)', color: 'var(--text-secondary)', 'font-size': '13px', cursor: 'pointer', display: 'flex', 'align-items': 'center', gap: '4px', 'flex-shrink': '0' }}
            onClick={handleSend}>
            发送 ↑
          </button>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <For each={INPUT_TAGS}>
            {(tag) => (
              <span style={{ padding: '4px 12px', 'border-radius': '4px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.04)', color: 'var(--text-muted)', 'font-size': '11px', cursor: 'pointer', transition: 'all 0.15s' }}>
                {tag}
              </span>
            )}
          </For>
        </div>
        <div style={{ width: '100%', height: '1px', background: 'rgba(255,255,255,0.06)', opacity: '0.5', 'margin-top': '4px' }} />
      </div>
    </div>
  )
}
