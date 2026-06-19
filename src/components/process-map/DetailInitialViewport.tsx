import { useEffect, useRef } from 'react'
import { useReactFlow } from '@xyflow/react'
import type { Node as FlowNode } from '@xyflow/react'
import type { CanvasBounds, ProcessNodeData } from '../../lib/layout/elkLayout'
import { DETAIL_DOCUMENT } from '../../lib/layout/detailLayoutMetrics'
import { CANVAS_TOP_PADDING } from '../../lib/layout/layoutConfig'

const INITIAL_ZOOM = 1

type DetailInitialViewportProps = {
  trigger: string
  nodes: FlowNode<ProcessNodeData>[]
  canvasBounds: CanvasBounds
  scrollRef: React.RefObject<HTMLDivElement | null>
}

/**
 * Process Detail — zoom 100%, 첫 node가 화면 상단 100px 아래, 문서 영역 가로 중앙.
 * trigger(레이아웃) 변경 시 1회만 적용 — 노드 선택 등으로 nodes가 바뀌어도 viewport는 유지.
 */
export function DetailInitialViewport({
  trigger,
  nodes,
  canvasBounds,
  scrollRef,
}: DetailInitialViewportProps) {
  const { setViewport } = useReactFlow()
  const appliedTriggerRef = useRef('')

  useEffect(() => {
    if (!trigger || nodes.length === 0) return
    if (appliedTriggerRef.current === trigger) return

    const timer = window.setTimeout(() => {
      const scrollEl = scrollRef.current
      const container = document.querySelector('.process-map-canvas')
      if (!container) return

      const sorted = [...nodes].sort((a, b) => {
        const orderA = a.data?.localOrder ?? 999
        const orderB = b.data?.localOrder ?? 999
        if (orderA !== orderB) return orderA - orderB
        return a.position.y - b.position.y
      })

      const first = sorted[0]
      const anchorY = first?.position.y ?? CANVAS_TOP_PADDING

      const scrollTop = Math.max(0, anchorY - DETAIL_DOCUMENT.viewportTopOffset)

      if (scrollEl) {
        scrollEl.scrollTop = scrollTop
        scrollEl.scrollLeft = 0
      }

      setViewport(
        {
          x: 0,
          y: -scrollTop,
          zoom: INITIAL_ZOOM,
        },
        { duration: 0 },
      )

      appliedTriggerRef.current = trigger
    }, 40)

    return () => window.clearTimeout(timer)
  }, [trigger, canvasBounds, scrollRef, setViewport])

  return null
}
