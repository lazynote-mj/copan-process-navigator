import type { Edge, EdgeHandleId, Process } from '../../types/process'
import { resolveEdgeSourceHandle, resolveEdgeTargetHandle } from '../editor/edgeHandles'
import { resolveEdgeType } from '../../types/edgeTypes'
import { isReturnLikeEdge } from './sameLaneReturnRouting'
import type { PlacedNode } from './laneLayout'
import {
  countNodeCollisionsOnPath,
  getHandlePoint,
  HANDLE_STUB,
  PRIORITY_ROUTE_NODE_PADDING,
  simplifyPath,
  validateOrthogonalPath,
  type Point,
} from './orthogonalEdgeRouter'
import { isBranchNodeType } from './decisionAnchors'

export const RETURN_GUTTER_INSET = 16
export const RETURN_GUTTER_NODE_CLEARANCE = 20

function nodeMeta(nodeId: string, process?: Process) {
  const node = process?.nodes.find((n) => n.id === nodeId)
  if (!node) return null
  return {
    cellOrder: node.cellOrder ?? node.zoneOrder ?? 0,
    processZone: node.processZone,
    laneId: node.laneId,
  }
}

/** Return / feedback / 역방향 edge — gutter 우회 대상 */
export function qualifiesForReturnFeedbackEdge(
  edge: Edge,
  source: PlacedNode,
  target: PlacedNode,
  process?: Process,
): boolean {
  const edgeType = resolveEdgeType(edge)
  if (isReturnLikeEdge(edge)) return true
  if (edgeType === 'reference' || edgeType === 'virtual') return true
  if (target.y < source.y - 4) return true

  const sMeta = nodeMeta(source.id, process)
  const tMeta = nodeMeta(target.id, process)
  if (sMeta && tMeta && sMeta.laneId === tMeta.laneId && tMeta.cellOrder < sMeta.cellOrder) {
    return true
  }
  return false
}

function sharesLaneOrZone(source: PlacedNode, target: PlacedNode, process?: Process): boolean {
  if (source.laneId === target.laneId) return true
  const s = nodeMeta(source.id, process)
  const t = nodeMeta(target.id, process)
  return Boolean(s?.processZone && t?.processZone && s.processZone === t.processZone)
}

function corridorNodes(
  source: PlacedNode,
  target: PlacedNode,
  placed: PlacedNode[],
  excludeIds: Set<string>,
  padding: number,
): PlacedNode[] {
  const minX = Math.min(source.x, target.x) - padding
  const maxX = Math.max(source.x + source.width, target.x + target.width) + padding
  const minY = Math.min(source.y, target.y) - padding
  const maxY = Math.max(source.y + source.height, target.y + target.height) + padding
  return placed.filter(
    (node) =>
      !excludeIds.has(node.id) &&
      node.x + node.width + padding > minX &&
      node.x - padding < maxX &&
      node.y + node.height + padding > minY &&
      node.y - padding < maxY,
  )
}

function resolveGutterX(
  source: PlacedNode,
  target: PlacedNode,
  placed: PlacedNode[],
  excludeIds: Set<string>,
  side: 'left' | 'right',
  padding: number,
  parallelIndex: number,
): number {
  const blockers = corridorNodes(source, target, placed, excludeIds, padding)
  const offset = Math.abs(parallelIndex) * 10
  if (side === 'left') {
    const minX = blockers.length
      ? Math.min(source.x, target.x, ...blockers.map((n) => n.x))
      : Math.min(source.x, target.x)
    return minX - RETURN_GUTTER_INSET - offset
  }
  const maxX = blockers.length
    ? Math.max(
        source.x + source.width,
        target.x + target.width,
        ...blockers.map((n) => n.x + n.width),
      )
    : Math.max(source.x + source.width, target.x + target.width)
  return maxX + RETURN_GUTTER_INSET + offset
}

function wrapOrthogonal(points: Point[]): Point[] {
  return validateOrthogonalPath(simplifyPath(points))
}

