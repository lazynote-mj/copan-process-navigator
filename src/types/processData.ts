import {
  createDefaultCommonMasters,
  type CommonMasters,
} from './commonMasters'
import type { Edge, Process, ProcessZone } from './process'
import type { Node } from './process'
import type { ProcessInstance } from './processInstance'
import { OVERVIEW_SCOPE } from './processInstance'

export type ProcessScope = typeof OVERVIEW_SCOPE | string

export type ProcessDataSource =
  | 'local'
  | 'remote'
  | 'imported'
  | 'project-json'
  | 'server-json'
  | 'imported-json'

export type ProcessData = {
  commonMasters: CommonMasters
  processes: ProcessInstance[]
  updatedAt: string
  dataSource: ProcessDataSource
  dirty: boolean
  baselineNodeCount: number
  baselineEdgeCount: number
}

export function cloneProcess(process: Process): Process {
  return structuredClone(process)
}

export function cloneProcessInstance(instance: ProcessInstance): ProcessInstance {
  return structuredClone(instance)
}

export function cloneProcessData(data: ProcessData): ProcessData {
  return structuredClone(data)
}

/** commonMasters + instance → 렌더/레이아웃용 Process */
export function resolveProcessWithMasters(
  instance: ProcessInstance,
  masters: CommonMasters,
): Process {
  return {
    id: instance.id,
    name: instance.name,
    description: instance.description ?? '',
    version: instance.version ?? '',
    status: instance.status ?? 'draft',
    lastModified: instance.lastModified ?? '',
    owner: instance.owner ?? '',
    lanes: masters.lanes,
    phases: masters.phases,
    nodes: instance.nodes,
    edges: instance.edges,
    zones: instance.zones,
    overviewNodeId: instance.overviewNodeId,
    source: instance.source,
  }
}

export function getOverviewInstance(data: ProcessData): ProcessInstance | undefined {
  return data.processes.find((p) => p.type === 'overview')
}

export function getProcessInstance(
  data: ProcessData,
  scope: ProcessScope,
): ProcessInstance | undefined {
  if (scope === OVERVIEW_SCOPE) return getOverviewInstance(data)
  return data.processes.find((p) => p.id === scope)
}

export function getProcessByScope(
  data: ProcessData,
  scope: ProcessScope,
): Process | undefined {
  const instance = getProcessInstance(data, scope)
  if (!instance) return undefined
  return resolveProcessWithMasters(instance, data.commonMasters)
}

export function getOverviewProcess(data: ProcessData): Process | undefined {
  return getProcessByScope(data, OVERVIEW_SCOPE)
}

export function findProcessIndex(data: ProcessData, scope: ProcessScope): number {
  if (scope === OVERVIEW_SCOPE) {
    return data.processes.findIndex((p) => p.type === 'overview')
  }
  return data.processes.findIndex((p) => p.id === scope)
}

export function collectAllNodes(data: ProcessData): Node[] {
  return data.processes.flatMap((p) => p.nodes)
}

export function collectAllEdges(data: ProcessData): Edge[] {
  return data.processes.flatMap((p) => p.edges)
}

export function collectAllZones(data: ProcessData): ProcessZone[] {
  return data.processes.flatMap((p) => p.zones ?? [])
}

export function summarizeProcessData(data: ProcessData): {
  nodeCount: number
  edgeCount: number
  zoneCount: number
  processCount: number
} {
  return {
    nodeCount: collectAllNodes(data).length,
    edgeCount: collectAllEdges(data).length,
    zoneCount: collectAllZones(data).length,
    processCount: data.processes.length,
  }
}

/** Process → ProcessInstance (lanes/phases 제외) */
export function processToInstance(
  process: Process,
  type?: 'overview' | 'detail',
): ProcessInstance {
  const kind =
    type ??
    (process.id.includes('overview') || process.name.toLowerCase().includes('overview')
      ? 'overview'
      : 'detail')
  return {
    id: process.id,
    type: kind,
    name: process.name,
    description: process.description,
    version: process.version,
    status: process.status,
    lastModified: process.lastModified,
    owner: process.owner,
    nodes: structuredClone(process.nodes),
    edges: structuredClone(process.edges),
    zones: process.zones ? structuredClone(process.zones) : undefined,
    overviewNodeId: process.overviewNodeId,
    source: process.source,
  }
}

export function extractCommonMastersFromOverview(overview: Process): CommonMasters {
  return createDefaultCommonMasters(
    structuredClone(overview.lanes ?? []),
    structuredClone(overview.phases ?? []),
  )
}

export { OVERVIEW_SCOPE }
