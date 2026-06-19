import type { Edge as FlowEdge, Node as FlowNode } from '@xyflow/react'
import type { Node, Process, ProcessZoneId, Edge } from '../../types/process'
import { buildProcessFlowNode } from '../buildProcessFlowNode'
import type { ProcessNodeData } from './elkLayout'
import { getPathBounds } from './edgeRouter'
import {
  type CanvasBounds,
  type LaneBand,
  type PlacedNode,
  validateNodes,
} from './laneLayout'
import { CANVAS_BOTTOM_PADDING, CANVAS_TOP_PADDING } from './layoutConfig'
import { applyReturnMovementGroupLayout } from './returnMovementGroupLayout'
import { applySettlementGroupLayout } from './settlementGroupLayout'
import { buildOverviewEdges } from './overviewEdgePipeline'
import {
  gridNodeVisualHeight,
  OVERVIEW_GRID_METRICS,
  type OverviewGridMetrics,
} from './overviewGridMetrics'
import {
  getCellPlacementSize,
  resolveCellColumnLayout,
} from './cellColumnLayout'
import {
  gridContentWidthFromProcess,
  laneColumnLeftFromProcess,
  resolveLaneCellWidth,
  resolvePhaseMinHeight,
} from './laneLayoutResolver'
import { DECISION_NODE_LAYOUT } from './decisionNodeLayout'
import { PROCESS_ZONES, resolveNodeZone, zoneOrderIndex } from './overviewProcessZones'
import { placeOverviewInterfaceRules, isInterfaceRuleNode } from './interfaceRuleLayout'
import { isConnectorNodeType, placeConnectorNodes } from './connectorLayout'
import {
  cellHasManualSlots,
  computeCellGridLayoutFromSlots,
  getMaxRowFromAssignments,
  OVERVIEW_MAX_CELL_COLUMNS,
  resolveCellSlotAssignments,
  sortCellNodes,
  type CellGridLayout,
  type CellSlotAssignment,
} from './overviewCellPlacement'

export type ZoneLayoutBand = {
  zoneId: ProcessZoneId
  label: string
  y: number
  height: number
  bottom: number
}

export type OverviewGridLayoutResult = {
  nodes: FlowNode<ProcessNodeData>[]
  edges: FlowEdge[]
  laneBands: LaneBand[]
  zoneBands: ZoneLayoutBand[]
  canvasBounds: CanvasBounds
  layoutOrientation: 'vertical'
  metrics: OverviewGridMetrics
}

type CellKey = `${ProcessZoneId}::${string}`

function cellKey(zoneId: ProcessZoneId, laneId: string): CellKey {
  return `${zoneId}::${laneId}`
}

function laneColumnLeft(process: Process, laneOrder: number, metrics: OverviewGridMetrics): number {
  return laneColumnLeftFromProcess(process, laneOrder, metrics.zoneLabelColumnWidth, metrics.cellWidth)
}

function buildCellNodeGrid(
  sortedNodes: Node[],
  assignments: Map<string, CellSlotAssignment>,
  layout: CellGridLayout,
): (Node | null)[][] {
  const { rowCount, columnCount } = layout
  if (rowCount <= 0 || columnCount <= 0) {
    return []
  }

  const grid: (Node | null)[][] = Array.from({ length: rowCount }, () =>
    Array.from({ length: columnCount }, () => null),
  )

  for (const node of sortedNodes) {
    const assignment = assignments.get(node.id)
    if (!assignment) continue
    const row = Math.min(Math.max(assignment.row, 0), rowCount - 1)
    const col = Math.min(Math.max(assignment.col, 0), columnCount - 1)
    grid[row][col] = node
  }

  return grid
}

function prepareCellLayout(
  nodes: Node[],
  edges: Edge[] = [],
  maxColumnCount?: number,
): {
  sorted: Node[]
  assignments: Map<string, CellSlotAssignment>
  layout: CellGridLayout
} {
  const sorted = sortCellNodes(nodes)
  const assignments = resolveCellSlotAssignments(sorted, { edges })
  const layout = computeCellGridLayoutFromSlots(
    assignments.values(),
    maxColumnCount ?? OVERVIEW_MAX_CELL_COLUMNS,
  )
  return { sorted, assignments, layout }
}

