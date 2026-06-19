import type { Edge, Lane, Process } from '../../types/process'
import { getNodeById } from '../../types/process'
import { isReturnEdgeType, resolveEdgeType } from '../../types/edgeTypes'
import { resolveNodeLocalOrder } from './localOrder'
import { COLUMN_WIDTH } from './gridLayout'
import type { PlacedNode } from './laneLayout'

/** 같은 X 컬럼으로 간주하는 중심 거리 */
export const SIMILAR_X_THRESHOLD = COLUMN_WIDTH * 0.35

export type EdgeRoutingType =
  | 'bottom-route'
  | 'horizontal-forward'
  | 'vertical-down'
  | 'vertical-up'
  | 'cross-lane-step'
  | 'zone-down'
  | 'zone-up'
  | 'long-cross-lane'
  | 'orthogonal'

/** @deprecated EdgeRoutingType 사용 */
export type EdgeRoutingKind = EdgeRoutingType

export const HANDLE = {
  top: 'top',
  right: 'right',
  bottom: 'bottom',
  left: 'left',
} as const

export function buildLaneOrderMap(lanes: Lane[]): Map<string, number> {
  return new Map(lanes.map((lane) => [lane.id, lane.order]))
}

function nodeCenterX(node: PlacedNode): number {
  return node.x + node.width / 2
}

function isSimilarX(source: PlacedNode, target: PlacedNode): boolean {
  return Math.abs(nodeCenterX(source) - nodeCenterX(target)) <= SIMILAR_X_THRESHOLD
}

/** 하단 우회 — edge.type = return + target localOrder가 source보다 이전 */
export function isBottomRouteEdge(
  edge: Edge,
  sourceNodeId: string,
  targetNodeId: string,
  process: Process,
): boolean {
  if (!isReturnEdgeType(resolveEdgeType(edge))) {
    return false
  }

  const sourceNode = getNodeById(process, sourceNodeId)
  const targetNode = getNodeById(process, targetNodeId)
  if (!sourceNode || !targetNode) return true

  const sourceOrder = resolveNodeLocalOrder(sourceNode, process)
  const targetOrder = resolveNodeLocalOrder(targetNode, process)
  return targetOrder < sourceOrder
}

/**
 * local column swimlane flow edge routing.
 *
 * A. 같은 lane → horizontal-forward (right → left)
 * B. 다른 lane + x 유사 → vertical-down / vertical-up
 * C. 다른 lane + target 오른쪽 → horizontal-forward
 * D. 다른 lane + target 왼쪽/아래 → cross-lane-step (bottom → top, L자)
 * E. return → bottom-route
 */
export function getEdgeRoutingType(
  edge: Edge,
  source: PlacedNode,
  target: PlacedNode,
  process: Process,
  laneOrder: Map<string, number>,
): EdgeRoutingType {
  if (isBottomRouteEdge(edge, source.id, target.id, process)) {
    return 'bottom-route'
  }

  const sourceNode = getNodeById(process, source.id)
  const targetNode = getNodeById(process, target.id)
  if (!sourceNode || !targetNode) return 'orthogonal'

  const sourceLocal = resolveNodeLocalOrder(sourceNode, process)
  const targetLocal = resolveNodeLocalOrder(targetNode, process)
  const sourceLaneOrd = laneOrder.get(source.laneId) ?? 0
  const targetLaneOrd = laneOrder.get(target.laneId) ?? 0

  if (source.laneId === target.laneId) {
    if (targetLocal >= sourceLocal) return 'horizontal-forward'
    return 'orthogonal'
  }

  const laneDiff = Math.abs(sourceLaneOrd - targetLaneOrd)

  /** 2개 이상 lane 건너뜀 — routing column 우회 (node 위치 변경 없음) */
  if (laneDiff >= 2) {
    return 'long-cross-lane'
  }

  if (isSimilarX(source, target)) {
    if (targetLaneOrd > sourceLaneOrd) return 'vertical-down'
    if (targetLaneOrd < sourceLaneOrd) return 'vertical-up'
  }

  if (target.x >= source.x + source.width * 0.4) {
    return 'horizontal-forward'
  }

  if (targetLaneOrd > sourceLaneOrd) {
    return 'cross-lane-step'
  }

  if (targetLaneOrd < sourceLaneOrd) {
    return 'cross-lane-step'
  }

  return 'orthogonal'
}

export function getEdgeHandleIds(routingType: EdgeRoutingType): {
  sourceHandle?: string
  targetHandle?: string
} {
  switch (routingType) {
    case 'vertical-down':
      return { sourceHandle: HANDLE.bottom, targetHandle: HANDLE.top }
    case 'vertical-up':
      return { sourceHandle: HANDLE.top, targetHandle: HANDLE.bottom }
    case 'cross-lane-step':
      return { sourceHandle: HANDLE.bottom, targetHandle: HANDLE.top }
    case 'zone-down':
      return { sourceHandle: HANDLE.bottom, targetHandle: HANDLE.top }
    case 'zone-up':
      return { sourceHandle: HANDLE.top, targetHandle: HANDLE.bottom }
    case 'long-cross-lane':
      return { sourceHandle: HANDLE.right, targetHandle: HANDLE.left }
    case 'horizontal-forward':
      return { sourceHandle: HANDLE.right, targetHandle: HANDLE.left }
    case 'bottom-route':
      return { sourceHandle: HANDLE.bottom, targetHandle: HANDLE.left }
    default:
      return { sourceHandle: HANDLE.right, targetHandle: HANDLE.left }
  }
}

/** @deprecated getEdgeRoutingType 사용 */
export function classifyEdgeRouting(
  edge: Edge,
  source: PlacedNode,
  target: PlacedNode,
  laneOrder: Map<string, number>,
  process: Process,
): EdgeRoutingType {
  return getEdgeRoutingType(edge, source, target, process, laneOrder)
}

export function getReactFlowEdgeType(
  routingType: EdgeRoutingType,
  edgeType: import('../../types/edgeTypes').EdgeType,
): string {
  if (routingType === 'bottom-route' || edgeType === 'return') return 'returnEdge'
  if (routingType === 'long-cross-lane') return 'crossLaneEdge'
  if (edgeType === 'system' || edgeType === 'api') return 'systemEdge'
  if (edgeType === 'condition' || edgeType === 'exception') return 'conditionEdge'
  if (edgeType === 'virtual' || edgeType === 'reference') return 'normalEdge'
  return 'normalEdge'
}
