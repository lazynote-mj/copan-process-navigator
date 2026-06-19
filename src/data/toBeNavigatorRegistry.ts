import type { Edge, Node, Phase, Process, ProcessStatus, ProcessZone } from '../types/process'
import type { ProcessGroup, ToBeNavigatorBundle } from '../types/toBeNavigator'
import { normalizeProcessNodes, normalizeProcessEdges } from './processExport'
import { getOverviewLanes } from './laneRegistry'
import { processRegistry } from './processRegistry'
import {
  buildOverviewEdgesFromSequence,
  buildOverviewProcessGroups,
  validateOverviewEdgeEndpoints,
} from './toBeOverview/overviewEdgeRegistry'

import overviewJson from './toBeOverview/overview.json'

const processGroups = buildOverviewProcessGroups()

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
  processGroups,
  detailProcesses: processRegistry,
}

export function getDetailProcessById(id: string): Process | undefined {
  return toBeNavigator.detailProcesses.find((p) => p.id === id)
}

export function getProcessGroupById(id: string): ProcessGroup | undefined {
  return toBeNavigator.processGroups.find((g) => g.id === id)
}

export function prefixEdgeId(processId: string, edgeId: string): string {
  return `${processId}:${edgeId}`
}
