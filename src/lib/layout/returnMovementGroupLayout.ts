import type { Node, Process } from '../../types/process'

/** 반품·이동·기타출고 Zone — Overview 대표 노드 3개 (동일 X축, 독립 시작) */
const RETURN_MOVEMENT_LAYOUT: Record<string, { cellSlot: number; cellOrder: number }> = {
  'return-handling': { cellSlot: 1, cellOrder: 0 },
  'stock-transfer-handling': { cellSlot: 2, cellOrder: 0 },
  'other-issue-handling': { cellSlot: 3, cellOrder: 0 },
}

export function isReturnMovementBranchNode(_node: Node): boolean {
  return false
}

export function applyReturnMovementGroupLayout(process: Process): Node[] {
  return process.nodes.map((node) => {
    if (node.processZone !== 'return-movement') return node

    const layout = RETURN_MOVEMENT_LAYOUT[node.id]
    if (!layout) return node

    return {
      ...node,
      cellSlot: layout.cellSlot,
      cellOrder: layout.cellOrder,
      zoneOrder: layout.cellOrder,
    }
  })
}
