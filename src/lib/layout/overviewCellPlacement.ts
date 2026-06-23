/** Overview Cell 내부 grid 배치 — cellSlot 기반 (cellOrder는 업무 흐름 순서) */

import type { Edge, Node } from '../../types/process'
import { classifyBranchPolarity } from './edgeBranchRouting'
import { isSettlementBranchNode } from './settlementGroupLayout'
import { isReturnLikeEdge } from './sameLaneReturnRouting'
import { isInterfaceRuleNode } from './interfaceRuleLayout'

export type CellGridLayout = {
  columnCount: number
  rowCount: number
}

export type CellSlotAssignment = {
  slot: number
  row: number
  col: number
  /** 사용자가 cellSlot을 지정한 노드 */
  isManualSlot: boolean
  /** layout 시 충돌로 다른 slot에 임시 배치됨 (자동 배치 노드만) */
  collisionResolved: boolean
  /** JSON에 저장된 cellSlot이 동일 cell 내 다른 노드와 중복 */
  hasStoredCollision: boolean
}

export const OVERVIEW_MAX_CELL_COLUMNS = 2
export const CELL_SLOT_MIN = 1
export const OVERVIEW_CELL_MAX_ROWS = 5
export const DETAIL_CELL_MAX_ROWS = 7
export const CELL_MAX_ROWS = DETAIL_CELL_MAX_ROWS
export const OVERVIEW_CELL_SLOT_MAX = OVERVIEW_CELL_MAX_ROWS * OVERVIEW_MAX_CELL_COLUMNS
export const DETAIL_CELL_SLOT_MAX = DETAIL_CELL_MAX_ROWS * OVERVIEW_MAX_CELL_COLUMNS
export const CELL_SLOT_MAX = DETAIL_CELL_SLOT_MAX
export const LEFT_SLOT_START = 1
export const LEFT_SLOT_END = CELL_MAX_ROWS
export const RIGHT_SLOT_START = CELL_MAX_ROWS + 1
export const RIGHT_SLOT_END = CELL_SLOT_MAX

const COLUMN_LABELS = ['LEFT', 'RIGHT'] as const
const AUXILIARY_NAME_PATTERN = /등록\s*요청|등록\s*승인|예외\s*처리/

/**
 * 2열 slot 구조 (최대 7행):
 * 1  8   LEFT/RIGHT row1
 * 2  9   row2
 * 3  10  row3
 * 4  11  row4
 * 5  12  row5
 * 6  13  row6
 * 7  14  row7
 */
function cellSlotMax(maxRows: number): number {
  return maxRows * OVERVIEW_MAX_CELL_COLUMNS
}

function rightSlotStart(maxRows: number): number {
  return maxRows + 1
}

export function cellSlotToRowCol(
  slot: number,
  maxRows = OVERVIEW_CELL_MAX_ROWS,
): { row: number; col: number } {
  const normalized = clampCellSlot(normalizeLegacyCellSlot(slot, maxRows), maxRows)
  if (normalized <= maxRows) {
    return { row: normalized - LEFT_SLOT_START, col: 0 }
  }
  return { row: normalized - rightSlotStart(maxRows), col: 1 }
}

export function rowColToCellSlot(
  row: number,
  col: number,
  maxRows = OVERVIEW_CELL_MAX_ROWS,
): number {
  const clampedRow = Math.min(Math.max(row, 0), maxRows - 1)
  return col === 0 ? LEFT_SLOT_START + clampedRow : rightSlotStart(maxRows) + clampedRow
}

export function clampCellSlot(slot: number, maxRows = OVERVIEW_CELL_MAX_ROWS): number {
  return Math.min(cellSlotMax(maxRows), Math.max(CELL_SLOT_MIN, slot))
}

/** 3열 레거시 slot(15+) → 2열 slot(1~14) */
export function normalizeLegacyCellSlot(slot: number, maxRows = OVERVIEW_CELL_MAX_ROWS): number {
  const maxSlot = cellSlotMax(maxRows)
  if (slot <= maxSlot) return slot

  const offset = slot - (maxSlot + 1)
  const legacyRow = Math.floor(offset / 3) + maxRows - 1
  const legacyCol = offset % 3
  if (legacyCol === 0) {
    return clampCellSlot(legacyRow + 1, maxRows)
  }
  return clampCellSlot(rightSlotStart(maxRows) + legacyRow - (maxRows - 1), maxRows)
}

