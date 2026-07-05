import type { Edge, EdgeHandleId, Process } from '../../types/process'
import { isReturnEdgeType, resolveEdgeType } from '../../types/edgeTypes'
import { resolveEdgeSourceHandle, resolveEdgeTargetHandle, hasUserSpecifiedHandles } from '../editor/edgeHandles'
import { getDecisionDiamondVertex, isBranchNodeType, isDecisionNodeType } from './decisionAnchors'
import { DECISION_NODE_LAYOUT } from './decisionNodeSpec'
import { inferDecisionOutgoingPair, isDecisionSameColumn } from './decisionNodeLayout'
import { classifyBranchPolarity } from './edgeBranchRouting'
import type { PlacedNode } from './laneLayout'

export type Point = { x: number; y: number }

/** N/반려 — 같은 행·왼쪽 target으로 되돌아갈 때 아래로 내린 뒤 좌회전 */
export const DECISION_SAME_ROW_RETURN_DROP = 36

export type BracketSide = 'right' | 'left'

export const SAME_LANE_BRACKET_OFFSET = 32
const PARALLEL_OFFSET_STEP = 14
/** orthogonalEdgeRouter APPROACH_MIN_LEG 과 동일 — target handle 접근 stub */
const BRACKET_TARGET_APPROACH = 16

const RETURN_TOKENS = ['n', 'no', 'false', 'reject', 'rejected', '반려'] as const

function normalizeToken(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, '')
}

function nodeCenterY(node: PlacedNode): number {
  return node.y + node.height / 2
}

function anchorAt(node: PlacedNode, handle: EdgeHandleId, nodeType?: string): { x: number; y: number } {
  if (isDecisionNodeType(nodeType)) {
    return getDecisionDiamondVertex(node, handle)
  }

  const cx = node.x + node.width / 2
  const cy = node.y + node.height / 2
  switch (handle) {
    case 'top':
      return { x: cx, y: node.y }
    case 'bottom':
      return { x: cx, y: node.y + node.height }
    case 'left':
      return { x: node.x, y: cy }
    case 'right':
      return { x: node.x + node.width, y: cy }
  }
}

export function isReturnLikeEdge(edge: Edge): boolean {
  const edgeType = resolveEdgeType(edge)
  if (isReturnEdgeType(edgeType)) return true

  const raw = `${edge.condition ?? ''} ${edge.label ?? ''}`.trim()
  if (!raw) return false
  const normalized = normalizeToken(raw)
  const compact = raw.replace(/\s+/g, '')

  for (const token of RETURN_TOKENS) {
    if (normalized === normalizeToken(token) || normalized.includes(normalizeToken(token))) {
      return true
    }
    if (compact.toLowerCase() === token) return true
  }

  const cond = edge.condition?.trim().toLowerCase() ?? ''
  return cond === 'rejected' || cond === 'reject'
}

export function sharesLaneOrProcessArea(
  source: PlacedNode,
  target: PlacedNode,
  process?: Process,
): boolean {
  if (source.laneId === target.laneId) return true
  if (!process) return false
  const s = process.nodes.find((n) => n.id === source.id)
  const t = process.nodes.find((n) => n.id === target.id)
  return Boolean(s?.processZone && t?.processZone && s.processZone === t.processZone)
}

/** Same lane/area · target above source · N/반려/return 분기 → [ bracket */
export function qualifiesForSameLaneBracketReturn(
  edge: Edge,
  source: PlacedNode,
  target: PlacedNode,
  process?: Process,
): boolean {
  if (nodeCenterY(target) >= nodeCenterY(source) - 4) return false
  if (!isReturnLikeEdge(edge)) return false
  return sharesLaneOrProcessArea(source, target, process)
}

/** 같은 lane/area · target이 source 아래 · 좌/우 bracket handle (right→right 등) */
export function qualifiesForSameLaneVerticalSideBracket(
  source: PlacedNode,
  target: PlacedNode,
  sourceHandle: EdgeHandleId,
  targetHandle: EdgeHandleId,
  process?: Process,
): boolean {
  if (sourceHandle !== targetHandle) return false
  if (sourceHandle !== 'right' && sourceHandle !== 'left') return false
  if (target.y + target.height * 0.2 <= source.y + source.height) return false
  return sharesLaneOrProcessArea(source, target, process)
}

