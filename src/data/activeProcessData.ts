import type { Process } from '../types/process'
import {
  getProcessByScope,
  getProcessInstance,
  OVERVIEW_SCOPE,
  processToInstance,
  resolveProcessWithMasters,
  type ProcessData,
} from '../types/processData'
import { ensureProcessGroupFields } from './processDataMigration'
import { normalizeProcessEdges, normalizeProcessNodes } from './processExport'

export type ViewMode = 'overview' | 'detail'

export function getActiveProcessData(
  data: ProcessData,
  viewMode: ViewMode,
  detailProcessId: string,
): Process | undefined {
  const scope = viewMode === 'overview' ? OVERVIEW_SCOPE : detailProcessId
  return getProcessByScope(data, scope)
}

function normalizeProcessInstanceWithMasters(
  data: ProcessData,
  instance: ReturnType<typeof processToInstance>,
  options?: { preserveZonesFrom?: ReturnType<typeof processToInstance> },
): ReturnType<typeof processToInstance> {
  const resolved = resolveProcessWithMasters(instance, data.commonMasters)
  const draft: Process = { ...resolved }
  const preservedNodeById = new Map(options?.preserveZonesFrom?.nodes.map((node) => [node.id, node]) ?? [])
  const preservedNodeIds = new Set(preservedNodeById.keys())
  const baseNodes = options?.preserveZonesFrom
    ? draft.nodes.filter((node) => preservedNodeIds.has(node.id))
    : draft.nodes
  const baseNodeIds = new Set(baseNodes.map((node) => node.id))
  const extraNodes = options?.preserveZonesFrom?.nodes.filter((node) => !baseNodeIds.has(node.id)) ?? []
  const processForNodeNormalize = extraNodes.length
    ? { ...draft, nodes: [...baseNodes, ...extraNodes] }
    : { ...draft, nodes: baseNodes }
  const nodes = normalizeProcessNodes(baseNodes, processForNodeNormalize).map((node) => {
    const preserved = preservedNodeById.get(node.id)
    if (!preserved) return node
    return {
      ...node,
      ...preserved,
      ...(preserved.cellSlot != null ? { cellSlot: preserved.cellSlot } : {}),
      ...(preserved.cellOrder != null ? { cellOrder: preserved.cellOrder } : {}),
      ...(preserved.zoneOrder != null ? { zoneOrder: preserved.zoneOrder } : {}),
      ...(preserved.offsetX != null ? { offsetX: preserved.offsetX } : {}),
      ...(preserved.offsetY != null ? { offsetY: preserved.offsetY } : {}),
      ...(preserved.stepBadge != null ? { stepBadge: preserved.stepBadge } : {}),
    }
  })
  const normalizedExtraNodes = extraNodes.length
    ? normalizeProcessNodes(extraNodes, processForNodeNormalize)
    : []

  const preservedEdgeById = new Map(options?.preserveZonesFrom?.edges.map((edge) => [edge.id, edge]) ?? [])
  const baseEdges = options?.preserveZonesFrom
    ? draft.edges.filter((edge) => preservedEdgeById.has(edge.id))
    : draft.edges
  const normalizedBaseEdges = normalizeProcessEdges(baseEdges)
  const baseEdgeIds = new Set(normalizedBaseEdges.map((edge) => edge.id))
  const edges = normalizeProcessEdges([
    ...normalizedBaseEdges.map((edge) => {
      const preserved = preservedEdgeById.get(edge.id)
      return preserved ? { ...edge, ...preserved, id: edge.id } : edge
    }),
    ...(options?.preserveZonesFrom?.edges.filter((edge) => !baseEdgeIds.has(edge.id)) ?? []),
  ])

  // laneIds/autoHideEmptyLanes는 registry에 없는 사용자별 표시 설정이므로,
  // registry 동기화로 instance를 재구성할 때 zones처럼 현재 값을 보존한다.
  const preserved = options?.preserveZonesFrom
  return {
    ...instance,
    nodes: [...nodes, ...normalizedExtraNodes],
    edges,
    zones: preserved ? structuredClone(preserved.zones ?? []) : instance.zones,
    laneIds: preserved ? preserved.laneIds : instance.laneIds,
    autoHideEmptyLanes: preserved ? preserved.autoHideEmptyLanes : instance.autoHideEmptyLanes,
  }
}