export function cellSlotLabel(slot: number, maxRows = DETAIL_CELL_MAX_ROWS): string {
  const { row, col } = cellSlotToRowCol(slot, maxRows)
  const colName = COLUMN_LABELS[col] ?? `열${col + 1}`
  return `${slot}: ${colName} ${row + 1}행`
}

export function buildCellSlotLabels(
  maxSlot = CELL_SLOT_MAX,
  maxRows = DETAIL_CELL_MAX_ROWS,
): Record<number, string> {
  const labels: Record<number, string> = {}
  for (let slot = CELL_SLOT_MIN; slot <= maxSlot; slot += 1) {
    labels[slot] = cellSlotLabel(slot, maxRows)
  }
  return labels
}

export const CELL_SLOT_LABELS: Record<number, string> = buildCellSlotLabels()

/** Property Panel — 1~14 slot 옵션 */
export function listCellSlotOptions(
  maxSlot = CELL_SLOT_MAX,
  maxRows = DETAIL_CELL_MAX_ROWS,
): Array<{ value: number; label: string }> {
  return Array.from({ length: maxSlot }, (_, index) => {
    const value = index + 1
    return { value, label: cellSlotLabel(value, maxRows) }
  })
}

/** 자동 배치 시 노드 수 기준 열 수 — 최대 2열 */
export function resolveAutoColumnCount(nodeCount: number): number {
  if (nodeCount <= 0) return 1
  if (nodeCount <= 5) return 1
  return 2
}

export function estimateCellColumnCount(cellNodes: Node[]): number {
  if (cellNodes.length === 0) return 1
  if (cellHasManualSlots(cellNodes)) {
    return computeCellGridLayoutFromSlots(resolveCellSlotAssignments(cellNodes).values()).columnCount
  }
  return resolveAutoColumnCount(cellNodes.length)
}

export function resolveNodeCellOrder(node: Node): number {
  if (node.cellOrder != null) return node.cellOrder
  if (node.zoneOrder != null) return node.zoneOrder
  if (node.localOrder != null) return node.localOrder
  if (node.phaseOrder != null) return node.phaseOrder
  return 0
}

export function findNextEmptyCellSlot(
  used: Set<number>,
  maxRows = OVERVIEW_CELL_MAX_ROWS,
): number {
  for (let slot = CELL_SLOT_MIN; slot <= cellSlotMax(maxRows); slot += 1) {
    if (!used.has(slot)) return slot
  }
  return cellSlotMax(maxRows)
}

function findEmptySlotInColumn(
  used: Set<number>,
  col: number,
  preferredRow = 0,
  maxRows = OVERVIEW_CELL_MAX_ROWS,
): number | null {
  const preferred = rowColToCellSlot(preferredRow, col, maxRows)
  if (!used.has(preferred)) return preferred

  for (let row = 0; row < maxRows; row += 1) {
    const slot = rowColToCellSlot(row, col, maxRows)
    if (!used.has(slot)) return slot
  }
  return null
}

export function isAuxiliaryCellNode(node: Node, cellNodes: Node[], edges: Edge[] = []): boolean {
  if (node.type === 'exception' || node.type === 'approval') return true
  if (isSettlementBranchNode(node)) return true
  if (node.type === 'decision' || node.type === 'connector') return false
  if (isInterfaceRuleNode(node.type)) return false

  if (AUXILIARY_NAME_PATTERN.test(node.name.trim())) return true

  for (const edge of edges) {
    if (edge.target !== node.id) continue
    const source = cellNodes.find((candidate) => candidate.id === edge.source)
    if (!source || source.type !== 'decision') continue
    if (classifyBranchPolarity(edge) === 'negative' || isReturnLikeEdge(edge)) {
      return true
    }
  }

  return false
}

function inferAuxiliaryPreferredRow(
  node: Node,
  cellNodes: Node[],
  edges: Edge[],
  assignedRows: Map<string, number>,
): number {
  for (const edge of edges) {
    if (edge.target !== node.id) continue
    const source = cellNodes.find((candidate) => candidate.id === edge.source)
    if (!source) continue

    const assignedRow = assignedRows.get(source.id)
    if (assignedRow != null) return assignedRow
  }
  return 0
}

