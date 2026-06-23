/**
 * Layout / routing margin 단일 참조.
 * - nodeGap*: 노드 배치 간격 (structural)
 * - edgeNodeMargin: edge collision 검사 padding (routing obstacle = node bbox only)
 * - zoneVisualGap: decorative process.zones[] overlay — routing obstacle 아님
 */

export { MIN_ZONE_NODE_GAP } from './processZoneLayout'

/** Overview structural zone band 간격 (Y축 processZone) */
export const STRUCTURAL_ZONE_GAP = 28

/** Detail / overview 공통 — edge↔node collision padding */
export const ROUTING_EDGE_NODE_MARGIN = 24

/** Locked / priority handle route padding */
export const ROUTING_PRIORITY_NODE_PADDING = 20

/** Overview grid edge collision (overviewEdgePipeline retry) */
export const ROUTING_OVERVIEW_EDGE_NODE_MARGIN = 14

/** Overview grid edge-edge separation */
export const ROUTING_OVERVIEW_EDGE_EDGE_GAP = 10

/** Decorative zone border ↔ external node 최소 간격 (bbox clamp only, node 이동 없음) */
export { DEFAULT_ZONE_PADDING_X, DEFAULT_ZONE_HEADER_HEIGHT, DEFAULT_ZONE_PADDING_BOTTOM } from './processZoneLayout'
