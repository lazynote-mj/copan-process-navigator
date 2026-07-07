import { useViewport } from '@xyflow/react'
import type { MouseEvent } from 'react'
import { CANVAS_TOP_PADDING } from '../../lib/layout/layoutConfig'
import { OVERVIEW_GRID_METRICS } from '../../lib/layout/overviewGridMetrics'
import type { CanvasBounds, LaneBand } from '../../lib/layout/elkLayout'
import type { ZoneLayoutBand } from '../../lib/layout/overviewGridLayout'

type SwimlaneOverlayProps = {
  laneBands: LaneBand[]
  canvasBounds: CanvasBounds
  layoutOrientation?: 'horizontal' | 'vertical'
  zoneBands?: ZoneLayoutBand[]
  hideLaneHeader?: boolean
  hideZoneColumn?: boolean
  editMode?: boolean
  selectedLaneId?: string | null
  selectedOverviewZoneId?: string | null
  onLaneSelect?: (laneId: string) => void
  onOverviewZoneSelect?: (zoneId: string) => void
}

export function SwimlaneOverlay({
  laneBands,
  canvasBounds,
  layoutOrientation = 'horizontal',
  zoneBands = [],
  hideLaneHeader = false,
  hideZoneColumn = false,
  editMode = false,
  selectedLaneId = null,
  selectedOverviewZoneId = null,
  onLaneSelect,
  onOverviewZoneSelect,
}: SwimlaneOverlayProps) {
  const { x, y, zoom } = useViewport()

  if (laneBands.length === 0) return null

  if (layoutOrientation === 'vertical') {
    return (
      <VerticalSwimlaneOverlay
        laneBands={laneBands}
        canvasBounds={canvasBounds}
        zoneBands={zoneBands}
        hideLaneHeader={hideLaneHeader}
        hideZoneColumn={hideZoneColumn}
        viewport={{ x, y, zoom }}
        editMode={editMode}
        selectedLaneId={selectedLaneId}
        selectedOverviewZoneId={selectedOverviewZoneId}
        onLaneSelect={onLaneSelect}
        onOverviewZoneSelect={onOverviewZoneSelect}
      />
    )
  }

  return (
    <HorizontalSwimlaneOverlay
      laneBands={laneBands}
      canvasBounds={canvasBounds}
      viewport={{ x, y, zoom }}
      editMode={editMode}
      selectedLaneId={selectedLaneId}
      onLaneSelect={onLaneSelect}
    />
  )
}

type ViewportTransform = { x: number; y: number; zoom: number }

