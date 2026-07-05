import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { EdgeLabelRenderer, useReactFlow } from '@xyflow/react'
import type { EdgeHandleId } from '../../../types/process'
import {
  extractBendPoints,
  simplifyPath,
  snapBendDrag,
  updateManualRoutingPoints,
  type Point,
} from '../../../lib/layout/orthogonalEdgeRouter'
import { useEdgeEditContext } from './EdgeEditContext'
import './edge-bend-handles.css'

type EdgeBendHandlesProps = {
  edgeId: string
  pathPoints: Point[]
  sourceHandle: EdgeHandleId
  targetHandle: EdgeHandleId
  routingMode?: 'auto' | 'manual'
  selected?: boolean
}

export function EdgeBendHandles({
  edgeId,
  pathPoints,
  sourceHandle,
  targetHandle,
  routingMode = 'auto',
  selected,
}: EdgeBendHandlesProps) {
  const { appMode, selectedEdgeId, onEdgeRoutingChange } = useEdgeEditContext()
  const { screenToFlowPosition } = useReactFlow()
  const [dragIndex, setDragIndex] = useState<number | null>(null)

  const simplifiedPath = useMemo(() => simplifyPath(pathPoints), [pathPoints])
  const bendPoints = useMemo(() => extractBendPoints(pathPoints), [pathPoints])
  const [draftBends, setDraftBends] = useState<Point[]>(bendPoints)
  const draftRef = useRef(draftBends)
  useEffect(() => {
    draftRef.current = draftBends
  }, [draftBends])

  // 경로가 바뀌면 draft를 재계산된 bend로 재설정 (render 중 상태 조정 패턴)
  const [prevBendPoints, setPrevBendPoints] = useState(bendPoints)
  if (prevBendPoints !== bendPoints) {
    setPrevBendPoints(bendPoints)
    setDraftBends(bendPoints)
  }

  const commitBends = useCallback(
    (nextBends: Point[]) => {
      onEdgeRoutingChange({
        edgeId,
        routing: updateManualRoutingPoints(undefined, nextBends, sourceHandle, targetHandle),
      })
    },
    [edgeId, onEdgeRoutingChange, sourceHandle, targetHandle],
  )

  const handlePointerMove = useCallback(
    (event: React.PointerEvent) => {
      if (dragIndex === null) return
      const flowPos = screenToFlowPosition({ x: event.clientX, y: event.clientY })
      const prev = simplifiedPath[dragIndex]
      const next = simplifiedPath[dragIndex + 2]
      if (!prev || !next) return
      setDraftBends((currentBends) => {
        const current = currentBends[dragIndex]
        if (!current) return currentBends
        const snapped = snapBendDrag(current, prev, next, flowPos)
        return currentBends.map((point, index) => (index === dragIndex ? snapped : point))
      })
    },
    [dragIndex, screenToFlowPosition, simplifiedPath],
  )

  const handlePointerUp = useCallback(
    (event: React.PointerEvent) => {
      if (dragIndex === null) return
      event.stopPropagation()
      setDragIndex(null)
      commitBends(draftRef.current)
    },
    [commitBends, dragIndex],
  )

  if (
    routingMode !== 'manual' ||
    appMode !== 'edit' ||
    !selected ||
    selectedEdgeId !== edgeId ||
    draftBends.length === 0
  ) {
    return null
  }

  return (
    <EdgeLabelRenderer>
      <div
        className="edge-bend-handles"
        onPointerMove={dragIndex !== null ? handlePointerMove : undefined}
        onPointerUp={dragIndex !== null ? handlePointerUp : undefined}
      >
        {draftBends.map((point, index) => (
          <svg
            key={`${edgeId}-bend-${index}`}
            className="edge-bend-handles__svg"
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${point.x}px, ${point.y}px)`,
              overflow: 'visible',
              pointerEvents: 'none',
            }}
          >
            <circle
              className="edge-bend-handles__point"
              cx={0}
              cy={0}
              r={6}
              style={{ pointerEvents: 'all' }}
              onPointerDown={(event) => {
                event.stopPropagation()
                setDragIndex(index)
                event.currentTarget.setPointerCapture(event.pointerId)
              }}
            />
          </svg>
        ))}
      </div>
    </EdgeLabelRenderer>
  )
}
