import type { WebSocket } from 'ws'
import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync, rmSync, copyFileSync } from 'fs'
import { join, basename } from 'path'
import { homedir } from 'os'
import { execSync } from 'child_process'
import type { ClientMessage, SkillSummary } from '../protocol'

// ========== 技能目录 ==========

function getUserSkillsDir(): string {
  return join(homedir(), '.claude', 'agent', 'skills')
}

function getProjectSkillsDir(): string {
  return join(process.cwd(), '.claude', 'skills')
}

function getSkillsDir(source: 'user' | 'project'): string {
  return source === 'user' ? getUserSkillsDir() : getProjectSkillsDir()
}

// ========== 禁用列表 ==========

interface DisabledList {
  disabled: string[]
}

function readDisabledList(dir: string): Set<string> {
  const disabled = new Set<string>()
  const file = join(dir, '.disabled-skills.json')
  try {
    const raw = JSON.parse(readFileSync(file, 'utf-8'))
    for (const name of raw.disabled ?? []) disabled.add(name)
  } catch { /* 文件不存在 = 无禁用 */ }
  return disabled
}

function writeDisabledList(dir: string, disabled: Set<string>): void {
  const file = join(dir, '.disabled-skills.json')
  writeFileSync(file, JSON.stringify({ disabled: Array.from(disabled) }, null, 2), 'utf-8')
}

/** 暴露给 pi-session.ts 使用 */
export function loadDisabledSkills(): Set<string> {
  const disabled = new Set<string>()
  for (const dir of [getUserSkillsDir(), getProjectSkillsDir()]) {
    for (const name of readDisabledList(dir)) {
      disabled.add(name)
    }
  }
  return disabled
}

// ========== 技能扫描 ==========

function scanSkills(source: 'user' | 'project'): SkillSummary[] {
  const dir = getSkillsDir(source)
  if (!existsSync(dir)) return []

  const disabled = readDisabledList(dir)
  const skills: SkillSummary[] = []

  try {
    const entries = readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue
      const skillMdPath = join(dir, entry.name, 'SKILL.md')
      if (!existsSync(skillMdPath)) continue

      // 解析 YAML frontmatter 提取 name 和 description
      let name = entry.name
      let description = ''
      try {
        const content = readFileSync(skillMdPath, 'utf-8')
        const match = content.match(/^---\n([\s\S]*?)\n---/)
        if (match) {
          const fm = match[1]
          const nameMatch = fm.match(/^name:\s*(.+)$/m)
          const descMatch = fm.match(/^description:\s*(.+)$/m)
          if (nameMatch) name = nameMatch[1].trim()
          if (descMatch) description = descMatch[1].trim()
        }
      } catch { /* 解析失败用默认值 */ }

      skills.push({
        name,
        description,
        source,
        enabled: !disabled.has(name),
        filePath: skillMdPath,
      })
    }
  } catch { /* 目录读取失败 */ }

  return skills
}

function scanAllSkills(): SkillSummary[] {
  return [...scanSkills('user'), ...scanSkills('project')]
}

// ========== 广播 ==========

const clients = new Set<WebSocket>()

export function addSkillClient(ws: WebSocket): void {
  clients.add(ws)
}

export function removeSkillClient(ws: WebSocket): void {
  clients.delete(ws)
}

function broadcast(msg: object): void {
  const raw = JSON.stringify(msg)
  for (const ws of clients) {
    if (ws.readyState === ws.OPEN) {
      ws.send(raw)
    }
  }
}

function broadcastSkillsState(): void {
  broadcast({
    type: 'skills.state',
    id: `srv-${Date.now()}`,
    sessionId: '',
    ts: Date.now(),
    payload: { skills: scanAllSkills() },
  })
}

// ========== Handlers ==========

export function handleSkillsList(_msg: ClientMessage, ws: WebSocket): void {
  addSkillClient(ws)
  broadcastSkillsState()
}

