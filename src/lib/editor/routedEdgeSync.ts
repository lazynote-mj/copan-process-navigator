import type { Edge as FlowEdge } from '@xyflow/react'
import type { Edge, EdgeHandleId } from '../../types/process'
import type { ProcessEdgeData } from '../layout/elkLayout'
import { isDerivedDisplayEdge } from '../nodeVisibility'
import { isHandleAutoEnabled, isManualRouteEdge, resolveEdgeSourceHandle, resolveEdgeTargetHandle } from './edgeHandles'

export type RoutedHandlePatch = {
  edgeId: string
  sourceHandle: EdgeHandleId
  targetHandle: EdgeHandleId
}

function parseFlowHandleId(handle: string | null | undefined): EdgeHandleId | undefined {
  if (!handle) return undefined
  const match = handle.match(/(?:source|target)-(?<side>top|right|bottom|left)/)
  return (match?.groups?.side as EdgeHandleId | undefined) ?? undefined
}

/** layout 결과(flow edge)에서 router가 선택한 handle pair */
export function extractRoutedHandlesFromFlowEdge(flowEdge: FlowEdge): {
  sourceHandle?: EdgeHandleId
  targetHandle?: EdgeHandleId
} {
  const data = flowEdge.data as ProcessEdgeData | undefined
  return {
    sourceHandle: data?.sourceHandle ?? parseFlowHandleId(flowEdge.sourceHandle),
    targetHandle: data?.targetHandle ?? parseFlowHandleId(flowEdge.targetHandle),
  }
}

/** layout 후 process edge에 router handle을 반영할지 */
export function shouldSyncRoutedHandles(edge: Edge): boolean {
  if (isDerivedDisplayEdge(edge)) return false
  if (isManualRouteEdge(edge)) return false
  return isHandleAutoEnabled(edge)
}

/**
 * handleAuto edge — layout 결과 handle을 process JSON에 반영.
 * 패널/저장값과 실제 path anchor 불일치 방지.
 */
export function collectRoutedHandleSyncPatches(
  processEdges: Edge[],
  flowEdges: FlowEdge[],
): RoutedHandlePatch[] {
  const flowById = new Map(flowEdges.map((edge) => [edge.id, edge]))
  const patches: RoutedHandlePatch[] = []

  for (const edge of processEdges) {
    if (!shouldSyncRoutedHandles(edge)) continue

    const flowEdge = flowById.get(edge.id)
    if (!flowEdge) continue

    const routed = extractRoutedHandlesFromFlowEdge(flowEdge)
    if (!routed.sourceHandle || !routed.targetHandle) continue

    const currentSource = resolveEdgeSourceHandle(edge)
    const currentTarget = resolveEdgeTargetHandle(edge)
    if (currentSource === routed.sourceHandle && currentTarget === routed.targetHandle) continue

    patches.push({
      edgeId: edge.id,
      sourceHandle: routed.sourceHandle,
      targetHandle: routed.targetHandle,
    })
  }

  return patches
}

export function applyRoutedHandlePatch(edge: Edge, patch: Pick<RoutedHandlePatch, 'sourceHandle' | 'targetHandle'>): Edge {
  return {
    ...edge,
    sourceHandle: patch.sourceHandle,
    targetHandle: patch.targetHandle,
    routing: {
      mode: edge.routing?.mode ?? 'auto',
      handleAuto: true,
      ...(edge.routing?.points?.length ? { points: edge.routing.points.map((p) => ({ ...p })) } : {}),
    },
  }
}