function resolveAutoCellSlots(
  autoNodes: Node[],
  cellNodes: Node[],
  edges: Edge[],
  usedSlots: Set<number>,
  assignedRows: Map<string, number>,
  maxRows: number,
): Map<string, number> {
  const slots = new Map<string, number>()
  const mainNodes = autoNodes.filter((node) => !isAuxiliaryCellNode(node, cellNodes, edges))
  const auxiliaryNodes = autoNodes.filter((node) => isAuxiliaryCellNode(node, cellNodes, edges))
  const useRightColumn = autoNodes.length >= 6 || auxiliaryNodes.length > 0

  let leftRow = 0
  for (const node of mainNodes) {
    let slot = findEmptySlotInColumn(usedSlots, 0, leftRow, maxRows)
    if (slot == null) slot = findNextEmptyCellSlot(usedSlots, maxRows)

    slots.set(node.id, slot)
    usedSlots.add(slot)
    assignedRows.set(node.id, cellSlotToRowCol(slot, maxRows).row)
    leftRow = cellSlotToRowCol(slot, maxRows).row + 1
  }

  if (!useRightColumn) {
    return slots
  }

  for (const node of auxiliaryNodes) {
    const preferredRow = inferAuxiliaryPreferredRow(node, cellNodes, edges, assignedRows)
    let slot = findEmptySlotInColumn(usedSlots, 1, preferredRow, maxRows)
    if (slot == null) slot = findNextEmptyCellSlot(usedSlots, maxRows)

    slots.set(node.id, slot)
    usedSlots.add(slot)
    assignedRows.set(node.id, cellSlotToRowCol(slot, maxRows).row)
  }

  return slots
}

export function sortCellNodes(nodes: Node[]): Node[] {
  return [...nodes].sort(
    (a, b) => resolveNodeCellOrder(a) - resolveNodeCellOrder(b) || a.id.localeCompare(b.id),
  )
}

export function isManualCellSlot(node: Node): boolean {
  return node.cellSlot != null
}

export function cellHasManualSlots(nodes: Node[]): boolean {
  return nodes.some(isManualCellSlot)
}

export type ResolveCellSlotOptions = {
  edges?: Edge[]
  maxRows?: number
}

/** cell 내 노드별 effective slot — manual cellSlot은 절대 변경하지 않음 */
export function resolveCellSlotAssignments(
  cellNodes: Node[],
  options: ResolveCellSlotOptions = {},
): Map<string, CellSlotAssignment> {
  const edges = options.edges ?? []
  const maxRows = options.maxRows ?? OVERVIEW_CELL_MAX_ROWS
  const sorted = sortCellNodes(cellNodes)
  const storedSlotCounts = new Map<number, number>()

  for (const node of sorted) {
    if (node.cellSlot == null) continue
    const normalized = clampCellSlot(normalizeLegacyCellSlot(node.cellSlot, maxRows), maxRows)
    storedSlotCounts.set(normalized, (storedSlotCounts.get(normalized) ?? 0) + 1)
  }

  const usedSlots = new Set<number>()
  const assignedRows = new Map<string, number>()
  const result = new Map<string, CellSlotAssignment>()

  const assign = (
    node: Node,
    slot: number,
    isManualSlot: boolean,
    collisionResolved: boolean,
    hasStoredCollision: boolean,
  ) => {
    const normalized = clampCellSlot(normalizeLegacyCellSlot(slot, maxRows), maxRows)
    const { row, col } = cellSlotToRowCol(normalized, maxRows)
    result.set(node.id, {
      slot: normalized,
      row,
      col,
      isManualSlot,
      collisionResolved,
      hasStoredCollision,
    })
    usedSlots.add(normalized)
    assignedRows.set(node.id, row)
  }

  for (const node of sorted) {
    if (node.cellSlot == null) continue
    const slot = clampCellSlot(normalizeLegacyCellSlot(node.cellSlot, maxRows), maxRows)
    const hasStoredCollision = (storedSlotCounts.get(slot) ?? 0) > 1
    const hasRuntimeCollision = usedSlots.has(slot)
    assign(node, slot, true, false, hasStoredCollision || hasRuntimeCollision)
  }

  const autoNodes = sorted.filter((node) => node.cellSlot == null)
  const autoSlots = resolveAutoCellSlots(autoNodes, sorted, edges, usedSlots, assignedRows, maxRows)

  for (const node of autoNodes) {
    const preferred = autoSlots.get(node.id)
    if (preferred != null) {
      assign(node, preferred, false, false, false)
      continue
    }

    const slot = findNextEmptyCellSlot(usedSlots, maxRows)
    assign(node, slot, false, true, false)
  }

  return result
}

