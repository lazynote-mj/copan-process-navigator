import type { Node, Process } from '../../types/process'
import { resolveNodeZone, zoneOrderIndex, type ProcessZoneId } from './overviewProcessZones'

export type OverviewZoneAssignment = {
  nodeId: string
  zoneId: ProcessZoneId
  zoneOrder: number
  laneSlot: number
}

export type ZoneLayoutBand = {
  zoneId: ProcessZoneId
  label: string
  y: number
  height: number
  bottom: number
  gapConnectorY: number
}

/** lane × zone 내 노드 배치 순서 확정 */
export function computeOverviewZoneAssignments(process: Process): Map<string, OverviewZoneAssignment> {
  const assignments = new Map<string, OverviewZoneAssignment>()
  const byLaneZone = new Map<string, Node[]>()

  for (const node of process.nodes) {
    const { zoneId } = resolveNodeZone(node)
    const key = `${node.laneId}:${zoneId}`
    const list = byLaneZone.get(key) ?? []
    list.push(node)
    byLaneZone.set(key, list)
  }

  for (const group of byLaneZone.values()) {
    group.sort((a, b) => {
      const za = resolveNodeZone(a)
      const zb = resolveNodeZone(b)
      if (za.zoneOrder !== zb.zoneOrder) return za.zoneOrder - zb.zoneOrder
      return (a.localOrder ?? 0) - (b.localOrder ?? 0) || a.id.localeCompare(b.id)
    })

    const byOrder = new Map<number, Node[]>()
    for (const node of group) {
      const { zoneOrder } = resolveNodeZone(node)
      const list = byOrder.get(zoneOrder) ?? []
      list.push(node)
      byOrder.set(zoneOrder, list)
    }

    for (const orderGroup of byOrder.values()) {
      orderGroup.sort((a, b) => (a.localOrder ?? 0) - (b.localOrder ?? 0) || a.id.localeCompare(b.id))
      orderGroup.forEach((node, laneSlot) => {
        const { zoneId, zoneOrder } = resolveNodeZone(node)
        assignments.set(node.id, { nodeId: node.id, zoneId, zoneOrder, laneSlot })
      })
    }
  }

  return assignments
}

export function zoneOfNode(
  nodeId: string,
  assignments: Map<string, OverviewZoneAssignment>,
): ProcessZoneId | undefined {
  return assignments.get(nodeId)?.zoneId
}

export function compareZoneOrder(
  sourceZoneId: ProcessZoneId,
  targetZoneId: ProcessZoneId,
): number {
  return zoneOrderIndex(sourceZoneId) - zoneOrderIndex(targetZoneId)
}

export function zoneBandForId(bands: ZoneLayoutBand[], zoneId: ProcessZoneId): ZoneLayoutBand | undefined {
  return bands.find((b) => b.zoneId === zoneId)
}
