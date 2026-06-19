import type { Lane, Node, Process } from '../../types/process'
import {
  CANVAS_BOTTOM_PADDING,
  CANVAS_RIGHT_MARGIN,
  CANVAS_TOP_PADDING,
  contentLeftX,
  EDGE_ROUTING_MARGIN_Y,
  LANE_CONTENT_PADDING_X,
  LANE_CONTENT_PADDING_Y,
  LANE_GAP,
  LANE_MIN_HEIGHT,
  toRenderX,
  toRenderY,
} from './layoutConfig'

export { LANE_MIN_HEIGHT }

export type CanvasBounds = {
  width: number
  height: number
  topPadding: number
  bottomPadding: number
}

export type LaneBand = {
  laneId: string
  laneName: string
  ownerDepartment: string
  x: number
  y: number
  width: number
  height: number
  contentLeft: number
  contentTop: number
  contentBottom: number
  contentRight: number
  /** Detail — 프로세스에서 미사용 lane */
  inactive?: boolean
}

export type PlacedNode = {
  id: string
  laneId: string
  x: number
  y: number
  width: number
  height: number
}

export type LaneElkResult = {
  laneId: string
  contentWidth: number
  contentHeight: number
  nodes: Array<{ id: string; x: number; y: number; width: number; height: number }>
}

const laneIdSet = (process: Process) => new Set(process.lanes.map((l) => l.id))

