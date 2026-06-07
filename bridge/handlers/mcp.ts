import type { WebSocket } from 'ws'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import type { ClientMessage, MCPServerConfig } from '../protocol'
import { createClientSet } from '../client-manager'

// ========== 持久化 ==========

const MCP_CONFIG_FILE = join(homedir(), '.pi', 'mcp-servers.json')

function ensureDir(): void {
  const dir = join(homedir(), '.pi')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

function loadConfig(): MCPServerConfig[] {
  ensureDir()
  if (!existsSync(MCP_CONFIG_FILE)) return []
  try {
    const raw = JSON.parse(readFileSync(MCP_CONFIG_FILE, 'utf-8'))
    if (Array.isArray(raw.servers)) return raw.servers as MCPServerConfig[]
  } catch { /* ignore */ }
  return []
}

function saveConfig(servers: MCPServerConfig[]): void {
  ensureDir()
  writeFileSync(MCP_CONFIG_FILE, JSON.stringify({ servers }, null, 2), 'utf-8')
}

// ========== 广播 ==========

export const mcpClients = createClientSet()

function broadcast(msg: object): void {
  mcpClients.broadcast(JSON.stringify(msg))
}

function broadcastMcpState(): void {
  broadcast({
    type: 'mcp.state',
    id: `srv-${Date.now()}`,
    sessionId: '',
    ts: Date.now(),
    payload: { servers: loadConfig() },
  })
}

// ========== Handlers ==========

export function handleMcpList(_msg: ClientMessage, ws: WebSocket): void {
  mcpClients.add(ws)
  broadcastMcpState()
}

export function handleMcpSave(msg: ClientMessage, ws: WebSocket): void {
  const payload = msg.payload as MCPServerConfig
  const servers = loadConfig()
  const idx = servers.findIndex((s) => s.id === payload.id)
  if (idx >= 0) {
    servers[idx] = { ...servers[idx], ...payload }
  } else {
    servers.push({ ...payload, enabled: payload.enabled ?? true })
  }
  saveConfig(servers)
  broadcastMcpState()
  ws.send(JSON.stringify({
    type: 'mcp.saved',
    id: msg.id,
    sessionId: msg.sessionId,
    ts: Date.now(),
    payload: { id: payload.id },
  }))
}

export function handleMcpToggle(msg: ClientMessage, _ws: WebSocket): void {
  const { id, enabled } = msg.payload as { id: string; enabled: boolean }
  const servers = loadConfig()
  const s = servers.find((s) => s.id === id)
  if (s) {
    s.enabled = enabled
    saveConfig(servers)
    broadcastMcpState()
  }
}

export function handleMcpRemove(msg: ClientMessage, _ws: WebSocket): void {
  const { id } = msg.payload as { id: string }
  const servers = loadConfig().filter((s) => s.id !== id)
  saveConfig(servers)
  broadcastMcpState()
}
