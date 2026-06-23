import type { Edge as FlowEdge } from '@xyflow/react'
import type { Edge } from '../../types/process'
import {
  resolveEdgeType,
  edgeTypeShowsArrow,
} from '../../types/edgeTypes'
import { getReactFlowEdgeType } from './edgeClassification'
import type { EdgeRoutingType } from './edgeClassification'
import type { PlacedNode } from './laneLayout'
import {
  routeOrthogonalEdge,
  segmentsFromPath,
  ARROW_MARKER_LENGTH,
  ARROW_MARKER_WIDTH,
  type OrthogonalRouteResult,
  type Segment,
  type Point,
  countOrthogonalBends,
  countNodeCollisionsOnPath,
  isNearEdge,
} from './orthogonalEdgeRouter'
import type { LabelRect } from './edgeLabelPlacement'
import {
  ROUTING_EDGE_NODE_MARGIN,
  ROUTING_OVERVIEW_EDGE_NODE_MARGIN,
} from './routingMetrics'
import type { EdgeBranchContext } from './edgeBranchRouting'
import type { ProcessEdgeData } from './elkLayout'
import { isDerivedDisplayEdge } from '../nodeVisibility'
import { getHandlePoint, pointsToPath } from './orthogonalEdgeRouter'
import {
  buildEdgeDisplayStyle,
  resolveEdgeRouteValidation,
  validationToEdgeData,
} from './edgeRouteValidation'

export type BuiltOrthogonalEdge = {
  flowEdge: FlowEdge
  path: string
  segments: Segment[]
  route: OrthogonalRouteResult
}

function flowHandleId(role: 'source' | 'target', handle: string): string {
  return `${role}-${handle}`
}

function edgeHandleProps(sourceHandle: string, targetHandle: string): Record<string, string> {
  return {
    sourceHandle: flowHandleId('source', sourceHandle),
    targetHandle: flowHandleId('target', targetHandle),
  }
}

function buildFlowEdgeData(
  edge: Edge,
  route: OrthogonalRouteResult,
  edgeType: ReturnType<typeof resolveEdgeType>,
  routingKind: EdgeRoutingType,
  effectiveParallelIndex: number,
  isDerived: boolean,
): ProcessEdgeData {
  const validation =
    route.routeValidation ??
    resolveEdgeRouteValidation({
      hasNodeCollision: (route.collidedNodes?.length ?? 0) > 0,
      collidedNodes: route.collidedNodes,
      routingStatus: route.routingStatus,
      bendCount: countOrthogonalBends(route.points),
      pathEmpty: route.points.length < 2,
    })

  const labelPoint =
    edge.labelPlacement?.offset && route.labelPoint
      ? {
          x: route.labelPoint.x + edge.labelPlacement.offset.x,
          y: route.labelPoint.y + edge.labelPlacement.offset.y,
        }
      : edge.labelPlacement?.point ?? route.labelPoint

  return {
    edgeType,
    routingKind,
    elkPath: route.path,
    routeLabelPoint: route.labelPoint,
    labelPoint,
    labelPlacement: edge.labelPlacement,
    labelRect: route.labelRect,
    parallelIndex: effectiveParallelIndex,
    bendPoints: route.bendPoints,
    routingMode: edge.routing?.mode ?? 'auto',
    pathPoints: route.points,
    sourceHandle: route.sourceHandle,
    targetHandle: route.targetHandle,
    labelHidden: route.labelHidden,
    exactEndpoints: route.exactEndpoints,
    derived: isDerived,
    readOnly: isDerived,
    ...validationToEdgeData(validation),
  }
}

export type BuildOrthogonalFlowEdgeOptions = {
  overviewMode?: boolean
  preferCorridor?: boolean
  detailDocumentMode?: boolean
  detailLaneOrder?: Map<string, number>
  process?: import('../../types/process').Process
  branchContext?: EdgeBranchContext
  /** collision 검사 margin — 기본값은 overviewMode에 따라 routingMetrics에서 결정 */
  edgeNodeMargin?: number
  /** 이미 배치된 edge 라벨 bbox — 겹침 방지 */
  existingLabelRects?: LabelRect[]
}

function resolveCollisionMargin(options: BuildOrthogonalFlowEdgeOptions): number {
  return (
    options.edgeNodeMargin ??
    (options.overviewMode ? ROUTING_OVERVIEW_EDGE_NODE_MARGIN : ROUTING_EDGE_NODE_MARGIN)
  )
}

