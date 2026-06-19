import type { ReactNode, RefObject } from 'react'
import { panelEventShieldProps } from '../../lib/ui/panelEventShield'
import './process-canvas-container.css'

export const PROPERTY_PANEL_WIDTH = 380

type ProcessCanvasContainerProps = {
  isPanelOpen: boolean
  panelRef?: RefObject<HTMLElement | null>
  panel: ReactNode
  children: ReactNode
}

/**
 * Overview / Process Detail 공통 캔버스 뷰포트.
 * Panel open 시 canvas scale은 유지하고, panel은 우측 오버레이로 표시한다.
 */
export function ProcessCanvasContainer({
  isPanelOpen,
  panelRef,
  panel,
  children,
}: ProcessCanvasContainerProps) {
  return (
    <div
      className={`process-canvas-container${isPanelOpen ? ' process-canvas-container--panel-open' : ''}`}
      style={{ ['--property-panel-width' as string]: `${PROPERTY_PANEL_WIDTH}px` }}
    >
      <div className="process-canvas-container__viewport">{children}</div>
      {isPanelOpen ? (
        <aside
          ref={panelRef}
          className="process-canvas-container__panel app-property-panel node-detail-panel"
          aria-label="Property Panel"
          {...panelEventShieldProps}
        >
          {panel}
        </aside>
      ) : null}
    </div>
  )
}
