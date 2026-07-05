import type { Node, Process, ProcessZoneId } from '../../types/process'
import type { LaneBand, PlacedNode } from '../layout/laneLayout'
import { DETAIL_GRID_METRICS, OVERVIEW_GRID_METRICS } from '../layout/overviewGridMetrics'
import type { ZoneLayoutBand } from '../layout/overviewGridLayout'
import { resolveNodeZone } from '../layout/overviewProcessZones'
import {
  DETAIL_CELL_MAX_ROWS,
  OVERVIEW_CELL_MAX_ROWS,
  clampCellSlot,
  cellSlotToRowCol,
  normalizeLegacyCellSlot,
  rowColToCellSlot,
} from '../layout/overviewCellPlacement'
import {
  DETAIL_HORIZONTAL_MAX_TRACK_COUNT,
  DETAIL_HORIZONTAL_ORDER_COLUMN_WIDTH,
  DETAIL_HORIZONTAL_ROW_PITCH,
} from '../layout/detailHorizontalLayout'

type DropRect = { x: number; y: number; width: number; height: number }

export type NodePlacementPatch = {
  nodeId: string
  patch: Partial<Node>
}

export type DropPlacementPreview = {
  laneId: string
  laneName: string
  zoneId?: ProcessZoneId
  zoneLabel?: string
  cellSlot?: number
  rect: DropRect
  label: string
}

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

function resolveCellSlotFromDrop(
  lane: LaneBand,
  centerX: number,
  centerY: number,
  topY: number,
  metrics = DETAIL_GRID_METRICS,
  maxRows = DETAIL_CELL_MAX_ROWS,
): number {
  const contentLeft = lane.contentLeft
  const contentRight = lane.contentRight
  const contentWidth = Math.max(1, contentRight - contentLeft)
  const col = centerX >= contentLeft + contentWidth / 2 ? 1 : 0
  const rowStep = Math.max(metrics.rowMinHeightDecision, metrics.nodeHeight) + metrics.nodeGapY
  const rawRow = Math.floor((centerY - topY) / rowStep)
  const row = Math.min(Math.max(rawRow, 0), maxRows - 1)
  return rowColToCellSlot(row, col, maxRows)
}

function resolveCellSlotPreviewRect(
  lane: LaneBand,
  cellSlot: number,
  topY: number,
  metrics = DETAIL_GRID_METRICS,
  maxRows = DETAIL_CELL_MAX_ROWS,
): DropRect {
  const { row, col } = cellSlotToRowCol(cellSlot, maxRows)
  const contentWidth = Math.max(1, lane.contentRight - lane.contentLeft)
  const columnWidth = contentWidth / 2
  const rowStep = Math.max(metrics.rowMinHeightDecision, metrics.nodeHeight) + metrics.nodeGapY
  const inset = 4

  return {
    x: lane.contentLeft + columnWidth * col + inset,
    y: topY + rowStep * row + inset,
    width: Math.max(1, columnWidth - inset * 2),
    height: Math.max(1, rowStep - inset * 2),
  }
}

