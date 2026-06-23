import type { Edge as FlowEdge, Node as FlowNode } from '@xyflow/react'
import type { Node, Process } from '../../types/process'
import { buildProcessFlowNode } from '../buildProcessFlowNode'
import { buildProcessEdges } from './overviewEdgePipeline'
import type { ProcessNodeData, ProcessEdgeData } from './elkLayout'
import { getPathBounds } from './edgeRouter'
import {
  type CanvasBounds,
  type LaneBand,
  type PlacedNode,
  validateNodes,
} from './laneLayout'
import { CANVAS_BOTTOM_PADDING, CANVAS_TOP_PADDING } from './layoutConfig'
import {
  gridContentWidthFromProcess,
  laneColumnLeftFromProcess,
  resolveLaneCellWidth,
  resolvePhaseMinHeight,
} from './laneLayoutResolver'
import {
  DETAIL_GRID_METRICS,
  type OverviewGridMetrics,
} from './overviewGridMetrics'
import { swimlaneLaneAreaWidth, metricsToSwimlaneGrid } from './swimlaneGridLayout'

export type DetailGridLayoutResult = {
  nodes: FlowNode<ProcessNodeData>[]
  edges: FlowEdge[]
  laneBands: LaneBand[]
  canvasBounds: CanvasBounds
  layoutOrientation: 'vertical'
  metrics: OverviewGridMetrics
}

const DETAIL_MAX_CELL_COLUMNS = 2

import { placeNodesInLaneCell, buildLaneCellRowPlan, computeZoneCellUnifiedRowLayout, computeUnifiedContentHeight } from './overviewGridLayout'
import { DETAIL_DOCUMENT } from './detailLayoutMetrics'
import { DECISION_NODE_LAYOUT } from './decisionNodeLayout'
import {
  getDetailOverviewLanes,
  getUsedLaneIds,
  isDetailSingleLaneProcess,
  resolveDetailLayoutLanes,
} from './detailVerticalLayout'
import { getCellPlacementSize, resolveCellColumnLayout } from './cellColumnLayout'
import { resolveNodeLocalOrder } from './localOrder'
import { DETAIL_CELL_MAX_ROWS, cellSlotToRowCol } from './overviewCellPlacement'

function resolveSingleLaneManualSlotY(
  node: Node,
  yBase: number,
  rowHeight: number,
  rowGap: number,
): number | undefined {
  if (node.cellSlot == null) return undefined
  const { row } = cellSlotToRowCol(node.cellSlot, DETAIL_CELL_MAX_ROWS)
  return yBase + row * (rowHeight + rowGap)
}

function sortDetailNodes(nodes: Node[], process: Process): Node[] {
  return [...nodes].sort(
    (a, b) =>
      (a.phaseOrder ?? 0) - (b.phaseOrder ?? 0) ||
      resolveNodeLocalOrder(a, process) - resolveNodeLocalOrder(b, process) ||
      a.id.localeCompare(b.id),
  )
}

/** PDF 단일 스윔레인 — phaseOrder 세로 흐름, 동일 phase는 가로 배치 */
function placeDetailSingleLaneSequential(
  nodes: Node[],
  process: Process,
  laneLeft: number,
  laneWidth: number,
  yBase: number,
  metrics: OverviewGridMetrics,
): PlacedNode[] {
  const sorted = sortDetailNodes(nodes, process)
  const contentWidth = laneWidth - metrics.cellPaddingX * 2
  const hasManualCellSlots = nodes.some((node) => node.cellSlot != null)
  const cellLayout = resolveCellColumnLayout(
    laneLeft + metrics.cellPaddingX,
    contentWidth,
    hasManualCellSlots ? DETAIL_MAX_CELL_COLUMNS : 1,
    metrics,
  )
  const centerX = cellLayout.columnCenters[0] ?? laneLeft + laneWidth / 2

  const phaseGroups: Node[][] = []
  for (const node of sorted) {
    const phase = node.phaseOrder ?? 0
    const last = phaseGroups[phaseGroups.length - 1]
    if (!last || (last[0]?.phaseOrder ?? 0) !== phase) {
      phaseGroups.push([node])
    } else {
      last.push(node)
    }
  }

  let y = yBase
  const placed: PlacedNode[] = []
  let manualMaxBottom = yBase

  for (const group of phaseGroups) {
    const rowLayout =
      group.length > 1
        ? resolveCellColumnLayout(
            laneLeft + metrics.cellPaddingX,
            contentWidth,
            Math.min(group.length, DETAIL_MAX_CELL_COLUMNS),
            metrics,
          )
        : cellLayout

    let rowHeight = 0
    let rowHasDecision = false
    group.forEach((node, index) => {
      const size = getCellPlacementSize(node.type, metrics, rowLayout, node.name)
      if (node.type === 'decision') rowHasDecision = true
      const slotCol =
        node.cellSlot != null && hasManualCellSlots
          ? cellSlotToRowCol(node.cellSlot, DETAIL_CELL_MAX_ROWS).col
          : undefined
      const col = slotCol ?? (group.length > 1 ? index : undefined)
      const nodeCenterX = col != null ? (rowLayout.columnCenters[col] ?? centerX) : laneLeft + laneWidth / 2
      const slotY = hasManualCellSlots
        ? resolveSingleLaneManualSlotY(
            node,
            yBase,
            Math.max(metrics.rowMinHeightDecision, metrics.nodeHeight),
            metrics.nodeGapY,
          )
        : undefined
      if (slotY != null) {
        manualMaxBottom = Math.max(manualMaxBottom, slotY + size.height)
      }
      placed.push({
        id: node.id,
        laneId: node.laneId,
        x: nodeCenterX - size.width / 2,
        y: slotY ?? y,
        width: size.width,
        height: size.height,
      })
      rowHeight = Math.max(rowHeight, size.height)
    })
    const decisionExtraGap = rowHasDecision
      ? Math.max(0, DECISION_NODE_LAYOUT.belowMinGap - DETAIL_DOCUMENT.nodeVerticalGap)
      : 0
    y += rowHeight + DETAIL_DOCUMENT.nodeVerticalGap + decisionExtraGap
    if (hasManualCellSlots) {
      y = Math.max(y, manualMaxBottom + DETAIL_DOCUMENT.nodeVerticalGap)
    }
  }

  return placed
}

