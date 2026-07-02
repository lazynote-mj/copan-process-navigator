import type { Edge, Node, Process } from '../../types/process'
import type { ViewMode } from './viewModeTypes'
import { generateId } from './processEditor'
import { withEdgeHandleDefaults } from './edgeHandles'
import { normalizeEdgeForStorage } from './edgeUpdate'

const OVERVIEW_SLOT_COUNT = 10
const OVERVIEW_SLOT_ROWS = 5
const DETAIL_ROW_COUNT = 5

export type NodeClipboard = {
  nodes: Node[]
  internalEdges: Edge[]
}

export type PasteNodesOptions = {
  includeEdges: boolean
  viewMode: ViewMode
}

export type PasteNodesResult = {
  nodes: Node[]
  edges: Edge[]
}

function cloneNodeForClipboard(node: Node): Node {
  return {
    ...node,
    inputs: [...node.inputs],
    outputs: [...node.outputs],
    controls: [...node.controls],
    detailProcessIds: node.detailProcessIds ? [...node.detailProcessIds] : undefined,
    interfaceRuleAnchor: node.interfaceRuleAnchor ? { ...node.interfaceRuleAnchor } : undefined,
    detailLayout: node.detailLayout ? { ...node.detailLayout } : undefined,
  }
}

function cloneEdgeForClipboard(edge: Edge): Edge {
  return {
    ...edge,
    data: edge.data ? { ...edge.data } : undefined,
    routing: edge.routing
      ? {
          ...edge.routing,
          points: edge.routing.points ? edge.routing.points.map((point) => ({ ...point })) : undefined,
        }
      : undefined,
    labelPlacement: edge.labelPlacement
      ? {
          offset: edge.labelPlacement.offset ? { ...edge.labelPlacement.offset } : undefined,
          point: edge.labelPlacement.point ? { ...edge.labelPlacement.point } : undefined,
        }
      : undefined,
    bendPoints: edge.bendPoints?.map((point) => ({ ...point })),
    points: edge.points?.map((point) => ({ ...point })),
  }
}

export function createNodeClipboard(process: Process, nodeIds: string[]): NodeClipboard | null {
  const selectedIds = [...new Set(nodeIds)]
  if (selectedIds.length === 0) return null
  const selectedSet = new Set(selectedIds)
  const nodes = process.nodes
    .filter((node) => selectedSet.has(node.id))
    .map(cloneNodeForClipboard)
  if (nodes.length === 0) return null

  const internalEdges = process.edges
    .filter((edge) => selectedSet.has(edge.source) && selectedSet.has(edge.target))
    .map(cloneEdgeForClipboard)

  return { nodes, internalEdges }
}

function nextCellOrder(process: Process, laneId: string, processZone: Node['processZone']): number {
  const values = process.nodes
    .filter((node) => node.laneId === laneId && node.processZone === processZone)
    .map((node) => node.cellOrder ?? 0)
  return values.length > 0 ? Math.max(...values) + 1 : 1
}

function overviewSlotRow(slot: number): number {
  return ((slot - 1) % OVERVIEW_SLOT_ROWS) + 1
}

function overviewSlotCol(slot: number): number {
  return slot <= OVERVIEW_SLOT_ROWS ? 0 : 1
}

function overviewSlotFromRowCol(row: number, col: number): number {
  return col * OVERVIEW_SLOT_ROWS + row
}

function findNextOverviewSlot(
  originalSlot: number | undefined,
  occupied: Set<number>,
): number | undefined {
  const base = originalSlot && originalSlot >= 1 && originalSlot <= OVERVIEW_SLOT_COUNT
    ? originalSlot
    : 1
  const baseRow = overviewSlotRow(base)
  const baseCol = overviewSlotCol(base)

  const candidates: number[] = []
  for (let row = baseRow + 1; row <= OVERVIEW_SLOT_ROWS; row += 1) {
    candidates.push(overviewSlotFromRowCol(row, baseCol))
  }
  for (let row = 1; row <= OVERVIEW_SLOT_ROWS; row += 1) {
    candidates.push(overviewSlotFromRowCol(row, baseCol === 0 ? 1 : 0))
  }
  for (let slot = 1; slot <= OVERVIEW_SLOT_COUNT; slot += 1) {
    candidates.push(slot)
  }

  return candidates.find((slot) => !occupied.has(slot))
}

function buildOverviewSlotOccupancy(process: Process, laneId: string, processZone: Node['processZone']): Set<number> {
  return new Set(
    process.nodes
      .filter((node) => node.laneId === laneId && node.processZone === processZone && node.cellSlot != null)
      .map((node) => node.cellSlot as number),
  )
}

