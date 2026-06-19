import type { Edge as FlowEdge } from '@xyflow/react'
import type { Edge, Lane, Process } from '../../types/process'
import { resolveEdgeType } from '../../types/edgeTypes'
import type { ProcessEdgeData } from './elkLayout'
import type { PlacedNode } from './laneLayout'
import { resolveNodeZone } from './overviewProcessZones'
import type { OverviewGridMetrics } from './overviewGridMetrics'
import type { ZoneLayoutBand } from './overviewGridLayout'
import { laneOrderToStartX, metricsToSwimlaneGrid } from './swimlaneGridLayout'

export const INTERFACE_RULE_LAYOUT = {
  width: 88,
  height: 88,
  diamondWidth: 52,
  diamondHeight: 52,
  exclusionPadding: 8,
  belowMinGap: 48,
} as const

export const MERGE_NODE_SIZE = { width: 96, height: 44 } as const

export const INTERFACE_RULE_OVERVIEW_SIZE = {
  width: 68,
  height: 68,
} as const

export const INTERFACE_RULE_POLYGON_POINTS = '26,4 64,34 38,64 4,34'

export type InterfaceRuleAnchor = {
  fromLaneId: string
  toLaneId: string
}

export function isInterfaceRuleNode(type: string | undefined): boolean {
  return type === 'interface-rule'
}

export function isBranchNodeType(type: string | undefined): boolean {
  return type === 'decision' || isInterfaceRuleNode(type)
}

export function getInterfaceRuleNodeSize(_name = ''): { width: number; height: number } {
  return { width: INTERFACE_RULE_LAYOUT.width, height: INTERFACE_RULE_LAYOUT.height }
}

export function getInterfaceRuleOverviewSize(): { width: number; height: number } {
  return { ...INTERFACE_RULE_OVERVIEW_SIZE }
}

function laneColumnMidX(lane: Lane, metrics: OverviewGridMetrics): number {
  const left = laneOrderToStartX(lane.order, metricsToSwimlaneGrid(metrics))
  return left + metrics.cellWidth / 2
}

function laneBoundaryMidX(fromLane: Lane, toLane: Lane, metrics: OverviewGridMetrics): number {
  const fromMid = laneColumnMidX(fromLane, metrics)
  const toMid = laneColumnMidX(toLane, metrics)
  return (fromMid + toMid) / 2
}

function getPathMidpoint(flowEdge: FlowEdge | undefined): { x: number; y: number } | null {
  const data = flowEdge?.data as ProcessEdgeData | undefined
  const points = data?.pathPoints
  if (!points || points.length === 0) return null

  if (points.length === 1) {
    return { x: points[0].x, y: points[0].y }
  }

  let total = 0
  const segments: Array<{ mid: { x: number; y: number }; len: number }> = []
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x
    const dy = points[i].y - points[i - 1].y
    const len = Math.hypot(dx, dy)
    total += len
    segments.push({
      len,
      mid: { x: (points[i - 1].x + points[i].x) / 2, y: (points[i - 1].y + points[i].y) / 2 },
    })
  }

  const target = total / 2
  let acc = 0
  for (const seg of segments) {
    acc += seg.len
    if (acc >= target) return seg.mid
  }
  const last = points[points.length - 1]
  return { x: last.x, y: last.y }
}

function isAnchorCrossLaneEdge(
  edge: Edge,
  process: Process,
  anchor: InterfaceRuleAnchor,
  zoneId: string,
): boolean {
  const nodeById = new Map(process.nodes.map((n) => [n.id, n]))
  const src = nodeById.get(edge.source)
  const tgt = nodeById.get(edge.target)
  if (!src || !tgt) return false
  if (isInterfaceRuleNode(src.type) || isInterfaceRuleNode(tgt.type)) return false

  const srcZone = resolveNodeZone(src)
  if (srcZone.zoneId !== zoneId) return false

  const lanePair = new Set([src.laneId, tgt.laneId])
  if (!lanePair.has(anchor.fromLaneId) || !lanePair.has(anchor.toLaneId)) return false
  if (src.laneId === tgt.laneId) return false

  const edgeType = resolveEdgeType(edge)
  return (
    src.type === 'interface' ||
    tgt.type === 'interface' ||
    edgeType === 'system' ||
    edge.type === 'system'
  )
}

export function placeOverviewInterfaceRules(
  process: Process,
  zoneBands: ZoneLayoutBand[],
  sortedLanes: Lane[],
  builtEdges: FlowEdge[],
  metrics: OverviewGridMetrics,
): PlacedNode[] {
  const laneById = new Map(sortedLanes.map((lane) => [lane.id, lane]))
  const flowEdgeById = new Map(builtEdges.map((edge) => [edge.id, edge]))
  const size = getInterfaceRuleOverviewSize()
  const placed: PlacedNode[] = []

  for (const rule of process.nodes.filter((node) => isInterfaceRuleNode(node.type))) {
    const anchor = rule.interfaceRuleAnchor ?? {
      fromLaneId: 'warehouse-easyadmin',
      toLaneId: 'finance',
    }
    const fromLane = laneById.get(anchor.fromLaneId)
    const toLane = laneById.get(anchor.toLaneId)
    if (!fromLane || !toLane) continue

    const zone = resolveNodeZone(rule)
    const zoneBand = zoneBands.find((band) => band.zoneId === zone.zoneId)
    if (!zoneBand) continue

    const anchorEdge = process.edges.find((edge) =>
      isAnchorCrossLaneEdge(edge, process, anchor, zone.zoneId),
    )

    let x = laneBoundaryMidX(fromLane, toLane, metrics) - size.width / 2
    let y = zoneBand.y + zoneBand.height / 2 - size.height / 2

    if (anchorEdge) {
      const mid = getPathMidpoint(flowEdgeById.get(anchorEdge.id))
      if (mid) {
        x = mid.x - size.width / 2
        y = mid.y - size.height / 2
      }
    }

    placed.push({
      id: rule.id,
      laneId: rule.laneId,
      x,
      y,
      width: size.width,
      height: size.height,
    })
  }

  return placed
}
