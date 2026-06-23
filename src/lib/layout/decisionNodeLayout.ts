import { resolveEdgeSourceHandle, resolveEdgeTargetHandle } from '../editor/edgeHandles'
import type { Edge, EdgeHandleId } from '../../types/process'
import { DETAIL_NODE_SCALE, scaleLayoutDimension } from './detailNodeScale'
import { getDecisionDiamondVertex, getDecisionNodeCenter } from './decisionAnchors'
import type { PlacedNode } from './laneLayout'
import { classifyBranchPolarity } from './edgeBranchRouting'
import { allowsReverseFlow } from './edgeFlowDirection'
import { isReturnLikeEdge } from './sameLaneReturnRouting'
import { OVERVIEW_VERTICAL_METRICS } from './overviewVerticalMetrics'

export type DecisionLayoutSpec = {
  width: number
  height: number
  diamondWidth: number
  diamondHeight: number
  polygonVertices: Record<EdgeHandleId, { x: number; y: number }>
  polygonPoints: string
  exclusionPadding: number
  sameColumnThresholdX: number
  maxOutgoingBends: number
  /** decision wrapper 아래 → 일반 node 상단 최소 간격 */
  belowMinGap: number
}

/** 노드 마스터 — Overview 판단/분기 */
export const DECISION_NODE_LAYOUT: DecisionLayoutSpec = {
  width: 140,
  height: 44,
  diamondWidth: 140,
  diamondHeight: 44,
  polygonVertices: {
    top: { x: 70, y: 0 },
    right: { x: 140, y: 22 },
    bottom: { x: 70, y: 44 },
    left: { x: 0, y: 22 },
  },
  polygonPoints: '70,0 140,22 70,44 0,22',
  exclusionPadding: 14,
  sameColumnThresholdX: 50,
  maxOutgoingBends: 2,
  belowMinGap: 60,
}

/** @deprecated DECISION_NODE_LAYOUT 사용 — Overview/Detail 분기 제거 */
export const OVERVIEW_DECISION_LAYOUT = DECISION_NODE_LAYOUT

export const DECISION_POLYGON_VERTICES = DECISION_NODE_LAYOUT.polygonVertices

export const DECISION_POLYGON_POINTS = DECISION_NODE_LAYOUT.polygonPoints

export function scaleDecisionLayoutSpec(
  base: DecisionLayoutSpec,
  scale: number = DETAIL_NODE_SCALE,
): DecisionLayoutSpec {
  const width = scaleLayoutDimension(base.width, scale)
  const height = scaleLayoutDimension(base.height, scale)
  const diamondWidth = scaleLayoutDimension(base.diamondWidth, scale)
  const diamondHeight = scaleLayoutDimension(base.diamondHeight, scale)
  const halfW = diamondWidth / 2
  const halfH = diamondHeight / 2

  return {
    width,
    height,
    diamondWidth,
    diamondHeight,
    polygonVertices: {
      top: { x: halfW, y: 0 },
      right: { x: diamondWidth, y: halfH },
      bottom: { x: halfW, y: diamondHeight },
      left: { x: 0, y: halfH },
    },
    polygonPoints: `${halfW},0 ${diamondWidth},${halfH} ${halfW},${diamondHeight} 0,${halfH}`,
    exclusionPadding: scaleLayoutDimension(base.exclusionPadding, scale),
    sameColumnThresholdX: scaleLayoutDimension(base.sameColumnThresholdX, scale),
    maxOutgoingBends: base.maxOutgoingBends,
    belowMinGap: scaleLayoutDimension(base.belowMinGap, scale),
  }
}

/** 노드 마스터 — Process Detail 판단/분기 (일반 노드 가로폭과 동일) */
export const DETAIL_DECISION_NODE_LAYOUT: DecisionLayoutSpec = {
  ...DECISION_NODE_LAYOUT,
  width: OVERVIEW_VERTICAL_METRICS.nodeWidth,
  height: OVERVIEW_VERTICAL_METRICS.decisionHeight,
  diamondWidth: OVERVIEW_VERTICAL_METRICS.nodeWidth,
  diamondHeight: OVERVIEW_VERTICAL_METRICS.decisionHeight,
  polygonVertices: {
    top: { x: OVERVIEW_VERTICAL_METRICS.nodeWidth / 2, y: 0 },
    right: {
      x: OVERVIEW_VERTICAL_METRICS.nodeWidth,
      y: OVERVIEW_VERTICAL_METRICS.decisionHeight / 2,
    },
    bottom: {
      x: OVERVIEW_VERTICAL_METRICS.nodeWidth / 2,
      y: OVERVIEW_VERTICAL_METRICS.decisionHeight,
    },
    left: { x: 0, y: OVERVIEW_VERTICAL_METRICS.decisionHeight / 2 },
  },
  polygonPoints: `${OVERVIEW_VERTICAL_METRICS.nodeWidth / 2},0 ${OVERVIEW_VERTICAL_METRICS.nodeWidth},${OVERVIEW_VERTICAL_METRICS.decisionHeight / 2} ${OVERVIEW_VERTICAL_METRICS.nodeWidth / 2},${OVERVIEW_VERTICAL_METRICS.decisionHeight} 0,${OVERVIEW_VERTICAL_METRICS.decisionHeight / 2}`,
}

export function resolveDecisionLayout(width?: number, height?: number): DecisionLayoutSpec {
  if (width == null || height == null) {
    return DECISION_NODE_LAYOUT
  }
  if (width === DECISION_NODE_LAYOUT.width && height === DECISION_NODE_LAYOUT.height) {
    return DECISION_NODE_LAYOUT
  }
  if (width === DETAIL_DECISION_NODE_LAYOUT.width && height === DETAIL_DECISION_NODE_LAYOUT.height) {
    return DETAIL_DECISION_NODE_LAYOUT
  }
  const scale = width / DECISION_NODE_LAYOUT.width
  return scaleDecisionLayoutSpec(DECISION_NODE_LAYOUT, scale)
}

/** @deprecated 모든 판단노드가 동일 마스터 크기 */
export function isOverviewDecisionSize(_height?: number): boolean {
  return true
}

/** React / anchor helpers — layout box + polygon in one shape */
export function resolveDecisionLayoutForSize(width: number, height: number): {
  layoutWidth: number
  layoutHeight: number
  vertices: Record<EdgeHandleId, { x: number; y: number }>
  polygonPoints: string
  diamondWidth: number
  diamondHeight: number
} {
  const layout = resolveDecisionLayout(width, height)
  return {
    layoutWidth: layout.width,
    layoutHeight: layout.height,
    vertices: layout.polygonVertices,
    polygonPoints: layout.polygonPoints,
    diamondWidth: layout.diamondWidth,
    diamondHeight: layout.diamondHeight,
  }
}

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
