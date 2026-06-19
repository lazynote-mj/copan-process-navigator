import type { Node, Process } from '../types/process'

/** Overview 대표 노드 → Detail Process id (노드 JSON 미지정 시 fallback) */
export const OVERVIEW_NODE_DETAIL_PROCESS_IDS: Record<string, string[]> = {
  'purchase-request': [
    'business-to-project',
    'consignment-purchase-receipt',
  ],
  'order-register': [
    'b2b-domestic-order-to-sales',
    'b2b-export-order-to-sales',
    'b2c-order-to-sales',
    'preorder-to-sales',
  ],
  'return-handling': ['b2b-domestic-return'],
  'stock-transfer-handling': ['stock-transfer'],
  'other-issue-handling': ['other-issue'],
  'settlement-posting': ['consignment-settlement', 'royalty-mg-settlement'],
  'popup-concert-stock-sales-sync': ['popup-concert-stock-sales-sync'],
}

export function resolveNodeDetailProcessIds(node: Pick<Node, 'id' | 'detailProcessIds'>): string[] {
  if (node.detailProcessIds?.length) return node.detailProcessIds
  return OVERVIEW_NODE_DETAIL_PROCESS_IDS[node.id] ?? []
}

export function resolveDetailProcessLabels(
  processIds: string[],
  detailProcesses: Process[],
): { id: string; name: string }[] {
  return processIds.map((id) => {
    const proc = detailProcesses.find((p) => p.id === id)
    return { id, name: proc?.name ?? id }
  })
}
