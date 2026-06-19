import type { Edge } from '../../types/process'
import type { ProcessGroup } from '../../types/toBeNavigator'
import e2eMainFlowJson from './e2e-main-flow.json'
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

export function buildOverviewProcessGroups(): ProcessGroup[] {
  const mainGroup: ProcessGroup = {
    id: e2eMainFlow.id,
    name: e2eMainFlow.name,
    description: e2eMainFlow.description,
    overviewNodeIds: e2eMainFlow.nodeIds,
    overviewEdgeIds: e2eMainFlowEdgeIds,
    detailProcessId: 'business-to-project',
  }

  const subGroups: ProcessGroup[] = subProcessFlows.groups.map((group) => ({
    id: group.id,
    name: group.name,
    description: group.description,
    overviewNodeIds: group.nodeIds,
    overviewEdgeIds: group.links.map((link) => link.id),
    detailProcessId: group.detailProcessId,
  }))

  return [mainGroup, ...subGroups]
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
