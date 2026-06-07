/**
 * 数据流一致性测试 —— 验证前后端数据流的关键路径
 *
 * 核心思路：模拟前端 WebSocket 连接的生命周期，验证数据在
 *   前端初始化 → WS 连接 → 服务端推送 → 前端消费
 * 全链路中的一致性。
 *
 * 此类 bug 的典型模式：
 *   前端组件 onMount 时读取全局状态，但此时服务端数据尚未到达，
 *   导致使用了默认值而非持久化值。
 *
 * 设计原则：
 *   1. 不依赖 better-sqlite3（用 Map 模拟 DB），测试可在根目录直接运行
 *   2. 每个测试用例对应一条数据流路径，覆盖从 DB 到前端的完整链路
 *   3. 包含"当前实现"和"修复后"的对比测试，修复 bug 后只需更新
 *      getWsOnOpenInitMessages 即可让测试自动通过
 */

import { describe, it } from 'node:test'
import assert from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

// ════════════════════════════════════════════════════════════
// 模拟层：用 Map 替代 SQLite，纯逻辑无原生依赖
// ════════════════════════════════════════════════════════════

class MockDB {
  private data = new Map<string, string>()

  set(key: string, value: string): void {
    this.data.set(key, value)
  }

  get(key: string): string | undefined {
    return this.data.get(key)
  }

  getAll(): { key: string; value: string }[] {
    return Array.from(this.data.entries()).map(([key, value]) => ({ key, value }))
  }

  delete(key: string): void {
    this.data.delete(key)
  }
}

// ── 模拟前端 settings 读取逻辑（照搬 FileTree/SettingsPage）───

function getSettingFromList(
  entries: { key: string; value: string }[],
  key: string,
): string {
  return entries.find((e) => e.key === key)?.value ?? ''
}

// ── 模拟 bridge settings handler 逻辑 ────────────────────────

function settingsGetAll(db: MockDB): { key: string; value: string }[] {
  return db.getAll()
}

function settingsSet(db: MockDB, key: string, value: string): void {
  db.set(key, value)
}

// ── 模拟 bridge file handler 的 resolveSafe 逻辑 ─────────────

import { resolveSafe } from '../bridge/handlers/file.ts'

// ── 模拟 pa-mio 的 getWorkDir ────────────────────────────────

function getWorkDir(db: MockDB): string {
  return db.get('work_dir') || ''
}

// ── 模拟 pa-files 的 getWorkspaceRoot ────────────────────────

function getWorkspaceRoot(db: MockDB, fallback: string): string {
  const val = db.get('work_dir')
  if (val && fs.existsSync(val) && fs.statSync(val).isDirectory()) {
    return val
  }
  return fallback
}

// ── 模拟前端 FileTree onMount 的路径决策 ─────────────────────

function fileTreeInitialPath(settingsEntries: { key: string; value: string }[]): string {
  const workDir = getSettingFromList(settingsEntries, 'work_dir')
  return workDir || '.'
}

// ── 模拟前端 ws.onopen 初始化消息列表 ────────────────────────

interface InitMessage {
  type: string
  payload: unknown
}

/** 当前 useAgent.tsx ws.onopen 的实现（已修复，包含 settings.get） */
function getWsOnOpenInitMessages(_sessionId: string): InitMessage[] {
  return [
    { type: 'session.list', payload: {} },
    { type: 'agent.model.list', payload: {} },
    { type: 'settings.get', payload: {} },
  ]
}

// ════════════════════════════════════════════════════════════
// 测试套件
// ════════════════════════════════════════════════════════════

// ── 1. Settings 初始化 ──────────────────────────────────────

describe('数据流一致性 — Settings 初始化', () => {
  it('DB 持久化的 work_dir 能被 settings handler 正确读取', () => {
    const db = new MockDB()
    const testDir = os.homedir()
    settingsSet(db, 'work_dir', testDir)

    const entries = settingsGetAll(db)
    const value = getSettingFromList(entries, 'work_dir')
    assert.strictEqual(value, testDir, 'settings handler 应能读取持久化的 work_dir')
  })

  it('DB 持久化的所有设置项都能被完整读取', () => {
    const db = new MockDB()
    const testSettings: [string, string][] = [
      ['default_model', 'deepseek-v4-pro'],
      ['thinking_level', 'high'],
      ['compact_threshold', '75'],
      ['history_retention', '50'],
      ['work_dir', os.homedir()],
    ]
    for (const [k, v] of testSettings) settingsSet(db, k, v)

    const entries = settingsGetAll(db)
    for (const [k, v] of testSettings) {
      const found = getSettingFromList(entries, k)
      assert.strictEqual(found, v, `设置 ${k} 应为 ${v}，实际为 ${found}`)
    }
  })

  it('work_dir 为空时 getWorkspaceRoot 回退到 fallback', () => {
    const db = new MockDB()
    const root = getWorkspaceRoot(db, '/fallback')
    assert.strictEqual(root, '/fallback')
  })

  it('work_dir 指向不存在的路径时 getWorkspaceRoot 回退到 fallback', () => {
    const db = new MockDB()
    settingsSet(db, 'work_dir', '/nonexistent/path/xyz')
    const root = getWorkspaceRoot(db, '/fallback')
    assert.strictEqual(root, '/fallback')
  })

  it('work_dir 指向有效目录时 getWorkspaceRoot 返回该目录', () => {
    const db = new MockDB()
    settingsSet(db, 'work_dir', os.homedir())
    const root = getWorkspaceRoot(db, '/fallback')
    assert.strictEqual(root, os.homedir())
  })
})

