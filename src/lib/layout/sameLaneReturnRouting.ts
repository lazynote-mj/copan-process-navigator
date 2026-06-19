import type { Edge, EdgeHandleId, Process } from '../../types/process'
import { isReturnEdgeType, resolveEdgeType } from '../../types/edgeTypes'
import { resolveEdgeSourceHandle, resolveEdgeTargetHandle, hasUserSpecifiedHandles } from '../editor/edgeHandles'
import { getDecisionDiamondVertex, isBranchNodeType, isDecisionNodeType } from './decisionAnchors'
import { inferDecisionOutgoingPair, isDecisionSameColumn } from './decisionNodeLayout'
import { classifyBranchPolarity } from './edgeBranchRouting'
import type { PlacedNode } from './laneLayout'

export type BracketSide = 'right' | 'left'

export const SAME_LANE_BRACKET_OFFSET = 32
const PARALLEL_OFFSET_STEP = 14

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

function sharesLaneOrProcessArea(
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
): number {
  const extra = Math.abs(parallelIndex) * PARALLEL_OFFSET_STEP
  if (side === 'right') {
    const sourceRight = anchorAt(source, sourceHandle, sourceType).x
    const targetRight = anchorAt(target, targetHandle, targetType).x
    return Math.max(sourceRight, targetRight) + SAME_LANE_BRACKET_OFFSET + extra
  }
  const sourceLeft = anchorAt(source, sourceHandle, sourceType).x
  const targetLeft = anchorAt(target, targetHandle, targetType).x
  return Math.min(sourceLeft, targetLeft) - SAME_LANE_BRACKET_OFFSET - extra
}

function verticalSegmentBlocks(
  x: number,
  y1: number,
  y2: number,
  placed: PlacedNode[],
  excludeIds: Set<string>,
  padding: number,
): boolean {
  const minY = Math.min(y1, y2)
  const maxY = Math.max(y1, y2)

  return placed.some((node) => {
    if (excludeIds.has(node.id)) return false
    return (
      x + padding >= node.x &&
      x - padding <= node.x + node.width &&
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
    )
    const offsetX = path[1].x
    if (side === 'left' && offsetX < minContentX) return false
    return !verticalSegmentBlocks(offsetX, path[0].y, path[path.length - 1].y, placed, excludeIds, 10)
  }

  if (trySide('right')) return 'right'
  if (trySide('left')) return 'left'
  return 'right'
}

/** ] 또는 [ 모양 — bend 2회 (4 vertex) */
export function buildSameLaneBracketPath(
  source: PlacedNode,
  target: PlacedNode,
  sourceHandle: EdgeHandleId,
  targetHandle: EdgeHandleId,
  sourceType: string | undefined,
  targetType: string | undefined,
  side: BracketSide,
  parallelIndex = 0,
): { x: number; y: number }[] {
  const start = anchorAt(source, sourceHandle, sourceType)
  const end = anchorAt(target, targetHandle, targetType)
  const offsetX = bracketOffsetX(
    source,
    target,
    sourceHandle,
    targetHandle,
    side,
    sourceType,
    targetType,
    parallelIndex,
  )

  return [start, { x: offsetX, y: start.y }, { x: offsetX, y: end.y }, end]
}

/** 기존 분기 등 negative (non-return) — polarity 확인용 */
export function isExistingFlowEdge(edge: Edge): boolean {
  if (isReturnLikeEdge(edge)) return false
  const polarity = classifyBranchPolarity(edge)
  return polarity === 'negative'
}
