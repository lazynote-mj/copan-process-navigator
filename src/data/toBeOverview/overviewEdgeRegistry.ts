import type { Edge } from '../../types/process'
import type { DetailProcessGroup, OverviewProcessGroup } from '../../types/toBeNavigator'
import detailProcessGroupsJson from './detail-process-groups.json'
import e2eMainFlowJson from './e2e-main-flow.json'
import overviewProcessGroupsJson from './overview-process-groups.json'
import subProcessFlowsJson from './sub-process-flows.json'

type FlowLink = {
  id: string
  source: string
  target: string
  condition?: string
  label?: string
  type?: Edge['type']
}

type E2eMainFlowFile = {
  id: string
  name: string
  description: string
  links: FlowLink[]
  nodeIds: string[]
}

type SubProcessGroupFile = {
  id: string
  name: string
  description: string
  detailProcessId: string
  nodeIds: string[]
  links: FlowLink[]
}

type SubProcessFlowsFile = {
  groups: SubProcessGroupFile[]
}

function toEdge(link: FlowLink): Edge {
  return {
    id: link.id,
    source: link.source,
    target: link.target,
    condition: link.condition ?? '',
    label: link.label ?? '',
    type: link.type ?? 'normal',
  }
}

const e2eMainFlow = e2eMainFlowJson as E2eMainFlowFile
const subProcessFlows = subProcessFlowsJson as SubProcessFlowsFile

export const e2eMainFlowEdgeIds = e2eMainFlow.links.map((link) => link.id)
export const e2eMainFlowNodeIds = e2eMainFlow.nodeIds

/** Layout/거리 기반이 아닌 sequence 정의에서 Overview edges 생성 */
export function buildOverviewEdgesFromSequence(): Edge[] {
  const subLinks = subProcessFlows.groups.flatMap((group) => group.links)
  return [...e2eMainFlow.links, ...subLinks].map(toEdge)
}

export function filterEdgesWithValidEndpoints(
  nodeIds: Set<string>,
  edges: Edge[],
): { edges: Edge[]; removed: Edge[] } {
  const valid: Edge[] = []
  const removed: Edge[] = []
  for (const edge of edges) {
    if (nodeIds.has(edge.source) && nodeIds.has(edge.target)) {
      valid.push(edge)
    } else {
      removed.push(edge)
    }
  }
  return { edges: valid, removed }
}

export function buildOverviewProcessGroups(): OverviewProcessGroup[] {
  return structuredClone(overviewProcessGroupsJson as OverviewProcessGroup[])
}

export function buildDetailProcessGroups(): DetailProcessGroup[] {
  return structuredClone(detailProcessGroupsJson as DetailProcessGroup[])
}

export function validateOverviewEdgeEndpoints(nodeIds: Set<string>, edges: Edge[]): void {
  for (const edge of edges) {
    if (!nodeIds.has(edge.source)) {
      console.warn(
        `[ProcessNavigator] Edge ${edge.id} references missing source node: ${edge.source}`,
      )
    }
    if (!nodeIds.has(edge.target)) {
      console.warn(
        `[ProcessNavigator] Edge ${edge.id} references missing target node: ${edge.target}`,
      )
    }
  }
}
