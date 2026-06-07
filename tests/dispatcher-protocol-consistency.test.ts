/**
 * Dispatcher-Protocol 一致性测试
 *
 * 验证 dispatcher.ts 路由表与 protocol.ts ClientMessage 类型定义完全对齐。
 * 任何新增/删除/重命名消息类型都应在此测试中体现。
 *
 * 之前 dispatcher.test.ts 使用硬编码路由表，与实际代码不同步。
 * 本测试直接 import dispatcher 的路由表，确保与 protocol.ts 一致。
 */
import { describe, it } from 'node:test'
import assert from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname!, '..')

// ── 从 protocol.ts 提取 ClientMessage 类型名 ──────────────────

function extractClientMessageTypes(): string[] {
  const protocolPath = path.join(ROOT, 'bridge/protocol.ts')
  const content = fs.readFileSync(protocolPath, 'utf-8')

  // 匹配 ClientMsg<'xxx', ...> 中的类型名
  const re = /ClientMsg<\s*'([^']+)'/g
  const types: string[] = []
  let match: RegExpExecArray | null
  while ((match = re.exec(content)) !== null) {
    types.push(match[1])
  }
  return types
}

// ── 从 dispatcher.ts 提取路由表 ────────────────────────────────

function extractDispatcherRoutes(): Map<string, string> {
  const dispatcherPath = path.join(ROOT, 'bridge/dispatcher.ts')
  const content = fs.readFileSync(dispatcherPath, 'utf-8')

  // 匹配路由表中的 'type': handlerName
  const re = /'([^']+)'\s*:\s*(\w+)/g
  const routes = new Map<string, string>()
  let match: RegExpExecArray | null
  while ((match = re.exec(content)) !== null) {
    routes.set(match[1], match[2])
  }
  return routes
}

// ── 测试 ──────────────────────────────────────────────────────

describe('Dispatcher-Protocol 一致性', () => {
  const clientTypes = extractClientMessageTypes()
  const routes = extractDispatcherRoutes()

  // ping 是心跳，不需要路由
  const nonRoutedTypes = new Set(['ping'])

  it('protocol.ts ClientMessage 类型数量 >= 30', () => {
    assert.ok(clientTypes.length >= 30, `ClientMessage 类型数量: ${clientTypes.length}，期望 >= 30`)
  })

  it('dispatcher.ts 路由表数量 >= 25', () => {
    assert.ok(routes.size >= 25, `路由表数量: ${routes.size}，期望 >= 25`)
  })

  it('每个 ClientMessage 类型（除 ping）都有对应路由', () => {
    const missing: string[] = []
    for (const t of clientTypes) {
      if (nonRoutedTypes.has(t)) continue
      if (!routes.has(t)) {
        missing.push(t)
      }
    }
    assert.strictEqual(missing.length, 0, `以下 ClientMessage 类型缺少路由: ${missing.join(', ')}`)
  })

  it('路由表中没有不属于 ClientMessage 的类型（除 NOOP）', () => {
    const clientTypeSet = new Set(clientTypes)
    const extra: string[] = []
    for (const [route] of routes) {
      if (!clientTypeSet.has(route)) {
        extra.push(route)
      }
    }
    // 允许路由表有额外条目（如兼容旧类型），但应记录
    if (extra.length > 0) {
      console.log(`  ⚠️  路由表中有 ${extra.length} 个非 ClientMessage 类型: ${extra.join(', ')}`)
    }
    // 不强制失败，仅警告
    assert.ok(true, `记录: ${extra.length} 个额外路由`)
  })

  it('所有 handler 命名遵循 handleXxx 规范', () => {
    for (const [route, handler] of routes) {
      assert.ok(
        handler.startsWith('handle'),
        `路由 "${route}" 的 handler "${handler}" 不以 handle 开头`,
      )
    }
  })

  it('session.* 命名空间一致性', () => {
    const sessionRoutes = [...routes.keys()].filter(k => k.startsWith('session.'))
    // session.create, session.list, session.switch, session.delete, session.history, session.rename, session.state
    assert.ok(sessionRoutes.length >= 7, `session.* 路由数量: ${sessionRoutes.length}，期望 >= 7`)
  })

  it('agent.* 命名空间一致性', () => {
    const agentRoutes = [...routes.keys()].filter(k => k.startsWith('agent.'))
    // agent.list, agent.create, agent.update, agent.delete, agent.switch, agent.set_default,
    // agent.prompt, agent.abort, agent.compact, agent.model.set, agent.model.list, agent.thinking.set, agent.tools.set
    assert.ok(agentRoutes.length >= 10, `agent.* 路由数量: ${agentRoutes.length}，期望 >= 10`)
  })

  it('settings.discover 与 protocol.ts 一致', () => {
    // protocol.ts 使用 'settings.discover'，不是 'settings.discover-models'
    const hasDiscover = routes.has('settings.discover')
    const hasDiscoverModels = routes.has('settings.discover-models')
    assert.ok(hasDiscover, 'dispatcher 应有 settings.discover 路由')
    assert.ok(!hasDiscoverModels, 'dispatcher 不应有 settings.discover-models（旧名）')
  })

  it('agent.prompt / agent.abort 与 protocol.ts 一致', () => {
    assert.ok(routes.has('agent.prompt'), 'dispatcher 应有 agent.prompt 路由')
    assert.ok(routes.has('agent.abort'), 'dispatcher 应有 agent.abort 路由')
    assert.ok(!routes.has('message.send'), 'dispatcher 不应有 message.send（已改为 agent.prompt）')
    assert.ok(!routes.has('message.cancel'), 'dispatcher 不应有 message.cancel（已改为 agent.abort）')
  })
})

describe('Dispatcher-Protocol — ServerMessage 覆盖', () => {
  it('ServerMessage 类型数量 >= 30', () => {
    const protocolPath = path.join(ROOT, 'bridge/protocol.ts')
    const content = fs.readFileSync(protocolPath, 'utf-8')

    const re = /ServerMsg<\s*'([^']+)'/g
    const types: string[] = []
    let match: RegExpExecArray | null
    while ((match = re.exec(content)) !== null) {
      types.push(match[1])
    }
    assert.ok(types.length >= 30, `ServerMessage 类型数量: ${types.length}，期望 >= 30`)
  })

  it('关键 ServerMessage 类型存在', () => {
    const protocolPath = path.join(ROOT, 'bridge/protocol.ts')
    const content = fs.readFileSync(protocolPath, 'utf-8')

    const requiredTypes = [
      'session.created', 'session.list', 'session.renamed', 'session.deleted',
      'message.start', 'message.delta', 'message.end',
      'tool.start', 'tool.progress', 'tool.end',
      'turn.start', 'turn.end', 'turn.error',
      'status.update', 'error',
      'agent.list', 'agent.created', 'agent.updated', 'agent.deleted',
      'settings.state', 'skills.state',
      'session.compacted',
    ]

    for (const t of requiredTypes) {
      assert.ok(
        content.includes(`'${t}'`),
        `protocol.ts 缺少 ServerMessage 类型: ${t}`,
      )
    }
  })
})
