import { useEffect, useRef } from 'react'
import { useReactFlow } from '@xyflow/react'
import { shouldMapConsumeWheel } from '../../lib/ui/panelEventShield'

type DetailScrollBridgeProps = {
  trigger: string
  scale: number
  contentHeight: number
  scrollRef: React.RefObject<HTMLDivElement | null>
}

/**
 * Process Detail — 외부 scroll container와 viewport 동기화.
 * 세로: flow-sticky 고정 → scrollTop → viewport.y (scale 반영).
 * 가로: scroll-content DOM scroll (panel open padding-right) — viewport.x = 0.
 */
export function DetailScrollBridge({
  trigger,
  scale,
  contentHeight,
  scrollRef,
}: DetailScrollBridgeProps) {
  const { setViewport } = useReactFlow()
  const scaleRef = useRef(scale)

  useEffect(() => {
    scaleRef.current = scale
  }, [scale])

  useEffect(() => {
    const scrollEl = scrollRef.current
    if (!scrollEl || contentHeight <= 0) return

    const syncViewport = () => {
      const currentScale = scaleRef.current
      if (currentScale <= 0) return
      setViewport(
        {
          x: 0,
          y: -scrollEl.scrollTop / currentScale,
          zoom: currentScale,
        },
        { duration: 0 },
      )
    }

    const pane = scrollEl.querySelector<HTMLElement>('.react-flow__pane')
    const onWheel = (event: WheelEvent) => {
      if (!shouldMapConsumeWheel(event)) return
      if (event.ctrlKey || event.metaKey) return
      if (event.shiftKey && event.deltaY !== 0) {
        scrollEl.scrollLeft += event.deltaY
      } else if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
        scrollEl.scrollLeft += event.deltaX
      } else {
        scrollEl.scrollTop += event.deltaY
      }
      event.preventDefault()
    }

    syncViewport()
    scrollEl.addEventListener('scroll', syncViewport, { passive: true })
    pane?.addEventListener('wheel', onWheel, { passive: false })

    return () => {
      scrollEl.removeEventListener('scroll', syncViewport)
      pane?.removeEventListener('wheel', onWheel)
    }
  }, [trigger, contentHeight, scrollRef, setViewport])

  useEffect(() => {
    const scrollEl = scrollRef.current
    if (!scrollEl || scale <= 0) return

    setViewport(
      {
        x: 0,
        y: -scrollEl.scrollTop / scale,
        zoom: scale,
      },
      { duration: 0 },
    )
  }, [scale, scrollRef, setViewport])

  return null
}