export function handleSkillsInstall(msg: ClientMessage, ws: WebSocket): void {
  const { zipPath, target } = msg.payload as { zipPath: string; target: 'user' | 'project' }
  const destDir = getSkillsDir(target)

  // 校验
  if (!existsSync(zipPath)) {
    ws.send(JSON.stringify({
      type: 'error', id: msg.id, sessionId: msg.sessionId, ts: Date.now(),
      payload: { code: 'FILE_NOT_FOUND', message: `文件不存在: ${zipPath}`, recoverable: true },
    }))
    return
  }

  if (!zipPath.toLowerCase().endsWith('.zip')) {
    ws.send(JSON.stringify({
      type: 'error', id: msg.id, sessionId: msg.sessionId, ts: Date.now(),
      payload: { code: 'INVALID_FORMAT', message: '仅支持 .zip 格式', recoverable: true },
    }))
    return
  }

  // 解压
  const tmpDir = join(destDir, '.tmp-install-' + Date.now())
  try {
    mkdirSync(destDir, { recursive: true })
    mkdirSync(tmpDir, { recursive: true })

    // 使用系统命令解压
    if (process.platform === 'win32') {
      execSync(`powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${tmpDir}' -Force"`, { encoding: 'utf-8' })
    } else {
      execSync(`unzip -o "${zipPath}" -d "${tmpDir}"`, { encoding: 'utf-8' })
    }

    // 扫描找到技能文件夹
    const tmpEntries = readdirSync(tmpDir, { withFileTypes: true })
    let installedCount = 0

    for (const entry of tmpEntries) {
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        const skillMd = join(tmpDir, entry.name, 'SKILL.md')
        if (existsSync(skillMd)) {
          const dest = join(destDir, entry.name)
          if (existsSync(dest)) rmSync(dest, { recursive: true })
          copyDirSync(join(tmpDir, entry.name), dest)
          installedCount++
          continue
        }
      }
      // 检查根目录是否有 SKILL.md（扁平结构）
      if (entry.isFile() && entry.name === 'SKILL.md') {
        const folderName = basename(zipPath, '.zip')
        const dest = join(destDir, folderName)
        if (existsSync(dest)) rmSync(dest, { recursive: true })
        mkdirSync(dest, { recursive: true })
        copyDirSync(tmpDir, dest)
        installedCount++
        break
      }
    }

    if (installedCount === 0) {
      ws.send(JSON.stringify({
        type: 'error', id: msg.id, sessionId: msg.sessionId, ts: Date.now(),
        payload: { code: 'INVALID_SKILL', message: '无效的技能包（未找到 SKILL.md）', recoverable: true },
      }))
      return
    }

    // 清理 + 广播
    rmSync(tmpDir, { recursive: true })
    broadcastSkillsState()

    ws.send(JSON.stringify({
      type: 'skills.installed',
      id: msg.id,
      sessionId: '',
      ts: Date.now(),
      payload: { name: basename(zipPath), source: target },
    }))

  } catch (err) {
    // 清理临时目录
    try { rmSync(tmpDir, { recursive: true }) } catch { /* ignore */ }
    ws.send(JSON.stringify({
      type: 'error', id: msg.id, sessionId: msg.sessionId, ts: Date.now(),
      payload: { code: 'INSTALL_FAILED', message: `安装失败: ${err}`, recoverable: true },
    }))
  }
}

export function handleSkillsToggle(msg: ClientMessage, _ws: WebSocket): void {
  const { name, source, enabled } = msg.payload as { name: string; source: 'user' | 'project'; enabled: boolean }
  const dir = getSkillsDir(source)
  const disabled = readDisabledList(dir)

  if (enabled) {
    disabled.delete(name)
  } else {
    disabled.add(name)
  }

  writeDisabledList(dir, disabled)
  broadcastSkillsState()
}

export function handleSkillsRemove(msg: ClientMessage, _ws: WebSocket): void {
  const { name, source } = msg.payload as { name: string; source: 'user' | 'project' }
  const dir = getSkillsDir(source)
  const skillDir = join(dir, name)

  if (!existsSync(skillDir)) {
    return // 已经不存在了
  }

  rmSync(skillDir, { recursive: true })

  // 清理禁用列表
  const disabled = readDisabledList(dir)
  disabled.delete(name)
  writeDisabledList(dir, disabled)

  broadcastSkillsState()
}

// ========== 工具函数 ==========

function copyDirSync(src: string, dest: string): void {
  mkdirSync(dest, { recursive: true })
  const entries = readdirSync(src, { withFileTypes: true })
  for (const entry of entries) {
    const srcPath = join(src, entry.name)
    const destPath = join(dest, entry.name)
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath)
    } else {
      copyFileSync(srcPath, destPath)
    }
  }
}