function VerticalSwimlaneOverlay({
  laneBands,
  canvasBounds,
  zoneBands,
  hideLaneHeader,
  hideZoneColumn,
  viewport,
  editMode,
  selectedLaneId,
  selectedOverviewZoneId,
  onLaneSelect,
  onOverviewZoneSelect,
}: {
  laneBands: LaneBand[]
  canvasBounds: CanvasBounds
  zoneBands: ZoneLayoutBand[]
  hideLaneHeader: boolean
  hideZoneColumn: boolean
  viewport: ViewportTransform
  editMode: boolean
  selectedLaneId: string | null
  selectedOverviewZoneId: string | null
  onLaneSelect?: (laneId: string) => void
  onOverviewZoneSelect?: (zoneId: string) => void
}) {
  const metrics = OVERVIEW_GRID_METRICS
  const headerHeight = hideLaneHeader ? 0 : metrics.laneHeaderHeight
  const headerTop = CANVAS_TOP_PADDING
  const contentTop = headerTop + headerHeight
  const contentBottom = laneBands[0].y + laneBands[0].height
  const zoneLabelWidth = hideZoneColumn ? 0 : metrics.zoneLabelColumnWidth

  return (
    <svg
      className="swimlane-overlay swimlane-overlay--vertical"
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        overflow: 'visible',
      }}
    >
      <g transform={`translate(${viewport.x},${viewport.y}) scale(${viewport.zoom})`}>
        {!hideLaneHeader && (
          <>
            <rect
              x={0}
              y={headerTop}
              width={canvasBounds.width}
              height={headerHeight}
              fill="rgba(248,250,252,0.95)"
              stroke="#cbd5e1"
              strokeWidth={1}
            />
            {!hideZoneColumn && (
              <rect
                x={0}
                y={headerTop}
                width={zoneLabelWidth}
                height={headerHeight}
                fill="#f8fafc"
                stroke="#cbd5e1"
                strokeWidth={1}
              />
            )}
          </>
        )}

        {!hideZoneColumn &&
          zoneBands.map((zone, index) => {
            const isSelected = selectedOverviewZoneId === zone.zoneId
            const handleZoneSelect =
              editMode && onOverviewZoneSelect
                ? (event: MouseEvent) => {
                    event.stopPropagation()
                    onOverviewZoneSelect(zone.zoneId)
                  }
                : undefined

            return (
          <g key={zone.zoneId} className={isSelected ? 'swimlane-overlay__zone--selected' : undefined}>
            {laneBands.map((band) => (
              <rect
                key={`${zone.zoneId}-${band.laneId}`}
                x={band.x}
                y={zone.y}
                width={band.width}
                height={zone.height}
                fill="transparent"
                stroke="#e2e8f0"
                strokeWidth={1}
              />
            ))}
            <rect
              className="swimlane-overlay__zone-label-hit"
              x={0}
              y={zone.y}
              width={zoneLabelWidth}
              height={zone.height}
              fill={isSelected ? 'rgba(37,99,235,0.1)' : 'rgba(241,245,249,0.85)'}
              stroke={isSelected ? '#2563eb' : '#e2e8f0'}
              strokeWidth={isSelected ? 2 : 1}
              onClick={handleZoneSelect}
              style={{ cursor: editMode ? 'pointer' : undefined, pointerEvents: editMode ? 'auto' : 'none' }}
            />
            <text
              className="swimlane-overlay__zone-label"
              x={zoneLabelWidth / 2}
              y={zone.y + zone.height / 2}
              fill={isSelected ? '#2563eb' : '#334155'}
              fontSize={10}
              fontWeight={700}
              textAnchor="middle"
              dominantBaseline="middle"
              pointerEvents={editMode ? 'auto' : 'none'}
              style={{ cursor: editMode ? 'pointer' : undefined }}
              onClick={handleZoneSelect}
            >
              {zone.label.split('·').map((part, i) => (
                <tspan key={`${zone.zoneId}-${i}`} x={zoneLabelWidth / 2} dy={i === 0 ? 0 : 11}>
                  {part.trim()}
                </tspan>
              ))}
            </text>
            {index < zoneBands.length - 1 && (
              <line
                x1={0}
                x2={canvasBounds.width}
                y1={zone.bottom + metrics.zoneGap / 2}
                y2={zone.bottom + metrics.zoneGap / 2}
                stroke="#cbd5e1"
                strokeWidth={1}
                strokeDasharray="6 4"
              />
            )}
          </g>
            )
          })}

        {!hideZoneColumn && zoneLabelWidth > 0 && (
          <line
            x1={zoneLabelWidth}
            x2={zoneLabelWidth}
            y1={headerTop}
            y2={contentBottom}
            stroke="#94a3b8"
            strokeWidth={1.5}
          />
        )}

        {laneBands.map((band, index) => {
          const isSelected = selectedLaneId === band.laneId
          const isInactive = band.inactive === true
          const bodyFill = isInactive
            ? 'rgba(241,245,249,0.35)'
            : index % 2 === 0
              ? 'rgba(248,250,252,0.55)'
              : 'rgba(241,245,249,0.35)'
          const strokeColor = isInactive ? '#e2e8f0' : '#e2e8f0'

          return (
            <g
              key={band.laneId}
              className={isInactive ? 'swimlane-overlay__lane--inactive' : undefined}
              opacity={isInactive ? 0.25 : 1}
            >
              <rect
                x={band.x}
                y={contentTop}
                width={band.width}
                height={contentBottom - contentTop}
                fill={bodyFill}
                stroke={strokeColor}
                strokeWidth={1}
              />
              {!hideLaneHeader && (
                <>
                  <rect
                    className="swimlane-overlay__lane-header"
                    x={band.x}
                    y={headerTop}
                    width={band.width}
                    height={headerHeight}
                    fill={
                      isInactive
                        ? 'rgba(248,250,252,0.5)'
                        : isSelected
                          ? 'rgba(37,99,235,0.12)'
                          : '#ffffff'
                    }
                    stroke={isSelected && !isInactive ? '#2563eb' : '#cbd5e1'}
                    strokeWidth={isSelected && !isInactive ? 2 : 1}
                    style={{
                      cursor: editMode && !isInactive ? 'pointer' : undefined,
                      pointerEvents: editMode && !isInactive ? 'auto' : 'none',
                    }}
                    onClick={(event) => {
                      if (!editMode || isInactive) return
                      event.stopPropagation()
                      onLaneSelect?.(band.laneId)
                    }}
                  />
                  <text
                    x={band.x + band.width / 2}
                    y={headerTop + headerHeight / 2 - 2}
                    fill={isInactive ? '#94a3b8' : '#0f172a'}
                    fontSize={12}
                    fontWeight={700}
                    textAnchor="middle"
                  >
                    {band.laneName}
                  </text>
                  <text
                    x={band.x + band.width / 2}
                    y={headerTop + headerHeight / 2 + 13}
                    fill={isInactive ? '#cbd5e1' : '#64748b'}
                    fontSize={9.5}
                    textAnchor="middle"
                  >
                    {band.ownerDepartment}
                  </text>
                </>
              )}
              {index < laneBands.length - 1 && (
                <line
                  x1={band.x + band.width}
                  x2={band.x + band.width}
                  y1={headerTop}
                  y2={contentBottom}
                  stroke="#94a3b8"
                  strokeWidth={1.5}
                />
              )}
            </g>
          )
        })}

        {!hideLaneHeader && (
          <line
            x1={0}
            x2={canvasBounds.width}
            y1={contentTop}
            y2={contentTop}
            stroke="#94a3b8"
            strokeWidth={1.5}
          />
        )}
      </g>
    </svg>
  )
}

