#!/usr/bin/env -S npx tsx
/**
 * 澪号 Personal Agent — 全功能自动化测试套件
 *
 * 运行: npx tsx tests/run-all.ts
 * 或:   npm run test (在根目录)
 *
 * 覆盖模块:
 *   1. TypeScript 编译检查 (bridge + frontend)
 *   2. Protocol 协议层 (createEnvelope, parseMessage, 类型覆盖)
 *   3. Memory Store (创建/CRUD/安全扫描/检索/持久化/Unicode)
 *   4. Bridge Dispatcher (路由表完整性, handler 命名)
 *   5. Bridge Memory Handler (getAllMemories, searchMemories)
 *   6. 文件完整性检查 (index.ts, SOUL.md, MEMORY.md/USER.md)
 *   7. 配置文件检查 (.env, .pi/settings.json, package.json)
 */

import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname!, '..')
const TESTS_DIR = path.resolve(import.meta.dirname!)

let passed = 0
let failed = 0
let skipped = 0
const failures: string[] = []

// ── Reporter ──────────────────────────────────────────────

function section(title: string) {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`  ${title}`)
  console.log(`${'='.repeat(60)}`)
}

function ok(label: string) {
  passed++
  console.log(`  ✅ ${label}`)
}

function fail(label: string, detail?: string) {
  failed++
  const msg = detail ? `${label} — ${detail}` : label
  failures.push(msg)
  console.log(`  ❌ ${msg}`)
}

function skip(label: string) {
  skipped++
  console.log(`  ⏭️  ${label}`)
}

// ── Helpers ───────────────────────────────────────────────

function runCmd(cmd: string, cwd: string): { ok: boolean; stdout: string } {
  try {
    const stdout = execSync(cmd, { cwd, encoding: 'utf-8', timeout: 60000, stdio: 'pipe' })
    return { ok: true, stdout }
  } catch (e: any) {
    return { ok: false, stdout: e.stdout || e.stderr || e.message }
  }
}

function fileExists(p: string): boolean {
  return fs.existsSync(path.resolve(ROOT, p))
}

function readText(p: string): string {
  try { return fs.readFileSync(path.resolve(ROOT, p), 'utf-8') } catch { return '' }
}

// ── 1. TypeScript 编译检查 ────────────────────────────────

async function checkTypeScript() {
  section('1. TypeScript 编译检查')

  // Bridge
  console.log('  📦 bridge/ tsc --noEmit ...')
  const bridge = runCmd('npx tsc --noEmit', path.join(ROOT, 'bridge'))
  if (bridge.ok) {
    ok('bridge/ typecheck 通过')
  } else {
    // 区分 vendor/pi 错误（非自建代码）和 bridge 自身错误
    const lines = bridge.stdout.split('\n')
    const ownErrors = lines.filter(l => !l.includes('vendor/pi/') && l.includes('error TS'))
    const vendorErrors = lines.filter(l => l.includes('vendor/pi/') && l.includes('error TS'))
    if (vendorErrors.length > 0 && ownErrors.length === 0) {
      ok(`bridge/ typecheck: 自建代码无错误 (vendor/pi 有 ${vendorErrors.length} 个上游错误，已忽略)`)
    } else if (ownErrors.length > 0) {
      fail('bridge/ typecheck 失败', ownErrors.slice(0, 3).join('\n'))
    } else {
      fail('bridge/ typecheck 失败', bridge.stdout.slice(0, 500))
    }
  }

  // Frontend
  console.log('  📦 frontend/ tsc --noEmit ...')
  const frontend = runCmd('npx tsc --noEmit', path.join(ROOT, 'frontend'))
  if (frontend.ok) {
    ok('frontend/ typecheck 通过')
  } else {
    fail('frontend/ typecheck 失败', frontend.stdout.slice(0, 500))
  }
}

// ── 2. 运行 node:test 测试套件 ─────────────────────────────

async function runNodeTest(label: string, testFile: string) {
  console.log(`  🧪 ${label} ...`)
  const result = runCmd(
    `npx tsx --test "${testFile}"`,
    ROOT,
  )
  if (result.ok) {
    ok(label)
  } else {
    // Extract test summary
    const lines = result.stdout.split('\n').filter((l: string) =>
      l.includes('✔') || l.includes('✖') || l.includes('tests') || l.includes('pass') || l.includes('fail')
    )
    fail(label, lines.slice(-5).join(' | ') || result.stdout.slice(0, 300))
  }
}

// ── 3. 文件完整性检查 ─────────────────────────────────────