/** target 아래 · same-side handle — 1-bend L (수직 → 수평) */
export function buildSameLaneVerticalOneBendPath(
  source: PlacedNode,
  target: PlacedNode,
  sourceHandle: EdgeHandleId,
  targetHandle: EdgeHandleId,
  sourceType?: string,
  targetType?: string,
): { x: number; y: number }[] {
  const start = anchorAt(source, sourceHandle, sourceType)
  const end = anchorAt(target, targetHandle, targetType)
  if (Math.abs(start.y - end.y) <= 4) {
    return [start, end]
  }
  return [start, { x: start.x, y: end.y }, end]
}

/** same lane/area · source side handle → target top · target 아래 — 1-bend L (수평 → 수직) */
export function qualifiesForSameLaneSideTopOneBend(
  source: PlacedNode,
  target: PlacedNode,
  sourceHandle: EdgeHandleId,
  targetHandle: EdgeHandleId,
  process?: Process,
): boolean {
  if (targetHandle !== 'top') return false
  if (sourceHandle !== 'right' && sourceHandle !== 'left') return false
  if (target.y + target.height * 0.2 <= source.y + source.height) return false
  return sharesLaneOrProcessArea(source, target, process)
}

export function buildSameLaneSideTopOneBendPath(
  source: PlacedNode,
  target: PlacedNode,
  sourceHandle: EdgeHandleId,
  sourceType?: string,
  targetType?: string,
): { x: number; y: number }[] {
  const start = anchorAt(source, sourceHandle, sourceType)
  const end = anchorAt(target, 'top', targetType)
  if (Math.abs(start.y - end.y) <= 4) {
    return [start, end]
  }
  if (Math.abs(start.x - end.x) <= 4) {
    return [start, end]
  }
  return [start, { x: end.x, y: start.y }, end]
}

type BracketClearanceOptions = {
  placed?: PlacedNode[]
  excludeIds?: Set<string>
  nodePadding?: number
  spanMinY?: number
  spanMaxY?: number
  process?: Process
}

function nodeClearanceXBounds(
  node: PlacedNode,
  process?: Process,
): { left: number; right: number } {
  const nodeType = process?.nodes.find((entry) => entry.id === node.id)?.type
  const extra = isBranchNodeType(nodeType) ? DECISION_NODE_LAYOUT.exclusionPadding : 0
  return { left: node.x - extra, right: node.x + node.width + extra }
}

function targetApproachPrePoint(end: Point, targetHandle: EdgeHandleId): Point {
  switch (targetHandle) {
    case 'right':
      return { x: end.x + BRACKET_TARGET_APPROACH, y: end.y }
    case 'left':
      return { x: end.x - BRACKET_TARGET_APPROACH, y: end.y }
    case 'top':
      return { x: end.x, y: end.y - BRACKET_TARGET_APPROACH }
    case 'bottom':
      return { x: end.x, y: end.y + BRACKET_TARGET_APPROACH }
  }
}

function horizontalSegmentBlocksNode(
  y: number,
  x1: number,
  x2: number,
  placed: PlacedNode[],
  excludeIds: Set<string> | undefined,
  nodePadding: number,
): boolean {
  const minX = Math.min(x1, x2)
  const maxX = Math.max(x1, x2)
  return placed.some((node) => {
    if (excludeIds?.has(node.id)) return false
    return (
      y + nodePadding >= node.y &&
      y - nodePadding <= node.y + node.height &&
      node.x + node.width + nodePadding > minX &&
      node.x - nodePadding < maxX
    )
  })
}

/** Same-row top return — corridor above/below node body is clear horizontally */
function horizontalCorridorCrossesNodeBody(
  y: number,
  x1: number,
  x2: number,
  placed: PlacedNode[],
  excludeIds: Set<string> | undefined,
  nodePadding: number,
): boolean {
  const minX = Math.min(x1, x2)
  const maxX = Math.max(x1, x2)
  return placed.some((node) => {
    if (excludeIds?.has(node.id)) return false
    if (y < node.y || y > node.y + node.height) return false
    return (
      node.x + node.width + nodePadding > minX &&
      node.x - nodePadding < maxX
    )
  })
}

