import type { Node, Process, ProcessZoneId } from '../../types/process'
import type { LaneBand, PlacedNode } from '../layout/laneLayout'
import { OVERVIEW_GRID_METRICS } from '../layout/overviewGridMetrics'
import type { ZoneLayoutBand } from '../layout/overviewGridLayout'
import { resolveNodeZone } from '../layout/overviewProcessZones'

type DropRect = { x: number; y: number; width: number; height: number }

function findLaneAtPoint(
  laneBands: LaneBand[],
  centerX: number,
  centerY: number,
): LaneBand | undefined {
  return laneBands.find(
    (band) =>
      centerX >= band.x &&
      centerX < band.x + band.width &&
      centerY >= band.y &&
      centerY < band.y + band.height,
  )
}

function findLaneAtX(laneBands: LaneBand[], centerX: number): LaneBand | undefined {
  return laneBands.find((band) => centerX >= band.x && centerX < band.x + band.width)
}

function findZoneAtY(zoneBands: ZoneLayoutBand[], centerY: number): ZoneLayoutBand | undefined {
  return zoneBands.find((zone) => centerY >= zone.y && centerY < zone.bottom)
}

function resolveDetailLocalOrder(
  process: Process,
  nodeId: string,
  laneId: string,
  centerX: number,
  centerY: number,
  placed: PlacedNode[],
): number {
  const peers = process.nodes
    .filter((n) => n.laneId === laneId && n.id !== nodeId)
    .map((n) => placed.find((pl) => pl.id === n.id))
    .filter((p): p is PlacedNode => p != null)
    .sort((a, b) => {
      const dx = a.x + a.width / 2 - (b.x + b.width / 2)
      if (Math.abs(dx) > 40) return dx
      return a.y + a.height / 2 - (b.y + b.height / 2)
    })

  let order = 1
  for (const peer of peers) {
    const px = peer.x + peer.width / 2
    const py = peer.y + peer.height / 2
    if (py < centerY - 8 || (Math.abs(py - centerY) <= 12 && px < centerX - 8)) {
      order += 1
    }
  }
  return order
}

function resolveOverviewCellOrder(
  process: Process,
  nodeId: string,
  laneId: string,
  processZone: ProcessZoneId,
  centerX: number,
  centerY: number,
  placed: PlacedNode[],
): number {
  const peers = process.nodes.filter((n) => {
    if (n.id === nodeId) return false
    if (n.laneId !== laneId) return false
    return resolveNodeZone(n).zoneId === processZone
  })

  const peerPlaced = peers
    .map((n) => placed.find((p) => p.id === n.id))
    .filter((p): p is PlacedNode => p != null)
    .sort((a, b) => {
      const dy = a.y + a.height / 2 - (b.y + b.height / 2)
      if (Math.abs(dy) > 12) return dy
      return a.x + a.width / 2 - (b.x + b.width / 2)
    })

  let order = 0
  for (const peer of peerPlaced) {
    const py = peer.y + peer.height / 2
    const px = peer.x + peer.width / 2
    if (py < centerY - 8 || (Math.abs(py - centerY) <= 12 && px < centerX - 8)) {
      order += 1
    }
  }
  return order
}

function resolveDetailCellOrder(
  process: Process,
  nodeId: string,
  laneId: string,
  centerX: number,
  centerY: number,
  placed: PlacedNode[],
): number {
  const peers = process.nodes
    .filter((n) => n.laneId === laneId && n.id !== nodeId)
    .map((n) => placed.find((pl) => pl.id === n.id))
    .filter((p): p is PlacedNode => p != null)
    .sort((a, b) => {
      const dy = a.y + a.height / 2 - (b.y + b.height / 2)
      if (Math.abs(dy) > 12) return dy
      return a.x + a.width / 2 - (b.x + b.width / 2)
    })

  let order = 0
  for (const peer of peers) {
    const py = peer.y + peer.height / 2
    const px = peer.x + peer.width / 2
    if (py < centerY - 8 || (Math.abs(py - centerY) <= 12 && px < centerX - 8)) {
      order += 1
    }
  }
  return order
}

