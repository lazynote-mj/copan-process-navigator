import { useMemo, useState } from 'react'
import { BaseEdge, EdgeLabelRenderer, type EdgeProps } from '@xyflow/react'
import type { EdgeType } from '../../../types/edgeTypes'
import { buildEdgeMarkerColor, buildEdgeStrokeStyle, edgeTypeShowsArrow } from '../../../types/edgeTypes'
import type { ProcessEdgeData } from '../../../lib/layout/elkLayout'
import {
  EDGE_ERROR_STROKE,
  EDGE_WARNING_STROKE,
  type EdgeValidationStatus,
} from '../../../lib/layout/edgeRouteValidation'
import { buildEdgeDisplayPath } from './edgeDisplayPath'
import {
  PROCESS_EDGE_MARKER_HEIGHT,
  PROCESS_EDGE_MARKER_PATH,
  PROCESS_EDGE_MARKER_REF_X,
  PROCESS_EDGE_MARKER_REF_Y,
  PROCESS_EDGE_MARKER_VIEWBOX_SIZE,
  PROCESS_EDGE_MARKER_WIDTH,
} from './ProcessEdgeMarkerDefs'
import './edge-bend-handles.css'
import './edge-label-hover.css'

type ProcessEdgeBaseProps = EdgeProps & {
  defaultEdgeType?: EdgeType
  labelOffsetY?: number
}

function resolveValidationStatus(edgeData: ProcessEdgeData | undefined): EdgeValidationStatus {
  if (edgeData?.validationStatus) return edgeData.validationStatus
  if (edgeData?.broken) return 'error'
  return 'ok'
}

export function ProcessEdgeBase({
  id,
  label,
  data,
  style,
  selected,
  defaultEdgeType = 'normal',
  labelOffsetY = -14,
}: ProcessEdgeBaseProps) {
  const [hovered, setHovered] = useState(false)
  const edgeData = data as ProcessEdgeData | undefined
  const edgeType = edgeData?.edgeType ?? defaultEdgeType
  const validationStatus = resolveValidationStatus(edgeData)
  const isError = validationStatus === 'error'
  const isWarning = validationStatus === 'warning'
  const showArrow = edgeTypeShowsArrow(edgeType)
  const edgePath = useMemo(
    () => buildEdgeDisplayPath(edgeData?.elkPath ?? '', edgeData?.pathPoints ?? []),
    [edgeData?.elkPath, edgeData?.pathPoints],
  )
  const pathPoints = edgeData?.pathPoints ?? []
  const labelHidden = edgeData?.labelHidden === true
  const markerId = `process-edge-arrow-${id}`

  const statusStyle = isError
    ? EDGE_ERROR_STROKE
    : isWarning
      ? EDGE_WARNING_STROKE
      : null
  const markerColor = statusStyle?.stroke ?? buildEdgeMarkerColor(edgeType)

  let labelX: number
  let labelY: number
  if (edgeData?.labelPoint) {
    labelX = edgeData.labelPoint.x
    labelY = edgeData.labelPoint.y
  } else if (pathPoints.length >= 2) {
    const mid = pathPoints[Math.floor(pathPoints.length / 2)]
    labelX = mid.x
    labelY = mid.y + labelOffsetY
  } else {
    labelX = 0
    labelY = 0
  }

  const isConditionLabel = edgeType === 'condition' && Boolean(label)
  const showStatusLabel = isError && !label
  const showLabel =
    Boolean(label) &&
    (isConditionLabel || isError || isWarning || !labelHidden || hovered || selected)
  const displayLabel = showStatusLabel ? '⚠' : label

  const baseEdgeStyle = statusStyle ?? buildEdgeStrokeStyle(edgeType)

  return (
    <>
      {showArrow ? (
        <defs>
          <marker
            id={markerId}
            markerUnits="strokeWidth"
            markerWidth={PROCESS_EDGE_MARKER_WIDTH}
            markerHeight={PROCESS_EDGE_MARKER_HEIGHT}
            refX={PROCESS_EDGE_MARKER_REF_X}
            refY={PROCESS_EDGE_MARKER_REF_Y}
            orient="auto"
            viewBox={`0 0 ${PROCESS_EDGE_MARKER_VIEWBOX_SIZE} ${PROCESS_EDGE_MARKER_VIEWBOX_SIZE}`}
          >
            <path d={PROCESS_EDGE_MARKER_PATH} fill={markerColor} stroke="none" />
          </marker>
        </defs>
      ) : null}
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          ...style,
          ...baseEdgeStyle,
          pointerEvents: 'stroke',
        }}
        markerEnd={showArrow ? `url(#${markerId})` : undefined}
        markerStart={undefined}
        interactionWidth={14}
        className={[
          selected ? 'process-edge--selected' : '',
          isError ? 'process-edge--error' : '',
          isWarning ? 'process-edge--warning' : '',
        ]
          .filter(Boolean)
          .join(' ') || undefined}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      />
      {displayLabel && showLabel && (
        <EdgeLabelRenderer>
          <div
            className={`process-edge__label process-edge__label--${edgeType}${isError ? ' process-edge__label--broken' : ''}${labelHidden && !hovered && !selected && !isError && !isWarning ? ' process-edge__label--hover-reveal' : ''}`}
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: 'none',
              zIndex: isConditionLabel ? 30 : 12,
            }}
          >
            {displayLabel}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}

export function NormalEdge(props: EdgeProps) {
  return <ProcessEdgeBase {...props} defaultEdgeType="normal" labelOffsetY={-12} />
}

export function ConditionEdge(props: EdgeProps) {
  return <ProcessEdgeBase {...props} defaultEdgeType="condition" labelOffsetY={-18} />
}

export function SystemEdge(props: EdgeProps) {
  return <ProcessEdgeBase {...props} defaultEdgeType="system" labelOffsetY={-16} />
}

export function CrossLaneEdge(props: EdgeProps) {
  return <ProcessEdgeBase {...props} defaultEdgeType="normal" labelOffsetY={-12} />
}

export function ReturnEdge(props: EdgeProps) {
  return <ProcessEdgeBase {...props} defaultEdgeType="return" labelOffsetY={-20} />
}
