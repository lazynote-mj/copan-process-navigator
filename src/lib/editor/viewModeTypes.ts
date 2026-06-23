/** 화면 View Mode — Overview vs Process Detail */
export type ViewMode = 'overview' | 'detail'

/** Overview 하이라이트 표시 방식 */
export type OverviewHighlightMode = 'all' | 'dim' | 'filter'

export type OverviewHighlight = {
  /** null이면 전체 동일 강조 */
  groupId: string | null
  nodeIds: Set<string>
  edgeIds: Set<string>
  mode: OverviewHighlightMode
  /** 그룹 내 선택 노드 — 관련 edge/라벨 추가 강조 */
  focusNodeId?: string | null
  focusEdgeIds?: Set<string>
  focusNodeIds?: Set<string>
}

export function createEmptyHighlight(): OverviewHighlight {
  return {
    groupId: null,
    nodeIds: new Set(),
    edgeIds: new Set(),
    mode: 'all',
  }
}
