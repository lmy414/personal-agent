import { onMount, onCleanup, createSignal } from 'solid-js'
import { useAgent } from '@/shell/useAgent'
import type { ServerMessage } from '@bridge/protocol'

const ECHOBOT = 'http://localhost:8000'
const M_URL = ECHOBOT + '/api/web/live2d/workspace/' + encodeURI('卡拉(2)') + '/' + encodeURI('卡拉.model3.json')

const BUILTIN = ['kongbai','aixinyan','xingxingyan','lianhong','duzui','guzui','han','lei','lianhei','lianqing','yun','yuanquanyan','xie','jiantou','xianhua','huatong']

const CUSTOM: Record<string, { id: string; value: number; blend: string }[]> = {
  smile: [
    { id: 'ParamEyeLSmile', value: 0.6, blend: 'Add' },
    { id: 'ParamEyeRSmile', value: 0.6, blend: 'Add' },
    { id: 'ParamMouthForm', value: 0.5, blend: 'Add' },
  ],
  bigsmile: [
    { id: 'ParamEyeLSmile', value: 1.0, blend: 'Add' },
    { id: 'ParamEyeRSmile', value: 1.0, blend: 'Add' },
    { id: 'ParamMouthForm', value: 0.8, blend: 'Add' },
    { id: 'ParamCheek', value: 0.5, blend: 'Add' },
    { id: 'ParamMouthOpenY', value: 0.3, blend: 'Add' },
  ],
  sad: [
    { id: 'ParamBrowLY', value: 0.4, blend: 'Add' },
    { id: 'ParamBrowRY', value: 0.4, blend: 'Add' },
    { id: 'ParamBrowLForm', value: -0.4, blend: 'Add' },
    { id: 'ParamBrowRForm', value: -0.4, blend: 'Add' },
    { id: 'ParamMouthForm', value: -0.3, blend: 'Add' },
  ],
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = src
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('load fail: ' + src))
    document.head.appendChild(s)
  })
}

