import { createSelectionManager } from './selectionManager'
import type { SelectionItem, SelectionManager, SelectionSnapshot } from './types'

export type SelectionStoreListener = (snapshot: SelectionSnapshot) => void

export type SelectionStore = SelectionManager & {
  subscribe: (listener: SelectionStoreListener) => () => void
}

export function createSelectionStore(initialItems: SelectionItem[] = []): SelectionStore {
  const manager = createSelectionManager(initialItems)
  const listeners = new Set<SelectionStoreListener>()

  const notify = (snapshot: SelectionSnapshot) => {
    listeners.forEach((listener) => listener(snapshot))
    return snapshot
  }

  return {
    ...manager,
    setSelection: (items, options) => notify(manager.setSelection(items, options)),
    clearSelection: (options) => notify(manager.clearSelection(options)),
    addSelection: (items, options) => notify(manager.addSelection(items, options)),
    removeSelection: (items, options) => notify(manager.removeSelection(items, options)),
    toggleSelection: (items, options) => notify(manager.toggleSelection(items, options)),
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
