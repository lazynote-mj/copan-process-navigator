import type { Edge, EdgeHandleId, EdgeRoutingConfig, Process } from '../../types/process'
import { resolveEdgeType } from '../../types/edgeTypes'
import { resolveEdgeSourceHandle, resolveEdgeTargetHandle, hasUserSpecifiedHandles, resolveLockedEdgeHandles, isManualRouteEdge, resolveSavedBendPoints } from '../editor/edgeHandles'
import { DECISION_NODE_LAYOUT } from './decisionNodeSpec'
import {
  inferDecisionOutgoingPair,
  isDecisionSameColumn,
} from './decisionNodeLayout'
import {
  getDecisionDiamondVertex,
  isBranchNodeType,
  isDecisionNodeType,
} from './decisionAnchors'
import type { EdgeBranchContext } from './edgeBranchRouting'
import {
  allowsReverseFlow,
  FLOW_DIRECTION_PENALTY_SCALE,
  handlePairDirectionPenalty,
  recommendHandlePairs,
} from './edgeFlowDirection'
import type { PlacedNode } from './laneLayout'
import { parsePathPoints } from './edgeRouter'
import { labelPointFromOrthogonalPath, resolveLabelPlacement, resolveBranchDepartureLabelPlacement, resolveBranchApproachLabelPlacement, resolveDecisionSameRowReturnLabelPlacement, resolveVerticalDropLegLabelPlacement, shouldPreferTargetLabelPlacement, inferHandleFromPathSegment, type LabelRect } from './edgeLabelPlacement'
import { OVERVIEW_VERTICAL_METRICS } from './overviewVerticalMetrics'
import {
  buildDecisionSameRowLeftReturnPath,
  buildDecisionSameRowTopReturnPath,
  buildSameLaneBracketPath,
  buildSameLaneSideTopOneBendPath,
  buildSameLaneVerticalOneBendPath,
  pickBracketSide,
  qualifiesForDecisionRightDownBracket,
  qualifiesForDecisionSameRowLeftReturn,
  qualifiesForDecisionSameRowTopReturn,
  qualifiesForSameLaneBracketReturn,
  qualifiesForSameLaneSideTopOneBend,
  qualifiesForSameLaneVerticalSideBracket,
  isReturnLikeEdge,
  type BracketSide,
} from './sameLaneReturnRouting'
import {
  buildReturnGutterRouteCandidates,
  qualifiesForReturnFeedbackEdge,
  selectCollisionFreeReturnRoute,
} from './returnGutterRouting'
import {
  resolveEdgeRouteValidation,
  type EdgeRouteValidation,
  type EdgeValidationStatus,
} from './edgeRouteValidation'
import { routeConnectorOrthogonalEdge, isConnectorEdge } from './connectorEdgeRouting'
import { isConnectorNodeType } from './connectorLayout'
import { DETAIL_CELL_MAX_ROWS, OVERVIEW_CELL_MAX_ROWS, cellSlotToRowCol } from './overviewCellPlacement'
import { compareZoneOrder } from './overviewZoneLayout'
import { OVERVIEW_GRID_METRICS } from './overviewGridMetrics'

/** 디버그 대상 edge — console.debug 출력 */
export const EDGE_ROUTER_DEBUG_ID = 'edge-mqk4m6m4-6ljdt'
export const EDGE_HANDLE_DEBUG_ID = 'edge-mqka6ai5-7ftsv'
export const EDGE_COLLISION_DEBUG_ID = 'edge-mqhfky2k-4r7lq'

export const EDGE_NODE_MARGIN = 24
export const EDGE_EDGE_MARGIN = 16
export const HANDLE_STUB = 12
export const ARROW_MARKER_LENGTH = 12
export const ARROW_MARKER_WIDTH = 10
/** path endpoint = target anchor — marker gap 없음 */
export const ARROW_GAP = 0
export const EDGE_OFFSET_STEP = 12
/** 직선 연결 허용 — 노드 중심 축 정렬 오차 (px) */
export const STRAIGHT_ALIGN_TOLERANCE = 12
/** 인접 좌우 노드 직선 연결 — centerY 차이 허용 (px) */
export const ADJACENT_HORIZONTAL_Y_TOLERANCE = 24
/** 같은 row 수평 직선 — centerY 차이 허용 (px) */
export const SAME_ROW_Y_TOLERANCE = 48
/** local routing — 외곽 우회 금지 거리 (px) */
export const LOCAL_ROUTING_DISTANCE = 300
/** backbone routing — 장거리 임계 (px) */
export const LONG_EDGE_DISTANCE = 800
/** column overlap 최소 폭 (px) */
export const COLUMN_OVERLAP_MIN = 8
/** 짧은 segment 제거 임계 (px) */
export const MIN_SEGMENT_LENGTH = 8
/** 아래 방향 bottom→top 수직 직선 허용 X 오차 */
export const DOWNWARD_STRAIGHT_X_TOLERANCE = 24
/** 아래 방향 1회 꺾임 허용 X 오차 상한 */
export const DOWNWARD_SINGLE_BEND_X_MAX = 80
/** 우선순위 routing 시 node bbox 충돌 판정 padding */
export const PRIORITY_ROUTE_NODE_PADDING = 20
/** 허용 최대 꺾임 수 — local/decision routing 상한 */
export const MAX_ORTHOGONAL_BENDS = 2

const ORTHO_EPS = 0.5

/** route 후보 tier cost — 낮을수록 우선 */
const ROUTE_TIER_COST = {
  straight: 0,
  oneBend: 10,
  twoBend: 30,
  threePlusBend: 100,
  laneCross: 10,
  outerRoute: 100,
  directionReversal: 80,
} as const

const NON_OBSTACLE_NODE_TYPES = new Set(['phase-connector'])

export type Point = { x: number; y: number }
export type Segment = { x1: number; y1: number; x2: number; y2: number }

export type OrthogonalRouteOptions = {
  edge: Edge
  source: PlacedNode
  target: PlacedNode
  placed: PlacedNode[]
  parallelIndex?: number
  branchContext?: EdgeBranchContext
  minContentX?: number
  existingSegments?: Segment[]
  overviewMode?: boolean
  preferCorridor?: boolean
  detailDocumentMode?: boolean
  process?: Process
  /** collision reroute 내부 재호출 시 무한 재귀 방지 */
  suppressCollisionReroute?: boolean
  /** 이미 배치된 edge 라벨 영역 — 겹침 방지 */
  existingLabelRects?: LabelRect[]
}

const NODE_COLLISION_COST = 200
const EDGE_CROSSING_COST = 100
const LOCAL_EXTERNAL_FORBIDDEN = 10000
const NEAR_EDGE_CENTER_DISTANCE = LOCAL_ROUTING_DISTANCE
const DECISION_BRANCH_SIDE_PENALTY = 8000
const CELL_INTERNAL_WRONG_HANDLE_PENALTY = 12000
const SAME_CELL_SKIP_DETOUR_MARGIN = 28

function cellSlotRowsForProcess(process?: Process): number {
  return process?.overviewNodeId ? DETAIL_CELL_MAX_ROWS : OVERVIEW_CELL_MAX_ROWS
}
const PREFERRED_HANDLE_MISMATCH_PENALTY = 5000
const COLUMN_TRANSITION_EXTERNAL_PENALTY = 15000

export type CollidedNodeRef = { id: string; name: string }

export type OrthogonalRouteResult = {
  path: string
  points: Point[]
  bendPoints: Point[]
  sourceHandle: EdgeHandleId
  targetHandle: EdgeHandleId
  labelPoint: Point
  labelHidden?: boolean
  /** collision-free 배치 시 라벨 bbox — 후속 edge 라벨 겹침 방지 */
  labelRect?: LabelRect
  /** decision diamond vertex 등 gap 없는 endpoint */
  exactEndpoints?: boolean
  routingStatus?: 'reroutedDueToCollision'
  /** @deprecated validationStatus === 'error' + routeIssue === 'node_collision' 사용 */
  collisionError?: boolean
  collidedNodes?: CollidedNodeRef[]
  validationStatus?: EdgeValidationStatus
  routeValidation?: EdgeRouteValidation
}

function nodeCenter(node: PlacedNode): Point {
  return { x: node.x + node.width / 2, y: node.y + node.height / 2 }
}

function centerDistance(source: PlacedNode, target: PlacedNode): number {
  const sc = nodeCenter(source)
  const tc = nodeCenter(target)
  return Math.hypot(tc.x - sc.x, tc.y - sc.y)
}

function axisDistance(source: PlacedNode, target: PlacedNode): { dx: number; dy: number } {
  const sc = nodeCenter(source)
  const tc = nodeCenter(target)
  return { dx: Math.abs(tc.x - sc.x), dy: Math.abs(tc.y - sc.y) }
}

function isRoutingObstacleNode(nodeId: string, process?: Process): boolean {
  if (!process) return true
  const node = process.nodes.find((n) => n.id === nodeId)
  if (!node) return true
  if (NON_OBSTACLE_NODE_TYPES.has(node.type)) return false
  return true
}

function filterRoutingObstacles(
  nodes: PlacedNode[],
  excludeIds: Set<string>,
  process?: Process,
): PlacedNode[] {
  return nodes.filter((node) => !excludeIds.has(node.id) && isRoutingObstacleNode(node.id, process))
}

function sharedColumnX(source: PlacedNode, target: PlacedNode): number | null {
  const overlapMin = Math.max(source.x, target.x)
  const overlapMax = Math.min(source.x + source.width, target.x + target.width)
  if (overlapMax - overlapMin < COLUMN_OVERLAP_MIN) return null
  return (overlapMin + overlapMax) / 2
}

function sharesColumnRange(source: PlacedNode, target: PlacedNode): boolean {
  return (
    sharedColumnX(source, target) !== null ||
    Math.abs(nodeCenterX(source) - nodeCenterX(target)) <= STRAIGHT_ALIGN_TOLERANCE
  )
}

function branchDownwardSharesColumn(
  source: PlacedNode,
  target: PlacedNode,
  sourceType?: string,
): boolean {
  if (!isBranchNodeType(sourceType)) return false
  if (nodeCenterY(target) <= nodeCenterY(source) + 4) return false
  return (
    isDecisionSameColumn(source, target) ||
    sharesColumnRange(source, target) ||
    Math.abs(nodeCenterX(source) - nodeCenterX(target)) <= DOWNWARD_STRAIGHT_X_TOLERANCE
  )
}

/** 같은 lane · 동일 cellSlot 열(LEFT/RIGHT) — zone이 달라도 수직 직선 */
function sameLaneManualCellSlotColumn(
  source: PlacedNode,
  target: PlacedNode,
  process?: Process,
): boolean {
  if (!process) return false
  const sNode = process.nodes.find((n) => n.id === source.id)
  const tNode = process.nodes.find((n) => n.id === target.id)
  if (sNode?.cellSlot == null || tNode?.cellSlot == null) return false
  if (sNode.laneId !== tNode.laneId) return false
  const maxRows = cellSlotRowsForProcess(process)
  return cellSlotToRowCol(sNode.cellSlot, maxRows).col === cellSlotToRowCol(tNode.cellSlot, maxRows).col
}

function detailLayoutNode(process: Process | undefined, nodeId: string) {
  return process?.nodes.find((n) => n.id === nodeId)
}

function sameDetailLayoutColumn(
  source: PlacedNode,
  target: PlacedNode,
  process?: Process,
): boolean {
  const sNode = detailLayoutNode(process, source.id)
  const tNode = detailLayoutNode(process, target.id)
  if (sNode?.detailLayout?.column == null || tNode?.detailLayout?.column == null) return false
  return sNode.laneId === tNode.laneId && sNode.detailLayout.column === tNode.detailLayout.column
}

function sameDetailLayoutRow(
  source: PlacedNode,
  target: PlacedNode,
  process?: Process,
): boolean {
  const sNode = detailLayoutNode(process, source.id)
  const tNode = detailLayoutNode(process, target.id)
  if (sNode?.detailLayout?.row == null || tNode?.detailLayout?.row == null) return false
  return sNode.laneId === tNode.laneId && sNode.detailLayout.row === tNode.detailLayout.row
}

function detailLayoutRightwardColumnFlow(
  source: PlacedNode,
  target: PlacedNode,
  process?: Process,
): boolean {
  const sNode = detailLayoutNode(process, source.id)
  const tNode = detailLayoutNode(process, target.id)
  if (sNode?.detailLayout?.column == null || tNode?.detailLayout?.column == null) return false
  if (sNode.laneId !== tNode.laneId) return false
  if (tNode.detailLayout.column <= sNode.detailLayout.column) return false
  return target.x > source.x + source.width - ORTHO_EPS
}

function detailLayoutAdjacentColumnFlow(
  source: PlacedNode,
  target: PlacedNode,
  process?: Process,
): boolean {
  const sNode = detailLayoutNode(process, source.id)
  const tNode = detailLayoutNode(process, target.id)
  if (sNode?.detailLayout?.column == null || tNode?.detailLayout?.column == null) return false
  if (sNode?.detailLayout?.row == null || tNode?.detailLayout?.row == null) return false
  if (sNode.laneId !== tNode.laneId) return false
  if (sNode.detailLayout.row === tNode.detailLayout.row) return false
  if (Math.abs(tNode.detailLayout.column - sNode.detailLayout.column) !== 1) return false
  const sourceLeftOfTarget = source.x + source.width <= target.x + ORTHO_EPS
  const targetLeftOfSource = target.x + target.width <= source.x + ORTHO_EPS
  return sourceLeftOfTarget || targetLeftOfSource
}

function prefersForwardDetailColumnUpwardRoute(
  edge: Edge,
  source: PlacedNode,
  target: PlacedNode,
  process?: Process,
): boolean {
  if (resolveEdgeSourceHandle(edge) !== 'top') return false
  const targetHandle = resolveEdgeTargetHandle(edge)
  if (targetHandle !== 'left' && targetHandle !== 'right') return false
  if (nodeCenterY(target) >= nodeCenterY(source) - 4) return false
  return detailLayoutRightwardColumnFlow(source, target, process)
}

function nodeProcessOrder(meta: ReturnType<typeof getProcessNodeMeta>): number | undefined {
  const order = meta?.phaseOrder ?? meta?.localOrder ?? meta?.cellOrder
  return typeof order === 'number' && Number.isFinite(order) ? order : undefined
}

function qualifiesForUpwardSequentialMerge(
  edge: Edge,
  source: PlacedNode,
  target: PlacedNode,
  process?: Process,
): boolean {
  if (!process) return false
  if (edge.manualRoute === true || edge.routing?.mode === 'manual') return false
  if (edge.routing?.handlesLocked === true && edge.routing?.handleAuto !== true) return false
  if (resolveEdgeType(edge) === 'condition') return false
  if (nodeCenterY(target) >= nodeCenterY(source) - SAME_ROW_Y_TOLERANCE) return false

  const sourceMeta = getProcessNodeMeta(source.id, process)
  const targetMeta = getProcessNodeMeta(target.id, process)
  const sourceOrder = nodeProcessOrder(sourceMeta)
  const targetOrder = nodeProcessOrder(targetMeta)
  if (sourceOrder != null && targetOrder != null && targetOrder < sourceOrder) return false

  const dx = Math.abs(nodeCenterX(target) - nodeCenterX(source))
  const dy = Math.abs(nodeCenterY(source) - nodeCenterY(target))
  return dx <= Math.max(520, dy * 1.4)
}

function clampAnchorRatio(value: number): number {
  return Math.min(1, Math.max(0, value))
}

function sharedRowY(source: PlacedNode, target: PlacedNode): number | null {
  const overlapMin = Math.max(source.y, target.y)
  const overlapMax = Math.min(source.y + source.height, target.y + target.height)
  if (overlapMax - overlapMin < COLUMN_OVERLAP_MIN) return null
  return (overlapMin + overlapMax) / 2
}

function bendTierCost(bendCount: number): number {
  if (bendCount <= 0) return ROUTE_TIER_COST.straight
  if (bendCount === 1) return ROUTE_TIER_COST.oneBend
  if (bendCount === 2) return ROUTE_TIER_COST.twoBend
  return ROUTE_TIER_COST.threePlusBend + (bendCount - 3) * 20
}

function hasImmediateHorizontalFromSourceExit(points: Point[]): boolean {
  const simplified = simplifyOrthogonal(points)
  if (simplified.length < 3) return false
  const exit = simplified[1]
  const next = simplified[2]
  if (!exit || !next) return false
  return Math.abs(next.y - exit.y) <= ORTHO_EPS && Math.abs(next.x - exit.x) > ORTHO_EPS
}

function hasImmediateLeftFromSourceExit(points: Point[]): boolean {
  const simplified = simplifyOrthogonal(points)
  if (simplified.length < 3) return false
  const exit = simplified[1]
  const next = simplified[2]
  if (!exit || !next) return false
  return Math.abs(next.y - exit.y) <= ORTHO_EPS && next.x < exit.x - ORTHO_EPS
}

function hasDownRightUpDetour(points: Point[]): boolean {
  const simplified = simplifyOrthogonal(points)
  for (let i = 0; i < simplified.length - 3; i++) {
    const d1 = segmentDirection(simplified[i], simplified[i + 1])
    const d2 = segmentDirection(simplified[i + 1], simplified[i + 2])
    const d3 = segmentDirection(simplified[i + 2], simplified[i + 3])
    if (d1 === 'down' && d2 === 'right' && d3 === 'up') return true
    if (d1 === 'down' && d2 === 'left' && d3 === 'up') return true
  }
  return false
}

function routeHasDirectionReversal(points: Point[]): boolean {
  const simplified = simplifyOrthogonal(points)
  for (let i = 0; i < simplified.length - 2; i++) {
    const d1 = segmentDirection(simplified[i], simplified[i + 1])
    const d2 = segmentDirection(simplified[i + 1], simplified[i + 2])
    if (d1 && d2 && isOppositeDirection(d1, d2)) return true
  }
  return false
}

function removeDownRightUpUTurn(points: Point[]): Point[] {
  let result = simplifyOrthogonal(points)
  let changed = true
  while (changed && result.length > 3) {
    changed = false
    for (let i = 0; i < result.length - 3; i++) {
      const d1 = segmentDirection(result[i], result[i + 1])
      const d2 = segmentDirection(result[i + 1], result[i + 2])
      const d3 = segmentDirection(result[i + 2], result[i + 3])
      if (
        (d1 === 'down' && d2 === 'right' && d3 === 'up') ||
        (d1 === 'down' && d2 === 'left' && d3 === 'up')
      ) {
        const start = result[i]!
        const end = result[i + 3]!
        const underpassY = result[i + 2]!.y
        /** Decision N — 아래로 내린 뒤 좌회전하는 underpass는 유지 */
        const isReturnUnderpass =
          underpassY > start.y + ORTHO_EPS && underpassY > end.y + ORTHO_EPS
        if (isReturnUnderpass) continue

        result = [
          ...result.slice(0, i + 1),
          { x: result[i + 3].x, y: result[i].y },
          ...result.slice(i + 3),
        ]
        changed = true
        break
      }
    }
  }
  return simplifyOrthogonal(result)
}

/** 같은/인접 row · target이 source 오른쪽 — right→left 단거리 후보 */
function qualifiesForSameRowRightTargetShortRoute(
  edge: Edge,
  source: PlacedNode,
  target: PlacedNode,
  placed: PlacedNode[],
  excludeIds: Set<string>,
  process?: Process,
): boolean {
  const sourceType = getNodeType(process, source.id)
  const sh = resolveEdgeSourceHandle(edge) ?? (isBranchNodeType(sourceType) ? 'right' : undefined)
  const th = resolveEdgeTargetHandle(edge) ?? 'left'
  if (sh !== 'right') return false
  if (th !== 'left') return false
  if (nodeCenterX(target) <= nodeCenterX(source) - ORTHO_EPS) return false

  const crossLaneSameZone =
    process != null && nodesShareOverviewZoneDifferentLane(source, target, process)
  let rowLimit = OVERVIEW_GRID_METRICS.rowMinHeightNormal * 1.5
  if (crossLaneSameZone && process) {
    const sNode = process.nodes.find((n) => n.id === source.id)
    const tNode = process.nodes.find((n) => n.id === target.id)
    if (sNode?.cellSlot && tNode?.cellSlot) {
      const rowDiff = Math.abs(
        cellSlotToRowCol(sNode.cellSlot, OVERVIEW_CELL_MAX_ROWS).row -
          cellSlotToRowCol(tNode.cellSlot, OVERVIEW_CELL_MAX_ROWS).row,
      )
      rowLimit = OVERVIEW_GRID_METRICS.rowMinHeightNormal * (rowDiff + 1.25)
    } else {
      rowLimit = OVERVIEW_GRID_METRICS.rowMinHeightNormal * 3
    }
  }
  const dy = Math.abs(nodeCenterY(target) - nodeCenterY(source))
  const sameOrAdjacentRow =
    dy <= rowLimit ||
    qualifiesForCrossLaneZoneAdjacentRows(source, target, process) ||
    isAdjacentHorizontalPair(source, target)

  if (!sameOrAdjacentRow) return false

  return isAdjacentHorizontalRouteClear(source, target, placed, excludeIds, process, edge)
}

function logEdgeHandleDebug(
  options: OrthogonalRouteOptions,
  result: OrthogonalRouteResult,
  routeType: string,
): void {
  if (options.edge.id !== EDGE_HANDLE_DEBUG_ID) return

  const { edge, source, target, process } = options
  const savedSourceHandle = resolveEdgeSourceHandle(edge)
  const savedTargetHandle = resolveEdgeTargetHandle(edge)
  const resolvedSourceHandle = result.sourceHandle
  const resolvedTargetHandle = result.targetHandle
  const sourceType = getNodeType(process, source.id)
  const targetType = getNodeType(process, target.id)
  const sourceAnchor = getHandlePoint(source, resolvedSourceHandle, 0.5, sourceType)
  const targetAnchor = getHandlePoint(target, resolvedTargetHandle, 0.5, targetType)

  console.debug('[Edge Handle Debug]', {
    edgeId: edge.id,
    handleAuto: edge.routing?.handleAuto ?? !hasUserSpecifiedHandles(edge),
    savedSourceHandle,
    savedTargetHandle,
    resolvedSourceHandle,
    resolvedTargetHandle,
    sourceAnchor,
    targetAnchor,
    routeType,
    points: result.points,
  })
}

function logEdgeRouterDebug(
  options: OrthogonalRouteOptions,
  result: OrthogonalRouteResult,
  routeType: string,
  candidates?: Point[][],
  candidateCosts?: number[],
): void {
  if (options.edge.id !== EDGE_ROUTER_DEBUG_ID) return

  const { source, target, edge, placed, process } = options
  const excludeIds = new Set([source.id, target.id])
  const sh = result.sourceHandle
  const th = result.targetHandle
  const sourceType = getNodeType(process, source.id)
  const targetType = getNodeType(process, target.id)
  const start = getHandlePoint(source, sh, 0.5, sourceType)
  const end = getHandlePoint(target, th, 0.5, targetType)
  const { dx, dy } = axisDistance(source, target)
  const bends = countOrthogonalBends(result.points)
  const obstacles = getHorizontalObstaclesBetween(
    source,
    target,
    placed,
    excludeIds,
    PRIORITY_ROUTE_NODE_PADDING,
    process,
  )

  console.debug('[EdgeRouter Debug]', {
    edgeId: edge.id,
    sourceId: source.id,
    targetId: target.id,
    sourceHandle: sh,
    targetHandle: th,
    sourceBBox: { x: source.x, y: source.y, w: source.width, h: source.height },
    targetBBox: { x: target.x, y: target.y, w: target.width, h: target.height },
    sourceAnchor: start,
    targetAnchor: end,
    dx,
    dy,
    routeType,
    bendCount: bends,
    obstacleHit: obstacles.length > 0,
    obstacleIds: obstacles.map((n) => n.id),
    candidateRoutes: candidates?.map((c) => simplifyPath(c)),
    candidateCosts,
    selectedRoute: result.points,
  })
}

function logEdgeCollisionDebug(
  options: OrthogonalRouteOptions,
  result: OrthogonalRouteResult,
  routeType: string,
): void {
  if (options.edge.id !== EDGE_COLLISION_DEBUG_ID) return
  const { edge, source, target, placed, process } = options
  const excludeIds = new Set([source.id, target.id])
  const nodeMargin = options.overviewMode
    ? overviewEdgeNodeMargin(edge)
    : PRIORITY_ROUTE_NODE_PADDING
  const collidedNodes = getCollidedNodes(result.points, placed, excludeIds, nodeMargin, process)
  console.debug('[Edge Collision Debug]', {
    edgeId: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: result.sourceHandle,
    targetHandle: result.targetHandle,
    points: result.points,
    collidedNodes,
    selectedRoute: result.points,
    bendCount: countOrthogonalBends(result.points),
    routeType,
    routingStatus: result.routingStatus,
    collisionError: result.collisionError,
  })
}

function resolveRouteNodeMargin(options: OrthogonalRouteOptions): number {
  return options.overviewMode
    ? overviewEdgeNodeMargin(options.edge)
    : PRIORITY_ROUTE_NODE_PADDING
}

function tryCollisionFreeReroute(
  options: OrthogonalRouteOptions,
  current: OrthogonalRouteResult,
): OrthogonalRouteResult | null {
  const { edge, source, target, placed, process, parallelIndex = 0, branchContext, minContentX = 0, existingSegments = [] } = options
  if (!process) return null

  const excludeIds = new Set([source.id, target.id])
  const nodeMargin = resolveRouteNodeMargin(options)
  const idx = branchContext?.parallelIndex ?? parallelIndex

  if (qualifiesForReturnFeedbackEdge(edge, source, target, process)) {
    const gutterCandidates = buildReturnGutterRouteCandidates(
      edge,
      source,
      target,
      placed,
      excludeIds,
      idx,
      process,
    )
    const selected = selectCollisionFreeReturnRoute(
      gutterCandidates,
      placed,
      excludeIds,
      nodeMargin,
      process,
    )
    if (selected) {
      const finalized = finalizeRoutedPath(
        selected.points,
        source,
        target,
        selected.sourceHandle,
        selected.targetHandle,
        { parallelIndex: idx, sourceAnchorRatio: 0.5, targetAnchorRatio: 0.5 },
        placed,
        excludeIds,
        nodeMargin,
        edge,
        process,
      )
      const label = resolveRouteEdgeLabel(options, finalized, existingSegments)
      return {
        path: pointsToPath(finalized, minContentX),
        points: finalized,
        bendPoints: extractBendPoints(finalized),
        sourceHandle: selected.sourceHandle,
        targetHandle: selected.targetHandle,
        ...routeLabelFields(label),
        routingStatus: 'reroutedDueToCollision',
      }
    }
  }

  const priorityCandidates = buildPriorityHandlePaths(
    source,
    target,
    current.sourceHandle,
    current.targetHandle,
    idx,
    placed,
    excludeIds,
    nodeMargin,
    { parallelIndex: idx, sourceAnchorRatio: 0.5, targetAnchorRatio: 0.5 },
    process,
  )
  const prioritySelected = selectPriorityHandlePath(priorityCandidates, placed, excludeIds, nodeMargin, process)
  if (prioritySelected && countNodeCollisions(prioritySelected, placed, excludeIds, nodeMargin, process) === 0) {
    const finalized = finalizeRoutedPath(
      prioritySelected,
      source,
      target,
      current.sourceHandle,
      current.targetHandle,
      { parallelIndex: idx },
      placed,
      excludeIds,
      nodeMargin,
      edge,
      process,
    )
    const label = resolveRouteEdgeLabel(options, finalized, existingSegments)
    return {
      path: pointsToPath(finalized, minContentX),
      points: finalized,
      bendPoints: extractBendPoints(finalized),
      sourceHandle: current.sourceHandle,
      targetHandle: current.targetHandle,
      ...routeLabelFields(label),
      routingStatus: 'reroutedDueToCollision',
    }
  }

  if (!hasUserSpecifiedHandles(edge)) {
    const pairCandidates = recommendHandlePairs(edge, source, target, branchContext)
    const sourceType = getNodeType(process, source.id)
    const targetType = getNodeType(process, target.id)
    const involvesDecision = isBranchNodeType(sourceType) || isBranchNodeType(targetType)

    for (const [sh, th] of pairCandidates) {
      if (sh === current.sourceHandle && th === current.targetHandle) continue

      if (involvesDecision) {
        const decisionRoute = routeDecisionAwareEdge(
          { ...options, suppressCollisionReroute: true },
          sh,
          th,
        )
        if (countNodeCollisions(decisionRoute.points, placed, excludeIds, nodeMargin, process) === 0) {
          return { ...decisionRoute, routingStatus: 'reroutedDueToCollision' }
        }
        continue
      }

      const altCandidates = buildPriorityHandlePaths(
        source,
        target,
        sh,
        th,
        idx,
        placed,
        excludeIds,
        nodeMargin,
        { parallelIndex: idx, sourceAnchorRatio: 0.5, targetAnchorRatio: 0.5 },
        process,
      )
      const points = selectPriorityHandlePath(altCandidates, placed, excludeIds, nodeMargin, process)
      if (!points || countNodeCollisions(points, placed, excludeIds, nodeMargin, process) > 0) continue

      const finalized = finalizeRoutedPath(
        points,
        source,
        target,
        sh,
        th,
        { parallelIndex: idx },
        placed,
        excludeIds,
        nodeMargin,
        edge,
        process,
      )
      const label = resolveRouteEdgeLabel(options, finalized, existingSegments)
      return {
        path: pointsToPath(finalized, minContentX),
        points: finalized,
        bendPoints: extractBendPoints(finalized),
        sourceHandle: sh,
        targetHandle: th,
        ...routeLabelFields(label),
        routingStatus: 'reroutedDueToCollision',
      }
    }
  }

  return null
}

function isLockedDecisionSameRowTopReturn(options: OrthogonalRouteOptions): boolean {
  const { edge, source, target, process } = options
  if (!hasUserSpecifiedHandles(edge)) return false
  if (resolveEdgeSourceHandle(edge) !== 'top' || resolveEdgeTargetHandle(edge) !== 'top') return false
  return process != null && qualifiesForDecisionSameRowTopReturn(edge, source, target, process)
}