function isSingleLaneDetail(nodes: Node[]): boolean {
  return isDetailSingleLaneProcess(nodes)
}

function getDetailLayoutProcess(process: Process, nodes: Node[]): Process {
  return { ...process, lanes: resolveDetailLayoutLanes(process, nodes) }
}

function laneColumnLeft(process: Process, laneOrder: number, metrics: OverviewGridMetrics): number {
  return laneColumnLeftFromProcess(process, laneOrder, metrics.zoneLabelColumnWidth, metrics.cellWidth)
}

function computeContentHeight(
  process: Process,
  lanes: ReturnType<typeof getDetailOverviewLanes>,
  nodes: Node[],
  metrics: OverviewGridMetrics,
  edges: Process['edges'],
): number {
  if (isSingleLaneDetail(nodes) && lanes.length === 1) {
    const lane = lanes[0]!
    const laneNodes = nodes.filter((n) => n.laneId === lane.id)
    const laneWidth = resolveLaneCellWidth(process, lane.id, metrics.cellWidth)
    const placed = placeDetailSingleLaneSequential(
      laneNodes,
      process,
      laneColumnLeft(process, lane.order, metrics),
      laneWidth,
      metrics.cellPaddingY,
      metrics,
    )
    const maxBottom = placed.reduce((max, node) => Math.max(max, node.y + node.height), 0)
    return Math.max(metrics.cellMinHeight, maxBottom + metrics.cellPaddingY * 2)
  }

  const lanePlans = lanes
    .map((lane) => buildLaneCellRowPlan(
      nodes.filter((n) => n.laneId === lane.id),
      edges,
      metrics,
      DETAIL_MAX_CELL_COLUMNS,
      undefined,
      DETAIL_CELL_MAX_ROWS,
    ))
    .filter((plan): plan is NonNullable<typeof plan> => plan != null)

  const unifiedRows = computeZoneCellUnifiedRowLayout(lanePlans, metrics)
  const unifiedHeight = computeUnifiedContentHeight(unifiedRows, metrics)

  return Math.max(
    metrics.cellMinHeight,
    resolvePhaseMinHeight(process, nodes),
    unifiedHeight + metrics.cellPaddingY * 2,
  )
}

function placeNodesInLanes(
  process: Process,
  nodes: Node[],
  lanes: ReturnType<typeof getDetailOverviewLanes>,
  contentTop: number,
  contentHeight: number,
  metrics: OverviewGridMetrics,
  edges: Process['edges'],
): PlacedNode[] {
  if (isSingleLaneDetail(nodes) && lanes.length === 1) {
    const lane = lanes[0]!
    const laneNodes = nodes.filter((n) => n.laneId === lane.id)
    const laneLeft = laneColumnLeft(process, lane.order, metrics)
    const laneWidth = resolveLaneCellWidth(process, lane.id, metrics.cellWidth)
    const yBase = contentTop + metrics.cellPaddingY
    return placeDetailSingleLaneSequential(laneNodes, process, laneLeft, laneWidth, yBase, metrics)
  }

  const laneEntries = lanes
    .map((lane) => {
      const laneNodes = nodes.filter((n) => n.laneId === lane.id)
      const plan = buildLaneCellRowPlan(
        laneNodes,
        edges,
        metrics,
        DETAIL_MAX_CELL_COLUMNS,
        undefined,
        DETAIL_CELL_MAX_ROWS,
      )
      if (!plan) return null
      return {
        laneId: lane.id,
        laneLeft: laneColumnLeft(process, lane.order, metrics),
        laneNodes,
        plan,
      }
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry != null)

  const unifiedRows = computeZoneCellUnifiedRowLayout(
    laneEntries.map((entry) => entry.plan),
    metrics,
  )
  const yBase = contentTop + metrics.cellPaddingY
  const placed: PlacedNode[] = []

  for (const entry of laneEntries) {
    const laneWidth = resolveLaneCellWidth(process, entry.laneId, metrics.cellWidth)
    placed.push(
      ...placeNodesInLaneCell(
        entry.laneNodes,
        entry.laneLeft,
        contentTop,
        laneWidth,
        contentHeight,
        metrics,
        {
          maxColumnCount: DETAIL_MAX_CELL_COLUMNS,
          edges,
          unifiedRows,
          yBaseOverride: yBase,
          maxRows: DETAIL_CELL_MAX_ROWS,
        },
      ),
    )
  }

  return placed
}

function buildLaneBands(
  process: Process,
  lanes: ReturnType<typeof getDetailOverviewLanes>,
  usedLaneIds: Set<string>,
  contentTop: number,
  contentHeight: number,
  metrics: OverviewGridMetrics,
): LaneBand[] {
  return lanes.map((lane) => {
    const x = laneColumnLeft(process, lane.order, metrics)
    const laneWidth = resolveLaneCellWidth(process, lane.id, metrics.cellWidth)
    const height = contentHeight + metrics.cellPaddingY
    const inactive = !usedLaneIds.has(lane.id)

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
      inactive,
    }
  })
}

