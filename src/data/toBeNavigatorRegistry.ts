import type { Edge, Node, Phase, Process, ProcessStatus, ProcessZone } from '../types/process'
import type {
  DetailProcessGroup,
  OverviewProcessGroup,
  ProcessGroup,
  ToBeNavigatorBundle,
} from '../types/toBeNavigator'
import { normalizeProcessNodes, normalizeProcessEdges } from './processExport'
import { getOverviewLanes } from './laneRegistry'
import { processRegistry } from './processRegistry'
import {
  buildDetailProcessGroups,
  buildOverviewEdgesFromSequence,
  buildOverviewProcessGroups,
  validateOverviewEdgeEndpoints,
} from './toBeOverview/overviewEdgeRegistry'

import overviewJson from './toBeOverview/overview.json'

const overviewProcessGroups = buildOverviewProcessGroups()
const detailProcessGroups = buildDetailProcessGroups()

type OverviewFile = {
  meta: {
    id: string
    name: string
    description: string
    version: string
    status: ProcessStatus
    lastModified: string
    owner: string
    phases: Phase[]
  }
  nodes: Node[]
  edges: Edge[]
  zones?: ProcessZone[]
}

function loadOverviewProcess(data: OverviewFile): Process {
  const lanes = getOverviewLanes()
  const draft: Process = {
    ...data.meta,
    lanes,
    nodes: [],
    edges: [],
  }

  const nodes = normalizeProcessNodes(data.nodes, { ...draft, nodes: data.nodes })
  const nodeIds = new Set(nodes.map((n) => n.id))
  const edges = buildOverviewEdgesFromSequence()
  validateOverviewEdgeEndpoints(nodeIds, edges)

  return {
    ...draft,
    nodes,
    edges: normalizeProcessEdges(edges),
    zones: data.zones ?? [],
  }
}

export const toBeNavigator: ToBeNavigatorBundle = {
  overview: loadOverviewProcess(overviewJson as OverviewFile),
  overviewProcessGroups,
  detailProcessGroups,
  detailProcesses: processRegistry,
}

export function getDetailProcessById(id: string): Process | undefined {
  return toBeNavigator.detailProcesses.find((p) => p.id === id)
}

export function getOverviewProcessGroupById(id: string): OverviewProcessGroup | undefined {
  return toBeNavigator.overviewProcessGroups.find((g) => g.id === id)
}

export function getDetailProcessGroupById(id: string): DetailProcessGroup | undefined {
  return toBeNavigator.detailProcessGroups.find((g) => g.id === id)
}

/** @deprecated getOverviewProcessGroupById / getDetailProcessGroupById */
export function getProcessGroupById(id: string): ProcessGroup | undefined {
  const overview = getOverviewProcessGroupById(id)
  if (overview) {
    const linked = overview.linkedDetailGroupId
      ? getDetailProcessGroupById(overview.linkedDetailGroupId)
      : undefined
    return {
      ...overview,
      ...(linked ? { detailProcessId: linked.detailProcessId } : {}),
    }
  }
  const detail = getDetailProcessGroupById(id)
  if (!detail) return undefined
  return {
    id: detail.id,
    name: detail.name,
    description: detail.description,
    overviewNodeIds: [],
    overviewEdgeIds: [],
    detailProcessId: detail.detailProcessId,
  }
}

export function prefixEdgeId(processId: string, edgeId: string): string {
  return `${processId}:${edgeId}`
}
