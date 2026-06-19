import type { Process } from '../types/process'
import {
  getProcessByScope,
  getProcessInstance,
  OVERVIEW_SCOPE,
  processToInstance,
  resolveProcessWithMasters,
  type ProcessData,
} from '../types/processData'
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
): ReturnType<typeof processToInstance> {
  const resolved = resolveProcessWithMasters(instance, data.commonMasters)
  const draft: Process = { ...resolved }
  return {
    ...instance,
    nodes: normalizeProcessNodes(draft.nodes, draft),
    edges: normalizeProcessEdges(draft.edges),
  }
}

export function ensureDetailProcessInStore(
  data: ProcessData,
  processId: string,
  fallback?: Process,
): ProcessData {
  if (processId === OVERVIEW_SCOPE || getProcessInstance(data, processId) || !fallback) return data
  const instance = normalizeProcessInstanceWithMasters(data, processToInstance(fallback, 'detail'))
  return {
    ...data,
    processes: [...data.processes, instance],
  }
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
  return next
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
