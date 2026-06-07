import { For } from 'solid-js'
import { useAgent } from '@/shell/useAgent'

const metrics = [
  { label: '総費用', value: '$48.25', trend: '+12%', up: true, sub: '全期間累計' },
  { label: '本月費用', value: '$12.80', trend: '+8%', up: true, sub: '2026年6月' },
  { label: '総会話数', value: '247', trend: '+24', up: true, sub: '通算セッション' },
  { label: '平均単価', value: '$0.19', trend: '-3%', up: false, sub: '1セッション当たり' },
]

const stats = [
  { label: '日均 Token', value: '28,450', sub: '前月比 +12%' },
  { label: '日均費用', value: '$0.43', sub: '前月比 +8%' },
  { label: '日均会話', value: '8.2', sub: '前月比 +3' },
  { label: '最安日', value: '6/3', sub: '$0.21 · 火曜日' },
  { label: '最高日', value: '6/7', sub: '$0.88 · 土曜日' },
]

const dailyBars = [
  { label: '6/1', h: '55%' }, { label: '6/2', h: '78%' },
  { label: '6/3', h: '42%' }, { label: '6/4', h: '88%' },
  { label: '6/5', h: '65%' }, { label: '6/6', h: '50%' },
  { label: '6/7', h: '92%' },
]

const sessions = [
  { name: '前端组件重构', meta: '6/7 14:32 · 12,450 tokens', cost: '$0.42' },
  { name: 'API 接口调试', meta: '6/7 10:15 · 8,920 tokens', cost: '$0.28' },
  { name: 'コードレビュー', meta: '6/6 16:42 · 15,200 tokens', cost: '$0.55' },
  { name: 'DB スキーマ設計', meta: '6/5 09:18 · 22,100 tokens', cost: '$0.78' },
  { name: 'README 執筆', meta: '6/4 11:05 · 3,600 tokens', cost: '$0.11' },
  { name: 'バグ修正 #42', meta: '6/3 14:20 · 7,800 tokens', cost: '$0.24' },
]

const monthlyBars = [
  { label: '1月', h: '35%', cost: '$4.20' }, { label: '2月', h: '55%', cost: '$6.80' },
  { label: '3月', h: '42%', cost: '$5.30' }, { label: '4月', h: '68%', cost: '$8.40' },
  { label: '5月', h: '58%', cost: '$7.10' }, { label: '6月', h: '78%', cost: '$12.80' },
]

const modelBars = [
  { label: 'Claude Opus 4.6', pct: '42%', w: '42%', cost: '$20.27' },
  { label: 'Claude Sonnet 4.6', pct: '28%', w: '28%', cost: '$13.51' },
  { label: 'DeepSeek V4', pct: '18%', w: '18%', cost: '$8.69' },
  { label: 'GPT-4o', pct: '12%', w: '12%', cost: '$5.79' },
]

const insights = [
  { icon: '📊', text: 'Claude Opus 占总费用的 42%，为最高消费模型', color: 'var(--text-primary)' },
  { icon: '📈', text: '本月费用较上月增长 34%，Token 使用量上升', color: 'var(--warning)' },
  { icon: '💡', text: '建议：对重复查询启用缓存可节省约 15% 费用', color: 'var(--accent)' },
]

const trendPts = dailyBars.map((b, i) => `${12 + i * 14},${100 - parseInt(b.h)}`).join(' ')

