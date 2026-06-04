import type { ModelManifest, MCPToolDef, MCPCallResult, ParameterCommand } from './types.js'
import type { WSHub } from './ws-hub.js'
import { listExpressions, isValidExpression } from './expressions.js'
import { listAnimations, resolveAnimation } from './animations.js'

function listMotionNames(manifest: ModelManifest): string[] {
  return manifest.motions.map((m) => m.name)
}

export function createTools(manifest: ModelManifest, _ws?: WSHub): MCPToolDef[] {
  const exprNames = listExpressions(manifest).map((e) => e.name)
  const motionNames = listMotionNames(manifest)
  const animDefs = listAnimations(manifest)
  const animNames = animDefs.map((a) => a.name)

  const eyeInfo = manifest.groups.eyeBlink
    ? ` (眨眼参数: ${manifest.groups.eyeBlink.ids.join(', ')})`
    : ' (模型未导出 EyeBlink group，眨眼动画使用标准参数)'

  return [
    {
      name: 'live2d_expression',
      description:
        '切换 Live2D 表情。从模型定义的表情中选择。' +
        (exprNames.length > 0
          ? '可用: ' + exprNames.join(', ')
          : '当前模型无表情定义'),
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: '表情名称。可选: ' + (exprNames.join(', ') || '(无)'),
          },
        },
        required: ['name'],
      },
    },
    {
      name: 'live2d_motion',
      description:
        '播放 Live2D 动作组。从模型定义的动作组中选择。' +
        (motionNames.length > 0
          ? '可用: ' + motionNames.join(', ')
          : '当前模型无可用动作组'),
      inputSchema: {
        type: 'object',
        properties: {
          group: { type: 'string', description: '动作组名称。可选: ' + (motionNames.join(', ') || '(无)') },
          index: { type: 'number', description: '该组中的动作索引，默认 0' },
        },
        required: ['group'],
      },
    },
    {
      name: 'live2d_status',
      description: '获取 Live2D 状态：模型名称、可用表情、动作组、动画列表、参数组信息',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'live2d_parameter',
      description:
        '直接操控 Live2D 底层参数。参数 ID 因模型而异，通过 live2d_status 获取可用参数。' +
        '通用标准参数: ParamAngleX(点头)/Y(摇头)/Z(歪头)' + eyeInfo,
      inputSchema: {
        type: 'object',
        properties: {
          params: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', description: '参数 ID（模型特定）' },
                value: { type: 'number', description: '目标值' },
                duration: { type: 'number', description: '过渡时长(ms)，默认 0' },
                easing: { type: 'string', description: '缓动: linear/easeIn/easeOut/easeInOut' },
              },
              required: ['id', 'value'],
            },
          },
        },
        required: ['params'],
      },
    },
    {
      name: 'live2d_animate',
      description:
        '播放语义动画（自动适配模型参数 ID）。可用: ' +
        animDefs.map((a) => `${a.name}(${a.description})`).join(', ') + eyeInfo,
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: '动画名称。可选: ' + animNames.join(', '),
          },
        },
        required: ['name'],
      },
    },
  ]
}

export function dispatchTool(
  toolName: string,
  args: Record<string, unknown>,
  manifest: ModelManifest,
  ws?: WSHub,
): MCPCallResult {
  switch (toolName) {
    case 'live2d_status': {
      const exprList = listExpressions(manifest)
      const animList = listAnimations(manifest)
      const motionList = listMotionNames(manifest)
      const eyeIds = manifest.groups.eyeBlink?.ids
      const lipIds = manifest.groups.lipSync?.ids
      const lines = [
        `模型: ${manifest.name}`,
        `模型路径: ${manifest.rawPath}`,
        `表情(${exprList.length}): ${exprList.map((e) => e.name).join(', ') || '(无)'}`,
        `动作组(${motionList.length}): ${motionList.join(', ') || '(无)'}`,
        `动画(${animList.length}): ${animList.map((a) => `${a.name}(${a.description})`).join(', ')}`,
      ]
      if (eyeIds) lines.push(`眨眼参数组: ${eyeIds.join(', ')}`)
      if (lipIds) lines.push(`唇形参数组: ${lipIds.join(', ')}`)
      if (!eyeIds && !lipIds) lines.push('参数组: 模型未导出 Groups（EyeBlink/LipSync）')
      return { content: [{ type: 'text', text: lines.join('\n') }] }
    }

    case 'live2d_expression': {
      const name = args.name as string
      if (!name || typeof name !== 'string') {
        return { content: [{ type: 'text', text: '错误: 缺少表情名称参数' }] }
      }
      if (!isValidExpression(manifest, name)) {
        const available = listExpressions(manifest).map((e) => e.name).join(', ') || '(无)'
        return { content: [{ type: 'text', text: `未知表情: ${name}。可用: ${available}` }] }
      }
      // 只发名字，渲染器用 Cubism SDK 加载 .exp3.json
      ws?.broadcast({ type: 'expression', name })
      return { content: [{ type: 'text', text: `表情已切换: ${name}` }] }
    }

    case 'live2d_motion': {
      const group = args.group as string
      const index = (args.index as number) ?? 0
      if (!group || typeof group !== 'string') {
        return { content: [{ type: 'text', text: '错误: 缺少动作组名称 (group) 参数' }] }
      }
      const motion = manifest.motions.find((m) => m.name === group)
      if (!motion) {
        const available = listMotionNames(manifest).join(', ') || '(无)'
        return { content: [{ type: 'text', text: `未知动作组: ${group}。可用: ${available}` }] }
      }
      // 只发 group+index，渲染器用 Cubism SDK 加载 .motion3.json
      ws?.broadcast({ type: 'motion', group, index: Number(index) })
      return { content: [{ type: 'text', text: `动作已播放: ${group}[${index}]` }] }
    }

    case 'live2d_parameter': {
      const params = args.params as ParameterCommand[] | undefined
      if (!params || !Array.isArray(params) || params.length === 0) {
        return { content: [{ type: 'text', text: '错误: 缺少 params 参数数组' }] }
      }
      ws?.broadcast({ type: 'parameter', params })
      return { content: [{ type: 'text', text: `参数已应用 (${params.length} 项)` }] }
    }

    case 'live2d_animate': {
      const name = args.name as string
      if (!name || typeof name !== 'string') {
        return { content: [{ type: 'text', text: '错误: 缺少动画名称参数' }] }
      }
      const anim = resolveAnimation(manifest, name)
      if (!anim) {
        const available = listAnimations(manifest).map((a) => a.name).join(', ')
        return { content: [{ type: 'text', text: `未知动画: ${name}。可用: ${available}` }] }
      }
      ws?.broadcast({ type: 'animate', animation: name, params: anim.params })
      return { content: [{ type: 'text', text: `动画已播放: ${name} (${anim.description})` }] }
    }

    default:
      return { content: [{ type: 'text', text: `未知工具: ${toolName}` }] }
  }
}
