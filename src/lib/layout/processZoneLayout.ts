import type { Node as FlowNode } from '@xyflow/react'
import type { Process, ProcessZone, ProcessZoneStyle } from '../../types/process'

export const DEFAULT_ZONE_PADDING_X = 24
export const DEFAULT_ZONE_HEADER_HEIGHT = 36
export const DEFAULT_ZONE_PADDING_BOTTOM = 32
/** @deprecated use DEFAULT_ZONE_PADDING_BOTTOM */
export const DEFAULT_ZONE_PADDING_Y = 24

/** Zone border와 외부 node 사이 최소 간격 — layout 이동 없이 zone bbox만 조정 */
export const MIN_ZONE_NODE_GAP = 40

/** @deprecated use DEFAULT_ZONE_PADDING_X / HEADER / BOTTOM */
export const PROCESS_ZONE_PADDING = {
  top: DEFAULT_ZONE_HEADER_HEIGHT,
  bottom: DEFAULT_ZONE_PADDING_BOTTOM,
  left: DEFAULT_ZONE_PADDING_X,
  right: DEFAULT_ZONE_PADDING_X,
} as const

export const DEFAULT_ZONE_STYLE: Required<
  Pick<
    ProcessZoneStyle,
    'showBackground' | 'showBorder' | 'borderStyle' | 'visible' | 'opacity' | 'fill' | 'stroke'
  >
> = {
  showBackground: true,
  showBorder: true,
  borderStyle: 'dashed',
  visible: true,
  opacity: 0.12,
  fill: '#94a3b8',
  stroke: '#64748b',
}

export type ProcessZoneRect = {
  zoneId: string
  name: string
  x: number
  y: number
  width: number
  height: number
  style: typeof DEFAULT_ZONE_STYLE
}

export function resolveZoneStyle(zone: ProcessZone): typeof DEFAULT_ZONE_STYLE {
  return {
    showBackground: zone.style.showBackground ?? DEFAULT_ZONE_STYLE.showBackground,
    showBorder: zone.style.showBorder ?? DEFAULT_ZONE_STYLE.showBorder,
    borderStyle: zone.style.borderStyle ?? DEFAULT_ZONE_STYLE.borderStyle,
    visible: zone.style.visible ?? DEFAULT_ZONE_STYLE.visible,
    opacity: zone.style.opacity ?? DEFAULT_ZONE_STYLE.opacity,
    fill: zone.style.fill ?? DEFAULT_ZONE_STYLE.fill,
    stroke: zone.style.stroke ?? DEFAULT_ZONE_STYLE.stroke,
  }
}

export function resolveZonePadding(zone: ProcessZone): {
  paddingX: number
  headerHeight: number
  paddingBottom: number
} {
  const legacyY = zone.style.paddingY
  return {
    paddingX: zone.style.paddingX ?? DEFAULT_ZONE_PADDING_X,
    headerHeight: zone.style.headerHeight ?? legacyY ?? DEFAULT_ZONE_HEADER_HEIGHT,
    paddingBottom: zone.style.paddingBottom ?? legacyY ?? DEFAULT_ZONE_PADDING_BOTTOM,
  }
}

function flowNodeBounds(flowNode: FlowNode): { x: number; y: number; width: number; height: number } {
  return {
    x: flowNode.position.x,
    y: flowNode.position.y,
    width: flowNode.width ?? flowNode.measured?.width ?? 160,
    height: flowNode.height ?? flowNode.measured?.height ?? 56,
  }
}

function rangesOverlap(aMin: number, aMax: number, bMin: number, bMax: number): boolean {
  return aMax > bMin && aMin < bMax
}

/**
 * 외부 node와 zone border 사이 MIN_ZONE_NODE_GAP 유지 — node 좌표는 변경하지 않음.
 * zone bottom/right만 clamp하여 border가 외부 node에 붙지 않게 한다.
 */
