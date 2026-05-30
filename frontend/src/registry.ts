import type { Component } from 'solid-js'

export type SlotId = 'left-top' | 'left-middle' | 'left-bottom' | 'center' | 'right' | 'right-tab'

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
