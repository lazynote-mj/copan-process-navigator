import type { Edge, Node, Process } from '../../types/process'
import type { PlacedNode } from './laneLayout'
import {
  getOverviewNodeSize,
  isOverviewDecisionType,
  type OverviewVerticalMetrics,
} from './overviewVerticalMetrics'
import { resolveNodeZone, type ProcessZoneId } from './overviewProcessZones'
import { PROCESS_ZONES } from './overviewProcessZones'
import type { OverviewZoneAssignment, ZoneLayoutBand } from './overviewZoneLayout'
import { trySetNodeY, wouldOverlapAtY } from './overviewNodeCollision'

export type ProcessRowKey = string

const LANE_ROW_SEP = '\x1e'

export function laneRowGroupKey(laneId: string, rowKey: ProcessRowKey): string {
  return `${laneId}${LANE_ROW_SEP}${rowKey}`
}

export function parseLaneRowGroupKey(key: string): { laneId: string; rowKey: ProcessRowKey } {
  const sep = key.indexOf(LANE_ROW_SEP)
  if (sep < 0) return { laneId: key, rowKey: '' }
  return { laneId: key.slice(0, sep), rowKey: key.slice(sep + 1) }
}

export type RowMeta = {
  key: ProcessRowKey
  zoneId: ProcessZoneId
  zoneOrder: number
  y: number
  height: number
  hasDecision: boolean
  crossLane: boolean
  longEdge: boolean
}

export function processRowKey(zoneId: ProcessZoneId, zoneOrder: number): ProcessRowKey {
  return `${zoneId}:${zoneOrder}`
}

type RowEdgeFlags = { crossLane: boolean; longEdge: boolean }

function rowNodesFor(nodes: Node[], zoneId: ProcessZoneId, zoneOrder: number): Node[] {
  return nodes.filter(
    (n) => resolveNodeZone(n).zoneId === zoneId && resolveNodeZone(n).zoneOrder === zoneOrder,
  )
}

function computeRowEdgeFlags(
  nodes: Node[],
  edges: Edge[],
  process: Process,
): Map<ProcessRowKey, RowEdgeFlags> {
  const flags = new Map<ProcessRowKey, RowEdgeFlags>()
  const nodeById = new Map(nodes.map((n) => [n.id, n]))
  const laneOrderOf = (laneId: string) => process.lanes.find((l) => l.id === laneId)?.order ?? 0

  const ensure = (key: ProcessRowKey): RowEdgeFlags => {
    const existing = flags.get(key)
    if (existing) return existing
    const next = { crossLane: false, longEdge: false }
    flags.set(key, next)
    return next
  }

  for (const edge of edges) {
    const src = nodeById.get(edge.source)
    const tgt = nodeById.get(edge.target)
    if (!src || !tgt) continue

    const sz = resolveNodeZone(src)
    const tz = resolveNodeZone(tgt)
    const srcKey = processRowKey(sz.zoneId, sz.zoneOrder)
    const tgtKey = processRowKey(tz.zoneId, tz.zoneOrder)

    if (src.laneId !== tgt.laneId) {
      ensure(srcKey).crossLane = true
      ensure(tgtKey).crossLane = true
    }

    const laneDiff = Math.abs(laneOrderOf(src.laneId) - laneOrderOf(tgt.laneId))
    if (laneDiff >= 2) {
      ensure(srcKey).longEdge = true
      ensure(tgtKey).longEdge = true
    }
  }

  return flags
}

function stackHeightInLane(rowNodes: Node[], laneId: string, metrics: OverviewVerticalMetrics): number {
  const inLane = rowNodes.filter((n) => n.laneId === laneId)
  if (inLane.length <= 1) return 0
  return inLane.reduce((sum, node, index) => {
    const h = getOverviewNodeSize(node.type, metrics, node.name).height
    return sum + h + (index > 0 ? metrics.nodeGapY : 0)
  }, 0)
}

function rowContentHeight(rowNodes: Node[], metrics: OverviewVerticalMetrics): number {
  let height = metrics.nodeHeight
  for (const node of rowNodes) {
    height = Math.max(height, getOverviewNodeSize(node.type, metrics, node.name).height)
  }
  const laneIds = [...new Set(rowNodes.map((n) => n.laneId))]
  for (const laneId of laneIds) {
    height = Math.max(height, stackHeightInLane(rowNodes, laneId, metrics))
  }
  return height
}

