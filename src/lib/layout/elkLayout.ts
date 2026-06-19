import type { Edge as FlowEdge, Node as FlowNode } from '@xyflow/react'
import type { NodeType, Process } from '../../types/process'
import type { EdgeType } from '../../types/edgeTypes'
import type { EdgeHandleId } from '../../types/process'
import type { EdgeValidationStatus } from './edgeRouteValidation'
import { getDetailGridLayout, rebuildDetailLayoutEdges } from './detailGridLayout'
import { getOverviewVerticalLayout } from './overviewVerticalLayout'
import { buildOverviewEdges } from './overviewEdgePipeline'
import { OVERVIEW_GRID_METRICS } from './overviewGridMetrics'
import {
  type CanvasBounds,
  type LaneBand,
  type PlacedNode,
} from './laneLayout'

export type ProcessEdgeData = {
  edgeType: EdgeType
  routingKind: import('./edgeClassification').EdgeRoutingType
  elkPath?: string
  labelPoint?: { x: number; y: number }
  parallelIndex?: number
  bendPoints?: Array<{ x: number; y: number }>
  pathPoints?: Array<{ x: number; y: number }>
  routingMode?: 'auto' | 'manual'
  sourceHandle?: EdgeHandleId
  targetHandle?: EdgeHandleId
  labelHidden?: boolean
  broken?: boolean
  brokenReason?: string
  missingNodeId?: string
  exactEndpoints?: boolean
  /** 업무 보기 — 숨겨진 api/interface 경유 derived 연결 */
  derived?: boolean
  readOnly?: boolean
  /** @deprecated derived 사용 */
  virtual?: boolean
  validationStatus?: EdgeValidationStatus
  routeIssue?: string
  routeIssueLabel?: string
  suggestedFix?: string
  collidedNodeIds?: string[]
  collidedNodeNames?: string[]
  bendCount?: number
  routingStatus?: 'reroutedDueToCollision' | string
  /** @deprecated validationStatus === 'error' 사용 */
  collisionError?: boolean
  collidedNodes?: Array<{ id: string; name: string }>
}

export type ProcessNodeData = {
  nodeId: string
  name: string
  type: NodeType
  laneId: string
  laneName: string
  phaseId: string
  phaseLabel: string
  phaseOrder: number
  localOrder: number
  compact?: boolean
  system?: string
  decisionSubtitle?: string
  connectorSubType?: import('../../types/connectorTypes').ConnectorSubType
  /** 3열 cell 내부 좁은 노드 */
  cell3Col?: boolean
}

export type LayoutOptions = {
  overviewVertical?: boolean
}

export type LayoutResult = {
  nodes: FlowNode<ProcessNodeData>[]
  edges: FlowEdge[]
  laneBands: LaneBand[]
  canvasBounds: CanvasBounds
  layoutOrientation?: 'horizontal' | 'vertical'
  zoneBands?: import('./overviewGridLayout').ZoneLayoutBand[]
}

/** 연결선 topology 변경 시 — 기존 노드 배치 유지, edge path만 재계산 */
export function rebuildLayoutEdges(
  process: Process,
  placed: PlacedNode[],
  options: { overviewVertical?: boolean; laneBands?: LaneBand[] },
): FlowEdge[] {
  if (options.overviewVertical) {
    const minContentX =
      options.laneBands?.[0]?.contentLeft ?? OVERVIEW_GRID_METRICS.zoneLabelColumnWidth
    return buildOverviewEdges(process, placed, minContentX).flowEdges
  }
  return rebuildDetailLayoutEdges(process, placed)
}

export function getLayoutedElements(process: Process, options?: LayoutOptions): LayoutResult {
  if (options?.overviewVertical) {
    const vertical = getOverviewVerticalLayout(process)
    return {
      nodes: vertical.nodes,
      edges: vertical.edges,
      laneBands: vertical.laneBands,
      canvasBounds: vertical.canvasBounds,
      layoutOrientation: 'vertical',
      zoneBands: vertical.zoneBands,
    }
  }

  const detail = getDetailGridLayout(process)
  return {
    nodes: detail.nodes,
    edges: detail.edges,
    laneBands: detail.laneBands,
    canvasBounds: detail.canvasBounds,
    layoutOrientation: 'vertical',
  }
}

export async function getLayoutedElementsAsync(process: Process): Promise<LayoutResult> {
  return getLayoutedElements(process)
}

export function getPhaseMarkers(process: Process) {
  return [...process.phases]
    .sort((a, b) => a.order - b.order)
    .map((phase) => ({
      id: phase.id,
      label: phase.label,
      order: phase.order,
      nodeCount: process.nodes.filter((n) => n.phaseId === phase.id).length,
    }))
}

export type { EdgeRoutingType } from './edgeClassification'
export type { LaneBand, PlacedNode, CanvasBounds } from './laneLayout'
export { LANE_HEADER_WIDTH, contentLeftX } from './layoutConfig'
export { COLUMN_WIDTH, NODE_VERTICAL_GAP } from './gridLayout'
export { OVERVIEW_VERTICAL_METRICS } from './overviewVerticalMetrics'