export function resolveDropPlacementPreview(
  drop: DropRect,
  ctx: {
    laneBands: LaneBand[]
    zoneBands?: ZoneLayoutBand[]
    isOverview: boolean
  },
): DropPlacementPreview | null {
  if (!ctx.isOverview) return null

  const centerX = drop.x + drop.width / 2
  const centerY = drop.y + drop.height / 2
  const lane =
    findLaneAtPoint(ctx.laneBands, centerX, centerY) ??
    findLaneAtX(ctx.laneBands, centerX)
  if (!lane) return null

  const zone =
    ctx.zoneBands && ctx.zoneBands.length > 0
      ? findZoneAtY(ctx.zoneBands, centerY) ??
        ctx.zoneBands.reduce((best, z) => {
          const dist = Math.abs(centerY - (z.y + z.height / 2))
          const bestDist = Math.abs(centerY - (best.y + best.height / 2))
          return dist < bestDist ? z : best
        })
      : undefined

  const topY = zone
    ? zone.y + OVERVIEW_GRID_METRICS.cellPaddingY
    : lane.contentTop
  const cellSlot = resolveCellSlotFromDrop(
    lane,
    centerX,
    centerY,
    topY,
    OVERVIEW_GRID_METRICS,
    OVERVIEW_CELL_MAX_ROWS,
  )
  const { row, col } = cellSlotToRowCol(cellSlot, OVERVIEW_CELL_MAX_ROWS)

  return {
    laneId: lane.laneId,
    laneName: lane.laneName,
    zoneId: zone?.zoneId,
    zoneLabel: zone?.label,
    cellSlot,
    rect: resolveCellSlotPreviewRect(
      lane,
      cellSlot,
      topY,
      OVERVIEW_GRID_METRICS,
      OVERVIEW_CELL_MAX_ROWS,
    ),
    label: `${lane.laneName}${zone ? ` · ${zone.label}` : ''} · ${col === 0 ? '좌' : '우'} ${row + 1}행`,
  }
}

function resolveDetailLayoutFromDrop(
  lane: LaneBand,
  drop: DropRect,
): NonNullable<Node['detailLayout']> {
  const centerX = drop.x + drop.width / 2
  const centerY = drop.y + drop.height / 2
  const rawColumn = Math.round((centerX - (lane.contentLeft + drop.width / 2)) / DETAIL_HORIZONTAL_ORDER_COLUMN_WIDTH) + 1
  const rawRow = Math.round((centerY - (lane.contentTop + DETAIL_HORIZONTAL_ROW_PITCH / 2)) / DETAIL_HORIZONTAL_ROW_PITCH) + 1

  return {
    column: Math.max(1, rawColumn),
    row: Math.min(DETAIL_HORIZONTAL_MAX_TRACK_COUNT, Math.max(1, rawRow)),
  }
}

function hasStructuralPlacementChange(node: Node, patch: Partial<Node>): boolean {
  if (patch.laneId != null && patch.laneId !== node.laneId) return true
  if (patch.processZone != null && patch.processZone !== node.processZone) return true
  if (patch.cellOrder != null && patch.cellOrder !== (node.cellOrder ?? node.zoneOrder)) return true
  if (patch.cellSlot != null && patch.cellSlot !== node.cellSlot) return true
  if (
    patch.detailLayout != null &&
    (patch.detailLayout.column !== node.detailLayout?.column ||
      patch.detailLayout.row !== node.detailLayout?.row)
  ) {
    return true
  }
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
    detailHorizontal?: boolean
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

  let patch: Partial<Node>

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
    const cellSlot = lane
      ? resolveCellSlotFromDrop(
          lane,
          centerX,
          centerY,
          zone.y + OVERVIEW_GRID_METRICS.cellPaddingY,
          OVERVIEW_GRID_METRICS,
          OVERVIEW_CELL_MAX_ROWS,
        )
      : undefined

    patch = {
      laneId,
      processZone,
      cellOrder,
      zoneOrder: cellOrder,
      ...(cellSlot != null ? { cellSlot } : {}),
    }
  } else if (ctx.isOverview) {
    const zone = node ? resolveNodeZone(node) : { zoneId: 'business-contract' as ProcessZoneId, zoneOrder: 0 }
    const cellSlot = lane
      ? resolveCellSlotFromDrop(
          lane,
          centerX,
          centerY,
          lane.contentTop,
          OVERVIEW_GRID_METRICS,
          OVERVIEW_CELL_MAX_ROWS,
        )
      : undefined
    patch = {
      laneId,
      processZone: zone.zoneId,
      cellOrder: zone.zoneOrder,
      zoneOrder: zone.zoneOrder,
      ...(cellSlot != null ? { cellSlot } : {}),
    }
  } else if (ctx.detailHorizontal) {
    const detailLayout = lane ? resolveDetailLayoutFromDrop(lane, drop) : node?.detailLayout
    const localOrder = detailLayout?.column ?? resolveDetailLocalOrder(process, nodeId, laneId, centerX, centerY, ctx.placed)
    patch = {
      laneId,
      localOrder,
      cellOrder: Math.max(0, localOrder - 1),
      zoneOrder: Math.max(0, localOrder - 1),
      cellSlot: undefined,
      ...(detailLayout ? { detailLayout } : {}),
    }
  } else {
    const cellOrder = resolveDetailCellOrder(process, nodeId, laneId, centerX, centerY, ctx.placed)
    const cellSlot = lane
      ? resolveCellSlotFromDrop(
          lane,
          centerX,
          centerY,
          lane.contentTop,
          DETAIL_GRID_METRICS,
          DETAIL_CELL_MAX_ROWS,
        )
      : undefined
    patch = {
      laneId,
      localOrder: resolveDetailLocalOrder(process, nodeId, laneId, centerX, centerY, ctx.placed),
      cellOrder,
      zoneOrder: cellOrder,
      ...(cellSlot != null ? { cellSlot } : {}),
    }
  }

  if (node && baseline) {
    if (patch.detailLayout != null) {
      return { ...patch, offsetX: 0, offsetY: 0 }
    }
    if (patch.cellSlot != null) {
      return { ...patch, offsetX: 0, offsetY: 0 }
    }
    return applyOffsetAfterDrag(node, patch, drop, baseline)
  }

  return patch
}

