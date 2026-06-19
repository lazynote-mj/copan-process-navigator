import type { Lane } from '../types/process'
import lanesConfig from './lanes.json'

export type LanesConfig = {
  id: string
  name: string
  description?: string
  lanes: Lane[]
}

export const overviewLanesConfig = lanesConfig as LanesConfig

/** Overview 공통 스윔레인 (lanes.json) */
export function getOverviewLanes(): Lane[] {
  return [...overviewLanesConfig.lanes].sort((a, b) => a.order - b.order)
}

/** layoutConfig 등에서 lane 이름 순서 참조용 */
export function getOverviewLaneNames(): string[] {
  return getOverviewLanes().map((lane) => lane.name)
}
