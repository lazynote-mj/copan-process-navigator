import type { Edge as FlowEdge, Node as FlowNode } from '@xyflow/react'
import type { Node, Process } from '../../types/process'
import { buildProcessFlowNode } from '../buildProcessFlowNode'
import type { ProcessEdgeData, ProcessNodeData } from './elkLayout'
import { getPathBounds } from './edgeRouter'
import {
  type CanvasBounds,
  type LaneBand,
  type PlacedNode,
  validateNodes,
} from './laneLayout'
import { CANVAS_BOTTOM_PADDING, CANVAS_TOP_PADDING, LANE_HEADER_WIDTH } from './layoutConfig'
import { buildProcessEdges } from './overviewEdgePipeline'
import { DETAIL_GRID_METRICS, getGridNodeSize, type OverviewGridMetrics } from './overviewGridMetrics'
import { resolveNodeLocalOrder } from './localOrder'
import {
  getDetailOverviewLanes,
  getUsedLaneIds,
  resolveDetailLayoutLanes,
} from './detailVerticalLayout'

export type DetailHorizontalLayoutResult = {
  nodes: FlowNode<ProcessNodeData>[]
  edges: FlowEdge[]
  laneBands: LaneBand[]
  canvasBounds: CanvasBounds
  layoutOrientation: 'horizontal'
  metrics: OverviewGridMetrics
}

const LANE_LABEL_WIDTH = LANE_HEADER_WIDTH
const CONTENT_LEFT = LANE_LABEL_WIDTH + 56
const CONTENT_RIGHT_PADDING = 80
const LANE_TOP_PADDING = 20
const LANE_BOTTOM_PADDING = 20
export const DETAIL_HORIZONTAL_ROW_PITCH = 68
const DEFAULT_TRACK_COUNT = 3
export const DETAIL_HORIZONTAL_MAX_TRACK_COUNT = 5
export const DETAIL_HORIZONTAL_ORDER_COLUMN_WIDTH = 220
const ORDER_COLUMN_MIN_GAP = 180
const DETAIL_HORIZONTAL_MIN_CANVAS_WIDTH = 1800

function clampDetailLayoutColumn(value: number | undefined): number | undefined {
  if (value == null || !Number.isFinite(value)) return undefined
  return Math.max(1, Math.floor(value))
}

function clampDetailLayoutRow(value: number | undefined): number | undefined {
  if (value == null || !Number.isFinite(value)) return undefined
  return Math.min(DETAIL_HORIZONTAL_MAX_TRACK_COUNT, Math.max(1, Math.floor(value)))
}

function sortNodes(nodes: Node[], process: Process): Node[] {
  return [...nodes].sort(
    (a, b) =>
      resolveNodeOrder(a, process) - resolveNodeOrder(b, process) ||
      resolveNodeLocalOrder(a, process) - resolveNodeLocalOrder(b, process) ||
      a.id.localeCompare(b.id),
  )
}

function resolveNodeOrder(node: Node, process: Process): number {
  return (
    node.stepBadge ??
    node.phaseOrder ??
    node.cellOrder ??
    node.zoneOrder ??
    resolveNodeLocalOrder(node, process) ??
    0
  )
}

function buildOrderIndex(nodes: Node[], process: Process): Map<number, number> {
  const orders = [...new Set(nodes.map((node) => resolveNodeOrder(node, process)))].sort((a, b) => a - b)
  return new Map(orders.map((order, index) => [order, index]))
}

function buildLaneOrderIndexes(
  nodesByLane: Map<string, Node[]>,
  process: Process,
): Map<string, Map<number, number>> {
  return new Map(
    [...nodesByLane.entries()].map(([laneId, laneNodes]) => [
      laneId,
      buildOrderIndex(laneNodes, process),
    ]),
  )
}

function maxLaneColumnCount(
  nodesByLane: Map<string, Node[]>,
  laneOrderIndexes: Map<string, Map<number, number>>,
): number {
  let max = 1
  for (const [laneId, laneNodes] of nodesByLane.entries()) {
    const autoColumnCount = laneOrderIndexes.get(laneId)?.size ?? 1
    const manualColumnCount = Math.max(
      0,
      ...laneNodes.map((node) => clampDetailLayoutColumn(node.detailLayout?.column) ?? 0),
    )
    max = Math.max(max, autoColumnCount, manualColumnCount)
  }
  return max
}

function preferredTrackForNode(node: Node): number {
  if (node.type === 'exception') return 2
  if (
    node.type === 'database' ||
    node.type === 'system' ||
    node.type === 'api' ||
    node.type === 'interface' ||
    node.type === 'interface-rule' ||
    node.type === 'document' ||
    node.type === 'connector' ||
    node.type === 'merge'
  ) {
    return 1
  }
  return 0
}