export default function CostDashboardView() {
  const agent = useAgent()

  return (
    <div class="glass-panel-full" style={{ display: 'flex', 'flex-direction': 'column' }}>
      <div class="bracket-tr"><div class="bracket-h" /><div class="bracket-v" /></div>

      {/* Header */}
      <div style={hdrStyle}>
        <div style={titleStyle}>費用管理</div>
        <div style={{ display: 'flex', 'align-items': 'center', gap: '16px', 'font-size': '11px', color: 'var(--text-muted)', cursor: 'pointer' }}>
          <span>最近 30 天</span><span>刷新数据</span>
        </div>
      </div>
      <div class="divider" />

      <div style={{ flex: '1', 'overflow-y': 'auto', 'min-height': '0' }}>
        {/* Metric Cards */}
        <div style={{ display: 'flex', gap: '16px', padding: '20px 24px' }}>
          <For each={metrics}>{(m) => (
            <div style={cardStyle}>
              <div style={{ 'font-size': '11px', color: 'var(--text-muted)' }}>{m.label}</div>
              <div style={{ display: 'flex', 'align-items': 'flex-end', gap: '10px' }}>
                <div style={{ 'font-family': '"JetBrains Mono", monospace', 'font-size': '24px', 'font-weight': '600', color: 'var(--text-primary)' }}>{m.value}</div>
                <div style={{ 'font-size': '12px', 'font-weight': '600', 'margin-bottom': '4px', color: m.up ? 'var(--success)' : 'var(--error)' }}>{m.trend}</div>
              </div>
              <div style={{ 'font-size': '10px', color: 'var(--text-muted)' }}>{m.sub}</div>
            </div>
          )}</For>
        </div>

        {/* Daily Stats */}
        <div style={{ display: 'flex', gap: '16px', padding: '8px 24px' }}>
          <For each={stats}>{(s) => (
            <div style={{ ...cardStyle, padding: '8px 16px', gap: '4px' }}>
              <div style={{ 'font-size': '10px', color: 'var(--text-muted)' }}>{s.label}</div>
              <div style={{ 'font-family': '"JetBrains Mono", monospace', 'font-size': '18px', 'font-weight': '600', color: 'var(--text-primary)' }}>{s.value}</div>
              <div style={{ 'font-family': '"JetBrains Mono", monospace', 'font-size': '9px', color: 'var(--text-muted)' }}>{s.sub}</div>
            </div>
          )}</For>
        </div>

        {/* Charts Row — Token Usage + Session Cost */}
        <div style={{ display: 'flex', gap: '16px', padding: '16px 24px 12px', height: '320px' }}>
          {/* Token Usage Chart */}
          <div style={{ ...cardStyle, flex: '1', padding: '16px', gap: '12px', display: 'flex', 'flex-direction': 'column' }}>
            <div style={{ display: 'flex', 'align-items': 'center', 'justify-content': 'space-between' }}>
              <div style={secTitleStyle}>Token 使用量推移</div>
              <div style={{ 'font-size': '10px', color: 'var(--text-muted)' }}>単位: 千 tokens</div>
            </div>
            <div style={{ flex: '1', display: 'flex', 'align-items': 'flex-end', gap: '12px', position: 'relative', 'padding-bottom': '24px' }}>
              <For each={dailyBars}>{(b) => (
                <div style={{ flex: '1', display: 'flex', 'flex-direction': 'column', 'align-items': 'center', 'justify-content': 'flex-end', gap: '6px', height: '100%' }}>
                  <div style={{ width: '100%', background: 'rgba(107,143,168,0.35)', 'border-radius': '3px 3px 0 0', height: b.h, 'min-width': '24px' }} />
                  <div style={{ 'font-size': '10px', color: 'var(--text-muted)', 'font-family': '"JetBrains Mono", monospace' }}>{b.label}</div>
                </div>
              )}</For>
              <svg style={{ position: 'absolute', top: '0', left: '0', right: '0', bottom: '24px', 'pointer-events': 'none' }} viewBox="0 0 100 100" preserveAspectRatio="none">
                <polyline points={trendPts} fill="none" stroke="rgba(91,140,90,0.6)" stroke-width="1.5" />
              </svg>
            </div>
          </div>

          {/* Session Breakdown */}
          <div style={{ ...cardStyle, flex: '1', padding: '0', display: 'flex', 'flex-direction': 'column' }}>
            <div style={{ display: 'flex', 'align-items': 'center', 'justify-content': 'space-between', padding: '12px 16px', 'border-bottom': '1px solid rgba(255,255,255,0.04)' }}>
              <div style={secTitleStyle}>セッション別費用</div>
              <div style={{ 'font-size': '10px', color: 'var(--text-muted)' }}>直近 6 件</div>
            </div>
            <div style={{ flex: '1', 'overflow-y': 'auto' }}>
              <For each={sessions}>{(s, i) => (
                <>
                  <div style={{ display: 'flex', 'align-items': 'center', 'justify-content': 'space-between', padding: '10px 16px' }}>
                    <div style={{ display: 'flex', 'flex-direction': 'column', gap: '2px' }}>
                      <div style={{ 'font-size': '12px', color: 'var(--text-secondary)' }}>{s.name}</div>
                      <div style={{ 'font-size': '10px', color: 'var(--text-muted)', 'font-family': '"JetBrains Mono", monospace' }}>{s.meta}</div>
                    </div>
                    <div style={{ 'font-family': '"JetBrains Mono", monospace', 'font-size': '14px', 'font-weight': '600', color: 'var(--accent)' }}>{s.cost}</div>
                  </div>
                  {i() < sessions.length - 1 && <div class="divider" />}
                </>
              )}</For>
            </div>
          </div>
        </div>

        {/* Monthly + Model Bars */}
        <div style={{ display: 'flex', gap: '16px', padding: '16px 24px 12px', height: '300px' }}>
          {/* Monthly Chart */}
          <div style={{ ...cardStyle, flex: '1', padding: '16px', gap: '12px', display: 'flex', 'flex-direction': 'column' }}>
            <div style={{ display: 'flex', 'align-items': 'center', 'justify-content': 'space-between' }}>
              <div style={secTitleStyle}>月別費用推移</div>
              <div style={{ 'font-size': '10px', color: 'var(--text-muted)' }}>2026</div>
            </div>
            <div style={{ flex: '1', display: 'flex', 'align-items': 'flex-end', gap: '12px' }}>
              <For each={monthlyBars}>{(b) => (
                <div style={{ flex: '1', display: 'flex', 'flex-direction': 'column', 'align-items': 'center', 'justify-content': 'flex-end', gap: '4px', height: '100%' }}>
                  <div style={{ width: '100%', background: 'rgba(107,143,168,0.35)', 'border-radius': '3px 3px 0 0', height: b.h, 'min-width': '24px' }} />
                  <div style={{ 'font-size': '10px', color: 'var(--text-muted)', 'font-family': '"JetBrains Mono", monospace' }}>{b.label}</div>
                  <div style={{ 'font-size': '9px', color: 'var(--text-muted)', 'font-family': '"JetBrains Mono", monospace', 'margin-top': '2px' }}>{b.cost}</div>
                </div>
              )}</For>
            </div>
          </div>

          {/* Model Breakdown */}
          <div style={{ ...cardStyle, flex: '1', padding: '0', display: 'flex', 'flex-direction': 'column' }}>
            <div style={{ display: 'flex', 'align-items': 'center', 'justify-content': 'space-between', padding: '12px 16px', 'border-bottom': '1px solid rgba(255,255,255,0.04)' }}>
              <div style={secTitleStyle}>モデル別費用</div>
            </div>
            <div style={{ flex: '1', 'overflow-y': 'auto', padding: '0 16px' }}>
              <For each={modelBars}>{(m, i) => (
                <>
                  <div style={{ display: 'flex', 'align-items': 'center', gap: '12px', padding: '10px 0' }}>
                    <div style={{ flex: '1', height: '16px', background: 'rgba(255,255,255,0.03)', 'border-radius': '3px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', background: 'rgba(107,143,168,0.35)', 'border-radius': '3px', width: m.w }} />
                    </div>
                    <div style={{ 'font-family': '"JetBrains Mono", monospace', 'font-size': '12px', 'font-weight': '600', color: 'var(--text-secondary)', width: '36px', 'text-align': 'right' }}>{m.pct}</div>
                    <div style={{ 'font-family': '"JetBrains Mono", monospace', 'font-size': '13px', 'font-weight': '600', color: 'var(--text-primary)', width: '52px', 'text-align': 'right' }}>{m.cost}</div>
                  </div>
                  {i() < modelBars.length - 1 && <div class="divider" />}
                </>
              )}</For>
            </div>
          </div>
        </div>

        {/* Insights */}
        <div style={{ display: 'flex', gap: '16px', padding: '16px 24px' }}>
          <For each={insights}>{(ins) => (
            <div style={{ ...cardStyle, flex: '1', padding: '12px 16px', display: 'flex', 'align-items': 'center', gap: '10px' }}>
              <div style={{ 'font-size': '16px' }}>{ins.icon}</div>
              <div style={{ 'font-size': '12px', 'line-height': '1.5', flex: '1', color: ins.color }}>{ins.text}</div>
            </div>
          )}</For>
        </div>
      </div>

      {/* Bottom Bar */}
      <div style={{ display: 'flex', 'align-items': 'center', 'justify-content': 'space-between', padding: '0 24px', height: '36px', background: 'var(--panel-bg-top)', 'border-top': '1px solid rgba(255,255,255,0.03)', 'flex-shrink': '0' }}>
        <span style={{ 'font-family': '"JetBrains Mono", monospace', 'font-size': '10px', color: 'var(--text-muted)' }}>最終更新: 2026-06-07 14:32:15</span>
        <span style={{ display: 'flex', 'align-items': 'center', gap: '16px', 'font-family': '"JetBrains Mono", monospace', 'font-size': '10px', color: 'var(--text-muted)' }}>
          <span>API: DeepSeek V4 · Claude Opus 4.6 · GPT-4o</span>
          <span style={{ 'font-family': '"Inter", sans-serif', 'font-weight': '500', color: 'var(--success)' }}>● 稼働中</span>
        </span>
      </div>
    </div>
  )
}

const hdrStyle: Record<string, string> = { display: 'flex', 'align-items': 'center', 'justify-content': 'space-between', padding: '12px 24px', height: '60px', background: 'var(--panel-bg-top)', 'border-bottom': '1px solid rgba(255,255,255,0.03)', 'flex-shrink': '0' }
const titleStyle: Record<string, string> = { 'font-family': '"Noto Serif SC", serif', 'font-size': '16px', 'font-weight': '600', color: '#fff' }
const secTitleStyle: Record<string, string> = { 'font-family': '"Noto Serif SC", serif', 'font-size': '14px', 'font-weight': '600', color: 'var(--text-primary)' }
const cardStyle: Record<string, string> = { flex: '1', background: 'var(--card-bg)', border: '1px solid rgba(255,255,255,0.025)', 'border-radius': '6px', padding: '16px', display: 'flex', 'flex-direction': 'column', gap: '6px', overflow: 'hidden' }
