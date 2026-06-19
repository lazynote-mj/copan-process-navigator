import type { Node, ProcessZoneId } from '../../types/process'

/** Overview Cross-Functional 업무 Zone (Y축) — Cell/Grid 6구간 */
export type { ProcessZoneId }

export type ProcessZoneDef = {
  id: ProcessZoneId
  label: string
  order: number
}

export const PROCESS_ZONES: ProcessZoneDef[] = [
  { id: 'business-contract', label: '사업·계약·프로젝트', order: 0 },
  { id: 'purchase-order', label: '구매·발주', order: 1 },
  { id: 'inbound-inventory', label: '입고·재고·매입', order: 2 },
  { id: 'sales-shipment', label: '판매·출고·매출', order: 3 },
  { id: 'return-movement', label: '반품·이동·기타출고', order: 4 },
  { id: 'settlement-close', label: '정산·자금', order: 5 },
]

export const ZONE_GAP = 28

type ZonePlacement = { zoneId: ProcessZoneId; zoneOrder: number }

/** nodeId → zone (Overview 전용 — processZone 미지정 시 fallback) */
export const OVERVIEW_NODE_ZONES: Record<string, ZonePlacement> = {
  // 사업·계약·프로젝트
  opportunity: { zoneId: 'business-contract', zoneOrder: 0 },
  'business-review': { zoneId: 'business-contract', zoneOrder: 1 },
  'contract-register': { zoneId: 'business-contract', zoneOrder: 2 },
  'contract-approval': { zoneId: 'business-contract', zoneOrder: 3 },
  'project-register': { zoneId: 'business-contract', zoneOrder: 4 },
  'project-approval': { zoneId: 'business-contract', zoneOrder: 5 },

  // 구매·발주
  'purchase-request': { zoneId: 'purchase-order', zoneOrder: 0 },
  'master-data-split': { zoneId: 'purchase-order', zoneOrder: 1 },
  'product-check': { zoneId: 'purchase-order', zoneOrder: 2 },
  'vendor-check': { zoneId: 'purchase-order', zoneOrder: 2 },
  'product-register-request': { zoneId: 'purchase-order', zoneOrder: 2 },
  'product-register-approval': { zoneId: 'purchase-order', zoneOrder: 3 },
  'vendor-register': { zoneId: 'purchase-order', zoneOrder: 2 },
  'vendor-register-approval': { zoneId: 'purchase-order', zoneOrder: 3 },
  'master-data-complete': { zoneId: 'purchase-order', zoneOrder: 4 },
  'purchase-order': { zoneId: 'purchase-order', zoneOrder: 5 },
  'po-approval': { zoneId: 'purchase-order', zoneOrder: 6 },
  'inbound-info': { zoneId: 'purchase-order', zoneOrder: 7 },

  // 입고·재고·매입
  'inbound-check': { zoneId: 'inbound-inventory', zoneOrder: 0 },
  'inbound-confirm': { zoneId: 'inbound-inventory', zoneOrder: 1 },
  'stock-plus': { zoneId: 'inbound-inventory', zoneOrder: 2 },
  'ap-close': { zoneId: 'inbound-inventory', zoneOrder: 3 },
  'ap-voucher-pending': { zoneId: 'inbound-inventory', zoneOrder: 4 },
  'fi-posting': { zoneId: 'inbound-inventory', zoneOrder: 5 },

  // 판매·출고·매출
  'online-order': { zoneId: 'sales-shipment', zoneOrder: 0 },
  'order-sync': { zoneId: 'sales-shipment', zoneOrder: 1 },
  'order-register': { zoneId: 'sales-shipment', zoneOrder: 2 },
  'shipment-request': { zoneId: 'sales-shipment', zoneOrder: 3 },
  'shipment-check': { zoneId: 'sales-shipment', zoneOrder: 4 },
  'shipment-confirm': { zoneId: 'sales-shipment', zoneOrder: 5 },
  'stock-minus': { zoneId: 'sales-shipment', zoneOrder: 6 },
  'store-sales': { zoneId: 'sales-shipment', zoneOrder: 0 },
  'popup-sales': { zoneId: 'sales-shipment', zoneOrder: 1 },
  'concert-sales': { zoneId: 'sales-shipment', zoneOrder: 2 },
  'pos-easychain-sync': { zoneId: 'sales-shipment', zoneOrder: 3 },
  'popup-concert-stock-sales-sync': { zoneId: 'sales-shipment', zoneOrder: 4 },
  'sales-inquiry': { zoneId: 'sales-shipment', zoneOrder: 7 },
  'sales-close': { zoneId: 'sales-shipment', zoneOrder: 8 },
  'sales-posting': { zoneId: 'sales-shipment', zoneOrder: 9 },

  // 반품·이동·기타출고 — Overview 대표 노드
  'return-handling': { zoneId: 'return-movement', zoneOrder: 0 },
  'stock-transfer-handling': { zoneId: 'return-movement', zoneOrder: 1 },
  'other-issue-handling': { zoneId: 'return-movement', zoneOrder: 2 },

  // 정산·자금
  'consignment-stock-status': { zoneId: 'settlement-close', zoneOrder: 0 },
  'consignment-sales-register': { zoneId: 'settlement-close', zoneOrder: 1 },
  'consignment-sales-close': { zoneId: 'settlement-close', zoneOrder: 2 },
  'settlement-anomaly-check': { zoneId: 'settlement-close', zoneOrder: 3 },
  'exception-handling': { zoneId: 'settlement-close', zoneOrder: 4 },
  'prepayment-process': { zoneId: 'settlement-close', zoneOrder: 5 },
  'royalty-sales-aggregate': { zoneId: 'settlement-close', zoneOrder: 10 },
  'royalty-sales-close': { zoneId: 'settlement-close', zoneOrder: 11 },
  'mg-deduct-check': { zoneId: 'settlement-close', zoneOrder: 12 },
  'mg-offset-process': { zoneId: 'settlement-close', zoneOrder: 13 },
  'settlement-posting': { zoneId: 'settlement-close', zoneOrder: 14 },
  'regular-fund-execution': { zoneId: 'settlement-close', zoneOrder: 15 },
}

