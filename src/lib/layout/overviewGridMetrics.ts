import type { NodeType } from '../../types/nodeTypes'
import { CONNECTOR_NODE_SIZE } from './connectorLayout'
import { isInterfaceRuleNode } from './interfaceRuleLayout'
import {
  DETAIL_SWIMLANE_GRID,
  LANE_WIDTH,
  LEFT_LABEL_WIDTH,
  OVERVIEW_SWIMLANE_GRID,
} from './swimlaneGridLayout'
import { OVERVIEW_VERTICAL_METRICS } from './overviewVerticalMetrics'
import { DETAIL_DECISION_NODE_LAYOUT } from './decisionNodeLayout'

/** Cell 내부 열 간 최소 간격 — lane 폭은 변경하지 않음 */
export const CELL_COLUMN_GAP_MIN = 40

/** Overview Cell/Grid layout 상수 */
export type OverviewGridMetrics = {
  zoneLabelColumnWidth: number
  cellWidth: number
  cellMinHeight: number
  laneHeaderHeight: number
  zoneGap: number
  nodeWidth: number
  nodeHeight: number
  decisionWidth: number
  decisionHeight: number
  decisionDiamondSize: number
  /** Cell 내부 다열 배치 시 열 간격 */
  nodeGapX: number
  nodeGapY: number
  /** row 내 노드 상하 여백 */
  rowPaddingY: number
  /** decision 없는 row 최소 높이 */
  rowMinHeightNormal: number
  /** decision 포함 row 최소 높이 */
  rowMinHeightDecision: number
  cellPaddingX: number
  cellPaddingY: number
  returnRouteColumnWidth: number
  edgeNodeMargin: number
  edgeEdgeGap: number
}

export const OVERVIEW_GRID_METRICS: OverviewGridMetrics = {
  zoneLabelColumnWidth: LEFT_LABEL_WIDTH,
  cellWidth: LANE_WIDTH,
  cellMinHeight: 220,
  laneHeaderHeight: OVERVIEW_SWIMLANE_GRID.laneHeaderHeight,
  zoneGap: 28,
  nodeWidth: 140,
  nodeHeight: 44,
  decisionWidth: 140,
  decisionHeight: 44,
  decisionDiamondSize: 140,
  nodeGapX: CELL_COLUMN_GAP_MIN,
  nodeGapY: 14,
  rowPaddingY: 10,
  rowMinHeightNormal: 54,
  rowMinHeightDecision: 54,
  cellPaddingX: 20,
  cellPaddingY: 20,
  returnRouteColumnWidth: OVERVIEW_SWIMLANE_GRID.returnRouteColumnWidth,
  edgeNodeMargin: 14,
  edgeEdgeGap: 10,
}

/** Detail — Overview vertical(170×46)과 동일 노드 크기, zone 컬럼만 Detail swimlane 사용 */
export const DETAIL_GRID_METRICS: OverviewGridMetrics = {
  ...OVERVIEW_GRID_METRICS,
  zoneLabelColumnWidth: DETAIL_SWIMLANE_GRID.leftLabelWidth,
  returnRouteColumnWidth: DETAIL_SWIMLANE_GRID.returnRouteColumnWidth,
  nodeWidth: OVERVIEW_VERTICAL_METRICS.nodeWidth,
  nodeHeight: OVERVIEW_VERTICAL_METRICS.nodeHeight,
  decisionWidth: DETAIL_DECISION_NODE_LAYOUT.width,
  decisionHeight: DETAIL_DECISION_NODE_LAYOUT.height,
  decisionDiamondSize: DETAIL_DECISION_NODE_LAYOUT.diamondWidth,
}

export function getGridNodeSize(
  type: NodeType,
  metrics: OverviewGridMetrics = OVERVIEW_GRID_METRICS,
  _name = '',
): { width: number; height: number } {
  if (type === 'decision') {
    return { width: metrics.decisionWidth, height: metrics.decisionHeight }
  }
  if (isInterfaceRuleNode(type)) {
    return { width: metrics.decisionWidth, height: metrics.decisionHeight }
  }
  if (type === 'connector' || type === 'merge') {
    return { ...CONNECTOR_NODE_SIZE }
  }
  return { width: metrics.nodeWidth, height: metrics.nodeHeight }
}

export function gridNodeVisualHeight(
  type: NodeType,
  metrics: OverviewGridMetrics = OVERVIEW_GRID_METRICS,
): number {
  if (type === 'decision') return metrics.decisionHeight
  if (isInterfaceRuleNode(type)) return metrics.decisionHeight
  if (type === 'connector' || type === 'merge') return CONNECTOR_NODE_SIZE.height
  return metrics.nodeHeight
}