function hasSameLaneVerticalChain(
  prev: RowMeta,
  next: RowMeta,
  nodes: Node[],
  edges: Edge[],
): boolean {
  for (const edge of edges) {
    const src = nodes.find((n) => n.id === edge.source)
    const tgt = nodes.find((n) => n.id === edge.target)
    if (!src || !tgt || src.laneId !== tgt.laneId) continue

    const sz = resolveNodeZone(src)
    const tz = resolveNodeZone(tgt)
    if (sz.zoneId !== prev.zoneId || tz.zoneId !== next.zoneId) continue
    if (sz.zoneOrder === prev.zoneOrder && tz.zoneOrder === next.zoneOrder) {
      return true
    }
  }
  return false
}

function rowGapBetween(
  prev: RowMeta,
  next: RowMeta,
  nodes: Node[],
  edges: Edge[],
  metrics: OverviewVerticalMetrics,
): number {
  if (prev.hasDecision || next.hasDecision) {
    return (
      (prev.hasDecision ? metrics.decisionMarginBelow : 0) +
      (next.hasDecision ? metrics.decisionMarginAbove : 0)
    )
  }

  if (hasSameLaneVerticalChain(prev, next, nodes, edges)) {
    return metrics.nodeVerticalGap
  }

  return metrics.processRowGap
}

function rowRoutingAllowance(row: RowMeta, metrics: OverviewVerticalMetrics): number {
  return row.crossLane || row.longEdge || row.hasDecision
    ? metrics.edgeRoutingAllowanceLong
    : metrics.edgeRoutingAllowance
}

function computeRowsForZone(
  zoneId: ProcessZoneId,
  nodes: Node[],
  edges: Edge[],
  rowFlags: Map<ProcessRowKey, RowEdgeFlags>,
  startY: number,
  metrics: OverviewVerticalMetrics,
): { rows: RowMeta[]; zoneHeight: number } {
  const zoneOrders = [
    ...new Set(
      nodes
        .filter((n) => resolveNodeZone(n).zoneId === zoneId)
        .map((n) => resolveNodeZone(n).zoneOrder),
    ),
  ].sort((a, b) => a - b)

  const rows: RowMeta[] = []
  let currentY = startY + metrics.zonePaddingY

  for (const zoneOrder of zoneOrders) {
    const rowNodes = rowNodesFor(nodes, zoneId, zoneOrder)
    if (rowNodes.length === 0) continue

    const key = processRowKey(zoneId, zoneOrder)
    const flags = rowFlags.get(key) ?? { crossLane: false, longEdge: false }
    const hasDecision = rowNodes.some((n) => isOverviewDecisionType(n.type))
    const contentH = rowContentHeight(rowNodes, metrics)
    const height =
      contentH +
      metrics.nodeGapY +
      rowRoutingAllowance({ key, zoneId, zoneOrder, y: 0, height: 0, hasDecision, ...flags }, metrics)

    const rowMeta: RowMeta = {
      key,
      zoneId,
      zoneOrder,
      y: currentY,
      height,
      hasDecision,
      crossLane: flags.crossLane,
      longEdge: flags.longEdge,
    }

    const prev = rows[rows.length - 1]
    if (prev) {
      rowMeta.y = prev.y + prev.height + rowGapBetween(prev, rowMeta, nodes, edges, metrics)
    }

    rows.push(rowMeta)
    currentY = rowMeta.y + height
  }

  const zoneHeight =
    rows.length > 0 ? currentY - startY + metrics.zonePaddingY : metrics.minZoneHeight
  return { rows, zoneHeight: Math.max(zoneHeight, metrics.minZoneHeight) }
}

export function computeProcessRowBands(
  process: Process,
  nodes: Node[],
  edges: Edge[],
  contentTop: number,
  metrics: OverviewVerticalMetrics,
): { rows: RowMeta[]; zoneBands: ZoneLayoutBand[] } {
  const rowFlags = computeRowEdgeFlags(nodes, edges, process)
  const allRows: RowMeta[] = []
  const zoneBands: ZoneLayoutBand[] = []
  let zoneY = contentTop
  const phaseGap = metrics.phaseGap ?? metrics.zoneGap

  for (const zone of PROCESS_ZONES) {
    const { rows, zoneHeight } = computeRowsForZone(zone.id, nodes, edges, rowFlags, zoneY, metrics)
    allRows.push(...rows)

    const bottom = zoneY + zoneHeight
    zoneBands.push({
      zoneId: zone.id,
      label: zone.label,
      y: zoneY,
      height: zoneHeight,
      bottom,
      gapConnectorY: zone.order < PROCESS_ZONES.length - 1 ? bottom + phaseGap / 2 : bottom,
    })

    zoneY = bottom + (zone.order < PROCESS_ZONES.length - 1 ? phaseGap : 0)
  }

  return { rows: allRows, zoneBands }
}

