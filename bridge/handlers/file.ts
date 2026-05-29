import type { WebSocket } from 'ws'
import type { ClientMessage } from '../protocol'
import { readdirSync, statSync, readFileSync, existsSync } from 'fs'
import { join } from 'path'

export function handleFileList(msg: ClientMessage, ws: WebSocket): void {
  const payload = msg.payload as { path?: string }
  const targetPath = payload.path ?? '.'
  try {
    const entries = readdirSync(targetPath).map((name) => {
      const fullPath = join(targetPath, name)
      const s = statSync(fullPath)
      return {
        name,
        type: s.isDirectory() ? 'directory' as const : 'file' as const,
        size: s.isFile() ? s.size : undefined,
      }
    })

    ws.send(JSON.stringify({
      type: 'file.list',
      id: `srv-${Date.now()}`,
      sessionId: msg.sessionId,
      ts: Date.now(),
      payload: { path: targetPath, entries },
    }))
  } catch (err) {
    ws.send(JSON.stringify({
      type: 'error',
      id: `srv-${Date.now()}`,
      sessionId: msg.sessionId,
      ts: Date.now(),
      payload: { code: 'FILE_ERROR', message: String(err), recoverable: true },
    }))
  }
}

export function handleFileRead(msg: ClientMessage, ws: WebSocket): void {
  const payload = msg.payload as { path: string }
  try {
    if (!existsSync(payload.path)) {
      throw new Error(`File not found: ${payload.path}`)
    }
    const content = readFileSync(payload.path, 'utf-8')
    const ext = payload.path.split('.').pop() ?? ''

    ws.send(JSON.stringify({
      type: 'file.content',
      id: `srv-${Date.now()}`,
      sessionId: msg.sessionId,
      ts: Date.now(),
      payload: { path: payload.path, content, language: ext },
    }))
  } catch (err) {
    ws.send(JSON.stringify({
      type: 'error',
      id: `srv-${Date.now()}`,
      sessionId: msg.sessionId,
      ts: Date.now(),
      payload: { code: 'FILE_ERROR', message: String(err), recoverable: true },
    }))
  }
}