export function validateNodes(process: Process): Node[] {
  const validLaneIds = laneIdSet(process)

  return process.nodes.filter((node) => {
    if (!node.laneId || !validLaneIds.has(node.laneId)) {
      console.warn(
        `[ProcessNavigator] 노드 "${node.id}" (${node.name})의 laneId "${node.laneId}"가 유효하지 않아 렌더링에서 제외됩니다.`,
      )
      return false
    }
    return true
  })
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function sortLanes(lanes: Lane[]): Lane[] {
  return [...lanes].sort((a, b) => a.order - b.order)
}

export function computeNodeBasedLaneHeight(result: LaneElkResult | undefined): number {
  if (!result || result.nodes.length === 0) {
    return LANE_MIN_HEIGHT
  }

  const maxElkBottom = Math.max(...result.nodes.map((n) => n.y + n.height))
  return Math.max(
    LANE_MIN_HEIGHT,
    LANE_CONTENT_PADDING_Y + maxElkBottom + LANE_CONTENT_PADDING_Y + EDGE_ROUTING_MARGIN_Y,
  )
}

export function expandLaneHeightForEdgeY(
  currentHeight: number,
  laneTop: number,
  maxEdgeYInLane: number,
): number {
  const required = maxEdgeYInLane - laneTop + LANE_CONTENT_PADDING_Y + EDGE_ROUTING_MARGIN_Y
  return Math.max(currentHeight, LANE_MIN_HEIGHT, required)
}

export function computeLaneTops(
  lanes: Lane[],
  laneHeights: Map<string, number>,
): Map<string, number> {
  const tops = new Map<string, number>()
  let currentTop = CANVAS_TOP_PADDING

  for (const lane of sortLanes(lanes)) {
    tops.set(lane.id, currentTop)
    currentTop += (laneHeights.get(lane.id) ?? LANE_MIN_HEIGHT) + LANE_GAP
  }

  return tops
}

export function placeNodesFromElk(
  lanes: Lane[],
  laneResults: Map<string, LaneElkResult>,
  laneTops: Map<string, number>,
): PlacedNode[] {
  const placed: PlacedNode[] = []

  for (const lane of sortLanes(lanes)) {
    const result = laneResults.get(lane.id)
    const laneTop = laneTops.get(lane.id) ?? CANVAS_TOP_PADDING

    if (!result) continue

    for (const node of result.nodes) {
      placed.push({
        id: node.id,
        laneId: lane.id,
        x: toRenderX(node.x),
        y: toRenderY(laneTop, node.y),
        width: node.width,
        height: node.height,
      })
    }
  }

  return placed
}

export function computeCanvasWidth(
  placedNodes: PlacedNode[],
  edgeMaxX: number,
): number {
  const minWidth = contentLeftX() + 320
  const maxNodeRight =
    placedNodes.length > 0
      ? Math.max(...placedNodes.map((n) => n.x + n.width))
      : minWidth

  return Math.max(maxNodeRight, edgeMaxX, minWidth) + CANVAS_RIGHT_MARGIN
}

export function buildLaneBands(
  lanes: Lane[],
  laneTops: Map<string, number>,
  laneHeights: Map<string, number>,
  canvasWidth: number,
): LaneBand[] {
  return sortLanes(lanes).map((lane) => {
    const y = laneTops.get(lane.id) ?? CANVAS_TOP_PADDING
    const height = laneHeights.get(lane.id) ?? LANE_MIN_HEIGHT

    return {
      laneId: lane.id,
      laneName: lane.name,
      ownerDepartment: lane.ownerDepartment,
      x: 0,
      y,
      width: canvasWidth,
      height,
      contentLeft: contentLeftX(),
      contentTop: y + 8,
      contentBottom: y + height - 8,
      contentRight: canvasWidth - LANE_CONTENT_PADDING_X,
    }
  })
}

export function computeCanvasHeight(laneBands: LaneBand[]): number {
  if (laneBands.length === 0) {
    return CANVAS_TOP_PADDING + CANVAS_BOTTOM_PADDING + LANE_MIN_HEIGHT
  }

  const last = laneBands[laneBands.length - 1]
  return last.y + last.height + CANVAS_BOTTOM_PADDING
}

export function buildCanvasBounds(laneBands: LaneBand[], canvasWidth: number): CanvasBounds {
  return {
    width: canvasWidth,
    height: computeCanvasHeight(laneBands),
    topPadding: CANVAS_TOP_PADDING,
    bottomPadding: CANVAS_BOTTOM_PADDING,
  }
}

export function clampNodeToLane(node: PlacedNode, band: LaneBand): PlacedNode {
  const maxX = band.contentRight - node.width
  const maxY = band.contentBottom - node.height

  return {
    ...node,
    x: clamp(node.x, band.contentLeft, Math.max(band.contentLeft, maxX)),
    y: clamp(node.y, band.contentTop, Math.max(band.contentTop, maxY)),
  }
}

export function clampNodesToBands(
  nodes: PlacedNode[],
  bands: LaneBand[],
): PlacedNode[] {
  return nodes.map((node) => {
    const band = bands.find((b) => b.laneId === node.laneId)
    return band ? clampNodeToLane(node, band) : node
  })
}

export function getMaxEdgeYInLane(
  pathPoints: Array<{ x: number; y: number }>,
  band: LaneBand,
): number {
  const inLane = pathPoints.filter((p) => p.y >= band.y && p.y <= band.y + band.height)
  if (inLane.length === 0) return band.y
  return Math.max(...inLane.map((p) => p.y))
}

export function assertNodesInsideLanes(nodes: PlacedNode[], bands: LaneBand[]): void {
  for (const node of nodes) {
    const band = bands.find((b) => b.laneId === node.laneId)
    if (!band) continue

    const insideX =
      node.x >= band.contentLeft && node.x + node.width <= band.contentRight
    const insideY =
      node.y >= band.contentTop && node.y + node.height <= band.contentBottom

    if (!insideX || !insideY) {
      console.warn(
        `[ProcessNavigator] 노드 "${node.id}"가 lane "${node.laneId}" content 영역을 벗어났습니다.`,
        { node, band },
      )
    }
  }
}

export function assertLanesCoverCanvas(
  bands: LaneBand[],
  canvasWidth: number,
  canvasHeight: number,
): void {
  if (bands.length === 0) return

  for (const band of bands) {
    if (band.width < canvasWidth) {
      console.warn(
        `[ProcessNavigator] lane "${band.laneId}" width(${band.width}) < canvasWidth(${canvasWidth})`,
      )
    }
  }

  const last = bands[bands.length - 1]
  if (last.y + last.height + CANVAS_BOTTOM_PADDING > canvasHeight + 1) {
    console.warn('[ProcessNavigator] lane stack height exceeds canvas height')
  }
}
