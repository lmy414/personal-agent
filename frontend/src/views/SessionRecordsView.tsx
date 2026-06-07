import type { JSX } from 'solid-js'
import { createSignal, For } from 'solid-js'
import { useAgent } from '@/shell/useAgent'
import { MessageSquare, Search, Database, FileText, Bug, Palette, Zap, Plug, Brain } from 'lucide-solid'

function kbd(fn: () => void) { return { tabIndex: 0, role: 'button' as const, onKeyDown: (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn() } } } }

interface Session {
  icon: () => JSX.Element; title: string; meta: string; cost: string
}

const iconSize = 14
const sessionGroups: { date: string; sessions: Session[] }[] = [
  { date: '今天 · 6月7日', sessions: [
    { icon: () => <MessageSquare size={iconSize} />, title: '前端组件重构', meta: '3轮 · 15,200 tokens', cost: '$0.42' },
    { icon: () => <Plug size={iconSize} />, title: 'API 接口调试', meta: '5轮 · 9,920 tokens', cost: '$0.28' },
    { icon: () => <Search size={iconSize} />, title: '代码审查', meta: '4轮 · 25,100 tokens', cost: '$0.55' },
    { icon: () => <Database size={iconSize} />, title: '数据库架构设计', meta: '6轮 · 26,400 tokens', cost: '$0.78' },
  ]},
  { date: '6月6日 · 周四', sessions: [
    { icon: () => <FileText size={iconSize} />, title: 'README 撰写', meta: '1轮 · 3,600 tokens', cost: '$0.11' },
    { icon: () => <Bug size={iconSize} />, title: 'Bug 修复 #42', meta: '3轮 · 6,800 tokens', cost: '$0.24' },
  ]},
  { date: '更早', sessions: [
    { icon: () => <Palette size={iconSize} />, title: 'UI 布局调整', meta: '5轮 · 16,400 tokens', cost: '$0.92' },
    { icon: () => <Zap size={iconSize} />, title: '性能优化', meta: '3轮 · 18,200 tokens', cost: '$0.45' },
  ]},
]

const tabs = ['消息', '工具调用', '费用']
const toolLogs = [
  { name: 'file_read', desc: '读取文件 src/App.tsx', time: '14:32:15 · 142ms', dot: 'ok' },
  { name: 'code_search', desc: '搜索代码 useState', time: '14:32:03 · 89ms', dot: 'ok' },
  { name: 'file_edit', desc: '编辑代码 App.tsx L42-58', time: '14:31:52 · 1.2s', dot: 'ok' },
  { name: 'shell_exec', desc: '执行命令 npm run build', time: '14:31:28 · 8err', dot: 'warn' },
]