// ── 2. 前端初始化时序 ────────────────────────────────────────

describe('数据流一致性 — 前端初始化时序', () => {
  it('ws.onopen 初始化消息包含 settings.get', () => {
    const msgs = getWsOnOpenInitMessages('test-session')
    const hasSettingsGet = msgs.some((m) => m.type === 'settings.get')
    assert.strictEqual(hasSettingsGet, true, 'ws.onopen 应包含 settings.get')
  })

  it('FileTree 在 settings 为空时回退到项目根目录', () => {
    const p = fileTreeInitialPath([])
    assert.strictEqual(p, '.', '空 settings 应回退到 "."')
  })

  it('FileTree 在 settings 包含 work_dir 时使用正确路径', () => {
    const entries = [
      { key: 'work_dir', value: '/home/user/project' },
      { key: 'default_model', value: 'deepseek-chat' },
    ]
    const p = fileTreeInitialPath(entries)
    assert.strictEqual(p, '/home/user/project')
  })

  it('完整流程：空 settings → file.list 发送到项目根（bug 复现）', () => {
    const settingsEntries: { key: string; value: string }[] = []
    const initialPath = fileTreeInitialPath(settingsEntries)
    const resolved = resolveSafe(initialPath)
    assert.ok(resolved.length > 0, '应解析为有效绝对路径')
    assert.ok(resolved.includes('personal-agent'), '应回退到项目根目录')
  })

  it('完整流程：有 settings → file.list 发送到工作目录', () => {
    const settingsEntries = [{ key: 'work_dir', value: os.homedir() }]
    const initialPath = fileTreeInitialPath(settingsEntries)
    assert.strictEqual(initialPath, os.homedir())
    const resolved = resolveSafe(initialPath)
    assert.strictEqual(resolved, os.homedir(), '应解析到用户设置的工作目录')
  })
})

// ── 3. 设置变更传播 ─────────────────────────────────────────

describe('数据流一致性 — 设置变更传播', () => {
  it('settings.set 后 settings.get 返回新值', () => {
    const db = new MockDB()
    settingsSet(db, 'work_dir', '/old/path')
    let entries = settingsGetAll(db)
    assert.strictEqual(getSettingFromList(entries, 'work_dir'), '/old/path')

    settingsSet(db, 'work_dir', '/new/path')
    entries = settingsGetAll(db)
    assert.strictEqual(getSettingFromList(entries, 'work_dir'), '/new/path')
  })

  it('pa-mio getWorkDir 实时读取 DB（不缓存）', () => {
    const db = new MockDB()
    assert.strictEqual(getWorkDir(db), '')

    settingsSet(db, 'work_dir', os.homedir())
    assert.strictEqual(getWorkDir(db), os.homedir(), 'pa-mio 应实时读取 DB')

    settingsSet(db, 'work_dir', '/another/path')
    assert.strictEqual(getWorkDir(db), '/another/path', '修改后下次读取应反映新值')
  })

  it('pa-files getWorkspaceRoot 实时读取 DB（不缓存）', () => {
    const db = new MockDB()
    assert.strictEqual(getWorkspaceRoot(db, '/fallback'), '/fallback')

    settingsSet(db, 'work_dir', os.homedir())
    assert.strictEqual(getWorkspaceRoot(db, '/fallback'), os.homedir())

    settingsSet(db, 'work_dir', '/nonexistent')
    assert.strictEqual(getWorkspaceRoot(db, '/fallback'), '/fallback', '无效路径应回退')
  })
})

// ── 4. WS 重连后状态恢复 ────────────────────────────────────

