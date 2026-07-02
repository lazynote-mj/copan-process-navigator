import type { Process } from './process'
import type { ProcessLifecycleGroupId } from '../config/appConfig'

/** Overview — 전체 맵에서 노드/연결선 강조용 (상세 프로세스와 1:1 아님) */
export type OverviewProcessGroup = {
  id: string
  name: string
  description: string
  /** Overview menu placement — Lifecycle Tree 기준 */
  lifecycleGroupId?: ProcessLifecycleGroupId
  overviewNodeIds: string[]
  overviewEdgeIds: string[]
  /** 심화(상세)로 연결할 DetailProcessGroup id — 없으면 Overview 강조만 */
  linkedDetailGroupId?: string
}

/** 프로세스 상세 — PDF/업무 단위 세부 흐름 (Overview 그룹과 별도 정의) */
export type DetailProcessGroup = {
  id: string
  name: string
  description: string
  detailProcessId: string
  /** Overview에서 대응하는 강조 그룹 — 없으면 상세 전용 */
  linkedOverviewGroupId?: string
}

/** @deprecated OverviewProcessGroup | DetailProcessGroup 사용 */
export type ProcessGroup = OverviewProcessGroup & {
  detailProcessId?: string
}

export type ToBeNavigatorBundle = {
  overview: Process
  overviewProcessGroups: OverviewProcessGroup[]
  detailProcessGroups: DetailProcessGroup[]
  detailProcesses: Process[]
  /** @deprecated overviewProcessGroups */
  processGroups?: ProcessGroup[]
}

export function getOverviewProcessGroupById(
  bundle: ToBeNavigatorBundle,
  groupId: string,
): OverviewProcessGroup | undefined {
  return bundle.overviewProcessGroups.find((g) => g.id === groupId)
}

export function getDetailProcessGroupById(
  bundle: ToBeNavigatorBundle,
  groupId: string,
): DetailProcessGroup | undefined {
  return bundle.detailProcessGroups.find((g) => g.id === groupId)
}

export function getDetailProcessGroupByProcessId(
  bundle: ToBeNavigatorBundle,
  detailProcessId: string,
): DetailProcessGroup | undefined {
  return bundle.detailProcessGroups.find((g) => g.detailProcessId === detailProcessId)
}

/** @deprecated getOverviewProcessGroupById */
export function getProcessGroupById(
  bundle: ToBeNavigatorBundle,
  groupId: string,
): ProcessGroup | undefined {
  const overview = getOverviewProcessGroupById(bundle, groupId)
  if (overview) {
    const linked = overview.linkedDetailGroupId
      ? getDetailProcessGroupById(bundle, overview.linkedDetailGroupId)
      : undefined
    return {
      ...overview,
      ...(linked ? { detailProcessId: linked.detailProcessId } : {}),
    }
  }
  const detail = getDetailProcessGroupById(bundle, groupId)
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

export function getDetailProcessById(
  bundle: ToBeNavigatorBundle,
  detailId: string,
): Process | undefined {
  return bundle.detailProcesses.find((p) => p.id === detailId)
}
