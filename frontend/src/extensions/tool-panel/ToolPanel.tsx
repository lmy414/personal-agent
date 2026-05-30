import { createSignal, For, Show } from 'solid-js'
import { useAgent } from '@/shell/useAgent'
import type { ToolCallEntry } from '@/shell/useAgent'

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

const ICON_MAP: Record<string, string> = {
  read: '📖',
  write: '✏',
  edit: '✏',
  grep: '🔍',
  bash: '⚙',
  find: '🔍',
  ls: '📂',
}

function ToolEntry(props: { tool: ToolCallEntry }) {
  const [expanded, setExpanded] = createSignal(false)

  const statusClass = () => {
    if (props.tool.status === 'running') return 'running'
    if (props.tool.status === 'error') return 'error'
    return 'ok'
  }

  const statusText = () => {
    if (props.tool.status === 'running') return '执行中'
    if (props.tool.status === 'error') return '失败'
    return `✓ ${formatDuration(props.tool.duration)}`
  }

  return (
    <div
      class="tool-entry"
      classList={{
        running: props.tool.status === 'running',
        expanded: expanded(),
      }}
      onClick={() => setExpanded(!expanded())}
    >
      <div class="tool-icon">{ICON_MAP[props.tool.toolName] ?? '🔧'}</div>
      <div class="tool-info">
        <div class="tool-name">{props.tool.toolName}</div>
        <div class="tool-detail">{props.tool.input ? JSON.stringify(props.tool.input).slice(0, 60) : '...'}</div>
      </div>
      <span class={`tool-status ${statusClass()}`}>{statusText()}</span>
      <div class="tool-detail-body">
        <span class="detail-label">→ 输出:</span>
        {props.tool.output || (props.tool.status === 'running' ? '执行中...' : '(无输出)')}
      </div>
    </div>
  )
}

export function ToolPanel() {
  const { toolCalls } = useAgent()
  const hasRunning = () => toolCalls().some((t: ToolCallEntry) => t.status === 'running')

  return (
    <div class="glass-panel tool-panel" style="height:100%">
      <div class="tool-panel-header">
        <span class="indicator" classList={{ idle: !hasRunning() }} />
        工具执行
        <span class="tool-count">{toolCalls().length} 条记录</span>
      </div>
      <div class="tool-list">
        <Show
          when={toolCalls().length > 0}
          fallback={
            <div style="text-align:center;color:var(--text-muted);font-size:12px;margin-top:24px;">
              暂无工具调用
            </div>
          }
        >
          <For each={toolCalls()}>
            {(tool) => <ToolEntry tool={tool} />}
          </For>
        </Show>
      </div>
    </div>
  )
}
