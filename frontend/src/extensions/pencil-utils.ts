import type { JSX } from 'solid-js'
import type { ToolCallEntry } from '@/shell/useAgent'

// ── Shared types ──

export interface ToolItem {
  name: string
  status: string
  desc: string
  time: string
  dot: 'ok' | 'err' | 'run'
}

export interface Tab {
  icon: () => JSX.Element
  label: string
  active?: boolean
}

// ── Utility functions ──

export function kbdHandlers(fn: () => void) {
  return {
    tabIndex: 0 as number,
    role: 'button' as const,
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn() }
    },
  }
}

export function toolDot(tc: ToolCallEntry): 'ok' | 'err' | 'run' {
  if (tc.status === 'running') return 'run'
  if (tc.status === 'error') return 'err'
  return 'ok'
}

export function toolStatusText(tc: ToolCallEntry): string {
  if (tc.status === 'running') return '执行中'
  if (tc.status === 'error') return '失败'
  return '成功'
}

export function timeStr(): string {
  return new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60000)}m`
}

export function formatTokens(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
  return String(n)
}

// ── Static config ──

export const INPUT_TAGS = ['MCP 工具', '代码片段', '图片', '文件']
