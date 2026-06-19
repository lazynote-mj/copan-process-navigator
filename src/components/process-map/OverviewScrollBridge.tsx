import { useEffect, useRef } from 'react'
import { useReactFlow } from '@xyflow/react'
import { shouldMapConsumeWheel } from '../../lib/ui/panelEventShield'

type OverviewScrollBridgeProps = {
  trigger: string
  scale: number
  contentHeight: number
  scrollRef: React.RefObject<HTMLDivElement | null>
}

/**
 * Overview — 휠 스크롤을 외부 scroll container로 전달.
 * 세로: flow-sticky가 viewport에 고정되므로 scrollTop → viewport.y 동기화.
 * 가로: scroll-content 전체가 DOM 스크롤되므로 viewport.x는 0 유지 (이중 이동 방지).
 */
export function OverviewScrollBridge({
  trigger,
  scale,
  contentHeight,
  scrollRef,
}: OverviewScrollBridgeProps) {
  const { setViewport } = useReactFlow()
  const scaleRef = useRef(scale)
  scaleRef.current = scale

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
      if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
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
