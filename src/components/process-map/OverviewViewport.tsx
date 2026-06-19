import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'
import { useReactFlow } from '@xyflow/react'
import type { CanvasBounds } from '../../lib/layout/elkLayout'
import { gridContentWidth, OVERVIEW_SWIMLANE_GRID } from '../../lib/layout/swimlaneGridLayout'

type OverviewViewportProps = {
  trigger: string
  canvasBounds: CanvasBounds
  onScaleChange?: (scale: number) => void
  scrollRef?: RefObject<HTMLDivElement | null>
}

/** Overview — width 기준 scale. Panel open으로 인한 viewport 축소는 무시(부모 viewport 기준). */
export function OverviewViewport({
  trigger,
  canvasBounds,
  onScaleChange,
  scrollRef,
}: OverviewViewportProps) {
  const { setViewport } = useReactFlow()

  const prevTriggerRef = useRef<string>('')

  useEffect(() => {
    if (!trigger || canvasBounds.width <= 0) return

    const container = scrollRef?.current ?? document.querySelector<HTMLElement>(
      '.process-map-canvas--overview .process-map-canvas__scroll',
    )
    if (!container) return

    const scaleEl =
      container.closest<HTMLElement>('.process-canvas-container')
      ?? container.closest<HTMLElement>('.process-canvas-container__viewport')
      ?? container

    const apply = (preserveScroll: boolean) => {
      const { width: vw } = scaleEl.getBoundingClientRect()
      if (vw <= 0) return

      const prevScrollTop = container.scrollTop
      const prevScrollHeight = container.scrollHeight
      const layoutWidth = Math.max(canvasBounds.width, gridContentWidth(OVERVIEW_SWIMLANE_GRID))

      const nextScale = Math.min(1, vw / layoutWidth)
      onScaleChange?.(nextScale)

      if (preserveScroll && prevScrollHeight > 0) {
        const ratio = prevScrollTop / prevScrollHeight
        window.requestAnimationFrame(() => {
          container.scrollTop = ratio * container.scrollHeight
          setViewport(
            {
              x: 0,
              y: -container.scrollTop / nextScale,
              zoom: nextScale,
            },
            { duration: 0 },
          )
        })
      } else {
        container.scrollTop = 0
        container.scrollLeft = 0
        setViewport({ x: 0, y: 0, zoom: nextScale }, { duration: 0 })
      }
    }

    const isTriggerChange = prevTriggerRef.current !== trigger
    prevTriggerRef.current = trigger
    apply(!isTriggerChange)

    const ro = new ResizeObserver(() => apply(true))
    ro.observe(scaleEl)

    return () => ro.disconnect()
  }, [trigger, canvasBounds, setViewport, onScaleChange, scrollRef])

  return null
}