export function rebuildDetailLayoutEdges(process: Process, placed: PlacedNode[]): FlowEdge[] {
  const lanes = getDetailOverviewLanes(process)
  return buildDetailEdges(process, placed, lanes, DETAIL_GRID_METRICS)
}

function buildDetailEdges(
  process: Process,
  placed: PlacedNode[],
  _lanes: ReturnType<typeof getDetailOverviewLanes>,
  metrics: OverviewGridMetrics,
): FlowEdge[] {
  const minContentX = metrics.zoneLabelColumnWidth
  return buildProcessEdges(process, placed, minContentX, { overviewMode: true }).flowEdges
}

function expandContentHeight(
  contentTop: number,
  baseHeight: number,
  placed: PlacedNode[],
  edges: FlowEdge[],
  metrics: OverviewGridMetrics,
): number {
  let maxBottom = contentTop + baseHeight

  for (const node of placed) {
    maxBottom = Math.max(maxBottom, node.y + node.height)
  }

  for (const edge of edges) {
    const path = (edge.data as ProcessEdgeData)?.elkPath
    if (path) {
      maxBottom = Math.max(maxBottom, getPathBounds(path).maxY)
    }
  }

  return Math.max(
    baseHeight,
    maxBottom - contentTop + metrics.cellPaddingY + DETAIL_DOCUMENT.laneBottomPadding,
  )
}

function toFlowNodes(process: Process, placed: PlacedNode[], compact = false): FlowNode<ProcessNodeData>[] {
  return placed.map((node) => {
    const source = process.nodes.find((n) => n.id === node.id)!
    return buildProcessFlowNode(source, process, node, compact, 'detail')
  })
}

export function getDetailGridLayout(
  process: Process,
  metrics: OverviewGridMetrics = DETAIL_GRID_METRICS,
  compact = true,
): DetailGridLayoutResult {
  const layoutProcess = getDetailLayoutProcess(process, process.nodes)
  const validNodes = validateNodes({ ...layoutProcess, nodes: process.nodes })
  const processWithEdges = { ...layoutProcess, nodes: validNodes, edges: process.edges }
  const lanes = layoutProcess.lanes
  const usedLaneIds = getUsedLaneIds(validNodes)

  const contentTop = CANVAS_TOP_PADDING

  let contentHeight = computeContentHeight(layoutProcess, lanes, validNodes, metrics, process.edges)
  let placed = placeNodesInLanes(layoutProcess, validNodes, lanes, contentTop, contentHeight, metrics, process.edges)
  let edges = buildDetailEdges(processWithEdges, placed, lanes, metrics)

  contentHeight = expandContentHeight(contentTop, contentHeight, placed, edges, metrics)
  placed = placeNodesInLanes(layoutProcess, validNodes, lanes, contentTop, contentHeight, metrics, process.edges)
  edges = buildDetailEdges(processWithEdges, placed, lanes, metrics)
  contentHeight = expandContentHeight(contentTop, contentHeight, placed, edges, metrics)

  const laneBands = buildLaneBands(layoutProcess, lanes, usedLaneIds, contentTop, contentHeight, metrics)

  const laneAreaWidth = swimlaneLaneAreaWidth(metricsToSwimlaneGrid(metrics))
  const canvasWidth = Math.max(
    laneAreaWidth,
    gridContentWidthFromProcess(layoutProcess, metrics.zoneLabelColumnWidth, metrics.cellWidth),
  )

  const edgeMaxX = Math.max(
    canvasWidth,
    ...edges.map((e) => {
      const path = (e.data as ProcessEdgeData)?.elkPath
      return path ? getPathBounds(path).maxX : 0
    }),
  )

  const edgeMaxY = Math.max(
    contentTop + contentHeight,
    ...edges.map((e) => {
      const path = (e.data as ProcessEdgeData)?.elkPath
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
    nodes: toFlowNodes(processWithEdges, placed, compact),
    edges,
    laneBands,
    canvasBounds,
    layoutOrientation: 'vertical',
    metrics,
  }
}