function gapBetweenRowPair(
  grid: (Node | null)[][],
  upperRow: number,
  lowerRow: number,
  metrics: OverviewGridMetrics,
): number {
  if (lowerRow <= upperRow) return 0

  let gap = metrics.nodeGapY
  const colCount = Math.max(grid[upperRow]?.length ?? 0, grid[lowerRow]?.length ?? 0)
  for (let col = 0; col < colCount; col++) {
    const upper = grid[upperRow]?.[col]
    if (!upper || upper.type !== 'decision') continue

    for (let row = upperRow + 1; row <= lowerRow; row++) {
      const lower = grid[row]?.[col]
      if (!lower) continue
      if (lower.type !== 'decision') {
        gap = Math.max(gap, DECISION_NODE_LAYOUT.belowMinGap)
      }
      break
    }
  }
  return gap
}

function computeRowHeights(
  grid: (Node | null)[][],
  metrics: OverviewGridMetrics,
  manualMode: boolean,
  maxRowIndex: number,
): number[] {
  return grid.map((rowNodes, rowIndex) => {
    let maxNodeHeight = 0
    let hasDecision = false
    let hasNode = false

    for (const node of rowNodes) {
      if (!node) continue
      hasNode = true
      maxNodeHeight = Math.max(maxNodeHeight, gridNodeVisualHeight(node.type, metrics))
      if (node.type === 'decision') hasDecision = true
    }

    if (hasNode) {
      const padded = maxNodeHeight + metrics.rowPaddingY
      if (hasDecision) {
        return Math.max(padded, metrics.rowMinHeightDecision)
      }
      return Math.max(padded, metrics.rowMinHeightNormal)
    }

    if (manualMode && rowIndex <= maxRowIndex) {
      return metrics.rowMinHeightNormal
    }

    return 0
  })
}

function computeRowYOffsets(
  grid: (Node | null)[][],
  rowHeights: number[],
  metrics: OverviewGridMetrics,
  manualMode: boolean,
  maxRowIndex: number,
): number[] {
  const offsets = new Array<number>(rowHeights.length).fill(0)
  let y = 0

  for (let row = 0; row < rowHeights.length; row++) {
    offsets[row] = y
    const rowHeight = rowHeights[row]
    if (rowHeight <= 0) continue

    y += rowHeight

    if (manualMode) {
      if (row < maxRowIndex) {
        y += metrics.nodeGapY
      }
      continue
    }

    const nextActive = (() => {
      for (let r = row + 1; r < rowHeights.length; r++) {
        if (rowHeights[r] > 0) return r
      }
      return -1
    })()
    if (nextActive >= 0) {
      y += gapBetweenRowPair(grid, row, nextActive, metrics)
    }
  }

  return offsets
}

function computeContentHeightFromRows(
  rowHeights: number[],
  metrics: OverviewGridMetrics,
  manualMode: boolean,
  maxRowIndex: number,
  grid?: (Node | null)[][],
): number {
  if (rowHeights.length === 0) return 0

  if (manualMode) {
    let total = 0
    for (let row = 0; row <= maxRowIndex; row++) {
      total += rowHeights[row] ?? 0
      if (row < maxRowIndex) {
        total += metrics.nodeGapY
      }
    }
    return total
  }

  const activeRowIndices = rowHeights
    .map((h, i) => (h > 0 ? i : -1))
    .filter((i) => i >= 0)

  let total = activeRowIndices.reduce((sum, i) => sum + rowHeights[i], 0)
  if (!grid) return total

  for (let k = 0; k < activeRowIndices.length - 1; k++) {
    total += gapBetweenRowPair(grid, activeRowIndices[k], activeRowIndices[k + 1], metrics)
  }

  return total
}