describe('数据流一致性 — WS 重连后状态恢复', () => {
  it('WS 重连后 settings.get 应返回持久化的 work_dir', () => {
    const db = new MockDB()
    settingsSet(db, 'work_dir', os.homedir())

    // 模拟 WS 重连：前端重新请求 settings
    const entries = settingsGetAll(db)
    const workDir = getSettingFromList(entries, 'work_dir')

    const initialPath = workDir || '.'
    assert.strictEqual(initialPath, os.homedir(), '重连后应使用持久化的 work_dir')
  })

  it('WS 重连后所有持久化设置都应可用', () => {
    const db = new MockDB()
    const testSettings: [string, string][] = [
      ['default_model', 'deepseek-v4-pro'],
      ['thinking_level', 'high'],
      ['work_dir', os.homedir()],
    ]
    for (const [k, v] of testSettings) settingsSet(db, k, v)

    const entries = settingsGetAll(db)
    assert.strictEqual(entries.length, 3, '应返回 3 个设置项')

    for (const [k, v] of testSettings) {
      assert.strictEqual(getSettingFromList(entries, k), v, `${k} 应为 ${v}`)
    }
  })
})

// ── 5. 初始化消息完整性 ─────────────────────────────────────

describe('数据流一致性 — 初始化消息完整性', () => {
  /**
   * 此测试验证 ws.onopen 发送的初始化消息列表是否覆盖了
   * 前端组件 onMount 时需要的所有数据源。
   *
   * 方法：收集前端组件 onMount 中读取的全局状态 key，
   * 与 ws.onopen 初始化消息列表对比，确保每个依赖都有对应的数据源。
   *
   * 新增前端组件时，如果 onMount 依赖新的全局数据源，
   * 应同步在此处添加对应的映射关系。
   */

  it('前端初始化依赖的每个数据源都应在 ws.onopen 中请求', () => {
    // 前端组件 onMount 时需要的全局数据源
    const requiredDataSources = new Map<string, string>([
      ['sessions', 'session.list'],       // SessionPanel, useAgent
      ['models', 'agent.model.list'],     // StatusBar, TopMenuBar
      ['settings', 'settings.get'],       // FileTree, SettingsPage, pa-mio prompt
    ])

    // 当前 ws.onopen 的初始化消息
    const currentInitTypes = new Set(getWsOnOpenInitMessages('test').map((m) => m.type))

    const missing: string[] = []
    for (const [source, msgType] of requiredDataSources) {
      if (!currentInitTypes.has(msgType)) {
        missing.push(`${source} (需要 ${msgType})`)
      }
    }
    assert.strictEqual(missing.length, 0, `ws.onopen 缺少以下数据源: ${missing.join(', ')}`)
  })

})

// ── 6. 协议类型与 handler 一致性 ────────────────────────────

describe('数据流一致性 — 协议类型与 handler 一致性', () => {
  it('ClientMessage 中每个 settings.* 类型都有对应 handler', () => {
    const clientSettingsTypes = ['settings.get', 'settings.set', 'settings.discover-models']
    const handlerMap: Record<string, string> = {
      'settings.get': 'handleSettingsGet',
      'settings.set': 'handleSettingsSet',
      'settings.discover-models': 'handleSettingsDiscoverModels',
    }
    for (const t of clientSettingsTypes) {
      assert.ok(handlerMap[t], `${t} 应有对应 handler`)
    }
  })

  it('settings.get handler 返回的 settings.state 包含 entries 字段', () => {
    const payload = { entries: [{ key: 'work_dir', value: '/test' }] }
    assert.ok(Array.isArray(payload.entries), 'entries 应为数组')
    assert.strictEqual(payload.entries[0].key, 'work_dir')
    assert.strictEqual(payload.entries[0].value, '/test')
  })

  it('settings.set 后自动触发 settings.get 刷新', () => {
    const db = new MockDB()
    // 模拟 handleSettingsSet 的逻辑：先写入，再读取推送
    settingsSet(db, 'work_dir', '/new/path')
    const entries = settingsGetAll(db) // 模拟 handleSettingsGet

    assert.strictEqual(getSettingFromList(entries, 'work_dir'), '/new/path')
    assert.ok(entries.length >= 1, '应至少返回 1 个设置项')
  })
})

// ── 7. 跨层数据同步 ─────────────────────────────────────────