function countCollisions(
  points: Point[],
  placed: PlacedNode[],
  exclude: Set<string>,
  margin: number,
  process?: import('../../types/process').Process,
): number {
  return countNodeCollisionsOnPath(points, placed, exclude, margin, process)
}

export function buildOrthogonalFlowEdgeWithCollisionRetry(
  edge: Edge,
  source: PlacedNode,
  target: PlacedNode,
  placed: PlacedNode[],
  parallelIndex: number,
  minContentX: number,
  existingSegments: Segment[],
  options: BuildOrthogonalFlowEdgeOptions = {},
): BuiltOrthogonalEdge {
  const exclude = new Set([source.id, target.id])
  const margin = resolveCollisionMargin(options)
  const nearEdge = isNearEdge(source, target, options.process)

  let result = buildOrthogonalFlowEdge(
    edge,
    source,
    target,
    placed,
    parallelIndex,
    minContentX,
    existingSegments,
    options,
  )

  if (!nearEdge && countCollisions(result.route.points, placed, exclude, margin, options.process) > 0) {
    const retry = buildOrthogonalFlowEdge(
      edge,
      source,
      target,
      placed,
      parallelIndex,
      minContentX,
      existingSegments,
      { ...options, preferCorridor: true },
    )
    if (
      countCollisions(retry.route.points, placed, exclude, margin, options.process) <
      countCollisions(result.route.points, placed, exclude, margin, options.process)
    ) {
      result = retry
    }
  }

  if (!nearEdge && countCollisions(result.route.points, placed, exclude, margin, options.process) > 0) {
    const lastResort = buildOrthogonalFlowEdge(
      edge,
      source,
      target,
      placed,
      parallelIndex + 3,
      minContentX,
      existingSegments,
      { ...options, preferCorridor: true },
    )
    if (
      countCollisions(lastResort.route.points, placed, exclude, margin, options.process) <
      countCollisions(result.route.points, placed, exclude, margin, options.process)
    ) {
      result = lastResort
    }
  }

  return result
}

export function buildOrthogonalFlowEdge(
  edge: Edge,
  source: PlacedNode,
  target: PlacedNode,
  placed: PlacedNode[],
  parallelIndex: number,
  minContentX: number,
  existingSegments: Segment[],
  options: BuildOrthogonalFlowEdgeOptions = {},
): BuiltOrthogonalEdge {
  const edgeType = resolveEdgeType(edge)
  const branchContext = options.branchContext
  const effectiveParallelIndex = branchContext?.parallelIndex ?? parallelIndex
  const route = routeOrthogonalEdge({
    edge,
    source,
    target,
    placed,
    parallelIndex: effectiveParallelIndex,
    branchContext,
    minContentX,
    existingSegments,
    overviewMode: options.overviewMode,
    preferCorridor: options.preferCorridor,
    detailDocumentMode: options.detailDocumentMode,
    process: options.process,
    existingLabelRects: options.existingLabelRects,
  })

  const routingKind: EdgeRoutingType = 'orthogonal'
  const flowEdgeType = getReactFlowEdgeType(routingKind, edgeType)
  const isDerived = isDerivedDisplayEdge(edge)
  const validation =
    route.routeValidation ??
    resolveEdgeRouteValidation({
      hasNodeCollision: (route.collidedNodes?.length ?? 0) > 0,
      collidedNodes: route.collidedNodes,
      routingStatus: route.routingStatus,
      bendCount: countOrthogonalBends(route.points),
      pathEmpty: route.points.length < 2,
    })
  const display = buildEdgeDisplayStyle(edgeType, validation)
  const showArrow = edgeTypeShowsArrow(edgeType)
  const showStatusLabel = validation.validationStatus === 'error'

  return {
    path: route.path,
    segments: segmentsFromPath(route.path),
    route,
    flowEdge: {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: flowEdgeType,
      ...edgeHandleProps(route.sourceHandle, route.targetHandle),
      label: edge.label || (showStatusLabel ? '⚠' : undefined),
      data: buildFlowEdgeData(edge, route, edgeType, routingKind, effectiveParallelIndex, isDerived),
      style: display.style,
      ...(showArrow
        ? {
            markerEnd: {
              type: 'arrowclosed' as const,
              width: ARROW_MARKER_WIDTH,
              height: ARROW_MARKER_LENGTH,
              color: display.markerColor,
            },
          }
        : {}),
      zIndex: edgeType === 'reference' || edgeType === 'virtual' ? 1 : edgeType === 'normal' ? 2 : 1,
    },
  }
}

