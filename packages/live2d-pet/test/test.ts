/**
 * Integration test — tests MCP protocol + tool dispatch logic
 *
 * Usage: npx tsx test/test.ts
 */
import { readModelManifest } from '../src/model-reader.js'
import { createTools, dispatchTool } from '../src/tools.js'
import { listExpressions } from '../src/expressions.js'
import { listAnimations, resolveAnimation } from '../src/animations.js'
import { readConfig } from '../src/config.js'

let failures = 0
let passed = 0

function assert(condition: boolean, label: string): void {
  if (condition) {
    console.log(`  ✓ ${label}`)
    passed++
  } else {
    console.error(`  ✗ ${label}`)
    failures++
  }
}

async function main(): Promise<void> {
  console.log('=== Live2D MCP 集成测试（新协议 v2）===\n')

  // Read config
  let manifest: ReturnType<typeof readModelManifest> | null = null
  try {
    const config = readConfig()
    console.log(`配置: OK (模型: ${config.model.path})`)
    manifest = readModelManifest(config.model.path)
    console.log(`模型名: ${manifest.name}`)
    console.log(`表情数: ${manifest.expressions.length}`)
    console.log(`动作组: ${manifest.motions.length}`)
    console.log(`Groups: eyeBlink=${manifest.groups.eyeBlink?.ids.join(',') ?? '(无)'}, lipSync=${manifest.groups.lipSync?.ids.join(',') ?? '(无)'}`)
  } catch (e) {
    console.error(`配置错误: ${(e as Error).message}`)
    console.log('跳过需要模型的测试...')
  }

  if (!manifest) {
    printResults()
    return
  }

  // ── Expressions (model-only, no builtins) ──
  console.log('\n── 表情（仅模型定义）──')
  const exprs = listExpressions(manifest)
  // 不再测试内置表情 — 所有表情来自模型
  console.log(`  模型定义了 ${exprs.length} 个表情`)
  for (const e of exprs) {
    console.log(`    ${e.name} (${e.source})`)
  }

  // ── Animations (dynamic IDs from Groups) ──
  console.log('\n── 语义动画（动态参数 ID）──')
  const anims = listAnimations(manifest)
  assert(anims.length === 6, `listAnimations 返回 ${anims.length} 个动画`)
  assert(anims.some((a) => a.name === 'wink'), '动画 wink 存在')
  assert(anims.some((a) => a.name === 'slow_blink'), '动画 slow_blink 存在')
  assert(anims.some((a) => a.name === 'double_blink'), '动画 double_blink 存在')
  assert(anims.some((a) => a.name === 'nod'), '动画 nod 存在')
  assert(anims.some((a) => a.name === 'shake_head'), '动画 shake_head 存在')
  assert(anims.some((a) => a.name === 'tilt_head'), '动画 tilt_head 存在')
  const wink = resolveAnimation(manifest, 'wink')!
  assert(wink.params.length >= 2, `wink 参数数 >= 2`)
  // 验证 wink 使用了模型实际的 eye blink ID（非硬编码）
  const rawEyeIds = manifest.groups.eyeBlink?.ids
  const testEyeIds = (rawEyeIds && rawEyeIds.length > 0) ? rawEyeIds : ['ParamEyeLOpen', 'ParamEyeROpen']
  assert(
    wink.params[0].id === testEyeIds[0],
    `wink 使用模型 blink ID: ${wink.params[0].id} (来源: ${manifest.groups.eyeBlink ? 'Groups.EyeBlink' : 'fallback'})`,
  )
  assert(resolveAnimation(manifest, 'nonexistent') === null, '不存在动画返回 null')

  // ── Tool definitions ──
  console.log('\n── 工具定义 ──')
  const tools = createTools(manifest)
  assert(tools.length === 5, `createTools 返回 ${tools.length} 个工具`)
  const toolNames = tools.map((t) => t.name)
  assert(toolNames.includes('live2d_expression'), '工具 live2d_expression 已注册')
  assert(toolNames.includes('live2d_motion'), '工具 live2d_motion 已注册')
  assert(toolNames.includes('live2d_status'), '工具 live2d_status 已注册')
  assert(toolNames.includes('live2d_parameter'), '工具 live2d_parameter 已注册')
  assert(toolNames.includes('live2d_animate'), '工具 live2d_animate 已注册')

  // ── Tool dispatch ──
  console.log('\n── 工具调度 ──')
  const statusResult = dispatchTool('live2d_status', {}, manifest)
  assert(
    statusResult.content[0].text.includes(manifest.name),
    'live2d_status 包含模型名称',
  )
  // Groups info should be in status
  if (manifest.groups.eyeBlink) {
    assert(
      statusResult.content[0].text.includes('眨眼参数组'),
      'live2d_status 包含眨眼参数组',
    )
  }

  // Expression: now takes model expression name
  if (manifest.expressions.length > 0) {
    const firstExpr = manifest.expressions[0].name
    const exprResult = dispatchTool('live2d_expression', { name: firstExpr }, manifest)
    assert(
      exprResult.content[0].text.includes(firstExpr),
      `live2d_expression(${firstExpr}) 返回成功`,
    )
  }

  // Bad expression still errors
  const badExpr = dispatchTool('live2d_expression', { name: 'nonexistent_xyz' }, manifest)
  assert(
    badExpr.content[0].text.includes('未知表情'),
    'live2d_expression(不存在) 返回错误',
  )

  // Motion: now uses group + index
  if (manifest.motions.length > 0) {
    const firstMotion = manifest.motions[0].name
    const motionResult = dispatchTool('live2d_motion', { group: firstMotion, index: 0 }, manifest)
    assert(
      motionResult.content[0].text.includes(firstMotion),
      `live2d_motion(${firstMotion}[0]) 返回成功`,
    )
  }

  const paramResult = dispatchTool(
    'live2d_parameter',
    { params: [{ id: 'ParamAngleX', value: 0.5 }] },
    manifest,
  )
  assert(
    paramResult.content[0].text.includes('1 项'),
    'live2d_parameter 返回成功',
  )

  const animResult = dispatchTool('live2d_animate', { name: 'wink' }, manifest)
  assert(
    animResult.content[0].text.includes('wink'),
    'live2d_animate(wink) 返回成功',
  )

  printResults()
}

function printResults(): void {
  console.log(`\n=== 结果: ${passed} 通过, ${failures} 失败 ===`)
  if (failures > 0) process.exit(1)
}

main()
