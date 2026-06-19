import { useViewport } from '@xyflow/react'
import type { MouseEvent } from 'react'
import type { Node as FlowNode } from '@xyflow/react'
import type { Process } from '../../types/process'
import { computeProcessZoneRects, resolveZoneLabelY, resolveZonePadding } from '../../lib/layout/processZoneLayout'
import './process-zone-overlay.css'

type ProcessZoneOverlayProps = {
  process: Process
  flowNodes: FlowNode[]
  selectedZoneId?: string | null
  editMode?: boolean
  onZoneSelect?: (zoneId: string) => void
}

export function ProcessZoneOverlay({
  process,
  flowNodes,
  selectedZoneId,
  editMode = false,
  onZoneSelect,
}: ProcessZoneOverlayProps) {
  const { x, y, zoom } = useViewport()
  const rects = computeProcessZoneRects(process, flowNodes)

  if (rects.length === 0) return null

  return (
    <svg
      className="process-zone-overlay"
      aria-hidden={!editMode}
    >
      <g transform={`translate(${x},${y}) scale(${zoom})`}>
      {rects.map((rect) => {
        const selected = selectedZoneId === rect.zoneId
        const { style } = rect
        const zoneDef = process.zones?.find((zone) => zone.id === rect.zoneId)
        const { headerHeight } = zoneDef ? resolveZonePadding(zoneDef) : { headerHeight: 36 }
        const labelY = resolveZoneLabelY(rect, headerHeight)

        const handleSelect =
          editMode && onZoneSelect
            ? (e: MouseEvent) => {
                e.stopPropagation()
                onZoneSelect(rect.zoneId)
              }
            : undefined

        return (
          <g key={rect.zoneId} className={`process-zone-group${selected ? ' is-selected' : ''}`}>
            {style.showBackground && (
              <rect
                className="process-zone-fill"
                x={rect.x}
                y={rect.y}
                width={rect.width}
                height={rect.height}
                rx={8}
                ry={8}
                fill={style.fill}
                fillOpacity={style.opacity}
                pointerEvents="none"
              />
            )}
            {style.showBorder && (
              <rect
                className="process-zone-border"
                x={rect.x}
                y={rect.y}
                width={rect.width}
                height={rect.height}
                rx={8}
                ry={8}
                fill="none"
                stroke={style.stroke}
                strokeWidth={selected ? 2 : 1.5}
                strokeDasharray={style.borderStyle === 'dashed' ? '8 4' : undefined}
                pointerEvents="none"
              />
            )}
            {editMode && (
              <rect
                className="process-zone-hit"
                x={rect.x}
                y={rect.y}
                width={rect.width}
                height={rect.height}
                rx={8}
                ry={8}
                fill="transparent"
                style={{ cursor: 'pointer' }}
                onClick={handleSelect}
              />
            )}
            <text
              className="process-zone-label"
              x={rect.x + rect.width / 2}
              y={labelY}
              textAnchor="middle"
              pointerEvents={editMode ? 'auto' : 'none'}
              style={{ cursor: editMode ? 'pointer' : undefined }}
              onClick={handleSelect}
            >
              {rect.name}
            </text>
          </g>
        )
      })}
      </g>
    </svg>
  )
}