/** 최종 수평 접근 구간이 obstacle과 겹치면 그 위쪽 corridor Y */
function resolveBracketFinalCorridorY(
  offsetX: number,
  endX: number,
  endY: number,
  startY: number,
  placed: PlacedNode[],
  excludeIds: Set<string> | undefined,
  nodePadding: number,
): number {
  if (!horizontalSegmentBlocksNode(endY, offsetX, endX, placed, excludeIds, nodePadding)) {
    return endY
  }

  let corridorY = endY
  for (let i = 0; i < 12; i++) {
    const minX = Math.min(offsetX, endX)
    const maxX = Math.max(offsetX, endX)
    let nextY = corridorY

    for (const node of placed) {
      if (excludeIds?.has(node.id)) continue
      if (
        corridorY + nodePadding >= node.y &&
        corridorY - nodePadding <= node.y + node.height &&
        node.x + node.width + nodePadding > minX &&
        node.x - nodePadding < maxX
      ) {
        nextY = Math.min(nextY, node.y - nodePadding - 8)
      }
    }

    if (nextY >= corridorY - 1) {
      corridorY -= 24
    } else {
      corridorY = nextY
    }

    if (!horizontalSegmentBlocksNode(corridorY, offsetX, endX, placed, excludeIds, nodePadding)) {
      return Math.max(corridorY, startY + 16)
    }
  }

  return endY
}

/** bracket 수직 구간이 중간 노드를 피하도록 offset 확장 */
function resolveObstacleClearanceOffsetX(
  side: BracketSide,
  baseOffsetX: number,
  options: BracketClearanceOptions = {},
): number {
  const { placed, excludeIds, nodePadding = 20, spanMinY, spanMaxY, process } = options
  if (!placed?.length || spanMinY == null || spanMaxY == null) return baseOffsetX

  const minY = Math.min(spanMinY, spanMaxY)
  const maxY = Math.max(spanMinY, spanMaxY)
  let offsetX = baseOffsetX
  let changed = true

  while (changed) {
    changed = false
    for (const node of placed) {
      if (excludeIds?.has(node.id)) continue
      if (node.y + node.height + nodePadding <= minY || node.y - nodePadding >= maxY) continue
      const bounds = nodeClearanceXBounds(node, process)

      if (side === 'right') {
        if (
          offsetX + nodePadding >= bounds.left &&
          offsetX - nodePadding <= bounds.right
        ) {
          const needed = bounds.right + nodePadding * 2 + 8
          if (needed > offsetX) {
            offsetX = needed
            changed = true
          }
        }
      } else if (
        offsetX + nodePadding >= bounds.left &&
        offsetX - nodePadding <= bounds.right
      ) {
        const needed = bounds.left - nodePadding * 2 - 8
        if (needed < offsetX) {
          offsetX = needed
          changed = true
        }
      }
    }
  }

  return offsetX
}

/** Decision N/반려 — target이 같은 행·왼쪽 (직선 bottom→bottom 방지) */
export function qualifiesForDecisionSameRowLeftReturn(
  edge: Edge,
  source: PlacedNode,
  target: PlacedNode,
  process?: Process,
): boolean {
  if (!isReturnLikeEdge(edge)) return false
  const sourceType = process?.nodes.find((n) => n.id === source.id)?.type
  if (!isBranchNodeType(sourceType)) return false
  const scx = source.x + source.width / 2
  const tcx = target.x + target.width / 2
  if (tcx >= scx - 12) return false
  const sBottom = anchorAt(source, 'bottom', sourceType).y
  const tBottom = anchorAt(target, 'bottom').y
  return Math.abs(sBottom - tBottom) <= 56
}

/** Decision N/반려 — target이 같은 행·왼쪽 · top→top (위쪽 [ bracket) */
export function qualifiesForDecisionSameRowTopReturn(
  edge: Edge,
  source: PlacedNode,
  target: PlacedNode,
  process?: Process,
): boolean {
  if (!isReturnLikeEdge(edge)) return false
  const sourceType = process?.nodes.find((n) => n.id === source.id)?.type
  if (!isBranchNodeType(sourceType)) return false
  const scx = source.x + source.width / 2
  const tcx = target.x + target.width / 2
  if (tcx >= scx - 12) return false
  const sTop = getDecisionDiamondVertex(source, 'top').y
  const tTop = anchorAt(target, 'top').y
  return Math.abs(sTop - tTop) <= 56
}

