import { useEffect, useRef } from 'react'
import { useReactFlow } from '@xyflow/react'
import type { CanvasBounds } from '../../lib/layout/elkLayout'
import { shouldMapConsumeWheel } from '../../lib/ui/panelEventShield'

type DetailScrollBridgeProps = {
  trigger: string
  canvasBounds: CanvasBounds
  scrollRef: React.RefObject<HTMLDivElement | null>
}

/**
 * Process Detail — 외부 scroll container와 viewport 동기화 (zoom = 1).
 * 세로: flow-sticky 고정 → scrollTop만 viewport.y에 반영.
 * 가로: DOM scroll만 사용, viewport.x = 0.
 */
export function DetailScrollBridge({
  trigger,
  canvasBounds,
  scrollRef,
}: DetailScrollBridgeProps) {
  const { setViewport } = useReactFlow()
  const appliedTriggerRef = useRef('')

  useEffect(() => {
    if (!trigger || canvasBounds.height <= 0) return
    if (appliedTriggerRef.current === trigger) return

    const scrollEl = scrollRef.current
    if (!scrollEl) return

    const syncViewport = () => {
      setViewport(
        {
          x: 0,
          y: -scrollEl.scrollTop,
          zoom: 1,
        },
        { duration: 0 },
      )
    }

    syncViewport()
    scrollEl.addEventListener('scroll', syncViewport, { passive: true })

    const pane = scrollEl.querySelector<HTMLElement>('.react-flow__pane')
    const onWheel = (event: WheelEvent) => {
      if (!shouldMapConsumeWheel(event)) return
      if (event.ctrlKey || event.metaKey) return
      if (Math.abs(event.deltaY) >= Math.abs(event.deltaX)) {
        scrollEl.scrollTop += event.deltaY
      } else {
        scrollEl.scrollLeft += event.deltaX
      }
      event.preventDefault()
    }

    pane?.addEventListener('wheel', onWheel, { passive: false })
    appliedTriggerRef.current = trigger

    return () => {
      scrollEl.removeEventListener('scroll', syncViewport)
      pane?.removeEventListener('wheel', onWheel)
      appliedTriggerRef.current = ''
    }
  }, [trigger, canvasBounds.height, scrollRef, setViewport])

  return null
}
