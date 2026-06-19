import { useEffect, type RefObject, type SyntheticEvent } from 'react'

/** 맵 pan/zoom과 분리해야 하는 패널·드로어 영역 */
export const PANEL_EVENT_ROOT_SELECTOR =
  '.app-property-panel, .property-panel, .drawer, .drawer__body'

export function isPanelEventTarget(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest(PANEL_EVENT_ROOT_SELECTOR))
}

export function stopPanelEventPropagation(event: SyntheticEvent | Event) {
  event.stopPropagation()
}

/** React synthetic 이벤트용 — 스크롤 격리 (클릭은 React root 위임을 막지 않도록 제외) */
export const panelEventShieldProps = {
  onWheel: stopPanelEventPropagation,
  onTouchMove: stopPanelEventPropagation,
} as const

/** 네이티브 버블링 차단 — 맵 스크롤만 격리 (click/mousedown 차단 시 Drawer 버튼이 동작하지 않음) */
const NATIVE_BUBBLE_EVENTS = ['wheel', 'touchmove'] as const

/** 네이티브 버블링 차단 — React Flow wheel/touch 스크롤 전파 방지 */
export function usePanelNativeEventShield(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = ref.current
    if (!root) return

    const stopBubble: EventListener = (event) => {
      event.stopPropagation()
    }

    for (const type of NATIVE_BUBBLE_EVENTS) {
      root.addEventListener(type, stopBubble, false)
    }

    return () => {
      for (const type of NATIVE_BUBBLE_EVENTS) {
        root.removeEventListener(type, stopBubble, false)
      }
    }
  }, [ref])
}

/** 맵 스크롤 컨테이너 wheel — 패널/드로어에서 온 이벤트는 무시 */
export function shouldMapConsumeWheel(event: WheelEvent): boolean {
  if (isPanelEventTarget(event.target)) return false
  return !event.composedPath().some((node) => node instanceof Element && isPanelEventTarget(node))
}
