import { createSignal } from 'solid-js'

export type SettingsEntry = { key: string; value: string }

/**
 * 设置状态管理 — settings signal + WS 读写操作
 */
export function createSettings(send: (type: string, payload: unknown) => void) {
  const [entries, setEntries] = createSignal<SettingsEntry[]>([])

  const getSettings = () => send('settings.get', {})
  const setSetting = (key: string, value: string) => send('settings.set', { key, value })

  return { entries, setEntries, getSettings, setSetting }
}

export type SettingsStore = ReturnType<typeof createSettings>