function hasStructuralPlacementChange(node: Node, patch: Partial<Node>): boolean {
  if (patch.laneId != null && patch.laneId !== node.laneId) return true
  if (patch.processZone != null && patch.processZone !== node.processZone) return true
  if (patch.cellOrder != null && patch.cellOrder !== (node.cellOrder ?? node.zoneOrder)) return true
  if (patch.cellSlot != null && patch.cellSlot !== node.cellSlot) return true
  if (patch.localOrder != null && patch.localOrder !== node.localOrder) return true
  return false
}

function applyOffsetAfterDrag(
  node: Node,
  patch: Partial<Node>,
  drop: DropRect,
  baseline: PlacedNode,
): Partial<Node> {
  if (hasStructuralPlacementChange(node, patch)) {
    return { ...patch, offsetX: 0, offsetY: 0 }
  }

  const deltaX = Math.round(drop.x - baseline.x)
  const deltaY = Math.round(drop.y - baseline.y)
  if (deltaX === 0 && deltaY === 0) return patch

  return {
    ...patch,
    offsetX: (node.offsetX ?? 0) + deltaX,
    offsetY: (node.offsetY ?? 0) + deltaY,
  }
}

/** Drag 완료 후 lane/zone/cellOrder 갱신 + offsetX/Y 미세조정 */
export function resolveNodePlacementAfterDrag(
  process: Process,
  nodeId: string,
  drop: DropRect,
  ctx: {
    laneBands: LaneBand[]
    zoneBands?: ZoneLayoutBand[]
    placed: PlacedNode[]
    isOverview: boolean
  },
): Partial<Node> {
  const node = process.nodes.find((n) => n.id === nodeId)
  const baseline = ctx.placed.find((p) => p.id === nodeId)
  const centerX = drop.x + drop.width / 2
  const centerY = drop.y + drop.height / 2
  const lane =
    findLaneAtPoint(ctx.laneBands, centerX, centerY) ??
    findLaneAtX(ctx.laneBands, centerX)
  const laneId = lane?.laneId ?? node?.laneId

  if (!laneId) return {}

  let patch: Partial<Node> = {}

  if (ctx.isOverview && ctx.zoneBands && ctx.zoneBands.length > 0) {
    const zone =
      findZoneAtY(ctx.zoneBands, centerY) ??
      ctx.zoneBands.reduce((best, z) => {
        const dist = Math.abs(centerY - (z.y + z.height / 2))
        const bestDist = Math.abs(centerY - (best.y + best.height / 2))
        return dist < bestDist ? z : best
      })

    const processZone = zone.zoneId
    const cellOrder = resolveOverviewCellOrder(
      process,
      nodeId,
      laneId,
      processZone,
      centerX,
      centerY,
      ctx.placed,
    )

    patch = { laneId, processZone, cellOrder, zoneOrder: cellOrder }
  } else if (ctx.isOverview) {
    const zone = node ? resolveNodeZone(node) : { zoneId: 'business-contract' as ProcessZoneId, zoneOrder: 0 }
    patch = {
      laneId,
      processZone: zone.zoneId,
      cellOrder: zone.zoneOrder,
      zoneOrder: zone.zoneOrder,
    }
  } else {
    const cellOrder = resolveDetailCellOrder(process, nodeId, laneId, centerX, centerY, ctx.placed)
    patch = {
      laneId,
      localOrder: resolveDetailLocalOrder(process, nodeId, laneId, centerX, centerY, ctx.placed),
      cellOrder,
      zoneOrder: cellOrder,
    }
  }

  if (node && baseline) {
    return applyOffsetAfterDrag(node, patch, drop, baseline)
  }

  return patch
}

export { OVERVIEW_GRID_METRICS }