function resolveLaneTrackAssignments(
  nodes: Node[],
  process: Process,
  laneOrderIndex?: Map<number, number>,
): Map<string, number> {
  const occupied = new Set<string>()
  const assigned = new Map<string, number>()
  for (const node of sortNodes(nodes, process)) {
    const order = resolveNodeOrder(node, process)
    const orderCol = (clampDetailLayoutColumn(node.detailLayout?.column) ?? 0) > 0
      ? clampDetailLayoutColumn(node.detailLayout?.column)! - 1
      : laneOrderIndex?.get(order) ?? order
    const preferred = (clampDetailLayoutRow(node.detailLayout?.row) ?? preferredTrackForNode(node) + 1) - 1
    let track = preferred
    while (track < DETAIL_HORIZONTAL_MAX_TRACK_COUNT && occupied.has(`${orderCol}:${track}`)) {
      track += 1
    }
    if (track >= DETAIL_HORIZONTAL_MAX_TRACK_COUNT) {
      track = DETAIL_HORIZONTAL_MAX_TRACK_COUNT - 1
    }
    occupied.add(`${orderCol}:${track}`)
    assigned.set(node.id, track)
  }
  return assigned
}

function laneTrackCount(nodes: Node[], process: Process): number {
  if (nodes.length === 0) return DEFAULT_TRACK_COUNT
  const assignments = resolveLaneTrackAssignments(nodes, process)
  const maxTrack = Math.max(0, ...assignments.values())
  return Math.max(DEFAULT_TRACK_COUNT, Math.min(DETAIL_HORIZONTAL_MAX_TRACK_COUNT, maxTrack + 1))
}

function laneHeightForNodes(nodes: Node[], process: Process, metrics: OverviewGridMetrics): number {
  if (nodes.length === 0) return 124
  const rowCount = laneTrackCount(nodes, process)
  const maxNodeHeight = Math.max(
    metrics.nodeHeight,
    ...nodes.map((node) => getGridNodeSize(node.type, metrics, node.name).height),
  )
  return Math.max(
    124,
    LANE_TOP_PADDING + LANE_BOTTOM_PADDING + rowCount * Math.max(DETAIL_HORIZONTAL_ROW_PITCH, maxNodeHeight + 20),
  )
}

function buildLaneBands(
  lanes: ReturnType<typeof getDetailOverviewLanes>,
  laneNodesById: Map<string, Node[]>,
  usedLaneIds: Set<string>,
  canvasWidth: number,
  process: Process,
  metrics: OverviewGridMetrics,
): LaneBand[] {
  let y = CANVAS_TOP_PADDING
  return lanes.map((lane) => {
    const nodes = laneNodesById.get(lane.id) ?? []
    const height = laneHeightForNodes(nodes, process, metrics)
    const band: LaneBand = {
      laneId: lane.id,
      laneName: lane.name,
      ownerDepartment: lane.ownerDepartment,
      x: 0,
      y,
      width: canvasWidth,
      height,
      contentLeft: CONTENT_LEFT,
      contentTop: y + LANE_TOP_PADDING,
      contentBottom: y + height - LANE_BOTTOM_PADDING,
      contentRight: canvasWidth - CONTENT_RIGHT_PADDING,
      inactive: !usedLaneIds.has(lane.id),
    }
    y += height
    return band
  })
}

function placeNodes(
  nodes: Node[],
  process: Process,
  laneBands: LaneBand[],
  laneOrderIndexes: Map<string, Map<number, number>>,
  metrics: OverviewGridMetrics,
): PlacedNode[] {
  const bandByLane = new Map(laneBands.map((band) => [band.laneId, band]))
  const nodesByLane = new Map<string, Node[]>()
  for (const node of nodes) {
    const laneNodes = nodesByLane.get(node.laneId) ?? []
    laneNodes.push(node)
    nodesByLane.set(node.laneId, laneNodes)
  }
  const tracksByLane = new Map(
    [...nodesByLane.entries()].map(([laneId, laneNodes]) => [
      laneId,
      resolveLaneTrackAssignments(laneNodes, process, laneOrderIndexes.get(laneId)),
    ]),
  )

  return sortNodes(nodes, process).flatMap((node) => {
    const band = bandByLane.get(node.laneId)
    if (!band) return []
    const size = getGridNodeSize(node.type, metrics, node.name)
    const order = resolveNodeOrder(node, process)
    const manualColumn = clampDetailLayoutColumn(node.detailLayout?.column)
    const orderCol = manualColumn != null
      ? manualColumn - 1
      : laneOrderIndexes.get(node.laneId)?.get(order) ?? 0
    const track = tracksByLane.get(node.laneId)?.get(node.id) ?? preferredTrackForNode(node)
    const rowY = band.contentTop + track * DETAIL_HORIZONTAL_ROW_PITCH + DETAIL_HORIZONTAL_ROW_PITCH / 2 - size.height / 2
    return [{
      id: node.id,
      laneId: node.laneId,
      x: CONTENT_LEFT + orderCol * DETAIL_HORIZONTAL_ORDER_COLUMN_WIDTH + (node.offsetX ?? 0),
      y: rowY + (node.offsetY ?? 0),
      width: size.width,
      height: size.height,
    }]
  })
}