function laneColumnLeft(laneOrder: number, metrics: OverviewVerticalMetrics): number {
  return metrics.zoneLabelColumnWidth + (laneOrder - 1) * metrics.laneColumnWidth
}

function laneCenterX(laneOrder: number, nodeWidth: number, metrics: OverviewVerticalMetrics): number {
  const columnLeft = laneColumnLeft(laneOrder, metrics)
  const innerWidth = metrics.laneColumnWidth - metrics.laneContentPaddingX * 2
  return columnLeft + metrics.laneContentPaddingX + (innerWidth - nodeWidth) / 2
}

export function placeOverviewProcessRowNodes(
  process: Process,
  nodes: Node[],
  assignments: Map<string, OverviewZoneAssignment>,
  rows: RowMeta[],
  metrics: OverviewVerticalMetrics,
): PlacedNode[] {
  const sortedLanes = [...process.lanes].sort((a, b) => a.order - b.order)
  const rowMap = new Map(rows.map((r) => [r.key, r]))
  const placed: PlacedNode[] = []

  const groups = new Map<string, Node[]>()
  for (const node of nodes) {
    const assignment = assignments.get(node.id)
    if (!assignment) continue
    const { zoneId, zoneOrder } = resolveNodeZone(node)
    const row = rowMap.get(processRowKey(zoneId, zoneOrder))
    if (!row) continue
    const key = laneRowGroupKey(node.laneId, row.key)
    const list = groups.get(key) ?? []
    list.push(node)
    groups.set(key, list)
  }

  for (const [key, groupNodes] of groups) {
    const { laneId } = parseLaneRowGroupKey(key)
    const lane = sortedLanes.find((l) => l.id === laneId)
    if (!lane) continue

    const first = groupNodes[0]
    const { zoneId, zoneOrder } = resolveNodeZone(first)
    const row = rowMap.get(processRowKey(zoneId, zoneOrder))
    if (!row) continue

    groupNodes.sort((a, b) => {
      const sa = assignments.get(a.id)?.laneSlot ?? 0
      const sb = assignments.get(b.id)?.laneSlot ?? 0
      return sa - sb || a.id.localeCompare(b.id)
    })

    // 같은 lane+row에 2개 이상 → 항상 세로 stack (과밀 방지)
    if (groupNodes.length === 1) {
      const node = groupNodes[0]
      const sized = getOverviewNodeSize(node.type, metrics, node.name)
      placed.push({
        id: node.id,
        laneId: node.laneId,
        x: laneCenterX(lane.order, sized.width, metrics),
        y: row.y + (row.height - sized.height) / 2,
        width: sized.width,
        height: sized.height,
      })
      continue
    }

    const stackHeight = groupNodes.reduce((sum, node, index) => {
      const h = getOverviewNodeSize(node.type, metrics, node.name).height
      return sum + h + (index > 0 ? metrics.nodeGapY : 0)
    }, 0)
    let stackY = row.y + (row.height - stackHeight) / 2

    for (const node of groupNodes) {
      const sized = getOverviewNodeSize(node.type, metrics, node.name)
      placed.push({
        id: node.id,
        laneId: node.laneId,
        x: laneCenterX(lane.order, sized.width, metrics),
        y: stackY,
        width: sized.width,
        height: sized.height,
      })
      stackY += sized.height + metrics.nodeGapY
    }
  }

  return placed
}

/** collision 보정 후 row height 재계산 + 노드 Y reflow */
export function reflowProcessRowsAfterCollision(
  rows: RowMeta[],
  placed: PlacedNode[],
  nodes: Node[],
  edges: Edge[],
  metrics: OverviewVerticalMetrics,
): { rows: RowMeta[]; placed: PlacedNode[] } {
  const nodeById = new Map(nodes.map((n) => [n.id, n]))
  const placedMap = new Map(placed.map((p) => [p.id, { ...p }]))
  const rowMap = new Map(rows.map((r) => [r.key, { ...r }]))

  for (const zone of PROCESS_ZONES) {
    const zoneRows = rows
      .filter((r) => r.zoneId === zone.id)
      .sort((a, b) => a.zoneOrder - b.zoneOrder)

    if (zoneRows.length === 0) continue
    let cursorY = zoneRows[0].y

    for (let i = 0; i < zoneRows.length; i++) {
      const row = rowMap.get(zoneRows[i].key)!
      const inRow = [...placedMap.values()].filter((p) => {
        const n = nodeById.get(p.id)
        if (!n) return false
        const z = resolveNodeZone(n)
        return z.zoneId === row.zoneId && z.zoneOrder === row.zoneOrder
      })

      let contentSpan = metrics.nodeHeight
      if (inRow.length > 0) {
        const minY = Math.min(...inRow.map((p) => p.y))
        const maxY = Math.max(...inRow.map((p) => p.y + p.height))
        contentSpan = Math.max(maxY - minY, ...inRow.map((p) => p.height))
      }

      const allowance = rowRoutingAllowance(row, metrics)
      const newHeight = contentSpan + metrics.nodeGapY + allowance
      const yDelta = cursorY - row.y

      row.y = cursorY
      row.height = newHeight

      for (const p of inRow) {
        placedMap.set(p.id, { ...p, y: p.y + yDelta })
      }

      const nextRow = zoneRows[i + 1] ? rowMap.get(zoneRows[i + 1].key)! : null
      const gap = nextRow ? rowGapBetween(row, nextRow, nodes, edges, metrics) : 0
      cursorY = row.y + row.height + gap
    }
  }

  return { rows: [...rowMap.values()], placed: [...placedMap.values()] }
}

