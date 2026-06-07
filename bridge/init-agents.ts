import { discoverAgents as _discoverAgents } from './handlers/agent'

/**
 * 启动时触发 Agent 自动发现（从 providers 配置生成默认 Agent）
 */
export function initAgents(): void {
  try {
    const agentCount = _discoverAgents().length
    console.log(`[bridge] agents initialized: ${agentCount} total`)
  } catch (err) {
    console.warn('[bridge] agent discovery failed:', err)
  }
}
