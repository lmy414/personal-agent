import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { resolve, join } from 'path'

/**
 * 生成 .pi/settings.json（若不存在）
 * 使用 baseDir 推导扩展目录的绝对路径
 */
export function initPiConfig(baseDir: string): void {
  const piDir = resolve(baseDir, '.pi')
  if (!existsSync(piDir)) mkdirSync(piDir, { recursive: true })

  const piSettingsPath = join(piDir, 'settings.json')
  if (existsSync(piSettingsPath)) return

  const extDir = resolve(baseDir, '../extensions')
  writeFileSync(piSettingsPath, JSON.stringify({
    extensions: [
      resolve(extDir, 'pa-mio/index.ts'),
      resolve(extDir, 'pa-files/index.ts'),
      resolve(extDir, 'pa-mcp/index.ts'),
    ],
  }, null, 2))
  console.log('[bridge] .pi/settings.json generated with 3 extensions')
}