function nodeCenterY(node: PlacedNode): number {
  return node.y + node.height / 2
}

export function alignCrossLaneRows(
  placed: PlacedNode[],
  edges: Edge[],
  process: Process,
  metrics: OverviewVerticalMetrics,
): PlacedNode[] {
  const placedMap = new Map(placed.map((n) => [n.id, { ...n }]))
  const nodeById = new Map(process.nodes.map((n) => [n.id, n]))

  for (const edge of edges) {
    const source = placedMap.get(edge.source)
    const target = placedMap.get(edge.target)
    const sourceNode = nodeById.get(edge.source)
    const targetNode = nodeById.get(edge.target)
    if (!source || !target || !sourceNode || !targetNode) continue
    if (source.laneId === target.laneId) continue

    const sz = resolveNodeZone(sourceNode)
    const tz = resolveNodeZone(targetNode)
    if (sz.zoneId !== tz.zoneId) continue

    const diff = Math.abs(nodeCenterY(source) - nodeCenterY(target))
    if (diff <= metrics.maxYDiff) continue

    const avg = (nodeCenterY(source) + nodeCenterY(target)) / 2
    const others = [...placedMap.values()]

    for (const id of [edge.source, edge.target]) {
      const p = placedMap.get(id)!
      const n = nodeById.get(id)!
      const size = getOverviewNodeSize(n.type, metrics, n.name)
      const newY = avg - size.height / 2
      if (wouldOverlapAtY(p, newY, others.filter((o) => o.id !== id), p.id, metrics)) {
        continue
      }
      const updated = trySetNodeY(p, newY, others.filter((o) => o.id !== id), metrics)
      if (updated) placedMap.set(id, updated)
    }
  }

  return [...placedMap.values()]
}

export function recomputeZoneBandsFromPlaced(
  placed: PlacedNode[],
  nodes: Node[],
  contentTop: number,
  metrics: OverviewVerticalMetrics,
): ZoneLayoutBand[] {
  const phaseGap = metrics.phaseGap ?? metrics.zoneGap
  const zoneBands: ZoneLayoutBand[] = []
  let zoneY = contentTop

  for (const zone of PROCESS_ZONES) {
    const zoneNodeIds = new Set(
      nodes.filter((n) => resolveNodeZone(n).zoneId === zone.id).map((n) => n.id),
    )
    const inZone = placed.filter((p) => zoneNodeIds.has(p.id))
    const minY = inZone.length > 0 ? Math.min(...inZone.map((p) => p.y)) - metrics.zonePaddingY : zoneY
    const maxY =
      inZone.length > 0
        ? Math.max(...inZone.map((p) => p.y + p.height)) + metrics.zonePaddingY + metrics.edgeRoutingAllowance
        : zoneY + metrics.minZoneHeight

    const y = inZone.length > 0 ? Math.min(zoneY, minY) : zoneY
    const height = Math.max(maxY - y, metrics.minZoneHeight)
    const bottom = y + height

    zoneBands.push({
      zoneId: zone.id,
      label: zone.label,
      y,
      height,
      bottom,
      gapConnectorY: zone.order < PROCESS_ZONES.length - 1 ? bottom + phaseGap / 2 : bottom,
    })

    zoneY = bottom + (zone.order < PROCESS_ZONES.length - 1 ? phaseGap : 0)
  }

  return zoneBands
}

export function realignForLongEdges(
  placed: PlacedNode[],
  edges: Edge[],
  process: Process,
  metrics: OverviewVerticalMetrics,
  pathLengthOf: (edgeId: string) => number,
): PlacedNode[] {
  let current = placed
  for (const edge of edges) {
    if (pathLengthOf(edge.id) < metrics.maxEdgeLength) continue
    current = alignCrossLaneRows(current, [edge], process, metrics)
  }
  return current
}
