import type { NodeType } from '../../types/nodeTypes'
import type { GridLayoutMetrics } from './gridLayoutMetrics'
import { DECISION_NODE_LAYOUT, getDecisionNodeSize } from './decisionNodeLayout'
import { getInterfaceRuleNodeSize, isInterfaceRuleNode } from './interfaceRuleLayout'

/** Process Detail — 문서형 세로 스크롤, lane 컬럼 배치 */
export const DETAIL_DOCUMENT = {
  maxContentWidth: 1200,
  paddingTop: 80,
  paddingX: 80,
  paddingBottom: 80,
  laneWidth: 280,
  laneGap: 80,
  laneMinHeight: 600,
  laneHeaderHeight: 52,
  laneContentPaddingY: 24,
  nodeVerticalGap: 48,
  laneBottomPadding: 80,
  viewportTopOffset: 100,
} as const

/** @deprecated column wrap 제거 — lane 컬럼 내 세로 스택만 */
export const DETAIL_LAYOUT = {
  maxNodesPerColumn: 999,
  horizontalGap: DETAIL_DOCUMENT.laneGap,
  verticalGap: DETAIL_DOCUMENT.nodeVerticalGap,
  laneBottomPadding: DETAIL_DOCUMENT.laneBottomPadding,
} as const

export const DETAIL_GRID_METRICS: GridLayoutMetrics = {
  columnWidth: DETAIL_DOCUMENT.laneWidth,
  nodeVerticalGap: DETAIL_DOCUMENT.nodeVerticalGap,
  decisionNodeGap: DETAIL_DOCUMENT.nodeVerticalGap,
  laneMinHeight: DETAIL_DOCUMENT.laneMinHeight,
  laneContentPaddingY: DETAIL_DOCUMENT.laneContentPaddingY,
  nodeWidth: 160,
  nodeHeight: 56,
  decisionWidth: DECISION_NODE_LAYOUT.width,
  decisionHeight: DECISION_NODE_LAYOUT.height,
}

export function getDetailNodeSize(
  type: NodeType,
  metrics: GridLayoutMetrics = DETAIL_GRID_METRICS,
  name = '',
): { width: number; height: number } {
  if (type === 'decision') {
    return getDecisionNodeSize(name)
  }
  if (isInterfaceRuleNode(type)) {
    return getInterfaceRuleNodeSize(name)
  }
  if (type === 'phase-connector') {
    return { width: 148, height: 36 }
  }
  return { width: metrics.nodeWidth, height: metrics.nodeHeight }
}
