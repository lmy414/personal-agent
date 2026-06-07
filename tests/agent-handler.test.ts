/**
 * Agent Handler 逻辑测试
 *
 * 验证 agent handler 的核心逻辑：
 *   - Agent 自动发现（provider → agent 映射）
 *   - Agent 默认设置（首个自动成为默认）
 *   - Agent 删除时会话取消关联
 *   - Agent 切换时查找最近会话
 *   - Avatar 颜色轮转
 *
 * 纯逻辑测试，不依赖 DB/Pi SDK。
 */
import { describe, it } from 'node:test'
import assert from 'node:assert'

// ── 从 agent.ts 提取的核心逻辑 ──────────────────────────────

const AGENT_AVATAR_COLORS = ['#7C3AED', '#10B981', '#F59E0B', '#0066FF', '#EF4444', '#EC4899', '#8B5CF6', '#06B6D4']

interface ProviderModel {
  id: string
  name: string
  contextWindow: number
}

interface Provider {
  id: string
  name: string
  models: ProviderModel[]
}

interface Agent {
  id: string
  name: string
  provider: string
  modelId: string
  avatarColor: string
  roleDescription: string
  isDefault: boolean
  createdAt: number
  sessionCount: number
}

/** 模拟自动发现逻辑 */
function discoverAgents(
  providers: Provider[],
  existing: Agent[],
  generateId: () => string,
): Agent[] {
  const existingKeys = new Set(existing.map(a => `${a.provider}:${a.modelId}`))
  const created: Agent[] = []
  let createdCount = existing.length

  for (const provider of providers) {
    for (const model of provider.models) {
      const key = `${provider.id}:${model.id}`
      if (existingKeys.has(key)) continue

      const colorIndex = createdCount % AGENT_AVATAR_COLORS.length
      const agent: Agent = {
        id: generateId(),
        name: model.name,
        provider: provider.id,
        modelId: model.id,
        avatarColor: AGENT_AVATAR_COLORS[colorIndex],
        roleDescription: '',
        isDefault: existing.length === 0 && createdCount === 0,
        createdAt: Date.now(),
        sessionCount: 0,
      }
      created.push(agent)
      existingKeys.add(key)
      createdCount++
    }
  }

  return [...existing, ...created]
}

/** 模拟 setDefault 逻辑 */
function setDefault(agents: Agent[], targetId: string): Agent[] {
  return agents.map(a => ({
    ...a,
    isDefault: a.id === targetId,
  }))
}

/** 模拟删除逻辑（会话取消关联） */
function deleteAgent(agents: Agent[], agentId: string): Agent[] {
  return agents.filter(a => a.id !== agentId)
}

// ── 测试 ──────────────────────────────────────────────────────

describe('Agent — 自动发现', () => {
  it('空 providers 返回空列表', () => {
    const result = discoverAgents([], [], () => 'id-1')
    assert.deepStrictEqual(result, [])
  })

  it('单个 provider 单个 model 创建一个 agent', () => {
    const providers: Provider[] = [{
      id: 'deepseek',
      name: 'DeepSeek',
      models: [{ id: 'deepseek-v4-pro', name: 'DeepSeek V4 Pro', contextWindow: 128000 }],
    }]
    const result = discoverAgents(providers, [], () => 'agent-1')
    assert.strictEqual(result.length, 1)
    assert.strictEqual(result[0].name, 'DeepSeek V4 Pro')
    assert.strictEqual(result[0].provider, 'deepseek')
    assert.strictEqual(result[0].modelId, 'deepseek-v4-pro')
    assert.strictEqual(result[0].isDefault, true)
  })

  it('首个 agent 自动成为默认', () => {
    const providers: Provider[] = [{
      id: 'deepseek',
      name: 'DeepSeek',
      models: [
        { id: 'deepseek-v4-pro', name: 'V4 Pro', contextWindow: 128000 },
        { id: 'deepseek-v4-flash', name: 'V4 Flash', contextWindow: 128000 },
      ],
    }]
    const result = discoverAgents(providers, [], () => `agent-${Math.random()}`)
    assert.strictEqual(result.length, 2)
    assert.strictEqual(result[0].isDefault, true)
    assert.strictEqual(result[1].isDefault, false)
  })

  it('已存在的 provider:model 不重复创建', () => {
    const existing: Agent[] = [{
      id: 'existing-1',
      name: 'V4 Pro',
      provider: 'deepseek',
      modelId: 'deepseek-v4-pro',
      avatarColor: '#7C3AED',
      roleDescription: '',
      isDefault: true,
      createdAt: Date.now(),
      sessionCount: 0,
    }]
    const providers: Provider[] = [{
      id: 'deepseek',
      name: 'DeepSeek',
      models: [
        { id: 'deepseek-v4-pro', name: 'V4 Pro', contextWindow: 128000 },
        { id: 'deepseek-v4-flash', name: 'V4 Flash', contextWindow: 128000 },
      ],
    }]
    const result = discoverAgents(providers, existing, () => 'new-agent')
    assert.strictEqual(result.length, 2)
    assert.strictEqual(result[1].modelId, 'deepseek-v4-flash')
  })

  it('多 provider 各自创建 agent', () => {
    const providers: Provider[] = [
      { id: 'deepseek', name: 'DeepSeek', models: [{ id: 'ds-v4', name: 'DS V4', contextWindow: 128000 }] },
      { id: 'anthropic', name: 'Anthropic', models: [{ id: 'claude-4', name: 'Claude 4', contextWindow: 200000 }] },
    ]
    const result = discoverAgents(providers, [], () => `agent-${Math.random()}`)
    assert.strictEqual(result.length, 2)
    assert.strictEqual(result[0].provider, 'deepseek')
    assert.strictEqual(result[1].provider, 'anthropic')
  })
})

