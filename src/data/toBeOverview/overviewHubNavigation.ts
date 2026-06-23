/** Overview 대표 노드 → Process Group (상세 화면 이동) */
export const OVERVIEW_HUB_NODE_IDS = [
  'return-handling',
  'stock-transfer-handling',
  'other-issue-handling',
] as const

export type OverviewHubNodeId = (typeof OVERVIEW_HUB_NODE_IDS)[number]

/** 대표 노드 id → process group id */
export const OVERVIEW_HUB_TO_GROUP: Record<OverviewHubNodeId, string> = {
  'return-handling': 'pg-b2b-domestic-return',
  'stock-transfer-handling': 'pg-stock-transfer',
  'other-issue-handling': 'pg-other-issue',
}

export function getOverviewHubGroupId(nodeId: string): string | undefined {
  return OVERVIEW_HUB_TO_GROUP[nodeId as OverviewHubNodeId]
}

export function isOverviewHubNode(nodeId: string): boolean {
  return nodeId in OVERVIEW_HUB_TO_GROUP
}
