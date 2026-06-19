import type { Node, Process } from '../../types/process'

/** 정산 Zone finance lane — 2열: LEFT 위탁 / RIGHT 로열티·예외 */
export const SETTLEMENT_FINANCE_LAYOUT: Record<
  string,
  { cellSlot: number; cellOrder: number }
> = {
  // LEFT — 위탁정산 main flow
  'consignment-sales-register': { cellSlot: 1, cellOrder: 0 },
  'consignment-sales-close': { cellSlot: 2, cellOrder: 1 },
  'settlement-anomaly-check': { cellSlot: 3, cellOrder: 2 },
  'prepayment-process': { cellSlot: 4, cellOrder: 3 },
  'regular-fund-execution': { cellSlot: 5, cellOrder: 4 },

  // RIGHT — 로열티/MG + 예외
  'royalty-sales-aggregate': { cellSlot: 6, cellOrder: 10 },
  'royalty-sales-close': { cellSlot: 7, cellOrder: 11 },
  'mg-deduct-check': { cellSlot: 8, cellOrder: 12 },
  'mg-offset-process': { cellSlot: 9, cellOrder: 13 },
  'settlement-posting': { cellSlot: 10, cellOrder: 14 },
  'exception-handling': { cellSlot: 10, cellOrder: 99 },
}

export const SETTLEMENT_PARTNERSHIP_LAYOUT: Record<string, { cellSlot: number; cellOrder: number }> = {
  'consignment-stock-status': { cellSlot: 1, cellOrder: 0 },
}

export function isSettlementBranchNode(node: Node): boolean {
  return node.id === 'exception-handling' || node.type === 'exception'
}

export function applySettlementGroupLayout(process: Process): Node[] {
  return process.nodes.map((node) => {
    if (node.processZone !== 'settlement-close') return node

    const financeLayout = node.laneId === 'finance' ? SETTLEMENT_FINANCE_LAYOUT[node.id] : undefined
    const partnershipLayout =
      node.laneId === 'partnership' ? SETTLEMENT_PARTNERSHIP_LAYOUT[node.id] : undefined
    const layout = financeLayout ?? partnershipLayout
    if (!layout) return node

    return {
      ...node,
      cellSlot: layout.cellSlot,
      cellOrder: layout.cellOrder,
      zoneOrder: layout.cellOrder,
    }
  })
}
