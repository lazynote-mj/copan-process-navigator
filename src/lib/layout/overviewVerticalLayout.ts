import type { Process } from '../../types/process'
import { getOverviewGridLayout, type OverviewGridLayoutResult } from './overviewGridLayout'

export type OverviewVerticalLayoutResult = OverviewGridLayoutResult

/** @deprecated Overview Cell/Grid layout — getOverviewGridLayout 사용 */
export function getOverviewVerticalLayout(process: Process): OverviewVerticalLayoutResult {
  return getOverviewGridLayout(process)
}

export type { ZoneLayoutBand } from './overviewGridLayout'
