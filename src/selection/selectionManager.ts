import type {
  SelectionChangeOptions,
  SelectionEntityType,
  SelectionItem,
  SelectionManager,
  SelectionSnapshot,
} from './types'

function selectionKey(item: SelectionItem): string {
  return `${item.type}:${item.id}`
}

function normalizeItems(items: SelectionItem[]): SelectionItem[] {
  const seen = new Set<string>()
  const next: SelectionItem[] = []
  for (const item of items) {
    if (!item.id) continue
    const key = selectionKey(item)
    if (seen.has(key)) continue
    seen.add(key)
    next.push({ type: item.type, id: item.id })
  }
  return next
}

function buildSnapshot(items: SelectionItem[], anchor?: SelectionItem | null): SelectionSnapshot {
  const normalized = normalizeItems(items)
  return {
    items: normalized,
    primary: normalized[0] ?? null,
    mode: normalized.length === 0 ? 'empty' : normalized.length === 1 ? 'single' : 'multi',
    anchor: anchor && normalized.some((item) => selectionKey(item) === selectionKey(anchor)) ? anchor : (normalized[0] ?? null),
  }
}

function hasItem(items: SelectionItem[], item: SelectionItem): boolean {
  const key = selectionKey(item)
  return items.some((entry) => selectionKey(entry) === key)
}

export function createSelectionManager(initialItems: SelectionItem[] = []): SelectionManager {
  let current = buildSnapshot(initialItems)

  const commit = (items: SelectionItem[], options?: SelectionChangeOptions): SelectionSnapshot => {
    const anchor = options?.range ? current.anchor : undefined
    current = buildSnapshot(items, anchor)
    return current
  }

  return {
    getSnapshot: () => current,
    getPrimary: () => current.primary,
    getItems: () => [...current.items],
    getByType: (type: SelectionEntityType) => current.items.filter((item) => item.type === type),
    has: (item: SelectionItem) => hasItem(current.items, item),
    setSelection: (items: SelectionItem[], options?: SelectionChangeOptions) => {
      if (options?.toggle) {
        let next = [...current.items]
        for (const item of normalizeItems(items)) {
          if (hasItem(next, item)) {
            next = next.filter((entry) => selectionKey(entry) !== selectionKey(item))
          } else {
            next.push(item)
          }
        }
        return commit(next, options)
      }
      if (options?.additive || options?.range) return commit([...current.items, ...items], options)
      return commit(items, options)
    },
    clearSelection: (options?: SelectionChangeOptions) => commit([], options),
    addSelection: (items: SelectionItem[], options?: SelectionChangeOptions) =>
      commit([...current.items, ...items], { ...options, additive: true }),
    removeSelection: (items: SelectionItem[], options?: SelectionChangeOptions) => {
      const removeKeys = new Set(items.map(selectionKey))
      return commit(current.items.filter((item) => !removeKeys.has(selectionKey(item))), options)
    },
    toggleSelection: (items: SelectionItem[], options?: SelectionChangeOptions) => {
      let next = [...current.items]
      for (const item of normalizeItems(items)) {
        if (hasItem(next, item)) {
          next = next.filter((entry) => selectionKey(entry) !== selectionKey(item))
        } else {
          next.push(item)
        }
      }
      return commit(next, { ...options, toggle: true })
    },
    snapshot: () => buildSnapshot(current.items, current.anchor),
  }
}

export function nodeSelectionItems(nodeIds: string[]): SelectionItem[] {
  return nodeIds.map((id) => ({ type: 'node', id }))
}

export function edgeSelectionItems(edgeIds: string[]): SelectionItem[] {
  return edgeIds.map((id) => ({ type: 'edge', id }))
}
