import { createSignal, For, Show } from 'solid-js'
import { useAgent } from '@/shell/useAgent'
import type { ToolCallEntry } from '@/shell/useAgent'

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function ToolEntry(props: { tool: ToolCallEntry }) {
  const [expanded, setExpanded] = createSignal(false)

  const statusIcon = () => {
    if (props.tool.status === 'running') return '◉'
    if (props.tool.status === 'error') return '✕'
    return '✓'
  }

  const statusColor = () => {
    if (props.tool.status === 'running') return 'text-yellow-400'
    if (props.tool.status === 'error') return 'text-red-400'
    return 'text-green-400'
  }

  return (
    <div class="glass rounded-lg mb-1.5 overflow-hidden">
      <div
        class="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-white/5 transition-colors"
        classList={{ 'animate-pulse': props.tool.status === 'running' }}
        onClick={() => setExpanded(!expanded())}
      >
        <span class={statusColor() + ' text-xs'}>{statusIcon()}</span>
        <span class="text-xs font-medium flex-1">{props.tool.toolName}</span>
        <span class="text-xs text-[var(--text-secondary)]">
          {props.tool.status === 'running' ? '...' : formatDuration(props.tool.duration)}
        </span>
      </div>
      <Show when={expanded()}>
        <div class="px-3 pb-3">
          <pre class="text-xs text-[var(--text-secondary)] font-mono bg-black/30 rounded p-2 max-h-48 overflow-auto whitespace-pre-wrap">
            {props.tool.output || '(等待输出...)'}
          </pre>
        </div>
      </Show>
    </div>
  )
}

export function ToolPanel() {
  const { toolCalls } = useAgent()

  return (
    <div class="flex flex-col h-full">
      <div class="flex items-center justify-between px-3 py-2 border-b border-white/5 flex-shrink-0">
        <div class="flex items-center gap-2">
          <span class="w-2 h-2 rounded-full bg-green-400" />
          <span class="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
            工具执行
          </span>
        </div>
        <span class="text-xs text-[var(--text-secondary)]">{toolCalls.length}</span>
      </div>
      <div class="flex-1 overflow-y-auto p-2">
        <Show
          when={toolCalls.length > 0}
          fallback={
            <div class="text-xs text-[var(--text-secondary)] text-center mt-8">
              暂无工具调用
            </div>
          }
        >
          <For each={toolCalls}>
            {(tool) => <ToolEntry tool={tool} />}
          </For>
        </Show>
      </div>
    </div>
  )
}
