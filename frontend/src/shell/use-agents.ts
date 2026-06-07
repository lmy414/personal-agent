import { createSignal } from 'solid-js'
import type { AgentInfo } from '@bridge/protocol'

/**
 * 智能体 (Agent) 状态管理 — agents signal + WS 读写操作 + 服务端事件处理
 */
export function createAgents(send: (type: string, payload: unknown) => void) {
  const [agents, setAgents] = createSignal<AgentInfo[]>([])

  // ── 服务端事件处理 ──

  const handleAgentList = (list: AgentInfo[]) => setAgents(list)

  const handleAgentCreated = (agent: AgentInfo) => {
    setAgents((prev) => {
      if (prev.some((a) => a.id === agent.id)) return prev
      return [...prev, agent]
    })
  }

  const handleAgentUpdated = (agent: AgentInfo) => {
    setAgents((prev) => prev.map((a) => (a.id === agent.id ? agent : a)))
  }

  const handleAgentDeleted = (agentId: string) => {
    setAgents((prev) => prev.filter((a) => a.id !== agentId))
  }

  const handleAgentDefaultChanged = (agentId: string) => {
    setAgents((prev) => prev.map((a) => ({ ...a, isDefault: a.id === agentId })))
  }

  // ── 用户操作 ──

  const switchAgent = (agentId: string) => send('agent.switch', { agentId })

  const createAgent = (
    name: string, provider: string, modelId: string,
    opts?: { avatarColor?: string; roleDescription?: string },
  ) => send('agent.create', { name, provider, modelId, ...opts })

  const updateAgent = (
    agentId: string, updates: { name?: string; avatarColor?: string; roleDescription?: string },
  ) => send('agent.update', { agentId, ...updates })

  const deleteAgent = (agentId: string) => send('agent.delete', { agentId })

  const setDefaultAgent = (agentId: string) => send('agent.set_default', { agentId })

  return {
    agents,
    handleAgentList,
    handleAgentCreated,
    handleAgentUpdated,
    handleAgentDeleted,
    handleAgentDefaultChanged,
    switchAgent,
    createAgent,
    updateAgent,
    deleteAgent,
    setDefaultAgent,
  }
}

export type AgentsStore = ReturnType<typeof createAgents>
