import type { Component } from 'solid-js'

// 旧版 grid 槽位 (System A — Extensions 层，过渡期保留)
export type GridSlotId = 'left-top' | 'left-middle' | 'left-bottom' | 'center' | 'right' | 'right-tab'

// 新版语义槽位 (System B — Views 层，目标架构)
//   nav        — 底部导航栏 (MiniNav)
//   main-view  — 主内容区 (PencilMainView / CharacterView / ...)
//   sidebar    — 侧边栏面板 (ChatPanel / SessionPanel / ToolPanel)
//   overlay    — 覆盖层 (SettingsPage / TopMenuBar)
export type SemanticSlotId = 'nav' | 'main-view' | 'sidebar' | 'overlay'

export type SlotId = GridSlotId | SemanticSlotId

export interface Extension {
  id: string
  slot: SlotId
  component: Component
  label?: string
  icon?: string
}

class ExtensionRegistry {
  private extensions: Extension[] = []

  register(ext: Extension): void {
    const existing = this.extensions.findIndex((e) => e.id === ext.id)
    if (existing !== -1) {
      this.extensions[existing] = ext
    } else {
      this.extensions.push(ext)
    }
  }

  getAll(): Extension[] {
    return this.extensions
  }

  getBySlot(slot: SlotId): Extension[] {
    return this.extensions.filter((e) => e.slot === slot)
  }

  getById(id: string): Extension | undefined {
    return this.extensions.find((e) => e.id === id)
  }
}

export const registry = new ExtensionRegistry()