export function Live2DView() {
  const { subscribe, send } = useAgent()
  const [status, setStatus] = createSignal('加载中...')
  const [visible, setVisible] = createSignal(true)
  let panel!: HTMLDivElement
  let cv!: HTMLCanvasElement
  let app: any, model: any, activeParams: { id: string; value: number; blend: string }[] | null = null

  // ── 拖拽 ──
  let dragging = false, sx = 0, sy = 0, ox = 0, oy = 0, docked = ''
  let px = window.innerWidth - 252, py = window.innerHeight - 420

  function onDown(e: MouseEvent) {
    if ((e.target as HTMLElement)?.tagName === 'CANVAS') return
    dragging = true; panel.classList.add('dragging')
    sx = e.clientX; sy = e.clientY; ox = px; oy = py; docked = ''
    panel.classList.remove('docked-left','docked-right')
  }
  document.addEventListener('mousemove', (e) => {
    if (!dragging) return
    px = Math.max(-160, Math.min(window.innerWidth - 40, ox + e.clientX - sx))
    py = Math.max(-20, Math.min(window.innerHeight - 40, oy + e.clientY - sy))
    panel.style.left = px + 'px'; panel.style.top = py + 'px'
  })
  document.addEventListener('mouseup', () => {
    if (!dragging) return
    dragging = false; panel.classList.remove('dragging')
    if (px < 40) { px = 0; docked = 'left'; panel.classList.add('docked-left') }
    else if (px + 220 > window.innerWidth - 40) { px = window.innerWidth - 220; docked = 'right'; panel.classList.add('docked-right') }
    panel.style.left = px + 'px'; panel.style.top = py + 'px'
  })

  // ── 初始化 ──
  onMount(async () => {
    try {
      setStatus('SDK...')
      await loadScript(ECHOBOT + '/web/assets/vendor/pixi.min.js')
      await loadScript(ECHOBOT + '/web/assets/vendor/live2dcubismcore.min.js')
      await loadScript(ECHOBOT + '/web/assets/vendor/cubism4.min.js')

      const P = (window as any).PIXI
      if (!P?.live2d) { setStatus('SDK 不可用'); return }

      setStatus('模型...')
      app = new P.Application({ view: cv, backgroundAlpha: 0, antialias: true })
      model = await P.live2d.Live2DModel.from(M_URL, { autoInteract: false })
      app.stage.addChild(model)
      model.anchor.set(0.5, 0.5)

      const fit = () => {
        if (!app || !model) return
        const w = panel.clientWidth, h = panel.clientHeight
        app.renderer.resize(w, h)
        model.x = w / 2; model.y = h / 2 - 15
        model.scale.set(Math.min(w, h) / 800)
      }
      fit()
      new ResizeObserver(fit).observe(panel)
      window.addEventListener('resize', fit)

      model.internalModel.on('beforeModelUpdate', () => {
        if (!activeParams) return
        const cm = model.internalModel.coreModel
        if (!cm || typeof cm.setParameterValueById !== 'function') return
        for (const p of activeParams) {
          try {
            if (p.blend === 'Add' && typeof cm.addParameterValueById === 'function') cm.addParameterValueById(p.id, p.value)
            else if (p.blend === 'Multiply' && typeof cm.multiplyParameterValueById === 'function') cm.multiplyParameterValueById(p.id, p.value)
            else cm.setParameterValueById(p.id, p.value)
          } catch (_) {}
        }
      })

      setStatus('')
    } catch (e: any) { setStatus('失败: ' + (e.message || e)) }
  })

  // ── Live2D 指令 ──
  onMount(() => {
    const unsub = subscribe('live2d.control', (msg: ServerMessage) => {
      const p = msg.payload as { tool: string; args: Record<string, string> }
      if (p.tool === 'live2d_expression') setExpr(p.args.name).then(() => send('live2d.result', { text: p.args.name }))
      else if (p.tool === 'live2d_motion') playMotion().then(() => send('live2d.result', { text: 'motion' }))
    })
    onCleanup(() => unsub())
  })

  async function setExpr(name: string) {
    if (!model) return
    if (CUSTOM[name]) { activeParams = CUSTOM[name].map(p => ({ ...p })); setStatus(''); return }
    if (name === 'kongbai') { activeParams = null; setStatus(''); return }
    if (!BUILTIN.includes(name)) return
    try {
      const r = await fetch(ECHOBOT + '/api/web/live2d/workspace/' + encodeURI('卡拉(2)') + '/' + name + '.exp3.json')
      if (!r.ok) return
      const d = await r.json()
      activeParams = (d.Parameters || []).map((p: any) => ({ id: p.Id, value: p.Value, blend: p.Blend || 'Add' }))
    } catch (_) {}
  }

  async function playMotion() {
    if (!model || typeof model.motion !== 'function') return
    try { await model.motion('EchoBotIdle', 0) } catch (_) {}
  }

  return (
    <>
      {/* 切换按钮 */}
      <button
        onClick={() => setVisible(!visible())}
        style={{
          position:'fixed',bottom:'12px',left:'50%',transform:'translateX(-50%)',
          zIndex:100000,padding:'4px 12px',borderRadius:'12px',
          border:'1px solid rgba(255,255,255,0.06)',
          background:'rgba(20,18,32,0.7)',color:'rgba(255,255,255,0.5)',
          fontSize:'11px',fontFamily:'inherit',cursor:'pointer'
        }}
      >
        {visible() ? '🎭 隐藏' : '🎭 澪号'}
      </button>

      {/* 悬浮面板 */}
      <div
        ref={panel}
        onMouseDown={onDown}
        style={{
          position:'fixed',left:px+'px',top:py+'px',
          width:'220px',height:'300px',zIndex:99999,
          borderRadius:'16px',overflow:'hidden',
          background: 'rgba(14,12,24,0.55)',
          border: '1px solid rgba(255,255,255,0.06)',
          backdropFilter:'blur(20px)',
          boxShadow:'0 16px 48px rgba(0,0,0,0.45)',
          display: visible() ? 'block' : 'none',
          cursor:'grab',
        }}
      >
        <div style={{position:'absolute',top:'6px',left:'50%',transform:'translateX(-50%)',width:'24px',height:'3px',background:'rgba(255,255,255,0.1)',borderRadius:'2px',zIndex:2,pointerEvents:'none'}} />
        <div style={{position:'absolute',top:'8px',right:'10px',width:'6px',height:'6px',borderRadius:'50%',background:'#4ade80',boxShadow:'0 0 5px rgba(74,222,128,0.4)',zIndex:2}} />
        {status() && (
          <div style={{position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)',fontSize:'11px',color:'rgba(255,255,255,0.3)',zIndex:3,pointerEvents:'none'}}>
            {status()}
          </div>
        )}
        <canvas ref={cv} style={{width:'100%',height:'100%',display:'block'}} />
      </div>
    </>
  )
}