function applyCollisionValidation(
  options: OrthogonalRouteOptions,
  result: OrthogonalRouteResult,
  routeType: string,
): OrthogonalRouteResult {
  const { source, target, placed, process } = options
  const excludeIds = new Set([source.id, target.id])
  const nodeMargin = resolveRouteNodeMargin(options)

  const preSimplify = result.points
  const simplified = removeDownRightUpUTurn(result.points)
  let next: OrthogonalRouteResult = {
    ...result,
    points: simplified,
    path: pointsToPath(simplified, options.minContentX ?? 0),
  }

  let collided = getCollidedNodes(next.points, placed, excludeIds, nodeMargin, process)
  if (collided.length > 0) {
    const preCollided = getCollidedNodes(preSimplify, placed, excludeIds, nodeMargin, process)
    if (preCollided.length === 0) {
      next = {
        ...next,
        points: preSimplify,
        path: pointsToPath(preSimplify, options.minContentX ?? 0),
      }
      collided = []
    }
  }

  if (collided.length > 0 && !options.suppressCollisionReroute) {
    const skipRerouteForStraightCrossZone =
      process != null &&
      qualifiesForSameLaneCrossZoneStraightVertical(source, target, process) &&
      getCollidedNodes(preSimplify, placed, excludeIds, nodeMargin, process).length === 0

    if (!skipRerouteForStraightCrossZone) {
      console.warn(
        `[EdgeRouter] Route collision detected (${options.edge.id}): ${collided.map((n) => n.name).join(', ')}`,
      )
      const rerouted = tryCollisionFreeReroute(options, next)
      if (rerouted) {
        next = rerouted
        collided = getCollidedNodes(next.points, placed, excludeIds, nodeMargin, process)
      }
    } else {
      next = {
        ...next,
        points: preSimplify,
        path: pointsToPath(preSimplify, options.minContentX ?? 0),
      }
      collided = []
    }
  }

  if (collided.length > 0 && !isLockedDecisionSameRowTopReturn(options)) {
    next = {
      ...next,
      collidedNodes: collided,
    }
  }

  const bendCount = countOrthogonalBends(next.points)
  const skipReturnCollisionValidation = isLockedDecisionSameRowTopReturn(options)
  const validation = resolveEdgeRouteValidation({
    hasNodeCollision: skipReturnCollisionValidation ? false : collided.length > 0,
    collidedNodes: skipReturnCollisionValidation ? [] : collided,
    routingStatus: next.routingStatus,
    bendCount,
    pathEmpty: next.points.length < 2,
    manualRoute: isManualRouteEdge(options.edge),
  })

  next = {
    ...next,
    validationStatus: validation.validationStatus,
    routeValidation: validation,
    collisionError: validation.validationStatus === 'error' && validation.routeIssue === 'node_collision',
  }

  logEdgeCollisionDebug(options, next, routeType)
  return next
}

function finishOrthogonalRoute(
  options: OrthogonalRouteOptions,
  result: OrthogonalRouteResult,
  routeType: string,
  candidates?: Point[][],
  candidateCosts?: number[],
): OrthogonalRouteResult {
  let next = result
  next = validateRightSideShortRoute(options, next)
  next = validateSameLaneVerticalSideBracketRoute(options, next)
  next = validateSameLaneSideTopOneBendRoute(options, next)
  next = validateSameLaneBracketReturnRoute(options, next)
  next = validateCrossZoneGapBottomTopRoute(options, next)
  next = validateCrossLaneRightLeftRoute(options, next)
  next = applyCollisionValidation(options, next, routeType)
  logEdgeRouterDebug(options, next, routeType, candidates, candidateCosts)
  logEdgeHandleDebug(options, next, routeType)
  return next
}

function validateRightSideShortRoute(
  options: OrthogonalRouteOptions,
  result: OrthogonalRouteResult,
): OrthogonalRouteResult {
  const { edge, source, target, placed, process, minContentX = 0, existingSegments = [], parallelIndex = 0, branchContext } = options
  if (!process) return result
  if (hasUserSpecifiedHandles(edge)) return result

  const excludeIds = new Set([source.id, target.id])
  if (!qualifiesForSameRowRightTargetShortRoute(edge, source, target, placed, excludeIds, process)) {
    return result
  }

  const bends = countOrthogonalBends(result.points)
  const obstacles = getHorizontalObstaclesBetween(
    source,
    target,
    placed,
    excludeIds,
    PRIORITY_ROUTE_NODE_PADDING,
    process,
  )
  if (obstacles.length > 0 || bends < 2) return result

  console.warn(
    `[EdgeRouter] Unnecessary detour detected: right-side target should use horizontal or 1-bend route (${edge.id})`,
  )

  const sourceType = getNodeType(process, source.id)
  const targetType = getNodeType(process, target.id)
  const sourceHandle: EdgeHandleId = resolveEdgeSourceHandle(edge) ?? 'right'
  const targetHandle: EdgeHandleId = resolveEdgeTargetHandle(edge) ?? 'left'
  const idx = branchContext?.parallelIndex ?? parallelIndex
  const points =
    resolveClearAdjacentHorizontalPath(
      source,
      target,
      placed,
      excludeIds,
      process,
      edge,
      idx,
    ) ??
    buildAdjacentHorizontalPath(source, target, sourceType, targetType, process)
  const finalized = finalizeRoutedPath(
    points,
    source,
    target,
    sourceHandle,
    targetHandle,
    { parallelIndex: idx },
    placed,
    excludeIds,
    PRIORITY_ROUTE_NODE_PADDING,
    edge,
    process,
  )
  const label = resolveRouteEdgeLabel(options, finalized, existingSegments)

  return {
    path: pointsToPath(finalized, minContentX),
    points: finalized,
    bendPoints: extractBendPoints(finalized),
    sourceHandle,
    targetHandle,
    ...routeLabelFields(label),
    exactEndpoints: true,
  }
}

/** same-lane ] bracket — stale manual / over-bend 경로를 1-bend L 또는 compact bracket으로 교정 */
function validateSameLaneVerticalSideBracketRoute(
  options: OrthogonalRouteOptions,
  result: OrthogonalRouteResult,
): OrthogonalRouteResult {
  const { edge, source, target, process } = options
  if (!process) return result

  const sh = result.sourceHandle
  const th = result.targetHandle
  if (!qualifiesForSameLaneVerticalSideBracket(source, target, sh, th, process)) {
    return result
  }
  if (sh !== 'right' && sh !== 'left') return result

  const bends = countOrthogonalBends(result.points)
  if (bends <= 1) return result

  console.warn(
    `[EdgeRouter] Stale over-bend side route (${edge.id}): ${bends} bends, rerouting compact L`,
  )

  const oneBend = routeSameLaneVerticalOneBendEdge(options, sh, th)
  if (oneBend && countOrthogonalBends(oneBend.points) < bends) {
    return oneBend
  }

  const bracket = routeBracketEdge(options, sh as BracketSide, sh, th)
  if (countOrthogonalBends(bracket.points) >= bends) return result
  return bracket
}

/** same-lane side→top — 1-bend L (수평 → 수직)으로 교정 */
function validateSameLaneSideTopOneBendRoute(
  options: OrthogonalRouteOptions,
  result: OrthogonalRouteResult,
): OrthogonalRouteResult {
  const { edge, source, target, process } = options
  if (!process) return result

  const sh = result.sourceHandle
  const th = result.targetHandle
  if (!qualifiesForSameLaneSideTopOneBend(source, target, sh, th, process)) return result

  const bends = countOrthogonalBends(result.points)
  if (bends <= 1) return result

  console.warn(
    `[EdgeRouter] Stale over-bend side→top route (${edge.id}): ${bends} bends, rerouting 1-bend L`,
  )

  const oneBend = routeSameLaneSideTopOneBendEdge(options, sh)
  if (!oneBend || countOrthogonalBends(oneBend.points) >= bends) return result
  return oneBend
}

/** same-lane upward return — gutter/legacy 경로가 3+ bend면 2-bend bracket으로 교정 */
function validateSameLaneBracketReturnRoute(
  options: OrthogonalRouteOptions,
  result: OrthogonalRouteResult,
): OrthogonalRouteResult {
  const { edge, source, target, process } = options
  if (!process) return result
  if (prefersForwardDetailColumnUpwardRoute(edge, source, target, process)) return result
  if (!qualifiesForSameLaneBracketReturn(edge, source, target, process)) return result

  const bends = countOrthogonalBends(result.points)
  if (bends <= 2) return result

  console.warn(
    `[EdgeRouter] Stale over-bend upward return (${edge.id}): ${bends} bends, rerouting 2-bend bracket`,
  )

  const bracket = routeSameLaneBracketReturnEdge(options)
  if (countOrthogonalBends(bracket.points) >= bends) return result
  return bracket
}

/** cross-zone gap bottom→top — zone gap corridor 2-bend 경로로 교정 */
function validateCrossZoneGapBottomTopRoute(
  options: OrthogonalRouteOptions,
  result: OrthogonalRouteResult,
): OrthogonalRouteResult {
  const { edge, source, target, process } = options
  if (!process) return result

  const sh = result.sourceHandle
  const th = result.targetHandle
  if (sh !== 'bottom' || th !== 'top') return result
  if (!qualifiesForCrossZoneGapVerticalDrop(source, target, process)) return result

  const bends = countOrthogonalBends(result.points)
  if (bends <= 2) return result

  console.warn(
    `[EdgeRouter] Stale over-bend cross-zone route (${edge.id}): ${bends} bends, rerouting 2-bend gap path`,
  )

  const rerouted = routeDownwardBottomTopEdge(options, 'bottom', 'top')
  if (countOrthogonalBends(rerouted.points) >= bends) return result
  return rerouted
}

/** cross-lane right→left — gutter L-path가 2 bend인데 detour로 4+ bend인 경우 교정 */
function validateCrossLaneRightLeftRoute(
  options: OrthogonalRouteOptions,
  result: OrthogonalRouteResult,
): OrthogonalRouteResult {
  const {
    edge,
    source,
    target,
    placed,
    process,
    parallelIndex = 0,
    branchContext,
    minContentX = 0,
    existingSegments = [],
  } = options
  if (!process) return result
  if (result.sourceHandle !== 'right' || result.targetHandle !== 'left') return result
  if (!nodesShareOverviewZoneDifferentLane(source, target, process)) return result

  const bends = countOrthogonalBends(result.points)
  if (bends <= 2) return result

  const excludeIds = new Set([source.id, target.id])
  const idx = branchContext?.parallelIndex ?? parallelIndex
  const points = resolveClearAdjacentHorizontalPath(
    source,
    target,
    placed,
    excludeIds,
    process,
    edge,
    idx,
  )
  if (!points) return result

  const finalized = finalizeRoutedPath(
    points,
    source,
    target,
    'right',
    'left',
    { parallelIndex: idx },
    placed,
    excludeIds,
    PRIORITY_ROUTE_NODE_PADDING,
    edge,
    process,
  )
  const compactBends = countOrthogonalBends(finalized)
  if (compactBends >= bends) return result

  console.warn(
    `[EdgeRouter] Cross-lane right→left over-bend (${edge.id}): ${bends} → ${compactBends} bends`,
  )
  const label = resolveRouteEdgeLabel(options, finalized, existingSegments)
  return {
    path: pointsToPath(finalized, minContentX),
    points: finalized,
    bendPoints: extractBendPoints(finalized),
    sourceHandle: 'right',
    targetHandle: 'left',
    ...routeLabelFields(label),
    exactEndpoints: true,
  }
}

function routeSameRowRightTargetEdge(options: OrthogonalRouteOptions): OrthogonalRouteResult {
  const {
    edge,
    source,
    target,
    placed,
    parallelIndex = 0,
    branchContext,
    minContentX = 0,
    existingSegments = [],
    process,
  } = options

  const excludeIds = new Set([source.id, target.id])
  const sourceType = getNodeType(process, source.id)
  const targetType = getNodeType(process, target.id)
  const sourceHandle: EdgeHandleId = resolveEdgeSourceHandle(edge) ?? 'right'
  const targetHandle: EdgeHandleId = resolveEdgeTargetHandle(edge) ?? 'left'
  const idx = branchContext?.parallelIndex ?? parallelIndex

  const points =
    resolveClearAdjacentHorizontalPath(
      source,
      target,
      placed,
      excludeIds,
      process,
      edge,
      idx,
      PRIORITY_ROUTE_NODE_PADDING,
    ) ??
    buildAdjacentHorizontalPath(source, target, sourceType, targetType, process)
  const finalized = finalizeRoutedPath(
    points,
    source,
    target,
    sourceHandle,
    targetHandle,
    { parallelIndex: idx },
    placed,
    excludeIds,
    PRIORITY_ROUTE_NODE_PADDING,
    edge,
    process,
  )
  const label = resolveRouteEdgeLabel(options, finalized, existingSegments)

  return finishOrthogonalRoute(
    options,
    {
      path: pointsToPath(finalized, minContentX),
      points: finalized,
      bendPoints: extractBendPoints(finalized),
      sourceHandle,
      targetHandle,
      ...routeLabelFields(label),
      exactEndpoints: true,
    },
    'same-row-right-target',
  )
}

function getProcessNodeMeta(nodeId: string, process: Process) {
  const node = process.nodes.find((n) => n.id === nodeId)
  if (!node) return null
  return {
    processZone: node.processZone,
    laneId: node.laneId,
    cellOrder: node.cellOrder ?? node.zoneOrder ?? 0,
    phaseOrder: node.phaseOrder,
    localOrder: node.localOrder,
    detailColumn: node.detailLayout?.column,
    detailRow: node.detailLayout?.row,
  }
}

export function isSameCellEdge(
  source: PlacedNode,
  target: PlacedNode,
  process?: Process,
): boolean {
  if (!process) return false
  const s = getProcessNodeMeta(source.id, process)
  const t = getProcessNodeMeta(target.id, process)
  if (!s?.processZone || !t?.processZone) return false
  return s.laneId === t.laneId && s.processZone === t.processZone
}

function isAdjacentCellOrder(source: PlacedNode, target: PlacedNode, process?: Process): boolean {
  if (!process) return false
  const s = getProcessNodeMeta(source.id, process)
  const t = getProcessNodeMeta(target.id, process)
  if (!s || !t || s.laneId !== t.laneId || s.processZone !== t.processZone) return false
  return Math.abs(s.cellOrder - t.cellOrder) === 1
}

/** 같은 cell에서 중간 노드를 건너뛰는 edge (예: cellOrder 1 → 3) */
export function isSameCellSkipEdge(
  source: PlacedNode,
  target: PlacedNode,
  placed: PlacedNode[],
  process?: Process,
): boolean {
  return getSameCellBlockers(source, target, placed, process).length > 0
}

export function isNearEdge(
  source: PlacedNode,
  target: PlacedNode,
  process?: Process,
): boolean {
  const { dx, dy } = axisDistance(source, target)
  if (dx < LOCAL_ROUTING_DISTANCE || dy < LOCAL_ROUTING_DISTANCE) return true
  if (centerDistance(source, target) < NEAR_EDGE_CENTER_DISTANCE) return true
  if (isSameCellEdge(source, target, process)) return true
  if (isAdjacentCellOrder(source, target, process)) return true
  return false
}

function localRouteBounds(source: PlacedNode, target: PlacedNode, margin = 48) {
  return {
    minX: Math.min(source.x, target.x) - margin,
    maxX: Math.max(source.x + source.width, target.x + target.width) + margin,
    minY: Math.min(source.y, target.y) - margin,
    maxY: Math.max(source.y + source.height, target.y + target.height) + margin,
  }
}

function isExternalRoute(points: Point[], source: PlacedNode, target: PlacedNode): boolean {
  if (isOuterDetour(points, source, target)) return true
  const bounds = localRouteBounds(source, target)
  for (const p of points) {
    if (p.x < bounds.minX || p.x > bounds.maxX || p.y < bounds.minY || p.y > bounds.maxY) return true
  }
  return false
}

function getConnectorCircularAnchor(node: PlacedNode, handle: EdgeHandleId): Point {
  const cx = node.x + node.width / 2
  const cy = node.y + node.height / 2
  const radius = Math.min(node.width, node.height) / 2
  switch (handle) {
    case 'top':
      return { x: cx, y: cy - radius }
    case 'bottom':
      return { x: cx, y: cy + radius }
    case 'left':
      return { x: cx - radius, y: cy }
    case 'right':
      return { x: cx + radius, y: cy }
  }
}

export function getHandlePoint(
  node: PlacedNode,
  handle: EdgeHandleId,
  anchorRatio = 0.5,
  nodeType?: string,
): Point {
  if (isDecisionNodeType(nodeType)) {
    return getDecisionDiamondVertex(node, handle)
  }

  if (isConnectorNodeType(nodeType)) {
    return getConnectorCircularAnchor(node, handle)
  }

  const ratio = Math.min(0.85, Math.max(0.15, anchorRatio))
  const cx = node.x + node.width / 2
  const cy = node.y + node.height / 2
  switch (handle) {
    case 'top':
      return { x: node.x + node.width * ratio, y: node.y }
    case 'bottom':
      return { x: node.x + node.width * ratio, y: node.y + node.height }
    case 'left':
      return { x: node.x, y: node.y + node.height * ratio }
    case 'right':
      return { x: node.x + node.width, y: node.y + node.height * ratio }
    default:
      return { x: cx, y: cy }
  }
}

type PathAnchorOptions = {
  sourceAnchorRatio?: number
  targetAnchorRatio?: number
  segmentOffset?: number
  targetSegmentOffset?: number
  parallelIndex?: number
}

function resolvePathAnchors(
  parallelIndex: number,
  branchContext?: EdgeBranchContext,
): PathAnchorOptions {
  return {
    sourceAnchorRatio: branchContext?.sourceAnchorRatio ?? 0.5,
    targetAnchorRatio: branchContext?.targetAnchorRatio ?? 0.5,
    segmentOffset: branchContext?.segmentOffset ?? 0,
    targetSegmentOffset: branchContext?.targetSegmentOffset ?? 0,
    parallelIndex: branchContext?.parallelIndex ?? parallelIndex,
  }
}

function isHorizontalHandle(handle: EdgeHandleId): boolean {
  return handle === 'left' || handle === 'right'
}

/** 수평 segment → y, 수직 segment → x 만 이동 (사선 금지) */
function offsetLanePoint(
  point: Point,
  axis: 'horizontal' | 'vertical',
  offset: number,
): Point {
  if (offset === 0) return point
  return axis === 'horizontal'
    ? { x: point.x, y: point.y + offset }
    : { x: point.x + offset, y: point.y }
}

export function isOrthogonalSegment(a: Point, b: Point): boolean {
  return Math.abs(a.x - b.x) < ORTHO_EPS || Math.abs(a.y - b.y) < ORTHO_EPS
}

function orthogonalCorner(prev: Point, curr: Point, prevPrev?: Point): Point {
  const viaA: Point = { x: curr.x, y: prev.y }
  const viaB: Point = { x: prev.x, y: curr.y }
  if (!prevPrev) return viaA
  const prevHoriz = Math.abs(prevPrev.y - prev.y) < ORTHO_EPS
  return prevHoriz ? viaA : viaB
}

type OrthogonalValidateOptions = {
  placed?: PlacedNode[]
  excludeIds?: Set<string>
  nodeMargin?: number
}

function pickOrthogonalCorner(
  prev: Point,
  curr: Point,
  prevPrev: Point | undefined,
  options?: OrthogonalValidateOptions,
): Point {
  const viaA: Point = { x: curr.x, y: prev.y }
  const viaB: Point = { x: prev.x, y: curr.y }

  if (options?.placed && options.excludeIds) {
    const margin = options.nodeMargin ?? EDGE_NODE_MARGIN
    const costA = countNodeCollisions([prev, viaA, curr], options.placed, options.excludeIds, margin)
    const costB = countNodeCollisions([prev, viaB, curr], options.placed, options.excludeIds, margin)
    if (costA < costB) return viaA
    if (costB < costA) return viaB
  }

  return orthogonalCorner(prev, curr, prevPrev)
}

/** 모든 segment가 수평/수직인지 검증하고 사선은 직각 bend로 보정 */
export function validateOrthogonalPath(
  points: Point[],
  options?: OrthogonalValidateOptions,
): Point[] {
  if (points.length < 2) return points

  const result: Point[] = [points[0]]
  for (let i = 1; i < points.length; i++) {
    const prev = result[result.length - 1]
    const curr = points[i]
    if (prev.x === curr.x && prev.y === curr.y) continue

    if (isOrthogonalSegment(prev, curr)) {
      result.push(curr)
      continue
    }

    const prevPrev = result.length >= 2 ? result[result.length - 2] : undefined
    const corner = pickOrthogonalCorner(prev, curr, prevPrev, options)
    if (corner.x !== prev.x || corner.y !== prev.y) {
      result.push(corner)
    }
    result.push(curr)
  }

  return simplifyOrthogonal(result)
}

export function validateNoNodeCollision(
  points: Point[],
  placed: PlacedNode[],
  excludeIds: Set<string>,
  nodeMargin: number = EDGE_NODE_MARGIN,
  process?: Process,
): boolean {
  return countNodeCollisions(points, placed, excludeIds, nodeMargin, process) === 0
}

function segmentDirection(a: Point, b: Point): 'left' | 'right' | 'up' | 'down' | null {
  return getLastSegmentDirection([a, b])
}

function expectedApproachDirection(targetHandle: EdgeHandleId): 'left' | 'right' | 'up' | 'down' {
  switch (targetHandle) {
    case 'top':
      return 'down'
    case 'bottom':
      return 'up'
    case 'left':
      return 'right'
    case 'right':
      return 'left'
  }
}

function isOppositeDirection(
  a: 'left' | 'right' | 'up' | 'down',
  b: 'left' | 'right' | 'up' | 'down',
): boolean {
  return (
    (a === 'left' && b === 'right') ||
    (a === 'right' && b === 'left') ||
    (a === 'up' && b === 'down') ||
    (a === 'down' && b === 'up')
  )
}

const APPROACH_MIN_LEG = 16

function appendTargetApproachBend(
  route: Point[],
  newEnd: Point,
  expected: 'left' | 'right' | 'up' | 'down',
): Point[] {
  if (route.length === 0) return route

  const points = [...route]
  let prev = points[points.length - 1]
  const bends: Point[] = []

  switch (expected) {
    case 'down': {
      const preY = newEnd.y - APPROACH_MIN_LEG
      if (prev.y > preY + ORTHO_EPS) {
        bends.push({ x: prev.x, y: preY })
        prev = { x: prev.x, y: preY }
      }
      if (Math.abs(prev.x - newEnd.x) >= ORTHO_EPS) {
        bends.push({ x: newEnd.x, y: prev.y })
      }
      break
    }
    case 'up': {
      const preY = newEnd.y + APPROACH_MIN_LEG
      if (prev.y <= newEnd.y) {
        const detourX = prev.x + APPROACH_MIN_LEG * 2
        bends.push({ x: detourX, y: prev.y }, { x: detourX, y: preY })
        prev = bends[bends.length - 1]!
      }
      if (Math.abs(prev.x - newEnd.x) >= ORTHO_EPS) {
        bends.push({ x: newEnd.x, y: prev.y })
      } else if (prev.y <= newEnd.y + ORTHO_EPS) {
        bends.push({ x: prev.x, y: preY })
        if (Math.abs(prev.x - newEnd.x) >= ORTHO_EPS) bends.push({ x: newEnd.x, y: preY })
      }
      break
    }
    case 'right': {
      const preX = newEnd.x - APPROACH_MIN_LEG
      if (prev.x >= newEnd.x) {
        const detourY = prev.y + APPROACH_MIN_LEG * 2
        bends.push({ x: prev.x, y: detourY }, { x: preX, y: detourY })
        prev = bends[bends.length - 1]!
      }
      if (Math.abs(prev.y - newEnd.y) >= ORTHO_EPS) {
        bends.push({ x: prev.x, y: newEnd.y })
      } else if (prev.x >= newEnd.x - ORTHO_EPS) {
        bends.push({ x: preX, y: prev.y })
        if (Math.abs(prev.y - newEnd.y) >= ORTHO_EPS) bends.push({ x: preX, y: newEnd.y })
      }
      break
    }
    case 'left': {
      if (Math.abs(prev.y - newEnd.y) < ORTHO_EPS && prev.x < newEnd.x - ORTHO_EPS) {
        break
      }
      const preX = newEnd.x + APPROACH_MIN_LEG
      if (prev.x <= newEnd.x) {
        const detourY = prev.y + APPROACH_MIN_LEG * 2
        bends.push({ x: prev.x, y: detourY }, { x: preX, y: detourY })
        prev = bends[bends.length - 1]!
      }
      if (Math.abs(prev.y - newEnd.y) >= ORTHO_EPS) {
        bends.push({ x: prev.x, y: newEnd.y })
      } else if (prev.x <= newEnd.x + ORTHO_EPS) {
        bends.push({ x: preX, y: prev.y })
        if (Math.abs(prev.y - newEnd.y) >= ORTHO_EPS) bends.push({ x: preX, y: newEnd.y })
      }
      break
    }
  }

  return [...points, ...bends]
}

/** 마지막 segment가 target handle 접근 방향과 일치하도록 bend 보정 */
function ensureTargetApproach(
  route: Point[],
  newEnd: Point,
  targetHandle: EdgeHandleId,
): Point[] {
  if (route.length === 0) return route

  const expected = expectedApproachDirection(targetHandle)
  const prev = route[route.length - 1]!
  if (Math.abs(prev.x - newEnd.x) < ORTHO_EPS && Math.abs(prev.y - newEnd.y) < ORTHO_EPS) {
    return route.slice(0, -1)
  }

  // Cross-lane L-path: corridor already at target row, left of handle — horizontal approach from right
  if (
    expected === 'right' &&
    Math.abs(prev.y - newEnd.y) < ORTHO_EPS &&
    prev.x < newEnd.x - ORTHO_EPS
  ) {
    return route
  }

  const dir = segmentDirection(prev, newEnd)
  if (dir === expected) return route
  if (dir && isOppositeDirection(dir, expected)) {
    return appendTargetApproachBend(route.slice(0, -1), newEnd, expected)
  }
  return appendTargetApproachBend(route, newEnd, expected)
}

type EndpointOptions = {
  sourceIsDecision?: boolean
  targetIsDecision?: boolean
}

/**
 * path endpoint = target anchor. marker gap 없음.
 * 마지막 segment 방향이 target handle 접근 방향과 일치하도록 보정.
 */
/** path 첫·끝 점을 handle anchor에 고정 — simplify/stub 이후 drift 방지 */
export function snapPathEndpointsToHandles(
  points: Point[],
  sourceHandlePoint: Point,
  targetHandlePoint: Point,
): Point[] {
  if (points.length < 2) return points
  const snapped = points.map((p) => ({ ...p }))
  snapped[0] = { ...sourceHandlePoint }
  snapped[snapped.length - 1] = { ...targetHandlePoint }
  return snapped
}

function applyArrowMarkerEndpoints(
  points: Point[],
  _sourceHandle: EdgeHandleId,
  targetHandle: EdgeHandleId,
  sourceHandlePoint: Point,
  targetHandlePoint: Point,
  _options: EndpointOptions = {},
): Point[] {
  const newEnd: Point = { ...targetHandlePoint }
  const newStart: Point = { ...sourceHandlePoint }

  const expected = expectedApproachDirection(targetHandle)
  if (points.length >= 2) {
    const endPt = points[points.length - 1]!
    const endMatch = Math.hypot(endPt.x - newEnd.x, endPt.y - newEnd.y) < PATH_ENDPOINT_TOLERANCE
    const lastDir = getLastSegmentDirection(points)
    if (endMatch && lastDir === expected) {
      const result = [...points]
      result[0] = newStart
      result[result.length - 1] = newEnd
      return simplifyPath(result)
    }
  }

  const interior = points.length > 2 ? points.slice(1, -1) : []
  const route = ensureTargetApproach(interior, newEnd, targetHandle)
  let result = simplifyPath([newStart, ...route, newEnd])

  const lastDir = getLastSegmentDirection(result)
  if (lastDir !== expected && result.length >= 2) {
    const withoutEnd = result.slice(0, -1)
    const fixedRoute = appendTargetApproachBend(withoutEnd.slice(1), newEnd, expected)
    result = simplifyPath([newStart, ...fixedRoute, newEnd])
  }

  return result
}

/** 마지막 segment 방향 (arrow orientation 검증용) */
export function getLastSegmentDirection(points: Point[]): 'left' | 'right' | 'up' | 'down' | null {
  if (points.length < 2) return null
  const a = points[points.length - 2]!
  const b = points[points.length - 1]!
  if (Math.abs(a.y - b.y) < ORTHO_EPS) {
    return b.x >= a.x ? 'right' : 'left'
  }
  if (Math.abs(a.x - b.x) < ORTHO_EPS) {
    return b.y >= a.y ? 'down' : 'up'
  }
  return null
}

export type EdgePathValidationContext = {
  edge: Edge
  source: PlacedNode
  target: PlacedNode
  sourceHandle: EdgeHandleId
  targetHandle: EdgeHandleId
  sourceAnchorRatio?: number
  targetAnchorRatio?: number
  sourceType?: string
  targetType?: string
}

const PATH_ENDPOINT_TOLERANCE = 6

