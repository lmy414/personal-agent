import { createSignal } from 'solid-js'

export type SettingsEntry = { key: string; value: string }

/**
 * 设置状态管理 — settings signal + WS 读写操作
 */
export function createSettings(send: (type: string, payload: unknown) => void) {
  const [entries, setEntries] = createSignal<SettingsEntry[]>([])

  const getSettings = () => send('settings.get', {})
  const setSetting = (key: string, value: string) => send('settings.set', { key, value })

  // ── Provider CRUD ──

  const saveProvider = (id: string, name: string, opts?: { apiUrl?: string; apiKey?: string; active?: boolean }) =>
    send('provider.save', { id, name, apiUrl: opts?.apiUrl, apiKey: opts?.apiKey, active: opts?.active ?? true })

  const deleteProvider = (id: string) => send('provider.delete', { id })

  // ── Model configuration ──

  const configureModel = (modelId: string, config: { thinkingLevel?: string; compactThreshold?: number; enabled?: boolean }) =>
    send('model.configure', { modelId, ...config })

  return { entries, setEntries, getSettings, setSetting, saveProvider, deleteProvider, configureModel }
}

export type SettingsStore = ReturnType<typeof createSettings>
