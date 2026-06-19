import type { Node, ProcessZoneId } from '../../types/process'
import {
  PROCESS_ZONES,
  fallbackZoneFromPhaseOrder,
  resolveNodeZone,
} from '../layout/overviewProcessZones'

export function isNodeInOverviewZone(node: Node, zoneId: ProcessZoneId): boolean {
  return resolveNodeZone(node).zoneId === zoneId
}

function fallbackZoneWhenRemoving(node: Node, excludeZoneId: ProcessZoneId): ProcessZoneId {
  const fromPhase = fallbackZoneFromPhaseOrder(node.phaseOrder ?? 99)
  if (fromPhase.zoneId !== excludeZoneId) return fromPhase.zoneId

  const alternate = PROCESS_ZONES.find((zone) => zone.id !== excludeZoneId)
  return alternate?.id ?? 'business-contract'
}

/** Overview Y축 Zone 멤버십 토글 — processZone 명시 저장 */
export function setNodeOverviewZoneMembership(
  node: Node,
  zoneId: ProcessZoneId,
  include: boolean,
): Node {
  if (include) {
    return { ...node, processZone: zoneId }
  }

  if (!isNodeInOverviewZone(node, zoneId)) return node

  return {
    ...node,
    processZone: fallbackZoneWhenRemoving(node, zoneId),
  }
}

export function listOverviewZoneNodeIds(nodes: Node[], zoneId: ProcessZoneId): string[] {
  return nodes
    .filter((node) => node.type !== 'phase-connector' && isNodeInOverviewZone(node, zoneId))
    .map((node) => node.id)
}