/** N 반려 가로 구간 중앙 아래 — PDF처럼 선 아래 라벨 */
export function decisionSameRowReturnLabelPoint(points: Point[]): Point | null {
  if (points.length < 2) return null

  let best: { midX: number; y: number; len: number } | null = null
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!
    const b = points[i + 1]!
    if (Math.abs(a.y - b.y) > 1) continue
    const len = Math.abs(a.x - b.x)
    if (len < 24) continue
    const y = a.y
    const midX = (a.x + b.x) / 2
    if (!best || y > best.y || (Math.abs(y - best.y) < 1 && len > best.len)) {
      best = { midX, y, len }
    }
  }

  if (!best) return null
  return { x: best.midX, y: best.y + 14 }
}

/** 1회 꺾임(↓ → ←) 후 target bottom 접속 — 같은 행 N 반려 */
export function buildDecisionSameRowLeftReturnPath(
  source: PlacedNode,
  target: PlacedNode,
): { points: Point[]; sourceHandle: EdgeHandleId; targetHandle: EdgeHandleId } {
  const start = getDecisionDiamondVertex(source, 'bottom')
  const end = anchorAt(target, 'bottom')
  const yRun = start.y + DECISION_SAME_ROW_RETURN_DROP
  return {
    sourceHandle: 'bottom',
    targetHandle: 'bottom',
    points: [start, { x: start.x, y: yRun }, { x: end.x, y: yRun }, end],
  }
}

/** Target column right edge — same-row obstacles to the right cap splitX */
function resolveSameRowTopReturnSplitX(
  target: PlacedNode,
  endY: number,
  placed: PlacedNode[],
  excludeIds: Set<string>,
  nodePadding: number,
): number {
  let splitX = target.x + target.width + Math.min(nodePadding, 8)
  for (const node of placed) {
    if (excludeIds.has(node.id)) continue
    if (node.id === target.id) continue
    if (
      endY + nodePadding >= node.y &&
      endY - nodePadding <= node.y + node.height
    ) {
      const nodeLeft = node.x
      if (nodeLeft > target.x + target.width - 4) {
        splitX = Math.min(splitX, nodeLeft - nodePadding)
      }
    }
  }
  return splitX
}

/** 1회 꺾임(↑ → ←) 후 target top 접속 — 같은 행 N 반려 top/top */
export function buildDecisionSameRowTopReturnPath(
  source: PlacedNode,
  target: PlacedNode,
  targetType?: string,
  clearance: BracketClearanceOptions = {},
): { points: Point[]; sourceHandle: EdgeHandleId; targetHandle: EdgeHandleId } {
  const start = getDecisionDiamondVertex(source, 'top')
  const end = anchorAt(target, 'top', targetType)
  const approach = targetApproachPrePoint(end, 'top')
  const placed = clearance.placed ?? []
  const excludeIds = clearance.excludeIds ?? new Set<string>()
  const nodePadding = clearance.nodePadding ?? 20

  const splitX = resolveSameRowTopReturnSplitX(target, end.y, placed, excludeIds, nodePadding)
  const horizontalClear = (y: number, x1: number, x2: number): boolean =>
    !horizontalCorridorCrossesNodeBody(y, x1, x2, placed, excludeIds, nodePadding)

  for (let lift = 8; lift <= 120; lift += 4) {
    const corridorY = start.y - lift
    if (corridorY >= end.y) continue

    if (horizontalClear(corridorY, start.x, end.x)) {
      return {
        sourceHandle: 'top',
        targetHandle: 'top',
        points: [
          start,
          { x: start.x, y: corridorY },
          { x: end.x, y: corridorY },
          end,
        ],
      }
    }
  }

  if (splitX < start.x - 4 && splitX > end.x + 4) {
    for (let lift = 8; lift <= 120; lift += 4) {
      const corridorY = start.y - lift
      if (corridorY >= end.y) continue
      if (
        horizontalClear(corridorY, start.x, splitX) &&
        horizontalClear(corridorY, splitX, end.x)
      ) {
        return {
          sourceHandle: 'top',
          targetHandle: 'top',
          points: [
            start,
            { x: start.x, y: corridorY },
            { x: splitX, y: corridorY },
            { x: end.x, y: corridorY },
            end,
          ],
        }
      }
    }
  }

  const fallbackY = start.y - DECISION_SAME_ROW_RETURN_DROP
  return {
    sourceHandle: 'top',
    targetHandle: 'top',
    points: [start, { x: start.x, y: fallbackY }, { x: end.x, y: fallbackY }, approach, end],
  }
}

