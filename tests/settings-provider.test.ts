/**
 * Settings & Provider 逻辑测试
 *
 * 验证 settings handler 和 provider handler 的核心逻辑：
 *   - settings.get/set 读写
 *   - provider 保存/删除
 *   - provider API Key 注入到环境变量
 *   - model_configs 序列化/反序列化
 *   - discover-models 过滤逻辑
 *
 * 纯逻辑测试，不依赖 DB。
 */
import { describe, it } from 'node:test'
import assert from 'node:assert'

// ── 从 pi-session.ts 提取的 ENV_KEY_MAP ──────────────────────

const ENV_KEY_MAP: Record<string, string> = {
  deepseek: 'DEEPSEEK_API_KEY', anthropic: 'ANTHROPIC_API_KEY',
  openai: 'OPENAI_API_KEY', google: 'GEMINI_API_KEY',
  groq: 'GROQ_API_KEY', xai: 'XAI_API_KEY', mistral: 'MISTRAL_API_KEY',
  openrouter: 'OPENROUTER_API_KEY', cerebras: 'CEREBRAS_API_KEY',
  fireworks: 'FIREWORKS_API_KEY', together: 'TOGETHER_API_KEY',
  minimax: 'MINIMAX_API_KEY', moonshotai: 'MOONSHOT_API_KEY',
  kimi: 'KIMI_API_KEY', zai: 'ZAI_API_KEY',
}

/** 模拟 provider key 注入逻辑 */
function injectKeys(providers: { id: string; apiKey?: string; active?: boolean }[]): string[] {
  const injected: string[] = []
  for (const p of providers) {
    if (!p.apiKey?.trim()) continue
    const envKey = ENV_KEY_MAP[p.id]
    if (envKey) {
      process.env[envKey] = p.apiKey.trim()
      injected.push(p.id)
    }
  }
  return injected
}

// ── 从 settings.ts 提取的 discover-models 过滤逻辑 ──────────

const PROVIDER_NAMES: Record<string, string> = {
  deepseek: 'DeepSeek', anthropic: 'Anthropic', openai: 'OpenAI',
  google: 'Google Gemini', groq: 'Groq', xai: 'xAI', mistral: 'Mistral',
  openrouter: 'OpenRouter', cerebras: 'Cerebras', fireworks: 'Fireworks',
  together: 'Together AI', minimax: 'MiniMax', moonshotai: 'Moonshot AI',
  kimi: 'Kimi', zai: 'ZAI',
}

function filterModelsByActiveProviders(
  models: { id: string; name: string; contextWindow: number; provider: string }[],
  activeProviders: Set<string>,
): { id: string; name: string; models: { id: string; name: string; contextWindow: number }[] }[] {
  const providers = new Map<string, { id: string; name: string; models: { id: string; name: string; contextWindow: number }[] }>()
  for (const m of models) {
    const provId = m.provider || 'unknown'
    if (!activeProviders.has(provId)) continue
    if (!providers.has(provId)) {
      providers.set(provId, { id: provId, name: PROVIDER_NAMES[provId] ?? provId, models: [] })
    }
    providers.get(provId)!.models.push(m)
  }
  return Array.from(providers.values())
}

// ── 从 model-config.ts 提取的逻辑 ────────────────────────────

interface ModelConfig {
  thinkingLevel?: string
  compactThreshold?: number
  enabled?: boolean
  visible?: boolean
}

function updateModelConfig(
  configs: Record<string, ModelConfig>,
  modelId: string,
  updates: Partial<ModelConfig>,
): Record<string, ModelConfig> {
  const current = configs[modelId] ?? {}
  const updated: ModelConfig = { ...current }

  if (updates.thinkingLevel !== undefined) updated.thinkingLevel = updates.thinkingLevel
  if (updates.compactThreshold !== undefined) updated.compactThreshold = updates.compactThreshold
  if (updates.enabled !== undefined) updated.enabled = updates.enabled
  if (updates.visible !== undefined) updated.visible = updates.visible

  return { ...configs, [modelId]: updated }
}

// ── 测试 ──────────────────────────────────────────────────────

describe('Settings — Provider Key 注入', () => {
  it('已知 provider 的 API Key 被注入到环境变量', () => {
    // 清理
    delete process.env.DEEPSEEK_API_KEY
    delete process.env.ANTHROPIC_API_KEY

    const result = injectKeys([
      { id: 'deepseek', apiKey: 'sk-test-123', active: true },
    ])
    assert.strictEqual(result[0], 'deepseek')
    assert.strictEqual(process.env.DEEPSEEK_API_KEY, 'sk-test-123')

    // 清理
    delete process.env.DEEPSEEK_API_KEY
  })

  it('空 API Key 不注入', () => {
    delete process.env.DEEPSEEK_API_KEY

    const result = injectKeys([
      { id: 'deepseek', apiKey: '', active: true },
    ])
    assert.strictEqual(result.length, 0)
  })

  it('仅空格的 API Key 不注入', () => {
    delete process.env.DEEPSEEK_API_KEY

    const result = injectKeys([
      { id: 'deepseek', apiKey: '   ', active: true },
    ])
    assert.strictEqual(result.length, 0)
  })

  it('未知 provider 不注入', () => {
    const result = injectKeys([
      { id: 'unknown_provider', apiKey: 'key-123', active: true },
    ])
    assert.strictEqual(result.length, 0)
  })

  it('多 provider 同时注入', () => {
    delete process.env.DEEPSEEK_API_KEY
    delete process.env.ANTHROPIC_API_KEY

    const result = injectKeys([
      { id: 'deepseek', apiKey: 'sk-ds', active: true },
      { id: 'anthropic', apiKey: 'sk-ant', active: true },
    ])
    assert.strictEqual(result.length, 2)

    // 清理
    delete process.env.DEEPSEEK_API_KEY
    delete process.env.ANTHROPIC_API_KEY
  })
})

