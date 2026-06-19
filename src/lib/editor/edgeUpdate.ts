import type { Edge } from '../../types/process'
import { normalizeEdgeType, resolveEdgeType } from '../../types/edgeTypes'
import { resolveEdgeSourceHandle, resolveEdgeTargetHandle, migrateEdgeHandles } from './edgeHandles'
import { isDerivedDisplayEdge, isSavedVirtualEdge } from '../nodeVisibility'

/** 연결선 수정 시 currentData.edges에 반영할 필드를 일관되게 병합한다. */
export function applyEdgeUpdate(existing: Edge, update: Partial<Edge>): Edge {
  return migrateEdgeHandles(
    normalizeEdgeType({
      ...existing,
      ...update,
      id: existing.id,
      ...(update.routing
        ? { routing: { ...existing.routing, ...update.routing } }
        : {}),
    }),
  )
}

const RUNTIME_EDGE_DATA_KEYS = new Set([
  'edgeType',
  'routingKind',
  'routingMode',
  'validationStatus',
  'routeIssue',
  'routeIssueLabel',
  'suggestedFix',
  'collidedNodeIds',
  'collidedNodeNames',
  'bendCount',
  'routingStatus',
  'broken',
  'brokenReason',
  'missingNodeId',
  'derived',
  'readOnly',
  'virtual',
  'bridgeEdgeIds',
])

function normalizeSavedVirtualEdge(edge: Edge): Edge {
  if (!isSavedVirtualEdge(edge)) return edge

  const sourceHandle = resolveEdgeSourceHandle(edge)
  const targetHandle = resolveEdgeTargetHandle(edge)
  const routing = edge.routing

  return {
    ...edge,
    displayOnly: true,
    isDerived: undefined,
    manualRoute: edge.manualRoute ?? false,
    type: 'virtual',
    ...(sourceHandle ? { sourceHandle } : {}),
    ...(targetHandle ? { targetHandle } : {}),
    routing: {
      mode: routing?.mode ?? 'auto',
      handleAuto: routing?.handleAuto === true,
      ...(routing?.handleAuto !== true ? { handlesLocked: true } : {}),
      ...(routing?.points?.length ? { points: routing.points.map((p) => ({ ...p })) } : {}),
    },
    data: edge.data
      ? (() => {
          const cleaned = Object.fromEntries(
            Object.entries(edge.data).filter(([key]) => !RUNTIME_EDGE_DATA_KEYS.has(key)),
          )
          return Object.keys(cleaned).length > 0 ? cleaned : undefined
        })()
      : undefined,
  }
}

/** layout/router 런타임 값은 JSON에 저장하지 않음 */
function stripRuntimeEdgeData(edge: Edge): Edge {
  if (!edge.data) return edge
  const cleaned = Object.fromEntries(
    Object.entries(edge.data).filter(([key]) => !RUNTIME_EDGE_DATA_KEYS.has(key)),
  )
  return Object.keys(cleaned).length > 0 ? { ...edge, data: cleaned } : { ...edge, data: undefined }
}

export function normalizeEdgeForStorage(edge: Edge): Edge {
  if (isDerivedDisplayEdge(edge)) {
    return edge
  }

  let normalized = migrateEdgeHandles(normalizeEdgeType(edge))
  normalized = stripRuntimeEdgeData(normalized)

  if (resolveEdgeType(normalized) === 'virtual') {
    normalized = normalizeSavedVirtualEdge(normalized)
  }

  return normalized
}
