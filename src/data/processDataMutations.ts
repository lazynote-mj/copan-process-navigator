import type { Edge, Lane, Node, Process, ProcessZone } from '../types/process'
import type { CommonMasters } from '../types/commonMasters'
import type { ProcessInstance } from '../types/processInstance'
import { normalizeProcessEdges, normalizeProcessNodes } from './processExport'
import { getOverviewLanes } from './laneRegistry'
import { ensureDetailProcessInStore } from './activeProcessData'
import {
  deleteEdgeFromProcess,
  deleteLaneFromProcess,
  deleteNodeFromProcess,
  deleteZoneFromProcess,
  sortLanesByOrder,
} from '../lib/editor/processEditor'
import { normalizeEdgeForStorage } from '../lib/editor/edgeUpdate'
import { isDerivedDisplayEdge } from '../lib/nodeVisibility'
import {
  cloneProcessData,
  findProcessIndex,
  getProcessByScope,
  resolveProcessWithMasters,
  summarizeProcessData,
  type ProcessData,
  type ProcessScope,
} from '../types/processData'
import { buildProcessDataFromPayload, createInitialProcessData } from './processDataMigration'
import type { ProcessDataFilePayload } from './processDataMigration'

function normalizeProcessZones(zones: ProcessZone[] | undefined): ProcessZone[] {
  return (zones ?? []).map((zone) => ({
    ...zone,
    type: 'process-zone' as const,
    laneIds: zone.laneIds ?? [],
    phaseIds: zone.phaseIds ?? [],
    nodeIds: zone.nodeIds ?? [],
    style: zone.style ?? {},
  }))
}

function normalizeProcess(process: Process): Process {
  const lanes = process.lanes?.length ? process.lanes : getOverviewLanes()
  const draft: Process = { ...process, lanes, zones: normalizeProcessZones(process.zones) }
  return {
    ...draft,
    nodes: normalizeProcessNodes(draft.nodes, draft),
    edges: normalizeProcessEdges(draft.edges),
  }
}

function normalizeProcessInstance(
  instance: ProcessInstance,
  masters: CommonMasters,
): ProcessInstance {
  const resolved = resolveProcessWithMasters(instance, masters)
  const normalized = normalizeProcess(resolved)
  return {
    ...instance,
    nodes: normalized.nodes,
    edges: normalized.edges,
    zones: normalized.zones,
  }
}

function touchData(data: ProcessData, updater: (current: ProcessData) => ProcessData): ProcessData {
  const next = updater(data)
  return {
    ...next,
    updatedAt: new Date().toISOString(),
    dirty: true,
  }
}

export type DetailProcessFallback = (processId: string) => Process | undefined

function resolveDetailFallback(
  fallback?: DetailProcessFallback,
  scope?: ProcessScope,
): Process | undefined {
  if (!fallback || !scope || scope === 'overview') return undefined
  return fallback(scope)
}

function updateCommonMasters(
  data: ProcessData,
  updater: (masters: CommonMasters) => CommonMasters,
): ProcessData {
  return touchData(data, (current) => ({
    ...current,
    commonMasters: updater(current.commonMasters),
  }))
}

function updateProcessInstance(
  data: ProcessData,
  scope: ProcessScope,
  updater: (instance: ProcessInstance) => ProcessInstance,
  fallback?: DetailProcessFallback,
): ProcessData {
  return touchData(data, (current) => {
    const idx = findProcessIndex(current, scope)
    if (idx >= 0) {
      const processes = [...current.processes]
      processes[idx] = normalizeProcessInstance(
        updater(structuredClone(current.processes[idx])),
        current.commonMasters,
      )
      return { ...current, processes }
    }

    if (scope === 'overview') return current

    const existing = resolveDetailFallback(fallback, scope)
    if (!existing) return current

    const instance = normalizeProcessInstance(
      {
        id: existing.id,
        type: 'detail',
        name: existing.name,
        description: existing.description,
        version: existing.version,
        status: existing.status,
        lastModified: existing.lastModified,
        owner: existing.owner,
        nodes: existing.nodes,
        edges: existing.edges,
        zones: existing.zones,
        overviewNodeId: existing.overviewNodeId,
        source: existing.source,
      },
      current.commonMasters,
    )
    const updated = normalizeProcessInstance(updater(instance), current.commonMasters)
    return { ...current, processes: [...current.processes, updated] }
  })
}

export function ensureDetailProcess(
  data: ProcessData,
  processId: string,
  fallback?: Process,
): ProcessData {
  if (!fallback || findProcessIndex(data, processId) >= 0) return data
  return touchData(data, (current) => ensureDetailProcessInStore(current, processId, fallback))
}

export function updateNode(
  data: ProcessData,
  scope: ProcessScope,
  nodeId: string,
  patch: Partial<Node>,
  fallback?: DetailProcessFallback,
): ProcessData {
  return updateProcessInstance(
    data,
    scope,
    (instance) => ({
      ...instance,
      nodes: instance.nodes.map((node) => (node.id === nodeId ? { ...node, ...patch } : node)),
    }),
    fallback,
  )
}

export function updateActiveNodes(
  data: ProcessData,
  scope: ProcessScope,
  updater: (nodes: Node[]) => Node[],
  fallback?: DetailProcessFallback,
): ProcessData {
  return updateProcessInstance(
    data,
    scope,
    (instance) => ({ ...instance, nodes: updater(instance.nodes) }),
    fallback,
  )
}

export function updateActiveEdges(
  data: ProcessData,
  scope: ProcessScope,
  updater: (edges: Edge[]) => Edge[],
  fallback?: DetailProcessFallback,
): ProcessData {
  return updateProcessInstance(
    data,
    scope,
    (instance) => ({
      ...instance,
      edges: updater(instance.edges).map((edge) => normalizeEdgeForStorage(edge)),
    }),
    fallback,
  )
}

