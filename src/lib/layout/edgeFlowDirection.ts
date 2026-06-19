import type { Edge, EdgeHandleId } from '../../types/process'
import { isReturnEdgeType, resolveEdgeType } from '../../types/edgeTypes'
import type { EdgeBranchContext } from './edgeBranchRouting'
import type { PlacedNode } from './laneLayout'

export const FLOW_DIRECTION_PENALTY_SCALE = 250
const DEFAULT_NODE_HEIGHT = 44

function nodeCenter(node: PlacedNode): { x: number; y: number } {
  return { x: node.x + node.width / 2, y: node.y + node.height / 2 }
}

function handlePoint(node: PlacedNode, handle: EdgeHandleId): { x: number; y: number } {
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

export function allowsReverseFlow(edge: Edge): boolean {
  const raw = edge.type?.trim().toLowerCase()
  if (raw === 'feedback') return true
  return isReturnEdgeType(resolveEdgeType(edge))
}

export function flowRowThreshold(source: PlacedNode, target: PlacedNode): number {
  return Math.max(source.height, target.height, DEFAULT_NODE_HEIGHT)
}

export function isSameFlowRow(source: PlacedNode, target: PlacedNode): boolean {
  return Math.abs(source.y - target.y) < flowRowThreshold(source, target)
}

/** 업무 흐름 기준 source handle — 거리보다 sequence 방향 우선 */
export function inferFlowSourceSide(
  source: PlacedNode,
  target: PlacedNode,
  edge?: Edge,
): EdgeHandleId {
  const sc = nodeCenter(source)
  const tc = nodeCenter(target)
  const dx = tc.x - sc.x
  const dy = tc.y - sc.y
  const sameRow = isSameFlowRow(source, target)
  const allowsReverse = edge ? allowsReverseFlow(edge) : false

  if (allowsReverse && dy < -8) return 'top'
  if (sameRow && Math.abs(dx) >= 8) return dx >= 0 ? 'right' : 'left'
  if (dy > 8) return 'bottom'
  if (Math.abs(dx) > 20 && Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'right' : 'left'
  return 'bottom'
}

/** source handle에 맞는 target handle */
export function inferFlowTargetSide(
  source: PlacedNode,
  target: PlacedNode,
  sourceSide: EdgeHandleId,
  edge?: Edge,
): EdgeHandleId {
  const allowsReverse = edge ? allowsReverseFlow(edge) : false

  switch (sourceSide) {
    case 'bottom':
      return 'top'
    case 'top':
      return allowsReverse ? 'bottom' : 'top'
    case 'right':
      return 'left'
    case 'left':
      return 'right'
    default:
      return nodeCenter(target).y >= nodeCenter(source).y ? 'top' : 'bottom'
  }
}

/** Decision branch — target 위치에 따라 top/left 보정 (예외 분기는 우측 측면 우선) */
export function inferDecisionTargetSide(
  source: PlacedNode,
  target: PlacedNode,
  sourceSide: EdgeHandleId,
  edge?: Edge,
): EdgeHandleId {
  const dx = nodeCenter(target).x - nodeCenter(source).x
  const dy = nodeCenter(target).y - nodeCenter(source).y
  const isExceptionBranch = edge?.type === 'exception' || edge?.type === 'condition'

  if (sourceSide === 'right') {
    if (dx > 8 && Math.abs(dx) >= Math.abs(dy) * 0.45) return 'left'
    if (dy > 8 && Math.abs(dy) >= Math.abs(dx) * 0.45) return 'top'
    return isExceptionBranch ? 'left' : 'top'
  }
  if (sourceSide === 'bottom') {
    if (dx > 8 && Math.abs(dx) > Math.abs(dy) * 0.45) return 'left'
    return 'top'
  }
  return inferFlowTargetSide(source, target, sourceSide, edge)
}

export function handlePairManhattanDistance(
  source: PlacedNode,
  target: PlacedNode,
  sourceHandle: EdgeHandleId,
  targetHandle: EdgeHandleId,
): number {
  const s = handlePoint(source, sourceHandle)
  const t = handlePoint(target, targetHandle)
  return Math.abs(s.x - t.x) + Math.abs(s.y - t.y)
}

/**
 * directionPenalty: 정방향 0, 좌우 1, 역방향 100
 * score = directionPenalty * FLOW_DIRECTION_PENALTY_SCALE + distance
 */
export function handlePairDirectionPenalty(
  source: PlacedNode,
  target: PlacedNode,
  sourceHandle: EdgeHandleId,
  targetHandle: EdgeHandleId,
  edge: Edge,
): number {
  const allowsReverse = allowsReverseFlow(edge)
  const sameRow = isSameFlowRow(source, target)
  const dx = nodeCenter(target).x - nodeCenter(source).x
  const dy = nodeCenter(target).y - nodeCenter(source).y

  if (!allowsReverse) {
    if (sourceHandle === 'top' || targetHandle === 'bottom') return 200
    if (sourceHandle === 'left' && targetHandle === 'right') return 200
    if (sourceHandle === 'right' && targetHandle === 'left' && dx < -8) return 200
    if (sourceHandle === 'bottom' && targetHandle === 'top' && dy < -8) return 200
  }

  if (sourceHandle === 'bottom' && targetHandle === 'top') {
    if (dy > 0) return 0
    return 1
  }

  if (sourceHandle === 'right' && targetHandle === 'left' && dx > 0) {
    return sameRow || Math.abs(dx) >= Math.abs(dy) ? 0 : 1
  }
  if (sourceHandle === 'left' && targetHandle === 'right' && dx < 0) {
    return sameRow || Math.abs(dx) >= Math.abs(dy) ? 0 : 1
  }

  if (allowsReverse && sourceHandle === 'top' && targetHandle === 'bottom' && dy < 0) {
    return 0
  }

  if (sourceHandle === 'right' && targetHandle === 'left') return dx < -8 ? 200 : 1
  if (sourceHandle === 'left' && targetHandle === 'right') return dx > 8 ? 200 : 1

  if (sourceHandle === 'top' || targetHandle === 'bottom') {
    return allowsReverse ? 10 : 100
  }

  return 10
}

export function handlePairSelectionScore(
  source: PlacedNode,
  target: PlacedNode,
  sourceHandle: EdgeHandleId,
  targetHandle: EdgeHandleId,
  edge: Edge,
): number {
  return (
    handlePairDirectionPenalty(source, target, sourceHandle, targetHandle, edge) *
      FLOW_DIRECTION_PENALTY_SCALE +
    handlePairManhattanDistance(source, target, sourceHandle, targetHandle)
  )
}

function buildForwardHandleCandidates(
  edge: Edge,
  source: PlacedNode,
  target: PlacedNode,
): Array<[EdgeHandleId, EdgeHandleId]> {
  const allowsReverse = allowsReverseFlow(edge)
  const sameRow = isSameFlowRow(source, target)
  const dx = nodeCenter(target).x - nodeCenter(source).x
  const dy = nodeCenter(target).y - nodeCenter(source).y
  const seen = new Set<string>()
  const pairs: Array<[EdgeHandleId, EdgeHandleId]> = []

  const add = (sourceHandle: EdgeHandleId, targetHandle: EdgeHandleId) => {
    if (!allowsReverse && (sourceHandle === 'top' || targetHandle === 'bottom')) return
    const key = `${sourceHandle}:${targetHandle}`
    if (seen.has(key)) return
    seen.add(key)
    pairs.push([sourceHandle, targetHandle])
  }

  add('bottom', 'top')

  if (sameRow) {
    if (dx > 8) add('right', 'left')
    if (dx < -8) add('left', 'right')
  } else {
    if (dx > 20) add('right', 'left')
    if (dx < -20) add('left', 'right')
  }

  if (allowsReverse && dy < -8) add('top', 'bottom')

  if (pairs.length === 0) add('bottom', 'top')
  return pairs
}

/** sequence 방향 → 위치 → score 순 handle pair 후보 */
export function recommendHandlePairs(
  edge: Edge,
  source: PlacedNode,
  target: PlacedNode,
  branchContext?: EdgeBranchContext,
): Array<[EdgeHandleId, EdgeHandleId]> {
  if (
    branchContext?.isCellInternalFlow &&
    branchContext.preferredSourceHandle &&
    branchContext.preferredTargetHandle
  ) {
    return [[branchContext.preferredSourceHandle, branchContext.preferredTargetHandle]]
  }

  const candidates = buildForwardHandleCandidates(edge, source, target)

  if (
    branchContext?.isDecisionBranch &&
    branchContext.preferredSourceHandle &&
    branchContext.preferredTargetHandle
  ) {
    const primary: [EdgeHandleId, EdgeHandleId] = [
      branchContext.preferredSourceHandle,
      branchContext.preferredTargetHandle,
    ]
    if (!candidates.some(([sh, th]) => sh === primary[0] && th === primary[1])) {
      candidates.unshift(primary)
    } else {
      const idx = candidates.findIndex(([sh, th]) => sh === primary[0] && th === primary[1])
      if (idx > 0) {
        candidates.splice(idx, 1)
        candidates.unshift(primary)
      }
    }
  }

  return [...candidates].sort(
    (a, b) =>
      handlePairSelectionScore(source, target, a[0], a[1], edge) -
      handlePairSelectionScore(source, target, b[0], b[1], edge),
  )
}

export function isForbiddenForwardHandlePair(
  edge: Edge,
  sourceHandle: EdgeHandleId,
  targetHandle: EdgeHandleId,
): boolean {
  if (allowsReverseFlow(edge)) return false
  return sourceHandle === 'top' || targetHandle === 'bottom'
}
