import type { CommonMasters } from '../types/commonMasters'
import type { Process } from '../types/process'
import type { ProcessInstance } from '../types/processInstance'
import {
  extractCommonMastersFromOverview,
  processToInstance,
  type ProcessData,
} from '../types/processData'

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
  return {
    commonMasters,
    processes,
    updatedAt: v2.exportedAt,
    dataSource,
    dirty: false,
    baselineNodeCount: summary.nodeCount,
    baselineEdgeCount: summary.edgeCount,
  }
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
  return {
    commonMasters,
    processes,
    updatedAt: new Date().toISOString(),
    dataSource: 'project-json',
    dirty: false,
    baselineNodeCount: nodeCount,
    baselineEdgeCount: edgeCount,
  }
}

export function processDataToFilePayload(data: ProcessData): ProcessDataFilePayloadV2 {
  return {
    kind: 'copan-process-navigator-state',
    version: 2,
    exportedAt: data.updatedAt,
    commonMasters: structuredClone(data.commonMasters),
    processes: data.processes.map((p) => structuredClone(p)),
  }
}