function computeCellContentHeight(
  nodes: Node[],
  metrics: OverviewGridMetrics,
  edges: Edge[] = [],
  maxColumnCount?: number,
): number {
  if (nodes.length === 0) return 0

  const { assignments, layout } = prepareCellLayout(nodes, edges, maxColumnCount)
  const manualMode = cellHasManualSlots(nodes)
  const sorted = sortCellNodes(nodes)
  const grid = buildCellNodeGrid(sorted, assignments, layout)
  const maxRowIndex = manualMode
    ? getMaxRowFromAssignments(assignments.values())
    : getMaxOccupiedRowIndex(grid)
  const rowHeights = computeRowHeights(grid, metrics, manualMode, maxRowIndex)

  return computeContentHeightFromRows(rowHeights, metrics, manualMode, maxRowIndex, grid) + metrics.cellPaddingY * 2
}

function getMaxOccupiedRowIndex(grid: (Node | null)[][]): number {
  let maxOccupiedRow = -1
  for (let row = 0; row < grid.length; row++) {
    if (grid[row].some((node) => node != null)) {
      maxOccupiedRow = row
    }
  }
  return maxOccupiedRow
}

export function computeLaneCellHeight(
  nodes: Node[],
  metrics: OverviewGridMetrics,
  edges: Edge[] = [],
  maxColumnCount?: number,
  process?: Process,
): number {
  if (nodes.length === 0) return metrics.cellMinHeight
  const phaseMin = process ? resolvePhaseMinHeight(process, nodes) : 0
  return Math.max(
    metrics.cellMinHeight,
    phaseMin,
    computeCellContentHeight(nodes, metrics, edges, maxColumnCount ?? OVERVIEW_MAX_CELL_COLUMNS),
  )
}

export type LaneCellPlacementOptions = {
  /** Detail 등 — cell 열 상한 (기본 Overview 2열) */
  maxColumnCount?: number
  edges?: Edge[]
  /** Overview Zone — 동일 row 번호를 모든 lane에서 같은 Y로 맞출 때 */
  unifiedRows?: ZoneUnifiedRowLayout
  /** unifiedRows 사용 시 공통 yBase (zone 내 lane 동일) */
  yBaseOverride?: number
}

/** Zone 전체 lane 공유 row 높이·offset */
export type ZoneUnifiedRowLayout = {
  rowHeights: number[]
  rowYOffsets: number[]
  maxRowIndex: number
}

type LaneCellRowPlan = {
  grid: (Node | null)[][]
  rowHeights: number[]
  maxRowIndex: number
  manualMode: boolean
}

export function buildLaneCellRowPlan(
  nodes: Node[],
  edges: Edge[],
  metrics: OverviewGridMetrics,
  maxColumnCount?: number,
): LaneCellRowPlan | null {
  if (nodes.length === 0) return null

  const { sorted, assignments, layout } = prepareCellLayout(
    nodes,
    edges,
    maxColumnCount ?? OVERVIEW_MAX_CELL_COLUMNS,
  )
  const manualMode = cellHasManualSlots(nodes)
  const grid = buildCellNodeGrid(sorted, assignments, layout)
  const maxRowIndex = manualMode
    ? getMaxRowFromAssignments(assignments.values())
    : getMaxOccupiedRowIndex(grid)

  return {
    grid,
    rowHeights: computeRowHeights(grid, metrics, manualMode, maxRowIndex),
    maxRowIndex,
    manualMode,
  }
}

