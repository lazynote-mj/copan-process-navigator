import type { EdgeHandleId } from '../../types/process'
import { DETAIL_NODE_SCALE, scaleLayoutDimension } from './detailNodeScale'
import { OVERVIEW_VERTICAL_METRICS } from './overviewVerticalMetrics'

/**
 * 판단(decision) 노드 레이아웃 스펙 — leaf 모듈.
 * 라우팅/앵커 로직과 분리해 순환 참조 없이 어디서든 module-init 시점에
 * 안전하게 참조할 수 있다. 라우팅 헬퍼는 decisionNodeLayout.ts에 있다.
 */

export type DecisionLayoutSpec = {
  width: number
  height: number
  diamondWidth: number
  diamondHeight: number
  polygonVertices: Record<EdgeHandleId, { x: number; y: number }>
  polygonPoints: string
  exclusionPadding: number
  sameColumnThresholdX: number
  maxOutgoingBends: number
  /** decision wrapper 아래 → 일반 node 상단 최소 간격 */
  belowMinGap: number
}

/** 노드 마스터 — Overview 판단/분기 */
export const DECISION_NODE_LAYOUT: DecisionLayoutSpec = {
  width: 140,
  height: 44,
  diamondWidth: 140,
  diamondHeight: 44,
  polygonVertices: {
    top: { x: 70, y: 0 },
    right: { x: 140, y: 22 },
    bottom: { x: 70, y: 44 },
    left: { x: 0, y: 22 },
  },
  polygonPoints: '70,0 140,22 70,44 0,22',
  exclusionPadding: 14,
  sameColumnThresholdX: 50,
  maxOutgoingBends: 2,
  belowMinGap: 60,
}

export function scaleDecisionLayoutSpec(
  base: DecisionLayoutSpec,
  scale: number = DETAIL_NODE_SCALE,
): DecisionLayoutSpec {
  const width = scaleLayoutDimension(base.width, scale)
  const height = scaleLayoutDimension(base.height, scale)
  const diamondWidth = scaleLayoutDimension(base.diamondWidth, scale)
  const diamondHeight = scaleLayoutDimension(base.diamondHeight, scale)
  const halfW = diamondWidth / 2
  const halfH = diamondHeight / 2

  return {
    width,
    height,
    diamondWidth,
    diamondHeight,
    polygonVertices: {
      top: { x: halfW, y: 0 },
      right: { x: diamondWidth, y: halfH },
      bottom: { x: halfW, y: diamondHeight },
      left: { x: 0, y: halfH },
    },
    polygonPoints: `${halfW},0 ${diamondWidth},${halfH} ${halfW},${diamondHeight} 0,${halfH}`,
    exclusionPadding: scaleLayoutDimension(base.exclusionPadding, scale),
    sameColumnThresholdX: scaleLayoutDimension(base.sameColumnThresholdX, scale),
    maxOutgoingBends: base.maxOutgoingBends,
    belowMinGap: scaleLayoutDimension(base.belowMinGap, scale),
  }
}

/** 노드 마스터 — Process Detail 판단/분기 (일반 노드 가로폭과 동일) */
export const DETAIL_DECISION_NODE_LAYOUT: DecisionLayoutSpec = {
  ...DECISION_NODE_LAYOUT,
  width: OVERVIEW_VERTICAL_METRICS.nodeWidth,
  height: OVERVIEW_VERTICAL_METRICS.decisionHeight,
  diamondWidth: OVERVIEW_VERTICAL_METRICS.nodeWidth,
  diamondHeight: OVERVIEW_VERTICAL_METRICS.decisionHeight,
  polygonVertices: {
    top: { x: OVERVIEW_VERTICAL_METRICS.nodeWidth / 2, y: 0 },
    right: {
      x: OVERVIEW_VERTICAL_METRICS.nodeWidth,
      y: OVERVIEW_VERTICAL_METRICS.decisionHeight / 2,
    },
    bottom: {
      x: OVERVIEW_VERTICAL_METRICS.nodeWidth / 2,
      y: OVERVIEW_VERTICAL_METRICS.decisionHeight,
    },
    left: { x: 0, y: OVERVIEW_VERTICAL_METRICS.decisionHeight / 2 },
  },
  polygonPoints: `${OVERVIEW_VERTICAL_METRICS.nodeWidth / 2},0 ${OVERVIEW_VERTICAL_METRICS.nodeWidth},${OVERVIEW_VERTICAL_METRICS.decisionHeight / 2} ${OVERVIEW_VERTICAL_METRICS.nodeWidth / 2},${OVERVIEW_VERTICAL_METRICS.decisionHeight} 0,${OVERVIEW_VERTICAL_METRICS.decisionHeight / 2}`,
}

export function resolveDecisionLayout(width?: number, height?: number): DecisionLayoutSpec {
  if (width == null || height == null) {
    return DECISION_NODE_LAYOUT
  }
  if (width === DECISION_NODE_LAYOUT.width && height === DECISION_NODE_LAYOUT.height) {
    return DECISION_NODE_LAYOUT
  }
  if (width === DETAIL_DECISION_NODE_LAYOUT.width && height === DETAIL_DECISION_NODE_LAYOUT.height) {
    return DETAIL_DECISION_NODE_LAYOUT
  }
  const scale = width / DECISION_NODE_LAYOUT.width
  return scaleDecisionLayoutSpec(DECISION_NODE_LAYOUT, scale)
}

/** @deprecated 모든 판단노드가 동일 마스터 크기 */
export function isOverviewDecisionSize(_height?: number): boolean {
  return true
}

/** React / anchor helpers — layout box + polygon in one shape */
export function resolveDecisionLayoutForSize(width: number, height: number): {
  layoutWidth: number
  layoutHeight: number
  vertices: Record<EdgeHandleId, { x: number; y: number }>
  polygonPoints: string
  diamondWidth: number
  diamondHeight: number
} {
  const layout = resolveDecisionLayout(width, height)
  return {
    layoutWidth: layout.width,
    layoutHeight: layout.height,
    vertices: layout.polygonVertices,
    polygonPoints: layout.polygonPoints,
    diamondWidth: layout.diamondWidth,
    diamondHeight: layout.diamondHeight,
  }
}

export function isLongDecisionTitle(name: string): boolean {
  const trimmed = name.trim()
  return trimmed.length > 10 || trimmed.includes('\n')
}

export function getDecisionNodeSize(_name = ''): { width: number; height: number } {
  return {
    width: DECISION_NODE_LAYOUT.width,
    height: DECISION_NODE_LAYOUT.height,
  }
}