function buildHandlePath(
  source: PlacedNode,
  target: PlacedNode,
  sourceHandle: EdgeHandleId,
  targetHandle: EdgeHandleId,
  gutterX: number,
  sourceType?: string,
  targetType?: string,
  parallelIndex = 0,
): Point[] {
  const stub = HANDLE_STUB + Math.abs(parallelIndex) * 4
  const start = getHandlePoint(source, sourceHandle, 0.5, sourceType)
  const end = getHandlePoint(target, targetHandle, 0.5, targetType)

  let srcExit = start
  switch (sourceHandle) {
    case 'top':
      srcExit = { x: start.x, y: start.y - stub }
      break
    case 'bottom':
      srcExit = { x: start.x, y: start.y + stub }
      break
    case 'left':
      srcExit = { x: start.x - stub, y: start.y }
      break
    case 'right':
      srcExit = { x: start.x + stub, y: start.y }
      break
  }

  let tgtEntry = end
  switch (targetHandle) {
    case 'top':
      tgtEntry = { x: end.x, y: end.y - stub }
      break
    case 'bottom':
      tgtEntry = { x: end.x, y: end.y + stub }
      break
    case 'left':
      tgtEntry = { x: end.x - stub, y: end.y }
      break
    case 'right':
      tgtEntry = { x: end.x + stub, y: end.y }
      break
  }

  if (sourceHandle === 'top' || sourceHandle === 'bottom') {
    return wrapOrthogonal([start, srcExit, { x: gutterX, y: srcExit.y }, { x: gutterX, y: tgtEntry.y }, tgtEntry, end])
  }
  return wrapOrthogonal([start, srcExit, { x: gutterX, y: srcExit.y }, { x: gutterX, y: tgtEntry.y }, tgtEntry, end])
}

export function buildReturnGutterRouteCandidates(
  edge: Edge,
  source: PlacedNode,
  target: PlacedNode,
  placed: PlacedNode[],
  excludeIds: Set<string>,
  parallelIndex: number,
  process?: Process,
): Array<{ points: Point[]; sourceHandle: EdgeHandleId; targetHandle: EdgeHandleId }> {
  if (!sharesLaneOrZone(source, target, process)) return []

  const sourceType = process?.nodes.find((n) => n.id === source.id)?.type
  const targetType = process?.nodes.find((n) => n.id === target.id)?.type
  const userSource = resolveEdgeSourceHandle(edge)
  const userTarget = resolveEdgeTargetHandle(edge)
  const padding = PRIORITY_ROUTE_NODE_PADDING
  const upward = target.y < source.y - 4

  const sourceHandles: EdgeHandleId[] = userSource
    ? [userSource]
    : upward
      ? ['top', 'left']
      : ['right', 'bottom']

  const targetHandles: EdgeHandleId[] = userTarget
    ? [userTarget]
    : upward
      ? ['right', 'bottom']
      : ['right', 'left']

  const gutterSides: Array<'left' | 'right'> = upward ? ['left', 'right'] : ['right', 'left']
  const candidates: Array<{ points: Point[]; sourceHandle: EdgeHandleId; targetHandle: EdgeHandleId }> = []

  for (const side of gutterSides) {
    const gutterX = resolveGutterX(source, target, placed, excludeIds, side, padding, parallelIndex)
    for (const sh of sourceHandles) {
      for (const th of targetHandles) {
        if (isBranchNodeType(sourceType) && sh === 'bottom' && upward) continue
        candidates.push({
          sourceHandle: sh,
          targetHandle: th,
          points: buildHandlePath(source, target, sh, th, gutterX, sourceType, targetType, parallelIndex),
        })
      }
    }
  }

  return candidates
}

export function selectCollisionFreeReturnRoute(
  candidates: Array<{ points: Point[]; sourceHandle: EdgeHandleId; targetHandle: EdgeHandleId }>,
  placed: PlacedNode[],
  excludeIds: Set<string>,
  nodePadding: number,
  process?: Process,
): { points: Point[]; sourceHandle: EdgeHandleId; targetHandle: EdgeHandleId } | null {
  for (const candidate of candidates) {
    if (countNodeCollisionsOnPath(candidate.points, placed, excludeIds, nodePadding, process) === 0) {
      return candidate
    }
  }
  return null
}
