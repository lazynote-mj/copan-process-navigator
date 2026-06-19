import type { Edge, Process } from '../../types/process'
import { getNodeById } from '../../types/process'
import { isReturnEdgeType, resolveEdgeType } from '../../types/edgeTypes'
import type { PlacedNode } from './laneLayout'
import type { EdgeRoutingType } from './edgeClassification'
import { isBottomRouteEdge } from './edgeClassification'
import type { OverviewZoneAssignment } from './overviewZoneLayout'
import { compareZoneOrder, zoneBandForId, zoneOfNode } from './overviewZoneLayout'
import type { ZoneLayoutBand } from './overviewZoneLayout'
import type { OverviewVerticalMetrics } from './overviewVerticalMetrics'
import { overviewSimilarYThreshold } from './overviewVerticalMetrics'

function nodeCenterY(node: PlacedNode): number {
  return node.y + node.height / 2
}

function isSimilarY(
  source: PlacedNode,
  target: PlacedNode,
  metrics: OverviewVerticalMetrics,
): boolean {
  return Math.abs(nodeCenterY(source) - nodeCenterY(target)) <= overviewSimilarYThreshold(metrics)
}

function gapCorridorBetween(
  sourceZoneId: string,
  targetZoneId: string,
  zoneBands: ZoneLayoutBand[],
): number {
  const sourceBand = zoneBandForId(zoneBands, sourceZoneId as import('./overviewProcessZones').ProcessZoneId)
  const targetBand = zoneBandForId(zoneBands, targetZoneId as import('./overviewProcessZones').ProcessZoneId)
  if (!sourceBand || !targetBand) return (sourceBand?.bottom ?? targetBand?.y ?? 0)

  if (compareZoneOrder(sourceBand.zoneId, targetBand.zoneId) < 0) {
    return sourceBand.gapConnectorY
  }
  return targetBand.gapConnectorY
}

/**
 * Zone 기반 Overview edge routing.
 * - same zone: lane 내부 vertical / 인접 lane cross-lane-step
 * - cross zone: zone-down / zone-up (gap corridor, 긴 수평선 금지)
 */
export function classifyOverviewVerticalEdge(
  edge: Edge,
  source: PlacedNode,
  target: PlacedNode,
  process: Process,
  laneOrder: Map<string, number>,
  metrics: OverviewVerticalMetrics,
  assignments: Map<string, OverviewZoneAssignment>,
): EdgeRoutingType {
  const edgeType = resolveEdgeType(edge)

  if (isReturnEdgeType(edgeType) && isBottomRouteEdge(edge, source.id, target.id, process)) {
    const sourceZone = zoneOfNode(source.id, assignments)
    const targetZone = zoneOfNode(target.id, assignments)
    if (sourceZone && targetZone && sourceZone !== targetZone) {
      return compareZoneOrder(sourceZone, targetZone) > 0 ? 'zone-up' : 'zone-down'
    }
    return 'vertical-up'
  }

  const sourceNode = getNodeById(process, source.id)
  const targetNode = getNodeById(process, target.id)
  if (!sourceNode || !targetNode) return 'orthogonal'

  const sourceZone = zoneOfNode(source.id, assignments)
  const targetZone = zoneOfNode(target.id, assignments)
  if (!sourceZone || !targetZone) return 'orthogonal'

  const zoneCmp = compareZoneOrder(sourceZone, targetZone)

  if (zoneCmp !== 0) {
    const zoneDiff = Math.abs(zoneCmp)
    if (zoneDiff === 1) {
      return zoneCmp < 0 ? 'zone-down' : 'zone-up'
    }
    if (source.laneId === target.laneId) {
      return zoneCmp < 0 ? 'vertical-down' : 'vertical-up'
    }
    return zoneCmp < 0 ? 'cross-lane-step' : 'vertical-up'
  }

  if (source.laneId === target.laneId) {
    if (target.y >= source.y + source.height * 0.5) return 'vertical-down'
    if (target.y + target.height <= source.y + source.height * 0.5) return 'vertical-up'
    return 'vertical-down'
  }

  const sourceLaneOrd = laneOrder.get(source.laneId) ?? 0
  const targetLaneOrd = laneOrder.get(target.laneId) ?? 0
  const laneDiff = Math.abs(sourceLaneOrd - targetLaneOrd)

  if (isSimilarY(source, target, metrics) && laneDiff === 1) {
    return 'horizontal-forward'
  }

  return 'cross-lane-step'
}

export function resolveOverviewCorridorY(
  source: PlacedNode,
  target: PlacedNode,
  assignments: Map<string, OverviewZoneAssignment>,
  zoneBands: ZoneLayoutBand[],
): number {
  const sourceZone = zoneOfNode(source.id, assignments)!
  const targetZone = zoneOfNode(target.id, assignments)!
  return gapCorridorBetween(sourceZone, targetZone, zoneBands)
}
