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
import { resolveLifecycleGroupForDetailGroup } from './processLifecycleGroups'
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
import type { DetailProcessGroup, OverviewProcessGroup } from '../types/toBeNavigator'

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

function markDataTouched(data: ProcessData): ProcessData {
  return {
    ...data,
    updatedAt: new Date().toISOString(),
    dirty: true,
  }
}

function isStructurallyEqual(a: unknown, b: unknown): boolean {
  try {
    return JSON.stringify(a) === JSON.stringify(b)
  } catch {
    return false
  }
}

export type DetailProcessFallback = (processId: string) => Process | undefined

export type CloneDetailProcessResult = {
  data: ProcessData
  processId: string
  groupId: string
}

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

function slugifyProcessId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function buildUniqueId(baseId: string, existingIds: Set<string>): string {
  const fallbackBase = baseId || 'process'
  let nextId = fallbackBase
  let suffix = 2
  while (existingIds.has(nextId)) {
    nextId = `${fallbackBase}-${suffix}`
    suffix += 1
  }
  existingIds.add(nextId)
  return nextId
}

function remapOwnedId(
  oldId: string,
  sourceProcessId: string,
  targetProcessId: string,
  fallbackPrefix: string,
  index: number,
  existingIds: Set<string>,
): string {
  const base =
    oldId.startsWith(sourceProcessId)
      ? oldId.replace(sourceProcessId, targetProcessId)
      : `${targetProcessId}-${fallbackPrefix}-${String(index + 1).padStart(2, '0')}`
  return buildUniqueId(base, existingIds)
}

function processToDetailInstance(process: Process): ProcessInstance {
  return {
    id: process.id,
    type: 'detail',
    name: process.name,
    description: process.description,
    version: process.version,
    status: process.status,
    lastModified: process.lastModified,
    owner: process.owner,
    nodes: process.nodes,
    edges: process.edges,
    zones: process.zones,
    overviewNodeId: process.overviewNodeId,
    source: process.source,
  }
}

function resolveProcessInstanceForClone(
  data: ProcessData,
  sourceProcessId: string,
  fallback?: DetailProcessFallback,
): ProcessInstance | undefined {
  const existing = data.processes.find((process) => process.id === sourceProcessId && process.type === 'detail')
  if (existing) return existing
  const fallbackProcess = fallback?.(sourceProcessId)
  return fallbackProcess ? processToDetailInstance(fallbackProcess) : undefined
}

function updateProcessInstance(
  data: ProcessData,
  scope: ProcessScope,
  updater: (instance: ProcessInstance) => ProcessInstance,
  fallback?: DetailProcessFallback,
): ProcessData {
  const idx = findProcessIndex(data, scope)
  if (idx >= 0) {
    const currentInstance = data.processes[idx]
    const updated = normalizeProcessInstance(
      updater(structuredClone(currentInstance)),
      data.commonMasters,
    )

    if (isStructurallyEqual(updated, currentInstance)) return data

    const processes = [...data.processes]
    processes[idx] = updated
    return markDataTouched({ ...data, processes })
  }

  if (scope === 'overview') return data

  const existing = resolveDetailFallback(fallback, scope)
  if (!existing) return data

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
    data.commonMasters,
  )
  const updated = normalizeProcessInstance(updater(instance), data.commonMasters)
  return markDataTouched({ ...data, processes: [...data.processes, updated] })
}