function sameOverviewCell(a: Node, b: Node): boolean {
  return a.laneId === b.laneId && resolveNodeZone(a).zoneId === resolveNodeZone(b).zoneId
}

function orderedSlotsAfter(slot: number, maxRows: number): number[] {
  const { row, col } = cellSlotToRowCol(slot, maxRows)
  const slots: number[] = []
  for (let r = row + 1; r < maxRows; r += 1) {
    slots.push(rowColToCellSlot(r, col, maxRows))
  }
  for (let r = 0; r < maxRows; r += 1) {
    const other = rowColToCellSlot(r, col === 0 ? 1 : 0, maxRows)
    if (other > slot || r > row) slots.push(other)
  }
  for (let r = 0; r <= row; r += 1) {
    slots.push(rowColToCellSlot(r, col === 0 ? 1 : 0, maxRows))
  }
  return [...new Set(slots)].filter((candidate) => candidate !== slot)
}

function resolveOverviewDisplacementPatches(
  process: Process,
  nodeId: string,
  basePatch: Partial<Node>,
): NodePlacementPatch[] {
  const dragged = process.nodes.find((node) => node.id === nodeId)
  if (!dragged || basePatch.cellSlot == null) return [{ nodeId, patch: basePatch }]

  const droppedNode: Node = { ...dragged, ...basePatch }
  if (!droppedNode.processZone) return [{ nodeId, patch: basePatch }]

  const maxRows = OVERVIEW_CELL_MAX_ROWS
  const desiredSlot = clampCellSlot(normalizeLegacyCellSlot(basePatch.cellSlot, maxRows), maxRows)
  const cellNodes = process.nodes.filter((node) => {
    if (node.id === nodeId) return false
    if (node.cellSlot == null) return false
    return sameOverviewCell({ ...node, processZone: resolveNodeZone(node).zoneId }, droppedNode)
  })
  const slotToNode = new Map<number, Node>()
  for (const node of cellNodes) {
    const slot = clampCellSlot(normalizeLegacyCellSlot(node.cellSlot!, maxRows), maxRows)
    if (!slotToNode.has(slot)) slotToNode.set(slot, node)
  }
  if (!slotToNode.has(desiredSlot)) {
    return [{ nodeId, patch: { ...basePatch, cellSlot: desiredSlot } }]
  }

  const emptySlots = new Set<number>()
  for (let slot = 1; slot <= maxRows * 2; slot += 1) {
    if (slot !== desiredSlot && !slotToNode.has(slot)) emptySlots.add(slot)
  }
  if (emptySlots.size === 0) {
    return [{ nodeId, patch: { ...basePatch, cellSlot: desiredSlot } }]
  }

  const patches: NodePlacementPatch[] = [
    { nodeId, patch: { ...basePatch, cellSlot: desiredSlot } },
  ]
  let currentSlot = desiredSlot
  let moving = slotToNode.get(currentSlot)
  const visited = new Set<string>()

  while (moving && !visited.has(moving.id)) {
    visited.add(moving.id)
    const nextSlot = orderedSlotsAfter(currentSlot, maxRows).find(
      (slot) => emptySlots.has(slot) || slotToNode.has(slot),
    )
    if (nextSlot == null) break
    const nextOccupant = slotToNode.get(nextSlot)
    patches.push({
      nodeId: moving.id,
      patch: {
        cellSlot: nextSlot,
        offsetX: 0,
        offsetY: 0,
      },
    })
    slotToNode.delete(currentSlot)
    slotToNode.set(nextSlot, moving)
    if (emptySlots.has(nextSlot)) break
    currentSlot = nextSlot
    moving = nextOccupant
  }

  return patches
}

