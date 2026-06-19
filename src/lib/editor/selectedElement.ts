import type { Edge as FlowEdge } from '@xyflow/react'
import type { Edge, Lane, Node, Process, ProcessZone } from '../../types/process'
import type { EdgeHandleId } from '../../types/process'
import { PROCESS_ZONES } from '../layout/overviewProcessZones'
import type { ProcessZoneId } from '../../types/process'
import type { ProcessEdgeData } from '../layout/elkLayout'
import { validationToEdgeData } from '../layout/edgeRouteValidation'
import {
  createDefaultEdge,
  createDefaultLane,
  createDefaultNode,
  createDefaultZone,
} from './processEditor'
import type { SelectedElement } from './selectionTypes'
import { hasUserSpecifiedHandles, migrateEdgeHandles, isManualRouteEdge } from './edgeHandles'

function parseFlowHandleId(handle: string | null | undefined): EdgeHandleId | undefined {
  if (!handle) return undefined
  const match = handle.match(/(?:source|target)-(?<side>top|right|bottom|left)/)
  return (match?.groups?.side as EdgeHandleId | undefined) ?? undefined
}

function resolveRoutedHandles(flowEdge: FlowEdge): {
  sourceHandle?: EdgeHandleId
  targetHandle?: EdgeHandleId
} {
  const data = flowEdge.data as ProcessEdgeData | undefined
  return {
    sourceHandle: data?.sourceHandle ?? parseFlowHandleId(flowEdge.sourceHandle),
    targetHandle: data?.targetHandle ?? parseFlowHandleId(flowEdge.targetHandle),
  }
}

function mergeFlowEdgeRouteData(edge: Edge, flowEdge: FlowEdge): Edge {
  const flowData = flowEdge.data as ProcessEdgeData | undefined
  if (!flowData) return edge

  const routeMeta: Record<string, unknown> = {
    edgeType: flowData.edgeType,
    routingKind: flowData.routingKind,
    routingMode: flowData.routingMode,
    ...validationToEdgeData({
      validationStatus: flowData.validationStatus ?? (flowData.broken ? 'error' : 'ok'),
      routeIssue: flowData.routeIssue,
      routeIssueLabel: flowData.routeIssueLabel,
      suggestedFix: flowData.suggestedFix,
      collidedNodeIds: flowData.collidedNodeIds,
      collidedNodeNames: flowData.collidedNodeNames,
      bendCount: flowData.bendCount,
      routingStatus: flowData.routingStatus,
    }),
  }

  if (flowData.broken) {
    routeMeta.broken = true
    routeMeta.brokenReason = flowData.brokenReason
    routeMeta.missingNodeId = flowData.missingNodeId
  }

  const cleaned = Object.fromEntries(
    Object.entries(routeMeta).filter(([, value]) => value !== undefined),
  )

  return {
    ...edge,
    data: { ...(edge.data ?? {}), ...cleaned },
  }
}

export function enrichEdgeWithRoutedHandles(edge: Edge, flowEdge: FlowEdge): Edge {
  let next = mergeFlowEdgeRouteData(edge, flowEdge)

  if (!hasUserSpecifiedHandles(next) && !isManualRouteEdge(next)) {
    const routed = resolveRoutedHandles(flowEdge)
    next = {
      ...next,
      ...(routed.sourceHandle ? { sourceHandle: routed.sourceHandle } : {}),
      ...(routed.targetHandle ? { targetHandle: routed.targetHandle } : {}),
    }
  }

  return cloneEdgeData(next)
}

export function cloneNodeData(node: Node): Node {
  return {
    ...node,
    inputs: [...node.inputs],
    outputs: [...node.outputs],
    controls: [...node.controls],
  }
}

export function cloneEdgeData(edge: Edge): Edge {
  return migrateEdgeHandles({
    ...edge,
    data: edge.data ? { ...edge.data } : undefined,
    bendPoints: edge.bendPoints?.map((point) => ({ ...point })),
    points: edge.points?.map((point) => ({ ...point })),
  })
}

