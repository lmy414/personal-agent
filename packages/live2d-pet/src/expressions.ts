import * as fs from 'node:fs'
import * as path from 'node:path'
import type { ModelManifest, ParameterCommand } from './types.js'

// ═══════════════════════════════════════
// Expression name list
// ═══════════════════════════════════════

export interface ExpressionEntry {
  name: string
  source: 'model'
  description: string
}

/** 返回模型在 model3.json 中定义的所有表达式 */
export function listExpressions(manifest: ModelManifest): ExpressionEntry[] {
  return manifest.expressions.map((expr) => ({
    name: expr.name,
    source: 'model' as const,
    description: '',
  }))
}

// ═══════════════════════════════════════
// Resolve expression → parameter array（用于 status 查询，不用于 WS 广播）
// ═══════════════════════════════════════

/**
 * 读取 .exp3.json 文件返回参数列表。
 * 仅用于 live2d_status 查询——WS 广播 expression 时只发名字，
 * 由渲染器用 Cubism SDK 加载 .exp3.json 并应用。
 */
export function resolveExpression(
  manifest: ModelManifest,
  name: string,
): ParameterCommand[] | null {
  const exprRef = manifest.expressions.find((e) => e.name === name)
  if (!exprRef) return null

  const exprPath = path.resolve(manifest.baseDir, exprRef.file)
  if (!fs.existsSync(exprPath)) {
    return null
  }

  try {
    const raw = fs.readFileSync(exprPath, 'utf-8')
    const json = JSON.parse(raw) as { Parameters?: Array<{ Id: string; Value: number; Blend?: string }> }
    if (!json.Parameters) return []
    return json.Parameters.map((p) => ({
      id: p.Id,
      value: p.Value,
    }))
  } catch {
    return null
  }
}

/** 检查表达式名是否有效 */
export function isValidExpression(manifest: ModelManifest, name: string): boolean {
  return manifest.expressions.some((e) => e.name === name)
}