function resolveDetailHorizontalDisplacementPatches(
  process: Process,
  nodeId: string,
  basePatch: Partial<Node>,
): NodePlacementPatch[] {
  const dragged = process.nodes.find((node) => node.id === nodeId)
  const targetLayout = basePatch.detailLayout
  const laneId = basePatch.laneId ?? dragged?.laneId
  if (!dragged || !targetLayout || !laneId) return [{ nodeId, patch: basePatch }]
  if (targetLayout.column == null || targetLayout.row == null) return [{ nodeId, patch: basePatch }]

  const sameLane = process.nodes.filter((node) => node.id !== nodeId && node.laneId === laneId)
  const occupied = new Map<string, Node>()
  for (const node of sameLane) {
    if (!node.detailLayout?.column || !node.detailLayout?.row) continue
    occupied.set(`${node.detailLayout.column}:${node.detailLayout.row}`, node)
  }

  const key = `${targetLayout.column}:${targetLayout.row}`
  if (!occupied.has(key)) return [{ nodeId, patch: basePatch }]

  const patches: NodePlacementPatch[] = [{ nodeId, patch: basePatch }]
  let column = targetLayout.column
  const row = targetLayout.row
  let moving = occupied.get(key)
  const visited = new Set<string>()

  while (moving && !visited.has(moving.id)) {
    visited.add(moving.id)
    column += 1
    const nextKey = `${column}:${row}`
    const nextOccupant = occupied.get(nextKey)
    patches.push({
      nodeId: moving.id,
      patch: {
        detailLayout: { ...(moving.detailLayout ?? {}), column, row },
        localOrder: column,
        cellOrder: Math.max(0, column - 1),
        zoneOrder: Math.max(0, column - 1),
        offsetX: 0,
        offsetY: 0,
      },
    })
    if (!nextOccupant) break
    moving = nextOccupant
  }

  return patches
}

export function resolveNodePlacementPatchesAfterDrag(
  process: Process,
  nodeId: string,
  drop: DropRect,
  ctx: {
    laneBands: LaneBand[]
    zoneBands?: ZoneLayoutBand[]
    placed: PlacedNode[]
    isOverview: boolean
    detailHorizontal?: boolean
  },
): NodePlacementPatch[] {
  const patch = resolveNodePlacementAfterDrag(process, nodeId, drop, ctx)
  if (Object.keys(patch).length === 0) return []
  if (ctx.isOverview && patch.cellSlot != null) {
    return resolveOverviewDisplacementPatches(process, nodeId, patch)
  }
  if (ctx.detailHorizontal && patch.detailLayout) {
    return resolveDetailHorizontalDisplacementPatches(process, nodeId, patch)
  }
  return [{ nodeId, patch }]
}

export { OVERVIEW_GRID_METRICS }
