import { onMount, onCleanup, createSignal, createEffect } from 'solid-js'
import { useAgent } from '@/shell/useAgent'
import { live2dWidth, live2dHeight, live2dScale, setLive2dScale, live2dOffsetX, setLive2dOffsetX, live2dOffsetY, setLive2dOffsetY, live2dVisible } from '@/shell/live2d-signal'
import type { ServerMessage } from '@bridge/protocol'

const M_URL = '/live2d/' + encodeURI('卡拉(2)') + '/' + encodeURI('卡拉.model3.json')
const EXPR_URL = '/live2d/' + encodeURI('卡拉(2)')

// 所有表情从模型 .exp3.json 动态加载，无硬编码

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
  const { subscribe } = useAgent()
  const [status, setStatus] = createSignal('加载中...')
  const visible = live2dVisible
  const [speaking, setSpeaking] = createSignal(false)
  let panel!: HTMLDivElement
  let myCanvas: HTMLCanvasElement | null = null
  let app: any, model: any, activeParams: { id: string; value: number; blend: string }[] | null = null
  let doFit: (() => void) | null = null

  // 监听信号变化 → 实时跟新（面板尺寸 + 模型参数）
  createEffect(() => {
    live2dWidth(); live2dHeight()
    live2dScale(); live2dOffsetX(); live2dOffsetY()
    doFit?.()
  })

  // 隐藏→显示后，等 CSS 布局恢复再强制 resize PIXI
  createEffect(() => {
    if (live2dVisible() && app) {
      requestAnimationFrame(() => {
        const cw = panel.clientWidth, ch = panel.clientHeight
        if (cw > 0 && ch > 0) {
          app.renderer.resize(cw, ch)
          doFit?.()
        }
      })
    }
  })

  // ── Ghost 模式 ──
  const enter = () => panel.classList.add('active')
  const leave = () => {
    // 拖拽中不退出 active
    if (!dragging) panel.classList.remove('active')
  }

  // ── 拖拽 + 停靠 ──
  const DOCK_THRESHOLD = 40
  const getW = () => live2dWidth()
  const getH = () => live2dHeight()
  let dragging = false, docked = '', sx = 0, sy = 0, ox = 0, oy = 0
  let px = window.innerWidth - getW() - 32, py = window.innerHeight - getH() - 100
  const [dockCandidate, setDockCandidate] = createSignal<string | null>(null)

  function onDown(e: MouseEvent) {
    e.preventDefault()
    dragging = true
    panel.classList.add('dragging', 'active')
    panel.classList.remove('docked-left', 'docked-right')
    docked = ''
    sx = e.clientX; sy = e.clientY; ox = px; oy = py
  }

  document.addEventListener('mousemove', (e) => {
    if (!dragging) return
    const w = getW()
    px = Math.max(-w + 40, Math.min(window.innerWidth - 40, ox + e.clientX - sx))
    py = Math.max(-20, Math.min(window.innerHeight - 40, oy + e.clientY - sy))
    panel.style.left = px + 'px'
    panel.style.top = py + 'px'

    let target: string | null = null
    if (px < DOCK_THRESHOLD) target = 'left'
    else if (px + w > window.innerWidth - DOCK_THRESHOLD) target = 'right'
    setDockCandidate(target)
  })

  document.addEventListener('mouseup', () => {
    if (!dragging) return
    dragging = false
    panel.classList.remove('dragging')
    setDockCandidate(null)

    const w = getW()
    if (px < DOCK_THRESHOLD) { px = 0; docked = 'left' }
    else if (px + w > window.innerWidth - DOCK_THRESHOLD) { px = window.innerWidth - w; docked = 'right' }
    else { docked = '' }

    // 重置 class
    panel.classList.remove('docked-left', 'docked-right')
    if (docked) panel.classList.add('docked-' + docked)
    panel.style.left = px + 'px'
    panel.style.top = py + 'px'
  })

  // ── 气泡 ──
  function showBubble(text: string, expr?: string) {
    document.querySelectorAll('.speech-bubble').forEach(b => b.remove())
    const bubble = document.createElement('div')
    bubble.className = 'speech-bubble'
    bubble.innerHTML = (expr ? '<span class="expr">' + expr + '</span>' : '') + text
    const pr = panel.getBoundingClientRect()
    if (docked === 'right') {
      bubble.style.right = (window.innerWidth - pr.left + 16) + 'px'
    } else {
      bubble.style.left = (pr.right + 16) + 'px'
    }
    bubble.style.top = (pr.top + 40) + 'px'
    document.body.appendChild(bubble)
    bubble.addEventListener('animationend', (e) => {
      if ((e as AnimationEvent).animationName === 'bub-out') bubble.remove()
    })

    // 状态点变色
    setSpeaking(true)
    setTimeout(() => setSpeaking(false), 500)
  }

  // ── 初始化 PIXI + Live2D ──
  onMount(async () => {
    const step = (label: string) => { console.log('[mio]', label); setStatus(label) }
    try {
      step('1/6 加载 PixiJS...')
      await loadScript('/vendor/pixi.min.js')

      step('2/6 加载 Cubism Core...')
      await loadScript('/vendor/live2dcubismcore.min.js')

      step('3/6 加载 Cubism4 PIXI...')
      await loadScript('/vendor/cubism4.min.js')

      const P = (window as any).PIXI
      if (!P?.live2d) { setStatus('失败: PIXI.live2d 未定义 — SDK 版本不兼容'); return }
      console.log('[mio] PIXI.live2d OK, ver:', P.live2d.VERSION)

      step('4/6 创建 Canvas + Pixi App...')
      myCanvas = document.createElement('canvas')
      myCanvas.style.cssText = 'position:absolute;top:0;left:0;display:block;pointer-events:auto'
      // 插到 panel 第一个子元素，确保不被其他 dom 遮挡
      panel.insertBefore(myCanvas, panel.firstChild)

      app = new P.Application({ view: myCanvas, resizeTo: panel, backgroundAlpha: 0, antialias: true })

      step('5/6 加载模型...')
      console.log('[mio] loading from:', M_URL)
      const t0 = performance.now()
      model = await P.live2d.Live2DModel.from(M_URL, { autoInteract: false })
      const t1 = performance.now()
      console.log('[mio] model loaded in', Math.round(t1 - t0), 'ms')
      console.log('[mio] children:', model.children?.length, 'internalModel:', !!model.internalModel)

      app.stage.addChild(model)
      model.anchor.set(0.5, 0.5)

      const fit = () => {
        if (!app || !model) return
        const cw = panel.clientWidth, ch = panel.clientHeight
        if (cw <= 0 || ch <= 0) return
        app.renderer.resize(cw, ch)
        const s = live2dScale()
        const ox = live2dOffsetX()
        const oy = live2dOffsetY()
        model.x = cw / 2 + ox
        model.y = ch / 2 + oy
        model.scale.set(s > 0 ? s / 100 : Math.min(cw, ch) / 900)
      }
      fit()
      doFit = fit
      new ResizeObserver(fit).observe(panel)

      // ── 模型交互：拖拽移动 / 滚轮缩放 / 双击重置 ──
      app.stage.interactive = true
      let panning = false, psx = 0, psy = 0, pox = 0, poy = 0, lastTap = 0

      app.stage.on('pointerdown', (e: any) => {
        panning = true
        app.stage.cursor = 'grabbing'
        const g = e.data.global
        psx = g.x; psy = g.y
        pox = live2dOffsetX(); poy = live2dOffsetY()
      })

      app.stage.on('pointermove', (e: any) => {
        if (!panning) return
        const g = e.data.global
        setLive2dOffsetX(Math.round(pox + g.x - psx))
        setLive2dOffsetY(Math.round(poy + g.y - psy))
        fit()
      })

      const endPan = () => { if (panning) { panning = false; app.stage.cursor = 'grab' } }
      app.stage.on('pointerup', endPan)
      app.stage.on('pointerupoutside', endPan)

      // 双击重置
      app.stage.on('pointertap', () => {
        const now = Date.now()
        if (lastTap && now - lastTap < 400) {
          setLive2dOffsetX(0); setLive2dOffsetY(0); setLive2dScale(0)
          fit()
        }
        lastTap = now
      })

      // ── 自定义参数表情循环注入 ──
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

      // ── 待机微表情：空闲时随机切换模型表情 ──
      const IDLE_EXPR = ['kongbai', 'kongbai', 'kongbai', 'aixinyan', 'xingxingyan']
      let idleTimer: ReturnType<typeof setTimeout> | null = null
      let lastActivity = Date.now()

      function resetIdle() { lastActivity = Date.now() }
      // 拖拽、滚轮、表情切换都算活动
      panel.addEventListener('pointerdown', resetIdle)
      panel.addEventListener('wheel', resetIdle)

      function scheduleIdle() {
        if (idleTimer) clearTimeout(idleTimer)
        idleTimer = setTimeout(() => {
          // 空闲 25s 以上才触发微表情
          if (Date.now() - lastActivity < 25000) { scheduleIdle(); return }
          const expr = IDLE_EXPR[Math.floor(Math.random() * IDLE_EXPR.length)]
          setExpr(expr)
          // 保持 3-5s 后恢复空白
          setTimeout(() => { if (Date.now() - lastActivity >= 28000) setExpr('kongbai') }, 3000 + Math.random() * 2000)
          scheduleIdle()
        }, 25000)
      }
      scheduleIdle()
      onCleanup(() => { if (idleTimer) clearTimeout(idleTimer) })
    } catch (e: any) {
      const msg = e?.message || String(e)
      console.error('[mio] 初始化失败:', e)
      setStatus('✗ ' + msg.slice(0, 80))
    }
  })

  // ── Live2D 指令（v2 协议 + v1 兼容）──
  onMount(() => {
    // v2: 表情切换 — 渲染器加载 .exp3.json
    const unsubExpr = subscribe('live2d.expression', (msg: ServerMessage) => {
      const p = msg.payload as { name: string }
      setExpr(p.name)
      showBubble('', exprEmoji(p.name))
    })

    // v2: 动作播放 — 渲染器加载 .motion3.json
    const unsubMotion = subscribe('live2d.motion', (msg: ServerMessage) => {
      const p = msg.payload as { group: string; index: number }
      playMotion(p.group, p.index)
    })

    // v2: 参数操控
    const unsubParam = subscribe('live2d.parameter', (msg: ServerMessage) => {
      const p = msg.payload as { params: Array<{ id: string; value: number; duration?: number; easing?: string }> }
      applyParameters(p.params)
    })

    // v2: 语义动画
    const unsubAnim = subscribe('live2d.animate', (msg: ServerMessage) => {
      const p = msg.payload as { animation: string; params: Array<{ id: string; value: number; duration?: number; easing?: string }> }
      playAnimation(p.params)
    })

    // v1 旧协议兼容
    const unsubLegacy = subscribe('live2d.control', (msg: ServerMessage) => {
      const p = msg.payload as { tool: string; args: Record<string, string> }
      if (p.tool === 'live2d_expression') {
        setExpr(p.args.name)
        showBubble('', exprEmoji(p.args.name))
      } else if (p.tool === 'live2d_motion') {
        playMotion('Scene1', 0)
      }
    })

    onCleanup(() => {
      unsubExpr(); unsubMotion(); unsubParam(); unsubAnim(); unsubLegacy()
      app?.destroy?.(true)
      myCanvas?.remove()
    })
  })

  function exprEmoji(name: string): string {
    const map: Record<string, string> = {
      aixinyan: '🥰', xingxingyan: '🤩', lianhong: '😳', duzui: '😗',
      guzui: '😤', han: '😅', lei: '😢', lianhei: '😡', lianqing: '😨',
      yun: '😵', yuanquanyan: '🌀', xie: '🤨', jiantou: '👉',
      xianhua: '🌸', huatong: '🎉',
    }
    return map[name] || ''
  }

  /** 从模型 .exp3.json 加载表情（无硬编码，通用） */
  async function setExpr(name: string) {
    if (!model) return
    if (name === 'kongbai') { activeParams = null; return }
    try {
      const r = await fetch(EXPR_URL + '/' + name + '.exp3.json')
      if (!r.ok) { activeParams = null; return }
      const d = await r.json()
      activeParams = (d.Parameters || []).map((p: any) => ({ id: p.Id, value: p.Value, blend: p.Blend || 'Add' }))
    } catch { activeParams = null }
  }

  /** 从模型 .motion3.json 加载并播放动作 */
  async function playMotion(group: string, index: number) {
    if (!model) return
    try {
      const manifestUrl = M_URL
      const baseDir = manifestUrl.substring(0, manifestUrl.lastIndexOf('/'))
      // 获取 model3.json 以找到 motion 文件路径
      const r = await fetch(manifestUrl)
      const manifest = await r.json()
      const motions = manifest.FileReferences?.Motions
      if (!motions || !motions[group]) return
      const entry = motions[group][index]
      if (!entry?.File) return
      const motionUrl = baseDir + '/' + entry.File
      const mr = await fetch(motionUrl)
      if (!mr.ok) return
      const motionData = await mr.json()
      // 逐帧播放 motion curves
      _executeMotion(motionData)
    } catch { /* motion not available */ }
  }

  /** 直接应用参数列表（v2 参数操控） */
  function applyParameters(params: Array<{ id: string; value: number; duration?: number; easing?: string }>) {
    if (!model) return
    activeParams = params.map((p) => ({ id: p.id, value: p.value, blend: 'Add' as const }))
  }

  /** 按 duration 序列播放语义动画 */
  function playAnimation(params: Array<{ id: string; value: number; duration?: number; easing?: string }>) {
    if (!model) return
    const cm = model.internalModel?.coreModel
    if (!cm) return
    let delay = 0
    for (const p of params) {
      const dur = p.duration ?? 0
      setTimeout(() => {
        try { cm.setParameterValueById(p.id, p.value) } catch (_) {}
      }, delay)
      delay += dur
    }
  }

  /** 简易 motion curve 执行器 */
  function _executeMotion(data: { Meta?: { Duration?: number; Fps?: number }; Curves?: Array<{ Target: string; Id: string; Segments: Array<{ X: number; Y: number }> }> }) {
    const cm = model?.internalModel?.coreModel
    if (!cm || !data.Curves) return
    const fps = data.Meta?.Fps ?? 30
    const duration = data.Meta?.Duration ?? 1
    const totalFrames = Math.round(duration * fps)
    for (const curve of data.Curves) {
      if (curve.Target !== 'Parameter' || !curve.Segments?.length) continue
      let frame = 0
      const iv = setInterval(() => {
        if (frame > totalFrames) { clearInterval(iv); return }
        const t = frame / totalFrames
        // 线性插值：找 t 落在哪个 segment 里
        const segs = curve.Segments.sort((a, b) => a.X - b.X)
        let value = segs[0].Y
        for (let i = 0; i < segs.length - 1; i++) {
          const t0 = segs[i].X / (segs[segs.length - 1].X || 1)
          const t1 = segs[i + 1].X / (segs[segs.length - 1].X || 1)
          if (t >= t0 && t <= t1) {
            const local = (t - t0) / (t1 - t0 || 0.001)
            value = segs[i].Y + (segs[i + 1].Y - segs[i].Y) * local
            break
          }
        }
        try { cm.setParameterValueById(curve.Id, value) } catch (_) {}
        frame++
      }, 1000 / fps)
      setTimeout(() => clearInterval(iv), duration * 1000 + 100)
    }
  }

  return (
    <>
      {/* 停靠指示器 */}
      <div
        class="dock-indicator"
        classList={{ show: !!dockCandidate() }}
        style={
          dockCandidate() === 'left'
            ? 'left:0;top:0;width:' + DOCK_THRESHOLD + 'px;height:100vh;'
            : dockCandidate() === 'right'
              ? 'right:0;top:0;width:' + DOCK_THRESHOLD + 'px;height:100vh;'
              : ''
        }
      />

      {/* 悬浮面板 */}
      <div
        ref={panel}
        class="floating-mio"
        classList={{
          'docked-left': docked === 'left',
          'docked-right': docked === 'right',
        }}
        style={{
          left: px + 'px', top: py + 'px',
          width: live2dWidth() + 'px', height: live2dHeight() + 'px',
          visibility: visible() ? 'visible' : 'hidden',
          'pointer-events': visible() ? 'auto' : 'none',
        }}
        onMouseEnter={enter}
        onMouseLeave={leave}
      >
        <div class="mio-handle" onMouseDown={onDown}>
          <div class="mio-handle-bar" />
        </div>
        <div
          class="mio-dot"
          style={{
            background: speaking() ? '#8b9cf0' : '#4ade80',
            'box-shadow': speaking() ? '0 0 10px rgba(139,156,240,0.6)' : '0 0 5px rgba(74,222,128,0.4)',
          }}
        />
        <div class="mio-view">
          {status() && <div class="mio-status-overlay">{status()}</div>}
        </div>
      </div>

    </>
  )
}
