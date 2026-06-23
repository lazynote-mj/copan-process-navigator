import type { NodeType } from '../../types/nodeTypes'

/** Overview Cross-Functional Swimlane layout 상수 — Compact + Collision Safe */
export type OverviewVerticalMetrics = {
  zoneLabelColumnWidth: number
  laneColumnWidth: number
  laneHeaderHeight: number
  nodeHorizontalGap: number
  laneContentPaddingX: number
  laneContentPaddingY: number
  returnRouteColumnWidth: number
  nodeWidth: number
  nodeHeight: number
  decisionWidth: number
  decisionHeight: number
  decisionDiamondSize: number
  nodeGapX: number
  nodeGapY: number
  nodeVerticalGap: number
  normalNodeGapY: number
  processRowGap: number
  zoneGap: number
  phaseGap: number
  decisionMargin: number
  decisionMarginAbove: number
  decisionMarginBelow: number
  zonePaddingY: number
  minZoneHeight: number
  maxYDiff: number
  maxEdgeLength: number
  longHorizontalEdgeLength: number
  edgeRoutingAllowance: number
  edgeRoutingAllowanceLong: number
  edgeNodeMargin: number
  edgeNodeMarginReturn: number
  edgeEdgeGap: number
}

export const OVERVIEW_VERTICAL_METRICS: OverviewVerticalMetrics = {
  zoneLabelColumnWidth: 88,
  laneColumnWidth: 320,
  laneHeaderHeight: 48,
  nodeHorizontalGap: 32,
  laneContentPaddingX: 12,
  laneContentPaddingY: 6,
  returnRouteColumnWidth: 20,
  nodeWidth: 170,
  nodeHeight: 46,
  decisionWidth: 140,
  decisionHeight: 44,
  decisionDiamondSize: 140,
  nodeGapX: 32,
  nodeGapY: 20,
  nodeVerticalGap: 18,
  normalNodeGapY: 18,
  processRowGap: 65,
  zoneGap: 45,
  phaseGap: 45,
  decisionMargin: 20,
  decisionMarginAbove: 20,
  decisionMarginBelow: 20,
  zonePaddingY: 6,
  minZoneHeight: 48,
  maxYDiff: 36,
  maxEdgeLength: 800,
  longHorizontalEdgeLength: 800,
  edgeRoutingAllowance: 24,
  edgeRoutingAllowanceLong: 48,
  edgeNodeMargin: 16,
  edgeNodeMarginReturn: 24,
  edgeEdgeGap: 8,
}

export function getOverviewNodeSize(
  type: NodeType,
  metrics: OverviewVerticalMetrics = OVERVIEW_VERTICAL_METRICS,
  _name = '',
): { width: number; height: number } {
  if (type === 'decision') {
    return { width: metrics.decisionWidth, height: metrics.decisionHeight }
  }
  return { width: metrics.nodeWidth, height: metrics.nodeHeight }
}

export function isOverviewDecisionType(type: NodeType): boolean {
  return type === 'decision'
}

export function overviewSimilarYThreshold(metrics: OverviewVerticalMetrics): number {
  return metrics.maxYDiff
}