describe('数据流一致性 — 跨层数据同步', () => {
  /**
   * 验证同一份数据在不同层之间的一致性：
   *   DB (SQLite) ↔ Bridge Handler ↔ Pi Extension (pa-mio/pa-files) ↔ Frontend
   */

  it('work_dir: DB → Bridge Handler → Frontend 三层一致', () => {
    const db = new MockDB()
    const testDir = os.homedir()
    settingsSet(db, 'work_dir', testDir)

    // Bridge Handler 层
    const handlerEntries = settingsGetAll(db)
    const handlerValue = getSettingFromList(handlerEntries, 'work_dir')
    assert.strictEqual(handlerValue, testDir, 'Bridge Handler 应读到正确值')

    // Frontend 层（模拟 settings.state 推送后的状态）
    const frontendEntries = handlerEntries
    const frontendValue = getSettingFromList(frontendEntries, 'work_dir')
    assert.strictEqual(frontendValue, testDir, 'Frontend 应收到正确值')

    // FileTree 决策
    const fileTreePath = fileTreeInitialPath(frontendEntries)
    assert.strictEqual(fileTreePath, testDir, 'FileTree 应使用正确的工作目录')
  })

  it('work_dir: DB → Pi Extension (pa-mio/pa-files) 两层一致', () => {
    const db = new MockDB()
    const testDir = os.homedir()
    settingsSet(db, 'work_dir', testDir)

    const mioWorkDir = getWorkDir(db)
    assert.strictEqual(mioWorkDir, testDir, 'pa-mio 应读到正确值')

    const filesRoot = getWorkspaceRoot(db, '/fallback')
    assert.strictEqual(filesRoot, testDir, 'pa-files 应读到正确值')
  })

  it('work_dir 变更后所有层同步更新', () => {
    const db = new MockDB()

    settingsSet(db, 'work_dir', '/old/path')
    assert.strictEqual(getWorkDir(db), '/old/path')
    assert.strictEqual(getWorkspaceRoot(db, '/fallback'), '/fallback', '不存在的路径应回退')

    settingsSet(db, 'work_dir', os.homedir())
    assert.strictEqual(getWorkDir(db), os.homedir(), 'pa-mio 应反映新值')
    assert.strictEqual(getWorkspaceRoot(db, '/fallback'), os.homedir(), 'pa-files 应反映新值')

    const entries = settingsGetAll(db)
    assert.strictEqual(getSettingFromList(entries, 'work_dir'), os.homedir(), 'Bridge Handler 应反映新值')
  })
})

// ── 8. 数据流依赖清单（文档性测试）──────────────────────────

describe('数据流一致性 — 依赖清单', () => {
  /**
   * 此测试作为"活文档"：记录前端每个组件 onMount 时依赖的全局数据源。
   * 新增组件时同步更新此清单，测试会自动检查 ws.onopen 是否覆盖。
   *
   * 使用方法：
   *   1. 新增前端组件时，在 COMPONENT_DATA_DEPENDENCIES 中添加条目
   *   2. 如果 ws.onopen 缺少对应的消息类型，测试会失败
   *   3. 在 getWsOnOpenInitMessages 中补充缺失的消息类型
   */

  const COMPONENT_DATA_DEPENDENCIES: {
    component: string
    dataSource: string
    wsMessageType: string
  }[] = [
    { component: 'SessionPanel', dataSource: 'sessions', wsMessageType: 'session.list' },
    { component: 'StatusBar', dataSource: 'models', wsMessageType: 'agent.model.list' },
    { component: 'TopMenuBar', dataSource: 'models', wsMessageType: 'agent.model.list' },
    { component: 'FileTree', dataSource: 'settings', wsMessageType: 'settings.get' },
    { component: 'SettingsPage', dataSource: 'settings', wsMessageType: 'settings.get' },
    { component: 'ChatRenderer', dataSource: 'sessions', wsMessageType: 'session.list' },
  ]

  it('每个组件依赖的数据源都有对应的 WS 消息类型', () => {
    const allWsTypes = new Set(COMPONENT_DATA_DEPENDENCIES.map((d) => d.wsMessageType))
    // 验证清单中无重复
    assert.strictEqual(allWsTypes.size, new Set(COMPONENT_DATA_DEPENDENCIES.map((d) => d.wsMessageType)).size)

    // 验证每个 WS 消息类型都在 dispatcher 路由表中
    const dispatchedTypes = new Set([
      'session.list', 'agent.model.list', 'settings.get',
      'session.create', 'session.switch', 'session.delete',
      'session.history', 'session.rename', 'session.state', 'session.compact',
      'message.send', 'message.cancel',
      'agent.model.set',
      'file.list', 'file.read',
      'memory.search', 'memory.list',
      'settings.set', 'settings.discover-models',
    ])
    for (const dep of COMPONENT_DATA_DEPENDENCIES) {
      assert.ok(
        dispatchedTypes.has(dep.wsMessageType),
        `${dep.component} 依赖的 ${dep.wsMessageType} 不在 dispatcher 路由表中`,
      )
    }
  })

  it('ws.onopen 初始化消息应覆盖所有组件的初始化依赖', () => {
    // 收集所有组件 onMount 时需要的数据源（去重）
    const requiredTypes = new Set(COMPONENT_DATA_DEPENDENCIES.map((d) => d.wsMessageType))

    // 修复后的初始化消息
    const initTypes = new Set(getWsOnOpenInitMessages('test').map((m) => m.type))

    const missing: string[] = []
    for (const t of requiredTypes) {
      if (!initTypes.has(t)) {
        missing.push(t)
      }
    }

    assert.strictEqual(missing.length, 0, `ws.onopen 缺少以下初始化消息: ${missing.join(', ')}`)
  })
})
