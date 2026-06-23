#!/usr/bin/env node
/**
 * SCM TO-BE flat detail process JSON 생성 (1회성 빌드 스크립트)
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '../src/data/processes')

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'))
}

function fixLanes(nodes) {
  return nodes.map((n) => ({
    ...n,
    laneId: n.laneId === 'warehouse' ? 'warehouse-easyadmin' : n.laneId,
  }))
}

function shell({
  id,
  name,
  description,
  overviewNodeId,
  nodes,
  edges,
  phases = [],
}) {
  return {
    id,
    name,
    source: 'SCM TO-BE',
    version: 'v1.0',
    description,
    overviewNodeId,
    status: 'draft',
    lastModified: '2026-06-15',
    owner: 'ERP PMO',
    phases,
    lanes: [],
    nodes: fixLanes(nodes),
    edges,
  }
}

function node(id, name, laneId, localOrder, type = 'erp', system = 'ERP', owner = '사업부') {
  return {
    id,
    name,
    type,
    laneId,
    phaseId: `p${localOrder}`,
    system,
    owner,
    description: name,
    inputs: [],
    outputs: [],
    controls: [],
    phaseOrder: localOrder,
    localOrder,
  }
}

function chainEdges(ids, type = 'normal') {
  return ids.slice(0, -1).map((source, i) => ({
    id: `e${String(i + 1).padStart(2, '0')}`,
    source,
    target: ids[i + 1],
    condition: '',
    label: '',
    type,
  }))
}

const btpCanonical = readJson(path.join(root, 'business-to-purchase-request.json'))

const p2apNodes = readJson(path.join(root, 'procure-to-pay/nodes.json'))
const p2apEdges = readJson(path.join(root, 'procure-to-pay/edges.json'))

const returnNodes = readJson(path.join(root, 'return-process/nodes.json'))
const returnEdges = readJson(path.join(root, 'return-process/edges.json'))

const transferNodes = readJson(path.join(root, 'stock-transfer-process/nodes.json'))
const transferEdges = readJson(path.join(root, 'stock-transfer-process/edges.json'))

const otherNodes = readJson(path.join(root, 'other-issue-process/nodes.json'))
const otherEdges = readJson(path.join(root, 'other-issue-process/edges.json'))

const orderFlowIds = [
  'order-register',
  'shipment-request',
  'shipment-check',
  'shipment-register',
  'shipment-confirm',
  'stock-minus',
  'sales-close',
  'sales-posting',
]

const b2bDomesticNodes = [
  node('order-register', '주문등록', 'business', 1),
  node('shipment-request', '출고요청', 'business', 2, 'interface', 'ERP→WMS'),
  node('shipment-check', '출고확인', 'warehouse-easyadmin', 3, 'manual', 'WMS', '물류센터'),
  node('shipment-register', '출고등록', 'warehouse-easyadmin', 4, 'interface', 'WMS', '물류센터'),
  node('shipment-confirm', '출고확정', 'warehouse-easyadmin', 5, 'interface', 'WMS→ERP', '물류센터'),
  node('stock-minus', '재고인식(-)', 'warehouse-easyadmin', 6, 'system', 'ERP', '물류센터'),
  node('sales-close', '매출마감확정', 'finance', 7, 'erp', 'ERP', '재무팀'),
  node('sales-posting', '매출전표 반영', 'finance', 8, 'system', 'ERP', '재무팀'),
]

const consignmentReceiptNodes = [
  node('purchase-request', '구매요청', 'business', 1),
  node('consignment-po', '판매대행 발주', 'partnership', 2, 'erp', 'ERP', '상생협력팀'),
  node('consignment-inbound-info', '입고정보전달', 'partnership', 3, 'interface', 'ERP→WMS API', '상생협력팀'),
  node('consignment-inbound-check', '입고확인', 'warehouse-easyadmin', 4, 'manual', 'WMS', '물류센터'),
  node('consignment-inbound-register', '입고등록', 'warehouse-easyadmin', 5, 'interface', 'WMS', '물류센터'),
  node('consignment-inbound-confirm', '입고확정', 'warehouse-easyadmin', 6, 'interface', 'WMS→ERP', '물류센터'),
  node('consignment-stock-plus', '위탁재고인식(+)', 'finance', 7, 'system', 'ERP', '재무팀'),
]

const consignmentSettlementNodes = [
  node('consignment-stock-status', '위탁재고현황', 'partnership', 1, 'erp', 'ERP', '상생협력팀'),
  node('consignment-sales-register', '위탁매출마감등록', 'finance', 2),
  node('consignment-sales-close', '위탁매출마감확정', 'finance', 3),
  node('settlement-anomaly-check', '정산 이상여부', 'finance', 4, 'decision'),
  node('prepayment-process', '선수금처리', 'finance', 5),
  node('regular-fund-execution', '정기자금집행', 'finance', 6),
  node('settlement-posting', '정산전표처리', 'finance', 7, 'system'),
]

const royaltyNodes = [
  node('royalty-sales-aggregate', '로열티매출집계', 'finance', 1, 'system'),
  node('royalty-sales-close', '로열티매출마감확정', 'finance', 2),
  node('mg-deduct-check', 'MG상계여부', 'finance', 3, 'decision'),
  node('mg-offset-process', 'MG상계처리', 'finance', 4),
  node('settlement-posting', '정산전표처리', 'finance', 5, 'system'),
]

const processes = [
  btpCanonical,
  shell({
    id: 'purchase-to-ap-invoice',
    name: '구매요청 ~ 입고 ~ 매입전표',
    description: '구매요청부터 입고·재고인식·매입마감·회계전표까지',
    overviewNodeId: 'purchase-request',
    nodes: p2apNodes,
    edges: p2apEdges,
  }),
  shell({
    id: 'consignment-purchase-receipt',
    name: '구매요청 ~ 입고 : 판매대행',
    description: '판매대행(위탁) 구매·입고 프로세스',
    overviewNodeId: 'purchase-request',
    nodes: consignmentReceiptNodes,
    edges: chainEdges(consignmentReceiptNodes.map((n) => n.id)),
  }),
  shell({
    id: 'b2b-domestic-order-to-sales',
    name: '주문등록 ~ 출고 ~ 매출전표 : B2B 국내',
    description: 'B2B 국내 주문부터 출고·매출전표까지',
    overviewNodeId: 'order-register',
    nodes: b2bDomesticNodes,
    edges: chainEdges(orderFlowIds),
  }),
  shell({
    id: 'b2b-domestic-return',
    name: '주문반품 ~ 입고 ~ 반품전표 : B2B 국내',
    description: 'B2B 국내 반품 주문부터 입고·재고·매출마감·전표까지',
    overviewNodeId: 'return-handling',
    nodes: returnNodes,
    edges: returnEdges,
  }),
  shell({
    id: 'b2b-export-order-to-sales',
    name: '주문등록 ~ 수출출고 ~ 매출전표 : B2B 해외',
    description: 'B2B 해외(수출) 주문·수출출고·매출전표',
    overviewNodeId: 'order-register',
    nodes: [
      node('export-order-register', '수출주문등록', 'business', 1),
      node('export-customs-check', '수출통관확인', 'partnership', 2, 'erp', 'ERP', '상생협력팀'),
      node('export-shipment-request', '수출출고요청', 'business', 3, 'interface', 'ERP→WMS'),
      node('export-shipment-confirm', '수출출고확정', 'warehouse-easyadmin', 4, 'interface', 'WMS→ERP', '물류센터'),
      node('export-stock-minus', '재고인식(-)', 'warehouse-easyadmin', 5, 'system', 'ERP', '물류센터'),
      node('export-sales-close', '매출마감확정', 'finance', 6, 'erp', 'ERP', '재무팀'),
      node('export-sales-posting', '매출전표 반영', 'finance', 7, 'system', 'ERP', '재무팀'),
    ],
    edges: chainEdges([
      'export-order-register',
      'export-customs-check',
      'export-shipment-request',
      'export-shipment-confirm',
      'export-stock-minus',
      'export-sales-close',
      'export-sales-posting',
    ]),
  }),
  shell({
    id: 'b2c-order-to-sales',
    name: '주문등록 ~ 출고 ~ 매출전표 : B2C',
    description: 'B2C(온라인) 주문·출고·매출전표',
    overviewNodeId: 'order-register',
    nodes: [
      node('online-order', '온라인주문', 'business', 1, 'external', 'Cafe24'),
      node('order-sync', '주문정보연동', 'business', 2, 'interface', 'OMS API'),
      node('b2c-order-register', '주문등록', 'business', 3),
      ...b2bDomesticNodes.slice(1),
    ],
    edges: chainEdges([
      'online-order',
      'order-sync',
      'b2c-order-register',
      ...orderFlowIds.slice(1),
    ]),
  }),
  shell({
    id: 'preorder-to-sales',
    name: '예약판매 ~ 출고 ~ 매출전표',
    description: '예약판매 주문·출고·매출전표',
    overviewNodeId: 'order-register',
    nodes: [
      node('preorder-register', '예약판매등록', 'business', 1),
      node('preorder-deposit', '예약금수령', 'finance', 2, 'erp', 'ERP', '재무팀'),
      node('preorder-shipment-request', '출고요청', 'business', 3, 'interface', 'ERP→WMS'),
      node('preorder-shipment-confirm', '출고확정', 'warehouse-easyadmin', 4, 'interface', 'WMS→ERP', '물류센터'),
      node('preorder-stock-minus', '재고인식(-)', 'warehouse-easyadmin', 5, 'system', 'ERP', '물류센터'),
      node('preorder-sales-close', '매출마감확정', 'finance', 6, 'erp', 'ERP', '재무팀'),
      node('preorder-sales-posting', '매출전표 반영', 'finance', 7, 'system', 'ERP', '재무팀'),
    ],
    edges: chainEdges([
      'preorder-register',
      'preorder-deposit',
      'preorder-shipment-request',
      'preorder-shipment-confirm',
      'preorder-stock-minus',
      'preorder-sales-close',
      'preorder-sales-posting',
    ]),
  }),
  shell({
    id: 'stock-transfer',
    name: '창고이동 / 재고이동',
    description: '창고이동 요청부터 WMS 처리·Location 반영까지',
    overviewNodeId: 'stock-transfer-handling',
    nodes: transferNodes,
    edges: transferEdges,
  }),
  shell({
    id: 'other-issue',
    name: '기타출고',
    description: '기타출고·무상증정 품의·WMS 출고·재고차감',
    overviewNodeId: 'other-issue-handling',
    nodes: otherNodes,
    edges: otherEdges,
  }),
  shell({
    id: 'consignment-settlement',
    name: '위탁정산',
    description: '위탁 재고·매출 마감·정산전표',
    overviewNodeId: 'settlement-posting',
    nodes: consignmentSettlementNodes,
    edges: [
      ...chainEdges([
        'consignment-stock-status',
        'consignment-sales-register',
        'consignment-sales-close',
        'settlement-anomaly-check',
      ]),
      {
        id: 'e05',
        source: 'settlement-anomaly-check',
        target: 'prepayment-process',
        condition: 'noSettlementAnomaly',
        label: 'N',
        type: 'condition',
      },
      ...chainEdges(['prepayment-process', 'regular-fund-execution', 'settlement-posting']),
    ],
  }),
  shell({
    id: 'royalty-mg-settlement',
    name: '로열티 / MG 정산',
    description: '로열티 매출 집계·MG 상계·정산전표',
    overviewNodeId: 'settlement-posting',
    nodes: royaltyNodes,
    edges: [
      ...chainEdges(['royalty-sales-aggregate', 'royalty-sales-close', 'mg-deduct-check']),
      {
        id: 'e04',
        source: 'mg-deduct-check',
        target: 'mg-offset-process',
        condition: 'mgDeduct',
        label: 'Y',
        type: 'condition',
      },
      {
        id: 'e05',
        source: 'mg-deduct-check',
        target: 'settlement-posting',
        condition: 'noMgDeduct',
        label: 'N',
        type: 'condition',
      },
      { id: 'e06', source: 'mg-offset-process', target: 'settlement-posting', condition: '', label: '', type: 'normal' },
    ],
  }),
]

for (const proc of processes) {
  const file = path.join(root, `${proc.id}.json`)
  fs.writeFileSync(file, `${JSON.stringify(proc, null, 2)}\n`)
  console.log('wrote', file)
}

const registry = {
  source: 'SCM TO-BE',
  version: 'v1.0',
  processes: processes.map((p) => ({
    id: p.id,
    file: `${p.id}.json`,
    name: p.name,
    overviewNodeId: p.overviewNodeId,
  })),
}

fs.writeFileSync(
  path.join(__dirname, '../src/data/processRegistry.json'),
  `${JSON.stringify(registry, null, 2)}\n`,
)
console.log('wrote processRegistry.json')
