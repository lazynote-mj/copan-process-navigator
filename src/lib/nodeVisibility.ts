import type { Edge, Node, Process } from '../types/process'
import { resolveEdgeSourceHandle, resolveEdgeTargetHandle } from './editor/edgeHandles'
import { resolveEdgeType } from '../types/edgeTypes'
import { normalizeNodeType } from '../types/nodeTypes'
import { generateId } from './editor/processEditor'

/** 업무 보기 vs 시스템 보기 */
export type MapDisplayMode = 'business' | 'system'

/** @deprecated derived- prefix 사용 — legacy runtime id */
export const VIRTUAL_EDGE_ID_PREFIX = 'virtual:'

/** 숨겨진 api/interface 경유 bridge — 렌더 시 생성, read-only */
export const DERIVED_EDGE_ID_PREFIX = 'derived:'

const SYSTEM_ONLY_TYPES = new Set(['interface', 'interface-rule', 'api'])

export function isNodeVisibleInDisplayMode(node: Node, mode: MapDisplayMode): boolean {
  if (mode === 'system') return true
  if (node.displayLevel === 'system') return false
  const normalized = normalizeNodeType(node.type, node.system)
  if (SYSTEM_ONLY_TYPES.has(normalized)) return false
  if (node.type === 'interface' || node.type === 'interface-rule' || node.type === 'api') return false
  const sys = (node.system ?? '').toLowerCase()
  if (normalized === 'interface' && (sys === 'api' || sys.includes('api'))) return false
  return true
}

export function filterNodesForDisplayMode(nodes: Node[], mode: MapDisplayMode): Node[] {
  return nodes.filter((node) => isNodeVisibleInDisplayMode(node, mode))
}

export function filterEdgesForDisplayMode(edges: Edge[], visibleNodeIds: Set<string>): Edge[] {
  return edges.filter((edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target))
}

type BridgeQueueItem = {
  nodeId: string
  viaHidden: boolean
  /** startId에서 hidden으로 진입한 첫 edge */
  bridgeFirstEdge?: Edge
}

/** 숨겨진 api/interface 노드를 경유하는 visible 노드 쌍에 derived edge 생성 (read-only) */
export function buildDerivedBridgeEdges(
  allEdges: Edge[],
  visibleNodeIds: Set<string>,
  hiddenNodeIds: Set<string>,
): Edge[] {
  const directKeys = new Set(
    allEdges
      .filter((e) => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target))
      .map((e) => `${e.source}::${e.target}`),
  )

  const pairKeys = new Set<string>()
  const derived: Edge[] = []

  for (const startId of visibleNodeIds) {
    const queue: BridgeQueueItem[] = [{ nodeId: startId, viaHidden: false }]
    const visited = new Set<string>([startId])

    while (queue.length > 0) {
      const { nodeId, viaHidden, bridgeFirstEdge } = queue.shift()!
      for (const edge of allEdges) {
        if (edge.source !== nodeId) continue
        const next = edge.target

        if (visibleNodeIds.has(next)) {
          if (next !== startId && viaHidden && bridgeFirstEdge) {
            const key = `${startId}::${next}`
            if (!directKeys.has(key) && !pairKeys.has(key)) {
              pairKeys.add(key)
              const sourceHandle = resolveEdgeSourceHandle(bridgeFirstEdge)
              const targetHandle = resolveEdgeTargetHandle(edge)
              derived.push({
                id: `${DERIVED_EDGE_ID_PREFIX}${startId}->${next}`,
                source: startId,
                target: next,
                condition: '',
                label: '',
                type: 'virtual',
                isDerived: true,
                routing: { mode: 'auto', handleAuto: true },
                ...(sourceHandle ? { sourceHandle } : {}),
                ...(targetHandle ? { targetHandle } : {}),
                data: {
                  derived: true,
                  bridgeEdgeIds: [bridgeFirstEdge.id, edge.id],
                },
              })
            }
          }
          continue
        }

        if (hiddenNodeIds.has(next) && !visited.has(next)) {
          visited.add(next)
          queue.push({
            nodeId: next,
            viaHidden: true,
            bridgeFirstEdge: bridgeFirstEdge ?? edge,
          })
        }
      }
    }
  }

  return derived.sort(
    (a, b) =>
      (a.priority ?? 0) - (b.priority ?? 0) || a.id.localeCompare(b.id),
  )
}

/** @deprecated buildDerivedBridgeEdges 사용 */
export const buildVirtualBridgeEdges = buildDerivedBridgeEdges

/** 업무 보기 runtime bridge — 저장·편집 불가 */
export function isDerivedDisplayEdge(edge: Edge): boolean {
  return (
    edge.id.startsWith(DERIVED_EDGE_ID_PREFIX) ||
    edge.id.startsWith(VIRTUAL_EDGE_ID_PREFIX) ||
    edge.isDerived === true ||
    edge.data?.derived === true
  )
}

/** JSON에 저장된 사용자 virtual edge (편집 가능) */
export function isSavedVirtualEdge(edge: Edge): boolean {
  return resolveEdgeType(edge) === 'virtual' && !isDerivedDisplayEdge(edge)
}

/** dashed 표시 전용 스타일 대상 — saved virtual + derived bridge */
export function isVirtualDisplayEdge(edge: Edge): boolean {
  return isSavedVirtualEdge(edge) || isDerivedDisplayEdge(edge) || edge.data?.virtual === true
}

export function isReferenceDisplayEdge(edge: Edge): boolean {
  return resolveEdgeType(edge) === 'reference'
}

/** read-only는 derived bridge만 */
export function isReadOnlyDisplayEdge(edge: Edge): boolean {
  return isDerivedDisplayEdge(edge)
}

/** derived bridge → activeProcess에 저장할 virtual edge */
export function createSavedVirtualEdgeFromDerived(derivedEdge: Edge): Edge {
  const sourceHandle = resolveEdgeSourceHandle(derivedEdge) ?? 'bottom'
  const targetHandle = resolveEdgeTargetHandle(derivedEdge) ?? 'top'
  return {
    id: generateId('edge'),
    source: derivedEdge.source,
    target: derivedEdge.target,
    sourceHandle,
    targetHandle,
    type: 'virtual',
    label: derivedEdge.label,
    condition: derivedEdge.condition,
    displayOnly: true,
    manualRoute: false,
    routing: {
      mode: 'auto',
      handlesLocked: true,
      handleAuto: false,
    },
  }
}

/** 업무/시스템 보기용 display process (derived bridge + data edges, 원본 mutate 없음) */
export function buildDisplayProcess(process: Process, mode: MapDisplayMode): Process {
  if (mode === 'system') return process

  const visibleNodes = filterNodesForDisplayMode(process.nodes, 'business')
  const visibleIds = new Set(visibleNodes.map((n) => n.id))
  const hiddenIds = new Set(process.nodes.filter((n) => !visibleIds.has(n.id)).map((n) => n.id))
  const visibleEdges = filterEdgesForDisplayMode(process.edges, visibleIds)
  const derivedEdges = buildDerivedBridgeEdges(process.edges, visibleIds, hiddenIds)

  return {
    ...process,
    nodes: visibleNodes,
    edges: [...visibleEdges, ...derivedEdges],
  }
}
