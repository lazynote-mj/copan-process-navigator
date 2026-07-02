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
  type CellColumnLayout,
} from './cellColumnLayout'
import {
  gridContentWidthFromProcess,
  laneColumnLeftFromProcess,
  resolveLaneCellWidth,
  resolvePhaseMinHeight,
} from './laneLayoutResolver'
import { DECISION_NODE_LAYOUT } from './decisionNodeLayout'
import { PROCESS_ZONES, resolveNodeZone, zoneOrderIndex } from './overviewProcessZones'
import { isInterfaceRuleNode } from './interfaceRuleLayout'
import { isConnectorNodeType, placeConnectorNodes } from './connectorLayout'
import {
  cellHasManualSlots,
  computeCellGridLayoutFromSlots,
  getMaxRowFromAssignments,
  OVERVIEW_CELL_MAX_ROWS,
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
  maxRows = OVERVIEW_CELL_MAX_ROWS,
): {
  sorted: Node[]
  assignments: Map<string, CellSlotAssignment>
  layout: CellGridLayout
} {
  const sorted = sortCellNodes(nodes)
  const assignments = resolveCellSlotAssignments(sorted, { edges, maxRows })
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
    if (!upper || (upper.type !== 'decision' && !isInterfaceRuleNode(upper.type))) continue

    for (let row = upperRow + 1; row <= lowerRow; row++) {
      const lower = grid[row]?.[col]
      if (!lower) continue
      if (lower.type !== 'decision' && !isInterfaceRuleNode(lower.type)) {
        gap = Math.max(gap, DECISION_NODE_LAYOUT.belowMinGap)
      }
      break
    }
  }
  return gap
}

function rowNodePlacementHeight(
  node: Node,
  metrics: OverviewGridMetrics,
  cellLayout?: CellColumnLayout,
): number {
  if (cellLayout) {
    return getCellPlacementSize(node.type, metrics, cellLayout, node.name).height
  }
  return gridNodeVisualHeight(node.type, metrics)
}

function computeStableSlotRowHeight(metrics: OverviewGridMetrics): number {
  const paddedNormal = metrics.nodeHeight + metrics.rowPaddingY * 2
  const paddedDecision =
    metrics.decisionHeight + metrics.rowPaddingY * 2 + DECISION_NODE_LAYOUT.exclusionPadding
  return Math.max(
    metrics.rowMinHeightNormal,
    metrics.rowMinHeightDecision,
    paddedNormal,
    paddedDecision,
  )
}