async function checkFileIntegrity() {
  section('2. 文件完整性检查')

  // Required files
  const requiredFiles = [
    'bridge/index.ts',
    'bridge/protocol.ts',
    'bridge/dispatcher.ts',
    'bridge/.pi/settings.json',
    'bridge/package.json',
    'bridge/tsconfig.json',
    'frontend/src/index.tsx',
    'frontend/src/registry.ts',
    'frontend/src/shell/App.tsx',
    'frontend/src/shell/useAgent.tsx',
    'frontend/package.json',
    'frontend/tsconfig.json',
    'extensions/pa-mio/index.ts',
    'extensions/pa-files/index.ts',
    'extensions/shared/memory-store.ts',
    'mio-harness/SOUL.md',
    'mio-harness/memories/MEMORY.md',
    'mio-harness/memories/USER.md',
    '.env',
    'package.json',
  ]

  let missing = 0
  for (const f of requiredFiles) {
    if (fileExists(f)) {
      // ok — too noisy to list all
    } else {
      missing++
      fail(`缺少文件: ${f}`)
    }
  }
  if (missing === 0) {
    ok(`全部 ${requiredFiles.length} 个关键文件存在`)
  }

  // Bridge .pi/settings.json 注册检查
  const settingsJson = readText('bridge/.pi/settings.json')
  try {
    const piSettings = JSON.parse(settingsJson)
    const exts = piSettings.extensions || []
    if (exts.length === 3) {
      ok(`bridge/.pi/settings.json 注册 ${exts.length} 个扩展: ${exts.map((e: string) => path.basename(path.dirname(e))).join(', ')}`)
    } else {
      fail(`bridge/.pi/settings.json 扩展数量: 期望 3, 实际 ${exts.length}`)
    }
  } catch {
    fail('bridge/.pi/settings.json 非法 JSON')
  }
}

// ── 4. 配置检查 ───────────────────────────────────────────

async function checkConfig() {
  section('3. 配置文件检查')

  // .env
  const env = readText('.env')
  if (env.includes('DEEPSEEK_API_KEY=sk-')) {
    ok('.env 包含 DEEPSEEK_API_KEY')
  } else {
    fail('.env 缺少或格式错误的 DEEPSEEK_API_KEY')
  }

  // Root package.json
  try {
    const pkg = JSON.parse(readText('package.json'))
    const scripts = Object.keys(pkg.scripts || {})
    if (scripts.includes('dev') && scripts.includes('check')) {
      ok(`package.json scripts: dev, check`)
    } else {
      fail(`package.json 缺少 dev/check scripts`)
    }
  } catch {
    fail('package.json 非法 JSON')
  }

  // Bridge package.json
  try {
    const bpkg = JSON.parse(readText('bridge/package.json'))
    if (bpkg.scripts?.dev && bpkg.scripts?.check) {
      ok('bridge/package.json 有 dev + check')
    } else {
      fail('bridge/package.json 缺少 scripts')
    }
  } catch {
    fail('bridge/package.json 非法 JSON')
  }

  // Frontend package.json
  try {
    const fpkg = JSON.parse(readText('frontend/package.json'))
    if (fpkg.scripts?.dev && fpkg.scripts?.check) {
      ok('frontend/package.json 有 dev + check')
    } else {
      fail('frontend/package.json 缺少 scripts')
    }
  } catch {
    fail('frontend/package.json 非法 JSON')
  }
}

// ── 5. 扩展注册完整性 ─────────────────────────────────────

