import type { NodeType } from '../../types/nodeTypes'
import { DECISION_NODE_LAYOUT, getDecisionNodeSize } from './decisionNodeLayout'
import { getInterfaceRuleNodeSize, isInterfaceRuleNode } from './interfaceRuleLayout'

/** 인접 노드 간 세로 간격 — decision / interface-rule 아래 일반 node는 60px 이상 */
export function verticalStackGap(
  prevType: NodeType,
  nextType: NodeType,
  defaultGap: number,
): number {
  const prevBranch = prevType === 'decision' || isInterfaceRuleNode(prevType)
  const nextBranch = nextType === 'decision' || isInterfaceRuleNode(nextType)

  if (prevBranch && !nextBranch) {
    return DECISION_NODE_LAYOUT.belowMinGap
  }
  if (prevBranch || nextBranch) {
    return Math.max(defaultGap, DECISION_NODE_LAYOUT.belowMinGap)
  }
  return defaultGap
}

import { OVERVIEW_GRID_METRICS } from './overviewGridMetrics'

/** Layout bounding box — 노드 마스터 (Overview·Detail 공통) */
export const NODE_LAYOUT = {
  default: { width: OVERVIEW_GRID_METRICS.nodeWidth, height: OVERVIEW_GRID_METRICS.nodeHeight },
  decision: {
    width: DECISION_NODE_LAYOUT.width,
    height: DECISION_NODE_LAYOUT.height,
  },
  decisionDiamond: {
    width: DECISION_NODE_LAYOUT.diamondWidth,
    height: DECISION_NODE_LAYOUT.diamondHeight,
  },
  nodeVerticalGap: 40,
  decisionNodeGap: DECISION_NODE_LAYOUT.belowMinGap,
} as const

export function getLayoutNodeSize(type: NodeType, name = ''): { width: number; height: number } {
  if (type === 'decision') {
    return getDecisionNodeSize(name)
  }
  if (isInterfaceRuleNode(type)) {
    return getInterfaceRuleNodeSize(name)
  }
  if (type === 'phase-connector') {
    return { width: 148, height: 36 }
  }
  return { ...NODE_LAYOUT.default }
}

export function isDecisionNodeType(type: NodeType | string): boolean {
  return type === 'decision'
}

export function isBranchLayoutNodeType(type: NodeType | string): boolean {
  return type === 'decision' || isInterfaceRuleNode(type)
}

/** stack 내 인접 노드 간격 */
export function stackGapBetween(
  prevType: NodeType,
  nextType: NodeType,
  defaultGap: number = NODE_LAYOUT.nodeVerticalGap,
  decisionGap: number = NODE_LAYOUT.decisionNodeGap,
): number {
  return verticalStackGap(prevType, nextType, Math.max(defaultGap, decisionGap))
}