function computeRowHeights(
  grid: (Node | null)[][],
  metrics: OverviewGridMetrics,
  manualMode: boolean,
  maxRowIndex: number,
  cellLayout?: CellColumnLayout,
  stableSlotMode = manualMode,
): number[] {
  if (stableSlotMode) {
    const stableRowHeight = computeStableSlotRowHeight(metrics)
    return grid.map((rowNodes, rowIndex) => {
      if (rowIndex > maxRowIndex) return 0

      let rowHeight = stableRowHeight
      for (const node of rowNodes) {
        if (!node) continue
        rowHeight = Math.max(
          rowHeight,
          rowNodePlacementHeight(node, metrics, cellLayout) + metrics.rowPaddingY * 2,
        )
      }

      return rowHeight
    })
  }

  return grid.map((rowNodes, rowIndex) => {
    let maxNodeHeight = 0
    let hasDecision = false
    let hasNode = false
    const isLastRow = rowIndex === maxRowIndex

    for (const node of rowNodes) {
      if (!node) continue
      hasNode = true
      maxNodeHeight = Math.max(maxNodeHeight, rowNodePlacementHeight(node, metrics, cellLayout))
      if (node.type === 'decision' || isInterfaceRuleNode(node.type)) hasDecision = true
    }

    if (hasNode) {
      const topPad = metrics.rowPaddingY
      let bottomPad = metrics.rowPaddingY
      if (isLastRow && hasDecision) {
        bottomPad = Math.max(bottomPad, DECISION_NODE_LAYOUT.exclusionPadding)
      }
      const padded = maxNodeHeight + topPad + bottomPad
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

function findNextActiveRow(rowHeights: number[], fromRow: number): number {
  for (let row = fromRow; row < rowHeights.length; row++) {
    if ((rowHeights[row] ?? 0) > 0) return row
  }
  return -1
}

function computeRowYOffsets(
  grid: (Node | null)[][],
  rowHeights: number[],
  metrics: OverviewGridMetrics,
  manualMode: boolean,
  maxRowIndex: number,
  stableSlotMode = manualMode,
): number[] {
  const offsets = new Array<number>(rowHeights.length).fill(0)
  let y = 0

  if (stableSlotMode) {
    for (let row = 0; row < rowHeights.length; row++) {
      offsets[row] = y
      const rowHeight = rowHeights[row] ?? 0
      if (row <= maxRowIndex && rowHeight > 0) {
        y += rowHeight
        if (row < maxRowIndex) {
          y += metrics.nodeGapY
        }
      }
    }
    return offsets
  }

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

    const nextActive = findNextActiveRow(rowHeights, row + 1)
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
  stableSlotMode = manualMode,
): number {
  if (rowHeights.length === 0) return 0

  if (stableSlotMode) {
    let total = 0
    for (let row = 0; row <= maxRowIndex; row++) {
      total += rowHeights[row] ?? 0
      if (row < maxRowIndex) {
        total += metrics.nodeGapY
      }
    }
    return total
  }

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
  maxRows = OVERVIEW_CELL_MAX_ROWS,
): number {
  if (nodes.length === 0) return 0

  const { assignments, layout } = prepareCellLayout(nodes, edges, maxColumnCount, maxRows)
  const manualMode = cellHasManualSlots(nodes)
  const sorted = sortCellNodes(nodes)
  const grid = buildCellNodeGrid(sorted, assignments, layout)
  const maxRowIndex = manualMode
    ? getMaxRowFromAssignments(assignments.values())
    : getMaxOccupiedRowIndex(grid)
  const stableSlotMode = true
  const rowHeights = computeRowHeights(
    grid,
    metrics,
    manualMode,
    maxRowIndex,
    undefined,
    stableSlotMode,
  )

  return computeContentHeightFromRows(
    rowHeights,
    metrics,
    manualMode,
    maxRowIndex,
    grid,
    stableSlotMode,
  ) + metrics.cellPaddingY * 2
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
  maxRows = OVERVIEW_CELL_MAX_ROWS,
): number {
  if (nodes.length === 0) return metrics.cellMinHeight
  const phaseMin = process ? resolvePhaseMinHeight(process, nodes) : 0
  return Math.max(
    metrics.cellMinHeight,
    phaseMin,
    computeCellContentHeight(nodes, metrics, edges, maxColumnCount ?? OVERVIEW_MAX_CELL_COLUMNS, maxRows),
  )
}

export type LaneCellPlacementOptions = {
  /** Detail etc. - max columns per cell (Overview default 2) */
  maxColumnCount?: number
  edges?: Edge[]
  /** Overview zone cell - unify row Y across columns within the same lane */
  unifiedRows?: ZoneUnifiedRowLayout
  /** yBase when unifiedRows is set */
  yBaseOverride?: number
  /** manual cellSlot - lane-wide LEFT/RIGHT column X (aligned across zones) */
  laneColumnLayout?: CellColumnLayout
  maxRows?: number
}

/** Lane cell shared row heights and absolute Y offsets (within the lane) */
export type ZoneUnifiedRowLayout = {
  rowHeights: number[]
  rowYOffsets: number[]
  maxRowIndex: number
}

/** Unify row bands across columns inside one lane cell (not across swimlanes). */
export function computeLaneCellUnifiedRowLayout(
  plan: LaneCellRowPlan,
  metrics: OverviewGridMetrics,
): ZoneUnifiedRowLayout {
  return computeZoneUnifiedRowLayout([plan], metrics)
}

/**
 * Zone-wide row bands: row height is max across swimlanes; row Y is max of each
 * lane's local offsets so the same cellSlot row aligns horizontally without
 * importing another lane's decision-row gaps into gap spacing.
 */
export function computeZoneCellUnifiedRowLayout(
  lanePlans: LaneCellRowPlan[],
  metrics: OverviewGridMetrics,
): ZoneUnifiedRowLayout {
  return computeZoneUnifiedRowLayout(lanePlans, metrics)
}

type LaneCellRowPlan = {
  grid: (Node | null)[][]
  rowHeights: number[]
  maxRowIndex: number
  manualMode: boolean
  stableSlotMode: boolean
}

export function buildLaneCellRowPlan(
  nodes: Node[],
  edges: Edge[],
  metrics: OverviewGridMetrics,
  maxColumnCount?: number,
  cellLayout?: CellColumnLayout,
  maxRows = OVERVIEW_CELL_MAX_ROWS,
): LaneCellRowPlan | null {
  if (nodes.length === 0) return null

  const { sorted, assignments, layout } = prepareCellLayout(
    nodes,
    edges,
    maxColumnCount ?? OVERVIEW_MAX_CELL_COLUMNS,
    maxRows,
  )
  const manualMode = cellHasManualSlots(nodes)
  const grid = buildCellNodeGrid(sorted, assignments, layout)
  const maxRowIndex = manualMode
    ? getMaxRowFromAssignments(assignments.values())
    : getMaxOccupiedRowIndex(grid)
  const stableSlotMode = true

  return {
    grid,
    rowHeights: computeRowHeights(
      grid,
      metrics,
      manualMode,
      maxRowIndex,
      cellLayout,
      stableSlotMode,
    ),
    maxRowIndex,
    manualMode,
    stableSlotMode,
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

  const stableSlotMode = lanePlans.every((plan) => plan.stableSlotMode)
  if (stableSlotMode) {
    const stableRowHeight = Math.max(
      computeStableSlotRowHeight(metrics),
      ...rowHeights,
    )
    const stableRowHeights = rowHeights.map((height, row) =>
      row <= maxRowIndex ? Math.max(height, stableRowHeight) : 0,
    )
    const stableRowYOffsets = new Array<number>(rowCount).fill(0)
    let y = 0
    for (let row = 0; row < rowCount; row++) {
      stableRowYOffsets[row] = y
      if (row <= maxRowIndex) {
        y += stableRowHeights[row] ?? 0
        if (row < maxRowIndex) {
          y += metrics.nodeGapY
        }
      }
    }
    return { rowHeights: stableRowHeights, rowYOffsets: stableRowYOffsets, maxRowIndex }
  }

  const rowYOffsets = new Array<number>(rowCount).fill(0)
  for (let row = 0; row < rowCount; row++) {
    let maxOffset = 0
    for (const plan of lanePlans) {
      const localOffsets = computeRowYOffsets(
        plan.grid,
        plan.rowHeights,
        metrics,
        plan.manualMode,
        plan.maxRowIndex,
        plan.stableSlotMode,
      )
      maxOffset = Math.max(maxOffset, localOffsets[row] ?? 0)
    }
    rowYOffsets[row] = maxOffset
  }

  return { rowHeights, rowYOffsets, maxRowIndex }
}

export function computeUnifiedContentHeight(
  unified: ZoneUnifiedRowLayout,
  _metrics: OverviewGridMetrics,
): number {
  if (unified.maxRowIndex < 0) return 0

  const lastRow = unified.maxRowIndex
  return (unified.rowYOffsets[lastRow] ?? 0) + (unified.rowHeights[lastRow] ?? 0)
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
  const { sorted, assignments, layout } = prepareCellLayout(
    nodes,
    edges,
    maxColumnCount,
    options?.maxRows ?? OVERVIEW_CELL_MAX_ROWS,
  )
  const manualMode = cellHasManualSlots(nodes)
  const stableSlotMode = true
  const { columnCount, rowCount } = layout
  const grid = buildCellNodeGrid(sorted, assignments, layout)
  const maxRowIndex = manualMode
    ? getMaxRowFromAssignments(assignments.values())
    : getMaxOccupiedRowIndex(grid)
  const cellLayout = resolveCellColumnLayout(cellLeft, cellWidth, columnCount, metrics)
  const localRowHeights = computeRowHeights(
    grid,
    metrics,
    manualMode,
    maxRowIndex,
    cellLayout,
    stableSlotMode,
  )
  const rowHeights = unifiedRows?.rowHeights ?? localRowHeights
  const rowYOffsets = unifiedRows?.rowYOffsets ?? computeRowYOffsets(
    grid,
    localRowHeights,
    metrics,
    manualMode,
    maxRowIndex,
    stableSlotMode,
  )
  const yBase = options?.yBaseOverride ?? cellTop + metrics.cellPaddingY

  const placed: PlacedCellNode[] = []

  for (const node of sorted) {
    const assignment = assignments.get(node.id)
    if (!assignment) continue

    const row = Math.min(Math.max(assignment.row, 0), rowCount - 1)
    const col = Math.min(Math.max(assignment.col, 0), columnCount - 1)
    const rowHeight = rowHeights[row] ?? metrics.rowMinHeightNormal
    const layoutForNode =
      assignment.isManualSlot && options?.laneColumnLayout
        ? options.laneColumnLayout
        : cellLayout
    const layoutCol =
      assignment.isManualSlot && options?.laneColumnLayout ? assignment.col : col
    const size = getCellPlacementSize(node.type, metrics, layoutForNode, node.name)
    const columnCenterX =
      layoutForNode.columnCenters[layoutCol] ?? layoutForNode.columnCenters[0]
    const rowTop = yBase + (rowYOffsets[row] ?? 0)
    const rowCenterY = rowTop + rowHeight / 2
    const nodeY = unifiedRows || stableSlotMode
      ? rowCenterY - size.height / 2
      : manualMode
        ? rowTop + (row === maxRowIndex ? metrics.rowPaddingY : 0)
        : row === maxRowIndex
          ? rowTop + metrics.rowPaddingY
          : rowCenterY - size.height / 2

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
    return buildProcessFlowNode(source, process, node, true, 'overview')
  })
}

/**
 * Overview grid layout - node.processZone drives Y grid bands.
 * cellSlot/cellOrder control placement within each lane cell.
 */
export function getOverviewGridLayout(
  process: Process,
  metrics: OverviewGridMetrics = OVERVIEW_GRID_METRICS,
): OverviewGridLayoutResult {
  const afterSettlement = applySettlementGroupLayout(process)
  const laidOutNodes = applyReturnMovementGroupLayout({ ...process, nodes: afterSettlement })
  const validNodes = validateNodes({ ...process, nodes: laidOutNodes })
  /** edges follow JSON process sequence */
  const processWithEdges = { ...process, nodes: validNodes, edges: process.edges }

  const sortedLanes = [...process.lanes].sort((a, b) => a.order - b.order)
  /** Lane header sticky offset - zone bands start below contentTop */
  const contentTop = CANVAS_TOP_PADDING

  const cells = new Map<CellKey, Node[]>()
  for (const node of validNodes) {
    if (isConnectorNodeType(node.type)) continue
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
      const cellLeft = laneColumnLeft(processWithEdges, lane.order, metrics)
      const laneWidth = resolveLaneCellWidth(processWithEdges, lane.id, metrics.cellWidth)
      const cellLayout = resolveCellColumnLayout(
        cellLeft,
        laneWidth,
        OVERVIEW_MAX_CELL_COLUMNS,
        metrics,
      )
      const plan = buildLaneCellRowPlan(
        cellNodes,
        processWithEdges.edges,
        metrics,
        undefined,
        cellLayout,
      )
      if (!plan) continue

      entries.push({
        laneId: lane.id,
        cellLeft,
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
    const unifiedRows = computeZoneCellUnifiedRowLayout(
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

  const laneColumnLayouts = new Map<string, CellColumnLayout>()
  for (const lane of sortedLanes) {
    const cellLeft = laneColumnLeft(processWithEdges, lane.order, metrics)
    const laneWidth = resolveLaneCellWidth(processWithEdges, lane.id, metrics.cellWidth)
    laneColumnLayouts.set(
      lane.id,
      resolveCellColumnLayout(cellLeft, laneWidth, OVERVIEW_MAX_CELL_COLUMNS, metrics),
    )
  }

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
          laneColumnLayout: laneColumnLayouts.get(entry.laneId),
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
