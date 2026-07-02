import type { Node, Process } from '../types/process'

export type ClipboardScope = 'node' | 'edge' | 'zone' | 'group' | 'selection'

export type ClipboardMetadata = {
  createdAt: string
  sourceProcessId: string
}

export type ClipboardNodeData = Omit<Node, 'id'>

export type NodeClipboardItem = {
  kind: 'node'
  node: ClipboardNodeData
}

export type EdgeClipboardItem = {
  kind: 'edge'
  status: 'placeholder'
}

export type ZoneClipboardItem = {
  kind: 'zone'
  status: 'placeholder'
}

export type GroupClipboardItem = {
  kind: 'group'
  status: 'placeholder'
}

export type SelectionClipboardItem = {
  kind: 'selection'
  status: 'placeholder'
}

export type ClipboardItem =
  | NodeClipboardItem
  | EdgeClipboardItem
  | ZoneClipboardItem
  | GroupClipboardItem
  | SelectionClipboardItem

export type ClipboardPayload = {
  version: 1
  scope: ClipboardScope
  metadata: ClipboardMetadata
  items: ClipboardItem[]
}

export type NodePasteOptions = {
  offsetX?: number
  offsetY?: number
  process?: Process
  viewMode?: 'overview' | 'detail'
}

export type NodePasteResult = {
  nodes: Node[]
}