const ZONE_ORDER_INDEX = new Map(PROCESS_ZONES.map((z) => [z.id, z.order]))

export function fallbackZoneFromPhaseOrder(phaseOrder: number): ZonePlacement {
  if (phaseOrder <= 6) return { zoneId: 'business-contract', zoneOrder: phaseOrder - 1 }
  if (phaseOrder <= 11) return { zoneId: 'purchase-order', zoneOrder: phaseOrder - 7 }
  if (phaseOrder <= 17) return { zoneId: 'inbound-inventory', zoneOrder: phaseOrder - 12 }
  if (phaseOrder <= 27) return { zoneId: 'sales-shipment', zoneOrder: phaseOrder - 18 }
  if (phaseOrder <= 30) return { zoneId: 'return-movement', zoneOrder: phaseOrder - 28 }
  return { zoneId: 'settlement-close', zoneOrder: phaseOrder - 31 }
}

export function resolveNodeZone(node: Node): ZonePlacement {
  if (node.processZone) {
    return {
      zoneId: node.processZone,
      zoneOrder: node.cellOrder ?? node.zoneOrder ?? 0,
    }
  }
  const curated = OVERVIEW_NODE_ZONES[node.id]
  if (curated) return curated
  const phaseOrder = node.phaseOrder ?? 99
  return fallbackZoneFromPhaseOrder(phaseOrder)
}

export function zoneOrderIndex(zoneId: ProcessZoneId): number {
  return ZONE_ORDER_INDEX.get(zoneId) ?? 0
}

export function zoneDef(zoneId: ProcessZoneId): ProcessZoneDef {
  return PROCESS_ZONES.find((z) => z.id === zoneId) ?? PROCESS_ZONES[0]
}
