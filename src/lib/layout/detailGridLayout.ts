import type { Edge as FlowEdge, Node as FlowNode } from '@xyflow/react'
import type { Node, Process } from '../../types/process'
import { buildProcessFlowNode } from '../buildProcessFlowNode'
import { buildAllOrthogonalFlowEdges } from './buildOrthogonalFlowEdge'
import { computeEdgeBranchContexts } from './edgeBranchRouting'
import { sortEdgesByPriority } from './laneLayoutResolver'
import type { ProcessNodeData, ProcessEdgeData } from './elkLayout'
import { assertPathRespectsContentLeft, getPathBounds } from './edgeRouter'
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

export type DetailGridLayoutResult = {
  nodes: FlowNode<ProcessNodeData>[]
  edges: FlowEdge[]
  laneBands: LaneBand[]
  canvasBounds: CanvasBounds
  layoutOrientation: 'vertical'
  metrics: OverviewGridMetrics
}

const DETAIL_MAX_CELL_COLUMNS = 2

import { placeNodesInLaneCell, buildLaneCellRowPlan, computeZoneUnifiedRowLayout, computeUnifiedContentHeight } from './overviewGridLayout'
import { DETAIL_DOCUMENT } from './detailLayoutMetrics'
import { getDetailOverviewLanes, getUsedLaneIds } from './detailVerticalLayout'

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
  const lanePlans = lanes
    .map((lane) => buildLaneCellRowPlan(
      nodes.filter((n) => n.laneId === lane.id),
      edges,
      metrics,
      DETAIL_MAX_CELL_COLUMNS,
    ))
    .filter((plan): plan is NonNullable<typeof plan> => plan != null)

  const unifiedRows = computeZoneUnifiedRowLayout(lanePlans, metrics)
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
  const laneEntries = lanes
    .map((lane) => {
      const laneNodes = nodes.filter((n) => n.laneId === lane.id)
      const plan = buildLaneCellRowPlan(laneNodes, edges, metrics, DETAIL_MAX_CELL_COLUMNS)
      if (!plan) return null
      return {
        laneId: lane.id,
        laneLeft: laneColumnLeft(process, lane.order, metrics),
        laneNodes,
        plan,
      }
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry != null)

  const unifiedRows = computeZoneUnifiedRowLayout(
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
  lanes: ReturnType<typeof getDetailOverviewLanes>,
  metrics: OverviewGridMetrics,
): FlowEdge[] {
  const laneOrder = new Map(lanes.map((lane, index) => [lane.id, index]))
  const minContentX = metrics.zoneLabelColumnWidth
  const branchContexts = computeEdgeBranchContexts(
    sortEdgesByPriority(process.edges),
    placed,
    process,
    laneOrder,
  )

  return buildAllOrthogonalFlowEdges(process.edges, placed, minContentX, branchContexts, {
    detailDocumentMode: true,
    detailLaneOrder: laneOrder,
    process,
  }).map((item) => {
    const edge = process.edges.find((e) => e.id === item.flowEdge.id)!
    let labelPoint = item.route.labelPoint

    if (edge.label && item.path) {
      const parallelIndex = (item.flowEdge.data as ProcessEdgeData).parallelIndex ?? 0
      labelPoint = {
        x: labelPoint.x,
        y: labelPoint.y + parallelIndex * 6,
      }
      item.flowEdge.data = {
        ...(item.flowEdge.data as ProcessEdgeData),
        labelPoint,
      }
      assertPathRespectsContentLeft(item.path, minContentX)
    }

    return item.flowEdge
  })
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
    return buildProcessFlowNode(source, process, node, compact)
  })
}

export function getDetailGridLayout(
  process: Process,
  metrics: OverviewGridMetrics = DETAIL_GRID_METRICS,
  compact = false,
): DetailGridLayoutResult {
  const validNodes = validateNodes(process)
  const processWithEdges = { ...process, nodes: validNodes, edges: process.edges }
  const lanes = getDetailOverviewLanes(process)
  const usedLaneIds = getUsedLaneIds(validNodes)

  const contentTop = CANVAS_TOP_PADDING

  let contentHeight = computeContentHeight(processWithEdges, lanes, validNodes, metrics, process.edges)
  let placed = placeNodesInLanes(processWithEdges, validNodes, lanes, contentTop, contentHeight, metrics, process.edges)
  let edges = buildDetailEdges(processWithEdges, placed, lanes, metrics)

  contentHeight = expandContentHeight(contentTop, contentHeight, placed, edges, metrics)
  placed = placeNodesInLanes(processWithEdges, validNodes, lanes, contentTop, contentHeight, metrics, process.edges)
  edges = buildDetailEdges(processWithEdges, placed, lanes, metrics)
  contentHeight = expandContentHeight(contentTop, contentHeight, placed, edges, metrics)

  const laneBands = buildLaneBands(processWithEdges, lanes, usedLaneIds, contentTop, contentHeight, metrics)

  const canvasWidth = gridContentWidthFromProcess(processWithEdges, metrics.zoneLabelColumnWidth, metrics.cellWidth)

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
