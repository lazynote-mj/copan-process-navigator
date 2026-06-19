import type { Process } from './process'

/** Overview 내 프로세스 그룹 — 관련 노드/연결선 묶음 */
export type ProcessGroup = {
  id: string
  name: string
  description: string
  overviewNodeIds: string[]
  overviewEdgeIds: string[]
  detailProcessId: string
}

/** TO-BE Navigator 전체 데이터 번들 */
export type ToBeNavigatorBundle = {
  overview: Process
  processGroups: ProcessGroup[]
  detailProcesses: Process[]
}

export function getProcessGroupById(
  bundle: ToBeNavigatorBundle,
  groupId: string,
): ProcessGroup | undefined {
  return bundle.processGroups.find((g) => g.id === groupId)
}

export function getDetailProcessById(
  bundle: ToBeNavigatorBundle,
  detailId: string,
): Process | undefined {
  return bundle.detailProcesses.find((p) => p.id === detailId)
}