function buildEdges(process: Process, placed: PlacedNode[]): FlowEdge[] {
  return buildProcessEdges(process, placed, CONTENT_LEFT, { overviewMode: false }).flowEdges
}

function expandCanvasWidth(baseWidth: number, placed: PlacedNode[], edges: FlowEdge[]): number {
  let maxRight = baseWidth
  for (const node of placed) {
    maxRight = Math.max(maxRight, node.x + node.width)
  }
  for (const edge of edges) {
    const path = (edge.data as ProcessEdgeData)?.elkPath
    if (path) maxRight = Math.max(maxRight, getPathBounds(path).maxX)
  }
  return maxRight + CONTENT_RIGHT_PADDING
}

function expandCanvasHeight(laneBands: LaneBand[], edges: FlowEdge[]): number {
  const laneBottom = laneBands.length
    ? laneBands[laneBands.length - 1]!.y + laneBands[laneBands.length - 1]!.height
    : CANVAS_TOP_PADDING
  let maxBottom = laneBottom
  for (const edge of edges) {
    const path = (edge.data as ProcessEdgeData)?.elkPath
    if (path) maxBottom = Math.max(maxBottom, getPathBounds(path).maxY)
  }
  return maxBottom + CANVAS_BOTTOM_PADDING
}

function toFlowNodes(process: Process, placed: PlacedNode[]): FlowNode<ProcessNodeData>[] {
  return placed.map((node) => {
    const source = process.nodes.find((n) => n.id === node.id)!
    return buildProcessFlowNode(source, process, node, true, 'detail')
  })
}

export function getDetailHorizontalLayout(
  process: Process,
  metrics: OverviewGridMetrics = DETAIL_GRID_METRICS,
): DetailHorizontalLayoutResult {
  const layoutProcess = { ...process, lanes: resolveDetailLayoutLanes(process, process.nodes) }
  const validNodes = validateNodes({ ...layoutProcess, nodes: process.nodes })
  const processWithEdges = { ...layoutProcess, nodes: validNodes, edges: process.edges }
  const lanes = getDetailOverviewLanes(layoutProcess)
  const usedLaneIds = getUsedLaneIds(validNodes)
  const laneNodesById = new Map(lanes.map((lane) => [lane.id, validNodes.filter((node) => node.laneId === lane.id)]))
  const laneOrderIndexes = buildLaneOrderIndexes(laneNodesById, layoutProcess)
  const orderColumnCount = maxLaneColumnCount(laneNodesById, laneOrderIndexes)
  const baseCanvasWidth = Math.max(
    DETAIL_HORIZONTAL_MIN_CANVAS_WIDTH,
    CONTENT_LEFT + Math.max(0, orderColumnCount - 1) * DETAIL_HORIZONTAL_ORDER_COLUMN_WIDTH + ORDER_COLUMN_MIN_GAP + CONTENT_RIGHT_PADDING,
  )

  let laneBands = buildLaneBands(lanes, laneNodesById, usedLaneIds, baseCanvasWidth, layoutProcess, metrics)
  let placed = placeNodes(validNodes, layoutProcess, laneBands, laneOrderIndexes, metrics)
  let edges = buildEdges(processWithEdges, placed)
  const canvasWidth = expandCanvasWidth(baseCanvasWidth, placed, edges)
  laneBands = buildLaneBands(lanes, laneNodesById, usedLaneIds, canvasWidth, layoutProcess, metrics)
  placed = placeNodes(validNodes, layoutProcess, laneBands, laneOrderIndexes, metrics)
  edges = buildEdges(processWithEdges, placed)

  const canvasBounds: CanvasBounds = {
    width: canvasWidth,
    height: expandCanvasHeight(laneBands, edges),
    topPadding: CANVAS_TOP_PADDING,
    bottomPadding: CANVAS_BOTTOM_PADDING,
  }

  return {
    nodes: toFlowNodes(processWithEdges, placed),
    edges,
    laneBands,
    canvasBounds,
    layoutOrientation: 'horizontal',
    metrics,
  }
}

export function rebuildDetailHorizontalLayoutEdges(process: Process, placed: PlacedNode[]): FlowEdge[] {
  const layoutProcess = { ...process, lanes: resolveDetailLayoutLanes(process, process.nodes) }
  return buildEdges({ ...layoutProcess, edges: process.edges }, placed)
}
