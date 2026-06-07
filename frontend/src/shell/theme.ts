/**
 * 主题系统 — CSS 变量驱动，零后端依赖
 *
 * 切换主题 = 更新 :root 上的 CSS 变量 + 持久化到 settings
 * 恢复主题 = 从 settings 读取 + 应用到 :root
 */

import { createSignal } from 'solid-js'

export interface ThemeDef {
  id: string
  name: string
  color: string       // hex e.g. #6B8FA8
  rgb: string         // "107,143,168"
  secondary: string   // hex for accent-secondary
  secondaryRgb: string // "91,140,90"
}

export const THEMES: ThemeDef[] = [
  { id: 'mio-blue',   name: '澪号暗蓝', color: '#6B8FA8', rgb: '107,143,168', secondary: '#5B8C5A', secondaryRgb: '91,140,90' },
  { id: 'emerald',    name: '翡翠绿',   color: '#5B8C5A', rgb: '91,140,90',   secondary: '#6B8FA8', secondaryRgb: '107,143,168' },
  { id: 'amber',      name: '琥珀橙',   color: '#C8963E', rgb: '200,150,62',  secondary: '#5B8C5A', secondaryRgb: '91,140,90' },
  { id: 'sakura',     name: '樱花紫',   color: '#8B7FB8', rgb: '139,127,184', secondary: '#5B8C5A', secondaryRgb: '91,140,90' },
  { id: 'graphite',   name: '石墨灰',   color: '#7A8B94', rgb: '122,139,148', secondary: '#5B8C5A', secondaryRgb: '91,140,90' },
]

const DEFAULT_THEME_ID = 'mio-blue'

// 全局响应式信号 — 组件 inline style 可读取
const [accentRgb, setAccentRgb] = createSignal('107,143,168')
const [accentHex, setAccentHex] = createSignal('#6B8FA8')

/** 当前 accent RGB 值（响应式），用于 inline style: `rgba(${accentRgb()}, 0.4)` */
export { accentRgb, accentHex }

export function getThemeById(id: string): ThemeDef {
  return THEMES.find(t => t.id === id) ?? THEMES[0]
}

/** 应用主题到 :root CSS 变量 + 更新响应式信号 */
export function applyTheme(theme: ThemeDef): void {
  const root = document.documentElement
  root.style.setProperty('--accent', theme.color)
  root.style.setProperty('--accent-rgb', theme.rgb)
  root.style.setProperty('--accent-secondary', theme.secondary)
  root.style.setProperty('--accent-secondary-rgb', theme.secondaryRgb)
  // 气泡系统也跟随主题
  root.style.setProperty('--bubble-user-bg',
    `linear-gradient(135deg, rgba(${theme.rgb},0.22), rgba(${theme.secondaryRgb},0.15))`)
  root.style.setProperty('--bubble-user-border', `rgba(${theme.rgb},0.16)`)
  root.style.setProperty('--avatar-glow-color', `rgba(${theme.rgb},0.2)`)
  // 更新响应式信号
  setAccentRgb(theme.rgb)
  setAccentHex(theme.color)
}

/** hex → "R,G,B" */
function hexToRgb(hex: string): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.substring(0, 2), 16)
  const g = parseInt(h.substring(2, 4), 16)
  const b = parseInt(h.substring(4, 6), 16)
  return `${r},${g},${b}`
}

/** 自定义 accent 颜色（覆盖当前主题的 accent） */
export function applyCustomAccent(hex: string): void {
  const rgb = hexToRgb(hex)
  const root = document.documentElement
  root.style.setProperty('--accent', hex)
  root.style.setProperty('--accent-rgb', rgb)
  root.style.setProperty('--bubble-user-border', `rgba(${rgb},0.16)`)
  root.style.setProperty('--avatar-glow-color', `rgba(${rgb},0.2)`)
  setAccentRgb(rgb)
  setAccentHex(hex)
}

/** 玻璃面板色调 — 控制 --glass-tint-rgb */
export function applyGlassTint(rgb: string): void {
  document.documentElement.style.setProperty('--glass-tint-rgb', rgb)
}

/** 从 settings 恢复自定义 accent（如果有） */
export function restoreCustomAccent(settingsEntries: { key: string; value: string }[]): void {
  const entry = settingsEntries.find(e => e.key === 'custom-accent')
  if (entry?.value) applyCustomAccent(entry.value)
}

/** 从 settings 恢复玻璃色调 */
export function restoreGlassTint(settingsEntries: { key: string; value: string }[]): void {
  const entry = settingsEntries.find(e => e.key === 'glass-tint')
  if (entry?.value) applyGlassTint(entry.value)
}

/** 顶部标题栏色调 — 控制 --top-bar-tint-rgb */
export function applyTopBarTint(rgb: string): void {
  document.documentElement.style.setProperty('--top-bar-tint-rgb', rgb)
}

/** 从 settings 恢复顶部标题栏色调 */
export function restoreTopBarTint(settingsEntries: { key: string; value: string }[]): void {
  const entry = settingsEntries.find(e => e.key === 'top-bar-tint')
  if (entry?.value) applyTopBarTint(entry.value)
}

/** 从 settings entries 中恢复主题 */
export function restoreTheme(settingsEntries: { key: string; value: string }[]): void {
  const entry = settingsEntries.find(e => e.key === 'theme')
  const themeId = entry?.value ?? DEFAULT_THEME_ID
  applyTheme(getThemeById(themeId))
}

/** 壁纸路径 → 应用到 body background-image */
export function applyWallpaper(path: string | null): void {
  document.body.style.backgroundImage = path ? `url('${path}')` : 'none'
}

/** 从 settings entries 中恢复壁纸 */
export function restoreWallpaper(settingsEntries: { key: string; value: string }[]): void {
  const entry = settingsEntries.find(e => e.key === 'wallpaper')
  applyWallpaper(entry?.value ?? '/wallpapers/default-bg.jpg')
}