export function computeZoneUnifiedRowLayout(
  lanePlans: LaneCellRowPlan[],
  metrics: OverviewGridMetrics,
): ZoneUnifiedRowLayout {
  if (lanePlans.length === 0) {
    return { rowHeights: [], rowYOffsets: [], maxRowIndex: -1 }
  }

  const maxRowIndex = Math.max(...lanePlans.map((plan) => plan.maxRowIndex))
  if (maxRowIndex < 0) {
    return { rowHeights: [], rowYOffsets: [], maxRowIndex: -1 }
  }

  const rowCount = maxRowIndex + 1
  const rowHeights = Array.from({ length: rowCount }, (_, row) => {
    let maxH = 0
    let rowUsed = false

    for (const plan of lanePlans) {
      const localHeight = plan.rowHeights[row] ?? 0
      if (localHeight > 0 || plan.grid[row]?.some((node) => node != null)) {
        rowUsed = true
        maxH = Math.max(maxH, localHeight)
      } else if (plan.manualMode && row <= plan.maxRowIndex) {
        rowUsed = true
        maxH = Math.max(maxH, metrics.rowMinHeightNormal)
      }
    }

    if (rowUsed) return maxH
    return row <= maxRowIndex ? metrics.rowMinHeightNormal : 0
  })

  const rowYOffsets = new Array<number>(rowCount).fill(0)
  let y = 0

  for (let row = 0; row < rowCount; row++) {
    rowYOffsets[row] = y
    const rowHeight = rowHeights[row] ?? 0
    if (rowHeight <= 0) continue

    y += rowHeight

    if (row < maxRowIndex) {
      let gap = metrics.nodeGapY
      for (const plan of lanePlans) {
        gap = Math.max(gap, gapBetweenRowPair(plan.grid, row, row + 1, metrics))
      }
      y += gap
    }
  }

  return { rowHeights, rowYOffsets, maxRowIndex }
}

export function computeUnifiedContentHeight(
  unified: ZoneUnifiedRowLayout,
  metrics: OverviewGridMetrics,
): number {
  if (unified.maxRowIndex < 0) return 0

  let total = 0
  for (let row = 0; row <= unified.maxRowIndex; row++) {
    total += unified.rowHeights[row] ?? 0
    if (row < unified.maxRowIndex) {
      total += metrics.nodeGapY
    }
  }
  return total
}

export type PlacedCellNode = PlacedNode

export function placeNodesInLaneCell(
  nodes: Node[],
  cellLeft: number,
  cellTop: number,
  cellWidth: number,
  _cellHeight: number,
  metrics: OverviewGridMetrics,
  options?: LaneCellPlacementOptions,
): PlacedCellNode[] {
  if (nodes.length === 0) return []
  void _cellHeight

  const maxColumnCount = options?.maxColumnCount ?? OVERVIEW_MAX_CELL_COLUMNS
  const edges = options?.edges ?? []
  const unifiedRows = options?.unifiedRows
  const { sorted, assignments, layout } = prepareCellLayout(nodes, edges, maxColumnCount)
  const manualMode = cellHasManualSlots(nodes)
  const { columnCount, rowCount } = layout
  const grid = buildCellNodeGrid(sorted, assignments, layout)
  const maxRowIndex = manualMode
    ? getMaxRowFromAssignments(assignments.values())
    : getMaxOccupiedRowIndex(grid)
  const localRowHeights = computeRowHeights(grid, metrics, manualMode, maxRowIndex)
  const rowHeights = unifiedRows?.rowHeights ?? localRowHeights
  const rowYOffsets = unifiedRows?.rowYOffsets ?? computeRowYOffsets(grid, localRowHeights, metrics, manualMode, maxRowIndex)
  const cellLayout = resolveCellColumnLayout(cellLeft, cellWidth, columnCount, metrics)
  const yBase = options?.yBaseOverride ?? cellTop + metrics.cellPaddingY

  const placed: PlacedCellNode[] = []

  for (const node of sorted) {
    const assignment = assignments.get(node.id)
    if (!assignment) continue

    const row = Math.min(Math.max(assignment.row, 0), rowCount - 1)
    const col = Math.min(Math.max(assignment.col, 0), columnCount - 1)
    const rowHeight = rowHeights[row] ?? metrics.rowMinHeightNormal
    const size = getCellPlacementSize(node.type, metrics, cellLayout, node.name)
    const columnCenterX = cellLayout.columnCenters[col] ?? cellLayout.columnCenters[0]
    const rowTop = yBase + (rowYOffsets[row] ?? 0)
    const rowCenterY = rowTop + rowHeight / 2
    const nodeY = unifiedRows || manualMode ? rowTop : rowCenterY - size.height / 2

    placed.push({
      id: node.id,
      laneId: node.laneId,
      x: columnCenterX - size.width / 2 + (node.offsetX ?? 0),
      y: nodeY + (node.offsetY ?? 0),
      width: size.width,
      height: size.height,
    })
  }

  return placed
}

