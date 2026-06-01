/**
 * pa-live2d — Live2D 控制工具
 *
 * 让 LLM 可以直接控制澪号的 Live2D 表情和动作。
 * 通过 WebSocket 发送指令到 Bridge，Bridge 广播给所有连接的浏览器。
 */
import type { ExtensionAPI } from '@mariozechner/pi-coding-agent'
import { defineTool } from '@mariozechner/pi-coding-agent'
import { Type } from '@mariozechner/pi-ai'
import { WebSocket } from 'ws'

const BRIDGE = 'ws://localhost:9229'

const EXPRESSIONS: Record<string, string> = {
  kongbai: '空白 — 默认无表情，平静状态',
  aixinyan: '爱心眼 — 喜欢、心动、被萌到',
  xingxingyan: '星星眼 — 兴奋、期待、眼睛发亮',
  lianhong: '脸红 — 害羞、不好意思、被夸了',
  duzui: '嘟嘴 — 撒娇、轻度不满、要说什么',
  guzui: '鼓嘴 — 可爱、憋着话、忍住不说',
  han: '汗 — 无奈、尴尬、无语',
  lei: '泪 — 悲伤、感动哭了、难过',
  lianhei: '脸黑 — 生气、暴躁、极度无语',
  lianqing: '脸青 — 震惊、苍白、吓到了',
  yun: '晕 — 头晕、受不了、被绕晕了',
  yuanquanyan: '圆圈眼 — 迷糊、晕头转向',
  xie: '斜眼 — 怀疑、鄙视、不信任',
  jiantou: '箭头 — 指向、强调、注意这里',
  xianhua: '鲜花 — 赞美、庆祝、送你花',
  huatong: '花筒 — 开心庆祝、party 气氛',
}

let ws: WebSocket | null = null
let pending: (() => void)[] = []

function getWs(): Promise<WebSocket> {
  return new Promise((resolve) => {
    if (ws && ws.readyState === WebSocket.OPEN) { resolve(ws); return }
    ws = new WebSocket(BRIDGE)
    ws.on('open', () => {
      console.log('[pa-live2d] connected to bridge')
      resolve(ws!)
      pending.forEach(fn => fn())
      pending = []
    })
    ws.on('close', () => { console.log('[pa-live2d] bridge disconnected'); ws = null })
    ws.on('error', () => { ws = null })
  })
}

function sendControl(tool: string, args: Record<string, string>): void {
  const raw = JSON.stringify({
    type: 'live2d.control',
    id: `pa-${Date.now()}`,
    sessionId: '',
    ts: Date.now(),
    payload: { tool, args },
  })
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(raw)
  } else {
    pending.push(() => ws!.send(raw))
    getWs()
  }
}

const exprTool = defineTool({
  name: 'live2d_expression',
  label: 'Live2D Expression',
  description:
    '切换澪号的 Live2D 表情。根据当前对话情绪选择合适的表情。' +
    '可用: ' + Object.entries(EXPRESSIONS).map(([k, v]) => `${k}(${v.split('—')[0].trim()})`).join('、'),
  parameters: Type.Object({
    name: Type.String({
      description: '表情名称。可选: ' + Object.keys(EXPRESSIONS).join(', '),
    }),
  }),
  execute: async (_id, params) => {
    const name = params.name as string
    if (!EXPRESSIONS[name]) {
      return {
        content: [{ type: 'text' as const, text: `未知表情: ${name}。可用: ${Object.keys(EXPRESSIONS).join(', ')}` }],
        details: {},
      }
    }
    sendControl('live2d_expression', { name })
    return {
      content: [{ type: 'text' as const, text: `表情已切换: ${EXPRESSIONS[name]}` }],
      details: {},
    }
  },
})

const motionTool = defineTool({
  name: 'live2d_motion',
  label: 'Live2D Motion',
  description: '播放澪号的 Live2D 动作。目前可用: Scene1（场景动作）。',
  parameters: Type.Object({
    name: Type.String({
      description: '动作名称。可选: Scene1',
    }),
  }),
  execute: async (_id, params) => {
    const name = (params.name as string) || 'Scene1'
    sendControl('live2d_motion', { name })
    return {
      content: [{ type: 'text' as const, text: `动作已播放: ${name}` }],
      details: {},
    }
  },
})

const statusTool = defineTool({
  name: 'live2d_status',
  label: 'Live2D Status',
  description: '获取澪号当前 Live2D 状态：可用表情列表、可用动作列表。',
  parameters: Type.Object({}),
  execute: async () => {
    const text = [
      `可用表情(${Object.keys(EXPRESSIONS).length}): ${Object.keys(EXPRESSIONS).join(', ')}`,
      `可用动作(1): Scene1`,
    ].join('\n')
    return { content: [{ type: 'text' as const, text }], details: {} }
  },
})

export default function register(api: ExtensionAPI) {
  console.log('[pa-live2d] Live2D 控制工具已加载')
  api.registerTool(exprTool)
  api.registerTool(motionTool)
  api.registerTool(statusTool)
}
