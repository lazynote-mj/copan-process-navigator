import type { NodeType } from '../../types/nodeTypes'
import { LANE_MIN_HEIGHT, LAYOUT } from './layoutConfig'
import { NODE_LAYOUT } from './nodeLayoutSizes'

export type GridLayoutMetrics = {
  columnWidth: number
  nodeVerticalGap: number
  decisionNodeGap: number
  laneMinHeight: number
  laneContentPaddingY: number
  nodeWidth: number
  nodeHeight: number
  decisionWidth: number
  decisionHeight: number
}

export const DEFAULT_GRID_METRICS: GridLayoutMetrics = {
  columnWidth: 220,
  nodeVerticalGap: NODE_LAYOUT.nodeVerticalGap,
  decisionNodeGap: NODE_LAYOUT.decisionNodeGap,
  laneMinHeight: LANE_MIN_HEIGHT,
  laneContentPaddingY: 16,
  nodeWidth: LAYOUT.nodeWidth,
  nodeHeight: LAYOUT.nodeHeight,
  decisionWidth: LAYOUT.decisionWidth,
  decisionHeight: LAYOUT.decisionHeight,
}

export function getNodeSizeForMetrics(
  type: NodeType,
  metrics: GridLayoutMetrics = DEFAULT_GRID_METRICS,
): { width: number; height: number } {
  if (type === 'decision') {
    return { width: metrics.decisionWidth, height: metrics.decisionHeight }
  }
  if (type === 'phase-connector') {
    return { width: 148, height: 36 }
  }
  return { width: metrics.nodeWidth, height: metrics.nodeHeight }
}
