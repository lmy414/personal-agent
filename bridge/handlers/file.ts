import type { WebSocket } from 'ws'
import type { ClientMessage } from '../protocol'
import { readdirSync, statSync, readFileSync, writeFileSync, existsSync } from 'fs'
import { join, resolve, normalize, relative, dirname, isAbsolute } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const PROJECT_ROOT = resolve(join(__dirname, '..', '..'))
const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico', 'bmp'])

export function resolveSafe(targetPath: string): string {
  // 绝对路径：验证存在即可访问（工作目录支持）
  if (isAbsolute(targetPath)) {
    const normalized = normalize(targetPath)
    if (!existsSync(normalized)) {
      throw new Error(`Path not found: ${targetPath}`)
    }
    return normalized
  }
  // 相对路径基于 PROJECT_ROOT 解析，而非 CWD
  const resolved = resolve(PROJECT_ROOT, normalize(targetPath))
  const rel = relative(PROJECT_ROOT, resolved)
  if (rel.startsWith('..')) {
    throw new Error(`Path out of bounds: ${targetPath}`)
  }
  return resolved
}

export function handleFileList(msg: ClientMessage, ws: WebSocket): void {
  const payload = msg.payload as { path?: string }
  const rawPath = payload.path ?? '.'
  console.log('[file] list request path:', rawPath)
  try {
    const safePath = resolveSafe(rawPath)
    const entries = readdirSync(safePath).map((name) => {
      const fullPath = join(safePath, name)
      const s = statSync(fullPath)
      return {
        name,
        type: s.isDirectory() ? ('directory' as const) : ('file' as const),
        size: s.isFile() ? s.size : undefined,
      }
    })
    entries.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
      return a.name.localeCompare(b.name)
    })
    console.log('[file] list response:', safePath, '=>', entries.length, 'entries')

    ws.send(JSON.stringify({
      type: 'file.list',
      id: `srv-${Date.now()}`,
      sessionId: msg.sessionId,
      ts: Date.now(),
      payload: { path: safePath, entries },
    }))
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    ws.send(JSON.stringify({
      type: 'error',
      id: `srv-${Date.now()}`,
      sessionId: msg.sessionId,
      ts: Date.now(),
      payload: { code: 'FILE_ERROR', message, recoverable: true },
    }))
  }
}

export function handleFileWrite(msg: ClientMessage, ws: WebSocket): void {
  const payload = msg.payload as { path: string; content: string; encoding?: 'utf8' | 'base64' }
  try {
    const safePath = resolveSafe(payload.path)
    const encoding = payload.encoding ?? 'utf8'
    writeFileSync(safePath, payload.content, encoding === 'base64' ? { encoding: 'base64' } : 'utf-8')
    console.log('[file] write:', safePath)

    ws.send(JSON.stringify({
      type: 'file.content',
      id: `srv-${Date.now()}`,
      sessionId: msg.sessionId,
      ts: Date.now(),
      payload: { path: safePath, content: payload.content, encoding },
    }))
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    ws.send(JSON.stringify({
      type: 'error',
      id: `srv-${Date.now()}`,
      sessionId: msg.sessionId,
      ts: Date.now(),
      payload: { code: 'FILE_ERROR', message, recoverable: true },
    }))
  }
}

export function handleFileRead(msg: ClientMessage, ws: WebSocket): void {
  const payload = msg.payload as { path: string; encoding?: 'utf8' | 'base64' }
  try {
    const safePath = resolveSafe(payload.path)
    if (!existsSync(safePath)) {
      throw new Error(`File not found: ${payload.path}`)
    }

    const stat = statSync(safePath)
    if (stat.isFile() && stat.size > 10 * 1024 * 1024) {
      throw new Error('File too large (>10MB)')
    }

    const ext = safePath.split('.').pop()?.toLowerCase() ?? ''
    const isImage = IMAGE_EXTS.has(ext)
    const encoding = isImage ? 'base64' : (payload.encoding ?? 'utf8')
    const content = readFileSync(safePath, encoding === 'base64' ? { encoding: 'base64' } : 'utf-8')

    ws.send(JSON.stringify({
      type: 'file.content',
      id: `srv-${Date.now()}`,
      sessionId: msg.sessionId,
      ts: Date.now(),
      payload: { path: safePath, content, language: ext, encoding },
    }))
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    ws.send(JSON.stringify({
      type: 'error',
      id: `srv-${Date.now()}`,
      sessionId: msg.sessionId,
      ts: Date.now(),
      payload: { code: 'FILE_ERROR', message, recoverable: true },
    }))
  }
}