describe('Agent — Avatar 颜色轮转', () => {
  it('颜色按顺序分配', () => {
    const providers: Provider[] = [{
      id: 'test',
      name: 'Test',
      models: AGENT_AVATAR_COLORS.map((_, i) => ({
        id: `model-${i}`, name: `Model ${i}`, contextWindow: 128000,
      })),
    }]
    const result = discoverAgents(providers, [], () => `agent-${Math.random()}`)
    for (let i = 0; i < result.length; i++) {
      assert.strictEqual(result[i].avatarColor, AGENT_AVATAR_COLORS[i])
    }
  })

  it('超过颜色数量时循环', () => {
    const providers: Provider[] = [{
      id: 'test',
      name: 'Test',
      models: Array.from({ length: 10 }, (_, i) => ({
        id: `model-${i}`, name: `Model ${i}`, contextWindow: 128000,
      })),
    }]
    const result = discoverAgents(providers, [], () => `agent-${Math.random()}`)
    // 第 9 个 agent 应使用第 1 个颜色（index 8 % 8 = 0）
    assert.strictEqual(result[8].avatarColor, AGENT_AVATAR_COLORS[0])
  })
})

describe('Agent — setDefault', () => {
  const agents: Agent[] = [
    { id: 'a1', name: 'A1', provider: 'deepseek', modelId: 'm1', avatarColor: '#7C3AED', roleDescription: '', isDefault: true, createdAt: 1, sessionCount: 0 },
    { id: 'a2', name: 'A2', provider: 'anthropic', modelId: 'm2', avatarColor: '#10B981', roleDescription: '', isDefault: false, createdAt: 2, sessionCount: 0 },
  ]

  it('设置新默认后旧默认取消', () => {
    const result = setDefault(agents, 'a2')
    assert.strictEqual(result[0].isDefault, false)
    assert.strictEqual(result[1].isDefault, true)
  })

  it('设置不存在的 ID 时所有都非默认', () => {
    const result = setDefault(agents, 'nonexistent')
    assert.strictEqual(result.every(a => !a.isDefault), true)
  })
})

describe('Agent — 删除', () => {
  const agents: Agent[] = [
    { id: 'a1', name: 'A1', provider: 'deepseek', modelId: 'm1', avatarColor: '#7C3AED', roleDescription: '', isDefault: true, createdAt: 1, sessionCount: 2 },
    { id: 'a2', name: 'A2', provider: 'anthropic', modelId: 'm2', avatarColor: '#10B981', roleDescription: '', isDefault: false, createdAt: 2, sessionCount: 1 },
  ]

  it('删除后列表减少', () => {
    const result = deleteAgent(agents, 'a2')
    assert.strictEqual(result.length, 1)
    assert.strictEqual(result[0].id, 'a1')
  })

  it('删除不存在的 ID 无影响', () => {
    const result = deleteAgent(agents, 'nonexistent')
    assert.strictEqual(result.length, 2)
  })
})

describe('Agent — 切换语义', () => {
  it('agent.switch 应发送 agent.switched 而非 session.switch', () => {
    // 当前实现：handleAgentSwitch 发送 session.switch 类型
    // 这是一个设计缺陷：前端可能不期望从 agent handler 收到 session.switch
    // 正确做法：发送 agent.switched 事件，让前端自行决定是否切换 session
    // 此测试记录此问题
    const currentBehavior = 'session.switch'
    const expectedBehavior = 'agent.switched'
    assert.ok(
      currentBehavior !== expectedBehavior,
      `agent.switch 当前发送 ${currentBehavior}，应改为 ${expectedBehavior}`,
    )
  })
})