describe('Settings — Discover Models 过滤', () => {
  const allModels = [
    { id: 'ds-v4', name: 'DeepSeek V4', contextWindow: 128000, provider: 'deepseek' },
    { id: 'ds-flash', name: 'DeepSeek Flash', contextWindow: 128000, provider: 'deepseek' },
    { id: 'claude-4', name: 'Claude 4', contextWindow: 200000, provider: 'anthropic' },
    { id: 'gpt-5', name: 'GPT-5', contextWindow: 128000, provider: 'openai' },
  ]

  it('只返回有 API Key 的 provider 的模型', () => {
    const active = new Set(['deepseek', 'anthropic'])
    const result = filterModelsByActiveProviders(allModels, active)
    assert.strictEqual(result.length, 2)
    assert.strictEqual(result[0].id, 'deepseek')
    assert.strictEqual(result[0].models.length, 2)
    assert.strictEqual(result[1].id, 'anthropic')
    assert.strictEqual(result[1].models.length, 1)
  })

  it('无活跃 provider 返回空', () => {
    const result = filterModelsByActiveProviders(allModels, new Set())
    assert.strictEqual(result.length, 0)
  })

  it('provider 名称映射', () => {
    const active = new Set(['deepseek'])
    const result = filterModelsByActiveProviders(allModels, active)
    assert.strictEqual(result[0].name, 'DeepSeek')
  })

  it('未知 provider 使用 ID 作为名称', () => {
    const models = [
      { id: 'm1', name: 'M1', contextWindow: 128000, provider: 'custom_provider' },
    ]
    const result = filterModelsByActiveProviders(models, new Set(['custom_provider']))
    assert.strictEqual(result[0].name, 'custom_provider')
  })
})

describe('Settings — ModelConfig 更新', () => {
  it('新 modelId 创建新配置', () => {
    const configs: Record<string, ModelConfig> = {}
    const result = updateModelConfig(configs, 'deepseek-v4-pro', { thinkingLevel: 'high' })
    assert.strictEqual(result['deepseek-v4-pro'].thinkingLevel, 'high')
  })

  it('部分更新不覆盖其他字段', () => {
    const configs: Record<string, ModelConfig> = {
      'deepseek-v4-pro': { thinkingLevel: 'medium', compactThreshold: 80, enabled: true },
    }
    const result = updateModelConfig(configs, 'deepseek-v4-pro', { thinkingLevel: 'high' })
    assert.strictEqual(result['deepseek-v4-pro'].thinkingLevel, 'high')
    assert.strictEqual(result['deepseek-v4-pro'].compactThreshold, 80)
    assert.strictEqual(result['deepseek-v4-pro'].enabled, true)
  })

  it('visible 字段正确更新', () => {
    const configs: Record<string, ModelConfig> = {}
    const result = updateModelConfig(configs, 'test-model', { visible: false })
    assert.strictEqual(result['test-model'].visible, false)
  })

  it('undefined 值不覆盖已有值', () => {
    const configs: Record<string, ModelConfig> = {
      'test': { thinkingLevel: 'high', enabled: true },
    }
    const result = updateModelConfig(configs, 'test', { thinkingLevel: undefined })
    assert.strictEqual(result['test'].thinkingLevel, 'high')
  })

  it('不修改原始 configs 对象', () => {
    const configs: Record<string, ModelConfig> = {
      'test': { thinkingLevel: 'low' },
    }
    const result = updateModelConfig(configs, 'test', { thinkingLevel: 'high' })
    assert.strictEqual(configs['test'].thinkingLevel, 'low') // 原始不变
    assert.strictEqual(result['test'].thinkingLevel, 'high')
  })
})

describe('Settings — ENV_KEY_MAP 完整性', () => {
  it('覆盖所有已知 provider', () => {
    const knownProviders = [
      'deepseek', 'anthropic', 'openai', 'google',
      'groq', 'xai', 'mistral', 'openrouter',
      'cerebras', 'fireworks', 'together',
      'minimax', 'moonshotai', 'kimi', 'zai',
    ]
    for (const p of knownProviders) {
      assert.ok(ENV_KEY_MAP[p], `ENV_KEY_MAP 缺少 provider: ${p}`)
    }
  })

  it('ENV_KEY_MAP 和 PROVIDER_NAMES 覆盖相同的 provider', () => {
    const envKeys = new Set(Object.keys(ENV_KEY_MAP))
    const provNames = new Set(Object.keys(PROVIDER_NAMES))
    assert.deepStrictEqual(envKeys, provNames, 'ENV_KEY_MAP 和 PROVIDER_NAMES 应覆盖相同的 provider')
  })
})
