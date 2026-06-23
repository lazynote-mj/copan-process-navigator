import type { RefObject } from 'react'
import { useEffect, useRef } from 'react'
import type { Node as FlowNode } from '@xyflow/react'
import { useReactFlow } from '@xyflow/react'
import type { CanvasBounds, ProcessNodeData } from '../../lib/layout/elkLayout'
import { DETAIL_DOCUMENT } from '../../lib/layout/detailLayoutMetrics'
import { CANVAS_TOP_PADDING } from '../../lib/layout/layoutConfig'
import { swimlaneLaneAreaWidth, type SwimlaneGridConfig } from '../../lib/layout/swimlaneGridLayout'

/** ProcessMapCanvas ReactFlow maxZoom — detail may scale up to fill viewport width */
const DETAIL_FIT_MAX_ZOOM = 1.45

type DetailViewportProps = {
  trigger: string
  nodes: FlowNode<ProcessNodeData>[]
  canvasBounds: CanvasBounds
  gridConfig: SwimlaneGridConfig
  fitWidth?: boolean
  onScaleChange?: (scale: number) => void
  scrollRef?: RefObject<HTMLDivElement | null>
}

/** Process Detail — viewport 너비에 맞춰 scale (panel open 시 scale 유지, 가로 스크롤로 보정). */
export function DetailViewport({
  trigger,
  nodes,
  canvasBounds,
  gridConfig,
  fitWidth = true,
  onScaleChange,
  scrollRef,
}: DetailViewportProps) {
  const { setViewport } = useReactFlow()
  const prevTriggerRef = useRef('')

  useEffect(() => {
    if (!trigger || canvasBounds.width <= 0) return

    const container =
      scrollRef?.current ??
      document.querySelector<HTMLElement>('.process-map-canvas__scroll--detail')
    if (!container) return

    const scaleEl =
      container.closest<HTMLElement>('.process-canvas-container') ??
      container.closest<HTMLElement>('.process-canvas-container__viewport') ??
      container

    const grid = gridConfig

    const initialScrollTop = (scale: number) => {
      if (nodes.length === 0) return 0
      const topNode = [...nodes].sort((a, b) => a.position.y - b.position.y)[0]
      const anchorY = topNode?.position.y ?? CANVAS_TOP_PADDING
      return Math.max(0, anchorY * scale - DETAIL_DOCUMENT.viewportTopOffset)
    }

    const apply = (preserveScroll: boolean) => {
      const { width: vw } = scaleEl.getBoundingClientRect()
      if (vw <= 0) return

      const prevScrollTop = container.scrollTop
      const prevScrollLeft = container.scrollLeft
      const prevScrollHeight = container.scrollHeight
      const prevScrollWidth = container.scrollWidth
      const laneAreaWidth = swimlaneLaneAreaWidth(grid)
      const availableWidth = Math.max(320, vw)
      const nextScale = fitWidth ? Math.min(DETAIL_FIT_MAX_ZOOM, availableWidth / laneAreaWidth) : 1
      onScaleChange?.(nextScale)

      let scrollTop: number
      let scrollLeft: number
      if (preserveScroll && prevScrollHeight > 0) {
        scrollTop = (prevScrollTop / prevScrollHeight) * container.scrollHeight
        scrollLeft =
          prevScrollWidth > 0
            ? (prevScrollLeft / prevScrollWidth) * container.scrollWidth
            : prevScrollLeft
      } else {
        scrollTop = initialScrollTop(nextScale)
        scrollLeft = 0
      }

      container.scrollTop = scrollTop
      container.scrollLeft = scrollLeft
      setViewport(
        {
          x: 0,
          y: -scrollTop / nextScale,
          zoom: nextScale,
        },
        { duration: 0 },
      )
    }

    const isTriggerChange = prevTriggerRef.current !== trigger
    prevTriggerRef.current = trigger
    apply(!isTriggerChange)

    const ro = new ResizeObserver(() => apply(true))
    ro.observe(scaleEl)

    return () => ro.disconnect()
  }, [trigger, canvasBounds, nodes, gridConfig, fitWidth, setViewport, onScaleChange, scrollRef])

  return null
}