export function ensureDetailProcess(
  data: ProcessData,
  processId: string,
  fallback?: Process,
): ProcessData {
  if (!fallback || findProcessIndex(data, processId) >= 0) return data
  return ensureDetailProcessInStore(data, processId, fallback)
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

export function addNodesAndEdges(
  data: ProcessData,
  scope: ProcessScope,
  nodes: Node[],
  edges: Edge[],
  fallback?: DetailProcessFallback,
): ProcessData {
  if (nodes.length === 0 && edges.length === 0) return data
  return updateProcessInstance(
    data,
    scope,
    (instance) => ({
      ...instance,
      nodes: [...instance.nodes, ...nodes],
      edges: [...instance.edges, ...edges.map((edge) => normalizeEdgeForStorage(edge))],
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

export type ProcessLaneDisplaySettings = {
  /** 표시 레인 서브셋 — undefined면 마스터 전체 표시 */
  laneIds?: string[]
  /** 노드 없는 레인 자동 숨김 */
  autoHideEmptyLanes?: boolean
}

/**
 * 프로세스별 레인 표시 설정 저장 (표시 레인 서브셋 + 빈 레인 자동 숨김).
 * 노드가 배치된 레인은 숨길 수 없어 자동 포함하고,
 * 전체 레인 선택이면 laneIds 필드를 제거해 "마스터 전체 자동 표시"로 되돌린다.
 * 각 설정은 기본값(전체 표시 / 숨김 안 함)일 때 필드를 제거해 데이터를 깔끔하게 유지한다.
 */
export function saveProcessLaneDisplay(
  data: ProcessData,
  scope: ProcessScope,
  settings: ProcessLaneDisplaySettings,
  fallback?: DetailProcessFallback,
): ProcessData {
  return updateProcessInstance(
    data,
    scope,
    (instance) => {
      const { laneIds: _laneIds, autoHideEmptyLanes: _auto, ...base } = instance
      const next: ProcessInstance = { ...base }

      if (settings.laneIds) {
        const masterLaneIds = data.commonMasters.lanes.map((lane) => lane.id)
        const selected = new Set(settings.laneIds)
        for (const node of instance.nodes) {
          if (node.laneId) selected.add(node.laneId)
        }
        const ordered = masterLaneIds.filter((id) => selected.has(id))
        if (ordered.length < masterLaneIds.length) {
          next.laneIds = ordered
        }
      }

      if (settings.autoHideEmptyLanes) {
        next.autoHideEmptyLanes = true
      }

      return next
    },
    fallback,
  )
}

/** 스윔레인은 commonMasters — Overview·Detail 공통 */
/**
 * 프로세스가 현재 화면에 표시하는 레인 id — 단일 레인 collapse를 반영한다.
 * 신규 레인 추가 시 기존 프로세스를 이 값으로 고정하면 표시가 그대로 유지된다.
 */
function currentDisplayedLaneIds(instance: ProcessInstance, masters: CommonMasters): string[] {
  const usedLaneIds = [...new Set(instance.nodes.map((node) => node.laneId).filter(Boolean))]
  // 명시 설정이 없고 노드가 한 레인에만 있으면 collapse 상태 → 그 레인만 표시 중
  if (!instance.laneIds?.length && usedLaneIds.length === 1) {
    return usedLaneIds
  }
  return resolveProcessWithMasters(instance, masters).lanes.map((lane) => lane.id)
}

export function saveLane(
  data: ProcessData,
  _scope: ProcessScope,
  lane: Lane,
  isNew: boolean,
): ProcessData {
  const withLane = updateCommonMasters(data, (masters) => {
    const lanes = isNew
      ? sortLanesByOrder([...masters.lanes, lane])
      : sortLanesByOrder(masters.lanes.map((existing) => (existing.id === lane.id ? lane : existing)))
    return { ...masters, lanes }
  })
  if (!isNew) return withLane

  // 신규 레인은 기존 프로세스에 자동 노출하지 않는다 — laneIds 미지정(전체 표시)
  // detail 프로세스를 현재 표시 레인으로 고정해 새 레인을 제외한다.
  // Overview는 마스터 맵이므로 새 레인을 그대로 반영한다.
  const oldMasters = data.commonMasters
  const processes = withLane.processes.map((instance) => {
    if (instance.type !== 'detail' || instance.laneIds?.length) return instance
    return { ...instance, laneIds: currentDisplayedLaneIds(instance, oldMasters) }
  })
  return { ...withLane, processes }
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

export function cloneDetailProcess(
  data: ProcessData,
  sourceProcessId: string,
  requestedName: string,
  fallback?: DetailProcessFallback,
): CloneDetailProcessResult {
  const source = resolveProcessInstanceForClone(data, sourceProcessId, fallback)
  const name = requestedName.trim()
  if (!source || source.type !== 'detail' || !name) {
    return { data, processId: sourceProcessId, groupId: '' }
  }

  const existingProcessIds = new Set(data.processes.map((process) => process.id))
  const existingNodeIds = new Set(data.processes.flatMap((process) => process.nodes.map((node) => node.id)))
  const existingEdgeIds = new Set(data.processes.flatMap((process) => process.edges.map((edge) => edge.id)))
  const existingZoneIds = new Set(data.processes.flatMap((process) => (process.zones ?? []).map((zone) => zone.id)))
  const existingGroupIds = new Set((data.detailProcessGroups ?? []).map((group) => group.id))

  const processId = buildUniqueId(
    slugifyProcessId(name) || `${source.id}-copy`,
    existingProcessIds,
  )
  const groupId = buildUniqueId(`${processId}-group`, existingGroupIds)

  const nodeIdMap = new Map<string, string>()
  const nodes = source.nodes.map((node, index) => {
    const id = remapOwnedId(node.id, source.id, processId, 'step', index, existingNodeIds)
    nodeIdMap.set(node.id, id)
    return {
      ...structuredClone(node),
      id,
    }
  })

  const edges = source.edges.flatMap((edge, index) => {
    const sourceId = nodeIdMap.get(edge.source)
    const targetId = nodeIdMap.get(edge.target)
    if (!sourceId || !targetId) return []
    return [{
      ...structuredClone(edge),
      id: remapOwnedId(edge.id, source.id, processId, 'edge', index, existingEdgeIds),
      source: sourceId,
      target: targetId,
      ...(edge.processId ? { processId } : {}),
    }]
  }).map((edge) => normalizeEdgeForStorage(edge))

  const zones = (source.zones ?? []).map((zone, index) => ({
    ...structuredClone(zone),
    id: remapOwnedId(zone.id, source.id, processId, 'zone', index, existingZoneIds),
    nodeIds: zone.nodeIds.map((nodeId) => nodeIdMap.get(nodeId)).filter((id): id is string => Boolean(id)),
  }))

  const clonedProcess: ProcessInstance = normalizeProcessInstance(
    {
      ...structuredClone(source),
      id: processId,
      type: 'detail',
      name,
      description: source.description ?? '',
      status: 'draft',
      lastModified: new Date().toISOString(),
      nodes,
      edges,
      zones,
      overviewNodeId: source.overviewNodeId,
    },
    data.commonMasters,
  )

  // 복제본은 원본의 분류를 데이터 필드로 명시 승계한다 —
  // 새 processId는 appConfig 기본 분류 맵에 없어 fallback으로 빠지기 때문.
  const sourceGroup = (data.detailProcessGroups ?? []).find(
    (entry) => entry.detailProcessId === sourceProcessId,
  )
  const clonedGroup: DetailProcessGroup = {
    id: groupId,
    name,
    description: source.description ?? '',
    detailProcessId: processId,
    lifecycleGroupId: resolveLifecycleGroupForDetailGroup({
      detailProcessId: sourceProcessId,
      lifecycleGroupId: sourceGroup?.lifecycleGroupId,
    }).id,
    // ADR-008 Navigation Phase 1 — 복제본은 원본의 Workflow 소속을 승계한다(사용자가 바꾸기 전까지).
    // 승계하지 않으면 복제본이 "미분류 Workflow"로 떨어진다. variantLabel/order는 새 항목이라 비운다.
    ...(sourceGroup?.workflowId ? { workflowId: sourceGroup.workflowId } : {}),
  }

  return {
    data: markDataTouched({
      ...data,
      processes: [...data.processes, clonedProcess],
      detailProcessGroups: [...(data.detailProcessGroups ?? []), clonedGroup],
    }),
    processId,
    groupId,
  }
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

export function deleteElements(
  data: ProcessData,
  scope: ProcessScope,
  selection: { nodeIds?: string[]; edgeIds?: string[] },
  fallback?: DetailProcessFallback,
): ProcessData {
  const nodeIds = new Set(selection.nodeIds ?? [])
  const edgeIds = new Set(selection.edgeIds ?? [])
  if (nodeIds.size === 0 && edgeIds.size === 0) return data

  return updateProcessInstance(
    data,
    scope,
    (instance) => {
      const resolved = resolveProcessWithMasters(instance, data.commonMasters)
      const nextNodes = resolved.nodes.filter((node) => !nodeIds.has(node.id))
      const nextEdges = resolved.edges.filter(
        (edge) => !edgeIds.has(edge.id) && !nodeIds.has(edge.source) && !nodeIds.has(edge.target),
      )
      const nextZones = (resolved.zones ?? []).map((zone) => ({
        ...zone,
        nodeIds: zone.nodeIds.filter((id) => !nodeIds.has(id)),
      }))
      return { ...instance, nodes: nextNodes, edges: nextEdges, zones: nextZones }
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
  // 최종 방어 — 어느 프로세스든 이 레인을 참조하는 노드가 있으면 삭제하지 않는다
  const referenced = data.processes.some((process) =>
    process.nodes.some((node) => node.laneId === laneId),
  )
  if (referenced) return data

  const overview = getProcessByScope(data, 'overview')
  if (!overview) return data

  // 프로세스별 표시 레인(laneIds)에 남은 참조도 함께 정리
  const processes = data.processes.map((process) =>
    process.laneIds?.includes(laneId)
      ? { ...process, laneIds: process.laneIds.filter((id) => id !== laneId) }
      : process,
  )

  const nextOverview = deleteLaneFromProcess(overview, laneId)
  return updateCommonMasters({ ...data, processes }, (masters) => ({
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

export function saveOverviewProcessGroup(
  data: ProcessData,
  group: OverviewProcessGroup,
): ProcessData {
  const groups = [...(data.overviewProcessGroups ?? [])]
  const index = groups.findIndex((entry) => entry.id === group.id)
  const nextGroup = structuredClone(group)
  if (index >= 0) {
    groups[index] = nextGroup
  } else {
    groups.push(nextGroup)
  }
  return {
    ...data,
    overviewProcessGroups: groups,
    dirty: true,
    updatedAt: new Date().toISOString(),
  }
}

export function saveDetailProcessGroup(
  data: ProcessData,
  group: DetailProcessGroup,
): ProcessData {
  const groups = [...(data.detailProcessGroups ?? [])]
  const index = groups.findIndex((entry) => entry.id === group.id)
  const nextGroup = structuredClone(group)
  if (index >= 0) {
    groups[index] = nextGroup
  } else {
    groups.push(nextGroup)
  }
  return {
    ...data,
    detailProcessGroups: groups,
    dirty: true,
    updatedAt: new Date().toISOString(),
  }
}

/** @deprecated saveOverviewProcessGroup */
export function saveProcessGroup(data: ProcessData, group: OverviewProcessGroup): ProcessData {
  return saveOverviewProcessGroup(data, group)
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
