import type { Lane } from '../../types/process'
import { projectLane } from '../../lib/executionDomainPresentation'
import {
  getSwimlaneGridConfig,
  scaledGridContentWidth,
  scaledSwimlaneGridTemplateColumns,
  type SwimlaneGridConfig,
} from '../../lib/layout/swimlaneGridLayout'

type OverviewStickyHeaderProps = {
  lanes: Lane[]
  scale: number
  contentWidth?: number
  gridConfig?: SwimlaneGridConfig
  editMode?: boolean
  selectedLaneId?: string | null
  inactiveLaneIds?: Set<string>
  hideZoneColumn?: boolean
  onLaneSelect?: (laneId: string) => void
}

export function OverviewStickyHeader({
  lanes,
  scale,
  contentWidth,
  gridConfig,
  editMode = false,
  selectedLaneId = null,
  inactiveLaneIds,
  hideZoneColumn = false,
  onLaneSelect,
}: OverviewStickyHeaderProps) {
  const grid = gridConfig ?? getSwimlaneGridConfig(hideZoneColumn)
  const sorted = [...lanes].sort((a, b) => a.order - b.order)
  const width = contentWidth ?? scaledGridContentWidth(grid, scale)

  return (
    <div
      className={`overview-sticky-header${editMode ? ' overview-sticky-header--edit' : ''}`}
      style={{
        width,
        gridTemplateColumns: scaledSwimlaneGridTemplateColumns(grid, scale, {
          fillWidth: contentWidth != null,
        }),
      }}
    >
      {!hideZoneColumn && <div className="overview-sticky-header__corner" aria-hidden />}
      {sorted.map((lane) => {
        const isSelected = selectedLaneId === lane.id
        const isInactive = inactiveLaneIds != null && !inactiveLaneIds.has(lane.id)
        // WP6 — Overview는 Execution Domain name만 표시(조직 subtitle 없음). projectLane 정책으로 고정.
        const pres = projectLane(lane, 'overview')
        return (
          <button
            key={lane.id}
            type="button"
            className={`overview-sticky-header__lane${isSelected ? ' overview-sticky-header__lane--selected' : ''}${isInactive ? ' overview-sticky-header__lane--inactive' : ''}`}
            style={{ opacity: isInactive ? 0.45 : 1 }}
            disabled={!editMode || isInactive}
            onClick={() => {
              if (!editMode) return
              onLaneSelect?.(lane.id)
            }}
          >
            <span className="overview-sticky-header__lane-name">{pres.label}</span>
            {pres.subtitle && <span className="overview-sticky-header__lane-dept">{pres.subtitle}</span>}
          </button>
        )
      })}
    </div>
  )
}