/** JSON edge는 유지 — endpoint가 layout에 없을 때 broken indicator */
export function buildBrokenFlowEdge(
  edge: Edge,
  missingNodeId: string,
  role: 'source' | 'target',
  partial: { source?: PlacedNode; target?: PlacedNode },
): BuiltOrthogonalEdge {
  const edgeType = resolveEdgeType(edge)
  const flowEdgeType = getReactFlowEdgeType('orthogonal', edgeType)
  const stub = 48

  let points: Point[] = []
  let sourceHandle: import('../../types/process').EdgeHandleId = 'bottom'
  let targetHandle: import('../../types/process').EdgeHandleId = 'top'

  if (partial.source) {
    sourceHandle = 'bottom'
    const start = getHandlePoint(partial.source, sourceHandle)
    points = [start, { x: start.x, y: start.y + stub }, { x: start.x + stub, y: start.y + stub }]
  } else if (partial.target) {
    targetHandle = 'top'
    const end = getHandlePoint(partial.target, targetHandle)
    points = [{ x: end.x - stub, y: end.y - stub }, { x: end.x, y: end.y - stub }, end]
  }

  const path = points.length >= 2 ? pointsToPath(points) : ''
  const labelPoint = points.length > 0 ? points[Math.floor(points.length / 2)] : { x: 0, y: 0 }
  const reason =
    role === 'source'
      ? `Missing source node: ${missingNodeId}`
      : `Missing target node: ${missingNodeId}`

  console.warn(`[ProcessNavigator] Missing ${role} node: ${missingNodeId} (edge ${edge.id})`)

  const validation = resolveEdgeRouteValidation({
    broken: true,
    brokenReason: reason,
    missingNodeId,
    pathEmpty: points.length < 2,
  })
  const display = buildEdgeDisplayStyle(edgeType, validation)

  return {
    path,
    segments: [],
    route: {
      path,
      points,
      bendPoints: [],
      sourceHandle,
      targetHandle,
      labelPoint,
      labelHidden: false,
      validationStatus: 'error',
      routeValidation: validation,
    },
    flowEdge: {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: flowEdgeType,
      ...edgeHandleProps(sourceHandle, targetHandle),
      label: edge.label || '⚠',
      data: {
        edgeType,
        routingKind: 'orthogonal',
        elkPath: path,
        labelPoint,
        pathPoints: points,
        sourceHandle,
        targetHandle,
        broken: true,
        brokenReason: reason,
        missingNodeId,
        ...validationToEdgeData(validation),
      } satisfies ProcessEdgeData,
      style: display.style,
      markerEnd: {
        type: 'arrowclosed' as const,
        width: ARROW_MARKER_WIDTH,
        height: ARROW_MARKER_LENGTH,
        color: display.markerColor,
      },
      zIndex: 3,
    },
  }
}

export function accumulateEdgeLabelRect(existingLabelRects: LabelRect[], route: OrthogonalRouteResult): void {
  if (!route.labelHidden && route.labelRect) {
    existingLabelRects.push(route.labelRect)
  }
}

export function buildAllOrthogonalFlowEdges(
  edges: Edge[],
  placed: PlacedNode[],
  minContentX: number,
  branchContexts: Map<string, EdgeBranchContext>,
  options: BuildOrthogonalFlowEdgeOptions = {},
): BuiltOrthogonalEdge[] {
  const placedMap = new Map(placed.map((n) => [n.id, n]))
  const existingSegments: Segment[] = []
  const existingLabelRects: LabelRect[] = []
  const built: BuiltOrthogonalEdge[] = []

  for (const edge of edges) {
    const source = placedMap.get(edge.source)
    const target = placedMap.get(edge.target)

    if (!source && !target) {
      console.warn(
        `[ProcessNavigator] Cannot render edge ${edge.id}: both endpoints missing from layout.`,
      )
      continue
    }

    if (!source || !target) {
      const missingId = !source ? edge.source : edge.target
      const role = !source ? 'source' : 'target'
      const broken = buildBrokenFlowEdge(edge, missingId, role, { source, target })
      built.push(broken)
      continue
    }

    const branchContext = branchContexts.get(edge.id)
    const result = buildOrthogonalFlowEdgeWithCollisionRetry(
      edge,
      source,
      target,
      placed,
      branchContext?.parallelIndex ?? 0,
      minContentX,
      existingSegments,
      { ...options, branchContext, existingLabelRects },
    )
    existingSegments.push(...result.segments)
    accumulateEdgeLabelRect(existingLabelRects, result.route)
    built.push(result)
  }

  return built
}
