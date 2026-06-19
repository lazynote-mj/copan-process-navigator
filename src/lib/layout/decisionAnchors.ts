import { resolveEdgeSourceHandle, resolveEdgeTargetHandle } from '../editor/edgeHandles'
import type { Edge, EdgeHandleId } from '../../types/process'
import { DECISION_NODE_LAYOUT, DECISION_POLYGON_VERTICES } from './decisionNodeLayout'
import type { PlacedNode } from './laneLayout'

export type AnchorPoint = { x: number; y: number }

export function isDecisionNodeType(nodeType?: string): boolean {
  return nodeType === 'decision'
}

export function isBranchNodeType(nodeType?: string): boolean {
  return nodeType === 'decision' || nodeType === 'interface-rule'
}

export function getDecisionDiamondHalfExtents(): { halfW: number; halfH: number } {
  return {
    halfW: DECISION_NODE_LAYOUT.diamondWidth / 2,
    halfH: DECISION_NODE_LAYOUT.diamondHeight / 2,
  }
}

export function getDecisionDiamondSize(): { diamondWidth: number; diamondHeight: number } {
  return {
    diamondWidth: DECISION_NODE_LAYOUT.diamondWidth,
    diamondHeight: DECISION_NODE_LAYOUT.diamondHeight,
  }
}

export function getDecisionNodeCenter(node: PlacedNode): AnchorPoint {
  return {
    x: node.x + node.width / 2,
    y: node.y + node.height / 2,
  }
}

/** polygon 꼭지점 — wrapper (x,y) 기준, layout box 대비 스케일 */
export function getDecisionDiamondVertex(node: PlacedNode, handle: EdgeHandleId): AnchorPoint {
  const local = DECISION_POLYGON_VERTICES[handle]
  const scaleX = node.width / DECISION_NODE_LAYOUT.width
  const scaleY = node.height / DECISION_NODE_LAYOUT.height
  return {
    x: node.x + local.x * scaleX,
    y: node.y + local.y * scaleY,
  }
}

/** React Flow Handle 위치 (wrapper box 기준 px) */
export function getDecisionHandleOffset(
  boxW: number,
  boxH: number,
  handle: EdgeHandleId,
): { left: number; top: number } {
  const node = { id: '', laneId: '', x: 0, y: 0, width: boxW, height: boxH }
  const vertex = getDecisionDiamondVertex(node, handle)
  return { left: vertex.x, top: vertex.y }
}

function nodeCenter(node: PlacedNode): AnchorPoint {
  return getDecisionNodeCenter(node)
}

/** decision이 target일 때 — source 상대 위치로 진입 면 추론 */
export function inferDecisionIncomingHandle(
  source: PlacedNode,
  decision: PlacedNode,
  edge?: Edge,
): EdgeHandleId {
  const explicit = edge ? resolveEdgeTargetHandle(edge) : undefined
  if (explicit) return explicit

  const sc = nodeCenter(source)
  const dc = nodeCenter(decision)
  const dx = sc.x - dc.x
  const dy = sc.y - dc.y

  if (Math.abs(dx) > Math.abs(dy)) {
    return dx < 0 ? 'left' : 'right'
  }
  return dy < 0 ? 'top' : 'bottom'
}

/** decision이 source일 때 — 명시 handle 우선, 없으면 polarity 기반 */
export function resolveDecisionOutgoingHandle(
  edge: Edge,
  assignedSide?: EdgeHandleId,
): EdgeHandleId {
  return resolveEdgeSourceHandle(edge) ?? assignedSide ?? 'right'
}
