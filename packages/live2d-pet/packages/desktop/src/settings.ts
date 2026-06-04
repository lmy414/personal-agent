/**
 * Settings store — persisted to JSON file in app data directory.
 * Read/Write by Main Process, synced to Renderer via IPC.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { resolve } from 'path'
import { app } from 'electron'

export interface Live2DSettings {
  window: {
    width: number
    height: number
    x: number
    y: number
    opacity: number
    locked: boolean   // true = disable window drag
  }
  model: {
    scale: number      // 0 = auto, >0 = manual percentage
    offsetX: number    // pixels
    offsetY: number
    visible: boolean
  }
  ghost: {
    enabled: boolean
    idleTimeout: number  // seconds before ghost mode activates
  }
}

const defaults: Live2DSettings = {
  window: {
    width: 320,
    height: 440,
    x: -1,  // -1 = auto-position (bottom-right)
    y: -1,
    opacity: 1.0,
    locked: false,
  },
  model: {
    scale: 0,      // 0 = auto-calculate from window size
    offsetX: 0,
    offsetY: 0,
    visible: true,
  },
  ghost: {
    enabled: false,
    idleTimeout: 30,
  },
}

let settingsPath: string | null = null

function getPath(): string {
  if (settingsPath) return settingsPath
  const dir = resolve(app.getPath('userData'), 'config')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  settingsPath = resolve(dir, 'settings.json')
  return settingsPath
}

export function loadSettings(): Live2DSettings {
  try {
    const raw = readFileSync(getPath(), 'utf-8')
    const saved = JSON.parse(raw) as Record<string, unknown>
    return deepMerge(defaults as unknown as Record<string, unknown>, saved) as unknown as Live2DSettings
  } catch {
    return structuredClone(defaults)
  }
}

export function saveSettings(settings: Live2DSettings): void {
  try {
    writeFileSync(getPath(), JSON.stringify(settings, null, 2), 'utf-8')
  } catch (e) {
    console.error('[settings] failed to save:', e)
  }
}

export function updateSettings(
  current: Live2DSettings,
  patch: Partial<{
    'window.width': number
    'window.height': number
    'window.x': number
    'window.y': number
    'window.opacity': number
    'window.locked': boolean
    'model.scale': number
    'model.offsetX': number
    'model.offsetY': number
    'model.visible': boolean
    'ghost.enabled': boolean
    'ghost.idleTimeout': number
  }>,
): Live2DSettings {
  const next = deepClone(current) as Live2DSettings
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue
    const [section, prop] = key.split('.') as [keyof Live2DSettings, string]
    ;(next as unknown as Record<string, Record<string, unknown>>)[section][prop] = value
  }
  saveSettings(next)
  return next
}

function deepClone(obj: unknown): unknown {
  return JSON.parse(JSON.stringify(obj))
}

function deepMerge(base: Record<string, unknown>, override: Record<string, unknown>): Record<string, unknown> {
  const result = deepClone(base) as Record<string, unknown>
  for (const key of Object.keys(override)) {
    const bv = result[key]
    const ov = override[key]
    if (bv && typeof bv === 'object' && !Array.isArray(bv) && ov && typeof ov === 'object' && !Array.isArray(ov)) {
      result[key] = deepMerge(bv as Record<string, unknown>, ov as Record<string, unknown>)
    } else if (ov !== undefined) {
      result[key] = ov
    }
  }
  return result
}
