import { onMount, onCleanup, createSignal } from 'solid-js'
import { useAgent } from '@/shell/useAgent'
import type { ServerMessage } from '@bridge/protocol'

const ECHOBOT = 'http://localhost:8000'
const MODEL_URL = ECHOBOT + '/api/web/live2d/workspace/' + encodeURI('卡拉(2)') + '/' + encodeURI('卡拉.model3.json')

const EXPRESSIONS: Record<string, { name: string; type: 'file' | 'custom'; params?: { id: string; value: number; blend: string }[] }> = {
  kongbai:  { name: '空白', type: 'file' },
  aixinyan: { name: '爱心眼', type: 'file' },
  xingxingyan: { name: '星星眼', type: 'file' },
  lianhong: { name: '脸红', type: 'file' },
  duzui:    { name: '嘟嘴', type: 'file' },
  guzui:    { name: '鼓嘴', type: 'file' },
  han:      { name: '汗', type: 'file' },
  lei:      { name: '泪', type: 'file' },
  lianhei:  { name: '脸黑', type: 'file' },
  lianqing: { name: '脸青', type: 'file' },
  yun:      { name: '晕', type: 'file' },
  yuanquanyan: { name: '圆圈眼', type: 'file' },
  xie:      { name: '斜眼', type: 'file' },
  jiantou:  { name: '箭头', type: 'file' },
  xianhua:  { name: '鲜花', type: 'file' },
  huatong:  { name: '花筒', type: 'file' },
  smile:    { name: '微笑', type: 'custom', params: [
    { id: 'ParamEyeLSmile', value: 0.6, blend: 'Add' },
    { id: 'ParamEyeRSmile', value: 0.6, blend: 'Add' },
    { id: 'ParamMouthForm', value: 0.5, blend: 'Add' },
  ]},
  bigsmile: { name: '大笑', type: 'custom', params: [
    { id: 'ParamEyeLSmile', value: 1.0, blend: 'Add' },
    { id: 'ParamEyeRSmile', value: 1.0, blend: 'Add' },
    { id: 'ParamMouthForm', value: 0.8, blend: 'Add' },
    { id: 'ParamCheek', value: 0.5, blend: 'Add' },
    { id: 'ParamMouthOpenY', value: 0.3, blend: 'Add' },
  ]},
  sad:      { name: '难过', type: 'custom', params: [
    { id: 'ParamBrowLY', value: 0.4, blend: 'Add' },
    { id: 'ParamBrowRY', value: 0.4, blend: 'Add' },
    { id: 'ParamBrowLForm', value: -0.4, blend: 'Add' },
    { id: 'ParamBrowRForm', value: -0.4, blend: 'Add' },
    { id: 'ParamMouthForm', value: -0.3, blend: 'Add' },
  ]},
}