/** source→target path·marker 방향 검증 — 실패 시 console warning */
export function validateEdgePath(points: Point[], ctx: EdgePathValidationContext): boolean {
  const {
    edge,
    source,
    target,
    sourceHandle,
    targetHandle,
    sourceAnchorRatio = 0.5,
    targetAnchorRatio = 0.5,
    sourceType,
    targetType,
  } = ctx

  if (points.length < 2) {
    console.warn(`Invalid edge path: ${edge.id}`)
    return false
  }

  const sourcePt = getHandlePoint(source, sourceHandle, sourceAnchorRatio, sourceType)
  const targetPt = getHandlePoint(target, targetHandle, targetAnchorRatio, targetType)
  const expectedEnd: Point = { ...targetPt }

  const start = points[0]!
  const end = points[points.length - 1]!
  const startDist = Math.hypot(start.x - sourcePt.x, start.y - sourcePt.y)
  const endDist = Math.hypot(end.x - expectedEnd.x, end.y - expectedEnd.y)

  if (startDist > PATH_ENDPOINT_TOLERANCE) {
    console.warn(`Invalid edge path: ${edge.id}`)
    return false
  }

  if (endDist > PATH_ENDPOINT_TOLERANCE) {
    console.warn(`Invalid edge path: ${edge.id}`)
    return false
  }

  const lastDir = getLastSegmentDirection(points)
  const expectedDir = expectedApproachDirection(targetHandle)
  if (lastDir !== expectedDir) {
    console.warn(`Invalid edge path: ${edge.id}`)
    return false
  }

  const sc = nodeCenter(source)
  const tc = nodeCenter(target)
  const endNearTarget = Math.hypot(end.x - tc.x, end.y - tc.y)
  const endNearSource = Math.hypot(end.x - sc.x, end.y - sc.y)
  if (endNearSource + PATH_ENDPOINT_TOLERANCE < endNearTarget) {
    console.warn(`Invalid edge path: ${edge.id}`)
    return false
  }

  return true
}

function getNodeType(process: Process | undefined, nodeId: string): string | undefined {
  return process?.nodes.find((n) => n.id === nodeId)?.type
}

function finalizeRoutedPath(
  points: Point[],
  source: PlacedNode,
  target: PlacedNode,
  sourceHandle: EdgeHandleId,
  targetHandle: EdgeHandleId,
  anchors: PathAnchorOptions,
  placed: PlacedNode[],
  excludeIds: Set<string>,
  nodeMargin: number,
  edge?: Edge,
  process?: Process,
): Point[] {
  const sourceType = getNodeType(process, source.id)
  const targetType = getNodeType(process, target.id)
  const sourceRatio = isBranchNodeType(sourceType) ? 0.5 : (anchors.sourceAnchorRatio ?? 0.5)
  const targetRatio = isBranchNodeType(targetType) ? 0.5 : (anchors.targetAnchorRatio ?? 0.5)
  const sourcePt = getHandlePoint(source, sourceHandle, sourceRatio, sourceType)
  const targetPt = getHandlePoint(target, targetHandle, targetRatio, targetType)
  const validateOpts: OrthogonalValidateOptions = { placed, excludeIds, nodeMargin }

  let result = validateOrthogonalPath(points, validateOpts)
  result = applyArrowMarkerEndpoints(result, sourceHandle, targetHandle, sourcePt, targetPt, {
    sourceIsDecision: isBranchNodeType(sourceType),
    targetIsDecision: isBranchNodeType(targetType),
  })
  const beforeSimplify = result
  const simplified = simplifyPath(result)
  const beforeCollisionCount = countNodeCollisions(beforeSimplify, placed, excludeIds, nodeMargin, process)
  const simplifiedCollisionCount = countNodeCollisions(simplified, placed, excludeIds, nodeMargin, process)
  result =
    beforeCollisionCount < simplifiedCollisionCount
      ? beforeSimplify
      : simplified
  validateNoNodeCollision(result, placed, excludeIds, nodeMargin, process)

  result = snapPathEndpointsToHandles(result, sourcePt, targetPt)
  if (
    countNodeCollisions(result, placed, excludeIds, nodeMargin, process) >
      countNodeCollisions(beforeSimplify, placed, excludeIds, nodeMargin, process) &&
    validateNoNodeCollision(beforeSimplify, placed, excludeIds, nodeMargin, process)
  ) {
    result = snapPathEndpointsToHandles(beforeSimplify, sourcePt, targetPt)
  }

  if (edge) {
    validateEdgePath(result, {
      edge,
      source,
      target,
      sourceHandle,
      targetHandle,
      sourceAnchorRatio: sourceRatio,
      targetAnchorRatio: targetRatio,
      sourceType,
      targetType,
    })
  }

  return result
}

function exitPoint(from: Point, handle: EdgeHandleId, stub: number): Point {
  switch (handle) {
    case 'right':
      return { x: from.x + stub, y: from.y }
    case 'left':
      return { x: from.x - stub, y: from.y }
    case 'bottom':
      return { x: from.x, y: from.y + stub }
    case 'top':
      return { x: from.x, y: from.y - stub }
  }
}

function entryPoint(to: Point, handle: EdgeHandleId, stub: number): Point {
  switch (handle) {
    case 'right':
      return { x: to.x + stub, y: to.y }
    case 'left':
      return { x: to.x - stub, y: to.y }
    case 'bottom':
      return { x: to.x, y: to.y + stub }
    case 'top':
      return { x: to.x, y: to.y - stub }
  }
}

function expandNode(node: PlacedNode, margin: number, process?: Process) {
  const nodeType = process?.nodes.find((n) => n.id === node.id)?.type
  const extra = isBranchNodeType(nodeType) ? DECISION_NODE_LAYOUT.exclusionPadding : 0
  const pad = margin + extra
  return {
    x: node.x - pad,
    y: node.y - pad,
    width: node.width + pad * 2,
    height: node.height + pad * 2,
  }
}

function segmentIntersectsRect(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  rect: { x: number; y: number; width: number; height: number },
): boolean {
  const minX = Math.min(x1, x2)
  const maxX = Math.max(x1, x2)
  const minY = Math.min(y1, y2)
  const maxY = Math.max(y1, y2)

  if (Math.abs(y1 - y2) < 0.5) {
    const y = y1
    return y >= rect.y && y <= rect.y + rect.height && maxX >= rect.x && minX <= rect.x + rect.width
  }

  if (Math.abs(x1 - x2) < 0.5) {
    const x = x1
    return x >= rect.x && x <= rect.x + rect.width && maxY >= rect.y && minY <= rect.y + rect.height
  }

  // 사선 segment — 항상 충돌로 처리 (직교 경로만 허용)
  return true
}

function segmentTooCloseToEdge(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  existingSegments: Segment[],
  edgeGap: number = EDGE_EDGE_MARGIN,
): boolean {
  for (const seg of existingSegments) {
    if (Math.abs(y1 - y2) < 0.5 && Math.abs(seg.y1 - seg.y2) < 0.5) {
      if (Math.abs(y1 - seg.y1) < edgeGap) {
        const aMin = Math.min(x1, x2)
        const aMax = Math.max(x1, x2)
        const bMin = Math.min(seg.x1, seg.x2)
        const bMax = Math.max(seg.x1, seg.x2)
        if (aMax >= bMin && aMin <= bMax) return true
      }
    }
    if (Math.abs(x1 - x2) < 0.5 && Math.abs(seg.x1 - seg.x2) < 0.5) {
      if (Math.abs(x1 - seg.x1) < edgeGap) {
        const aMin = Math.min(y1, y2)
        const aMax = Math.max(y1, y2)
        const bMin = Math.min(seg.y1, seg.y2)
        const bMax = Math.max(seg.y1, seg.y2)
        if (aMax >= bMin && aMin <= bMax) return true
      }
    }
  }
  return false
}

function pathSegments(points: Point[]): Segment[] {
  const segments: Segment[] = []
  for (let i = 0; i < points.length - 1; i++) {
    segments.push({
      x1: points[i].x,
      y1: points[i].y,
      x2: points[i + 1].x,
      y2: points[i + 1].y,
    })
  }
  return segments
}

function countNodeCollisions(
  points: Point[],
  placed: PlacedNode[],
  excludeIds: Set<string>,
  nodeMargin: number = EDGE_NODE_MARGIN,
  process?: Process,
): number {
  return getCollidedNodes(points, placed, excludeIds, nodeMargin, process).length
}

function segmentIntersectsNodeForCollision(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  node: PlacedNode,
  nodeMargin: number,
  process?: Process,
): boolean {
  if (Math.abs(y1 - y2) < 0.5) {
    const y = y1
    if (y < node.y || y > node.y + node.height) return false
    const minX = Math.min(x1, x2)
    const maxX = Math.max(x1, x2)
    const nodeType = process?.nodes.find((n) => n.id === node.id)?.type
    const extra = isBranchNodeType(nodeType) ? DECISION_NODE_LAYOUT.exclusionPadding : 0
    const pad = nodeMargin + extra
    return maxX >= node.x - pad && minX <= node.x + node.width + pad
  }

  if (Math.abs(x1 - x2) < 0.5) {
    const x = x1
    if (x < node.x || x > node.x + node.width) return false
    const minY = Math.min(y1, y2)
    const maxY = Math.max(y1, y2)
    const nodeType = process?.nodes.find((n) => n.id === node.id)?.type
    const extra = isBranchNodeType(nodeType) ? DECISION_NODE_LAYOUT.exclusionPadding : 0
    const pad = nodeMargin + extra
    return maxY >= node.y - pad && minY <= node.y + node.height + pad
  }

  return segmentIntersectsRect(x1, y1, x2, y2, expandNode(node, nodeMargin, process))
}

export function getCollidedNodes(
  points: Point[],
  placed: PlacedNode[],
  excludeIds: Set<string>,
  nodeMargin: number = EDGE_NODE_MARGIN,
  process?: Process,
): CollidedNodeRef[] {
  const hit = new Set<string>()
  for (const seg of pathSegments(points)) {
    for (const node of placed) {
      if (excludeIds.has(node.id)) continue
      if (!isRoutingObstacleNode(node.id, process)) continue
      if (segmentIntersectsNodeForCollision(seg.x1, seg.y1, seg.x2, seg.y2, node, nodeMargin, process)) {
        hit.add(node.id)
      }
    }
  }
  return [...hit].map((id) => ({
    id,
    name: process?.nodes.find((node) => node.id === id)?.name ?? id,
  }))
}

/** Overview edge validation */
export function countNodeCollisionsOnPath(
  points: Point[],
  placed: PlacedNode[],
  excludeIds: Set<string>,
  nodeMargin: number,
  process?: Process,
): number {
  return countNodeCollisions(points, placed, excludeIds, nodeMargin, process)
}

function segmentsCross(a: Segment, b: Segment): boolean {
  const aHoriz = Math.abs(a.y1 - a.y2) < 0.5
  const bHoriz = Math.abs(b.y1 - b.y2) < 0.5
  if (aHoriz === bHoriz) return false
  const h = aHoriz ? a : b
  const v = aHoriz ? b : a
  const hx1 = Math.min(h.x1, h.x2)
  const hx2 = Math.max(h.x1, h.x2)
  const vx = v.x1
  const vy1 = Math.min(v.y1, v.y2)
  const vy2 = Math.max(v.y1, v.y2)
  return vx >= hx1 && vx <= hx2 && h.y1 >= vy1 && h.y1 <= vy2
}

function countEdgeCrossings(points: Point[], existingSegments: Segment[]): number {
  const segs = pathSegments(points)
  let count = 0
  for (const seg of segs) {
    for (const existing of existingSegments) {
      if (segmentsCross(seg, existing)) count += 1
    }
  }
  return count
}

function isOuterDetour(points: Point[], source: PlacedNode, target: PlacedNode): boolean {
  const bounds = {
    minX: Math.min(source.x, target.x) - 20,
    maxX: Math.max(source.x + source.width, target.x + target.width) + 20,
    minY: Math.min(source.y, target.y) - 20,
    maxY: Math.max(source.y + source.height, target.y + target.height) + 20,
  }
  for (const p of points) {
    if (p.x < bounds.minX - 80 || p.x > bounds.maxX + 80) return true
  }
  return false
}

function pathCost(
  points: Point[],
  source: PlacedNode,
  target: PlacedNode,
  placed: PlacedNode[],
  excludeIds: Set<string>,
  existingSegments: Segment[],
  overviewMode: boolean,
  nodeMargin: number,
  options: {
    sameCell?: boolean
    nearEdge?: boolean
  } = {},
  process?: Process,
): number {
  const simplified = simplifyOrthogonal(points)
  const bendCount = Math.max(0, simplified.length - 2)
  let cost = bendTierCost(bendCount) + pathLength(points) * 0.05

  if (source.laneId !== target.laneId) {
    cost += ROUTE_TIER_COST.laneCross
  }

  const external = isExternalRoute(points, source, target)
  if (external) {
    cost += ROUTE_TIER_COST.outerRoute
    if (options.sameCell || options.nearEdge) {
      cost += LOCAL_EXTERNAL_FORBIDDEN
    }
  } else if (overviewMode && isOuterDetour(points, source, target)) {
    cost += ROUTE_TIER_COST.outerRoute
  }

  const nodeCollisionCount = countNodeCollisions(points, placed, excludeIds, nodeMargin, process)
  const edgeCrossingCount = countEdgeCrossings(points, existingSegments)
  cost += nodeCollisionCount * NODE_COLLISION_COST + edgeCrossingCount * EDGE_CROSSING_COST

  return cost
}

function overviewEdgeNodeMargin(edge: Edge): number {
  const metrics = OVERVIEW_VERTICAL_METRICS
  return resolveEdgeType(edge) === 'return' ? metrics.edgeNodeMarginReturn : metrics.edgeNodeMargin
}

function pathTooCloseToExisting(points: Point[], existingSegments: Segment[], edgeGap: number): boolean {
  for (const seg of pathSegments(points)) {
    if (segmentTooCloseToEdge(seg.x1, seg.y1, seg.x2, seg.y2, existingSegments, edgeGap)) return true
  }
  return false
}

function simplifyOrthogonal(points: Point[]): Point[] {
  if (points.length <= 2) return points
  const result: Point[] = [points[0]]
  for (let i = 1; i < points.length; i++) {
    const prev = result[result.length - 1]
    const curr = points[i]
    if (prev.x === curr.x && prev.y === curr.y) continue
    result.push(curr)
  }
  const cleaned: Point[] = [result[0]]
  for (let i = 1; i < result.length - 1; i++) {
    const prev = cleaned[cleaned.length - 1]
    const curr = result[i]
    const next = result[i + 1]
    const colinearH = Math.abs(prev.y - curr.y) < ORTHO_EPS && Math.abs(curr.y - next.y) < ORTHO_EPS
    const colinearV = Math.abs(prev.x - curr.x) < ORTHO_EPS && Math.abs(curr.x - next.x) < ORTHO_EPS
    if (!colinearH && !colinearV) cleaned.push(curr)
  }
  cleaned.push(result[result.length - 1])
  return cleaned
}

function segmentLength(a: Point, b: Point): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y)
}

function removeShortColinearPoints(points: Point[]): Point[] {
  if (points.length <= 2) return points
  const result = [...points]
  let changed = true
  while (changed && result.length > 2) {
    changed = false
    for (let i = 1; i < result.length - 1; i++) {
      const prev = result[i - 1]!
      const curr = result[i]!
      const next = result[i + 1]!
      const dir1 = segmentDirection(prev, curr)
      const dir2 = segmentDirection(curr, next)
      const shortIn = segmentLength(prev, curr) <= MIN_SEGMENT_LENGTH
      const shortOut = segmentLength(curr, next) <= MIN_SEGMENT_LENGTH
      if ((shortIn || shortOut) && dir1 && dir2 && dir1 === dir2) {
        result.splice(i, 1)
        changed = true
        break
      }
    }
  }
  return result
}

/** 직교 path 단순화 — 동일 방향 병합, 180° 되돌림·중복·짧은 segment 제거 */
export function simplifyPath(points: Point[]): Point[] {
  const result = simplifyOrthogonal(points)
  if (result.length <= 2) return result

  const cleaned: Point[] = [result[0]!]
  for (let i = 1; i < result.length; i++) {
    const curr = result[i]!
    const prev = cleaned[cleaned.length - 1]!
    if (Math.abs(prev.x - curr.x) < ORTHO_EPS && Math.abs(prev.y - curr.y) < ORTHO_EPS) continue

    if (cleaned.length >= 2) {
      const prevPrev = cleaned[cleaned.length - 2]!
      const dir1 = segmentDirection(prevPrev, prev)
      const dir2 = segmentDirection(prev, curr)
      if (dir1 && dir2 && isOppositeDirection(dir1, dir2)) {
        cleaned.pop()
      }
    }

    const last = cleaned[cleaned.length - 1]!
    if (Math.abs(last.x - curr.x) < ORTHO_EPS && Math.abs(last.y - curr.y) < ORTHO_EPS) continue
    cleaned.push(curr)
  }

  return removeDownRightUpUTurn(removeShortColinearPoints(simplifyOrthogonal(cleaned)))
}

