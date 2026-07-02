import { useCallback, useMemo, useRef, useState } from 'react'
import { BaseEdge, EdgeLabelRenderer, useReactFlow, type EdgeProps } from '@xyflow/react'
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
import { EdgeBendHandles } from './EdgeBendHandles'
import { useEdgeEditContext } from './EdgeEditContext'
import './edge-bend-handles.css'
import './edge-label-hover.css'

type ProcessEdgeBaseProps = EdgeProps & {
  defaultEdgeType?: EdgeType
  labelOffsetY?: number
}

const EDGE_LABEL_MIN_WRAP_CHARS = 14
const EDGE_LABEL_MAX_WIDTH = 180

function pointerCapture(target: HTMLDivElement, pointerId: number) {
  try {
    target.setPointerCapture(pointerId)
  } catch {
    // The label can be re-rendered while React Flow updates its portal layer.
  }
}

function releasePointerCapture(target: HTMLDivElement, pointerId: number) {
  try {
    if (target.hasPointerCapture(pointerId)) target.releasePointerCapture(pointerId)
  } catch {
    // Ignore stale pointer capture after the label portal has changed.
  }
}

function isFinitePoint(point: { x: number; y: number } | null | undefined): point is { x: number; y: number } {
  return Boolean(point && Number.isFinite(point.x) && Number.isFinite(point.y))
}

function getLabelText(label: EdgeProps['label']): string {
  return typeof label === 'string' || typeof label === 'number' ? String(label) : ''
}

