/**
 * 정산·마감 Zone — 사업부 lane 정렬, 누락 노드/엣지 보강
 *
 *   node scripts/migrate-settlement-business-division.mjs
 */
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const statePath = path.join(root, 'public/process-data/state.json')

const BUSINESS_LANE = 'business'
const BUSINESS_OWNER = '사업부'

const BUSINESS_NODE_IDS = new Set([
  'consignment-sales-register',
  'consignment-sales-close',
  'settlement-anomaly-check',
  'exception-handling',
  'royalty-sales-aggregate',
  'royalty-sales-close',
  'mg-deduct-check',
  'mg-offset-process',
  'settlement-posting',
  'settlement-fi-posting',
])

const NODE_DESCRIPTIONS = {
  'consignment-sales-register': '1차 위탁매출을 집계·등록합니다.',
  'consignment-sales-close': '위탁매출 마감을 확정합니다.',
  'settlement-anomaly-check': '정산 이상 여부를 확인합니다.',
  'exception-handling': '마감·정산 예외 사항을 처리합니다.',
  'royalty-sales-aggregate': '로열티 매출을 집계합니다.',
  'royalty-sales-close': '로열티 매출 마감을 확정합니다.',
  'mg-deduct-check': '로열티 MG 차감 대상 여부를 확인합니다.',
  'mg-offset-process': 'MG 상계를 처리합니다.',
  'settlement-posting': '정산 전표를 처리합니다.',
  'settlement-fi-posting': '정산 회계전표를 장부에 반영합니다.',
}

const SETTLEMENT_FI_POSTING_NODE = {
  id: 'settlement-fi-posting',
  name: '회계전표 반영',
  type: 'system',
  laneId: BUSINESS_LANE,
  phaseId: 'overview::royalty-mg',
  phaseOrder: 32,
  localOrder: 32,
  processZone: 'settlement-close',
  cellOrder: 9,
  system: 'ERP',
  owner: BUSINESS_OWNER,
  description: NODE_DESCRIPTIONS['settlement-fi-posting'],
  inputs: [],
  outputs: [],
  controls: [],
}

const SETTLEMENT_ANOMALY_NODE = {
  id: 'settlement-anomaly-check',
  name: '정산 이상여부',
  type: 'decision',
  laneId: BUSINESS_LANE,
  phaseId: 'overview::consignment',
  phaseOrder: 31,
  localOrder: 31,
  processZone: 'settlement-close',
  cellOrder: 3,
  system: 'ERP',
  owner: BUSINESS_OWNER,
  description: NODE_DESCRIPTIONS['settlement-anomaly-check'],
  inputs: [],
  outputs: [],
  controls: [],
}

function patchOverviewNode(node) {
  if (!BUSINESS_NODE_IDS.has(node.id)) return node

  const next = {
    ...node,
    laneId: BUSINESS_LANE,
    owner: BUSINESS_OWNER,
  }

  if (NODE_DESCRIPTIONS[node.id]) {
    next.description = NODE_DESCRIPTIONS[node.id]
  }

  if (node.id === 'mg-deduct-check') {
    next.name = 'MG 차감여부'
  }

  return next
}

function ensureNode(nodes, node) {
  const idx = nodes.findIndex((n) => n.id === node.id)
  if (idx >= 0) {
    nodes[idx] = { ...nodes[idx], ...node }
    return nodes
  }
  const postingIdx = nodes.findIndex((n) => n.id === 'settlement-posting')
  if (postingIdx >= 0) {
    nodes.splice(postingIdx + 1, 0, node)
    return nodes
  }
  nodes.push(node)
  return nodes
}

function ensureEdge(edges, edge) {
  if (edges.some((e) => e.id === edge.id)) return edges
  edges.push({
    routing: { mode: 'auto', handleAuto: true },
    sourceHandle: 'bottom',
    targetHandle: 'top',
    condition: '',
    label: '',
    ...edge,
  })
  return edges
}

function patchDetailNode(node) {
  if (!BUSINESS_NODE_IDS.has(node.id)) return node
  const next = { ...node, laneId: BUSINESS_LANE, owner: BUSINESS_OWNER }
  if (NODE_DESCRIPTIONS[node.id]) next.description = NODE_DESCRIPTIONS[node.id]
  if (node.id === 'mg-deduct-check') next.name = 'MG 차감여부'
  return next
}

const raw = JSON.parse(fs.readFileSync(statePath, 'utf8'))
const overview = raw.processes.find((p) => p.type === 'overview')
if (!overview) throw new Error('overview process not found')

overview.nodes = overview.nodes.map(patchOverviewNode)
overview.nodes = ensureNode(overview.nodes, SETTLEMENT_ANOMALY_NODE)
overview.nodes = ensureNode(overview.nodes, SETTLEMENT_FI_POSTING_NODE)

overview.edges = ensureEdge(overview.edges, {
  id: 'sub:consignment:08',
  source: 'exception-handling',
  target: 'prepayment-process',
  type: 'normal',
})
overview.edges = ensureEdge(overview.edges, {
  id: 'sub:royalty:06',
  source: 'settlement-posting',
  target: 'settlement-fi-posting',
  type: 'normal',
})
overview.edges = ensureEdge(overview.edges, {
  id: 'sub:consignment:09',
  source: 'settlement-posting',
  target: 'settlement-fi-posting',
  type: 'normal',
})

for (const proc of raw.processes) {
  if (proc.id === 'consignment-settlement') {
    proc.nodes = proc.nodes.map(patchDetailNode)
    proc.nodes = ensureNode(proc.nodes, {
      id: 'exception-handling',
      name: '예외사항처리',
      type: 'exception',
      laneId: BUSINESS_LANE,
      phaseId: 'p4b',
      system: 'ERP',
      owner: BUSINESS_OWNER,
      description: NODE_DESCRIPTIONS['exception-handling'],
      inputs: [],
      outputs: [],
      controls: [],
      phaseOrder: 4,
      localOrder: 4,
    })
    proc.nodes = ensureNode(proc.nodes, {
      ...SETTLEMENT_FI_POSTING_NODE,
      phaseId: 'p8',
      phaseOrder: 8,
      localOrder: 8,
    })
    proc.edges = ensureEdge(proc.edges, {
      id: 'e04',
      source: 'settlement-anomaly-check',
      target: 'exception-handling',
      condition: 'settlementAnomaly',
      label: 'Y',
      type: 'condition',
    })
    proc.edges = ensureEdge(proc.edges, {
      id: 'e08',
      source: 'exception-handling',
      target: 'prepayment-process',
      type: 'normal',
    })
    proc.edges = ensureEdge(proc.edges, {
      id: 'e09',
      source: 'settlement-posting',
      target: 'settlement-fi-posting',
      type: 'normal',
    })
  }

  if (proc.id === 'royalty-mg-settlement') {
    proc.nodes = proc.nodes.map(patchDetailNode)
    proc.nodes = ensureNode(proc.nodes, {
      ...SETTLEMENT_FI_POSTING_NODE,
      phaseId: 'p6',
      phaseOrder: 6,
      localOrder: 6,
    })
    proc.edges = ensureEdge(proc.edges, {
      id: 'e07',
      source: 'settlement-posting',
      target: 'settlement-fi-posting',
      type: 'normal',
    })
  }
}

raw.exportedAt = new Date().toISOString()
fs.writeFileSync(statePath, `${JSON.stringify(raw, null, 2)}\n`, 'utf8')
console.log('Updated', statePath)