export function pointsToPath(points: Point[], minContentX = 0): string {
  const simplified = simplifyPath(points)
  return simplified
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${Math.max(p.x, minContentX)} ${p.y}`)
    .join(' ')
}

/** SVG path — curve 제거 후 직교 검증 */
export function ensureOrthogonalSvgPath(path: string, minContentX = 0): string {
  if (!path) return path
  return pointsToPath(parsePathPoints(path), minContentX)
}

export function extractBendPoints(fullPoints: Point[]): Point[] {
  const simplified = simplifyPath(fullPoints)
  if (simplified.length <= 2) return []
  return simplified.slice(1, -1)
}

function pathLength(points: Point[]): number {
  let len = 0
  for (let i = 0; i < points.length - 1; i++) {
    len += Math.abs(points[i + 1].x - points[i].x) + Math.abs(points[i + 1].y - points[i].y)
  }
  return len
}

function buildCorridorPaths(
  source: PlacedNode,
  target: PlacedNode,
  sourceHandle: EdgeHandleId,
  targetHandle: EdgeHandleId,
  placed: PlacedNode[],
  excludeIds: Set<string>,
  nodeMargin: number,
  parallelIndex: number,
  anchors: PathAnchorOptions = {},
  process?: Process,
): Point[][] {
  const start = getHandlePoint(source, sourceHandle, anchors.sourceAnchorRatio ?? 0.5)
  const end = getHandlePoint(target, targetHandle, anchors.targetAnchorRatio ?? 0.5)
  const idx = anchors.parallelIndex ?? parallelIndex
  const stub = HANDLE_STUB + Math.abs(idx) * 4
  const srcExit = exitPoint(start, sourceHandle, stub)
  const tgtEntry = entryPoint(end, targetHandle, stub)
  const edgeGap = OVERVIEW_VERTICAL_METRICS.edgeEdgeGap

  const minX = Math.min(source.x, target.x)
  const maxX = Math.max(source.x + source.width, target.x + target.width)
  const obstacles = filterRoutingObstacles(placed, excludeIds, process)
  const blockers = obstacles.filter(
    (n) =>
      n.x + n.width + nodeMargin > minX &&
      n.x - nodeMargin < maxX &&
      n.y + n.height > Math.min(source.y, target.y) - nodeMargin &&
      n.y < Math.max(source.y + source.height, target.y + target.height) + nodeMargin,
  )

  const globalTop =
    (obstacles.length > 0 ? Math.min(...obstacles.map((n) => n.y)) : source.y) -
    nodeMargin -
    16 -
    Math.abs(idx) * edgeGap
  const globalBottom =
    (obstacles.length > 0 ? Math.max(...obstacles.map((n) => n.y + n.height)) : source.y + source.height) +
    nodeMargin +
    16 +
    Math.abs(idx) * edgeGap

  const topY =
    blockers.length > 0
      ? Math.min(...blockers.map((n) => n.y)) - nodeMargin - 12 - Math.abs(idx) * edgeGap
      : globalTop
  const bottomY =
    blockers.length > 0
      ? Math.max(...blockers.map((n) => n.y + n.height)) + nodeMargin + 12 + Math.abs(idx) * edgeGap
      : globalBottom

  const paths: Point[][] = []
  const corridorYs = [topY, bottomY, globalTop, globalBottom]

  for (const corridorY of corridorYs) {
    paths.push(
      validateOrthogonalPath([
        start,
        srcExit,
        { x: srcExit.x, y: corridorY },
        { x: tgtEntry.x, y: corridorY },
        tgtEntry,
        end,
      ]),
    )
  }

  const detourX = maxX + 80 + Math.abs(idx) * edgeGap * 2
  paths.push(
    validateOrthogonalPath([
      start,
      srcExit,
      { x: detourX, y: srcExit.y },
      { x: detourX, y: tgtEntry.y },
      tgtEntry,
      end,
    ]),
  )

  return paths
}

function isLongOverviewEdge(
  source: PlacedNode,
  target: PlacedNode,
  metrics = OVERVIEW_VERTICAL_METRICS,
): boolean {
  return centerDistance(source, target) >= metrics.longHorizontalEdgeLength
}

function needsOverviewCorridor(
  source: PlacedNode,
  target: PlacedNode,
  process: Process | undefined,
): boolean {
  if (process && isSameCellEdge(source, target, process)) return false

  const sMeta = process ? getProcessNodeMeta(source.id, process) : null
  const tMeta = process ? getProcessNodeMeta(target.id, process) : null
  if (
    sMeta &&
    tMeta &&
    sMeta.processZone &&
    sMeta.processZone === tMeta.processZone &&
    sMeta.laneId === tMeta.laneId
  ) {
    return false
  }

  const crossSwimlane = Boolean(process && source.laneId !== target.laneId)
  const distance = centerDistance(source, target)

  if (!crossSwimlane && distance <= LONG_EDGE_DISTANCE) return false
  if (crossSwimlane || distance > LONG_EDGE_DISTANCE) return true

  return isLongOverviewEdge(source, target)
}

type ResolvedEdgeLabel = { point: Point; hidden: boolean; labelRect?: LabelRect }

function resolveEdgeLabel(
  edge: Edge,
  points: Point[],
  placed: PlacedNode[],
  excludeIds: Set<string>,
  minContentX: number,
  existingSegments: Segment[],
  process?: Process,
  existingLabelRects: LabelRect[] = [],
): ResolvedEdgeLabel {
  const sourceNode = process?.nodes.find((n) => n.id === edge.source)
  const targetNode = process?.nodes.find((n) => n.id === edge.target)
  const edgeType = resolveEdgeType(edge)
  const isDecisionBranch =
    isBranchNodeType(sourceNode?.type) || edgeType === 'condition'
  const preferFirstSegment = isDecisionBranch || Boolean(edge.label?.trim())
  const ownSegments = pathSegments(points)
  const nodeTypes = process
    ? new Map(process.nodes.map((node) => [node.id, node.type]))
    : undefined

  if (edge.label?.trim()) {
    const sourcePlaced = placed.find((p) => p.id === edge.source)
    const targetPlaced = placed.find((p) => p.id === edge.target)
    const sourceHandle =
      resolveEdgeSourceHandle(edge) ??
      (points.length >= 2 ? inferHandleFromPathSegment(points[0]!, points[1]!) : 'bottom')
    const targetHandle =
      resolveEdgeTargetHandle(edge) ??
      (points.length >= 2
        ? inferHandleFromPathSegment(points[points.length - 2]!, points[points.length - 1]!)
        : 'top')

    if (isBranchNodeType(sourceNode?.type)) {
      if (
        sourcePlaced &&
        targetPlaced &&
        process &&
        (qualifiesForDecisionSameRowTopReturn(edge, sourcePlaced, targetPlaced, process) ||
          qualifiesForDecisionSameRowLeftReturn(edge, sourcePlaced, targetPlaced, process))
      ) {
        const returnLabel = resolveDecisionSameRowReturnLabelPlacement({
          points,
          sourceHandle,
          minContentX,
          placed,
          excludeIds,
          ownSegments,
          labelText: edge.label,
          existingLabelRects,
          nodeTypes,
          sourcePlaced: sourcePlaced ?? undefined,
          sourceType: sourceNode?.type,
        })
        if (returnLabel) {
          return returnLabel
        }
      }

      const branchDeparture = resolveBranchDepartureLabelPlacement({
        points,
        sourceHandle,
        minContentX,
        placed,
        excludeIds,
        ownSegments,
        labelText: edge.label,
        existingLabelRects,
        nodeTypes,
        sourcePlaced: sourcePlaced ?? undefined,
        sourceType: sourceNode?.type,
      })
      return branchDeparture
    } else if (isBranchNodeType(targetNode?.type)) {
      const branchApproach = resolveBranchApproachLabelPlacement({
        points,
        targetHandle,
        minContentX,
        placed,
        excludeIds,
        ownSegments,
        labelText: edge.label,
        existingLabelRects,
        nodeTypes,
        targetPlaced: targetPlaced ?? undefined,
        targetType: targetNode?.type,
      })
      if (branchApproach) {
        return branchApproach
      }
    } else if (
      sourcePlaced &&
      targetPlaced &&
      sourceHandle === targetHandle &&
      (sourceHandle === 'right' || sourceHandle === 'left') &&
      targetPlaced.y > sourcePlaced.y + sourcePlaced.height * 0.2
    ) {
      const verticalDropLabel = resolveVerticalDropLegLabelPlacement({
        points,
        sourceHandle,
        minContentX,
        placed,
        excludeIds,
        ownSegments,
        labelText: edge.label,
        existingLabelRects,
        nodeTypes,
        sourcePlaced,
        sourceType: sourceNode?.type,
      })
      if (verticalDropLabel) {
        return verticalDropLabel
      }
    } else if (
      targetPlaced &&
      shouldPreferTargetLabelPlacement(edgeType, edge.label, sourceNode, targetNode)
    ) {
      const targetApproach = resolveBranchApproachLabelPlacement({
        points,
        targetHandle,
        minContentX,
        placed,
        excludeIds,
        ownSegments,
        labelText: edge.label,
        existingLabelRects,
        nodeTypes,
        targetPlaced,
        targetType: targetNode?.type,
      })
      if (targetApproach) {
        return targetApproach
      }
    }

    const preferTarget = shouldPreferTargetLabelPlacement(edgeType, edge.label, sourceNode, targetNode)

    return resolveLabelPlacement({
      points,
      minContentX,
      placed,
      excludeIds,
      existingSegments,
      ownSegments,
      preferFirstSegment: preferFirstSegment && !preferTarget,
      preferEndpointSegments: true,
      labelText: edge.label,
      existingLabelRects,
      nodeTypes,
      sourcePlaced: sourcePlaced ?? undefined,
      sourceType: sourceNode?.type,
      sourceHandle,
      alwaysVisible: isDecisionBranch,
    })
  }

  return { point: labelPointFromOrthogonalPath(points, minContentX, preferFirstSegment), hidden: false }
}

function resolveRouteEdgeLabel(
  options: OrthogonalRouteOptions,
  points: Point[],
  existingSegments: Segment[],
): ResolvedEdgeLabel {
  const { edge, source, target, placed, process, minContentX = 0, existingLabelRects = [] } = options
  const excludeIds = new Set([source.id, target.id])
  return resolveEdgeLabel(
    edge,
    points,
    placed,
    excludeIds,
    minContentX,
    existingSegments,
    process,
    existingLabelRects,
  )
}

function routeLabelFields(label: ResolvedEdgeLabel): Pick<OrthogonalRouteResult, 'labelPoint' | 'labelHidden' | 'labelRect'> {
  return {
    labelPoint: label.point,
    labelHidden: label.hidden,
    ...(label.labelRect ? { labelRect: label.labelRect } : {}),
  }
}

function getSameCellBlockers(
  source: PlacedNode,
  target: PlacedNode,
  placed: PlacedNode[],
  process?: Process,
): PlacedNode[] {
  if (!process) return []
  const s = getProcessNodeMeta(source.id, process)
  const t = getProcessNodeMeta(target.id, process)
  if (!s?.processZone || !t?.processZone) return []
  if (s.laneId !== t.laneId || s.processZone !== t.processZone) return []
  if (t.cellOrder <= s.cellOrder + 1) return []

  return placed.filter((node) => {
    if (node.id === source.id || node.id === target.id) return false
    const meta = getProcessNodeMeta(node.id, process)
    if (!meta || meta.laneId !== s.laneId || meta.processZone !== s.processZone) return false
    return meta.cellOrder > s.cellOrder && meta.cellOrder < t.cellOrder
  })
}

/** 2열 column-transition — source.right → target.left, 셀 내부 column gap만 사용 */
function buildColumnTransitionPaths(
  source: PlacedNode,
  target: PlacedNode,
  parallelIndex: number,
  anchors: PathAnchorOptions = {},
): Point[][] {
  const sourceHandle: EdgeHandleId = 'right'
  const targetHandle: EdgeHandleId = 'left'
  const start = getHandlePoint(source, sourceHandle, anchors.sourceAnchorRatio ?? 0.5)
  const end = getHandlePoint(target, targetHandle, anchors.targetAnchorRatio ?? 0.5)
  const idx = anchors.parallelIndex ?? parallelIndex
  const stub = HANDLE_STUB + Math.abs(idx) * 4
  const srcExit = exitPoint(start, sourceHandle, stub)
  const tgtEntry = entryPoint(end, targetHandle, stub)
  const offset =
    (anchors.segmentOffset ?? 0) !== 0 ? anchors.segmentOffset ?? 0 : idx * EDGE_OFFSET_STEP

  const wrap = (middles: Point[]): Point[] =>
    validateOrthogonalPath([start, srcExit, ...middles, tgtEntry, end])

  const gapX = (source.x + source.width + target.x) / 2 + offset
  const paths: Point[][] = []

  if (Math.abs(srcExit.y - tgtEntry.y) < 8) {
    paths.push(wrap([{ x: tgtEntry.x, y: srcExit.y }]))
  }

  paths.push(
    wrap([
      { x: gapX, y: srcExit.y },
      { x: gapX, y: tgtEntry.y },
    ]),
  )

  paths.push(wrap([{ x: srcExit.x, y: tgtEntry.y }]))

  const midY = (srcExit.y + tgtEntry.y) / 2
  paths.push(
    wrap([
      { x: gapX, y: srcExit.y },
      { x: gapX, y: midY },
      { x: tgtEntry.x, y: midY },
    ]),
  )

  return paths.map(simplifyOrthogonal)
}

function isColumnGapInternalRoute(
  points: Point[],
  source: PlacedNode,
  target: PlacedNode,
): boolean {
  const bounds = localRouteBounds(source, target, 40)
  return points.every(
    (p) =>
      p.x >= bounds.minX &&
      p.x <= bounds.maxX &&
      p.y >= bounds.minY &&
      p.y <= bounds.maxY,
  )
}

/** 같은 cell에서 중간 노드를 건너뛸 때 — 우측 detour로 bottom→top 직교 경로 */
function buildSameCellSkipPaths(
  source: PlacedNode,
  target: PlacedNode,
  placed: PlacedNode[],
  process: Process | undefined,
  parallelIndex: number,
  anchors: PathAnchorOptions = {},
): Point[][] {
  const blockers = getSameCellBlockers(source, target, placed, process)
  if (blockers.length === 0 && !isSameCellSkipEdge(source, target, placed, process)) return []

  const sourceHandle: EdgeHandleId = 'bottom'
  const targetHandle: EdgeHandleId = 'top'
  const start = getHandlePoint(source, sourceHandle, anchors.sourceAnchorRatio ?? 0.5)
  const end = getHandlePoint(target, targetHandle, anchors.targetAnchorRatio ?? 0.5)
  const idx = anchors.parallelIndex ?? parallelIndex
  const stub = HANDLE_STUB + Math.abs(idx) * 4
  const srcExit = exitPoint(start, sourceHandle, stub)
  const tgtEntry = entryPoint(end, targetHandle, stub)
  const offset = (anchors.segmentOffset ?? 0) !== 0
    ? anchors.segmentOffset ?? 0
    : idx * EDGE_OFFSET_STEP

  const detourX =
    Math.max(
      source.x + source.width,
      target.x + target.width,
      ...blockers.map((n) => n.x + n.width),
    ) +
    SAME_CELL_SKIP_DETOUR_MARGIN +
    Math.abs(offset)

  const wrap = (middles: Point[]): Point[] =>
    validateOrthogonalPath([start, srcExit, ...middles, tgtEntry, end])

  return [
    wrap([
      { x: detourX, y: srcExit.y + offset },
      { x: detourX, y: tgtEntry.y },
    ]),
    wrap([
      { x: srcExit.x + offset, y: srcExit.y },
      { x: detourX, y: srcExit.y + offset },
      { x: detourX, y: tgtEntry.y },
      { x: tgtEntry.x, y: tgtEntry.y },
    ]),
  ]
}

function nodeCenterX(node: PlacedNode): number {
  return node.x + node.width / 2
}

function nodeCenterY(node: PlacedNode): number {
  return node.y + node.height / 2
}

function isVerticallyAligned(source: PlacedNode, target: PlacedNode, tolerance = STRAIGHT_ALIGN_TOLERANCE): boolean {
  return Math.abs(nodeCenterX(source) - nodeCenterX(target)) <= tolerance
}

function isHorizontallyAligned(
  source: PlacedNode,
  target: PlacedNode,
  tolerance = STRAIGHT_ALIGN_TOLERANCE,
): boolean {
  return Math.abs(nodeCenterY(source) - nodeCenterY(target)) <= tolerance
}

function isAdjacentHorizontalPair(source: PlacedNode, target: PlacedNode): boolean {
  if (Math.abs(nodeCenterY(source) - nodeCenterY(target)) > SAME_ROW_Y_TOLERANCE) {
    return false
  }
  const sourceRight = source.x + source.width
  return target.x > sourceRight
}

function nodesShareOverviewZoneDifferentLane(
  source: PlacedNode,
  target: PlacedNode,
  process?: Process,
): boolean {
  if (!process) return false
  const s = getProcessNodeMeta(source.id, process)
  const t = getProcessNodeMeta(target.id, process)
  if (!s?.processZone || !t?.processZone) return false
  return s.processZone === t.processZone && s.laneId !== t.laneId
}

function qualifiesForCrossLaneZoneAdjacentRows(
  source: PlacedNode,
  target: PlacedNode,
  process?: Process,
): boolean {
  if (Math.abs(nodeCenterY(source) - nodeCenterY(target)) <= SAME_ROW_Y_TOLERANCE) {
    return true
  }
  if (!process) return false
  const sNode = process.nodes.find((n) => n.id === source.id)
  const tNode = process.nodes.find((n) => n.id === target.id)
  if (!sNode?.cellSlot || !tNode?.cellSlot) return false
  const maxRows = cellSlotRowsForProcess(process)
  const sRow = cellSlotToRowCol(sNode.cellSlot, maxRows).row
  const tRow = cellSlotToRowCol(tNode.cellSlot, maxRows).row
  return Math.abs(sRow - tRow) <= 2
}

/** right→left L-path — bbox가 아닌 실제 경로 collision 검사 */
function buildAdjacentHorizontalPathCandidates(
  source: PlacedNode,
  target: PlacedNode,
  sourceType: string | undefined,
  targetType: string | undefined,
  process?: Process,
  placed?: PlacedNode[],
  nodePadding = PRIORITY_ROUTE_NODE_PADDING,
): Point[][] {
  const start = getHandlePoint(source, 'right', 0.5, sourceType)
  const end = getHandlePoint(target, 'left', 0.5, targetType)
  const candidates: Point[][] = []

  if (process && placed && nodesShareOverviewZoneDifferentLane(source, target, process)) {
    for (const gutterX of resolveCrossLaneGutterCandidates(
      source,
      target,
      placed,
      process,
      nodePadding,
    )) {
      if (gutterX > start.x + HANDLE_STUB && gutterX < end.x - ORTHO_EPS) {
        candidates.push([
          start,
          { x: gutterX, y: start.y },
          { x: gutterX, y: end.y },
          end,
        ])
      }
    }
  }

  candidates.push(buildAdjacentHorizontalPath(source, target, sourceType, targetType, process))
  return candidates
}

function resolveClearAdjacentHorizontalPath(
  source: PlacedNode,
  target: PlacedNode,
  placed: PlacedNode[],
  excludeIds: Set<string>,
  process?: Process,
  edge?: Edge,
  parallelIndex = 0,
  nodePadding = PRIORITY_ROUTE_NODE_PADDING,
): Point[] | null {
  const sourceType = getNodeType(process, source.id)
  const targetType = getNodeType(process, target.id)
  for (const raw of buildAdjacentHorizontalPathCandidates(
    source,
    target,
    sourceType,
    targetType,
    process,
    placed,
    nodePadding,
  )) {
    const finalized = finalizeRoutedPath(
      raw,
      source,
      target,
      'right',
      'left',
      { parallelIndex },
      placed,
      excludeIds,
      nodePadding,
      edge,
      process,
    )
    if (countNodeCollisions(finalized, placed, excludeIds, nodePadding, process) === 0) {
      return raw
    }
  }
  return null
}

function isAdjacentHorizontalRouteClear(
  source: PlacedNode,
  target: PlacedNode,
  placed: PlacedNode[],
  excludeIds: Set<string>,
  process?: Process,
  edge?: Edge,
  parallelIndex = 0,
): boolean {
  return (
    resolveClearAdjacentHorizontalPath(
      source,
      target,
      placed,
      excludeIds,
      process,
      edge,
      parallelIndex,
    ) != null
  )
}

/** Overview Zone — 다른 lane · 인접 row · 좌→우 cross-lane 수평 연결 */
function qualifiesForCrossLaneZoneHorizontalBridge(
  source: PlacedNode,
  target: PlacedNode,
  placed: PlacedNode[],
  excludeIds: Set<string>,
  process?: Process,
  edge?: Edge,
): boolean {
  if (!nodesShareOverviewZoneDifferentLane(source, target, process)) return false
  if (target.x <= source.x + source.width - ORTHO_EPS) return false
  if (!qualifiesForCrossLaneZoneAdjacentRows(source, target, process)) return false
  return isAdjacentHorizontalRouteClear(source, target, placed, excludeIds, process, edge)
}

function buildAdjacentHorizontalPath(
  source: PlacedNode,
  target: PlacedNode,
  sourceType?: string,
  targetType?: string,
  process?: Process,
): Point[] {
  const start = getHandlePoint(source, 'right', 0.5, sourceType)
  const end = getHandlePoint(target, 'left', 0.5, targetType)
  const yDiff = Math.abs(start.y - end.y)
  const crossLaneAdjacentRow =
    process != null &&
    qualifiesForCrossLaneZoneAdjacentRows(source, target, process) &&
    nodesShareOverviewZoneDifferentLane(source, target, process)
  const yTolerance = crossLaneAdjacentRow ? SAME_ROW_Y_TOLERANCE * 2 : SAME_ROW_Y_TOLERANCE
  if (yDiff <= yTolerance) {
    if (yDiff <= ORTHO_EPS) {
      return [start, { x: end.x, y: start.y }]
    }
    const bendX = start.x + HANDLE_STUB
    return [start, { x: bendX, y: start.y }, { x: bendX, y: end.y }, end]
  }
  const crossLaneSameZone =
    process != null && nodesShareOverviewZoneDifferentLane(source, target, process)
  const preX = end.x - APPROACH_MIN_LEG
  const splitX = crossLaneSameZone ? start.x + HANDLE_STUB : preX
  return [start, { x: splitX, y: start.y }, { x: splitX, y: end.y }, end]
}

function qualifiesForAdjacentVerticalStraight(
  source: PlacedNode,
  target: PlacedNode,
  sourceType?: string,
  targetType?: string,
  placed?: PlacedNode[],
  excludeIds?: Set<string>,
  process?: Process,
): boolean {
  if (isBranchNodeType(sourceType) || isBranchNodeType(targetType)) return false
  if (!sharesColumnRange(source, target)) return false
  if (nodeCenterY(target) <= nodeCenterY(source) + 4) return false
  if (placed && excludeIds) {
    const obstacles = getVerticalObstaclesBetween(
      source,
      target,
      placed,
      excludeIds,
      PRIORITY_ROUTE_NODE_PADDING,
      process,
    )
    if (obstacles.length > 0) return false
  }
  return true
}

function buildAdjacentVerticalPath(
  source: PlacedNode,
  target: PlacedNode,
  sourceType?: string,
  targetType?: string,
): Point[] {
  const startBase = getHandlePoint(source, 'bottom', 0.5, sourceType)
  const endBase = getHandlePoint(target, 'top', 0.5, targetType)
  const columnX = sharedColumnX(source, target)
  if (columnX !== null) {
    return [
      { x: columnX, y: startBase.y },
      { x: columnX, y: endBase.y },
    ]
  }
  if (Math.abs(startBase.x - endBase.x) < ORTHO_EPS) {
    return [startBase, endBase]
  }
  const preY = endBase.y - APPROACH_MIN_LEG
  return [startBase, { x: startBase.x, y: preY }, { x: endBase.x, y: preY }, endBase]
}

function routeAdjacentVerticalStraightEdge(
  options: OrthogonalRouteOptions,
): OrthogonalRouteResult {
  const {
    edge,
    source,
    target,
    placed,
    parallelIndex = 0,
    branchContext,
    minContentX = 0,
    existingSegments = [],
    process,
  } = options

  const excludeIds = new Set([source.id, target.id])
  const nodePadding = PRIORITY_ROUTE_NODE_PADDING
  const sourceType = getNodeType(process, source.id)
  const targetType = getNodeType(process, target.id)
  const sourceHandle: EdgeHandleId = 'bottom'
  const targetHandle: EdgeHandleId = 'top'
  const idx = branchContext?.parallelIndex ?? parallelIndex

  const points = buildAdjacentVerticalPath(source, target, sourceType, targetType)
  const finalized = finalizeRoutedPath(
    points,
    source,
    target,
    sourceHandle,
    targetHandle,
    { parallelIndex: idx },
    placed,
    excludeIds,
    nodePadding,
    edge,
    process,
  )

  const label = resolveRouteEdgeLabel(options, finalized, existingSegments)

  return {
    path: pointsToPath(finalized, minContentX),
    points: finalized,
    bendPoints: extractBendPoints(finalized),
    sourceHandle,
    targetHandle,
    ...routeLabelFields(label),
    exactEndpoints: true,
  }
}

function resolveGeometryHandlePair(
  source: PlacedNode,
  target: PlacedNode,
  sourceType: string | undefined,
  targetType: string | undefined,
  placed?: PlacedNode[],
  excludeIds?: Set<string>,
  process?: Process,
  edge?: Edge,
): [EdgeHandleId, EdgeHandleId] | null {
  if (
    placed &&
    excludeIds &&
    qualifiesForCrossLaneZoneHorizontalBridge(source, target, placed, excludeIds, process, edge)
  ) {
    return ['right', 'left']
  }
  if (
    qualifiesForAdjacentHorizontalStraight(
      source,
      target,
      sourceType,
      targetType,
      placed,
      excludeIds,
      process,
      edge,
    )
  ) {
    return ['right', 'left']
  }
  if (qualifiesForAdjacentVerticalStraight(source, target, sourceType, targetType)) {
    return ['bottom', 'top']
  }
  if (
    branchDownwardSharesColumn(source, target, sourceType)
  ) {
    return ['bottom', 'top']
  }
  return null
}

function qualifiesForAdjacentHorizontalStraight(
  source: PlacedNode,
  target: PlacedNode,
  sourceType?: string,
  targetType?: string,
  placed?: PlacedNode[],
  excludeIds?: Set<string>,
  process?: Process,
  edge?: Edge,
): boolean {
  if (isBranchNodeType(sourceType)) return false
  if (isBranchNodeType(targetType)) {
    if (!placed || !excludeIds || !process) return false
    if (!nodesShareOverviewZoneDifferentLane(source, target, process)) return false
    if (target.x <= source.x + source.width - ORTHO_EPS) return false
    return isAdjacentHorizontalRouteClear(source, target, placed, excludeIds, process, edge)
  }
  if (!isAdjacentHorizontalPair(source, target)) return false
  if (placed && excludeIds) {
    const obstacles = getHorizontalObstaclesBetween(
      source,
      target,
      placed,
      excludeIds,
      PRIORITY_ROUTE_NODE_PADDING,
      process,
    )
    if (obstacles.length > 0) return false
  }
  return true
}

function routeAdjacentHorizontalStraightEdge(
  options: OrthogonalRouteOptions,
): OrthogonalRouteResult {
  const {
    edge,
    source,
    target,
    placed,
    parallelIndex = 0,
    branchContext,
    minContentX = 0,
    existingSegments = [],
    process,
  } = options

  const excludeIds = new Set([source.id, target.id])
  const nodePadding = PRIORITY_ROUTE_NODE_PADDING
  const sourceType = getNodeType(process, source.id)
  const targetType = getNodeType(process, target.id)
  const sourceHandle: EdgeHandleId = 'right'
  const targetHandle: EdgeHandleId = 'left'
  const idx = branchContext?.parallelIndex ?? parallelIndex

  const points =
    resolveClearAdjacentHorizontalPath(
      source,
      target,
      placed,
      excludeIds,
      process,
      edge,
      idx,
      nodePadding,
    ) ??
    buildAdjacentHorizontalPath(source, target, sourceType, targetType, process)
  const finalized = finalizeRoutedPath(
    points,
    source,
    target,
    sourceHandle,
    targetHandle,
    { parallelIndex: idx },
    placed,
    excludeIds,
    nodePadding,
    edge,
    process,
  )

  const label = resolveRouteEdgeLabel(options, finalized, existingSegments)

  return {
    path: pointsToPath(finalized, minContentX),
    points: finalized,
    bendPoints: extractBendPoints(finalized),
    sourceHandle,
    targetHandle,
    ...routeLabelFields(label),
    exactEndpoints: true,
  }
}

type HandlePathFrame = {
  start: Point
  end: Point
  srcExit: Point
  tgtEntry: Point
  wrap: (middles: Point[]) => Point[]
}

function buildHandlePathFrame(
  source: PlacedNode,
  target: PlacedNode,
  sourceHandle: EdgeHandleId,
  targetHandle: EdgeHandleId,
  parallelIndex: number,
  anchors: PathAnchorOptions = {},
  sourceType?: string,
  targetType?: string,
): HandlePathFrame {
  const sourceRatio = isBranchNodeType(sourceType) ? 0.5 : (anchors.sourceAnchorRatio ?? 0.5)
  const targetRatio = isBranchNodeType(targetType) ? 0.5 : (anchors.targetAnchorRatio ?? 0.5)
  const start = getHandlePoint(source, sourceHandle, sourceRatio, sourceType)
  const end = getHandlePoint(target, targetHandle, targetRatio, targetType)
  const idx = anchors.parallelIndex ?? parallelIndex
  const stub = HANDLE_STUB + Math.abs(idx) * 4
  const srcExit = isBranchNodeType(sourceType) ? start : exitPoint(start, sourceHandle, stub)
  const tgtEntry = isBranchNodeType(targetType) ? end : entryPoint(end, targetHandle, stub)
  const wrap = (middles: Point[]): Point[] => {
    const head = isBranchNodeType(sourceType) ? [start] : [start, srcExit]
    const tail = isBranchNodeType(targetType) ? [end] : [tgtEntry, end]
    return validateOrthogonalPath([...head, ...middles, ...tail])
  }
  return { start, end, srcExit, tgtEntry, wrap }
}

function isSameLaneEdge(source: PlacedNode, target: PlacedNode): boolean {
  return source.laneId === target.laneId
}

/** 같은 lane · 인접 zone — 아래로 내려가는 흐름 (사업실행품의→구매요청 등) */
function qualifiesForSameLaneCrossZoneVerticalDrop(
  source: PlacedNode,
  target: PlacedNode,
  process: Process,
): boolean {
  const sNode = process.nodes.find((n) => n.id === source.id)
  const tNode = process.nodes.find((n) => n.id === target.id)
  if (!sNode?.processZone || !tNode?.processZone) return false
  if (sNode.laneId !== tNode.laneId) return false
  if (sNode.processZone === tNode.processZone) return false
  return target.y > source.y + source.height * 0.2
}

/** 다른 lane · 위→아래 zone — zone gap corridor에서만 수평 전환 (전표생성→로열티집계 등) */
function qualifiesForCrossZoneCrossLaneVerticalDrop(
  source: PlacedNode,
  target: PlacedNode,
  process: Process,
): boolean {
  const sNode = process.nodes.find((n) => n.id === source.id)
  const tNode = process.nodes.find((n) => n.id === target.id)
  if (!sNode?.processZone || !tNode?.processZone) return false
  if (sNode.laneId === tNode.laneId) return false
  if (sNode.processZone === tNode.processZone) return false
  if (target.y <= source.y + source.height * 0.2) return false
  return compareZoneOrder(sNode.processZone, tNode.processZone) < 0
}

function qualifiesForCrossZoneGapVerticalDrop(
  source: PlacedNode,
  target: PlacedNode,
  process: Process,
): boolean {
  return (
    qualifiesForSameLaneCrossZoneVerticalDrop(source, target, process) ||
    qualifiesForCrossZoneCrossLaneVerticalDrop(source, target, process)
  )
}

/** cross-zone gap + 같은 lane + 같은 열(cellSlot/column) — 수직 직선 */
function qualifiesForSameLaneCrossZoneStraightVertical(
  source: PlacedNode,
  target: PlacedNode,
  process: Process,
): boolean {
  if (!qualifiesForSameLaneCrossZoneVerticalDrop(source, target, process)) return false
  return (
    sameLaneManualCellSlotColumn(source, target, process) ||
    sharesColumnRange(source, target) ||
    Math.abs(nodeCenterX(source) - nodeCenterX(target)) <= DOWNWARD_STRAIGHT_X_TOLERANCE
  )
}

function isDownwardBottomTopFlow(
  source: PlacedNode,
  target: PlacedNode,
  sourceHandle: EdgeHandleId,
  targetHandle: EdgeHandleId,
): boolean {
  return sourceHandle === 'bottom' && targetHandle === 'top' && target.y > source.y
}

/** source bottom ~ target top 사이 수직 통로의 obstacle */
function getVerticalObstaclesBetween(
  source: PlacedNode,
  target: PlacedNode,
  placed: PlacedNode[],
  excludeIds: Set<string>,
  padding: number,
  process?: Process,
): PlacedNode[] {
  const topY = source.y + source.height
  const bottomY = target.y
  if (bottomY <= topY) return []

  const corridorMinX = Math.min(source.x, target.x) - padding
  const corridorMaxX = Math.max(source.x + source.width, target.x + target.width) + padding

  return filterRoutingObstacles(placed, excludeIds, process).filter(
    (n) =>
      n.y + n.height + padding > topY &&
      n.y - padding < bottomY &&
      n.x + n.width + padding > corridorMinX &&
      n.x - padding < corridorMaxX,
  )
}

/** 단일 x 열에서 topY~bottomY 구간을 가로지르는 obstacle */
function getVerticalObstaclesAtX(
  x: number,
  topY: number,
  bottomY: number,
  placed: PlacedNode[],
  excludeIds: Set<string>,
  padding: number,
  process?: Process,
): PlacedNode[] {
  if (bottomY <= topY) return []
  return filterRoutingObstacles(placed, excludeIds, process).filter(
    (n) =>
      n.y + n.height + padding > topY &&
      n.y - padding < bottomY &&
      n.x - padding < x &&
      n.x + n.width + padding > x,
  )
}

/** 단일 y 행에서 leftX~rightX 구간을 가로지르는 obstacle */
function getHorizontalObstaclesAtY(
  y: number,
  leftX: number,
  rightX: number,
  placed: PlacedNode[],
  excludeIds: Set<string>,
  padding: number,
  process?: Process,
): PlacedNode[] {
  const minX = Math.min(leftX, rightX)
  const maxX = Math.max(leftX, rightX)
  if (maxX - minX <= ORTHO_EPS) return []
  return filterRoutingObstacles(placed, excludeIds, process).filter(
    (n) =>
      n.y - padding < y &&
      n.y + n.height + padding > y &&
      n.x + n.width + padding > minX &&
      n.x - padding < maxX,
  )
}

/** cross-lane 최종 수직 접근·corridor 수평 구간 obstacle 회피용 corridor Y */
function resolveCrossZoneFinalApproachCorridorY(
  baseCorridorY: number,
  sx: number,
  tx: number,
  tgtEntryY: number,
  target: PlacedNode,
  placed: PlacedNode[],
  excludeIds: Set<string>,
  nodePadding: number,
  process?: Process,
): number {
  let corridorY = baseCorridorY
  for (let i = 0; i < 8; i++) {
    let nextY = corridorY

    for (const obstacle of getVerticalObstaclesAtX(
      tx,
      corridorY,
      tgtEntryY,
      placed,
      excludeIds,
      nodePadding,
      process,
    )) {
      nextY = Math.max(nextY, obstacle.y + obstacle.height + nodePadding + 8)
    }

    for (const obstacle of getHorizontalObstaclesAtY(
      corridorY,
      sx,
      tx,
      placed,
      excludeIds,
      nodePadding,
      process,
    )) {
      nextY = Math.max(nextY, obstacle.y + obstacle.height + nodePadding + 8)
    }

    if (nextY <= corridorY + ORTHO_EPS) break
    corridorY = nextY
  }

  if (
    process &&
    getHorizontalObstaclesAtY(corridorY, sx, tx, placed, excludeIds, nodePadding, process).length > 0
  ) {
    const tNode = process.nodes.find((node) => node.id === target.id)
    if (tNode?.processZone) {
      const zoneCorridor = findClearCorridorYInTargetZone(
        tNode.processZone,
        sx,
        tx,
        baseCorridorY,
        placed,
        process,
        excludeIds,
        nodePadding,
      )
      if (zoneCorridor != null) return zoneCorridor
    }
  }

  return corridorY
}

function getPlacedNodesInProcessZone(
  zoneId: string,
  placed: PlacedNode[],
  process: Process,
): PlacedNode[] {
  return placed.filter((node) => {
    const meta = process.nodes.find((n) => n.id === node.id)
    return meta?.processZone === zoneId
  })
}

/** 같은 zone · lane gutter X 후보 — target-lane 좌측 · 경로상 인접 lane gap 우선 */
function resolveCrossLaneGutterCandidates(
  source: PlacedNode,
  target: PlacedNode,
  placed: PlacedNode[],
  process: Process,
  nodePadding: number,
): number[] {
  const sMeta = process.nodes.find((n) => n.id === source.id)
  const tMeta = process.nodes.find((n) => n.id === target.id)
  if (!sMeta?.processZone || !tMeta?.processZone) return []
  if (sMeta.processZone !== tMeta.processZone) return []
  if (sMeta.laneId === tMeta.laneId) return []

  const zoneNodes = getPlacedNodesInProcessZone(sMeta.processZone, placed, process)
  const laneRightEdge = (laneId: string): number | null => {
    const values = zoneNodes
      .filter((node) => process.nodes.find((n) => n.id === node.id)?.laneId === laneId)
      .map((node) => node.x + node.width)
    return values.length > 0 ? Math.max(...values) : null
  }
  const laneLeftEdge = (laneId: string): number | null => {
    const values = zoneNodes
      .filter((node) => process.nodes.find((n) => n.id === node.id)?.laneId === laneId)
      .map((node) => node.x)
    return values.length > 0 ? Math.min(...values) : null
  }

  const sortedLanes = [...process.lanes].sort((a, b) => a.order - b.order)
  const sourceOrder = sortedLanes.find((lane) => lane.id === sMeta.laneId)?.order
  const targetOrder = sortedLanes.find((lane) => lane.id === tMeta.laneId)?.order
  if (sourceOrder == null || targetOrder == null) return []

  const candidates: number[] = []
  const targetLeft = laneLeftEdge(tMeta.laneId)
  if (targetLeft != null) {
    candidates.push(targetLeft - nodePadding - 8)
  }

  const minOrder = Math.min(sourceOrder, targetOrder)
  const maxOrder = Math.max(sourceOrder, targetOrder)
  for (let order = minOrder; order < maxOrder; order++) {
    const leftLane = sortedLanes.find((lane) => lane.order === order)
    const rightLane = sortedLanes.find((lane) => lane.order === order + 1)
    if (!leftLane || !rightLane) continue
    const leftEdge = laneRightEdge(leftLane.id)
    const rightEdge = laneLeftEdge(rightLane.id)
    if (leftEdge == null || rightEdge == null) continue
    if (rightEdge <= leftEdge + nodePadding * 2) continue
    candidates.push(leftEdge + nodePadding + (rightEdge - leftEdge - nodePadding * 2) * 0.5)
  }

  const sourceRight = laneRightEdge(sMeta.laneId)
  if (sourceRight != null) {
    candidates.push(sourceRight + nodePadding + 8)
  }

  const seen = new Set<number>()
  const unique: number[] = []
  for (const value of candidates) {
    const rounded = Math.round(value * 10) / 10
    if (!Number.isFinite(rounded) || seen.has(rounded)) continue
    seen.add(rounded)
    unique.push(rounded)
  }
  return unique
}

function resolveZoneLeftGutterX(
  zoneId: string,
  placed: PlacedNode[],
  process: Process,
  nodePadding: number,
  minContentX = 0,
): number {
  const zoneNodes = getPlacedNodesInProcessZone(zoneId, placed, process)
  if (zoneNodes.length === 0) return minContentX + 8
  return Math.max(minContentX + 8, Math.min(...zoneNodes.map((node) => node.x)) - nodePadding - 16)
}

function resolveLaneDetourRightX(
  source: PlacedNode,
  topY: number,
  bottomY: number,
  placed: PlacedNode[],
  excludeIds: Set<string>,
  nodePadding: number,
  process?: Process,
): number {
  const minY = Math.min(topY, bottomY)
  const maxY = Math.max(topY, bottomY)
  const blockers = filterRoutingObstacles(placed, excludeIds, process).filter(
    (node) =>
      node.laneId === source.laneId &&
      node.y + node.height + nodePadding > minY &&
      node.y - nodePadding < maxY,
  )
  const base = source.x + source.width + nodePadding + 12
  if (blockers.length === 0) return base
  return Math.max(base, ...blockers.map((node) => node.x + node.width)) + nodePadding + 12
}

function resolveLaneDetourLeftX(
  source: PlacedNode,
  topY: number,
  bottomY: number,
  placed: PlacedNode[],
  excludeIds: Set<string>,
  nodePadding: number,
  process?: Process,
): number {
  const minY = Math.min(topY, bottomY)
  const maxY = Math.max(topY, bottomY)
  const blockers = filterRoutingObstacles(placed, excludeIds, process).filter(
    (node) =>
      node.laneId === source.laneId &&
      node.y + node.height + nodePadding > minY &&
      node.y - nodePadding < maxY,
  )
  const base = source.x - nodePadding - 12
  if (blockers.length === 0) return base
  return Math.min(base, ...blockers.map((node) => node.x)) - nodePadding - 12
}

function findClearHorizontalBandY(
  leftX: number,
  rightX: number,
  startY: number,
  endY: number,
  placed: PlacedNode[],
  excludeIds: Set<string>,
  nodePadding: number,
  process?: Process,
): number | null {
  const minX = Math.min(leftX, rightX)
  const maxX = Math.max(leftX, rightX)
  const fromY = Math.min(startY, endY)
  const toY = Math.max(startY, endY)

  for (let y = fromY; y <= toY; y += 6) {
    if (getHorizontalObstaclesAtY(y, minX, maxX, placed, excludeIds, nodePadding, process).length === 0) {
      return y
    }
  }
  return null
}

/** target zone 행 사이 gap — zone 내부에서 노드 없이 수평 이동 가능한 Y */
function findClearCorridorYInTargetZone(
  zoneId: string,
  sx: number,
  tx: number,
  minY: number,
  placed: PlacedNode[],
  process: Process,
  excludeIds: Set<string>,
  nodePadding: number,
): number | null {
  const zoneNodes = getPlacedNodesInProcessZone(zoneId, placed, process)
  if (zoneNodes.length === 0) return null

  const rowBands = [...zoneNodes]
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .reduce<Array<{ top: number; bottom: number }>>((bands, node) => {
      const last = bands[bands.length - 1]
      if (last && Math.abs(node.y - last.top) <= nodePadding + 4) {
        last.bottom = Math.max(last.bottom, node.y + node.height)
        return bands
      }
      bands.push({ top: node.y, bottom: node.y + node.height })
      return bands
    }, [])

  const candidates: number[] = []
  if (rowBands.length > 0) {
    candidates.push(rowBands[0]!.top - nodePadding - 10)
    for (let i = 0; i < rowBands.length - 1; i++) {
      candidates.push((rowBands[i]!.bottom + rowBands[i + 1]!.top) / 2)
    }
    candidates.push(rowBands[rowBands.length - 1]!.bottom + nodePadding + 10)
  }

  for (const y of [...new Set(candidates)].sort((a, b) => a - b)) {
    if (y < minY - nodePadding) continue
    if (getHorizontalObstaclesAtY(y, sx, tx, placed, excludeIds, nodePadding, process).length === 0) {
      return y
    }
  }
  return null
}

function appendCrossZoneSideGutterCandidates(
  candidates: Point[][],
  wrap: (middles: Point[]) => Point[],
  source: PlacedNode,
  target: PlacedNode,
  sx: number,
  tx: number,
  srcExit: Point,
  tgtEntry: Point,
  placed: PlacedNode[],
  excludeIds: Set<string>,
  nodePadding: number,
  process?: Process,
): void {
  if (!process) return
  const tNode = process.nodes.find((node) => node.id === target.id)
  if (!tNode?.processZone) return

  const gutterX = resolveZoneLeftGutterX(tNode.processZone, placed, process, nodePadding)
  const detourRight = resolveLaneDetourRightX(
    source,
    srcExit.y,
    tgtEntry.y,
    placed,
    excludeIds,
    nodePadding,
    process,
  )
  const detourLeft = resolveLaneDetourLeftX(
    source,
    srcExit.y,
    tgtEntry.y,
    placed,
    excludeIds,
    nodePadding,
    process,
  )

  const tryDetour = (detourX: number) => {
    if (Math.abs(detourX - sx) <= 4) return
    const clearY = findClearHorizontalBandY(
      detourX,
      gutterX,
      srcExit.y,
      tgtEntry.y,
      placed,
      excludeIds,
      nodePadding,
      process,
    )
    if (clearY == null) return
    candidates.push(
      wrap([
        { x: sx, y: clearY },
        { x: detourX, y: clearY },
        { x: gutterX, y: clearY },
        { x: gutterX, y: tgtEntry.y },
        { x: tx, y: tgtEntry.y },
      ]),
    )
  }

  if (source.laneId === target.laneId) {
    tryDetour(detourRight)
    tryDetour(detourLeft)
  } else {
    tryDetour(detourLeft)
    tryDetour(detourRight)
  }

  const clearY = findClearHorizontalBandY(sx, gutterX, srcExit.y, tgtEntry.y, placed, excludeIds, nodePadding, process)
  if (clearY == null) return

  candidates.push(
    wrap([
      { x: sx, y: clearY },
      { x: gutterX, y: clearY },
      { x: gutterX, y: tgtEntry.y },
      { x: tx, y: tgtEntry.y },
    ]),
  )
}

export function countOrthogonalBends(points: Point[]): number {
  return Math.max(0, simplifyPath(points).length - 2)
}

type DownwardPathOptions = {
  allowOuterDetour?: boolean
  process?: Process
  sourceType?: string
  targetType?: string
  /** cross-zone gap 경로 — 2 bend 허용 */
  allowGapBends?: boolean
}

const CELL_LEFT_TRUNK_GUTTER = 14

function qualifiesForCellLeftTrunkFanOut(
  source: PlacedNode,
  target: PlacedNode,
  branchContext: EdgeBranchContext | undefined,
  sourceHandle: EdgeHandleId,
  targetHandle: EdgeHandleId,
): boolean {
  if (!branchContext?.isCellInternalFlow) return false
  if (branchContext.sourceGroupSize < 2) return false
  if (sourceHandle !== 'bottom' || targetHandle !== 'top') return false
  if (target.y + target.height * 0.2 <= source.y + source.height) return false
  return sharesColumnRange(source, target)
}

/** 같은 cell — source에서 좌측 공유 trunk → 아래 분기 */
function buildCellLeftTrunkFanOutPath(
  source: PlacedNode,
  target: PlacedNode,
  parallelIndex: number,
  anchors: PathAnchorOptions = {},
): Point[] {
  const frame = buildHandlePathFrame(source, target, 'bottom', 'top', parallelIndex, {
    ...anchors,
    sourceAnchorRatio: anchors.sourceAnchorRatio ?? 0,
  })
  const trunkX = Math.min(source.x, target.x) - CELL_LEFT_TRUNK_GUTTER
  const middles: Point[] = []
  if (Math.abs(frame.srcExit.x - trunkX) > 4) {
    middles.push({ x: trunkX, y: frame.srcExit.y })
  }
  middles.push({ x: trunkX, y: frame.tgtEntry.y })
  if (Math.abs(frame.tgtEntry.x - trunkX) > 4) {
    middles.push({ x: frame.tgtEntry.x, y: frame.tgtEntry.y })
  }
  return frame.wrap(middles)
}

function resolveProcessZoneSpan(
  sourceZoneId: string,
  targetZoneId: string,
  process: Process,
  placed: PlacedNode[],
): { top: number; bottom: number } | null {
  let sourceZoneBottom = Number.NEGATIVE_INFINITY
  let targetZoneTop = Number.POSITIVE_INFINITY

  for (const node of placed) {
    const meta = process.nodes.find((n) => n.id === node.id)
    if (!meta?.processZone) continue
    if (meta.processZone === sourceZoneId) {
      sourceZoneBottom = Math.max(sourceZoneBottom, node.y + node.height)
    }
    if (meta.processZone === targetZoneId) {
      targetZoneTop = Math.min(targetZoneTop, node.y)
    }
  }

  if (!Number.isFinite(sourceZoneBottom) || !Number.isFinite(targetZoneTop)) return null
  if (targetZoneTop <= sourceZoneBottom + 8) return null
  return { top: sourceZoneBottom, bottom: targetZoneTop }
}

/** zone gap 우선 — 막히면 source~target span에서 obstacle-free Y 탐색 */
function resolveCrossZoneHorizontalCorridorY(
  source: PlacedNode,
  target: PlacedNode,
  sx: number,
  tx: number,
  process: Process,
  placed: PlacedNode[],
  excludeIds: Set<string>,
  nodePadding: number,
): number {
  const gapTop = source.y + source.height
  const gapBottom = target.y
  const sNode = process.nodes.find((n) => n.id === source.id)
  const tNode = process.nodes.find((n) => n.id === target.id)

  let spanTop = gapTop
  let spanBottom = gapBottom

  if (sNode?.processZone && tNode?.processZone && sNode.processZone !== tNode.processZone) {
    const zoneSpan = resolveProcessZoneSpan(sNode.processZone, tNode.processZone, process, placed)
    if (zoneSpan && zoneSpan.bottom - zoneSpan.top >= nodePadding * 2 + 12) {
      spanTop = zoneSpan.top
      spanBottom = zoneSpan.bottom
    } else if (sNode.laneId !== tNode.laneId && zoneSpan) {
      spanTop = zoneSpan.top
      spanBottom = zoneSpan.bottom
    }
  }

  if (spanBottom <= spanTop + 8) return spanTop + 8

  const midGap = spanTop + (spanBottom - spanTop) * 0.5
  if (getHorizontalObstaclesAtY(midGap, sx, tx, placed, excludeIds, nodePadding, process).length === 0) {
    return midGap
  }

  if (gapBottom > gapTop + 8) {
    const nodeMid = gapTop + (gapBottom - gapTop) * 0.5
    if (getHorizontalObstaclesAtY(nodeMid, sx, tx, placed, excludeIds, nodePadding, process).length === 0) {
      return nodeMid
    }
  }

  const clear = findClearHorizontalBandY(
    sx,
    tx,
    spanTop,
    spanBottom,
    placed,
    excludeIds,
    nodePadding,
    process,
  )
  if (clear != null) return clear

  if (gapBottom > gapTop + 8) {
    const clearInNodeSpan = findClearHorizontalBandY(
      sx,
      tx,
      gapTop,
      gapBottom,
      placed,
      excludeIds,
      nodePadding,
      process,
    )
    if (clearInNodeSpan != null) return clearInNodeSpan
  }

  return midGap
}

/** zone gap 중앙 — 셀 내부가 아닌 zone 사이에서만 수평 전환 */
function resolveCrossZoneCorridorY(
  source: PlacedNode,
  target: PlacedNode,
  process?: Process,
  placed?: PlacedNode[],
): number {
  const gapTop = source.y + source.height
  const gapBottom = target.y
  const sNode = process?.nodes.find((n) => n.id === source.id)
  const tNode = process?.nodes.find((n) => n.id === target.id)

  if (
    sNode?.processZone &&
    tNode?.processZone &&
    sNode.processZone !== tNode.processZone &&
    process &&
    placed
  ) {
    const zoneSpan = resolveProcessZoneSpan(sNode.processZone, tNode.processZone, process, placed)
    if (zoneSpan) {
      return zoneSpan.top + (zoneSpan.bottom - zoneSpan.top) * 0.5
    }

    if (sNode.laneId !== tNode.laneId) {
      const zoneBottom = placed.reduce((max, node) => {
        const meta = process.nodes.find((n) => n.id === node.id)
        if (meta?.processZone !== sNode.processZone) return max
        return Math.max(max, node.y + node.height)
      }, gapTop)
      return zoneBottom + 28
    }
  }

  if (gapBottom <= gapTop + 8) return gapTop + 8
  return gapTop + (gapBottom - gapTop) * 0.5
}

/** 같은 lane · 인접 zone — bottom→top, 수평은 zone gap에서만 */
function buildCrossZoneGapDownPaths(
  source: PlacedNode,
  target: PlacedNode,
  parallelIndex: number,
  anchors: PathAnchorOptions = {},
  sourceType?: string,
  targetType?: string,
  process?: Process,
  placed?: PlacedNode[],
  excludeIds: Set<string> = new Set([source.id, target.id]),
  nodePadding: number = PRIORITY_ROUTE_NODE_PADDING,
): Point[][] {
  const { srcExit, tgtEntry, wrap } = buildHandlePathFrame(
    source,
    target,
    'bottom',
    'top',
    parallelIndex,
    anchors,
    sourceType,
    targetType,
  )
  const sx = srcExit.x
  const tx = tgtEntry.x
  const baseCorridorY =
    process && placed
      ? resolveCrossZoneHorizontalCorridorY(
          source,
          target,
          sx,
          tx,
          process,
          placed,
          excludeIds,
          nodePadding,
        )
      : resolveCrossZoneCorridorY(source, target, process, placed)

  const alignedColumn =
    sharesColumnRange(source, target) ||
    sameLaneManualCellSlotColumn(source, target, process)
  const nearColumn = Math.abs(sx - tx) <= DOWNWARD_STRAIGHT_X_TOLERANCE

  if (alignedColumn || nearColumn) {
    if (Math.abs(sx - tx) <= ORTHO_EPS) {
      return [wrap([])]
    }
    /** 같은 열 fan-out — 수평은 zone gap corridor에서만 */
    return [
      wrap([
        { x: sx, y: baseCorridorY },
        { x: tx, y: baseCorridorY },
      ]),
    ]
  }

  const corridorY = placed
    ? resolveCrossZoneFinalApproachCorridorY(
        baseCorridorY,
        sx,
        tx,
        tgtEntry.y,
        target,
        placed,
        excludeIds,
        nodePadding,
        process,
      )
    : baseCorridorY

  const candidates: Point[][] = [
    wrap([
      { x: sx, y: corridorY },
      { x: tx, y: corridorY },
    ]),
  ]

  if (placed) {
    const finalObstacles = getVerticalObstaclesAtX(
      tx,
      corridorY,
      tgtEntry.y,
      placed,
      excludeIds,
      nodePadding,
      process,
    )
    if (finalObstacles.length > 0) {
      const detourRight = Math.max(...finalObstacles.map((node) => node.x + node.width)) + nodePadding + 12
      const detourLeft = Math.min(...finalObstacles.map((node) => node.x)) - nodePadding - 12
      const leftDetour = wrap([
        { x: sx, y: corridorY },
        { x: detourLeft, y: corridorY },
        { x: detourLeft, y: tgtEntry.y },
        { x: tx, y: tgtEntry.y },
      ])
      const rightDetour = wrap([
        { x: sx, y: corridorY },
        { x: detourRight, y: corridorY },
        { x: detourRight, y: tgtEntry.y },
        { x: tx, y: tgtEntry.y },
      ])
      candidates.push(
        ...(source.laneId === target.laneId
          ? [rightDetour, leftDetour]
          : [leftDetour, rightDetour]),
      )
    }

    appendCrossZoneSideGutterCandidates(
      candidates,
      wrap,
      source,
      target,
      sx,
      tx,
      srcExit,
      tgtEntry,
      placed,
      excludeIds,
      nodePadding,
      process,
    )
  }

  return dedupePaths(candidates)
}

/**
 * 아래 방향 bottom→top 전용 경로 후보
 * 1) x차이<=24 & obstacle없음 → 수직 직선
 * 2) obstacle없음 → 중간 x 기준 1회 꺾임
 * 3) obstacle있음 → 로컬 우회 (2회+ 꺾임 허용)
 */
function buildDownwardBottomTopPaths(
  source: PlacedNode,
  target: PlacedNode,
  parallelIndex: number,
  placed: PlacedNode[],
  excludeIds: Set<string>,
  nodePadding: number,
  anchors: PathAnchorOptions = {},
  options: DownwardPathOptions = {},
): Point[][] {
  const { srcExit, tgtEntry, wrap } = buildHandlePathFrame(
    source,
    target,
    'bottom',
    'top',
    parallelIndex,
    anchors,
  )
  const xDiff = Math.abs(nodeCenterX(source) - nodeCenterX(target))
  const midX = (nodeCenterX(source) + nodeCenterX(target)) / 2
  const obstacles = getVerticalObstaclesBetween(
    source,
    target,
    placed,
    excludeIds,
    nodePadding,
    options.process,
  )
  const hasObstacles = obstacles.length > 0
  const candidates: Point[][] = []

  if (
    options.process &&
    qualifiesForSameLaneCrossZoneStraightVertical(source, target, options.process)
  ) {
    const sourceType = options.sourceType ?? getNodeType(options.process, source.id)
    const targetType = options.targetType ?? getNodeType(options.process, target.id)
    return buildCrossZoneGapDownPaths(
      source,
      target,
      parallelIndex,
      anchors,
      sourceType,
      targetType,
      options.process,
      placed,
      excludeIds,
      nodePadding,
    )
  }

  if (options.process && qualifiesForCrossZoneGapVerticalDrop(source, target, options.process)) {
    const sourceType = options.sourceType ?? getNodeType(options.process, source.id)
    const targetType = options.targetType ?? getNodeType(options.process, target.id)
    return buildCrossZoneGapDownPaths(
      source,
      target,
      parallelIndex,
      anchors,
      sourceType,
      targetType,
      options.process,
      placed,
      excludeIds,
      nodePadding,
    )
  }

  if (!hasObstacles && (xDiff <= DOWNWARD_STRAIGHT_X_TOLERANCE || sharesColumnRange(source, target))) {
    candidates.push(wrap([]))
    return candidates
  }

  if (!hasObstacles) {
    candidates.push(wrap([{ x: midX, y: srcExit.y }, { x: midX, y: tgtEntry.y }]))
    return candidates
  }

  candidates.push(wrap([{ x: midX, y: srcExit.y }, { x: midX, y: tgtEntry.y }]))

  const detourRight = Math.max(...obstacles.map((n) => n.x + n.width)) + nodePadding + 8
  const detourLeft = Math.min(...obstacles.map((n) => n.x)) - nodePadding - 8
  candidates.push(wrap([{ x: detourRight, y: srcExit.y }, { x: detourRight, y: tgtEntry.y }]))
  candidates.push(wrap([{ x: detourLeft, y: srcExit.y }, { x: detourLeft, y: tgtEntry.y }]))

  if (options.allowOuterDetour) {
    const idx = anchors.parallelIndex ?? parallelIndex
    const detourX =
      Math.max(source.x + source.width, target.x + target.width, ...obstacles.map((n) => n.x + n.width)) +
      80 +
      Math.abs(idx) * 8
    candidates.push(wrap([{ x: detourX, y: srcExit.y }, { x: detourX, y: tgtEntry.y }]))
  }

  const seen = new Set<string>()
  return candidates
    .map(simplifyOrthogonal)
    .filter((path) => {
      if (path.length < 2) return false
      const key = path.map((p) => `${Math.round(p.x)}:${Math.round(p.y)}`).join('|')
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
}

function selectDownwardBottomTopPath(
  candidates: Point[][],
  placed: PlacedNode[],
  excludeIds: Set<string>,
  nodePadding: number,
  hasObstacles: boolean,
  process?: Process,
  allowGapBends = false,
  preferRightDetour = false,
): Point[] | null {
  let best: Point[] | null = null
  let bestScore = Number.POSITIVE_INFINITY

  for (const points of candidates) {
    const collisions = countNodeCollisions(points, placed, excludeIds, nodePadding, process)
    const bends = countOrthogonalBends(points)
    const length = pathLength(points)
    let score = bendTierCost(bends) + length * 0.05 + collisions * 10000
    if (routeHasDirectionReversal(points)) score += ROUTE_TIER_COST.directionReversal
    if (hasDownRightUpDetour(points)) score += ROUTE_TIER_COST.directionReversal
    if (hasImmediateHorizontalFromSourceExit(points)) score += ROUTE_TIER_COST.outerRoute
    if (preferRightDetour && hasImmediateLeftFromSourceExit(points)) {
      score += ROUTE_TIER_COST.outerRoute * 2
    }

    if (collisions > 0) continue

    const maxBends = allowGapBends ? 5 : MAX_ORTHOGONAL_BENDS
    if (bends > maxBends) continue
    if (!hasObstacles && bends > 1 && !allowGapBends) continue

    if (score < bestScore) {
      bestScore = score
      best = points
    }
  }

  return best ?? null
}

function getPathCorridorObstacles(
  source: PlacedNode,
  target: PlacedNode,
  placed: PlacedNode[],
  excludeIds: Set<string>,
  padding: number,
  process?: Process,
): PlacedNode[] {
  const minX = Math.min(source.x, target.x) - padding
  const maxX = Math.max(source.x + source.width, target.x + target.width) + padding
  const minY = Math.min(source.y, target.y) - padding
  const maxY = Math.max(source.y + source.height, target.y + target.height) + padding

  return filterRoutingObstacles(placed, excludeIds, process).filter(
    (n) =>
      n.x + n.width + padding > minX &&
      n.x - padding < maxX &&
      n.y + n.height + padding > minY &&
      n.y - padding < maxY,
  )
}

function canStraightConnect(
  sourceHandle: EdgeHandleId,
  targetHandle: EdgeHandleId,
  start: Point,
  end: Point,
  tolerance = DOWNWARD_STRAIGHT_X_TOLERANCE,
): boolean {
  if (sourceHandle === 'bottom' && targetHandle === 'top') {
    return Math.abs(start.x - end.x) <= tolerance
  }
  if (sourceHandle === 'top' && targetHandle === 'bottom') {
    return Math.abs(start.x - end.x) <= tolerance
  }
  if (sourceHandle === 'right' && targetHandle === 'left') {
    return Math.abs(start.y - end.y) <= tolerance
  }
  if (sourceHandle === 'left' && targetHandle === 'right') {
    return Math.abs(start.y - end.y) <= tolerance
  }
  return false
}

function getHorizontalObstaclesBetween(
  source: PlacedNode,
  target: PlacedNode,
  placed: PlacedNode[],
  excludeIds: Set<string>,
  padding: number,
  process?: Process,
): PlacedNode[] {
  const corridorMinX = Math.min(source.x + source.width, target.x + target.width)
  const corridorMaxX = Math.max(source.x, target.x)
  if (corridorMaxX <= corridorMinX + padding) return []

  const corridorMinY = Math.min(source.y, target.y) - padding
  const corridorMaxY = Math.max(source.y + source.height, target.y + target.height) + padding

  return filterRoutingObstacles(placed, excludeIds, process).filter(
    (n) =>
      n.x + n.width + padding > corridorMinX &&
      n.x - padding < corridorMaxX &&
      n.y + n.height + padding > corridorMinY &&
      n.y - padding < corridorMaxY,
  )
}

function getMinimalPathObstacles(
  source: PlacedNode,
  target: PlacedNode,
  sourceHandle: EdgeHandleId,
  targetHandle: EdgeHandleId,
  placed: PlacedNode[],
  excludeIds: Set<string>,
  nodePadding: number,
  process?: Process,
): PlacedNode[] {
  if (
    (sourceHandle === 'bottom' && targetHandle === 'top') ||
    (sourceHandle === 'top' && targetHandle === 'bottom')
  ) {
    return getVerticalObstaclesBetween(source, target, placed, excludeIds, nodePadding, process)
  }
  if (
    (sourceHandle === 'right' && targetHandle === 'left') ||
    (sourceHandle === 'left' && targetHandle === 'right')
  ) {
    const horizontal = getHorizontalObstaclesBetween(
      source,
      target,
      placed,
      excludeIds,
      nodePadding,
      process,
    )
    const corridor = getPathCorridorObstacles(source, target, placed, excludeIds, nodePadding, process)
    const seen = new Set<string>()
    return [...horizontal, ...corridor].filter((node) => {
      if (seen.has(node.id)) return false
      seen.add(node.id)
      return true
    })
  }
  return getPathCorridorObstacles(source, target, placed, excludeIds, nodePadding, process)
}

/** 직선 → 1회 꺾임 우선, obstacle 시에만 2회+ */
function buildMinimalHandlePaths(
  source: PlacedNode,
  target: PlacedNode,
  sourceHandle: EdgeHandleId,
  targetHandle: EdgeHandleId,
  parallelIndex: number,
  placed: PlacedNode[],
  excludeIds: Set<string>,
  nodePadding: number,
  anchors: PathAnchorOptions = {},
  sourceType?: string,
  targetType?: string,
  process?: Process,
): Point[][] {
  const { start, end, srcExit, tgtEntry, wrap } = buildHandlePathFrame(
    source,
    target,
    sourceHandle,
    targetHandle,
    parallelIndex,
    anchors,
    sourceType,
    targetType,
  )
  const sourceHoriz = isHorizontalHandle(sourceHandle)
  const obstacles = getMinimalPathObstacles(
    source,
    target,
    sourceHandle,
    targetHandle,
    placed,
    excludeIds,
    nodePadding,
    process,
  )
  const hasObstacles = obstacles.length > 0
  const candidates: Point[][] = []
  const midX = (srcExit.x + tgtEntry.x) / 2
  const midY = (srcExit.y + tgtEntry.y) / 2

  if (!hasObstacles && canStraightConnect(sourceHandle, targetHandle, start, end)) {
    candidates.push(wrap([]))
    return candidates.map(simplifyPath).filter((p) => p.length >= 2)
  }

  if (!hasObstacles) {
    if (sourceHoriz) {
      pushHorizExitHandleCandidates(
        candidates,
        wrap,
        sourceHandle,
        targetHandle,
        source,
        target,
        srcExit,
        tgtEntry,
        midX,
        midY,
      )
    } else {
      candidates.push(wrap([{ x: srcExit.x, y: tgtEntry.y }]))
      candidates.push(wrap([{ x: midX, y: srcExit.y }, { x: midX, y: tgtEntry.y }]))
    }
    return finalizeMinimalHandleCandidates(
      candidates,
      wrap,
      source,
      target,
      sourceHandle,
      targetHandle,
      srcExit,
      tgtEntry,
      placed,
      excludeIds,
      nodePadding,
      sourceHoriz,
      process,
    )
  }

  if (sourceHoriz) {
    pushHorizExitHandleCandidates(
      candidates,
      wrap,
      sourceHandle,
      targetHandle,
      source,
      target,
      srcExit,
      tgtEntry,
      midX,
      midY,
    )
  } else {
    candidates.push(wrap([{ x: midX, y: srcExit.y }, { x: midX, y: tgtEntry.y }]))
    candidates.push(wrap([{ x: srcExit.x, y: tgtEntry.y }]))
    candidates.push(wrap([{ x: srcExit.x, y: midY }, { x: tgtEntry.x, y: midY }]))
  }

  return finalizeMinimalHandleCandidates(
    candidates,
    wrap,
    source,
    target,
    sourceHandle,
    targetHandle,
    srcExit,
    tgtEntry,
    placed,
    excludeIds,
    nodePadding,
    sourceHoriz,
    process,
  )
}

function prefersVerticalFirstHorizExit(
  source: PlacedNode,
  target: PlacedNode,
  sourceHandle: EdgeHandleId,
  targetHandle: EdgeHandleId,
  srcExit: Point,
  tgtEntry: Point,
): boolean {
  if (
    (sourceHandle === 'right' && targetHandle === 'left') ||
    (sourceHandle === 'left' && targetHandle === 'right')
  ) {
    // target이 source 위에 있으면 수직 우선 경로가 중간 노드를 관통할 수 있음
    if (tgtEntry.y < srcExit.y - 4) return false
  }
  if (sourceHandle === 'right' && targetHandle === 'top' && target.y > source.y + source.height) {
    return tgtEntry.x < srcExit.x - 4
  }
  if (sourceHandle === 'left' && targetHandle === 'top' && target.y > source.y + source.height) {
    return tgtEntry.x > srcExit.x + 4
  }
  if (sourceHandle === 'right' && targetHandle === 'bottom' && target.y > source.y + source.height) {
    return tgtEntry.x < srcExit.x - 4
  }
  if (sourceHandle === 'left' && targetHandle === 'bottom' && target.y > source.y + source.height) {
    return tgtEntry.x > srcExit.x + 4
  }
  return false
}

function pushHorizExitHandleCandidates(
  candidates: Point[][],
  wrap: (middles: Point[]) => Point[],
  sourceHandle: EdgeHandleId,
  targetHandle: EdgeHandleId,
  source: PlacedNode,
  target: PlacedNode,
  srcExit: Point,
  tgtEntry: Point,
  midX: number,
  midY: number,
): void {
  const targetAboveSource =
    ((sourceHandle === 'right' && targetHandle === 'left') ||
      (sourceHandle === 'left' && targetHandle === 'right')) &&
    tgtEntry.y < srcExit.y - 4

  if (targetAboveSource) {
    candidates.push(wrap([{ x: tgtEntry.x, y: srcExit.y }]))
    candidates.push(wrap([{ x: midX, y: srcExit.y }, { x: midX, y: tgtEntry.y }]))
    return
  }

  const verticalFirst = prefersVerticalFirstHorizExit(
    source,
    target,
    sourceHandle,
    targetHandle,
    srcExit,
    tgtEntry,
  )
  if (verticalFirst) {
    candidates.push(wrap([{ x: srcExit.x, y: tgtEntry.y }]))
  }
  candidates.push(wrap([{ x: midX, y: srcExit.y }, { x: midX, y: tgtEntry.y }]))
  candidates.push(wrap([{ x: tgtEntry.x, y: srcExit.y }]))
  candidates.push(wrap([{ x: srcExit.x, y: midY }, { x: tgtEntry.x, y: midY }]))
  if (!verticalFirst) {
    candidates.push(wrap([{ x: srcExit.x, y: tgtEntry.y }]))
  }
}

function dedupePaths(candidates: Point[][]): Point[][] {
  const seen = new Set<string>()
  return candidates
    .map(simplifyPath)
    .filter((path) => {
      if (path.length < 2) return false
      const key = path.map((p) => `${Math.round(p.x)}:${Math.round(p.y)}`).join('|')
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
}

function appendHandlePairDetourCandidates(
  candidates: Point[][],
  wrap: (middles: Point[]) => Point[],
  sourceHandle: EdgeHandleId,
  targetHandle: EdgeHandleId,
  srcExit: Point,
  tgtEntry: Point,
  blockers: PlacedNode[],
  nodePadding: number,
  sourceHoriz: boolean,
): void {
  if (blockers.length === 0) return

  const detourRight = Math.max(...blockers.map((node) => node.x + node.width)) + nodePadding + 12
  const detourLeft = Math.min(...blockers.map((node) => node.x)) - nodePadding - 12
  const detourTop = Math.min(...blockers.map((node) => node.y)) - nodePadding - 12
  const detourBottom = Math.max(...blockers.map((node) => node.y + node.height)) + nodePadding + 12

  if (sourceHandle === 'bottom' && targetHandle === 'top') {
    candidates.push(wrap([{ x: detourRight, y: srcExit.y }, { x: detourRight, y: tgtEntry.y }]))
    candidates.push(wrap([{ x: detourLeft, y: srcExit.y }, { x: detourLeft, y: tgtEntry.y }]))
  } else if (sourceHandle === 'right' && targetHandle === 'left') {
    candidates.push(wrap([{ x: srcExit.x, y: detourTop }, { x: tgtEntry.x, y: detourTop }]))
    candidates.push(wrap([{ x: srcExit.x, y: detourBottom }, { x: tgtEntry.x, y: detourBottom }]))
    candidates.push(wrap([{ x: detourRight, y: srcExit.y }, { x: detourRight, y: tgtEntry.y }]))
  } else if (sourceHandle === 'left' && targetHandle === 'right') {
    candidates.push(wrap([{ x: srcExit.x, y: detourTop }, { x: tgtEntry.x, y: detourTop }]))
    candidates.push(wrap([{ x: srcExit.x, y: detourBottom }, { x: tgtEntry.x, y: detourBottom }]))
    candidates.push(wrap([{ x: detourLeft, y: srcExit.y }, { x: detourLeft, y: tgtEntry.y }]))
  } else if (sourceHoriz) {
    candidates.push(wrap([{ x: srcExit.x, y: detourTop }, { x: tgtEntry.x, y: detourTop }]))
    candidates.push(wrap([{ x: srcExit.x, y: detourBottom }, { x: tgtEntry.x, y: detourBottom }]))
  } else {
    candidates.push(wrap([{ x: detourRight, y: srcExit.y }, { x: detourRight, y: tgtEntry.y }]))
    candidates.push(wrap([{ x: detourLeft, y: srcExit.y }, { x: detourLeft, y: tgtEntry.y }]))
  }
}

function finalizeMinimalHandleCandidates(
  candidates: Point[][],
  wrap: (middles: Point[]) => Point[],
  source: PlacedNode,
  target: PlacedNode,
  sourceHandle: EdgeHandleId,
  targetHandle: EdgeHandleId,
  srcExit: Point,
  tgtEntry: Point,
  placed: PlacedNode[],
  excludeIds: Set<string>,
  nodePadding: number,
  sourceHoriz: boolean,
  process?: Process,
): Point[][] {
  const blockers = getPathCorridorObstacles(source, target, placed, excludeIds, nodePadding, process)
  appendHandlePairDetourCandidates(
    candidates,
    wrap,
    sourceHandle,
    targetHandle,
    srcExit,
    tgtEntry,
    blockers,
    nodePadding,
    sourceHoriz,
  )
  return dedupePaths(candidates)
}

function selectMinimalHandlePath(
  candidates: Point[][],
  placed: PlacedNode[],
  excludeIds: Set<string>,
  nodePadding: number,
  hasObstacles: boolean,
  process?: Process,
): Point[] | null {
  return selectDownwardBottomTopPath(candidates, placed, excludeIds, nodePadding, hasObstacles, process)
}

function routeDecisionSameRowLeftReturnEdge(
  options: OrthogonalRouteOptions,
): OrthogonalRouteResult {
  const {
    edge,
    source,
    target,
    placed,
    parallelIndex = 0,
    minContentX = 0,
    existingSegments = [],
    process,
  } = options

  const excludeIds = new Set([source.id, target.id])
  const nodePadding = PRIORITY_ROUTE_NODE_PADDING
  const built = buildDecisionSameRowLeftReturnPath(source, target)
  const finalized = finalizeRoutedPath(
    built.points,
    source,
    target,
    built.sourceHandle,
    built.targetHandle,
    { parallelIndex, sourceAnchorRatio: 0.5, targetAnchorRatio: 0.5 },
    placed,
    excludeIds,
    nodePadding,
    edge,
    process,
  )
  const label = resolveRouteEdgeLabel(options, finalized, existingSegments)

  return {
    path: pointsToPath(finalized, minContentX),
    points: finalized,
    bendPoints: extractBendPoints(finalized),
    sourceHandle: built.sourceHandle,
    targetHandle: built.targetHandle,
    ...routeLabelFields(label),
    exactEndpoints: true,
  }
}

function routeDecisionSameRowTopReturnEdge(
  options: OrthogonalRouteOptions,
): OrthogonalRouteResult {
  const {
    edge,
    source,
    target,
    placed,
    parallelIndex = 0,
    minContentX = 0,
    existingSegments = [],
    process,
  } = options

  const excludeIds = new Set([source.id, target.id])
  const nodePadding = PRIORITY_ROUTE_NODE_PADDING
  const targetType = getNodeType(process, target.id)
  const built = buildDecisionSameRowTopReturnPath(source, target, targetType, {
    placed,
    excludeIds,
    nodePadding,
    process,
  })
  const finalized = finalizeRoutedPath(
    built.points,
    source,
    target,
    built.sourceHandle,
    built.targetHandle,
    { parallelIndex, sourceAnchorRatio: 0.5, targetAnchorRatio: 0.5 },
    placed,
    excludeIds,
    nodePadding,
    edge,
    process,
  )
  const label = resolveRouteEdgeLabel(options, finalized, existingSegments)

  return {
    path: pointsToPath(finalized, minContentX),
    points: finalized,
    bendPoints: extractBendPoints(finalized),
    sourceHandle: built.sourceHandle,
    targetHandle: built.targetHandle,
    ...routeLabelFields(label),
    exactEndpoints: true,
  }
}

function routeDecisionAwareEdge(
  options: OrthogonalRouteOptions,
  sourceHandle: EdgeHandleId,
  targetHandle: EdgeHandleId,
): OrthogonalRouteResult {
  const {
    edge,
    source,
    target,
    placed,
    parallelIndex = 0,
    minContentX = 0,
    existingSegments = [],
    process,
  } = options

  const excludeIds = new Set([source.id, target.id])
  const nodePadding = PRIORITY_ROUTE_NODE_PADDING
  const sourceType = getNodeType(process, source.id)
  const targetType = getNodeType(process, target.id)
  const isManual = edge.routing?.mode === 'manual'
  const sourceIsDecision = isBranchNodeType(sourceType)

  if (
    !isManual &&
    process &&
    sourceHandle === 'right' &&
    targetHandle === 'left' &&
    nodesShareOverviewZoneDifferentLane(source, target, process) &&
    isAdjacentHorizontalRouteClear(
      source,
      target,
      placed,
      excludeIds,
      process,
      edge,
      parallelIndex,
    )
  ) {
    return routeSameRowRightTargetEdge(options)
  }

  if (!isManual && sourceIsDecision && process) {
    if (
      hasUserSpecifiedHandles(edge) &&
      sourceHandle === 'top' &&
      targetHandle === 'top' &&
      qualifiesForDecisionSameRowTopReturn(edge, source, target, process)
    ) {
      return routeDecisionSameRowTopReturnEdge(options)
    }
    if (
      !hasUserSpecifiedHandles(edge) &&
      qualifiesForDecisionSameRowLeftReturn(edge, source, target, process)
    ) {
      return routeDecisionSameRowLeftReturnEdge(options)
    }
  }

  if (!isManual && !hasUserSpecifiedHandles(edge)) {
    const geometryPair = resolveGeometryHandlePair(
      source,
      target,
      sourceType,
      targetType,
      placed,
      excludeIds,
      process,
      edge,
    )
    if (geometryPair) {
      sourceHandle = geometryPair[0]
      targetHandle = geometryPair[1]
    }
  }

  if (
    !isManual &&
    sourceIsDecision &&
    sourceHandle === 'right' &&
    targetHandle === 'left' &&
    qualifiesForSameRowRightTargetShortRoute(edge, source, target, placed, excludeIds, process)
  ) {
    return routeSameRowRightTargetEdge(options)
  }

  if (sourceIsDecision && !hasUserSpecifiedHandles(edge)) {
    const [sh, th] = inferDecisionOutgoingPair(source, target, edge)
    sourceHandle = sh
    targetHandle = th
  }

  if (sourceIsDecision && !isManual) {
    const sc = nodeCenter(source)
    const tc = nodeCenter(target)
    if (sourceHandle === 'left' && targetHandle === 'left' && Math.abs(tc.y - sc.y) > 4) {
      return routeBracketEdge(options, 'left', 'left', 'left')
    }
    if (sourceHandle === 'right' && targetHandle === 'right' && Math.abs(tc.y - sc.y) > 4) {
      const targetAbove = tc.y < sc.y - 4
      const targetBelow = tc.y > sc.y + 4
      if (targetAbove || (targetBelow && !isDecisionSameColumn(source, target))) {
        return routeBracketEdge(options, 'right', 'right', 'right')
      }
    }
  }

  const anchors: PathAnchorOptions = {
    sourceAnchorRatio: 0.5,
    targetAnchorRatio: 0.5,
    parallelIndex,
  }

  const obstacles = getMinimalPathObstacles(
    source,
    target,
    sourceHandle,
    targetHandle,
    placed,
    excludeIds,
    nodePadding,
    process,
  )

  if (
    sourceIsDecision &&
    sourceHandle === 'bottom' &&
    targetHandle === 'top' &&
    branchDownwardSharesColumn(source, target, sourceType)
  ) {
    const anchorX = getHandlePoint(source, 'bottom', 0.5, sourceType).x
    const straightAnchors: PathAnchorOptions = {
      ...anchors,
      targetAnchorRatio: clampAnchorRatio((anchorX - target.x) / target.width),
    }
    const frame = buildHandlePathFrame(
      source,
      target,
      sourceHandle,
      targetHandle,
      parallelIndex,
      straightAnchors,
      sourceType,
      targetType,
    )
    const straight = frame.wrap([])
    if (
      countOrthogonalBends(straight) === 0 &&
      countNodeCollisions(straight, placed, excludeIds, nodePadding, process) === 0
    ) {
      const finalized = finalizeRoutedPath(
        straight,
        source,
        target,
        sourceHandle,
        targetHandle,
        straightAnchors,
        placed,
        excludeIds,
        nodePadding,
        edge,
        process,
      )
      const label = resolveRouteEdgeLabel(options, finalized, existingSegments)
      return {
        path: pointsToPath(finalized, minContentX),
        points: finalized,
        bendPoints: [],
        sourceHandle,
        targetHandle,
        ...routeLabelFields(label),
        exactEndpoints: true,
      }
    }
  }

  if (
    !isManual &&
    process &&
    sourceHandle === 'bottom' &&
    targetHandle === 'top' &&
    qualifiesForCrossZoneGapVerticalDrop(source, target, process)
  ) {
    return routeDownwardBottomTopEdge(options, sourceHandle, targetHandle)
  }

  const candidates = buildMinimalHandlePaths(
    source,
    target,
    sourceHandle,
    targetHandle,
    parallelIndex,
    placed,
    excludeIds,
    nodePadding,
    anchors,
    sourceType,
    targetType,
    process,
  )

  const maxBends =
    isManual || obstacles.length > 0
      ? MAX_ORTHOGONAL_BENDS
      : DECISION_NODE_LAYOUT.maxOutgoingBends
  const bendFiltered = candidates.filter((path) => countOrthogonalBends(path) <= maxBends)
  const pool = bendFiltered.length > 0 ? bendFiltered : candidates

  const selected =
    selectMinimalHandlePath(pool, placed, excludeIds, nodePadding, obstacles.length > 0, process) ??
    pool[0] ??
    buildHandlePathFrame(
      source,
      target,
      sourceHandle,
      targetHandle,
      parallelIndex,
      anchors,
      sourceType,
      targetType,
    ).wrap([])

  const finalized = finalizeRoutedPath(
    selected,
    source,
    target,
    sourceHandle,
    targetHandle,
    anchors,
    placed,
    excludeIds,
    nodePadding,
    edge,
    process,
  )

  const label = resolveRouteEdgeLabel(options, finalized, existingSegments)

  return finishOrthogonalRoute(
    options,
    {
      path: pointsToPath(finalized, minContentX),
      points: finalized,
      bendPoints: [],
      sourceHandle,
      targetHandle,
      ...routeLabelFields(label),
      exactEndpoints: true,
    },
    'decision-aware',
    candidates,
    candidates.map((c) => {
      const bends = countOrthogonalBends(c)
      return (
        bendTierCost(bends) +
        pathLength(c) * 0.05 +
        countNodeCollisions(c, placed, excludeIds, nodePadding, process) * 10000 +
        (routeHasDirectionReversal(c) ? ROUTE_TIER_COST.directionReversal : 0) +
        (hasDownRightUpDetour(c) ? ROUTE_TIER_COST.directionReversal : 0)
      )
    }),
  )
}

function routeDownwardBottomTopEdge(
  options: OrthogonalRouteOptions,
  sourceHandle: EdgeHandleId,
  targetHandle: EdgeHandleId,
): OrthogonalRouteResult {
  const {
    edge,
    source,
    target,
    placed,
    parallelIndex = 0,
    branchContext,
    minContentX = 0,
    existingSegments = [],
    process,
  } = options

  const excludeIds = new Set([source.id, target.id])
  const nodePadding = PRIORITY_ROUTE_NODE_PADDING
  const anchors = resolvePathAnchors(parallelIndex, branchContext)

  if (
    qualifiesForCellLeftTrunkFanOut(source, target, branchContext, sourceHandle, targetHandle)
  ) {
    const fanOutPath = buildCellLeftTrunkFanOutPath(source, target, parallelIndex, {
      ...anchors,
      sourceAnchorRatio: 0,
    })
    const finalized = finalizeRoutedPath(
      fanOutPath,
      source,
      target,
      sourceHandle,
      targetHandle,
      { ...anchors, sourceAnchorRatio: 0 },
      placed,
      excludeIds,
      nodePadding,
      edge,
      process,
    )
    const label = resolveRouteEdgeLabel(options, finalized, existingSegments)
    return {
      path: pointsToPath(finalized, minContentX),
      points: finalized,
      bendPoints: [],
      sourceHandle,
      targetHandle,
      ...routeLabelFields(label),
    }
  }

  const sameLaneOrCell = isSameLaneEdge(source, target) || isSameCellEdge(source, target, process)
  const near = isNearEdge(source, target, process)
  const obstacles = getVerticalObstaclesBetween(source, target, placed, excludeIds, nodePadding, process)
  const sourceType = process ? getNodeType(process, source.id) : undefined
  const targetType = process ? getNodeType(process, target.id) : undefined
  const crossZoneGap =
    process != null && qualifiesForCrossZoneGapVerticalDrop(source, target, process)
  const preferRightDetour =
    process != null &&
    source.laneId === target.laneId &&
    source.y + source.height < target.y &&
    crossZoneGap

  const candidates = buildDownwardBottomTopPaths(
    source,
    target,
    parallelIndex,
    placed,
    excludeIds,
    nodePadding,
    anchors,
    {
      allowOuterDetour: !sameLaneOrCell && !near,
      process,
      sourceType,
      targetType,
      allowGapBends: crossZoneGap,
    },
  )

  const selected =
    selectDownwardBottomTopPath(
      candidates,
      placed,
      excludeIds,
      nodePadding,
      obstacles.length > 0,
      process,
      crossZoneGap,
      preferRightDetour,
    ) ??
    candidates[0] ??
    buildHandlePathFrame(source, target, sourceHandle, targetHandle, parallelIndex, anchors).wrap([])

  const finalized = finalizeRoutedPath(
    selected,
    source,
    target,
    sourceHandle,
    targetHandle,
    anchors,
    placed,
    excludeIds,
    nodePadding,
    edge,
    process,
  )

  const label = resolveRouteEdgeLabel(options, finalized, existingSegments)

  return {
    path: pointsToPath(finalized, minContentX),
    points: finalized,
    bendPoints: [],
    sourceHandle,
    targetHandle,
    ...routeLabelFields(label),
  }
}

function isStraightHandlePair(
  sourceHandle: EdgeHandleId,
  targetHandle: EdgeHandleId,
  source: PlacedNode,
  target: PlacedNode,
): boolean {
  if (sourceHandle === 'bottom' && targetHandle === 'top') return isVerticallyAligned(source, target)
  if (sourceHandle === 'top' && targetHandle === 'bottom') return isVerticallyAligned(source, target)
  if (sourceHandle === 'right' && targetHandle === 'left') return isHorizontallyAligned(source, target)
  if (sourceHandle === 'left' && targetHandle === 'right') return isHorizontallyAligned(source, target)
  return false
}

function getSameOverviewZoneRouteObstacles(
  source: PlacedNode,
  target: PlacedNode,
  placed: PlacedNode[],
  excludeIds: Set<string>,
  nodePadding: number,
  process: Process,
): PlacedNode[] {
  const sourceMeta = getProcessNodeMeta(source.id, process)
  const targetMeta = getProcessNodeMeta(target.id, process)
  const zoneId =
    sourceMeta?.processZone && sourceMeta.processZone === targetMeta?.processZone
      ? sourceMeta.processZone
      : undefined

  const minX = Math.min(source.x, target.x) - nodePadding
  const maxX = Math.max(source.x + source.width, target.x + target.width) + nodePadding
  const minY = Math.min(source.y, target.y) - nodePadding * 4
  const maxY = Math.max(source.y + source.height, target.y + target.height) + nodePadding * 4

  return filterRoutingObstacles(placed, excludeIds, process).filter((node) => {
    const meta = getProcessNodeMeta(node.id, process)
    if (zoneId && meta?.processZone !== zoneId) return false
    const nodeType = getNodeType(process, node.id)
    const extra = isBranchNodeType(nodeType) ? DECISION_NODE_LAYOUT.exclusionPadding : 0
    const pad = nodePadding + extra
    return (
      node.x + node.width + pad > minX &&
      node.x - pad < maxX &&
      node.y + node.height + pad > minY &&
      node.y - pad < maxY
    )
  })
}

function prependCrossLaneLeftRightReturnDetours(
  candidates: Point[][],
  wrap: (middles: Point[]) => Point[],
  source: PlacedNode,
  target: PlacedNode,
  srcExit: Point,
  tgtEntry: Point,
  placed: PlacedNode[],
  excludeIds: Set<string>,
  nodePadding: number,
  process?: Process,
): void {
  if (!process) return
  if (!nodesShareOverviewZoneDifferentLane(source, target, process)) return
  if (!(source.x > target.x + target.width)) return

  const obstacles = getSameOverviewZoneRouteObstacles(
    source,
    target,
    placed,
    excludeIds,
    nodePadding,
    process,
  )
  const routeBounds = [source, target, ...obstacles]
  const obstacleTop = (node: PlacedNode): number => {
    const nodeType = getNodeType(process, node.id)
    const extra = isBranchNodeType(nodeType) ? DECISION_NODE_LAYOUT.exclusionPadding : 0
    return node.y - nodePadding - extra
  }
  const obstacleBottom = (node: PlacedNode): number => {
    const nodeType = getNodeType(process, node.id)
    const extra = isBranchNodeType(nodeType) ? DECISION_NODE_LAYOUT.exclusionPadding : 0
    return node.y + node.height + nodePadding + extra
  }
  const detourTop = Math.min(...routeBounds.map(obstacleTop)) - 32
  const detourBottom = Math.max(...routeBounds.map(obstacleBottom)) + 32
  const topPath = wrap([
    { x: srcExit.x, y: detourTop },
    { x: tgtEntry.x, y: detourTop },
  ])
  const bottomPath = wrap([
    { x: srcExit.x, y: detourBottom },
    { x: tgtEntry.x, y: detourBottom },
  ])

  candidates.unshift(bottomPath, topPath)
}

/** 1순위 직선 → 2순위 최소 꺾은선 → 3순위 충돌 회피 우회 */
function buildPriorityHandlePaths(
  source: PlacedNode,
  target: PlacedNode,
  sourceHandle: EdgeHandleId,
  targetHandle: EdgeHandleId,
  parallelIndex: number,
  placed: PlacedNode[],
  excludeIds: Set<string>,
  nodePadding: number,
  anchors: PathAnchorOptions = {},
  process?: Process,
): Point[][] {
  const { srcExit, tgtEntry, wrap } = buildHandlePathFrame(
    source,
    target,
    sourceHandle,
    targetHandle,
    parallelIndex,
    anchors,
  )
  const sourceHoriz = isHorizontalHandle(sourceHandle)
  const candidates: Point[][] = []

  if (isDownwardBottomTopFlow(source, target, sourceHandle, targetHandle)) {
    return buildDownwardBottomTopPaths(
      source,
      target,
      parallelIndex,
      placed,
      excludeIds,
      nodePadding,
      anchors,
      { allowOuterDetour: false, process },
    )
  }

  if (isStraightHandlePair(sourceHandle, targetHandle, source, target)) {
    candidates.push(wrap([]))
  }

  if (
    sourceHandle === 'right' &&
    targetHandle === 'left' &&
    isAdjacentHorizontalPair(source, target)
  ) {
    candidates.unshift(buildAdjacentHorizontalPath(source, target))
  }

  if (
    sourceHandle === 'right' &&
    targetHandle === 'left' &&
    process &&
    nodesShareOverviewZoneDifferentLane(source, target, process)
  ) {
    for (const gutterX of resolveCrossLaneGutterCandidates(
      source,
      target,
      placed,
      process,
      nodePadding,
    )) {
      if (gutterX > srcExit.x + ORTHO_EPS && gutterX < tgtEntry.x - ORTHO_EPS) {
        candidates.unshift(
          wrap([{ x: gutterX, y: srcExit.y }, { x: gutterX, y: tgtEntry.y }]),
        )
      }
    }
  }

  if (
    sourceHandle === 'left' &&
    targetHandle === 'right' &&
    process &&
    nodesShareOverviewZoneDifferentLane(source, target, process) &&
    !isHorizontallyAligned(source, target, SAME_ROW_Y_TOLERANCE)
  ) {
    prependCrossLaneLeftRightReturnDetours(
      candidates,
      wrap,
      source,
      target,
      srcExit,
      tgtEntry,
      placed,
      excludeIds,
      nodePadding,
      process,
    )
    for (const gutterX of resolveCrossLaneGutterCandidates(
      source,
      target,
      placed,
      process,
      nodePadding,
    )) {
      if (gutterX < srcExit.x - ORTHO_EPS && gutterX > tgtEntry.x + ORTHO_EPS) {
        candidates.unshift(
          wrap([{ x: gutterX, y: srcExit.y }, { x: gutterX, y: tgtEntry.y }]),
        )
      }
    }
  }

  if (sourceHandle === 'bottom' && targetHandle === 'top') {
    candidates.push(wrap([{ x: tgtEntry.x, y: srcExit.y }]))
    candidates.push(wrap([{ x: srcExit.x, y: tgtEntry.y }]))
  } else if (sourceHandle === 'top' && targetHandle === 'bottom') {
    candidates.push(wrap([{ x: tgtEntry.x, y: srcExit.y }]))
    candidates.push(wrap([{ x: srcExit.x, y: tgtEntry.y }]))
  } else if (sourceHandle === 'right' && targetHandle === 'left') {
    if (target.x > source.x + source.width - ORTHO_EPS) {
      candidates.push(wrap([{ x: tgtEntry.x, y: srcExit.y }]))
      candidates.push(wrap([{ x: srcExit.x, y: tgtEntry.y }]))
    } else {
      candidates.push(wrap([{ x: srcExit.x, y: tgtEntry.y }]))
      candidates.push(wrap([{ x: tgtEntry.x, y: srcExit.y }]))
    }
  } else if (sourceHandle === 'left' && targetHandle === 'right') {
    candidates.push(wrap([{ x: srcExit.x, y: tgtEntry.y }]))
    candidates.push(wrap([{ x: tgtEntry.x, y: srcExit.y }]))
  } else if (sourceHoriz) {
    candidates.push(wrap([{ x: srcExit.x, y: tgtEntry.y }]))
    candidates.push(wrap([{ x: tgtEntry.x, y: srcExit.y }]))
  } else {
    candidates.push(wrap([{ x: srcExit.x, y: tgtEntry.y }]))
    candidates.push(wrap([{ x: tgtEntry.x, y: srcExit.y }]))
  }

  const midX = (srcExit.x + tgtEntry.x) / 2
  const midY = (srcExit.y + tgtEntry.y) / 2
  if (sourceHoriz) {
    candidates.push(wrap([{ x: midX, y: srcExit.y }, { x: midX, y: tgtEntry.y }]))
  } else {
    candidates.push(wrap([{ x: srcExit.x, y: midY }, { x: tgtEntry.x, y: midY }]))
  }

  const blockers = getPathCorridorObstacles(source, target, placed, excludeIds, nodePadding, process)

  appendHandlePairDetourCandidates(
    candidates,
    wrap,
    sourceHandle,
    targetHandle,
    srcExit,
    tgtEntry,
    blockers,
    nodePadding,
    sourceHoriz,
  )

  const seen = new Set<string>()
  return candidates
    .map(simplifyOrthogonal)
    .filter((path) => {
      if (path.length < 2) return false
      const key = path.map((p) => `${Math.round(p.x)}:${Math.round(p.y)}`).join('|')
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
}

function selectPriorityHandlePath(
  candidates: Point[][],
  placed: PlacedNode[],
  excludeIds: Set<string>,
  nodePadding: number,
  process?: Process,
): Point[] | null {
  for (const points of candidates) {
    const collisions = countNodeCollisions(points, placed, excludeIds, nodePadding, process)
    if (collisions === 0) {
      return points
    }
  }

  return null
}

function routePriorityHandleEdge(
  options: OrthogonalRouteOptions,
  sourceHandle: EdgeHandleId,
  targetHandle: EdgeHandleId,
): OrthogonalRouteResult {
  const {
    edge,
    source,
    target,
    placed,
    parallelIndex = 0,
    minContentX = 0,
    existingSegments = [],
    process,
  } = options

  const excludeIds = new Set([source.id, target.id])
  const nodePadding = PRIORITY_ROUTE_NODE_PADDING
  const anchors: PathAnchorOptions = {
    sourceAnchorRatio: 0.5,
    targetAnchorRatio: 0.5,
    parallelIndex,
  }

  const candidates = buildPriorityHandlePaths(
    source,
    target,
    sourceHandle,
    targetHandle,
    parallelIndex,
    placed,
    excludeIds,
    nodePadding,
    anchors,
    process,
  )

  const selected =
    selectPriorityHandlePath(candidates, placed, excludeIds, nodePadding, process) ??
    candidates[0] ??
    buildHandlePathFrame(source, target, sourceHandle, targetHandle, parallelIndex, anchors).wrap([])

  const finalized = finalizeRoutedPath(
    selected,
    source,
    target,
    sourceHandle,
    targetHandle,
    anchors,
    placed,
    excludeIds,
    nodePadding,
    edge,
    process,
  )

  const label = resolveRouteEdgeLabel(options, finalized, existingSegments)

  return {
    path: pointsToPath(finalized, minContentX),
    points: finalized,
    bendPoints: [],
    sourceHandle,
    targetHandle,
    ...routeLabelFields(label),
  }
}

function routeCrossLaneLeftRightReturnEdge(options: OrthogonalRouteOptions): OrthogonalRouteResult | null {
  const {
    edge,
    source,
    target,
    placed,
    process,
    parallelIndex = 0,
    minContentX = 0,
    existingSegments = [],
  } = options
  if (!process) return null
  if (!nodesShareOverviewZoneDifferentLane(source, target, process)) return null
  if (!(source.x > target.x + target.width)) return null
  if (isHorizontallyAligned(source, target, SAME_ROW_Y_TOLERANCE)) return null

  const sourceHandle: EdgeHandleId = 'left'
  const targetHandle: EdgeHandleId = 'right'
  const sourceType = getNodeType(process, source.id)
  const targetType = getNodeType(process, target.id)
  const start = getHandlePoint(source, sourceHandle, 0.5, sourceType)
  const end = getHandlePoint(target, targetHandle, 0.5, targetType)
  const targetEntry = entryPoint(end, targetHandle, HANDLE_STUB + Math.abs(parallelIndex) * 4)
  const excludeIds = new Set([source.id, target.id])
  const nodePadding = PRIORITY_ROUTE_NODE_PADDING
  const obstacles = getSameOverviewZoneRouteObstacles(
    source,
    target,
    placed,
    excludeIds,
    nodePadding,
    process,
  )
  const routeBounds = [source, target, ...obstacles]
  const obstacleTop = (node: PlacedNode): number => {
    const nodeType = getNodeType(process, node.id)
    const extra = isBranchNodeType(nodeType) ? DECISION_NODE_LAYOUT.exclusionPadding : 0
    return node.y - nodePadding - extra
  }
  const obstacleBottom = (node: PlacedNode): number => {
    const nodeType = getNodeType(process, node.id)
    const extra = isBranchNodeType(nodeType) ? DECISION_NODE_LAYOUT.exclusionPadding : 0
    return node.y + node.height + nodePadding + extra
  }
  const detours = [
    Math.max(...routeBounds.map(obstacleBottom)) + 48,
    Math.min(...routeBounds.map(obstacleTop)) - 48,
  ]
  const targetApproachX = (detourY: number): number => {
    let approachX = targetEntry.x
    const minY = Math.min(detourY, end.y)
    const maxY = Math.max(detourY, end.y)
    for (const node of filterRoutingObstacles(placed, excludeIds, process)) {
      const nodeType = getNodeType(process, node.id)
      const extra = isBranchNodeType(nodeType) ? DECISION_NODE_LAYOUT.exclusionPadding : 0
      const pad = nodePadding + extra
      const yOverlaps = node.y + node.height + pad >= minY && node.y - pad <= maxY
      const xTouches = approachX >= node.x - pad && approachX <= node.x + node.width + pad
      if (!yOverlaps || !xTouches) continue
      approachX = Math.max(approachX, node.x + node.width + pad + 14)
    }
    return Math.min(approachX, source.x - nodePadding)
  }

  for (const stub of [2, 0, 6]) {
    const sourceExit = exitPoint(start, sourceHandle, stub)
    for (const detourY of detours) {
      const approachX = targetApproachX(detourY)
      const candidate = validateOrthogonalPath([
        start,
        sourceExit,
        { x: sourceExit.x, y: detourY },
        { x: approachX, y: detourY },
        { x: approachX, y: end.y },
        end,
      ])
      const finalized = finalizeRoutedPath(
        candidate,
        source,
        target,
        sourceHandle,
        targetHandle,
        { parallelIndex, sourceAnchorRatio: 0.5, targetAnchorRatio: 0.5 },
        placed,
        excludeIds,
        nodePadding,
        edge,
        process,
      )
      if (countNodeCollisions(finalized, placed, excludeIds, nodePadding, process) > 0) {
        continue
      }
      const label = resolveRouteEdgeLabel(options, finalized, existingSegments)
      return {
        path: pointsToPath(finalized, minContentX),
        points: finalized,
        bendPoints: extractBendPoints(finalized),
        sourceHandle,
        targetHandle,
        ...routeLabelFields(label),
        exactEndpoints: true,
      }
    }
  }

  return null
}

function buildCandidatePaths(
  source: PlacedNode,
  target: PlacedNode,
  sourceHandle: EdgeHandleId,
  targetHandle: EdgeHandleId,
  parallelIndex: number,
  edgeGap: number = EDGE_EDGE_MARGIN,
  allowExternalDetour = true,
  anchors: PathAnchorOptions = {},
): Point[][] {
  const start = getHandlePoint(source, sourceHandle, anchors.sourceAnchorRatio ?? 0.5)
  const end = getHandlePoint(target, targetHandle, anchors.targetAnchorRatio ?? 0.5)
  const idx = anchors.parallelIndex ?? parallelIndex
  const stub = HANDLE_STUB + Math.abs(idx) * 4
  const srcExit = exitPoint(start, sourceHandle, stub)
  const tgtEntry = entryPoint(end, targetHandle, stub)
  const branchOffset = anchors.segmentOffset ?? 0
  const targetOffset = anchors.targetSegmentOffset ?? 0
  const offset = branchOffset !== 0 ? branchOffset : idx * EDGE_OFFSET_STEP

  const sourceHoriz = isHorizontalHandle(sourceHandle)
  const targetHoriz = isHorizontalHandle(targetHandle)

  const lanePoint = (x: number, y: number): Point => {
    let p = { x, y }
    if (sourceHoriz) {
      p = offsetLanePoint(p, 'horizontal', offset)
    } else {
      p = offsetLanePoint(p, 'vertical', offset)
    }
    if (targetHoriz) {
      p = offsetLanePoint(p, 'horizontal', targetOffset)
    } else {
      p = offsetLanePoint(p, 'vertical', targetOffset)
    }
    return p
  }

  const wrap = (middles: Point[]): Point[] =>
    validateOrthogonalPath([start, srcExit, ...middles, tgtEntry, end])

  const candidates: Point[][] = []

  // Case 1: straight horizontal or vertical (node center axis aligned)
  if (sourceHandle === 'right' && targetHandle === 'left' && isHorizontallyAligned(source, target)) {
    candidates.push(wrap([]))
  }
  if (
    sourceHandle === 'right' &&
    targetHandle === 'left' &&
    isAdjacentHorizontalPair(source, target)
  ) {
    candidates.unshift(buildAdjacentHorizontalPath(source, target))
  }
  if (sourceHandle === 'left' && targetHandle === 'right' && isHorizontallyAligned(source, target)) {
    candidates.push(wrap([]))
  }
  if (sourceHandle === 'bottom' && targetHandle === 'top' && isVerticallyAligned(source, target)) {
    candidates.push(wrap([]))
  }
  if (
    sourceHandle === 'bottom' &&
    targetHandle === 'top' &&
    sharesColumnRange(source, target)
  ) {
    candidates.unshift(buildAdjacentVerticalPath(source, target))
  }
  if (sourceHandle === 'top' && targetHandle === 'bottom' && isVerticallyAligned(source, target)) {
    candidates.push(wrap([]))
  }
  if (
    prefersVerticalFirstHorizExit(source, target, sourceHandle, targetHandle, srcExit, tgtEntry)
  ) {
    candidates.unshift(wrap([{ x: srcExit.x, y: tgtEntry.y }]))
  }

  // Legacy axis checks (handle points already on same line)
  if (sourceHandle === 'right' && targetHandle === 'left' && Math.abs(start.y - end.y) < 1) {
    const y = lanePoint(srcExit.x, srcExit.y).y
    candidates.push(wrap([{ x: srcExit.x, y }, { x: tgtEntry.x, y }]))
  }
  if (sourceHandle === 'left' && targetHandle === 'right' && Math.abs(start.y - end.y) < 1) {
    const y = lanePoint(srcExit.x, srcExit.y).y
    candidates.push(wrap([{ x: srcExit.x, y }, { x: tgtEntry.x, y }]))
  }
  if (sourceHandle === 'bottom' && targetHandle === 'top' && Math.abs(start.x - end.x) < 1) {
    const x = lanePoint(srcExit.x, srcExit.y).x
    candidates.push(wrap([{ x, y: srcExit.y }, { x, y: tgtEntry.y }]))
  }
  if (sourceHandle === 'top' && targetHandle === 'bottom' && Math.abs(start.x - end.x) < 1) {
    const x = lanePoint(srcExit.x, srcExit.y).x
    candidates.push(wrap([{ x, y: srcExit.y }, { x, y: tgtEntry.y }]))
  }

  // Case 2: L-shape (single bend)
  if (sourceHandle === 'right' && targetHandle === 'left' && target.x > source.x + source.width - ORTHO_EPS) {
    candidates.push(wrap([lanePoint(tgtEntry.x, srcExit.y)]))
    candidates.push(wrap([lanePoint(srcExit.x, tgtEntry.y)]))
  } else if (sourceHoriz) {
    candidates.push(wrap([lanePoint(srcExit.x, tgtEntry.y)]))
    candidates.push(wrap([lanePoint(tgtEntry.x, srcExit.y)]))
  } else {
    candidates.push(wrap([lanePoint(tgtEntry.x, srcExit.y)]))
    candidates.push(wrap([lanePoint(srcExit.x, tgtEntry.y)]))
  }

  // Case 3: Z-shape (two bends) — offset은 한 축씩만
  const midX = (srcExit.x + tgtEntry.x) / 2
  const midY = (srcExit.y + tgtEntry.y) / 2
  if (sourceHoriz) {
    const y1 = lanePoint(midX, srcExit.y).y
    candidates.push(wrap([{ x: midX, y: y1 }, { x: midX, y: tgtEntry.y }]))
    const x2 = lanePoint(srcExit.x, midY).x
    candidates.push(wrap([{ x: x2, y: srcExit.y }, { x: tgtEntry.x, y: midY }]))
  } else {
    const x1 = lanePoint(srcExit.x, midY).x
    candidates.push(wrap([{ x: x1, y: srcExit.y }, { x: tgtEntry.x, y: midY }]))
    const y2 = lanePoint(midX, srcExit.y).y
    candidates.push(wrap([{ x: srcExit.x, y: y2 }, { x: midX, y: tgtEntry.y }]))
  }

  if (allowExternalDetour) {
    const detourX = Math.max(source.x + source.width, target.x + target.width) + 120 + Math.abs(idx) * edgeGap * 2
    candidates.push(
      wrap([
        { x: detourX, y: srcExit.y },
        { x: detourX, y: tgtEntry.y },
      ]),
    )
  }

  return candidates.map(simplifyOrthogonal)
}

function buildManualPath(
  source: PlacedNode,
  target: PlacedNode,
  sourceHandle: EdgeHandleId,
  targetHandle: EdgeHandleId,
  manualPoints: Point[],
  parallelIndex: number,
  anchors: PathAnchorOptions = {},
): Point[] {
  const start = getHandlePoint(source, sourceHandle, anchors.sourceAnchorRatio ?? 0.5)
  const end = getHandlePoint(target, targetHandle, anchors.targetAnchorRatio ?? 0.5)
  const idx = anchors.parallelIndex ?? parallelIndex
  const stub = HANDLE_STUB + Math.abs(idx) * 4
  const srcExit = exitPoint(start, sourceHandle, stub)
  const tgtEntry = entryPoint(end, targetHandle, stub)

  const middle = manualPoints.length > 0 ? manualPoints : []
  return validateOrthogonalPath([start, srcExit, ...middle, tgtEntry, end])
}

function routeBracketEdge(
  options: OrthogonalRouteOptions,
  side: 'left' | 'right',
  defaultSourceHandle: EdgeHandleId,
  defaultTargetHandle: EdgeHandleId,
): OrthogonalRouteResult {
  const {
    edge,
    source,
    target,
    placed,
    parallelIndex = 0,
    branchContext,
    minContentX = 0,
    existingSegments = [],
    process,
  } = options

  const excludeIds = new Set([source.id, target.id])
  const nodePadding = PRIORITY_ROUTE_NODE_PADDING
  const sourceType = getNodeType(process, source.id)
  const targetType = getNodeType(process, target.id)
  const idx = branchContext?.parallelIndex ?? parallelIndex

  const userSource = resolveEdgeSourceHandle(edge)
  const userTarget = resolveEdgeTargetHandle(edge)
  const sourceHandle = userSource ?? defaultSourceHandle
  const targetHandle = userTarget ?? defaultTargetHandle

  const points = buildSameLaneBracketPath(
    source,
    target,
    sourceHandle,
    targetHandle,
    sourceType,
    targetType,
    side,
    idx,
    { placed, excludeIds, nodePadding, process },
  )

  const finalized = finalizeRoutedPath(
    points,
    source,
    target,
    sourceHandle,
    targetHandle,
    { parallelIndex: idx },
    placed,
    excludeIds,
    nodePadding,
    edge,
    process,
  )

  const label = resolveRouteEdgeLabel(options, finalized, existingSegments)

  return {
    path: pointsToPath(finalized, minContentX),
    points: finalized,
    bendPoints: [],
    sourceHandle,
    targetHandle,
    ...routeLabelFields(label),
    exactEndpoints: true,
  }
}

function routeSameLaneVerticalOneBendEdge(
  options: OrthogonalRouteOptions,
  sourceHandle: EdgeHandleId,
  targetHandle: EdgeHandleId,
): OrthogonalRouteResult | null {
  const {
    edge,
    source,
    target,
    placed,
    parallelIndex = 0,
    branchContext,
    minContentX = 0,
    existingSegments = [],
    process,
  } = options
  if (!process) return null

  const excludeIds = new Set([source.id, target.id])
  const nodePadding = PRIORITY_ROUTE_NODE_PADDING
  const sourceType = getNodeType(process, source.id)
  const targetType = getNodeType(process, target.id)
  const idx = branchContext?.parallelIndex ?? parallelIndex

  const raw = buildSameLaneVerticalOneBendPath(
    source,
    target,
    sourceHandle,
    targetHandle,
    sourceType,
    targetType,
  )
  const finalized = finalizeRoutedPath(
    raw,
    source,
    target,
    sourceHandle,
    targetHandle,
    { parallelIndex: idx },
    placed,
    excludeIds,
    nodePadding,
    edge,
    process,
  )
  if (countNodeCollisions(finalized, placed, excludeIds, nodePadding, process) > 0) {
    return null
  }

  const label = resolveRouteEdgeLabel(options, finalized, existingSegments)
  return {
    path: pointsToPath(finalized, minContentX),
    points: finalized,
    bendPoints: extractBendPoints(finalized),
    sourceHandle,
    targetHandle,
    ...routeLabelFields(label),
    exactEndpoints: true,
  }
}

function routeSameLaneSideTopOneBendEdge(
  options: OrthogonalRouteOptions,
  sourceHandle: EdgeHandleId,
): OrthogonalRouteResult | null {
  const {
    edge,
    source,
    target,
    placed,
    parallelIndex = 0,
    branchContext,
    minContentX = 0,
    existingSegments = [],
    process,
  } = options
  if (!process) return null
  if (sourceHandle !== 'right' && sourceHandle !== 'left') return null

  const excludeIds = new Set([source.id, target.id])
  const nodePadding = PRIORITY_ROUTE_NODE_PADDING
  const sourceType = getNodeType(process, source.id)
  const targetType = getNodeType(process, target.id)
  const idx = branchContext?.parallelIndex ?? parallelIndex
  const targetHandle: EdgeHandleId = 'top'

  const raw = buildSameLaneSideTopOneBendPath(source, target, sourceHandle, sourceType, targetType)
  const finalized = finalizeRoutedPath(
    raw,
    source,
    target,
    sourceHandle,
    targetHandle,
    { parallelIndex: idx },
    placed,
    excludeIds,
    nodePadding,
    edge,
    process,
  )
  if (countNodeCollisions(finalized, placed, excludeIds, nodePadding, process) > 0) {
    return null
  }

  const label = resolveRouteEdgeLabel(options, finalized, existingSegments)
  return {
    path: pointsToPath(finalized, minContentX),
    points: finalized,
    bendPoints: extractBendPoints(finalized),
    sourceHandle,
    targetHandle,
    ...routeLabelFields(label),
    exactEndpoints: true,
  }
}

function routeReturnGutterEdge(options: OrthogonalRouteOptions): OrthogonalRouteResult | null {
  const {
    edge,
    source,
    target,
    placed,
    parallelIndex = 0,
    branchContext,
    minContentX = 0,
    existingSegments = [],
    process,
  } = options
  if (!process) return null
  if (!qualifiesForReturnFeedbackEdge(edge, source, target, process)) return null

  const excludeIds = new Set([source.id, target.id])
  const idx = branchContext?.parallelIndex ?? parallelIndex
  const nodeMargin = resolveRouteNodeMargin(options)
  const gutterCandidates = buildReturnGutterRouteCandidates(
    edge,
    source,
    target,
    placed,
    excludeIds,
    idx,
    process,
  )
  const selected = selectCollisionFreeReturnRoute(
    gutterCandidates,
    placed,
    excludeIds,
    nodeMargin,
    process,
  )
  if (!selected) return null

  const sourceType = getNodeType(process, source.id)
  const targetType = getNodeType(process, target.id)
  const finalized = finalizeRoutedPath(
    selected.points,
    source,
    target,
    selected.sourceHandle,
    selected.targetHandle,
    { parallelIndex: idx, sourceAnchorRatio: 0.5, targetAnchorRatio: 0.5 },
    placed,
    excludeIds,
    nodeMargin,
    edge,
    process,
  )
  const label = resolveRouteEdgeLabel(options, finalized, existingSegments)

  return {
    path: pointsToPath(finalized, minContentX),
    points: finalized,
    bendPoints: extractBendPoints(finalized),
    sourceHandle: selected.sourceHandle,
    targetHandle: selected.targetHandle,
    ...routeLabelFields(label),
    exactEndpoints: isBranchNodeType(sourceType) || isBranchNodeType(targetType),
  }
}

function routeSameLaneBracketReturnEdge(
  options: OrthogonalRouteOptions,
): OrthogonalRouteResult {
  const {
    edge,
    source,
    target,
    placed,
    parallelIndex = 0,
    branchContext,
    minContentX = 0,
    process,
  } = options

  const userSource = resolveEdgeSourceHandle(edge)
  const userTarget = resolveEdgeTargetHandle(edge)
  const idx = branchContext?.parallelIndex ?? parallelIndex
  const excludeIds = new Set([source.id, target.id])
  const sourceType = getNodeType(process, source.id)
  const targetType = getNodeType(process, target.id)

  const prefersRightBracket =
    userSource === 'right' ||
    userTarget === 'right' ||
    (isDecisionNodeType(sourceType) &&
      !hasUserSpecifiedHandles(edge) &&
      target.x + target.width / 2 > source.x + source.width / 2)

  let side: BracketSide = 'left'
  let defaultSource: EdgeHandleId = 'left'
  let defaultTarget: EdgeHandleId = 'left'

  if (prefersRightBracket) {
    defaultSource = userSource ?? 'right'
    defaultTarget = userTarget ?? 'right'
    side = pickBracketSide(
      source,
      target,
      placed,
      excludeIds,
      minContentX,
      idx,
      sourceType,
      targetType,
      process,
    )
  }

  return routeBracketEdge(options, side, defaultSource, defaultTarget)
}

function routeDecisionRightDownBracketEdge(
  options: OrthogonalRouteOptions,
): OrthogonalRouteResult {
  const { source, target, edge } = options
  const [sh, th] = inferDecisionOutgoingPair(source, target, edge)
  return routeBracketEdge(options, 'right', sh, th === 'top' ? 'right' : th)
}

function isLeftwardDecisionReturnEdge(
  edge: Edge,
  source: PlacedNode,
  target: PlacedNode,
  process?: Process,
): boolean {
  if (!process || !isReturnLikeEdge(edge)) return false
  const sourceType = getNodeType(process, source.id)
  if (!isBranchNodeType(sourceType)) return false
  return nodeCenterX(target) < nodeCenterX(source) - 12
}

function routeCompactDecisionRightReturnEdge(options: OrthogonalRouteOptions): OrthogonalRouteResult {
  const {
    edge,
    source,
    target,
    placed,
    parallelIndex = 0,
    minContentX = 0,
    existingSegments = [],
    process,
  } = options
  const sourceHandle: EdgeHandleId = 'right'
  const targetHandle: EdgeHandleId = 'right'
  const sourceType = getNodeType(process, source.id)
  const targetType = getNodeType(process, target.id)
  const start = getHandlePoint(source, sourceHandle, 0.5, sourceType)
  const end = getHandlePoint(target, targetHandle, 0.5, targetType)
  const offsetX = Math.max(start.x, end.x) + 32 + Math.abs(parallelIndex) * 8
  const points = [start, { x: offsetX, y: start.y }, { x: offsetX, y: end.y }, end]
  const excludeIds = new Set([source.id, target.id])
  const finalized = finalizeRoutedPath(
    points,
    source,
    target,
    sourceHandle,
    targetHandle,
    { parallelIndex, sourceAnchorRatio: 0.5, targetAnchorRatio: 0.5 },
    placed,
    excludeIds,
    PRIORITY_ROUTE_NODE_PADDING,
    edge,
    process,
  )
  const label = resolveRouteEdgeLabel(options, finalized, existingSegments)

  return {
    path: pointsToPath(finalized, minContentX),
    points: finalized,
    bendPoints: extractBendPoints(finalized),
    sourceHandle,
    targetHandle,
    ...routeLabelFields(label),
    exactEndpoints: true,
  }
}

function routeLockedHandleEdge(options: OrthogonalRouteOptions): OrthogonalRouteResult | null {
  const { edge, process } = options
  if (isManualRouteEdge(edge)) return null

  const locked = resolveLockedEdgeHandles(edge)
  if (!locked) return null

  const { sourceHandle: sh, targetHandle: th } = locked

  if (process && isConnectorEdge(edge, process)) {
    const connectorRoute = routeConnectorOrthogonalEdge(options, locked)
    if (connectorRoute) {
      return finishOrthogonalRoute(options, connectorRoute, 'connector-locked')
    }
  }

  const lockedCompactRoute = routeDetailLayoutCompactEdge(options, true)
  if (
    lockedCompactRoute &&
    lockedCompactRoute.sourceHandle === sh &&
    lockedCompactRoute.targetHandle === th
  ) {
    return lockedCompactRoute
  }

  const sourceType = getNodeType(process, options.source.id)
  const targetType = getNodeType(process, options.target.id)
  const branchLocked = isBranchNodeType(sourceType) || isBranchNodeType(targetType)
  const branchBracketIntent =
    (sh === 'right' && th === 'right') ||
    (sh === 'left' && th === 'left') ||
    (sh === 'top' && th === 'top')
  if (
    branchLocked &&
    sh === 'right' &&
    th === 'right' &&
    isLeftwardDecisionReturnEdge(edge, options.source, options.target, process)
  ) {
    return finishOrthogonalRoute(
      options,
      routeCompactDecisionRightReturnEdge(options),
      'decision-compact-right-return-locked',
    )
  }
  if (
    ((sh === 'right' && th === 'left') || (sh === 'left' && th === 'right')) &&
    isHorizontallyAligned(options.source, options.target, SAME_ROW_Y_TOLERANCE)
  ) {
    return finishOrthogonalRoute(
      options,
      routePriorityHandleEdge(options, sh, th),
      'same-row-horizontal-locked',
    )
  }
  if (sh === 'left' && th === 'right') {
    const crossLaneReturn = routeCrossLaneLeftRightReturnEdge(options)
    if (crossLaneReturn) {
      return finishOrthogonalRoute(
        options,
        crossLaneReturn,
        'cross-lane-left-right-return-locked',
      )
    }
  }

  if (
    sh === 'right' &&
    th === 'left' &&
    detailLayoutRightwardColumnFlow(options.source, options.target, process)
  ) {
    return finishOrthogonalRoute(
      options,
      routeAdjacentHorizontalStraightEdge(options),
      'detail-layout-rightward-column-locked',
    )
  }

  if (
    branchLocked &&
    sh === 'bottom' &&
    th === 'top' &&
    branchDownwardSharesColumn(options.source, options.target, sourceType)
  ) {
    return finishOrthogonalRoute(
      options,
      routeDecisionAwareEdge(options, sh, th),
      'branch-downward-straight-locked',
    )
  }

  if (branchLocked && !branchBracketIntent) {
    return finishOrthogonalRoute(
      options,
      routePriorityHandleEdge(options, sh, th),
      'branch-priority-locked',
    )
  }

  if (branchLocked) {
    return finishOrthogonalRoute(
      options,
      routeDecisionAwareEdge(options, sh, th),
      'decision-aware-locked',
    )
  }

  const { source, target } = options
  if (
    qualifiesForSameLaneSideTopOneBend(source, target, sh, th, process) &&
    (sh === 'right' || sh === 'left')
  ) {
    const oneBend = routeSameLaneSideTopOneBendEdge(options, sh)
    if (oneBend) {
      return finishOrthogonalRoute(options, oneBend, 'same-lane-side-top-one-bend-locked')
    }
  }

  if (
    qualifiesForSameLaneVerticalSideBracket(source, target, sh, th, process) &&
    (sh === 'right' || sh === 'left')
  ) {
    return finishOrthogonalRoute(
      options,
      routeBracketEdge(options, sh, sh, th),
      'same-lane-vertical-side-bracket-locked',
    )
  }

  return finishOrthogonalRoute(
    options,
    routePriorityHandleEdge(options, sh, th),
    'priority-locked',
  )
}

function routeDetailLayoutCompactEdge(
  options: OrthogonalRouteOptions,
  allowSpecifiedHandles = false,
): OrthogonalRouteResult | null {
  const { edge, source, target, placed, process, minContentX = 0, existingSegments = [] } = options
  if (!process) return null
  if ((!allowSpecifiedHandles && hasUserSpecifiedHandles(edge)) || isManualRouteEdge(edge)) return null

  if (sameDetailLayoutColumn(source, target, process)) {
    const sourceHandle: EdgeHandleId = nodeCenterY(target) >= nodeCenterY(source) ? 'bottom' : 'top'
    const targetHandle: EdgeHandleId = nodeCenterY(target) >= nodeCenterY(source) ? 'top' : 'bottom'
    const anchorX = sharedColumnX(source, target) ?? (nodeCenterX(source) + nodeCenterX(target)) / 2
    const sourceRatio = clampAnchorRatio((anchorX - source.x) / source.width)
    const targetRatio = clampAnchorRatio((anchorX - target.x) / target.width)
    const sourceType = getNodeType(process, source.id)
    const targetType = getNodeType(process, target.id)
    const start = getHandlePoint(source, sourceHandle, sourceRatio, sourceType)
    const end = getHandlePoint(target, targetHandle, targetRatio, targetType)
    const excludeIds = new Set([source.id, target.id])
    const finalized = finalizeRoutedPath(
      [start, end],
      source,
      target,
      sourceHandle,
      targetHandle,
      { sourceAnchorRatio: sourceRatio, targetAnchorRatio: targetRatio },
      placed,
      excludeIds,
      PRIORITY_ROUTE_NODE_PADDING,
      edge,
      process,
    )
    const label = resolveRouteEdgeLabel(options, finalized, existingSegments)
    return finishOrthogonalRoute(
      options,
      {
        path: pointsToPath(finalized, minContentX),
        points: finalized,
        bendPoints: extractBendPoints(finalized),
        sourceHandle,
        targetHandle,
        ...routeLabelFields(label),
        exactEndpoints: true,
      },
      nodeCenterY(target) >= nodeCenterY(source)
        ? 'detail-layout-same-column-down'
        : 'detail-layout-same-column-up',
    )
  }

  if (sameDetailLayoutRow(source, target, process)) {
    const sourceHandle: EdgeHandleId = nodeCenterX(target) >= nodeCenterX(source) ? 'right' : 'left'
    const targetHandle: EdgeHandleId = nodeCenterX(target) >= nodeCenterX(source) ? 'left' : 'right'
    const anchorY = sharedRowY(source, target) ?? (nodeCenterY(source) + nodeCenterY(target)) / 2
    const sourceRatio = clampAnchorRatio((anchorY - source.y) / source.height)
    const targetRatio = clampAnchorRatio((anchorY - target.y) / target.height)
    const sourceType = getNodeType(process, source.id)
    const targetType = getNodeType(process, target.id)
    const start = getHandlePoint(source, sourceHandle, sourceRatio, sourceType)
    const end = getHandlePoint(target, targetHandle, targetRatio, targetType)
    const excludeIds = new Set([source.id, target.id])
    const finalized = finalizeRoutedPath(
      [start, end],
      source,
      target,
      sourceHandle,
      targetHandle,
      { sourceAnchorRatio: sourceRatio, targetAnchorRatio: targetRatio },
      placed,
      excludeIds,
      PRIORITY_ROUTE_NODE_PADDING,
      edge,
      process,
    )
    const label = resolveRouteEdgeLabel(options, finalized, existingSegments)
    return finishOrthogonalRoute(
      options,
      {
        path: pointsToPath(finalized, minContentX),
        points: finalized,
        bendPoints: extractBendPoints(finalized),
        sourceHandle,
        targetHandle,
        ...routeLabelFields(label),
        exactEndpoints: true,
      },
      nodeCenterX(target) >= nodeCenterX(source)
        ? 'detail-layout-same-row-right'
        : 'detail-layout-same-row-left',
    )
  }

  if (detailLayoutAdjacentColumnFlow(source, target, process)) {
    const sourceBeforeTarget = nodeCenterX(source) <= nodeCenterX(target)
    const sourceHandle: EdgeHandleId = sourceBeforeTarget ? 'right' : 'left'
    const targetHandle: EdgeHandleId = sourceBeforeTarget ? 'left' : 'right'
    const sourceType = getNodeType(process, source.id)
    const targetType = getNodeType(process, target.id)
    const start = getHandlePoint(source, sourceHandle, 0.5, sourceType)
    const end = getHandlePoint(target, targetHandle, 0.5, targetType)
    const gapX = sourceBeforeTarget
      ? (source.x + source.width + target.x) / 2
      : (target.x + target.width + source.x) / 2
    const raw = validateOrthogonalPath([
      start,
      { x: gapX, y: start.y },
      { x: gapX, y: end.y },
      end,
    ])
    const excludeIds = new Set([source.id, target.id])
    const finalized = finalizeRoutedPath(
      raw,
      source,
      target,
      sourceHandle,
      targetHandle,
      { sourceAnchorRatio: 0.5, targetAnchorRatio: 0.5 },
      placed,
      excludeIds,
      PRIORITY_ROUTE_NODE_PADDING,
      edge,
      process,
    )
    const label = resolveRouteEdgeLabel(options, finalized, existingSegments)
    return finishOrthogonalRoute(
      options,
      {
        path: pointsToPath(finalized, minContentX),
        points: finalized,
        bendPoints: extractBendPoints(finalized),
        sourceHandle,
        targetHandle,
        ...routeLabelFields(label),
        exactEndpoints: isBranchNodeType(sourceType) || isBranchNodeType(targetType),
      },
      sourceBeforeTarget
        ? 'detail-layout-adjacent-column-right'
        : 'detail-layout-adjacent-column-left',
    )
  }

  if (detailLayoutRightwardColumnFlow(source, target, process)) {
    return finishOrthogonalRoute(
      options,
      routeAdjacentHorizontalStraightEdge(options),
      'detail-layout-rightward-column',
    )
  }

  return null
}

function routeUpwardSequentialMergeEdge(options: OrthogonalRouteOptions): OrthogonalRouteResult | null {
  const {
    edge,
    source,
    target,
    placed,
    process,
    parallelIndex = 0,
    minContentX = 0,
    existingSegments = [],
  } = options
  if (!qualifiesForUpwardSequentialMerge(edge, source, target, process)) return null

  const sourceBeforeTarget = nodeCenterX(source) <= nodeCenterX(target)
  const sourceHandle: EdgeHandleId = sourceBeforeTarget ? 'right' : 'left'
  const targetHandle: EdgeHandleId = sourceBeforeTarget ? 'left' : 'right'
  const sourceType = getNodeType(process, source.id)
  const targetType = getNodeType(process, target.id)
  const start = getHandlePoint(source, sourceHandle, 0.5, sourceType)
  const end = getHandlePoint(target, targetHandle, 0.5, targetType)
  const stub = HANDLE_STUB + Math.abs(parallelIndex) * 4
  const srcExit = exitPoint(start, sourceHandle, stub)
  const tgtEntry = entryPoint(end, targetHandle, stub)
  const excludeIds = new Set([source.id, target.id])
  const nodePadding = PRIORITY_ROUTE_NODE_PADDING
  const laneX = sourceBeforeTarget
    ? Math.min(tgtEntry.x, Math.max(srcExit.x, end.x - APPROACH_MIN_LEG))
    : Math.max(tgtEntry.x, Math.min(srcExit.x, end.x + APPROACH_MIN_LEG))
  const innerX = sourceBeforeTarget
    ? Math.min(tgtEntry.x, Math.max(srcExit.x, target.x - nodePadding))
    : Math.max(tgtEntry.x, Math.min(srcExit.x, target.x + target.width + nodePadding))
  const outsideX = sourceBeforeTarget
    ? Math.min(source.x, target.x) - nodePadding - 16
    : Math.max(source.x + source.width, target.x + target.width) + nodePadding + 16

  const candidates = [
    validateOrthogonalPath([start, srcExit, { x: laneX, y: srcExit.y }, { x: laneX, y: tgtEntry.y }, tgtEntry, end]),
    validateOrthogonalPath([start, srcExit, { x: innerX, y: srcExit.y }, { x: innerX, y: tgtEntry.y }, tgtEntry, end]),
    validateOrthogonalPath([start, srcExit, { x: outsideX, y: srcExit.y }, { x: outsideX, y: tgtEntry.y }, tgtEntry, end]),
  ]

  let best: Point[] | null = null
  let bestScore = Number.POSITIVE_INFINITY
  for (const candidate of candidates) {
    const finalized = finalizeRoutedPath(
      candidate,
      source,
      target,
      sourceHandle,
      targetHandle,
      { parallelIndex, sourceAnchorRatio: 0.5, targetAnchorRatio: 0.5 },
      placed,
      excludeIds,
      nodePadding,
      edge,
      process,
    )
    const collisions = countNodeCollisions(finalized, placed, excludeIds, nodePadding, process)
    if (collisions > 0) continue
    const bends = countOrthogonalBends(finalized)
    if (bends > MAX_ORTHOGONAL_BENDS + 1) continue
    let score = pathCost(
      finalized,
      source,
      target,
      placed,
      excludeIds,
      existingSegments,
      false,
      nodePadding,
      {},
      process,
    )
    if (isExternalRoute(finalized, source, target)) score += ROUTE_TIER_COST.outerRoute * 4
    if ((sourceBeforeTarget && hasImmediateLeftFromSourceExit(finalized)) ||
      (!sourceBeforeTarget && hasImmediateHorizontalFromSourceExit(finalized))) {
      score += ROUTE_TIER_COST.outerRoute
    }
    score += bends * ROUTE_TIER_COST.oneBend
    if (score < bestScore) {
      bestScore = score
      best = finalized
    }
  }

  if (!best) return null
  const label = resolveRouteEdgeLabel(options, best, existingSegments)
  return finishOrthogonalRoute(
    options,
    {
      path: pointsToPath(best, minContentX),
      points: best,
      bendPoints: extractBendPoints(best),
      sourceHandle,
      targetHandle,
      ...routeLabelFields(label),
      exactEndpoints: true,
    },
    'upward-sequential-merge',
  )
}

function routeManualEdge(options: OrthogonalRouteOptions): OrthogonalRouteResult | null {
  const {
    edge,
    source,
    target,
    placed,
    parallelIndex = 0,
    branchContext,
    minContentX = 0,
    existingSegments = [],
    process,
    overviewMode = false,
  } = options
  if (!isManualRouteEdge(edge)) return null

  const pathAnchors = resolvePathAnchors(parallelIndex, branchContext)
  const excludeIds = new Set([source.id, target.id])
  const routing: EdgeRoutingConfig | undefined = edge.routing
  const savedBendPoints = resolveSavedBendPoints(edge)
  const nodeMargin = overviewMode ? overviewEdgeNodeMargin(edge) : EDGE_NODE_MARGIN
  const defaultPair = recommendHandlePairs(edge, source, target, branchContext)[0]
  const sourceHandle = resolveEdgeSourceHandle(edge) ?? defaultPair[0]
  const targetHandle = resolveEdgeTargetHandle(edge) ?? defaultPair[1]
  const manualAnchors = hasUserSpecifiedHandles(edge)
    ? { ...pathAnchors, sourceAnchorRatio: 0.5, targetAnchorRatio: 0.5 }
    : pathAnchors
  const manualPoints = routing?.points?.length ? routing.points : savedBendPoints
  const points = buildManualPath(
    source,
    target,
    sourceHandle,
    targetHandle,
    manualPoints,
    parallelIndex,
    manualAnchors,
  )
  const finalized = finalizeRoutedPath(
    points,
    source,
    target,
    sourceHandle,
    targetHandle,
    manualAnchors,
    placed,
    excludeIds,
    hasUserSpecifiedHandles(edge) ? PRIORITY_ROUTE_NODE_PADDING : nodeMargin,
    edge,
    process,
  )
  const label = resolveRouteEdgeLabel(options, finalized, existingSegments)
  const manualResult: OrthogonalRouteResult = {
    path: pointsToPath(finalized, minContentX),
    points: finalized,
    bendPoints: manualPoints,
    sourceHandle,
    targetHandle,
    ...routeLabelFields(label),
  }
  const manualCollisions = getCollidedNodes(
    finalized,
    placed,
    excludeIds,
    hasUserSpecifiedHandles(edge) ? PRIORITY_ROUTE_NODE_PADDING : nodeMargin,
    process,
  )
  if (manualCollisions.length > 0) {
    console.warn(
      `[EdgeRouter] Manual route collides with nodes (${edge.id}): ${manualCollisions.map((n) => n.name).join(', ')}${hasUserSpecifiedHandles(edge) ? '' : ' — attempting auto reroute'}`,
    )
    if (!hasUserSpecifiedHandles(edge)) {
      const rerouted = tryCollisionFreeReroute(options, manualResult)
      if (rerouted) {
        return finishOrthogonalRoute(options, rerouted, 'manual-rerouted-collision')
      }
    }
  }
  return finishOrthogonalRoute(options, manualResult, 'manual')
}

export function routeOrthogonalEdge(options: OrthogonalRouteOptions): OrthogonalRouteResult {
  const {
    edge,
    source,
    target,
    placed,
    parallelIndex = 0,
    branchContext,
    minContentX = 0,
    existingSegments = [],
    overviewMode = false,
    preferCorridor = false,
    process,
  } = options

  const pathAnchors = resolvePathAnchors(parallelIndex, branchContext)
  const excludeIds = new Set([source.id, target.id])
  const nodeMargin = overviewMode ? overviewEdgeNodeMargin(edge) : EDGE_NODE_MARGIN
  const edgeGap = overviewMode ? OVERVIEW_VERTICAL_METRICS.edgeEdgeGap : EDGE_EDGE_MARGIN

  const resolvedSourceHandle = resolveEdgeSourceHandle(edge)
  const resolvedTargetHandle = resolveEdgeTargetHandle(edge)

  const manualRoute = routeManualEdge(options)
  if (manualRoute) return manualRoute

  const lockedRoute = routeLockedHandleEdge(options)
  if (lockedRoute) return lockedRoute

  const upwardSequentialMergeRoute = routeUpwardSequentialMergeEdge(options)
  if (upwardSequentialMergeRoute) return upwardSequentialMergeRoute

  if (
    process &&
    resolvedSourceHandle &&
    resolvedTargetHandle &&
    qualifiesForSameLaneVerticalSideBracket(
      source,
      target,
      resolvedSourceHandle,
      resolvedTargetHandle,
      process,
    ) &&
    (resolvedSourceHandle === 'right' || resolvedSourceHandle === 'left')
  ) {
    const oneBend = routeSameLaneVerticalOneBendEdge(
      options,
      resolvedSourceHandle,
      resolvedTargetHandle,
    )
    if (oneBend) {
      return finishOrthogonalRoute(options, oneBend, 'same-lane-vertical-one-bend')
    }
    return finishOrthogonalRoute(
      options,
      routeBracketEdge(
        options,
        resolvedSourceHandle as BracketSide,
        resolvedSourceHandle,
        resolvedTargetHandle,
      ),
      'same-lane-vertical-side-bracket',
    )
  }

  if (
    process &&
    resolvedSourceHandle &&
    resolvedTargetHandle &&
    qualifiesForSameLaneSideTopOneBend(
      source,
      target,
      resolvedSourceHandle,
      resolvedTargetHandle,
      process,
    ) &&
    (resolvedSourceHandle === 'right' || resolvedSourceHandle === 'left')
  ) {
    const oneBend = routeSameLaneSideTopOneBendEdge(options, resolvedSourceHandle)
    if (oneBend) {
      return finishOrthogonalRoute(options, oneBend, 'same-lane-side-top-one-bend')
    }
  }

  if (
    process &&
    resolvedSourceHandle === 'bottom' &&
    resolvedTargetHandle === 'top' &&
    qualifiesForCrossZoneGapVerticalDrop(source, target, process)
  ) {
    return finishOrthogonalRoute(
      options,
      routeDownwardBottomTopEdge(options, 'bottom', 'top'),
      'cross-zone-gap-vertical-drop',
    )
  }

  const detailCompactRoute = routeDetailLayoutCompactEdge(options)
  if (detailCompactRoute) return detailCompactRoute

  const excludeIdsEarly = new Set([source.id, target.id])

  if (process) {
    const connectorRoute = routeConnectorOrthogonalEdge(options)
    if (connectorRoute) return finishOrthogonalRoute(options, connectorRoute, 'connector')
  }

  if (
    process &&
    qualifiesForSameRowRightTargetShortRoute(edge, source, target, placed, excludeIdsEarly, process)
  ) {
    return routeSameRowRightTargetEdge(options)
  }

  if (
    process &&
    !hasUserSpecifiedHandles(edge) &&
    !isManualRouteEdge(edge) &&
    qualifiesForSameLaneCrossZoneStraightVertical(source, target, process)
  ) {
    return finishOrthogonalRoute(
      options,
      routeDownwardBottomTopEdge(options, 'bottom', 'top'),
      'cross-zone-vertical-drop',
    )
  }

  if (
    qualifiesForSameLaneBracketReturn(edge, source, target, process) &&
    !prefersForwardDetailColumnUpwardRoute(edge, source, target, process)
  ) {
    return finishOrthogonalRoute(options, routeSameLaneBracketReturnEdge(options), 'same-lane-bracket-return')
  }

  if (process && qualifiesForReturnFeedbackEdge(edge, source, target, process)) {
    const gutterRoute = routeReturnGutterEdge(options)
    if (gutterRoute) {
      return finishOrthogonalRoute(options, gutterRoute, 'return-gutter')
    }
  }

  if (process && qualifiesForDecisionSameRowLeftReturn(edge, source, target, process)) {
    if (
      hasUserSpecifiedHandles(edge) &&
      resolveEdgeSourceHandle(edge) === 'top' &&
      resolveEdgeTargetHandle(edge) === 'top' &&
      qualifiesForDecisionSameRowTopReturn(edge, source, target, process)
    ) {
      return finishOrthogonalRoute(
        options,
        routeDecisionSameRowTopReturnEdge(options),
        'decision-same-row-top-return',
      )
    }
    if (!hasUserSpecifiedHandles(edge)) {
      return finishOrthogonalRoute(
        options,
        routeDecisionSameRowLeftReturnEdge(options),
        'decision-same-row-left-return',
      )
    }
  }

  if (
    process &&
    !hasUserSpecifiedHandles(edge) &&
    !isManualRouteEdge(edge) &&
    qualifiesForCrossZoneGapVerticalDrop(source, target, process)
  ) {
    return finishOrthogonalRoute(
      options,
      routeDownwardBottomTopEdge(options, 'bottom', 'top'),
      'cross-zone-vertical-drop',
    )
  }

  if (qualifiesForDecisionRightDownBracket(edge, source, target, process)) {
    return finishOrthogonalRoute(options, routeDecisionRightDownBracketEdge(options), 'decision-right-down-bracket')
  }

  const sourceTypeEarly = getNodeType(process, source.id)
  const targetTypeEarly = getNodeType(process, target.id)
  if (
    process &&
    !hasUserSpecifiedHandles(edge) &&
    nodesShareOverviewZoneDifferentLane(source, target, process) &&
    qualifiesForCrossLaneZoneAdjacentRows(source, target, process) &&
    nodeCenterX(target) > nodeCenterX(source) - ORTHO_EPS
  ) {
    const crossLaneClear = resolveClearAdjacentHorizontalPath(
      source,
      target,
      placed,
      excludeIdsEarly,
      process,
      edge,
      branchContext?.parallelIndex ?? parallelIndex,
    )
    if (crossLaneClear) {
      return finishOrthogonalRoute(
        options,
        routeAdjacentHorizontalStraightEdge(options),
        'cross-lane-horizontal',
      )
    }
  }
  if (
    qualifiesForCrossLaneZoneHorizontalBridge(source, target, placed, excludeIdsEarly, process, edge)
  ) {
    return finishOrthogonalRoute(options, routeAdjacentHorizontalStraightEdge(options), 'cross-lane-horizontal')
  }
  if (
    branchContext?.isColumnTransitionFlow &&
    branchContext.preferredSourceHandle === 'right' &&
    branchContext.preferredTargetHandle === 'left' &&
    nodesShareOverviewZoneDifferentLane(source, target, process) &&
    qualifiesForCrossLaneZoneAdjacentRows(source, target, process)
  ) {
    return routeAdjacentHorizontalStraightEdge(options)
  }
  if (
    qualifiesForAdjacentVerticalStraight(
      source,
      target,
      sourceTypeEarly,
      targetTypeEarly,
      placed,
      excludeIds,
      process,
    )
  ) {
    return routeAdjacentVerticalStraightEdge(options)
  }
  if (
    qualifiesForAdjacentHorizontalStraight(
      source,
      target,
      sourceTypeEarly,
      targetTypeEarly,
      placed,
      excludeIds,
      process,
      edge,
    )
  ) {
    return routeAdjacentHorizontalStraightEdge(options)
  }

  const userSource = resolveEdgeSourceHandle(edge)
  const userTarget = resolveEdgeTargetHandle(edge)
  const hasUserHandlePair = hasUserSpecifiedHandles(edge)

  if (hasUserHandlePair) {
    const sourceType = getNodeType(process, source.id)
    const targetType = getNodeType(process, target.id)
    const sh = userSource ?? 'right'
    const th = userTarget ?? 'left'
    const branchPartial = isBranchNodeType(sourceType) || isBranchNodeType(targetType)
    const branchBracketIntent =
      (sh === 'right' && th === 'right') ||
      (sh === 'left' && th === 'left') ||
      (sh === 'top' && th === 'top')
    if (branchPartial && branchBracketIntent) {
      return finishOrthogonalRoute(
        options,
        routeDecisionAwareEdge(options, sh, th),
        'decision-aware-partial-lock',
      )
    }
    if (isDownwardBottomTopFlow(source, target, sh, th)) {
      return finishOrthogonalRoute(
        options,
        routeDownwardBottomTopEdge(options, sh, th),
        'downward-bottom-top-partial-lock',
      )
    }
    return finishOrthogonalRoute(
      options,
      routePriorityHandleEdge(options, sh, th),
      'priority-partial-lock',
    )
  }

  const sameCell = isSameCellEdge(source, target, process)
  const sameCellSkip = isSameCellSkipEdge(source, target, placed, process)
  const nearEdge = isNearEdge(source, target, process)
  const cellInternalFlow = branchContext?.isCellInternalFlow ?? false
  const columnTransitionFlow = branchContext?.isColumnTransitionFlow ?? false
  const allowExternalDetour = !nearEdge && !cellInternalFlow && !columnTransitionFlow
  let pairCandidates = recommendHandlePairs(edge, source, target, branchContext)

  if (sameCellSkip && !columnTransitionFlow) {
    const skipPair: [EdgeHandleId, EdgeHandleId] = ['bottom', 'top']
    pairCandidates = pairCandidates.filter(
      ([sh, th]) => !(sh === skipPair[0] && th === skipPair[1]),
    )
    pairCandidates.unshift(skipPair)
  }

  if (
      branchContext?.pinTargetHandle &&
      branchContext?.pinSourceHandle &&
      branchContext.preferredSourceHandle &&
      branchContext.preferredTargetHandle
    ) {
      pairCandidates = [[branchContext.preferredSourceHandle, branchContext.preferredTargetHandle]]
    } else if (branchContext?.pinSourceHandle && branchContext.preferredSourceHandle) {
      const pinned = branchContext.preferredSourceHandle
      const pinnedPairs = pairCandidates.filter(([sh]) => sh === pinned)
      if (pinnedPairs.length > 0) {
        pairCandidates = pinnedPairs
      } else {
        pairCandidates = (['left', 'right', 'top', 'bottom'] as EdgeHandleId[])
          .filter((th) => allowsReverseFlow(edge) || (pinned !== 'top' && th !== 'bottom'))
          .map((th) => [pinned, th] as [EdgeHandleId, EdgeHandleId])
      }
    }

    if (userSource && hasUserSpecifiedHandles(edge)) {
      const sourcePinned = pairCandidates.filter(([sh]) => sh === userSource)
      pairCandidates =
        sourcePinned.length > 0
          ? sourcePinned
          : (['left', 'right', 'top', 'bottom'] as EdgeHandleId[]).map(
              (th) => [userSource, th] as [EdgeHandleId, EdgeHandleId],
            )
    }

    if (userTarget && hasUserSpecifiedHandles(edge)) {
      const targetPinned = pairCandidates.filter(([, th]) => th === userTarget)
      if (targetPinned.length > 0) {
        pairCandidates = targetPinned
      }
    }

  const downwardPair = pairCandidates.find(([sh, th]) =>
    isDownwardBottomTopFlow(source, target, sh, th),
  )

  const sourceType = getNodeType(process, source.id)
  const targetType = getNodeType(process, target.id)
  const involvesDecision = isBranchNodeType(sourceType) || isBranchNodeType(targetType)
  if (involvesDecision && !columnTransitionFlow) {
    const pairsToTry = hasUserSpecifiedHandles(edge)
      ? [pairCandidates[0] ?? (['bottom', 'top'] as [EdgeHandleId, EdgeHandleId])]
      : pairCandidates.length > 0
        ? pairCandidates
        : ([['bottom', 'top']] as Array<[EdgeHandleId, EdgeHandleId]>)

    let bestResult: OrthogonalRouteResult | null = null
    let bestCollisions = Number.POSITIVE_INFINITY
    let bestBends = Number.POSITIVE_INFINITY

    for (const [sh, th] of pairsToTry) {
      const candidate = routeDecisionAwareEdge(options, sh, th)
      const collisions = countNodeCollisions(candidate.points, placed, excludeIds, nodeMargin, process)
      const bends = countOrthogonalBends(candidate.points)
      if (collisions === 0) {
        return finishOrthogonalRoute(options, candidate, 'decision-aware-auto')
      }
      if (
        collisions < bestCollisions ||
        (collisions === bestCollisions && bends < bestBends)
      ) {
        bestCollisions = collisions
        bestBends = bends
        bestResult = candidate
      }
    }

    if (hasUserSpecifiedHandles(edge) && bestResult) {
      return finishOrthogonalRoute(
        options,
        bestResult,
        'decision-aware-locked',
      )
    }
  }

  if (downwardPair && !columnTransitionFlow) {
    return routeDownwardBottomTopEdge(options, downwardPair[0], downwardPair[1])
  }

  let best: { points: Point[]; sourceHandle: EdgeHandleId; targetHandle: EdgeHandleId } | null = null
  let bestScore = Number.POSITIVE_INFINITY
  const useCorridor =
    overviewMode &&
    !nearEdge &&
    !sameCell &&
    !cellInternalFlow &&
    !columnTransitionFlow &&
    (preferCorridor || needsOverviewCorridor(source, target, process))

  const costOptions = { sameCell, nearEdge }

  const evaluatePath = (
    points: Point[],
    sourceHandle: EdgeHandleId,
    targetHandle: EdgeHandleId,
  ) => {
    if (isDownwardBottomTopFlow(source, target, sourceHandle, targetHandle)) {
      const obstacles = getVerticalObstaclesBetween(source, target, placed, excludeIds, nodeMargin, process)
      const bends = countOrthogonalBends(points)
      if (bends > MAX_ORTHOGONAL_BENDS) return
      if (obstacles.length === 0 && bends > 1) return
      const sameLaneOrCell = isSameLaneEdge(source, target) || isSameCellEdge(source, target, process)
      if (sameLaneOrCell && isExternalRoute(points, source, target)) return
    }

    const involvesDecision =
      isBranchNodeType(getNodeType(process, source.id)) ||
      isBranchNodeType(getNodeType(process, target.id))
    if (involvesDecision) {
      const obstacles = getMinimalPathObstacles(
        source,
        target,
        sourceHandle,
        targetHandle,
        placed,
        excludeIds,
        nodeMargin,
        process,
      )
      const bends = countOrthogonalBends(points)
      if (bends > MAX_ORTHOGONAL_BENDS) return
      if (obstacles.length === 0 && bends > 1) return
    }

    const directionPenalty = handlePairDirectionPenalty(
      source,
      target,
      sourceHandle,
      targetHandle,
      edge,
    )
    if (directionPenalty >= 100) return
    if (countOrthogonalBends(points) > MAX_ORTHOGONAL_BENDS) return
    if (columnTransitionFlow && (sourceHandle !== 'right' || targetHandle !== 'left')) return
    if (columnTransitionFlow && !isColumnGapInternalRoute(points, source, target)) return
    if (nearEdge && isExternalRoute(points, source, target) && !sameCellSkip && !columnTransitionFlow) return
    if (countNodeCollisions(points, placed, excludeIds, nodeMargin, process) > 0) return
    if (pathTooCloseToExisting(points, existingSegments, edgeGap)) return
    let cost = pathCost(
      points,
      source,
      target,
      placed,
      excludeIds,
      existingSegments,
      overviewMode,
      nodeMargin,
      costOptions,
      process,
    )
    cost += directionPenalty * FLOW_DIRECTION_PENALTY_SCALE
    if (
      branchContext?.isDecisionBranch &&
      branchContext.preferredSourceHandle &&
      sourceHandle !== branchContext.preferredSourceHandle
    ) {
      cost += DECISION_BRANCH_SIDE_PENALTY
    }
    if (
      branchContext?.isCellInternalFlow &&
      branchContext.preferredSourceHandle &&
      branchContext.preferredTargetHandle &&
      (sourceHandle !== branchContext.preferredSourceHandle ||
        targetHandle !== branchContext.preferredTargetHandle)
    ) {
      cost += CELL_INTERNAL_WRONG_HANDLE_PENALTY
    }
    if (cellInternalFlow && isExternalRoute(points, source, target)) {
      cost += CELL_INTERNAL_WRONG_HANDLE_PENALTY
    }
    if (columnTransitionFlow && isExternalRoute(points, source, target)) {
      cost += COLUMN_TRANSITION_EXTERNAL_PENALTY
    }
    if (columnTransitionFlow && (sourceHandle !== 'right' || targetHandle !== 'left')) {
      cost += PREFERRED_HANDLE_MISMATCH_PENALTY
    }
    if (sameCellSkip && !columnTransitionFlow && (sourceHandle !== 'bottom' || targetHandle !== 'top')) {
      cost += PREFERRED_HANDLE_MISMATCH_PENALTY
    }
    if (cost >= Number.POSITIVE_INFINITY) return
    if (cost < bestScore) {
      bestScore = cost
      best = { points, sourceHandle, targetHandle }
    }
  }

  for (const [sourceHandle, targetHandle] of pairCandidates) {
    const paths: Point[][] = []
    const downwardFlow = isDownwardBottomTopFlow(source, target, sourceHandle, targetHandle)
    const sameLaneOrCell = isSameLaneEdge(source, target) || isSameCellEdge(source, target, process)

    if (downwardFlow) {
      paths.push(
        ...buildDownwardBottomTopPaths(
          source,
          target,
          parallelIndex,
          placed,
          excludeIds,
          nodeMargin,
          pathAnchors,
          { allowOuterDetour: !sameLaneOrCell && allowExternalDetour, process },
        ),
      )
    } else {
      if (useCorridor) {
        paths.push(
          ...buildCorridorPaths(
            source,
            target,
            sourceHandle,
            targetHandle,
            placed,
            excludeIds,
            nodeMargin,
            parallelIndex,
            pathAnchors,
            process,
          ),
        )
      }
      paths.push(
        ...buildCandidatePaths(
          source,
          target,
          sourceHandle,
          targetHandle,
          parallelIndex,
          edgeGap,
          allowExternalDetour,
          pathAnchors,
        ),
      )
      if (columnTransitionFlow && sourceHandle === 'right' && targetHandle === 'left') {
        paths.push(
          ...buildColumnTransitionPaths(source, target, parallelIndex, pathAnchors),
        )
      }
      if (sameCellSkip && !columnTransitionFlow && sourceHandle === 'bottom' && targetHandle === 'top') {
        paths.push(
          ...buildSameCellSkipPaths(
            source,
            target,
            placed,
            process,
            parallelIndex,
            pathAnchors,
          ),
        )
      }
    }
    for (const points of paths) {
      evaluatePath(points, sourceHandle, targetHandle)
    }
  }

  if (!best) {
    for (const [sourceHandle, targetHandle] of pairCandidates) {
      const sameLaneOrCell = isSameLaneEdge(source, target) || isSameCellEdge(source, target, process)
      const escapePaths = columnTransitionFlow
        ? buildColumnTransitionPaths(source, target, parallelIndex, pathAnchors)
        : isDownwardBottomTopFlow(source, target, sourceHandle, targetHandle)
        ? buildDownwardBottomTopPaths(
            source,
            target,
            parallelIndex,
            placed,
            excludeIds,
            nodeMargin,
            pathAnchors,
            { allowOuterDetour: !sameLaneOrCell && allowExternalDetour, process },
          )
        : nearEdge
        ? buildCandidatePaths(
            source,
            target,
            sourceHandle,
            targetHandle,
            parallelIndex,
            edgeGap,
            false,
            pathAnchors,
          )
        : [
            ...buildCorridorPaths(source, target, sourceHandle, targetHandle, placed, excludeIds, nodeMargin, parallelIndex, pathAnchors, process),
            ...buildCorridorPaths(source, target, sourceHandle, targetHandle, placed, excludeIds, nodeMargin, parallelIndex + 1, pathAnchors, process),
            ...buildCorridorPaths(source, target, sourceHandle, targetHandle, placed, excludeIds, nodeMargin, parallelIndex + 2, pathAnchors, process),
            ...buildCandidatePaths(source, target, sourceHandle, targetHandle, parallelIndex, edgeGap, allowExternalDetour, pathAnchors),
          ]
      for (const points of escapePaths) {
        const directionPenalty = handlePairDirectionPenalty(
          source,
          target,
          sourceHandle,
          targetHandle,
          edge,
        )
        if (directionPenalty >= 100) continue
        if (columnTransitionFlow && (sourceHandle !== 'right' || targetHandle !== 'left')) continue
        if (columnTransitionFlow && !isColumnGapInternalRoute(points, source, target)) continue
        if (nearEdge && isExternalRoute(points, source, target) && !sameCellSkip && !columnTransitionFlow) continue
        if (overviewMode && countNodeCollisions(points, placed, excludeIds, nodeMargin, process) > 0) continue
        if (pathTooCloseToExisting(points, existingSegments, edgeGap)) continue
        let cost = pathCost(
          points,
          source,
          target,
          placed,
          excludeIds,
          existingSegments,
          overviewMode,
          nodeMargin,
          costOptions,
          process,
        )
        cost += directionPenalty * FLOW_DIRECTION_PENALTY_SCALE
        if (
          branchContext?.isDecisionBranch &&
          branchContext.preferredSourceHandle &&
          sourceHandle !== branchContext.preferredSourceHandle
        ) {
          cost += DECISION_BRANCH_SIDE_PENALTY
        }
        if (
          branchContext?.isCellInternalFlow &&
          branchContext.preferredSourceHandle &&
          branchContext.preferredTargetHandle &&
          (sourceHandle !== branchContext.preferredSourceHandle ||
            targetHandle !== branchContext.preferredTargetHandle)
        ) {
          cost += CELL_INTERNAL_WRONG_HANDLE_PENALTY
        }
        if (cellInternalFlow && isExternalRoute(points, source, target)) {
          cost += CELL_INTERNAL_WRONG_HANDLE_PENALTY
        }
        if (columnTransitionFlow && isExternalRoute(points, source, target)) {
          cost += COLUMN_TRANSITION_EXTERNAL_PENALTY
        }
        if (sameCellSkip && !columnTransitionFlow && (sourceHandle !== 'bottom' || targetHandle !== 'top')) {
          cost += PREFERRED_HANDLE_MISMATCH_PENALTY
        }
        if (cost < bestScore) {
          bestScore = cost
          best = { points, sourceHandle, targetHandle }
        }
      }
    }
  }

  if (!best) {
    const [sourceHandle, targetHandle] = pairCandidates[0]
    const sameLaneOrCell = isSameLaneEdge(source, target) || isSameCellEdge(source, target, process)
    if (nearEdge) {
      const localPaths = columnTransitionFlow
        ? buildColumnTransitionPaths(source, target, parallelIndex, pathAnchors)
        : isDownwardBottomTopFlow(source, target, sourceHandle, targetHandle)
        ? buildDownwardBottomTopPaths(
            source,
            target,
            parallelIndex,
            placed,
            excludeIds,
            nodeMargin,
            pathAnchors,
            { allowOuterDetour: !sameLaneOrCell, process },
          )
        : sameCellSkip
        ? buildSameCellSkipPaths(source, target, placed, process, parallelIndex, pathAnchors)
        : pairCandidates.flatMap(([sh, th]) =>
            buildCandidatePaths(source, target, sh, th, parallelIndex, edgeGap, false, pathAnchors),
          )
      const collisionFree = localPaths.find(
        (points) =>
          countNodeCollisions(points, placed, excludeIds, nodeMargin, process) === 0 &&
          (!isExternalRoute(points, source, target) || sameCellSkip || columnTransitionFlow) &&
          (!columnTransitionFlow || isColumnGapInternalRoute(points, source, target)),
      )
      const points =
        collisionFree ??
        localPaths.find(
          (p) =>
            (!isExternalRoute(p, source, target) || sameCellSkip || columnTransitionFlow) &&
            (!columnTransitionFlow || isColumnGapInternalRoute(p, source, target)),
        ) ??
        buildCandidatePaths(source, target, sourceHandle, targetHandle, parallelIndex, edgeGap, false, pathAnchors)[0]
      best = {
        points,
        sourceHandle: columnTransitionFlow ? 'right' : sameCellSkip ? 'bottom' : sourceHandle,
        targetHandle: columnTransitionFlow ? 'left' : sameCellSkip ? 'top' : targetHandle,
      }
    } else {
      const fallbacks = buildCorridorPaths(
        source,
        target,
        sourceHandle,
        targetHandle,
        placed,
        excludeIds,
        nodeMargin,
        parallelIndex + 4,
        pathAnchors,
        process,
      )
      const collisionFree = overviewMode
        ? fallbacks.find((points) => countNodeCollisions(points, placed, excludeIds, nodeMargin) === 0)
        : fallbacks[0]
      const points =
        collisionFree ??
        fallbacks[0] ??
        buildCandidatePaths(source, target, sourceHandle, targetHandle, parallelIndex, edgeGap, allowExternalDetour, pathAnchors)[0]
      best = { points, sourceHandle, targetHandle }
    }
  }

  const finalized = finalizeRoutedPath(
    best.points,
    source,
    target,
    best.sourceHandle,
    best.targetHandle,
    pathAnchors,
    placed,
    excludeIds,
    nodeMargin,
    edge,
    process,
  )

  const label = resolveRouteEdgeLabel(options, finalized, existingSegments)

  const exactEndpoints = true

  return {
    path: pointsToPath(finalized, minContentX),
    points: finalized,
    bendPoints: extractBendPoints(finalized),
    sourceHandle: best.sourceHandle,
    targetHandle: best.targetHandle,
    ...routeLabelFields(label),
    exactEndpoints: exactEndpoints || undefined,
  }
}

/** manual bend point 드래그 — orthogonal 스냅 */
export function snapBendDrag(
  point: Point,
  _prev: Point,
  _next: Point,
  raw: Point,
): Point {
  const dx = Math.abs(raw.x - point.x)
  const dy = Math.abs(raw.y - point.y)
  if (dx >= dy) {
    return { x: raw.x, y: point.y }
  }
  return { x: point.x, y: raw.y }
}

export function segmentsFromPath(path: string): Segment[] {
  return pathSegments(parsePathPoints(path))
}

export function updateManualRoutingPoints(
  _routing: EdgeRoutingConfig | undefined,
  bendPoints: Point[],
  sourceHandle: EdgeHandleId,
  targetHandle: EdgeHandleId,
): EdgeRoutingConfig {
  return {
    mode: 'manual',
    points: bendPoints,
    sourceHandle,
    targetHandle,
  }
}

export function createAutoRouting(): EdgeRoutingConfig {
  return { mode: 'auto' }
}
