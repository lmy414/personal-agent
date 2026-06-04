import type { ModelManifest, ParameterCommand } from './types.js'

export interface AnimationDef {
  name: string
  description: string
  params: ParameterCommand[]
}

/**
 * 从模型 Groups 动态构造语义动画参数。
 *
 * - wink/blink: 使用 manifest.groups.eyeBlink.ids（回退标准 ID）
 * - nod/shake/tilt: 使用 ParamAngleX/Y/Z（Cubism 标准参数，几乎通用）
 */
export function buildAnimations(manifest: ModelManifest): AnimationDef[] {
  const rawEyeIds = manifest.groups.eyeBlink?.ids
  const eyeIds = (rawEyeIds && rawEyeIds.length > 0) ? rawEyeIds : ['ParamEyeLOpen', 'ParamEyeROpen']
  const leftEye = eyeIds[0]

  return [
    {
      name: 'wink',
      description: '单眼眨',
      params: [
        { id: leftEye, value: 0, duration: 120, easing: 'easeInOut' },
        { id: leftEye, value: 1, duration: 120, easing: 'easeInOut' },
      ],
    },
    {
      name: 'slow_blink',
      description: '慢眨眼',
      params: [
        ...eyeIds.map((id) => ({ id, value: 0, duration: 400, easing: 'easeInOut' as const })),
        ...eyeIds.map((id) => ({ id, value: 1, duration: 400, easing: 'easeInOut' as const })),
      ],
    },
    {
      name: 'double_blink',
      description: '快速连眨两次',
      params: [
        ...eyeIds.map((id) => ({ id, value: 0, duration: 80, easing: 'easeInOut' as const })),
        ...eyeIds.map((id) => ({ id, value: 1, duration: 80, easing: 'easeInOut' as const })),
        ...eyeIds.map((id) => ({ id, value: 0, duration: 80, easing: 'easeInOut' as const })),
        ...eyeIds.map((id) => ({ id, value: 1, duration: 80, easing: 'easeInOut' as const })),
      ],
    },
    {
      name: 'nod',
      description: '点头',
      params: [
        { id: 'ParamAngleX', value: -15, duration: 250, easing: 'easeInOut' },
        { id: 'ParamAngleX', value: 0, duration: 250, easing: 'easeInOut' },
        { id: 'ParamAngleX', value: -10, duration: 200, easing: 'easeInOut' },
        { id: 'ParamAngleX', value: 0, duration: 200, easing: 'easeInOut' },
      ],
    },
    {
      name: 'shake_head',
      description: '摇头',
      params: [
        { id: 'ParamAngleY', value: -15, duration: 200, easing: 'easeInOut' },
        { id: 'ParamAngleY', value: 15, duration: 200, easing: 'easeInOut' },
        { id: 'ParamAngleY', value: -10, duration: 200, easing: 'easeInOut' },
        { id: 'ParamAngleY', value: 0, duration: 150, easing: 'easeInOut' },
      ],
    },
    {
      name: 'tilt_head',
      description: '歪头',
      params: [
        { id: 'ParamAngleZ', value: -20, duration: 300, easing: 'easeInOut' },
        { id: 'ParamAngleZ', value: 0, duration: 300, easing: 'easeInOut' },
      ],
    },
  ]
}

export function listAnimations(manifest: ModelManifest): AnimationDef[] {
  return buildAnimations(manifest)
}

export function resolveAnimation(manifest: ModelManifest, name: string): AnimationDef | null {
  return buildAnimations(manifest).find((a) => a.name === name) ?? null
}
