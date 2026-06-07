import type { WebSocket } from 'ws'
import type { ClientMessage } from '../protocol'

interface LogEntry {
  time: string
  level: 'INFO' | 'WARN' | 'ERR'
  msg: string
}

const MAX_LOGS = 200
const logBuffer: LogEntry[] = []

function now(): string {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
}

export function pushLog(level: 'INFO' | 'WARN' | 'ERR', msg: string): void {
  logBuffer.push({ time: now(), level, msg })
  if (logBuffer.length > MAX_LOGS) logBuffer.splice(0, logBuffer.length - MAX_LOGS)
}

export function handleSystemLogs(_msg: ClientMessage, ws: WebSocket): void {
  ws.send(JSON.stringify({
    type: 'system.logs',
    id: `srv-${Date.now()}`,
    sessionId: '',
    ts: Date.now(),
    payload: { logs: logBuffer.slice(-50) },
  }))
}

// 拦截 console.log / warn / error，同时保留原始输出
const origLog = console.log
const origWarn = console.warn
const origError = console.error

console.log = (...args: unknown[]) => {
  origLog(...args)
  const msg = args.map((a) => typeof a === 'string' ? a : JSON.stringify(a)).join(' ')
  pushLog('INFO', msg)
}

console.warn = (...args: unknown[]) => {
  origWarn(...args)
  const msg = args.map((a) => typeof a === 'string' ? a : JSON.stringify(a)).join(' ')
  pushLog('WARN', msg)
}

console.error = (...args: unknown[]) => {
  origError(...args)
  const msg = args.map((a) => typeof a === 'string' ? a : JSON.stringify(a)).join(' ')
  pushLog('ERR', msg)
}
