import { resolveEdgeSourceHandle, resolveEdgeTargetHandle } from '../editor/edgeHandles'
import type { Edge, EdgeHandleId } from '../../types/process'
import { getDecisionDiamondVertex, getDecisionNodeCenter } from './decisionAnchors'
import type { PlacedNode } from './laneLayout'
import { classifyBranchPolarity } from './edgeBranchRouting'
import { allowsReverseFlow } from './edgeFlowDirection'
import { isReturnLikeEdge } from './sameLaneReturnRouting'

/** Overview / Detail 공통 — wrapper 120×76, 가로형 diamond 96×76 (정사각형 회전 금지) */
export const DECISION_NODE_LAYOUT = {
  width: 120,
  height: 76,
  diamondWidth: 96,
  diamondHeight: 76,
  maxWidth: 120,
  maxHeight: 76,
  exclusionPadding: 24,
  sameColumnThresholdX: 40,
  maxOutgoingBends: 2,
  /** decision wrapper 아래 → 일반 node 상단 최소 간격 */
  belowMinGap: 60,
} as const

/** wrapper 로컬 좌표 — SVG polygon points="60,0 108,38 60,76 12,38" */
export const DECISION_POLYGON_VERTICES: Record<EdgeHandleId, { x: number; y: number }> = {
  top: { x: 60, y: 0 },
  right: { x: 108, y: 38 },
  bottom: { x: 60, y: 76 },
  left: { x: 12, y: 38 },
}

export const DECISION_POLYGON_POINTS = '60,0 108,38 60,76 12,38'

export function isLongDecisionTitle(name: string): boolean {
  const trimmed = name.trim()
  return trimmed.length > 10 || trimmed.includes('\n')
}

export function getDecisionNodeSize(_name = ''): { width: number; height: number } {
  return {
    width: DECISION_NODE_LAYOUT.width,
    height: DECISION_NODE_LAYOUT.height,
  }
}

export function decisionNodeCollisionMargin(
  nodeId: string,
  process?: { nodes: Array<{ id: string; type: string }> },
): number {
  const type = process?.nodes.find((n) => n.id === nodeId)?.type
  return type === 'decision' ? DECISION_NODE_LAYOUT.exclusionPadding : 0
}

function nodeCenter(node: PlacedNode): { x: number; y: number } {
  return getDecisionNodeCenter(node)
}

/** 같은 열(또는 거의 동일 x축) — |centerX diff| <= 40 */
export function isDecisionSameColumn(source: PlacedNode, target: PlacedNode): boolean {
  return (
    Math.abs(nodeCenter(source).x - nodeCenter(target).x) <= DECISION_NODE_LAYOUT.sameColumnThresholdX
  )
}

/**
 * Decision outgoing handle pair — polarity·위치 기준.
 * Y/신규 아래: bottom→top | N 회귀(위): right→right ] / left→left [ | 기존/우하: right→right bracket
 */
export function inferDecisionOutgoingPair(
  source: PlacedNode,
  target: PlacedNode,
  edge: Edge,
): [EdgeHandleId, EdgeHandleId] {
  const explicitS = resolveEdgeSourceHandle(edge)
  const explicitT = resolveEdgeTargetHandle(edge)
  if (explicitS && explicitT) return [explicitS, explicitT]
  if (explicitS) {
    return [explicitS, inferTargetForDecisionHandle(source, target, explicitS, edge)]
  }

  const sc = nodeCenter(source)
  const tc = nodeCenter(target)
  const dx = tc.x - sc.x
  const dy = tc.y - sc.y
  const polarity = classifyBranchPolarity(edge)
  const isReturn = isReturnLikeEdge(edge)

  if (isReturn && dy < -8) {
    return dx > 8 ? ['right', 'right'] : ['left', 'left']
  }

  if (isReturn && dy > 8 && isDecisionSameColumn(source, target)) {
    return ['bottom', 'top']
  }

  if (polarity === 'negative' && !isReturn && (dy > 8 || dx > 8)) {
    if (dy > 8 && isDecisionSameColumn(source, target)) {
      return ['bottom', 'top']
    }
    return ['right', 'right']
  }

  if (polarity === 'positive') {
    if (dy > 8 && isDecisionSameColumn(source, target)) {
      return ['bottom', 'top']
    }
    if (dy > 8 && Math.abs(dx) <= DECISION_NODE_LAYOUT.sameColumnThresholdX) {
      return ['bottom', 'top']
    }
    if (dx > 8) {
      return ['right', dy > 8 ? 'right' : 'left']
    }
    if (dy > 8) {
      return ['bottom', 'top']
    }
  }

  if (isDecisionSameColumn(source, target) && dy > 0) {
    return ['bottom', 'top']
  }

  if (dy > 8 && Math.abs(dx) <= DECISION_NODE_LAYOUT.sameColumnThresholdX) {
    return ['bottom', 'top']
  }

  if (dx > 8 && dy > 8) {
    return ['right', 'right']
  }

  if (dx > 8 && Math.abs(dx) >= Math.abs(dy) * 0.4) {
    return ['right', 'left']
  }

  if (dy > 8) {
    return ['bottom', 'top']
  }

  return ['right', 'left']
}

function inferTargetForDecisionHandle(
  source: PlacedNode,
  target: PlacedNode,
  sourceHandle: EdgeHandleId,
  edge: Edge,
): EdgeHandleId {
  switch (sourceHandle) {
    case 'bottom':
      return 'top'
    case 'top':
      return allowsReverseFlow(edge) ? 'bottom' : 'top'
    case 'right':
      if (target.y > source.y + source.height / 2) {
        return isDecisionSameColumn(source, target) ? 'top' : 'right'
      }
      return target.y + target.height / 2 < source.y + source.height / 2 ? 'right' : 'left'
    case 'left':
      return 'left'
    default:
      return nodeCenter(target).y >= nodeCenter(source).y ? 'top' : 'bottom'
  }
}

/** 조건 라벨(Y/N/신규/기존) — diamond 꼭지점에서 16px 이상 떨어진 위치 */
export function decisionBranchLabelPoint(
  source: PlacedNode,
  sourceHandle: EdgeHandleId,
): { x: number; y: number } {
  const vertex = getDecisionDiamondVertex(source, sourceHandle)
  switch (sourceHandle) {
    case 'right':
      return { x: vertex.x + 18, y: vertex.y - 10 }
    case 'bottom':
      return { x: vertex.x + 10, y: vertex.y + 14 }
    case 'left':
      return { x: vertex.x - 28, y: vertex.y - 10 }
    case 'top':
      return { x: vertex.x + 10, y: vertex.y - 18 }
  }
}