async function checkExtensions() {
  section('4. 扩展注册检查')

  // Frontend registry entries
  const registryText = readText('frontend/src/registry.ts')
  // Count SlotId type entries
  const slotMatch = registryText.match(/SlotId\s*=\s*(.*)/)
  if (slotMatch) {
    ok(`registry SlotId 类型: ${slotMatch[1].replace(/'/g, '')}`)
  }

  // Check all extension folders have index.ts
  const extDirs = fs.readdirSync(path.join(ROOT, 'frontend/src/extensions'), { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)

  for (const ext of extDirs) {
    const idxPath = path.join(ROOT, 'frontend/src/extensions', ext, 'index.ts')
    if (fs.existsSync(idxPath)) {
      // Check it has registry.register or an export
      const content = readText(`frontend/src/extensions/${ext}/index.ts`)
      if (content.includes('registry.register') || content.includes('export {')) {
        // ok
      } else {
        fail(`${ext}/index.ts 缺少 registry.register 或 export`)
      }
    } else {
      fail(`${ext}/index.ts 不存在`)
    }
  }
  ok(`${extDirs.length} 个前端扩展文件夹均有 index.ts`)
}

// ── 6. SOUL.md / Memory 内容检查 ───────────────────────────

async function checkPersonaFiles() {
  section('5. 人格 & 记忆文件检查')

  // SOUL.md
  const soul = readText('mio-harness/SOUL.md')
  if (soul.length > 0 && soul.length < 5120) {
    ok(`SOUL.md ${soul.length} chars (限制 <5KB)`)
  } else if (soul.length === 0) {
    fail('SOUL.md 为空')
  } else {
    fail(`SOUL.md ${soul.length} chars，超过 5KB 限制`)
  }

  // MEMORY.md
  const memory = readText('mio-harness/memories/MEMORY.md')
  const memEntries = memory.split('§').filter(e => e.trim().length > 0)
  if (memory.length <= 2200) {
    ok(`MEMORY.md ${memory.length} chars / ${memEntries.length} 条 § 条目 (限制 ≤2200)`)
  } else {
    fail(`MEMORY.md ${memory.length} chars，超过 2200 限制`)
  }

  // USER.md
  const user = readText('mio-harness/memories/USER.md')
  const userEntries = user.split('§').filter(e => e.trim().length > 0)
  if (user.length <= 1375) {
    ok(`USER.md ${user.length} chars / ${userEntries.length} 条 § 条目 (限制 ≤1375)`)
  } else {
    fail(`USER.md ${user.length} chars，超过 1375 限制`)
  }
}

// ── 7. 前端 Vite 构建检查 ─────────────────────────────────

async function checkViteBuild() {
  section('6. 前端 Vite 构建')

  console.log('  📦 frontend/ vite build ...')
  const build = runCmd('npx vite build', path.join(ROOT, 'frontend'))
  if (build.ok) {
    ok('frontend/ vite build 成功')
    // Check dist exists
    if (fileExists('frontend/dist/index.html')) {
      ok('frontend/dist/index.html 已生成')
    }
  } else {
    fail('frontend/ vite build 失败', build.stdout.slice(0, 400))
  }
}

// ── Main ──────────────────────────────────────────────────

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗')
  console.log('║     澪号 Personal Agent — 自动化检查套件 v2.0           ║')
  console.log('╚══════════════════════════════════════════════════════════╝')

  // Phase 1: Static checks (fast)
  await checkConfig()
  await checkFileIntegrity()
  await checkExtensions()
  await checkPersonaFiles()

  // Phase 2: TypeScript compilation
  await checkTypeScript()

  // Phase 3: Unit tests (node:test)
  section('7. 单元测试 (node:test)')
  await runNodeTest('Protocol 协议测试', 'tests/protocol.test.ts')
  await runNodeTest('Protocol 类型一致性测试', 'tests/protocol-types.test.ts')
  await runNodeTest('Memory Store 测试', 'tests/memory-store.test.ts')
  await runNodeTest('Dispatcher 路由测试', 'tests/dispatcher.test.ts')
  await runNodeTest('Bridge Memory 测试', 'tests/bridge-memory.test.ts')
  await runNodeTest('File Security 文件安全测试', 'tests/file-security.test.ts')
  await runNodeTest('Session Guard 会话保护测试', 'tests/session-guard.test.ts')
  await runNodeTest('Dataflow Consistency 数据流一致性测试', 'tests/dataflow-consistency.test.ts')
  await runNodeTest('Dispatcher-Protocol 一致性测试', 'tests/dispatcher-protocol-consistency.test.ts')
  await runNodeTest('Session Handler 逻辑测试', 'tests/session-handler.test.ts')
  await runNodeTest('Agent Handler 逻辑测试', 'tests/agent-handler.test.ts')
  await runNodeTest('Pi Adapter 翻译器测试', 'tests/pi-adapter.test.ts')
  await runNodeTest('Client Manager 广播逻辑测试', 'tests/client-manager.test.ts')
  await runNodeTest('Settings & Provider 逻辑测试', 'tests/settings-provider.test.ts')

  // Phase 4: Vite build
  await checkViteBuild()

  // ── Report ─────────────────────────────────────────────
  const total = passed + failed + skipped
  console.log(`\n${'='.repeat(60)}`)
  console.log(`  📊 检查报告`)
  console.log(`${'='.repeat(60)}`)
  console.log(`  Total:  ${total}`)
  console.log(`  Passed: ${passed}`)
  console.log(`  Failed: ${failed}`)
  console.log(`  Skipped: ${skipped}`)

  if (failures.length > 0) {
    console.log(`\n  ❌ 失败项:`)
    for (const f of failures) {
      console.log(`     - ${f}`)
    }
  }

  console.log(`\n  ${failed === 0 ? '🎉 全部通过!' : '⚠️  存在失败项'}`)

  process.exit(failed > 0 ? 1 : 0)
}

main().catch(err => {
  console.error('Test runner crashed:', err)
  process.exit(1)
})
