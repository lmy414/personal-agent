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

function summarizeInput(toolName: string, input: Record<string, unknown>): string {
  if (!input || Object.keys(input).length === 0) return '...'
  // P2-04: 提取最有意义的参数摘要，而非 JSON 截断
  const firstKey = Object.keys(input)[0]
  const firstVal = input[firstKey]
  if (typeof firstVal === 'string' && firstVal.length <= 40) return `${firstKey}: ${firstVal}`
  if (typeof firstVal === 'string') return `${firstKey}: ${firstVal.slice(0, 37)}...`
  return `${toolName}(${Object.keys(input).join(', ')})`
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
        <div class="tool-detail">{summarizeInput(props.tool.toolName, props.tool.input)}</div>
      </div>
      <span class={`tool-status ${statusClass()}`}>{statusText()}</span>
      <div class="tool-detail-body">
        <span class="detail-label">→ 输入:</span>
        {JSON.stringify(props.tool.input, null, 2).slice(0, 500)}
        {'\n\n'}
        <span class="detail-label">→ 输出:</span>
        {props.tool.output || (props.tool.status === 'running' ? '执行中...' : '(无输出)')}
      </div>
    </div>
  )
}

export function ToolPanel() {
  const { toolCalls, isStreaming, cancelMessage } = useAgent()
  const [cancelled, setCancelled] = createSignal(false)
  const hasRunning = () => toolCalls().some((t: ToolCallEntry) => t.status === 'running')
  const canCancel = () => isStreaming() || hasRunning()

  const handleCancel = () => {
    cancelMessage()
    setCancelled(true)
    setTimeout(() => setCancelled(false), 2100)
  }

  return (
    <div class="glass-panel tool-panel">
      <div class="tool-panel-header">
        <span class="indicator" classList={{ idle: !hasRunning() }} />
        工具执行
        <span class="tool-count">{toolCalls().length} 条记录</span>
        <Show when={canCancel()}>
          <button class="cancel-btn" onClick={handleCancel} title="中断AI输出">
            ⏹ 中断
          </button>
        </Show>
        <Show when={cancelled()}>
          <span class="cancel-toast">已中断，可继续对话</span>
        </Show>
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
