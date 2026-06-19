/** Lane header — 고정 폭 (edge/노드 침범 금지 영역) */
export const LANE_HEADER_WIDTH = 160

/** Lane content 영역 내부 padding */
export const LANE_CONTENT_PADDING_X = 48
export const LANE_CONTENT_PADDING_Y = 16

/** Lane 최소 높이 및 lane 간 간격 */
export const LANE_MIN_HEIGHT = 128
export const LANE_GAP = 0

/** Edge 하단 우회를 위한 lane 하단 여유 */
export const EDGE_ROUTING_MARGIN_Y = 80

/** Canvas padding / margin */
export const CANVAS_TOP_PADDING = 24
export const CANVAS_BOTTOM_PADDING = 24
export const CANVAS_RIGHT_MARGIN = 120

import { getOverviewLaneNames } from '../../data/laneRegistry'

/** Overview TO-BE 기본 lane 이름 순서 — lanes.json 과 동기화 */
export const DEFAULT_OVERVIEW_LANE_ORDER = getOverviewLaneNames()

/** 노드·edge가 배치될 content 영역 좌측 기준선 */
export function contentLeftX(): number {
  return LANE_HEADER_WIDTH + LANE_CONTENT_PADDING_X
}

/** ELK local → canvas 절대 X */
export function toRenderX(elkX: number): number {
  return LANE_HEADER_WIDTH + LANE_CONTENT_PADDING_X + elkX
}

/** ELK local → canvas 절대 Y (lane top 기준) */
export function toRenderY(laneTop: number, elkY: number): number {
  return laneTop + LANE_CONTENT_PADDING_Y + elkY
}

/** 레이아웃 상수 — 모든 프로세스에 공통 적용 */
export const LAYOUT = {
  nodeWidth: 160,
  nodeHeight: 56,
  decisionWidth: 88,
  decisionHeight: 88,
  spacingHorizontal: 120,
  spacingVertical: 72,
  edgeEdge: 32,
  edgeNode: 40,
  edgeLayerSpacing: 40,
} as const

export const ELK_LANE_OPTIONS = {
  'elk.algorithm': 'layered',
  'elk.direction': 'RIGHT',
  'elk.layered.spacing.nodeNodeBetweenLayers': String(LAYOUT.spacingHorizontal),
  'elk.spacing.nodeNode': String(LAYOUT.spacingVertical),
  'elk.layered.spacing.edgeNodeBetweenLayers': String(LAYOUT.edgeLayerSpacing),
  'elk.layered.spacing.edgeEdgeBetweenLayers': String(LAYOUT.edgeEdge),
  'elk.spacing.edgeNode': String(LAYOUT.edgeNode),
  'elk.spacing.edgeEdge': String(LAYOUT.edgeEdge),
  'elk.edgeRouting': 'ORTHOGONAL',
  'org.eclipse.elk.layered.nodePlacement.strategy': 'SIMPLE',
  'org.eclipse.elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
  'org.eclipse.elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
  'org.eclipse.elk.layered.mergeEdges': 'false',
  'org.eclipse.elk.layered.unnecessaryBendpoints': 'true',
  /** padding은 render 단계(LANE_CONTENT_PADDING_*)에서 적용 — ELK는 content 상대좌표만 계산 */
  'elk.padding': '[top=0,left=0,bottom=0,right=0]',
} as const