export function getMaxRowFromAssignments(
  assignments: Iterable<Pick<CellSlotAssignment, 'row'>>,
): number {
  let maxRow = -1
  for (const { row } of assignments) {
    maxRow = Math.max(maxRow, row)
  }
  return maxRow
}

export function clampCellGridLayout(layout: CellGridLayout, maxColumnCount?: number): CellGridLayout {
  if (!maxColumnCount || layout.columnCount <= maxColumnCount) {
    return layout
  }
  return { ...layout, columnCount: maxColumnCount }
}

export function computeCellGridLayoutFromSlots(
  assignments: Iterable<Pick<CellSlotAssignment, 'row' | 'col'>>,
  maxColumnCount?: number,
): CellGridLayout {
  let maxRow = -1
  let maxCol = -1
  let hasAny = false

  for (const { row, col } of assignments) {
    hasAny = true
    maxRow = Math.max(maxRow, row)
    maxCol = Math.max(maxCol, col)
  }

  if (!hasAny) {
    return { columnCount: 1, rowCount: 0 }
  }

  const rawColumnCount = maxCol + 1
  const columnCount = maxColumnCount
    ? Math.min(rawColumnCount, maxColumnCount)
    : Math.min(rawColumnCount, OVERVIEW_MAX_CELL_COLUMNS)
  return { columnCount, rowCount: maxRow + 1 }
}

/** @deprecated slot 기반 computeCellGridLayoutFromSlots 사용 */
export function computeCellGridLayout(nodeCount: number): CellGridLayout {
  if (nodeCount <= 0) {
    return { columnCount: 1, rowCount: 0 }
  }
  const columnCount = resolveAutoColumnCount(nodeCount)
  return {
    columnCount,
    rowCount: Math.max(1, Math.ceil(nodeCount / columnCount)),
  }
}

function cellSlotCollisionMessage(node: Node, laneNodes: Node[], maxRows: number): string | null {
  if (node.cellSlot == null) return null

  const normalized = clampCellSlot(normalizeLegacyCellSlot(node.cellSlot, maxRows), maxRows)
  const duplicate = laneNodes.some((n) => {
    if (n.id === node.id || n.cellSlot == null) return false
    return clampCellSlot(normalizeLegacyCellSlot(n.cellSlot, maxRows), maxRows) === normalized
  })
  if (duplicate) {
    return '동일한 셀 위치가 이미 사용 중입니다. 배치가 겹칠 수 있습니다.'
  }

  const assignment = resolveCellSlotAssignments(laneNodes, { maxRows }).get(node.id)
  if (assignment?.hasStoredCollision) {
    return '동일한 셀 위치가 이미 사용 중입니다. 배치가 겹칠 수 있습니다.'
  }

  return null
}

/** Property Panel — Overview zone+lane cellSlot 중복 경고 */
export function getCellSlotCollisionWarning(node: Node, process: { nodes: Node[] }): string | null {
  if (node.cellSlot == null || !node.processZone) return null
  const cellNodes = getCellNodesInOrder(process, node.processZone, node.laneId)
  return cellSlotCollisionMessage(node, cellNodes, OVERVIEW_CELL_MAX_ROWS)
}

/** Property Panel — Detail swimlane cellSlot 중복 경고 */
export function getLaneCellSlotCollisionWarning(node: Node, process: { nodes: Node[] }): string | null {
  if (node.cellSlot == null) return null
  const laneNodes = getLaneNodesInOrder(process, node.laneId)
  return cellSlotCollisionMessage(node, laneNodes, DETAIL_CELL_MAX_ROWS)
}

export function getCellNodesInOrder(process: { nodes: Node[] }, zoneId: string, laneId: string): Node[] {
  return process.nodes
    .filter((n) => n.processZone === zoneId && n.laneId === laneId)
    .sort(
      (a, b) => resolveNodeCellOrder(a) - resolveNodeCellOrder(b) || a.id.localeCompare(b.id),
    )
}

export function getLaneNodesInOrder(process: { nodes: Node[] }, laneId: string): Node[] {
  return process.nodes
    .filter((n) => n.laneId === laneId)
    .sort(
      (a, b) => resolveNodeCellOrder(a) - resolveNodeCellOrder(b) || a.id.localeCompare(b.id),
    )
}