function clampZoneEdgesForExternalNodes(
  left: number,
  top: number,
  right: number,
  bottom: number,
  childMinX: number,
  childMinY: number,
  childMaxX: number,
  childMaxY: number,
  memberIds: Set<string>,
  flowNodes: FlowNode[],
  minGap: number = MIN_ZONE_NODE_GAP,
): { left: number; top: number; right: number; bottom: number } {
  let nextRight = right
  let nextBottom = bottom

  for (const flowNode of flowNodes) {
    if (memberIds.has(flowNode.id)) continue

    const { x, y, width, height } = flowNodeBounds(flowNode)
    const nodeRight = x + width
    const nodeBottom = y + height

    const hOverlap = rangesOverlap(left, nextRight, x, nodeRight)
    const vOverlap = rangesOverlap(top, nextBottom, y, nodeBottom)

    if (hOverlap && y >= childMaxY - 1) {
      nextBottom = Math.min(nextBottom, y - minGap)
    }

    if (vOverlap && x >= childMaxX - 1) {
      nextRight = Math.min(nextRight, x - minGap)
    }
  }

  nextBottom = Math.max(nextBottom, childMaxY + 8)
  nextRight = Math.max(nextRight, childMaxX + 8)
  const nextLeft = Math.min(left, childMinX - 8)
  const nextTop = Math.min(top, childMinY - 8)

  return {
    left: nextLeft,
    top: nextTop,
    right: Math.max(nextRight, nextLeft + 16),
    bottom: Math.max(nextBottom, nextTop + 16),
  }
}

/** zone.nodeIds + laneIds/phaseIds로 포함 노드 id 집합 — layout 계산에는 사용하지 않음 */
export function resolveZoneMemberNodeIds(process: Process, zone: ProcessZone): Set<string> {
  const ids = new Set<string>(zone.nodeIds)

  if (zone.laneIds.length > 0 || zone.phaseIds.length > 0) {
    for (const node of process.nodes) {
      if (node.type === 'phase-connector') continue
      const laneMatch = zone.laneIds.length === 0 || zone.laneIds.includes(node.laneId)
      const phaseMatch = zone.phaseIds.length === 0 || zone.phaseIds.includes(node.phaseId)
      if (laneMatch && phaseMatch) {
        ids.add(node.id)
      }
    }
  }

  return ids
}

/**
 * Node 배치 완료 후 visual grouping bbox — layout/obstacle/routing 대상 아님.
 *
 * 순서: node 배치 확정 → child bbox → padding → 외부 node gap clamp
 */
export function computeProcessZoneRects(
  process: Process,
  flowNodes: FlowNode[],
): ProcessZoneRect[] {
  const zones = process.zones ?? []
  if (zones.length === 0) return []

  const flowById = new Map(flowNodes.map((node) => [node.id, node]))
  const rects: ProcessZoneRect[] = []

  for (const zone of zones) {
    const style = resolveZoneStyle(zone)
    if (!style.visible) continue

    const memberIds = resolveZoneMemberNodeIds(process, zone)
    if (memberIds.size === 0) continue

    const { paddingX, headerHeight, paddingBottom } = resolveZonePadding(zone)

    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity

    for (const nodeId of memberIds) {
      const flowNode = flowById.get(nodeId)
      if (!flowNode) continue

      const { x, y, width, height } = flowNodeBounds(flowNode)

      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x + width)
      maxY = Math.max(maxY, y + height)
    }

    if (!Number.isFinite(minX)) continue

    let left = minX - paddingX
    let top = minY - headerHeight
    let right = maxX + paddingX
    let bottom = maxY + paddingBottom

    const clamped = clampZoneEdgesForExternalNodes(
      left,
      top,
      right,
      bottom,
      minX,
      minY,
      maxX,
      maxY,
      memberIds,
      flowNodes,
    )

    left = clamped.left
    top = clamped.top
    right = clamped.right
    bottom = clamped.bottom

    rects.push({
      zoneId: zone.id,
      name: zone.name,
      x: left,
      y: top,
      width: right - left,
      height: bottom - top,
      style,
    })
  }

  return rects
}

export function resolveZoneLabelY(rect: ProcessZoneRect, headerHeight = DEFAULT_ZONE_HEADER_HEIGHT): number {
  return rect.y + Math.min(headerHeight * 0.5, 18)
}