export function ensureDetailProcessInStore(
  data: ProcessData,
  processId: string,
  fallback?: Process,
): ProcessData {
  if (processId === OVERVIEW_SCOPE || !fallback) return data
  const existingIndex = data.processes.findIndex(
    (instance) => instance.id === processId && instance.type === 'detail',
  )
  if (existingIndex >= 0) {
    const current = data.processes[existingIndex]
    if (!registryDetailNeedsSync(current, fallback)) return data
    const processes = [...data.processes]
    processes[existingIndex] = normalizeProcessInstanceWithMasters(
      data,
      processToInstance(fallback, 'detail'),
      { preserveZonesFrom: current },
    )
    return { ...data, processes }
  }
  const instance = normalizeProcessInstanceWithMasters(data, processToInstance(fallback, 'detail'))
  return {
    ...data,
    processes: [...data.processes, instance],
  }
}

function registryDetailNeedsSync(
  current: ReturnType<typeof processToInstance>,
  registry: Process,
): boolean {
  if (registry.nodes.length !== current.nodes.length) return true
  if (registry.edges.length !== current.edges.length) return true
  const currentById = new Map(current.nodes.map((node) => [node.id, node]))
  for (const node of registry.nodes) {
    const prev = currentById.get(node.id)
    if (!prev) return true
    if (
      prev.name !== node.name ||
      prev.type !== node.type ||
      prev.phaseOrder !== node.phaseOrder ||
      prev.overviewType !== node.overviewType
    ) {
      return true
    }
  }
  const currentEdgeById = new Map(current.edges.map((edge) => [edge.id, edge]))
  const pointKey = (points?: Array<{ x: number; y: number }>) =>
    points?.map((point) => `${point.x},${point.y}`).join(';') ?? ''
  for (const edge of registry.edges) {
    const prev = currentEdgeById.get(edge.id)
    if (!prev) return true
    const registrySourceHandle = edge.sourceHandle ?? edge.routing?.sourceHandle
    const registryTargetHandle = edge.targetHandle ?? edge.routing?.targetHandle
    const currentSourceHandle = prev.sourceHandle ?? prev.routing?.sourceHandle
    const currentTargetHandle = prev.targetHandle ?? prev.routing?.targetHandle
    if (
      prev.source !== edge.source ||
      prev.target !== edge.target ||
      prev.condition !== edge.condition ||
      prev.label !== edge.label ||
      prev.type !== edge.type ||
      (registrySourceHandle != null && currentSourceHandle !== registrySourceHandle) ||
      (registryTargetHandle != null && currentTargetHandle !== registryTargetHandle) ||
      prev.routing?.mode !== edge.routing?.mode ||
      prev.routing?.handleAuto !== edge.routing?.handleAuto ||
      prev.routing?.handlesLocked !== edge.routing?.handlesLocked ||
      pointKey(prev.routing?.points) !== pointKey(edge.routing?.points)
    ) {
      return true
    }
  }
  return false
}

/** store에 있어도 registry canonical이 더 최신이면 nodes/edges 동기화 */
export function syncDetailProcessesFromRegistry(
  data: ProcessData,
  registryProcesses: Process[],
): ProcessData {
  let processes = data.processes
  let changed = false

  for (const registry of registryProcesses) {
    const idx = processes.findIndex((instance) => instance.id === registry.id && instance.type === 'detail')
    if (idx < 0) continue
    const current = processes[idx]
    if (!registryDetailNeedsSync(current, registry)) continue

    const synced = normalizeProcessInstanceWithMasters(
      data,
      processToInstance(registry, 'detail'),
      { preserveZonesFrom: current },
    )
    if (!changed) {
      processes = [...data.processes]
      changed = true
    }
    processes[idx] = synced
  }

  return changed ? { ...data, processes } : data
}

export function mergeMissingDetailProcesses(
  data: ProcessData,
  registryProcesses: Process[],
): ProcessData {
  let next = data
  const overview = getProcessInstance(data, OVERVIEW_SCOPE)
  for (const process of registryProcesses) {
    if (overview && process.id === overview.id) continue
    next = ensureDetailProcessInStore(next, process.id, process)
  }
  return ensureProcessGroupFields(next)
}

export function resolveDetailProcessesForMenu(
  data: ProcessData,
  registryProcesses: Process[],
): Process[] {
  return registryProcesses.map((process) => {
    const resolved = getProcessByScope(data, process.id)
    return resolved ?? process
  })
}

export function getCommonMasters(data: ProcessData) {
  return data.commonMasters
}
