// Live2D 预览已移除独立的 PIXI 实例（避免两个 PIXI app 争抢 WebGL 上下文）。
// 模型渲染统一由悬浮窗 Live2DView 负责。
// 设置页只需面板尺寸控制——拖拽/滚轮调节直接在悬浮窗上操作。
export {}