export default function SessionRecordsView() {
  const agent = useAgent()
  const [activeKey, setActiveKey] = createSignal('0-0')
  const [activeTab, setActiveTab] = createSignal(0)
  const allSessions = sessionGroups.flatMap((g) => g.sessions)
  const gIdx = () => Number(activeKey().split('-')[0])
  const sIdx = () => Number(activeKey().split('-')[1])
  const activeSession = () => sessionGroups[gIdx()]?.sessions[sIdx()] ?? allSessions[0]

  return (
    <div class="glass-panel-full" style={{ display: 'flex' }}>
      <div class="bracket-tr"><div class="bracket-h" /><div class="bracket-v" /></div>

      {/* Session List */}
      <div style={{ width: '360px', 'flex-shrink': '0', display: 'flex', 'flex-direction': 'column', 'border-right': '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ padding: '16px 20px', 'font-family': '"Noto Serif SC", serif', 'font-size': '15px', 'font-weight': '600', display: 'flex', 'justify-content': 'space-between' }}>
          <span>记录</span>
          <span style={{ 'font-size': '11px', color: 'var(--text-muted)', 'font-family': '"JetBrains Mono", monospace' }}>24 会话</span>
        </div>
        <div style={{ display: 'flex', 'align-items': 'center', gap: '8px', padding: '8px 16px', height: '40px', 'border-bottom': '1px solid rgba(255,255,255,0.03)' }}>
          <span style={{ display: 'flex', 'align-items': 'center', gap: '6px', 'font-size': '13px', color: 'var(--text-muted)' }}><Search size={14} /> 搜索会话记录...</span>
        </div>
        <div style={{ flex: '1', 'overflow-y': 'auto' }}>
          <For each={sessionGroups}>{(group, gi) => (
            <>
              <div style={{ padding: '8px 16px', 'font-size': '11px', color: 'var(--text-muted)', 'border-top': gi() > 0 ? '1px solid rgba(255,255,255,0.03)' : 'none' }}>{group.date}</div>
              <For each={group.sessions}>{(s, si) => {
                const key = `${gi()}-${si()}`
                return (
                  <div {...kbd(() => setActiveKey(key))} onClick={() => setActiveKey(key)} style={{ display: 'flex', 'align-items': 'center', gap: '10px', padding: '10px 16px', cursor: 'pointer', 'border-left': activeKey() === key ? '3px solid var(--accent)' : '3px solid transparent', background: activeKey() === key ? 'rgba(255,255,255,0.03)' : 'transparent', transition: 'background 0.12s' }}>
                    <div style={{ 'font-size': '14px', width: '20px', 'text-align': 'center', 'flex-shrink': '0', display: 'flex', 'align-items': 'center', 'justify-content': 'center' }}>{s.icon()}</div>
                    <div style={{ flex: '1', display: 'flex', 'flex-direction': 'column', gap: '2px', 'min-width': '0' }}>
                      <div style={{ 'font-size': '12px', color: 'var(--text-primary)', 'white-space': 'nowrap', overflow: 'hidden', 'text-overflow': 'ellipsis' }}>{s.title}</div>
                      <div style={{ 'font-size': '10px', color: 'var(--text-muted)' }}>{s.meta}</div>
                    </div>
                    <div style={{ 'font-family': '"JetBrains Mono", monospace', 'font-size': '11px', color: 'var(--accent)', 'flex-shrink': '0' }}>{s.cost}</div>
                  </div>
                )
              }}</For>
            </>
          )}</For>
        </div>
      </div>

      {/* Detail Panel */}
      <div style={{ flex: '1', display: 'flex', 'flex-direction': 'column', 'min-width': '0' }}>
        <div style={{ display: 'flex', 'align-items': 'center', 'justify-content': 'space-between', padding: '12px 24px', height: '54px', background: 'var(--panel-bg-top)', 'border-bottom': '1px solid rgba(255,255,255,0.03)', 'flex-shrink': '0' }}>
          <div style={{ display: 'flex', 'align-items': 'center', gap: '12px' }}>
            <span style={{ display: 'flex', 'align-items': 'center' }}>{activeSession()?.icon()}</span>
            <span style={{ 'font-family': '"Noto Serif SC", serif', 'font-size': '15px', 'font-weight': '600' }}>{activeSession()?.title}</span>
            <div style={{ display: 'flex', gap: '4px' }}>
              <For each={tabs}>{(tab, tIdx) => (
                <div onClick={() => setActiveTab(tIdx())} style={{ padding: '4px 12px', 'border-radius': '4px', 'font-size': '11px', cursor: 'pointer', color: activeTab() === tIdx() ? 'var(--text-primary)' : 'var(--text-muted)', background: activeTab() === tIdx() ? 'rgba(255,255,255,0.05)' : 'transparent', transition: 'all 0.15s' }}>{tab}</div>
              )}</For>
            </div>
          </div>
          <div style={{ 'font-size': '11px', color: 'var(--text-muted)', display: 'flex', gap: '12px' }}>
            <span>2025-06-07</span><span>3 轮</span><span>12,450 tokens</span><span>$0.42</span>
          </div>
        </div>
        <div class="divider" />

        <div style={{ flex: '1', 'overflow-y': 'auto', padding: '20px 24px' }}>
          {/* User msg */}
          <div style={{ display: 'flex', 'justify-content': 'flex-end', 'margin-bottom': '16px' }}>
            <div style={{ 'max-width': '80%' }}>
              <div style={{ padding: '10px 14px', 'border-radius': '8px', 'font-size': '13px', 'line-height': '1.6', background: 'rgba(20,20,30,0.50)' }}>帮我重构一下前端组件的状态管理</div>
              <div style={{ 'font-size': '10px', color: 'rgba(255,255,255,0.16)', 'text-align': 'right', 'margin-top': '2px' }}>241 tokens</div>
            </div>
          </div>
          {/* Assistant msg */}
          <div style={{ display: 'flex', gap: '12px', 'margin-bottom': '16px' }}>
            <div style={{ width: '28px', height: '28px', 'border-radius': '4px', display: 'flex', 'align-items': 'center', 'justify-content': 'center', 'font-size': '11px', 'font-weight': 'bold', 'flex-shrink': '0', background: 'rgba(255,255,255,0.04)', color: '#fff' }}>C</div>
            <div style={{ 'max-width': '85%' }}>
              <div style={{ background: 'rgba(10,10,16,0.25)', 'border-radius': '6px', padding: '8px 12px', 'margin-bottom': '8px' }}>
                <div style={{ display: 'flex', 'align-items': 'center', gap: '4px', 'font-size': '11px', color: 'var(--text-muted)' }}><Brain size={11} /> 思考过程 · 1.2s</div>
                <div style={{ 'font-size': '12px', color: 'var(--text-muted)', 'margin-top': '4px', 'line-height': '1.5' }}>好的，我先分析一下当前的组件结构，然后提出重构方案。</div>
              </div>
              <div style={{ padding: '10px 14px', 'border-radius': '8px', 'font-size': '13px', 'line-height': '1.6', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.04)' }}>好的，我来分析一下当前组件的状态管理情况。</div>
              <div style={{ 'font-size': '10px', color: 'rgba(255,255,255,0.16)', 'text-align': 'right', 'margin-top': '2px' }}>1.2k tokens</div>
            </div>
          </div>

          {/* Tool Log */}
          <div style={{ 'border-top': '1px solid rgba(255,255,255,0.04)', 'padding-top': '12px', 'margin-top': '16px' }}>
            <div style={{ 'font-size': '11px', color: 'var(--text-muted)', 'margin-bottom': '8px' }}>工具调用日志</div>
            <For each={toolLogs}>{(log) => (
              <div style={{ display: 'flex', 'align-items': 'center', gap: '8px', padding: '6px 0', 'font-size': '12px' }}>
                <div style={{ width: '6px', height: '6px', 'border-radius': '50%', 'flex-shrink': '0', background: log.dot === 'ok' ? 'var(--success)' : 'var(--warning)' }} />
                <span style={{ 'font-family': '"JetBrains Mono", monospace', 'font-weight': '500' }}>{log.name}</span>
                <span style={{ color: 'var(--text-muted)', 'font-size': '11px' }}>{log.desc}</span>
                <span style={{ 'margin-left': 'auto', 'font-size': '10px', color: 'var(--text-muted)', 'font-family': '"JetBrains Mono", monospace' }}>{log.time}</span>
              </div>
            )}</For>
          </div>
        </div>
      </div>
    </div>
  )
}