function HorizontalSwimlaneOverlay({
  laneBands,
  canvasBounds,
  viewport,
  editMode,
  selectedLaneId,
  onLaneSelect,
}: {
  laneBands: LaneBand[]
  canvasBounds: CanvasBounds
  viewport: ViewportTransform
  editMode: boolean
  selectedLaneId: string | null
  onLaneSelect?: (laneId: string) => void
}) {
  const canvasWidth = canvasBounds.width
  const topY = laneBands[0].y
  const bottomY = laneBands[laneBands.length - 1].y + laneBands[laneBands.length - 1].height
  const totalLaneHeight = bottomY - topY
  const LANE_HEADER_WIDTH = 160

  return (
    <>
    <svg
      className="swimlane-overlay"
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        overflow: 'visible',
      }}
    >
      <g transform={`translate(${viewport.x},${viewport.y}) scale(${viewport.zoom})`}>
        <rect
          x={0}
          y={topY}
          width={LANE_HEADER_WIDTH}
          height={totalLaneHeight}
          fill="#ffffff"
          stroke="#94a3b8"
          strokeWidth={1.5}
        />

        {laneBands.map((band, index) => {
          const isSelected = selectedLaneId === band.laneId
          return (
            <g key={band.laneId}>
              <rect
                x={band.x}
                y={band.y}
                width={canvasWidth}
                height={band.height}
                fill={index % 2 === 0 ? 'rgba(248,250,252,0.55)' : 'rgba(241,245,249,0.35)'}
                stroke="#e2e8f0"
                strokeWidth={1}
              />
              <rect
                className="swimlane-overlay__lane-header"
                x={0}
                y={band.y}
                width={LANE_HEADER_WIDTH}
                height={band.height}
                fill={isSelected ? 'rgba(37,99,235,0.12)' : 'transparent'}
                stroke={isSelected ? '#2563eb' : 'transparent'}
                strokeWidth={isSelected ? 2 : 0}
                style={{
                  cursor: editMode ? 'pointer' : undefined,
                  pointerEvents: editMode ? 'auto' : 'none',
                }}
                onClick={(event) => {
                  if (!editMode) return
                  event.stopPropagation()
                  onLaneSelect?.(band.laneId)
                }}
              />
              <text x={14} y={band.y + band.height / 2 - 2} fill="#0f172a" fontSize={12} fontWeight={700}>
                {band.laneName}
              </text>
              <text x={14} y={band.y + band.height / 2 + 13} fill="#64748b" fontSize={9.5}>
                {band.ownerDepartment}
              </text>
              {index < laneBands.length - 1 && (
                <line
                  x1={0}
                  x2={canvasWidth}
                  y1={band.y + band.height}
                  y2={band.y + band.height}
                  stroke="#cbd5e1"
                  strokeWidth={1.5}
                />
              )}
            </g>
          )
        })}

        <line
          x1={LANE_HEADER_WIDTH}
          x2={LANE_HEADER_WIDTH}
          y1={topY}
          y2={bottomY}
          stroke="#94a3b8"
          strokeWidth={1.5}
        />
      </g>
    </svg>
    {editMode ? (
      // React Flow pane이 배경 오버레이 위에 있어 클릭을 가로채므로,
      // 노드가 없는 헤더 컬럼(x < LANE_HEADER_WIDTH)에만 pane 위 클릭 레이어를 얹는다.
      <svg
        className="swimlane-overlay swimlane-overlay--lane-hit"
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          overflow: 'visible',
          zIndex: 5,
        }}
      >
        <g transform={`translate(${viewport.x},${viewport.y}) scale(${viewport.zoom})`}>
          {laneBands.map((band) => (
            <rect
              key={band.laneId}
              x={0}
              y={band.y}
              width={LANE_HEADER_WIDTH}
              height={band.height}
              fill="transparent"
              style={{ cursor: 'pointer', pointerEvents: 'auto' }}
              onClick={(event) => {
                event.stopPropagation()
                onLaneSelect?.(band.laneId)
              }}
            />
          ))}
        </g>
      </svg>
    ) : null}
    </>
  )
}
