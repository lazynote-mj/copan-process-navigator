export type SelectionEntityType = 'node' | 'edge' | 'zone' | 'group'

export type SelectionSource =
  | 'canvas'
  | 'panel'
  | 'toolbar'
  | 'shortcut'
  | 'clipboard'
  | 'programmatic'

export type SelectionItem = {
  type: SelectionEntityType
  id: string
}

export type SelectionMode = 'empty' | 'single' | 'multi'

export type SelectionSnapshot = {
  items: SelectionItem[]
  primary: SelectionItem | null
  mode: SelectionMode
  anchor: SelectionItem | null
}

export type SelectionChangeOptions = {
  source?: SelectionSource
  additive?: boolean
  toggle?: boolean
  range?: boolean
}

export type SelectionManager = {
  getSnapshot: () => SelectionSnapshot
  getPrimary: () => SelectionItem | null
  getItems: () => SelectionItem[]
  getByType: (type: SelectionEntityType) => SelectionItem[]
  has: (item: SelectionItem) => boolean
  setSelection: (items: SelectionItem[], options?: SelectionChangeOptions) => SelectionSnapshot
  clearSelection: (options?: SelectionChangeOptions) => SelectionSnapshot
  addSelection: (items: SelectionItem[], options?: SelectionChangeOptions) => SelectionSnapshot
  removeSelection: (items: SelectionItem[], options?: SelectionChangeOptions) => SelectionSnapshot
  toggleSelection: (items: SelectionItem[], options?: SelectionChangeOptions) => SelectionSnapshot
  snapshot: () => SelectionSnapshot
}
