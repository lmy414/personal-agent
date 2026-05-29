import { createSignal, onCleanup } from 'solid-js'
import { useAgent } from '@/shell/useAgent'

function formatTime(date: Date): string {
  const h = date.getHours().toString().padStart(2, '0')
  const m = date.getMinutes().toString().padStart(2, '0')
  const s = date.getSeconds().toString().padStart(2, '0')
  return `${h}:${m}:${s}`
}

function formatCost(tokens: number): string {
  return `¥${((tokens / 1000) * 0.001).toFixed(4)}`
}

export function StatusBar() {
  const { status } = useAgent()
  const [time, setTime] = createSignal(new Date())

  const timer = setInterval(() => setTime(new Date()), 1000)
  onCleanup(() => clearInterval(timer))

  const contextPercent = () => {
    if (status.contextMax === 0) return 0
    return Math.round((status.contextUsed / status.contextMax) * 100)
  }

  const barColor = () => {
    const p = contextPercent()
    if (p > 80) return 'bg-red-500'
    if (p > 60) return 'bg-yellow-500'
    return 'bg-blue-500'
  }

  return (
    <div class="p-3 space-y-2 text-xs">
      {/* Row 1: Clock + model select */}
      <div class="flex items-center justify-between">
        <span class="font-mono text-base text-[var(--text-primary)] tabular-nums tracking-wider">
          {formatTime(time())}
        </span>
        <select class="bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-xs text-[var(--text-primary)] outline-none">
          <option>deepseek-v3</option>
          <option>deepseek-r1</option>
        </select>
      </div>

      {/* Row 2: Token + cost */}
      <div class="flex items-center justify-between text-[var(--text-secondary)]">
        <span>Token: {status.tokens.toLocaleString()}</span>
        <span>{formatCost(status.tokens)}</span>
      </div>

      {/* Row 3: Context bar */}
      <div class="space-y-1">
        <div class="flex items-center justify-between text-[var(--text-secondary)]">
          <span>上下文 {contextPercent()}%</span>
          <span>第 {status.roundCount} 轮</span>
        </div>
        <div class="h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div
            class={`h-full rounded-full transition-all duration-500 ${barColor()}`}
            style={{ width: `${contextPercent()}%` }}
          />
        </div>
      </div>
    </div>
  )
}
