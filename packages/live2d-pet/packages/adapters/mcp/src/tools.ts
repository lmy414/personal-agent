// ============================================================
// MCP Tool Definitions — the external API that AI agents see.
// Built on top of @live2d-pet/protocol types.
// ============================================================

import type { ModelInfo } from '../../../protocol/src/types'

export type { ModelInfo }

export interface McpToolDef {
  name: string
  description: string
  inputSchema: {
    type: 'object'
    properties: Record<string, unknown>
    required?: string[]
  }
}

export const MCP_TOOLS: McpToolDef[] = [
  {
    name: 'model_load',
    description:
      '加载 Live2D 模型。指定包含 .model3.json 的目录路径，' +
      'SDK 会自动读取表情列表、参数列表和可用动作。' +
      '加载成功后可通过 expression_set / expression_list / action_perform 控制模型。',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: '模型目录的绝对路径，该目录下必须包含 .model3.json 文件',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'expression_set',
    description:
      '切换 Live2D 角色的表情。根据对话情绪选择合适的表情。' +
      '可用表情列表通过 expression_list 获取（需先 model_load）。',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: '表情名称，对应 .exp3.json 文件名（不含扩展名）',
        },
      },
      required: ['name'],
    },
  },
  {
    name: 'expression_list',
    description:
      '列出当前模型的所有可用表情及其描述。需先执行 model_load。',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'action_perform',
    description:
      '播放 Live2D 角色的语义动作。可用动作：' +
      'nod(点头)、shake_head(摇头)、tilt_head(歪头)、' +
      'wink(单眼眨)、slow_blink(慢眨眼)、double_blink(双眨眼)。',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: '动作名: nod / shake_head / tilt_head / wink / slow_blink / double_blink',
          enum: ['nod', 'shake_head', 'tilt_head', 'wink', 'slow_blink', 'double_blink'],
        },
        intensity: {
          type: 'number',
          description: '强度 0.0~1.0，默认 1.0。影响动作幅度',
          minimum: 0,
          maximum: 1,
        },
        count: {
          type: 'integer',
          description: '重复次数，默认 1',
          minimum: 1,
        },
      },
      required: ['name'],
    },
  },
  {
    name: 'action_list',
    description:
      '列出所有可用的语义动作。所有模型通用，不依赖特定 .motion3.json。',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'settings_get',
    description:
      '获取 Live2D 桌面宠物的所有当前设置：窗口大小、位置、透明度、模型缩放、偏移等。',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'settings_set',
    description:
      '修改桌面宠物设置。可修改：window.width(200-600)、window.height(260-800)、' +
      'window.x/y(屏幕坐标)、window.opacity(0.3-1.0)、' +
      'model.scale(0=自动,>0=百分比)、model.offsetX/Y(-200~200)、model.visible(bool)。',
    inputSchema: {
      type: 'object',
      properties: {
        'window.width': { type: 'number', description: '窗口宽度 (200-600)' },
        'window.height': { type: 'number', description: '窗口高度 (260-800)' },
        'window.x': { type: 'number', description: '窗口 X 坐标' },
        'window.y': { type: 'number', description: '窗口 Y 坐标' },
        'window.opacity': { type: 'number', description: '窗口透明度 (0.3-1.0)' },
        'model.scale': { type: 'number', description: '模型缩放 (0=自动, >0=百分比)' },
        'model.offsetX': { type: 'number', description: '模型横向偏移 (-200~200)' },
        'model.offsetY': { type: 'number', description: '模型纵向偏移 (-200~200)' },
        'model.visible': { type: 'boolean', description: '模型是否可见' },
      },
    },
  },
]

// ── Tool Handler Type ──────────────────────────────────

/**
 * Tool implementation. Receives parsed arguments, returns result content.
 * `context` is shared state (e.g. loaded model, expression manager).
 */
export type ToolHandler = (
  args: Record<string, unknown>,
  context: ToolContext,
) => Promise<ToolResult>

export interface ToolContext {
  // State that handlers can read/write
  modelInfo: ModelInfo | null
  modelPath: string | null
}

export interface ToolResult {
  content: Array<{ type: 'text'; text: string }>
  /** If true, the tool call is an error */
  isError?: boolean
}