export function Live2DView() {
  const { subscribe, send } = useAgent()
  const [status, setStatus] = createSignal('未加载')
  let container!: HTMLDivElement
  let app: any, model: any, activeParams: { id: string; value: number; blend: string }[] | null = null

  // ── 动态加载 SDK 脚本 ──
  function loadScript(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script')
      s.src = src
      s.onload = () => resolve()
      s.onerror = () => reject(new Error('Failed to load: ' + src))
      document.head.appendChild(s)
    })
  }

  // ── 初始化 PIXI + Cubism ──
  async function initLive2D() {
    try {
      setStatus('加载 SDK...')
      await loadScript(ECHOBOT + '/web/assets/vendor/pixi.min.js')
      await loadScript(ECHOBOT + '/web/assets/vendor/live2dcubismcore.min.js')
      await loadScript(ECHOBOT + '/web/assets/vendor/cubism4.min.js')

      const P = (window as any).PIXI
      if (!P?.live2d) { setStatus('SDK 不可用'); return }

      setStatus('加载模型...')
      const cv = document.createElement('canvas')
      cv.style.width = '100%'
      cv.style.height = '100%'
      container.appendChild(cv)

      app = new P.Application({
        view: cv,
        resizeTo: container,
        backgroundAlpha: 0,
        antialias: true,
      })

      model = await P.live2d.Live2DModel.from(MODEL_URL, { autoInteract: false })
      app.stage.addChild(model)
      model.anchor.set(0.5, 0.5)
      model.x = app.screen.width / 2
      model.y = app.screen.height / 2 - 30
      model.scale.set(0.35)

      window.addEventListener('resize', reposition)
      // 标签切换时 display:none → block 导致 canvas 0 尺寸，强制重绘
      new ResizeObserver(() => {
        if (!app || !model) return
        app.renderer.resize(container.clientWidth, container.clientHeight)
        reposition()
      }).observe(container)

      function reposition() {
        model.x = app.screen.width / 2
        model.y = app.screen.height / 2 - 30
      }

      // 每帧应用表情参数
      model.internalModel.on('beforeModelUpdate', () => {
        if (!activeParams) return
        const cm = model.internalModel.coreModel
        if (!cm || typeof cm.setParameterValueById !== 'function') return
        for (const p of activeParams) {
          try {
            if (p.blend === 'Add' && typeof cm.addParameterValueById === 'function')
              cm.addParameterValueById(p.id, p.value)
            else if (p.blend === 'Multiply' && typeof cm.multiplyParameterValueById === 'function')
              cm.multiplyParameterValueById(p.id, p.value)
            else
              cm.setParameterValueById(p.id, p.value)
          } catch (_) {}
        }
      })

      setStatus('就绪')
    } catch (e: any) {
      setStatus('加载失败: ' + (e.message || e))
    }
  }

  // ── 执行表情 ──
  async function applyExpression(name: string) {
    if (!model) return

    const expr = EXPRESSIONS[name]
    if (!expr) { setStatus('未知表情: ' + name); return }

    if (expr.type === 'custom' && expr.params) {
      activeParams = expr.params.map(p => ({ ...p }))
      setStatus(expr.name)
      return
    }

    // 内置表情：加载 .exp3.json
    try {
      const resp = await fetch(ECHOBOT + '/api/web/live2d/workspace/' + encodeURI('卡拉(2)') + '/' + name + '.exp3.json')
      if (!resp.ok) { setStatus('表情不存在: ' + name); return }
      const data = await resp.json()
      activeParams = (data.Parameters || []).map((p: any) => ({
        id: p.Id, value: p.Value, blend: p.Blend || 'Add',
      }))
      setStatus(expr.name)
    } catch (e: any) {
      setStatus('加载表情失败')
    }
  }

  // ── 播放动作 ──
  async function applyMotion(name: string) {
    if (!model || typeof model.motion !== 'function') return
    try {
      await model.motion('EchoBotIdle', 0)
      setStatus('动作: ' + name)
    } catch (_) {}
  }

  // ── 监听 Bridge Live2D 指令 ──
  onMount(() => {
    initLive2D()

    const unsub = subscribe('live2d.control', (msg: ServerMessage) => {
      const payload = msg.payload as { tool: string; args: Record<string, string> }
      if (payload.tool === 'live2d_expression') {
        applyExpression(payload.args.name).then(() => {
          send('live2d.result', { text: '表情切换: ' + payload.args.name })
        })
      } else if (payload.tool === 'live2d_motion') {
        applyMotion(payload.args.name).then(() => {
          send('live2d.result', { text: '动作播放: ' + payload.args.name })
        })
      }
    })

    onCleanup(() => {
      unsub()
      if (app) { try { app.destroy(true) } catch (_) {} }
    })
  })

  return (
    <div style="display:flex;flex-direction:column;height:100%;">
      <div style="font-size:11px;color:var(--text-muted);padding:6px 10px;text-align:center;">
        {status()}
      </div>
      <div ref={container} style="flex:1;min-height:0;overflow:hidden;border-radius:8px;" />
    </div>
  )
}
