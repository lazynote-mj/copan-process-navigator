import type { SelectedElement } from './selectionTypes'

/** Canvas / Panel 공통 선택 객체 */
export type SelectedObjectType = 'node' | 'edge' | 'lane' | 'zone' | 'overview-zone' | null

export type SelectedObject = {
  type: SelectedObjectType
  id: string | null
}

export function selectedElementToObject(selected: SelectedElement | null): SelectedObject {
  if (!selected) return { type: null, id: null }
  if (selected.type === 'new-node' || selected.type === 'new-edge' || selected.type === 'new-lane' || selected.type === 'new-zone') {
    return { type: null, id: null }
  }
  return { type: selected.type, id: selected.id }
}