function resolveLabelMaxWidth(label: EdgeProps['label'], measuredWidth?: number): number | undefined {
  const text = getLabelText(label).trim()
  if (!text) return undefined
  if (text.length < EDGE_LABEL_MIN_WRAP_CHARS && (!measuredWidth || measuredWidth < EDGE_LABEL_MAX_WIDTH)) {
    return undefined
  }
  return Math.min(EDGE_LABEL_MAX_WIDTH, Math.max(72, measuredWidth ?? EDGE_LABEL_MAX_WIDTH))
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
  const [draggingLabel, setDraggingLabel] = useState(false)
  const [draftLabelPoint, setDraftLabelPoint] = useState<{ x: number; y: number } | null>(null)
  const draftLabelPointRef = useRef(draftLabelPoint)
  draftLabelPointRef.current = draftLabelPoint
  const dragStartPointRef = useRef<{ x: number; y: number } | null>(null)
  const { appMode, onEdgeSelect, onEdgeLabelPlacementChange } = useEdgeEditContext()
  const { screenToFlowPosition } = useReactFlow()
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
  const sourceHandle = edgeData?.sourceHandle ?? 'bottom'
  const targetHandle = edgeData?.targetHandle ?? 'top'
  const labelHidden = edgeData?.labelHidden === true
  const groupFocus = edgeData?.groupFocus === true
  const groupDimmed = edgeData?.groupDimmed === true
  const groupHighlighted = edgeData?.groupHighlighted === true
  const markerId = `process-edge-arrow-${id}`

  const statusStyle = isError
    ? EDGE_ERROR_STROKE
    : isWarning
      ? EDGE_WARNING_STROKE
      : null
  const markerColor = statusStyle?.stroke ?? buildEdgeMarkerColor(edgeType)
  const canDragLabel = appMode === 'edit' && !edgeData?.readOnly

  let labelX: number
  let labelY: number
  if (isFinitePoint(draftLabelPoint)) {
    labelX = draftLabelPoint.x
    labelY = draftLabelPoint.y
  } else if (isFinitePoint(edgeData?.labelPoint)) {
    labelX = edgeData.labelPoint.x
    labelY = edgeData.labelPoint.y
  } else if (pathPoints.length >= 2) {
    const mid = pathPoints[Math.floor(pathPoints.length / 2)]
    labelX = Number.isFinite(mid.x) ? mid.x : 0
    labelY = Number.isFinite(mid.y) ? mid.y + labelOffsetY : 0
  } else {
    labelX = 0
    labelY = 0
  }

  const isConditionLabel = edgeType === 'condition' && Boolean(label)
  const isApiLabel = edgeType === 'api' && Boolean(label)
  const forceVisibleLabel = Boolean(label)
  const showStatusLabel = isError && !label
  const displayLabel = showStatusLabel ? '⚠' : label
  const labelMaxWidth = resolveLabelMaxWidth(displayLabel, edgeData?.labelRect?.width)
  const allowGroupLabel = forceVisibleLabel || !groupDimmed || groupFocus || hovered || selected
  const showLabel =
    Boolean(displayLabel) &&
    allowGroupLabel &&
    (groupFocus ||
      groupHighlighted ||
      forceVisibleLabel ||
      (!groupDimmed && (isConditionLabel || isApiLabel)) ||
      isError ||
      isWarning ||
      !labelHidden ||
      hovered ||
      selected)

  const baseEdgeStyle = statusStyle ?? buildEdgeStrokeStyle(edgeType)

  const handleLabelPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!canDragLabel) return
      event.stopPropagation()
      event.preventDefault()
      setDraggingLabel(true)
      const point = { x: labelX, y: labelY }
      dragStartPointRef.current = point
      setDraftLabelPoint(point)
      pointerCapture(event.currentTarget, event.pointerId)
    },
    [canDragLabel, labelX, labelY],
  )

  const handleLabelPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!draggingLabel) return
      event.stopPropagation()
      if (!Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) return
      const flowPos = screenToFlowPosition({ x: event.clientX, y: event.clientY })
      if (!isFinitePoint(flowPos)) return
      setDraftLabelPoint({ x: Math.round(flowPos.x), y: Math.round(flowPos.y) })
    },
    [draggingLabel, screenToFlowPosition],
  )

  const handleLabelPointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!draggingLabel) return
      event.stopPropagation()
      releasePointerCapture(event.currentTarget, event.pointerId)
      setDraggingLabel(false)
      const point = draftLabelPointRef.current
      const dragStart = dragStartPointRef.current
      dragStartPointRef.current = null
      setDraftLabelPoint(null)
      if (!point || (dragStart && point.x === dragStart.x && point.y === dragStart.y)) {
        onEdgeSelect(id)
        return
      }
      if (isFinitePoint(point)) {
        const routePoint = edgeData?.routeLabelPoint
        onEdgeLabelPlacementChange(
          id,
          isFinitePoint(routePoint)
            ? {
                offset: {
                  x: point.x - routePoint.x,
                  y: point.y - routePoint.y,
                },
              }
            : { point },
        )
      }
    },
    [draggingLabel, edgeData?.routeLabelPoint, id, onEdgeLabelPlacementChange, onEdgeSelect],
  )

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
          ...baseEdgeStyle,
          ...style,
          pointerEvents: 'stroke',
        }}
        markerEnd={showArrow ? `url(#${markerId})` : undefined}
        markerStart={undefined}
        interactionWidth={14}
        className={[
          selected ? 'process-edge--selected' : '',
          isError ? 'process-edge--error' : '',
          isWarning ? 'process-edge--warning' : '',
          groupDimmed ? 'process-edge--group-dimmed' : '',
          groupHighlighted ? 'process-edge--group-highlighted' : '',
          groupFocus ? 'process-edge--group-focus' : '',
        ]
          .filter(Boolean)
          .join(' ') || undefined}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      />
      <EdgeBendHandles
        edgeId={id}
        pathPoints={pathPoints}
        sourceHandle={sourceHandle}
        targetHandle={targetHandle}
        routingMode={edgeData?.routingMode ?? 'auto'}
        selected={selected}
      />
      {displayLabel && showLabel && (
        <EdgeLabelRenderer>
          <div
            className={`nodrag nopan process-edge__label process-edge__label--${edgeType}${isError ? ' process-edge__label--broken' : ''}${groupDimmed ? ' process-edge__label--group-dimmed' : ''}${labelHidden && !forceVisibleLabel && !hovered && !selected && !isError && !isWarning ? ' process-edge__label--hover-reveal' : ''}`}
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: canDragLabel ? 'all' : 'none',
              zIndex: forceVisibleLabel ? 30 : 12,
              ...(labelMaxWidth ? { maxWidth: labelMaxWidth } : {}),
            }}
            onPointerDown={handleLabelPointerDown}
            onPointerMove={handleLabelPointerMove}
            onPointerUp={handleLabelPointerUp}
            onPointerCancel={handleLabelPointerUp}
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