/** Decision right 출발 · target 아래 → ] bracket (단, right→left 단거리는 제외) */
export function qualifiesForDecisionRightDownBracket(
  edge: Edge,
  source: PlacedNode,
  target: PlacedNode,
  process?: Process,
): boolean {
  const sourceType = process?.nodes.find((n) => n.id === source.id)?.type
  if (!isBranchNodeType(sourceType)) return false
  if (nodeCenterY(target) <= nodeCenterY(source) + 4) return false

  const sh = resolveEdgeSourceHandle(edge)
  const th = resolveEdgeTargetHandle(edge)

  /** 명시 right→left + target이 오른쪽 — bracket/detour 금지 */
  if (sh === 'right' && (th === 'left' || th === undefined)) {
    const tcx = target.x + target.width / 2
    const scx = source.x + source.width / 2
    if (tcx > scx - 20) return false
  }

  /** target이 source 왼쪽·아래 — bottom→top 직하향, ] bracket 금지 */
  const scx = source.x + source.width / 2
  const tcx = target.x + target.width / 2
  if (tcx < scx - 20 && nodeCenterY(target) > nodeCenterY(source) + 4) return false

  if (hasUserSpecifiedHandles(edge)) {
    if (sh && sh !== 'right') return false
    if (th === 'left') return false
  }

  const [inferredSh, inferredTh] = inferDecisionOutgoingPair(source, target, edge)
  if (inferredSh !== 'right') return false
  if (inferredTh === 'top' && isDecisionSameColumn(source, target)) return false
  if (inferredTh === 'left') return false

  return true
}

function bracketOffsetX(
  source: PlacedNode,
  target: PlacedNode,
  sourceHandle: EdgeHandleId,
  targetHandle: EdgeHandleId,
  side: BracketSide,
  sourceType: string | undefined,
  targetType: string | undefined,
  parallelIndex: number,
  clearance: BracketClearanceOptions = {},
): number {
  const start = anchorAt(source, sourceHandle, sourceType)
  const end = anchorAt(target, targetHandle, targetType)
  const spanMinY = clearance.spanMinY ?? start.y
  const spanMaxY = clearance.spanMaxY ?? end.y
  const base = side === 'right'
    ? Math.max(start.x, end.x) + SAME_LANE_BRACKET_OFFSET + Math.abs(parallelIndex) * PARALLEL_OFFSET_STEP
    : Math.min(start.x, end.x) - SAME_LANE_BRACKET_OFFSET - Math.abs(parallelIndex) * PARALLEL_OFFSET_STEP
  return resolveObstacleClearanceOffsetX(side, base, {
    ...clearance,
    spanMinY,
    spanMaxY,
  })
}

function verticalSegmentBlocks(
  x: number,
  y1: number,
  y2: number,
  placed: PlacedNode[],
  excludeIds: Set<string>,
  padding = 20,
  process?: Process,
): boolean {
  const minY = Math.min(y1, y2)
  const maxY = Math.max(y1, y2)

  return placed.some((node) => {
    if (excludeIds.has(node.id)) return false
    const bounds = nodeClearanceXBounds(node, process)
    return (
      x + padding >= bounds.left &&
      x - padding <= bounds.right &&
      node.y + node.height + padding > minY &&
      node.y - padding < maxY
    )
  })
}

export function pickBracketSide(
  source: PlacedNode,
  target: PlacedNode,
  placed: PlacedNode[],
  excludeIds: Set<string>,
  minContentX: number,
  parallelIndex = 0,
  sourceType?: string,
  targetType?: string,
  process?: Process,
): BracketSide {
  const trySide = (side: BracketSide): boolean => {
    const handle = side === 'right' ? 'right' : 'left'
    const path = buildSameLaneBracketPath(
      source,
      target,
      handle,
      handle,
      sourceType,
      targetType,
      side,
      parallelIndex,
      { placed, excludeIds, nodePadding: 20, process },
    )
    const offsetX = path[1].x
    if (side === 'left' && offsetX < minContentX) return false
    return !verticalSegmentBlocks(offsetX, path[0].y, path[path.length - 1].y, placed, excludeIds, 20, process)
  }

  if (trySide('right')) return 'right'
  if (trySide('left')) return 'left'
  return 'right'
}

