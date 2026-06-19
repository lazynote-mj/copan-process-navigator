/**
 * Split/Merge Connector 전용 orthogonal edge routing.
 *
 * 모든 connector 관련 edge에 동일 규칙 적용:
 * - corridor / 외부 우회 금지
 * - handle 고정 (left/right/top/bottom)
 * - 최대 2~3 bend (stub → 정렬 → 진입)
 */

import type { Edge, EdgeHandleId, Process } from '../../types/process'
import { resolveEdgeSourceHandle, resolveEdgeTargetHandle, hasUserSpecifiedHandles } from '../editor/edgeHandles'
import {
  getHandlePoint,
  pointsToPath,
  simplifyPath,
  validateOrthogonalPath,
  type OrthogonalRouteOptions,
  type OrthogonalRouteResult,
  type Point,
} from './orthogonalEdgeRouter'
import {
  isConnectorNode,
  resolveConnectorEdgeHandles,
  resolveConnectorSubType,
} from './connectorLayout'
import type { PlacedNode } from './laneLayout'
import { labelPointFromOrthogonalPath } from './edgeLabelPlacement'

const CONNECTOR_STUB = 6
const AXIS_ALIGN_TOLERANCE = 8

function getNodeType(process: Process | undefined, nodeId: string): string | undefined {
  return process?.nodes.find((node) => node.id === nodeId)?.type
}

function offsetFromHandle(point: Point, handle: EdgeHandleId, distance: number): Point {
  switch (handle) {
    case 'top':
      return { x: point.x, y: point.y - distance }
    case 'bottom':
      return { x: point.x, y: point.y + distance }
    case 'left':
      return { x: point.x - distance, y: point.y }
    case 'right':
      return { x: point.x + distance, y: point.y }
  }
}

function isAligned(a: number, b: number, tolerance = AXIS_ALIGN_TOLERANCE): boolean {
  return Math.abs(a - b) <= tolerance
}

/** connector endpoint가 포함된 edge인지 */
export function isConnectorEdge(edge: Edge, process: Process): boolean {
  const sourceNode = process.nodes.find((node) => node.id === edge.source)
  const targetNode = process.nodes.find((node) => node.id === edge.target)
  if (!sourceNode || !targetNode) return false
  return isConnectorNode(sourceNode) || isConnectorNode(targetNode)
}

function buildDownTopPath(
  start: Point,
  srcExit: Point,
  tgtEntry: Point,
  end: Point,
): Point[] {
  if (isAligned(srcExit.x, tgtEntry.x)) {
    return validateOrthogonalPath([start, srcExit, tgtEntry, end])
  }

  const midY = (srcExit.y + tgtEntry.y) / 2
  return validateOrthogonalPath([
    start,
    srcExit,
    { x: srcExit.x, y: midY },
    { x: tgtEntry.x, y: midY },
    tgtEntry,
    end,
  ])
}

function buildSideToTopPath(
  start: Point,
  srcExit: Point,
  tgtEntry: Point,
  end: Point,
  sourceHandle: EdgeHandleId,
): Point[] {
  if (isAligned(srcExit.y, tgtEntry.y)) {
    return validateOrthogonalPath([start, srcExit, tgtEntry, end])
  }

  const railY = sourceHandle === 'bottom' ? srcExit.y : srcExit.y
  return validateOrthogonalPath([start, srcExit, { x: tgtEntry.x, y: railY }, tgtEntry, end])
}

function buildIntoMergePath(
  start: Point,
  srcExit: Point,
  tgtEntry: Point,
  end: Point,
  targetHandle: EdgeHandleId,
): Point[] {
  if (targetHandle === 'top') {
    return buildDownTopPath(start, srcExit, tgtEntry, end)
  }

  const mergeY = tgtEntry.y
  if (isAligned(srcExit.y, mergeY)) {
    return validateOrthogonalPath([start, srcExit, tgtEntry, end])
  }

  return validateOrthogonalPath([
    start,
    srcExit,
    { x: srcExit.x, y: mergeY },
    tgtEntry,
    end,
  ])
}

function buildConnectorPath(
  source: PlacedNode,
  target: PlacedNode,
  sourceHandle: EdgeHandleId,
  targetHandle: EdgeHandleId,
  process?: Process,
): Point[] {
  const sourceType = getNodeType(process, source.id)
  const targetType = getNodeType(process, target.id)
  const start = getHandlePoint(source, sourceHandle, 0.5, sourceType)
  const end = getHandlePoint(target, targetHandle, 0.5, targetType)
  const srcExit = offsetFromHandle(start, sourceHandle, CONNECTOR_STUB)
  const tgtEntry = offsetFromHandle(end, targetHandle, CONNECTOR_STUB)

  const sourceNode = process?.nodes.find((node) => node.id === source.id)
  const targetNode = process?.nodes.find((node) => node.id === target.id)

  if (sourceNode && isConnectorNode(sourceNode) && resolveConnectorSubType(sourceNode) === 'split') {
    return buildSideToTopPath(start, srcExit, tgtEntry, end, sourceHandle)
  }

  if (targetNode && isConnectorNode(targetNode) && resolveConnectorSubType(targetNode) === 'merge') {
    return buildIntoMergePath(start, srcExit, tgtEntry, end, targetHandle)
  }

  if (sourceHandle === 'bottom' && targetHandle === 'top') {
    return buildDownTopPath(start, srcExit, tgtEntry, end)
  }

  if (
    (sourceHandle === 'left' || sourceHandle === 'right') &&
    targetHandle === 'top'
  ) {
    return buildSideToTopPath(start, srcExit, tgtEntry, end, sourceHandle)
  }

  if (sourceHandle === 'bottom' && (targetHandle === 'left' || targetHandle === 'right')) {
    const railY = tgtEntry.y
    return validateOrthogonalPath([
      start,
      srcExit,
      { x: srcExit.x, y: railY },
      tgtEntry,
      end,
    ])
  }

  return buildDownTopPath(start, srcExit, tgtEntry, end)
}

export function routeConnectorOrthogonalEdge(
  options: OrthogonalRouteOptions,
  handles?: { sourceHandle: EdgeHandleId; targetHandle: EdgeHandleId },
): OrthogonalRouteResult | null {
  const { edge, source, target, process, minContentX = 0, placed = [] } = options
  if (!process || !isConnectorEdge(edge, process)) return null

  const placedMap = new Map(placed.map((node) => [node.id, node]))
  const locked = hasUserSpecifiedHandles(edge)
    ? (() => {
        const sh = resolveEdgeSourceHandle(edge)
        const th = resolveEdgeTargetHandle(edge)
        return sh && th ? { sourceHandle: sh, targetHandle: th } : null
      })()
    : null
  const resolved =
    handles ??
    locked ??
    resolveConnectorEdgeHandles(edge, process, placedMap) ?? {
      sourceHandle: (resolveEdgeSourceHandle(edge) ?? 'bottom') as EdgeHandleId,
      targetHandle: (resolveEdgeTargetHandle(edge) ?? 'top') as EdgeHandleId,
    }

  const sourceHandle = resolved.sourceHandle
  const targetHandle = resolved.targetHandle
  const points = simplifyPath(
    buildConnectorPath(source, target, sourceHandle, targetHandle, process),
  )
  const path = pointsToPath(points, minContentX)
  const labelPoint = labelPointFromOrthogonalPath(points, minContentX)

  return {
    path,
    points,
    bendPoints: points.length > 2 ? points.slice(1, -1) : [],
    sourceHandle,
    targetHandle,
    labelPoint,
    labelHidden: false,
    exactEndpoints: true,
  }
}