function buildLaneBands(
  process: Process,
  contentTop: number,
  contentHeight: number,
  metrics: OverviewGridMetrics,
): LaneBand[] {
  return [...process.lanes]
    .sort((a, b) => a.order - b.order)
    .map((lane) => {
      const x = laneColumnLeft(process, lane.order, metrics)
      const laneWidth = resolveLaneCellWidth(process, lane.id, metrics.cellWidth)
      const height = contentHeight + metrics.cellPaddingY

      return {
        laneId: lane.id,
        laneName: lane.name,
        ownerDepartment: lane.ownerDepartment,
        x,
        y: contentTop,
        width: laneWidth,
        height,
        contentLeft: x + metrics.cellPaddingX,
        contentTop: contentTop + metrics.cellPaddingY,
        contentBottom: contentTop + height - metrics.cellPaddingY,
        contentRight: x + laneWidth - metrics.cellPaddingX,
      }
    })
}

function toFlowNodes(process: Process, placed: PlacedNode[]): FlowNode<ProcessNodeData>[] {
  return placed.map((node) => {
    const source = process.nodes.find((n) => n.id === node.id)!
    return buildProcessFlowNode(source, process, node, true)
  })
}

/**
 * Overview grid layout — node.processZone(구조적 Y grid) 기준 배치.
 * process.zones(visual grouping)는 배치 후 computeProcessZoneRects로만 그려지며
 * cellSlot/cellOrder/row height에 영향하지 않음.
 */