/** target이 source 위 — compact ]/[ bracket (2 bend) */
function isCompactUpwardBracketPathClear(
  points: Point[],
  offsetX: number,
  placed: PlacedNode[],
  excludeIds: Set<string> | undefined,
  nodePadding: number,
  process?: Process,
): boolean {
  if (points.length < 4) return false
  const start = points[0]!
  const end = points[points.length - 1]!
  if (verticalSegmentBlocks(offsetX, start.y, end.y, placed, excludeIds ?? new Set(), nodePadding, process)) {
    return false
  }
  if (horizontalSegmentBlocksNode(start.y, start.x, offsetX, placed, excludeIds, nodePadding)) {
    return false
  }
  if (horizontalSegmentBlocksNode(end.y, offsetX, end.x, placed, excludeIds, nodePadding)) {
    return false
  }
  return true
}

/** ] 또는 [ 모양 — target handle 접근 방향(수평)까지 포함 */
export function buildSameLaneBracketPath(
  source: PlacedNode,
  target: PlacedNode,
  sourceHandle: EdgeHandleId,
  targetHandle: EdgeHandleId,
  sourceType: string | undefined,
  targetType: string | undefined,
  side: BracketSide,
  parallelIndex = 0,
  clearance: BracketClearanceOptions = {},
): { x: number; y: number }[] {
  const start = anchorAt(source, sourceHandle, sourceType)
  const end = anchorAt(target, targetHandle, targetType)
  const approach = targetApproachPrePoint(end, targetHandle)
  const placed = clearance.placed ?? []
  const excludeIds = clearance.excludeIds
  const nodePadding = clearance.nodePadding ?? 20

  // 판단 N/반려 등 위로 되돌아가는 return — 충돌 없으면 2-bend compact bracket
  if (end.y < start.y - 4 && (targetHandle === 'right' || targetHandle === 'left')) {
    const offsetX = bracketOffsetX(
      source,
      target,
      sourceHandle,
      targetHandle,
      side,
      sourceType,
      targetType,
      parallelIndex,
      { ...clearance, spanMinY: end.y, spanMaxY: start.y },
    )
    const compact = [start, { x: offsetX, y: start.y }, { x: offsetX, y: end.y }, end]
    if (
      !placed.length ||
      isCompactUpwardBracketPathClear(compact, offsetX, placed, excludeIds, nodePadding, clearance.process)
    ) {
      return compact
    }
  }

  let corridorY = end.y
  let offsetX = bracketOffsetX(
    source,
    target,
    sourceHandle,
    targetHandle,
    side,
    sourceType,
    targetType,
    parallelIndex,
    { ...clearance, spanMinY: start.y, spanMaxY: corridorY },
  )

  if (
    placed.length > 0 &&
    (targetHandle === 'right' || targetHandle === 'left') &&
    horizontalSegmentBlocksNode(corridorY, offsetX, approach.x, placed, excludeIds, nodePadding)
  ) {
    corridorY = resolveBracketFinalCorridorY(
      offsetX,
      approach.x,
      end.y,
      start.y,
      placed,
      excludeIds,
      nodePadding,
    )
    if (corridorY < end.y - 4) {
      offsetX = bracketOffsetX(
        source,
        target,
        sourceHandle,
        targetHandle,
        side,
        sourceType,
        targetType,
        parallelIndex,
        { ...clearance, spanMinY: start.y, spanMaxY: corridorY },
      )
    }
  }

  if (Math.abs(corridorY - end.y) <= 4) {
    // finalizeRoutedPath → applyArrowMarkerEndpoints adds target approach when needed
    return [start, { x: offsetX, y: start.y }, { x: offsetX, y: end.y }, end]
  }

  return [
    start,
    { x: offsetX, y: start.y },
    { x: offsetX, y: corridorY },
    { x: approach.x, y: corridorY },
    { x: approach.x, y: end.y },
    end,
  ]
}

/** 기존 분기 등 negative (non-return) — polarity 확인용 */
export function isExistingFlowEdge(edge: Edge): boolean {
  if (isReturnLikeEdge(edge)) return false
  const polarity = classifyBranchPolarity(edge)
  return polarity === 'negative'
}
