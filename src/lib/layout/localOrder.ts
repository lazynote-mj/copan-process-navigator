import type { Edge, Node, Process } from '../../types/process'

/** lane 내 localOrder 자동 계산 결과 */
export function computeLocalOrders(process: Process): Map<string, number> {
  const result = new Map<string, number>()

  for (const lane of [...process.lanes].sort((a, b) => a.order - b.order)) {
    const laneNodes = process.nodes.filter((n) => n.laneId === lane.id)
    if (laneNodes.length === 0) continue

    const nodeIds = new Set(laneNodes.map((n) => n.id))
    const intraEdges = process.edges.filter(
      (e) => nodeIds.has(e.source) && nodeIds.has(e.target),
    )

    const sorted = topoSortLaneNodes(laneNodes, intraEdges)
    sorted.forEach((nodeId, index) => {
      result.set(nodeId, index + 1)
    })
  }

  return result
}

function topoSortLaneNodes(nodes: Node[], intraEdges: Edge[]): string[] {
  const nodeIds = nodes.map((n) => n.id)
  const inDegree = new Map<string, number>(nodeIds.map((id) => [id, 0]))
  const adjacency = new Map<string, string[]>(nodeIds.map((id) => [id, []]))

  for (const edge of intraEdges) {
    adjacency.get(edge.source)?.push(edge.target)
    inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1)
  }

  /** lane 내부 정렬 — global phaseOrder 사용 금지 (cross-lane 세로 정렬 방지) */
  const sortStable = (ids: string[]) => [...ids].sort((a, b) => a.localeCompare(b))

  const queue = sortStable(nodeIds.filter((id) => (inDegree.get(id) ?? 0) === 0))
  const ordered: string[] = []

  while (queue.length > 0) {
    const current = queue.shift()!
    ordered.push(current)

    for (const next of adjacency.get(current) ?? []) {
      const nextDegree = (inDegree.get(next) ?? 1) - 1
      inDegree.set(next, nextDegree)
      if (nextDegree === 0) {
        queue.push(next)
        queue.sort((a, b) => a.localeCompare(b))
      }
    }
  }

  if (ordered.length < nodeIds.length) {
    const remaining = sortStable(nodeIds.filter((id) => !ordered.includes(id)))
    ordered.push(...remaining)
  }

  return ordered
}

export function resolveNodeLocalOrder(node: Node, process: Process): number {
  if (typeof node.localOrder === 'number' && node.localOrder > 0) {
    return node.localOrder
  }
  const computed = computeLocalOrders(process).get(node.id)
  if (computed !== undefined) return computed

  const lanePeers = process.nodes
    .filter((n) => n.laneId === node.laneId)
    .sort((a, b) => a.id.localeCompare(b.id))
  const index = lanePeers.findIndex((n) => n.id === node.id)
  return index >= 0 ? index + 1 : 1
}

export function normalizeNodeLocalOrder(node: Node, process: Process): Node {
  return {
    ...node,
    localOrder: resolveNodeLocalOrder(node, process),
  }
}

export function normalizeAllLocalOrders(nodes: Node[], process: Process): Node[] {
  const computed = computeLocalOrders({ ...process, nodes })
  return nodes.map((node) => ({
    ...node,
    localOrder:
      typeof node.localOrder === 'number' && node.localOrder > 0
        ? node.localOrder
        : (computed.get(node.id) ??
            (() => {
              const lanePeers = nodes
                .filter((n) => n.laneId === node.laneId)
                .sort((a, b) => a.id.localeCompare(b.id))
              const index = lanePeers.findIndex((n) => n.id === node.id)
              return index >= 0 ? index + 1 : 1
            })()),
  }))
}