export function saveNode(
  data: ProcessData,
  scope: ProcessScope,
  node: Node,
  isNew: boolean,
  fallback?: DetailProcessFallback,
): ProcessData {
  return updateProcessInstance(
    data,
    scope,
    (instance) => ({
      ...instance,
      nodes: isNew
        ? [...instance.nodes, node]
        : instance.nodes.map((existing) => (existing.id === node.id ? node : existing)),
    }),
    fallback,
  )
}

export function updateEdge(
  data: ProcessData,
  scope: ProcessScope,
  edgeId: string,
  patch: Partial<Edge>,
  fallback?: DetailProcessFallback,
): ProcessData {
  return updateProcessInstance(
    data,
    scope,
    (instance) => ({
      ...instance,
      edges: instance.edges.map((edge) =>
        edge.id === edgeId ? normalizeEdgeForStorage({ ...edge, ...patch, id: edge.id }) : edge,
      ),
    }),
    fallback,
  )
}

export function saveEdge(
  data: ProcessData,
  scope: ProcessScope,
  edge: Edge,
  isNew: boolean,
  fallback?: DetailProcessFallback,
): ProcessData {
  if (isDerivedDisplayEdge(edge)) {
    return data
  }

  const normalized = normalizeEdgeForStorage(edge)
  return updateProcessInstance(
    data,
    scope,
    (instance) => ({
      ...instance,
      edges: isNew
        ? [...instance.edges, normalized]
        : instance.edges.map((existing) => (existing.id === normalized.id ? normalized : existing)),
    }),
    fallback,
  )
}

/** 스윔레인은 commonMasters — Overview·Detail 공통 */
export function saveLane(
  data: ProcessData,
  _scope: ProcessScope,
  lane: Lane,
  isNew: boolean,
): ProcessData {
  return updateCommonMasters(data, (masters) => {
    const lanes = isNew
      ? sortLanesByOrder([...masters.lanes, lane])
      : sortLanesByOrder(masters.lanes.map((existing) => (existing.id === lane.id ? lane : existing)))
    return { ...masters, lanes }
  })
}

export function saveZone(
  data: ProcessData,
  scope: ProcessScope,
  zone: ProcessZone,
  isNew: boolean,
  fallback?: DetailProcessFallback,
): ProcessData {
  return updateProcessInstance(
    data,
    scope,
    (instance) => {
      const zones = normalizeProcessZones(instance.zones)
      const nextZones = isNew
        ? [...zones, zone]
        : zones.map((existing) => (existing.id === zone.id ? zone : existing))
      return { ...instance, zones: nextZones }
    },
    fallback,
  )
}

export function deleteNode(
  data: ProcessData,
  scope: ProcessScope,
  nodeId: string,
  fallback?: DetailProcessFallback,
): ProcessData {
  return updateProcessInstance(
    data,
    scope,
    (instance) => {
      const resolved = resolveProcessWithMasters(instance, data.commonMasters)
      const next = deleteNodeFromProcess(resolved, nodeId)
      return { ...instance, nodes: next.nodes, edges: next.edges, zones: next.zones }
    },
    fallback,
  )
}

export function deleteEdge(
  data: ProcessData,
  scope: ProcessScope,
  edgeId: string,
  fallback?: DetailProcessFallback,
): ProcessData {
  return updateProcessInstance(
    data,
    scope,
    (instance) => {
      const resolved = resolveProcessWithMasters(instance, data.commonMasters)
      return { ...instance, edges: deleteEdgeFromProcess(resolved, edgeId).edges }
    },
    fallback,
  )
}

/** 스윔레인 삭제는 commonMasters — 모든 process에 반영 */
export function deleteLane(
  data: ProcessData,
  _scope: ProcessScope,
  laneId: string,
): ProcessData {
  const overview = getProcessByScope(data, 'overview')
  if (!overview) return data

  const nextOverview = deleteLaneFromProcess(overview, laneId)
  return updateCommonMasters(data, (masters) => ({
    ...masters,
    lanes: nextOverview.lanes,
  }))
}

export function deleteZone(
  data: ProcessData,
  scope: ProcessScope,
  zoneId: string,
  fallback?: DetailProcessFallback,
): ProcessData {
  return updateProcessInstance(
    data,
    scope,
    (instance) => {
      const resolved = resolveProcessWithMasters(instance, data.commonMasters)
      return { ...instance, zones: deleteZoneFromProcess(resolved, zoneId).zones }
    },
    fallback,
  )
}

export function connectEdge(
  data: ProcessData,
  scope: ProcessScope,
  edge: Edge,
  fallback?: DetailProcessFallback,
): ProcessData {
  return saveEdge(data, scope, edge, true, fallback)
}

export function replaceProcessData(_current: ProcessData, next: ProcessData): ProcessData {
  const summary = summarizeProcessData(next)
  return {
    ...next,
    baselineNodeCount: summary.nodeCount,
    baselineEdgeCount: summary.edgeCount,
    dirty: false,
  }
}

export function importProcessDataFromPayload(
  payload: ProcessDataFilePayload,
  dataSource: ProcessData['dataSource'],
): ProcessData {
  return buildProcessDataFromPayload(payload, dataSource)
}

export function markProcessDataClean(data: ProcessData): ProcessData {
  const summary = summarizeProcessData(data)
  return {
    ...data,
    dirty: false,
    baselineNodeCount: summary.nodeCount,
    baselineEdgeCount: summary.edgeCount,
  }
}

export { cloneProcessData, createInitialProcessData }
