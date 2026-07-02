import {
  APP_CONFIG,
  getConfiguredLifecycleGroupForDetailProcess,
  type ProcessLifecycleGroup,
  type ProcessLifecycleGroupId,
} from '../config/appConfig'

export type { ProcessLifecycleGroup, ProcessLifecycleGroupId }

export const PROCESS_LIFECYCLE_GROUPS: ProcessLifecycleGroup[] = [...APP_CONFIG.lifecycleGroups]

export const DETAIL_PROCESS_LIFECYCLE_GROUP_IDS: Record<string, ProcessLifecycleGroupId> = {
  ...APP_CONFIG.detailProcessLifecycleGroupIds,
}

export function getLifecycleGroupForDetailProcess(detailProcessId: string): ProcessLifecycleGroup {
  return getConfiguredLifecycleGroupForDetailProcess(detailProcessId)
}
