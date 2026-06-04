import * as fs from 'node:fs'
import * as path from 'node:path'
import type { ModelManifest, ExpressionRef, MotionGroupRef, Groups, GroupRef } from './types.js'

interface CubismModel3Json {
  Version: number
  Name?: string
  FileReferences: {
    Moc: string
    Textures: string[]
    Physics?: string
    Pose?: string
    Expressions?: Array<{ Name: string; File: string }>
    Motions?: Record<string, Array<{ File: string; Sound?: string; Text?: string }>>
    [key: string]: unknown
  }
  Groups?: Array<{ Target: string; Name: string; Ids: string[] }>
  HitAreas?: unknown[]
}

export function readModelManifest(modelPath: string): ModelManifest {
  const raw = fs.readFileSync(modelPath, 'utf-8')
  const json = JSON.parse(raw) as CubismModel3Json

  if (!json.FileReferences?.Moc) {
    throw new Error(`无效的 model3.json: 缺少 FileReferences.Moc — ${modelPath}`)
  }

  const baseDir = path.dirname(modelPath)
  const name = json.Name ?? path.basename(baseDir)

  // Parse expression list
  const expressions: ExpressionRef[] = (json.FileReferences.Expressions ?? []).map(
    (e) => ({
      name: e.Name,
      file: e.File,
    }),
  )

  // Parse motion group list
  const motions: MotionGroupRef[] = []
  if (json.FileReferences.Motions) {
    for (const [groupName, entries] of Object.entries(json.FileReferences.Motions)) {
      motions.push({
        name: groupName,
        files: entries.map((e) => e.File),
      })
    }
  }

  // Parse Groups (EyeBlink, LipSync parameter mappings)
  const groups: Groups = {}
  if (json.Groups) {
    for (const g of json.Groups) {
      if (g.Target !== 'Parameter') continue
      if (!g.Ids || g.Ids.length === 0) continue // skip empty groups
      const ref: GroupRef = { name: g.Name, ids: g.Ids }
      if (g.Name === 'EyeBlink') groups.eyeBlink = ref
      else if (g.Name === 'LipSync') groups.lipSync = ref
    }
  }

  return { name, expressions, motions, groups, rawPath: modelPath, baseDir }
}
