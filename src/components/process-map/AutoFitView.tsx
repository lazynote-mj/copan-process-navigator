import { useEffect } from 'react'
import { useReactFlow } from '@xyflow/react'
import type { CanvasBounds, LaneBand } from '../../lib/layout/elkLayout'
import { OVERVIEW_VERTICAL_METRICS } from '../../lib/layout/overviewVerticalMetrics'

/** ~85% of viewport — End-to-End 한 화면 표시 */
const FIT_PADDING = 0.075
const MIN_ZOOM_DETAIL = 0.58
const MIN_ZOOM_OVERVIEW = 0.55
const OVERVIEW_ZOOM_MIN = 0.7
const OVERVIEW_ZOOM_MAX = 0.9
const MAX_ZOOM = 1.45

type AutoFitViewProps = {
  trigger: string
  laneBands: LaneBand[]
  canvasBounds: CanvasBounds
  overviewMode?: boolean
}

export function AutoFitView({
  trigger,
  laneBands,
  canvasBounds,
  overviewMode = false,
}: AutoFitViewProps) {
  const { setViewport } = useReactFlow()

  useEffect(() => {
    if (!trigger || laneBands.length === 0) return

    const timer = window.setTimeout(() => {
      const container = document.querySelector('.process-map-canvas')
      if (!container) return

      const { width: vw, height: vh } = container.getBoundingClientRect()
      if (vw === 0 || vh === 0) return

      const topY = overviewMode
        ? laneBands[0].y - OVERVIEW_VERTICAL_METRICS.laneHeaderHeight
        : laneBands[0].y

      const bounds = {
        x: 0,
        y: topY,
        width: canvasBounds.width,
        height: canvasBounds.height - canvasBounds.topPadding,
      }

      const padX = vw * FIT_PADDING
      const padY = vh * FIT_PADDING

      const zoomX = (vw - padX * 2) / bounds.width
      const zoomY = (vh - padY * 2) / bounds.height
      const rawZoom = Math.min(zoomX, zoomY)

      let zoom: number
      if (overviewMode) {
        if (rawZoom >= OVERVIEW_ZOOM_MIN && rawZoom <= OVERVIEW_ZOOM_MAX) {
          zoom = rawZoom
        } else if (rawZoom > OVERVIEW_ZOOM_MAX) {
          zoom = OVERVIEW_ZOOM_MAX
        } else {
          zoom = Math.max(rawZoom, MIN_ZOOM_OVERVIEW)
        }
      } else {
        zoom = Math.min(Math.max(rawZoom, MIN_ZOOM_DETAIL), MAX_ZOOM)
      }

      const cx = bounds.x + bounds.width / 2
      const cy = bounds.y + bounds.height / 2

      setViewport(
        {
          x: vw / 2 - cx * zoom,
          y: vh / 2 - cy * zoom,
          zoom,
        },
        { duration: 280 },
      )
    }, 60)

    return () => window.clearTimeout(timer)
  }, [trigger, laneBands, canvasBounds, overviewMode, setViewport])

  return null
}
