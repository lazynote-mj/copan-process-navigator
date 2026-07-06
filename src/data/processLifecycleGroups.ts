import {
  APP_CONFIG,
  getConfiguredLifecycleGroupForDetailProcess,
  type ProcessLifecycleGroup,
  type ProcessLifecycleGroupId,
} from '../config/appConfig'
import type { DetailProcessGroup } from '../types/toBeNavigator'

export type { ProcessLifecycleGroup, ProcessLifecycleGroupId }

export const PROCESS_LIFECYCLE_GROUPS: ProcessLifecycleGroup[] = [...APP_CONFIG.lifecycleGroups]

export const DETAIL_PROCESS_LIFECYCLE_GROUP_IDS: Record<string, ProcessLifecycleGroupId> = {
  ...APP_CONFIG.detailProcessLifecycleGroupIds,
}

export function getLifecycleGroupForDetailProcess(detailProcessId: string): ProcessLifecycleGroup {
  return getConfiguredLifecycleGroupForDetailProcess(detailProcessId)
}

/**
 * 그룹 데이터의 lifecycleGroupId 우선, 없거나 무효하면 appConfig 기본 분류 fallback.
 * 신규/복제 프로세스는 데이터 필드로만 분류를 가질 수 있다.
 */
export function resolveLifecycleGroupForDetailGroup(
  group: Pick<DetailProcessGroup, 'detailProcessId' | 'lifecycleGroupId'>,
): ProcessLifecycleGroup {
  if (group.lifecycleGroupId) {
    const configured = PROCESS_LIFECYCLE_GROUPS.find((entry) => entry.id === group.lifecycleGroupId)
    if (configured) return configured
  }
  return getConfiguredLifecycleGroupForDetailProcess(group.detailProcessId)
}
