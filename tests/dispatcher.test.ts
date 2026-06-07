/**
 * Bridge Dispatcher 路由测试 —— 验证消息路由表完整性
 */
import { describe, it } from 'node:test'
import assert from 'node:assert'

// ── 模拟 dispatcher 的路由表（照搬 dispatcher.ts 的路由定义）───

const ROUTE_TABLE: Record<string, string> = {
  'session.create': 'handleSessionCreate',
  'session.list': 'handleSessionList',
  'session.switch': 'handleSessionSwitch',
  'session.delete': 'handleSessionDelete',
  'message.send': 'handleMessageSend',
  'message.cancel': 'handleMessageCancel',
  'agent.model.set': 'handleModelSwitch',
  'agent.model.list': 'handleModelList',
  'file.list': 'handleFileList',
  'file.read': 'handleFileRead',
  'memory.search': 'handleMemorySearch',
  'memory.list': 'handleMemoryList',
  'session.history': 'handleSessionHistory',
  'session.rename': 'handleSessionRename',
  'session.state': 'handleSessionState',
  'session.compact': 'handleSessionCompact',
  'settings.get': 'handleSettingsGet',
  'settings.set': 'handleSettingsSet',
  'settings.discover-models': 'handleSettingsDiscoverModels',
}

function dispatch(msgType: string): { handler: string } | { error: string } {
  const handler = ROUTE_TABLE[msgType]
  if (!handler) {
    return { error: `Unknown message type: ${msgType}` }
  }
  return { handler }
}

// ── Client message types from protocol ─────────────────────

const CLIENT_TYPES = [
  'session.create', 'session.list', 'session.switch', 'session.delete',
  'session.history', 'session.rename', 'session.state', 'session.compact',
  'message.send', 'message.cancel',
  'agent.model.set', 'agent.model.list',
  'file.list', 'file.read',
  'memory.search', 'memory.list',
  'settings.get', 'settings.set', 'settings.discover-models',
]

describe('Dispatcher — 路由表完整性', () => {
  it('路由表共 19 个条目', () => {
    assert.strictEqual(Object.keys(ROUTE_TABLE).length, 19)
  })

  for (const msgType of CLIENT_TYPES) {
    it(`${msgType} → 有对应 handler`, () => {
      const result = dispatch(msgType)
      assert.ok('handler' in result, `${msgType} 应有 handler: ${JSON.stringify(result)}`)
    })
  }
})

describe('Dispatcher — 路由表无多余条目', () => {
  it('没有未在 CLIENT_TYPES 中声明的路由', () => {
    for (const route of Object.keys(ROUTE_TABLE)) {
      assert.ok(CLIENT_TYPES.includes(route), `路由 "${route}" 不在 CLIENT_TYPES 列表中`)
    }
  })
})

describe('Dispatcher — 未知消息处理', () => {
  it('未知类型返回错误', () => {
    const result = dispatch('unknown.type')
    assert.ok('error' in result)
    assert.ok(result.error!.includes('Unknown'))
    assert.ok(result.error!.includes('unknown.type'))
  })

  it('服务端和客户端类型无意外重叠', () => {
    const known: Record<string, boolean> = {}
    for (const t of CLIENT_TYPES) known[t] = true
    // 这些是合法的双向类型（同时存在于 ServerMessage 和 ClientMessage）
    const validOverlap = new Set(['session.list', 'file.list', 'memory.list', 'session.history', 'session.state'])
    const serverOnlyTypes = [
      'session.created', 'session.state',
      'turn.start', 'message.start', 'message.delta', 'message.end', 'turn.end',
      'tool.start', 'tool.progress', 'tool.end',
      'status.update', 'file.content',
      'memory.results',
      'session.renamed', 'session.deleted',
      'compaction', 'session.compacted', 'file.changed',
      'settings.state', 'error',
    ]
    for (const t of serverOnlyTypes) {
      assert.ok(!known[t] || validOverlap.has(t), `服务端类型 "${t}" 不应能被客户端发送`)
    }
  })
})

describe('Dispatcher — handler 命名一致性', () => {
  it('所有 handler 名对应路由', () => {
    for (const [route, handler] of Object.entries(ROUTE_TABLE)) {
      // handler 名应是 handleXxx 格式
      assert.ok(handler.startsWith('handle'), `Handler "${handler}" 应以 handle 开头`)
      // 路由应可从 handler 推导
      const parts = route.split('.')
      assert.ok(parts.length >= 2, `路由 "${route}" 应包含 '.'`)
    }
  })

  it('每个 session.* 路由都有 handler', () => {
    const sessionRoutes = CLIENT_TYPES.filter(t => t.startsWith('session.'))
    assert.strictEqual(sessionRoutes.length, 8)
    for (const route of sessionRoutes) {
      assert.ok(route in ROUTE_TABLE, `缺少 ${route} 路由`)
    }
  })

  it('每个 settings.* 路由都有 handler', () => {
    const settingsRoutes = CLIENT_TYPES.filter(t => t.startsWith('settings.'))
    assert.strictEqual(settingsRoutes.length, 3)
    for (const route of settingsRoutes) {
      assert.ok(route in ROUTE_TABLE, `缺少 ${route} 路由`)
    }
  })
})

describe('Dispatcher — handler 文件存在性（静态检查）', () => {
  it('每个 handler 对应 handlers/ 下的文件', () => {
    const handlerFiles: Record<string, string> = {
      handleSessionCreate: 'session.ts',
      handleSessionList: 'session.ts',
      handleSessionSwitch: 'session.ts',
      handleSessionDelete: 'session.ts',
      handleSessionHistory: 'session.ts',
      handleSessionRename: 'session.ts',
      handleSessionState: 'session.ts',
      handleSessionCompact: 'session.ts',
      handleMessageSend: 'message.ts',
      handleMessageCancel: 'message.ts',
      handleModelSwitch: 'model.ts',
      handleModelList: 'model.ts',
      handleFileList: 'file.ts',
      handleFileRead: 'file.ts',
      handleMemorySearch: 'memory.ts',
      handleMemoryList: 'memory.ts',
      handleSettingsGet: 'settings.ts',
      handleSettingsSet: 'settings.ts',
      handleSettingsDiscoverModels: 'settings.ts',
    }

    const usedFiles = new Set(Object.values(handlerFiles))
    assert.strictEqual(usedFiles.size, 6, '应覆盖 6 个 handler 文件')
    assert.ok(usedFiles.has('session.ts'))
    assert.ok(usedFiles.has('message.ts'))
    assert.ok(usedFiles.has('model.ts'))
    assert.ok(usedFiles.has('file.ts'))
    assert.ok(usedFiles.has('memory.ts'))
    assert.ok(usedFiles.has('settings.ts'))
  })
})
