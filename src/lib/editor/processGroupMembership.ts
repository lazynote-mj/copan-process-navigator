import type { Edge } from '../../types/process'
import type { OverviewProcessGroup } from '../../types/toBeNavigator'

export function isNodeInProcessGroup(group: OverviewProcessGroup, nodeId: string): boolean {
  return group.overviewNodeIds.includes(nodeId)
}

export function findProcessGroupForNode(
  groups: OverviewProcessGroup[],
  nodeId: string,
): OverviewProcessGroup | undefined {
  return groups.find((group) => isNodeInProcessGroup(group, nodeId))
}

function edgeMatchesGroupId(edgeId: string, groupEdgeId: string): boolean {
  return edgeId === groupEdgeId || edgeId.startsWith(`${groupEdgeId}::`)
}

export function isEdgeIdInGroup(edgeId: string, groupEdgeIds: Set<string> | string[]): boolean {
  const ids = groupEdgeIds instanceof Set ? groupEdgeIds : new Set(groupEdgeIds)
  if (ids.has(edgeId)) return true
  for (const id of ids) {
    if (edgeId.startsWith(`${id}::`)) return true
  }
  return false
}

/** 그룹 멤버 노드 사이 연결만 하이라이트 대상 */
export function isEdgeInGroupScope(
  edge: { source: string; target: string },
  groupNodeIds: Set<string>,
): boolean {
  return groupNodeIds.has(edge.source) && groupNodeIds.has(edge.target)
}

export function isEdgeGroupHighlighted(
  edge: { id: string; source: string; target: string },
  highlight: {
    nodeIds: Set<string>
    edgeIds: Set<string>
    focusEdgeIds?: Set<string>
  },
): boolean {
  if (!isEdgeInGroupScope(edge, highlight.nodeIds)) return false

  if (highlight.focusEdgeIds?.size) {
    return isEdgeIdInGroup(edge.id, highlight.focusEdgeIds)
  }
  return isEdgeIdInGroup(edge.id, highlight.edgeIds)
}

function resolveStoredEdgeId(edgeId: string): string {
  return edgeId.split('::')[0] ?? edgeId
}

function findOverviewEdgeById(edgeId: string, overviewEdges: Edge[]): Edge | undefined {
  const resolved = resolveStoredEdgeId(edgeId)
  return overviewEdges.find(
    (entry) => resolveStoredEdgeId(entry.id) === resolved || entry.id === edgeId,
  )
}

function dedupeEdgeIds(edgeIds: string[]): string[] {
  const seen = new Set<string>()
  return edgeIds.filter((edgeId) => {
    const baseId = resolveStoredEdgeId(edgeId)
    if (seen.has(baseId)) return false
    seen.add(baseId)
    return true
  })
}

/** overviewEdgeIds에서 멤버십을 벗어난 연결선만 제거 (명시 목록 유지) */
export function pruneProcessGroupEdgesFromNodes(
  group: OverviewProcessGroup,
  overviewEdges: Edge[],
): OverviewProcessGroup {
  const nodeSet = new Set(group.overviewNodeIds)
  const edgeIds = group.overviewEdgeIds.filter((edgeId) => {
    const edge = findOverviewEdgeById(edgeId, overviewEdges)
    if (!edge) return true
    return nodeSet.has(edge.source) && nodeSet.has(edge.target)
  })
  return { ...group, overviewEdgeIds: dedupeEdgeIds(edgeIds) }
}

/** 새로 포함된 노드와 직접 연결되고 양 끝점이 모두 그룹인 edge만 추가 */
function appendProcessGroupEdgesForNode(
  group: OverviewProcessGroup,
  nodeId: string,
  overviewEdges: Edge[],
): OverviewProcessGroup {
  const nodeSet = new Set(group.overviewNodeIds)
  const edgeIds = new Set(group.overviewEdgeIds.map(resolveStoredEdgeId))

  for (const edge of overviewEdges) {
    if (edge.source !== nodeId && edge.target !== nodeId) continue
    if (!nodeSet.has(edge.source) || !nodeSet.has(edge.target)) continue
    edgeIds.add(resolveStoredEdgeId(edge.id))
  }

  return { ...group, overviewEdgeIds: [...edgeIds] }
}

export function setProcessGroupNodeMembership(
  group: OverviewProcessGroup,
  nodeId: string,
  include: boolean,
  overviewEdges: Edge[],
): OverviewProcessGroup {
  const nodeIds = new Set(group.overviewNodeIds)
  if (include) {
    if (nodeIds.has(nodeId)) return group
    nodeIds.add(nodeId)
    return appendProcessGroupEdgesForNode(
      { ...group, overviewNodeIds: [...nodeIds] },
      nodeId,
      overviewEdges,
    )
  }

  nodeIds.delete(nodeId)
  return pruneProcessGroupEdgesFromNodes(
    { ...group, overviewNodeIds: [...nodeIds] },
    overviewEdges,
  )
}

/** 그룹 내 선택 노드와 직접 연결된 edge id */
export function resolveFocusEdgeIdsForNode(
  group: OverviewProcessGroup,
  nodeId: string,
  overviewEdges: Edge[],
): Set<string> {
  const focus = new Set<string>()
  const groupNodeIds = new Set(group.overviewNodeIds)
  for (const edge of overviewEdges) {
    const inGroup = group.overviewEdgeIds.some((gid) => edgeMatchesGroupId(edge.id, gid))
    if (!inGroup) continue
    if (!groupNodeIds.has(edge.source) || !groupNodeIds.has(edge.target)) continue
    if (edge.source === nodeId || edge.target === nodeId) {
      focus.add(edge.id)
    }
  }
  return focus
}

export function resolveRelatedNodeIdsForFocus(
  focusNodeId: string,
  focusEdgeIds: Set<string>,
  overviewEdges: Edge[],
  groupNodeIds?: Set<string>,
): Set<string> {
  const nodes = new Set<string>([focusNodeId])
  for (const edge of overviewEdges) {
    if (!focusEdgeIds.has(edge.id)) continue
    if (groupNodeIds) {
      if (groupNodeIds.has(edge.source)) nodes.add(edge.source)
      if (groupNodeIds.has(edge.target)) nodes.add(edge.target)
    } else {
      nodes.add(edge.source)
      nodes.add(edge.target)
    }
  }
  return nodes
}