export function cloneLaneData(lane: Lane): Lane {
  return { ...lane }
}

export function cloneZoneData(zone: ProcessZone): ProcessZone {
  return {
    ...zone,
    laneIds: [...zone.laneIds],
    phaseIds: [...zone.phaseIds],
    nodeIds: [...zone.nodeIds],
    style: { ...zone.style },
  }
}

export function buildSelectedNode(process: Process, nodeId: string): SelectedElement | null {
  const node = process.nodes.find((n) => n.id === nodeId)
  if (!node) return null
  return { type: 'node', id: node.id, data: cloneNodeData(node) }
}

export function buildSelectedEdge(process: Process, edgeId: string): SelectedElement | null {
  const edge = process.edges.find((e) => e.id === edgeId)
  if (!edge) return null
  return { type: 'edge', id: edge.id, data: cloneEdgeData(edge) }
}

/** layout/router가 결정한 handle을 패널에 반영 */
export function buildSelectedEdgeFromFlow(process: Process, flowEdge: FlowEdge): SelectedElement | null {
  const edge = process.edges.find((e) => e.id === flowEdge.id)
  if (!edge) return null
  return {
    type: 'edge',
    id: edge.id,
    data: enrichEdgeWithRoutedHandles(edge, flowEdge),
  }
}

export function buildSelectedLane(process: Process, laneId: string): SelectedElement | null {
  const lane = process.lanes.find((l) => l.id === laneId)
  if (!lane) return null
  return { type: 'lane', id: lane.id, data: cloneLaneData(lane) }
}

export function buildSelectedOverviewZone(zoneId: ProcessZoneId): SelectedElement | null {
  const def = PROCESS_ZONES.find((zone) => zone.id === zoneId)
  if (!def) return null
  return { type: 'overview-zone', id: zoneId, data: { ...def } }
}

export function buildSelectedZone(process: Process, zoneId: string): SelectedElement | null {
  const zone = (process.zones ?? []).find((z) => z.id === zoneId)
  if (!zone) return null
  return { type: 'zone', id: zone.id, data: cloneZoneData(zone) }
}

export function buildNewNodeSelection(process: Process, defaultLaneId?: string): SelectedElement {
  const data = createDefaultNode(process, defaultLaneId)
  return { type: 'new-node', id: data.id, data }
}

export function buildNewEdgeSelection(process: Process): SelectedElement {
  const data = createDefaultEdge(process)
  return { type: 'new-edge', id: data.id, data }
}

export function buildNewLaneSelection(process: Process): SelectedElement {
  const data = createDefaultLane(process)
  return { type: 'new-lane', id: data.id, data }
}

export function buildNewZoneSelection(): SelectedElement {
  const data = createDefaultZone()
  return { type: 'new-zone', id: data.id, data }
}

/** process 저장 후 selection data 동기화 */
export function refreshSelectedElement(
  selected: SelectedElement | null,
  process: Process,
): SelectedElement | null {
  if (!selected) return null

  switch (selected.type) {
    case 'node':
      return buildSelectedNode(process, selected.id) ?? selected
    case 'edge':
      return buildSelectedEdge(process, selected.id) ?? selected
    case 'lane':
      return buildSelectedLane(process, selected.id) ?? selected
    case 'zone':
      return buildSelectedZone(process, selected.id) ?? selected
    case 'overview-zone':
      return buildSelectedOverviewZone(selected.id as ProcessZoneId) ?? selected
    case 'new-node':
    case 'new-edge':
    case 'new-lane':
    case 'new-zone':
      return selected
    default:
      return null
  }
}

export function selectedElementKey(selected: SelectedElement | null): string {
  if (!selected) return 'none'
  return `${selected.type}:${selected.id}`
}

export function isNewSelection(selected: SelectedElement): boolean {
  return (
    selected.type === 'new-node' ||
    selected.type === 'new-edge' ||
    selected.type === 'new-lane' ||
    selected.type === 'new-zone'
  )
}