function detailColumn(node: Node): number {
  return node.detailLayout?.column ?? node.cellOrder ?? node.localOrder ?? 1
}

function detailRow(node: Node): number {
  return node.detailLayout?.row ?? 1
}

function buildDetailOccupancy(process: Process, laneId: string): Set<string> {
  return new Set(
    process.nodes
      .filter((node) => node.laneId === laneId)
      .map((node) => `${detailColumn(node)}:${detailRow(node)}`),
  )
}

function findNextDetailLayout(node: Node, occupied: Set<string>): NonNullable<Node['detailLayout']> {
  const baseColumn = detailColumn(node)
  const baseRow = detailRow(node)
  const candidates: NonNullable<Node['detailLayout']>[] = []

  for (let row = Math.min(DETAIL_ROW_COUNT, baseRow + 1); row <= DETAIL_ROW_COUNT; row += 1) {
    candidates.push({ column: baseColumn, row })
  }
  for (let column = baseColumn + 1; column <= baseColumn + 24; column += 1) {
    for (let row = 1; row <= DETAIL_ROW_COUNT; row += 1) {
      candidates.push({ column, row })
    }
  }

  return candidates.find((candidate) => !occupied.has(`${candidate.column}:${candidate.row}`))
    ?? { column: baseColumn + 1, row: baseRow }
}

function buildPastedNode(
  source: Node,
  process: Process,
  viewMode: ViewMode,
  occupiedOverviewSlots: Map<string, Set<number>>,
  occupiedDetailSlots: Map<string, Set<string>>,
): Node {
  const id = generateId('node')
  const {
    id: _oldId,
    offsetX: _offsetX,
    offsetY: _offsetY,
    cellSlot: _cellSlot,
    cellOrder: _cellOrder,
    data: _diagnostics,
    ...rest
  } = source as Node & { data?: unknown }

  const nextCell = nextCellOrder(process, source.laneId, source.processZone)
  const base: Node = {
    ...rest,
    id,
    name: `${source.name} Copy`,
    cellOrder: nextCell,
    offsetX: 0,
    offsetY: 0,
    inputs: [...source.inputs],
    outputs: [...source.outputs],
    controls: [...source.controls],
  }

  if (viewMode === 'overview') {
    const key = `${source.laneId}::${source.processZone ?? ''}`
    const occupied = occupiedOverviewSlots.get(key) ?? buildOverviewSlotOccupancy(process, source.laneId, source.processZone)
    const cellSlot = findNextOverviewSlot(source.cellSlot, occupied)
    if (cellSlot != null) {
      occupied.add(cellSlot)
      occupiedOverviewSlots.set(key, occupied)
      return { ...base, cellSlot, detailLayout: undefined }
    }
    return { ...base, detailLayout: undefined }
  }

  const detailKey = source.laneId
  const occupied = occupiedDetailSlots.get(detailKey) ?? buildDetailOccupancy(process, source.laneId)
  const detailLayout = findNextDetailLayout(source, occupied)
  occupied.add(`${detailLayout.column}:${detailLayout.row}`)
  occupiedDetailSlots.set(detailKey, occupied)

  return {
    ...base,
    cellSlot: undefined,
    detailLayout,
  }
}

export function pasteNodeClipboard(
  process: Process,
  clipboard: NodeClipboard,
  options: PasteNodesOptions,
): PasteNodesResult {
  const idMap = new Map<string, string>()
  const occupiedOverviewSlots = new Map<string, Set<number>>()
  const occupiedDetailSlots = new Map<string, Set<string>>()

  const nodes = clipboard.nodes.map((node) => {
    const pasted = buildPastedNode(node, process, options.viewMode, occupiedOverviewSlots, occupiedDetailSlots)
    idMap.set(node.id, pasted.id)
    return pasted
  })

  const edges = options.includeEdges
    ? clipboard.internalEdges
        .map((edge) => {
          const source = idMap.get(edge.source)
          const target = idMap.get(edge.target)
          if (!source || !target) return null
          return normalizeEdgeForStorage(
            withEdgeHandleDefaults({
              ...cloneEdgeForClipboard(edge),
              id: generateId('edge'),
              source,
              target,
              routing: { mode: 'auto' },
              manualRoute: false,
              bendPoints: undefined,
              points: undefined,
              data: undefined,
              labelPlacement: undefined,
            }),
          )
        })
        .filter((edge): edge is Edge => edge != null)
    : []

  return { nodes, edges }
}
