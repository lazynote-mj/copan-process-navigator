import type { CommonMasters } from '../types/commonMasters'
import type { Process } from '../types/process'
import type { ProcessInstance } from '../types/processInstance'
import type {
  DetailProcessGroup,
  OverviewProcessGroup,
  ProcessGroup,
} from '../types/toBeNavigator'
import {
  extractCommonMastersFromOverview,
  processToInstance,
  type ProcessData,
} from '../types/processData'
import {
  buildDetailProcessGroups,
  buildOverviewProcessGroups,
} from './toBeOverview/overviewEdgeRegistry'

export type ProcessDataFilePayloadV1 = {
  kind: 'copan-process-navigator-state'
  version: 1
  exportedAt: string
  overview: Process
  details: Record<string, Process> | Process[]
}

export type ProcessDataFilePayloadV2 = {
  kind: 'copan-process-navigator-state'
  version: 2
  exportedAt: string
  commonMasters: CommonMasters
  processes: ProcessInstance[]
  overviewProcessGroups?: OverviewProcessGroup[]
  detailProcessGroups?: DetailProcessGroup[]
  /** @deprecated */
  processGroups?: ProcessGroup[]
}

export type ProcessDataFilePayload = ProcessDataFilePayloadV1 | ProcessDataFilePayloadV2

export function isV2Payload(
  payload: ProcessDataFilePayload,
): payload is ProcessDataFilePayloadV2 {
  return payload.version === 2
}

function normalizeV1Details(details: ProcessDataFilePayloadV1['details']): Process[] {
  if (Array.isArray(details)) return details
  return Object.values(details ?? {})
}

export function migrateV1ToV2(payload: ProcessDataFilePayloadV1): ProcessDataFilePayloadV2 {
  const commonMasters = extractCommonMastersFromOverview(payload.overview)
  const overviewInstance = processToInstance(payload.overview, 'overview')
  const detailInstances = normalizeV1Details(payload.details).map((p) =>
    processToInstance(p, 'detail'),
  )
  return {
    kind: 'copan-process-navigator-state',
    version: 2,
    exportedAt: payload.exportedAt,
    commonMasters,
    processes: [overviewInstance, ...detailInstances],
  }
}

export function ensureProcessGroupFields(data: ProcessData): ProcessData {
  const overviewProcessGroups = data.overviewProcessGroups?.length
    ? data.overviewProcessGroups
    : structuredClone(buildOverviewProcessGroups())
  const detailProcessGroups = data.detailProcessGroups?.length
    ? data.detailProcessGroups
    : structuredClone(buildDetailProcessGroups())
  return {
    ...data,
    overviewProcessGroups,
    detailProcessGroups,
  }
}

export function buildProcessDataFromPayload(
  payload: ProcessDataFilePayload,
  dataSource: ProcessData['dataSource'],
): ProcessData {
  const v2 = isV2Payload(payload) ? payload : migrateV1ToV2(payload)
  const processes = v2.processes.map((instance) => ({
    ...instance,
    nodes: structuredClone(instance.nodes),
    edges: structuredClone(instance.edges),
    zones: instance.zones ? structuredClone(instance.zones) : undefined,
  }))
  const commonMasters = structuredClone(v2.commonMasters)
  const summary = {
    nodeCount: processes.reduce((n, p) => n + p.nodes.length, 0),
    edgeCount: processes.reduce((n, p) => n + p.edges.length, 0),
  }
  const base: ProcessData = {
    commonMasters,
    processes,
    updatedAt: v2.exportedAt,
    dataSource,
    dirty: false,
    baselineNodeCount: summary.nodeCount,
    baselineEdgeCount: summary.edgeCount,
  }
  if (v2.overviewProcessGroups?.length || v2.detailProcessGroups?.length) {
    return ensureProcessGroupFields({
      ...base,
      overviewProcessGroups: v2.overviewProcessGroups
        ? structuredClone(v2.overviewProcessGroups)
        : undefined,
      detailProcessGroups: v2.detailProcessGroups
        ? structuredClone(v2.detailProcessGroups)
        : undefined,
    })
  }
  return ensureProcessGroupFields(base)
}

export function createInitialProcessData(
  overview: Process,
  detailProcesses: Process[],
): ProcessData {
  const commonMasters = extractCommonMastersFromOverview(overview)
  const processes: ProcessInstance[] = [
    processToInstance(overview, 'overview'),
    ...detailProcesses.map((p) => processToInstance(p, 'detail')),
  ]
  const nodeCount = processes.reduce((n, p) => n + p.nodes.length, 0)
  const edgeCount = processes.reduce((n, p) => n + p.edges.length, 0)
  return ensureProcessGroupFields({
    commonMasters,
    processes,
    updatedAt: new Date().toISOString(),
    dataSource: 'project-json',
    dirty: false,
    baselineNodeCount: nodeCount,
    baselineEdgeCount: edgeCount,
  })
}

export function processDataToFilePayload(data: ProcessData): ProcessDataFilePayloadV2 {
  const normalized = ensureProcessGroupFields(data)
  return {
    kind: 'copan-process-navigator-state',
    version: 2,
    exportedAt: normalized.updatedAt,
    commonMasters: structuredClone(normalized.commonMasters),
    processes: normalized.processes.map((p) => structuredClone(p)),
    overviewProcessGroups: structuredClone(normalized.overviewProcessGroups ?? []),
    detailProcessGroups: structuredClone(normalized.detailProcessGroups ?? []),
  }
}
