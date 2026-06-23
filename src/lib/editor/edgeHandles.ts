import type { Edge, EdgeHandleId, EdgeRoutingConfig, EdgeRoutingPoint, Node, Process } from '../../types/process'
import { generateId } from './processEditor'
import { DEFAULT_EDGE_TYPE } from '../../types/edgeTypes'
import { updateManualRoutingPoints } from '../layout/orthogonalEdgeRouter'

export const EDGE_HANDLE_OPTIONS: { value: EdgeHandleId; label: string }[] = [
  { value: 'top', label: '위' },
  { value: 'right', label: '오른쪽' },
  { value: 'bottom', label: '아래' },
  { value: 'left', label: '왼쪽' },
]

export function resolveEdgeSourceHandle(edge: Edge): EdgeHandleId | undefined {
  return edge.sourceHandle ?? edge.routing?.sourceHandle
}

export function resolveEdgeTargetHandle(edge: Edge): EdgeHandleId | undefined {
  return edge.targetHandle ?? edge.routing?.targetHandle
}

type EdgePathData = {
  bendPoints?: { x: number; y: number }[]
  pathPoints?: { x: number; y: number }[]
}

/** routing.points / bendPoints / points / data.bendPoints 중 저장된 bend 중간점 */
export function resolveSavedBendPoints(edge: Edge): { x: number; y: number }[] {
  const fromRouting = edge.routing?.points
  if (fromRouting?.length) return fromRouting.map((point) => ({ ...point }))

  const fromBend = edge.bendPoints
  if (fromBend?.length) return fromBend.map((point) => ({ ...point }))

  const fromPoints = edge.points
  if (fromPoints?.length) return fromPoints.map((point) => ({ ...point }))

  const data = edge.data as EdgePathData | undefined
  if (data?.bendPoints?.length) return data.bendPoints.map((point) => ({ ...point }))

  return []
}

export function hasSavedEdgePath(edge: Edge): boolean {
  return resolveSavedBendPoints(edge).length > 0
}

/** manualRoute, routing.mode=manual, 또는 저장된 bend가 있으면 auto router 스킵 */
export function isManualRouteEdge(edge: Edge): boolean {
  if (edge.manualRoute === true) return true
  if (edge.routing?.mode === 'manual') return true
  return hasSavedEdgePath(edge)
}

function preserveEdgeRouting(edge: Edge): EdgeRoutingConfig {
  const routing = edge.routing
  const savedPoints = resolveSavedBendPoints(edge)
  const useManual = isManualRouteEdge(edge)

  if (useManual) {
    return {
      mode: 'manual',
      ...(routing?.handlesLocked ? { handlesLocked: true } : {}),
      ...(routing?.handleAuto === true ? { handleAuto: true } : {}),
      ...(routing?.sourceHandle ? { sourceHandle: routing.sourceHandle } : {}),
      ...(routing?.targetHandle ? { targetHandle: routing.targetHandle } : {}),
      ...(savedPoints.length ? { points: savedPoints } : {}),
    }
  }

  return {
    mode: 'auto',
    ...(routing?.handlesLocked ? { handlesLocked: true } : {}),
    ...(routing?.handleAuto === true ? { handleAuto: true } : {}),
    ...(savedPoints.length ? { points: savedPoints.map((point) => ({ ...point })) } : {}),
  }
}

/** JSON 로드 시 routing.* handle을 root로 이전 (routing mode/points는 유지) */
export function migrateEdgeHandles(edge: Edge): Edge {
  const sourceHandle = resolveEdgeSourceHandle(edge)
  const targetHandle = resolveEdgeTargetHandle(edge)
  return {
    ...edge,
    ...(sourceHandle ? { sourceHandle } : {}),
    ...(targetHandle ? { targetHandle } : {}),
    routing: preserveEdgeRouting(edge),
  }
}

/** Property Panel 저장 시 handle 기본값 — handleAuto면 router 선택값 유지 */
export function withEdgeHandleDefaults(edge: Edge): Edge {
  const auto = isHandleAutoEnabled(edge)
  return {
    ...edge,
    ...(auto
      ? {}
      : {
          sourceHandle: resolveEdgeSourceHandle(edge) ?? 'bottom',
          targetHandle: resolveEdgeTargetHandle(edge) ?? 'top',
        }),
    routing: preserveEdgeRouting(edge),
  }
}

/** handleAuto === true → geometry 자동 선택 (2nd priority) */
export function isHandleAutoEnabled(edge: Edge): boolean {
  if (isManualRouteEdge(edge)) return false
  if (edge.routing?.mode === 'manual') return false
  if (edge.routing?.handleAuto === true) return true
  if (edge.routing?.handlesLocked === true) return false
  if (edge.routing?.mode === 'auto' && edge.routing?.handleAuto !== false) return true
  const sh = resolveEdgeSourceHandle(edge)
  const th = resolveEdgeTargetHandle(edge)
  if (sh && th) return false
  return true
}

