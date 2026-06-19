/** 선택 노드가 Property Panel 뒤에 가려지면 scrollLeft만 보정 (scale/zoom 변경 없음) */
export function compensatePanelScroll(
  scrollEl: HTMLElement,
  selectedNodeId: string,
  panelWidth: number,
  padding = 16,
): void {
  if (panelWidth <= 0 || !selectedNodeId) return

  const nodeEl = scrollEl.querySelector<HTMLElement>(
    `.react-flow__node[data-id="${CSS.escape(selectedNodeId)}"]`,
  )
  if (!nodeEl) return

  const scrollRect = scrollEl.getBoundingClientRect()
  const nodeRect = nodeEl.getBoundingClientRect()
  const visibleRight = scrollRect.right - panelWidth

  if (nodeRect.right > visibleRight) {
    scrollEl.scrollLeft += nodeRect.right - visibleRight + padding
  }
}
