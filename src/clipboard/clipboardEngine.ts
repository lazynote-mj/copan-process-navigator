import type { Node, Process } from '../types/process'
import { generateId } from '../lib/editor/processEditor'
import { deserializeClipboardNode, serializeNodeForClipboard } from './clipboardSerializer'
import type { ClipboardPayload, NodePasteOptions, NodePasteResult } from './types'

const DETAIL_ROW_COUNT = 7
const OVERVIEW_SLOT_COUNT = 10

export function isClipboardNodeSupported(node: Node): boolean {
  return node.type !== 'phase-connector' && node.type !== 'merge'
}

function buildDetailOccupancy(process: Process, laneId: string): Set<string> {
  return new Set(
    process.nodes
      .filter((node) => node.laneId === laneId)
      .map((node) => `${node.detailLayout?.column ?? node.cellOrder ?? node.localOrder ?? 1}:${node.detailLayout?.row ?? 1}`),
  )
}

function buildOverviewOccupancy(process: Process, node: Node): Set<number> {
  return new Set(
    process.nodes
      .filter((entry) => entry.laneId === node.laneId && entry.processZone === node.processZone && entry.cellSlot != null)
      .map((entry) => entry.cellSlot as number),
  )
}

function nextCellOrder(process: Process, node: Node): number {
  const values = process.nodes
    .filter((entry) => entry.laneId === node.laneId && entry.processZone === node.processZone)
    .map((entry) => entry.cellOrder ?? 0)
  return values.length > 0 ? Math.max(...values) + 1 : 1
}

function nextDetailLayout(node: Node, occupied: Set<string>): NonNullable<Node['detailLayout']> {
  const baseColumn = node.detailLayout?.column ?? node.cellOrder ?? node.localOrder ?? 1
  const baseRow = node.detailLayout?.row ?? 1
  if (!occupied.has(`${baseColumn}:${baseRow}`)) return { column: baseColumn, row: baseRow }

  for (let row = Math.min(DETAIL_ROW_COUNT, baseRow + 1); row <= DETAIL_ROW_COUNT; row += 1) {
    if (!occupied.has(`${baseColumn}:${row}`)) return { column: baseColumn, row }
  }
  for (let column = baseColumn + 1; column <= baseColumn + 24; column += 1) {
    for (let row = 1; row <= DETAIL_ROW_COUNT; row += 1) {
      if (!occupied.has(`${column}:${row}`)) return { column, row }
    }
  }
  return { column: baseColumn + 1, row: baseRow }
}

function nextOverviewSlot(node: Node, occupied: Set<number>): number | undefined {
  const base = node.cellSlot && node.cellSlot >= 1 && node.cellSlot <= OVERVIEW_SLOT_COUNT ? node.cellSlot : 1
  if (!occupied.has(base)) return base
  for (let slot = base + 1; slot <= OVERVIEW_SLOT_COUNT; slot += 1) {
    if (!occupied.has(slot)) return slot
  }
  for (let slot = 1; slot < base; slot += 1) {
    if (!occupied.has(slot)) return slot
  }
  return undefined
}

function stabilizePastedNodePlacement(node: Node, options: NodePasteOptions): Node {
  if (!options.process) return node

  const withOrder = {
    ...node,
    cellOrder: nextCellOrder(options.process, node),
  }

  if (options.viewMode === 'detail') {
    const occupied = buildDetailOccupancy(options.process, withOrder.laneId)
    const detailLayout = nextDetailLayout(withOrder, occupied)
    return {
      ...withOrder,
      detailLayout,
      cellSlot: undefined,
    }
  }

  const occupied = buildOverviewOccupancy(options.process, withOrder)
  const cellSlot = nextOverviewSlot(withOrder, occupied)
  return cellSlot == null
    ? withOrder
    : {
        ...withOrder,
        cellSlot,
        detailLayout: undefined,
      }
}

export function createNodeClipboardPayload(process: Process, nodeIds: string[]): ClipboardPayload | null {
  const selectedIds = [...new Set(nodeIds)]
  if (selectedIds.length === 0) return null

  const selected = new Set(selectedIds)
  const nodes = process.nodes.filter((node) => selected.has(node.id) && isClipboardNodeSupported(node))
  if (nodes.length === 0) return null

  return {
    version: 1,
    scope: 'node',
    metadata: {
      createdAt: new Date().toISOString(),
      sourceProcessId: process.id,
    },
    items: nodes.map((node) => ({
      kind: 'node' as const,
      node: serializeNodeForClipboard(node),
    })),
  }
}

export function pasteNodeClipboardPayload(
  payload: ClipboardPayload | null,
  options: NodePasteOptions = {},
): NodePasteResult {
  if (!payload || payload.scope !== 'node') return { nodes: [] }

  const offsetX = options.offsetX ?? 20
  const offsetY = options.offsetY ?? 20
  const nodes: Node[] = []
  let placementProcess = options.process

  for (const item of payload.items) {
    if (item.kind !== 'node') continue
    const pasted = deserializeClipboardNode(item.node, generateId('node'), offsetX, offsetY)
    const stabilized = stabilizePastedNodePlacement(pasted, {
      ...options,
      process: placementProcess,
    })
    nodes.push(stabilized)
    if (placementProcess) {
      placementProcess = {
        ...placementProcess,
        nodes: [...placementProcess.nodes, stabilized],
      }
    }
  }

  return { nodes }
}

export function duplicateNodesToClipboardPayload(process: Process, nodeIds: string[]): ClipboardPayload | null {
  return createNodeClipboardPayload(process, nodeIds)
}