export function getOverviewGridLayout(
  process: Process,
  metrics: OverviewGridMetrics = OVERVIEW_GRID_METRICS,
): OverviewGridLayoutResult {
  const afterSettlement = applySettlementGroupLayout(process)
  const laidOutNodes = applyReturnMovementGroupLayout({ ...process, nodes: afterSettlement })
  const validNodes = validateNodes({ ...process, nodes: laidOutNodes })
  /** edges: JSON process sequence — layout/노드 유효성으로 삭제하지 않음 */
  const processWithEdges = { ...process, nodes: validNodes, edges: process.edges }

  const sortedLanes = [...process.lanes].sort((a, b) => a.order - b.order)
  /** Lane 헤더는 HTML sticky — 캔버스 Y는 zone부터 시작 */
  const contentTop = CANVAS_TOP_PADDING

  const cells = new Map<CellKey, Node[]>()
  for (const node of validNodes) {
    if (isInterfaceRuleNode(node.type) || isConnectorNodeType(node.type)) continue
    const zone = resolveNodeZone(node)
    const key = cellKey(zone.zoneId, node.laneId)
    const list = cells.get(key) ?? []
    list.push(node)
    cells.set(key, list)
  }

  const zoneLanePlans = new Map<
    ProcessZoneId,
    Array<{
      laneId: string
      cellLeft: number
      cellNodes: Node[]
      plan: LaneCellRowPlan
    }>
  >()

  for (const zone of PROCESS_ZONES) {
    const entries: Array<{
      laneId: string
      cellLeft: number
      cellNodes: Node[]
      plan: LaneCellRowPlan
    }> = []

    for (const lane of sortedLanes) {
      const key = cellKey(zone.id, lane.id)
      const cellNodes = cells.get(key) ?? []
      const plan = buildLaneCellRowPlan(cellNodes, processWithEdges.edges, metrics)
      if (!plan) continue

      entries.push({
        laneId: lane.id,
        cellLeft: laneColumnLeft(processWithEdges, lane.order, metrics),
        cellNodes,
        plan,
      })
    }

    zoneLanePlans.set(zone.id, entries)
  }

  const zoneUnifiedRows = new Map<ProcessZoneId, ZoneUnifiedRowLayout>()
  const zoneHeights = new Map<ProcessZoneId, number>()

  for (const zone of PROCESS_ZONES) {
    const entries = zoneLanePlans.get(zone.id) ?? []
    const unifiedRows = computeZoneUnifiedRowLayout(
      entries.map((entry) => entry.plan),
      metrics,
    )
    zoneUnifiedRows.set(zone.id, unifiedRows)
    const unifiedHeight = computeUnifiedContentHeight(unifiedRows, metrics)
    zoneHeights.set(
      zone.id,
      Math.max(metrics.cellMinHeight, unifiedHeight + metrics.cellPaddingY * 2),
    )
  }

  const zoneBands: ZoneLayoutBand[] = []
  let zoneTop = contentTop

  for (const zone of PROCESS_ZONES) {
    const height = zoneHeights.get(zone.id) ?? metrics.cellMinHeight
    zoneBands.push({
      zoneId: zone.id,
      label: zone.label,
      y: zoneTop,
      height,
      bottom: zoneTop + height,
    })
    zoneTop += height + metrics.zoneGap
  }

  const contentHeight =
    zoneBands.length > 0
      ? zoneBands[zoneBands.length - 1].bottom - contentTop
      : 0

  let placed: PlacedNode[] = []
  for (const zoneBand of zoneBands) {
    const entries = zoneLanePlans.get(zoneBand.zoneId) ?? []
    const unifiedRows = zoneUnifiedRows.get(zoneBand.zoneId)
    const yBase = zoneBand.y + metrics.cellPaddingY

    for (const entry of entries) {
      const laneWidth = resolveLaneCellWidth(processWithEdges, entry.laneId, metrics.cellWidth)
      const cellPlaced = placeNodesInLaneCell(
        entry.cellNodes,
        entry.cellLeft,
        zoneBand.y,
        laneWidth,
        zoneBand.height,
        metrics,
        {
          edges: processWithEdges.edges,
          unifiedRows,
          yBaseOverride: yBase,
        },
      )
      placed = placed.concat(cellPlaced)
    }
  }

  const canvasWidth = gridContentWidthFromProcess(processWithEdges, metrics.zoneLabelColumnWidth, metrics.cellWidth)

  placed = placeConnectorNodes(processWithEdges, placed)

  const bands = buildLaneBands(processWithEdges, contentTop, contentHeight, metrics)
  const minContentX = bands[0]?.contentLeft ?? metrics.zoneLabelColumnWidth

  const { flowEdges: builtEdges } = buildOverviewEdges(processWithEdges, placed, minContentX)

  const rulePlaced = placeOverviewInterfaceRules(
    processWithEdges,
    zoneBands,
    sortedLanes,
    builtEdges,
    metrics,
  )
  placed = placed.concat(rulePlaced)

  const edgeMaxX = Math.max(
    canvasWidth,
    ...builtEdges.map((e) => {
      const path = (e.data as { elkPath?: string })?.elkPath
      return path ? getPathBounds(path).maxX : 0
    }),
  )

  const edgeMaxY = Math.max(
    contentTop + contentHeight,
    ...builtEdges.map((e) => {
      const path = (e.data as { elkPath?: string })?.elkPath
      return path ? getPathBounds(path).maxY : 0
    }),
  )

  const canvasBounds: CanvasBounds = {
    width: Math.max(canvasWidth, edgeMaxX + 24),
    height: Math.max(contentTop + contentHeight, edgeMaxY) + CANVAS_BOTTOM_PADDING,
    topPadding: CANVAS_TOP_PADDING,
    bottomPadding: CANVAS_BOTTOM_PADDING,
  }

  return {
    nodes: toFlowNodes(processWithEdges, placed),
    edges: builtEdges,
    laneBands: bands,
    zoneBands,
    canvasBounds,
    layoutOrientation: 'vertical',
    metrics,
  }
}

export { zoneOrderIndex }
