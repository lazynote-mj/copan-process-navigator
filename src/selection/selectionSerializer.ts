import type { SelectionItem, SelectionSnapshot } from './types'

type SerializedSelection = {
  version: 1
  items: SelectionItem[]
  primary: SelectionItem | null
}

export function serializeSelection(snapshot: SelectionSnapshot): SerializedSelection {
  return {
    version: 1,
    items: snapshot.items,
    primary: snapshot.primary,
  }
}

export function deserializeSelection(value: unknown): SelectionItem[] {
  if (!value || typeof value !== 'object') return []
  const candidate = value as Partial<SerializedSelection>
  if (candidate.version !== 1 || !Array.isArray(candidate.items)) return []
  return candidate.items.filter(
    (item): item is SelectionItem =>
      Boolean(
        item &&
          typeof item === 'object' &&
          typeof item.id === 'string' &&
          (item.type === 'node' || item.type === 'edge' || item.type === 'zone' || item.type === 'group'),
      ),
  )
}