/**
 * sourceHandle/targetHandle이 설정되고 handleAuto !== true일 때 saved handle 우선 (1st priority).
 * manual routing도 동일하게 router handle 변경 금지.
 */
export function hasUserSpecifiedHandles(edge: Edge): boolean {
  if (isManualRouteEdge(edge)) return true
  return !isHandleAutoEnabled(edge)
}

/** router가 사용할 locked handle pair — 둘 다 있어야 early route 적용 */
export function resolveLockedEdgeHandles(
  edge: Edge,
): { sourceHandle: EdgeHandleId; targetHandle: EdgeHandleId } | null {
  if (!hasUserSpecifiedHandles(edge)) return null
  const sourceHandle = resolveEdgeSourceHandle(edge)
  const targetHandle = resolveEdgeTargetHandle(edge)
  if (!sourceHandle || !targetHandle) return null
  return { sourceHandle, targetHandle }
}

export function lockEdgeHandles(edge: Edge): Edge {
  return {
    ...edge,
    routing: {
      ...preserveEdgeRouting(edge),
      handlesLocked: true,
      handleAuto: false,
    },
  }
}

export function unlockEdgeHandles(edge: Edge): Edge {
  const next: Edge = {
    ...edge,
    manualRoute: false,
    bendPoints: undefined,
    points: undefined,
    routing: { mode: 'auto', handleAuto: true },
  }
  delete next.sourceHandle
  delete next.targetHandle
  return next
}

/** 패널에서 handle 변경 시 — 명시 handle + lock */
export function patchEdgeHandles(
  edge: Edge,
  patch: { sourceHandle?: EdgeHandleId; targetHandle?: EdgeHandleId },
): Edge {
  return lockEdgeHandles(
    withEdgeHandleDefaults({
      ...edge,
      ...patch,
    }),
  )
}

/** 캔버스 bend 편집 또는 패널에서 수동 경로 전환 */
export function setEdgeManualRouting(edge: Edge, bendPoints: EdgeRoutingPoint[]): Edge {
  const sourceHandle = resolveEdgeSourceHandle(edge) ?? 'bottom'
  const targetHandle = resolveEdgeTargetHandle(edge) ?? 'top'
  const points = bendPoints.map((point) => ({ ...point }))
  return lockEdgeHandles({
    ...edge,
    manualRoute: true,
    bendPoints: points,
    points,
    routing: updateManualRoutingPoints(edge.routing, points, sourceHandle, targetHandle),
  })
}

/** manual bend 제거 — auto router + handle 자동 */
export function resetEdgeAutoRouting(edge: Edge): Edge {
  return unlockEdgeHandles({
    ...edge,
    manualRoute: false,
    bendPoints: undefined,
    points: undefined,
    routing: { mode: 'auto', handleAuto: true },
  })
}

export function createDefaultOutgoingEdge(sourceNodeId: string): Edge {
  return {
    id: generateId('edge'),
    source: sourceNodeId,
    target: '',
    sourceHandle: 'bottom',
    targetHandle: 'top',
    type: DEFAULT_EDGE_TYPE,
    label: '',
    condition: '',
    routing: { mode: 'auto', handleAuto: true },
  }
}

export function createDefaultIncomingEdge(targetNodeId: string): Edge {
  return {
    id: generateId('edge'),
    source: '',
    target: targetNodeId,
    sourceHandle: 'bottom',
    targetHandle: 'top',
    type: DEFAULT_EDGE_TYPE,
    label: '',
    condition: '',
    routing: { mode: 'auto', handleAuto: true },
  }
}

export function getIncomingEdges(process: Process, nodeId: string): Edge[] {
  return process.edges.filter((e) => e.target === nodeId)
}

export function getOutgoingEdges(process: Process, nodeId: string): Edge[] {
  return process.edges.filter((e) => e.source === nodeId)
}

export function getDecisionEdgeWarnings(node: Node, process: Process): string[] {
  if (node.type !== 'decision') return []
  const outgoing = getOutgoingEdges(process, node.id)
  const warnings: string[] = []

  if (outgoing.length < 2) {
    warnings.push('Decision 노드는 outgoing edge 2개 이상을 권장합니다.')
  }

  const missing = outgoing.filter((e) => !e.condition.trim() && !e.label.trim())
  if (missing.length > 0) {
    warnings.push('condition 또는 label이 없는 분기가 있습니다.')
  }

  const keys = outgoing
    .map((e) => `${e.condition}::${e.label}`.trim().toLowerCase())
    .filter((k) => k !== '::')
  const seen = new Set<string>()
  for (const key of keys) {
    if (seen.has(key)) {
      warnings.push('중복 condition/label이 있습니다.')
      break
    }
    seen.add(key)
  }

  return warnings
}
