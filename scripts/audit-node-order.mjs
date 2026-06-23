/**
 * Overview 노드 업무순서(cellOrder/phaseOrder/cellSlot) audit 및 선택적 수정
 *
 * Usage:
 *   node scripts/audit-node-order.mjs          # audit only
 *   node scripts/audit-node-order.mjs --fix    # state.json 수정
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const statePath = path.join(root, 'public/process-data/state.json')
const overviewPath = path.join(root, 'src/data/toBeOverview/overview.json')

const fix = process.argv.includes('--fix')

const state = JSON.parse(fs.readFileSync(statePath, 'utf8'))
const overview = JSON.parse(fs.readFileSync(overviewPath, 'utf8'))
const ov = state.processes.find((p) => p.id === 'to-be-overview')
if (!ov) throw new Error('to-be-overview not found')

const overviewById = new Map(overview.nodes.map((n) => [n.id, n]))

/** @type {Record<string, { zoneId: string, zoneOrder: number }>} */
const OVERVIEW_NODE_ZONES = {
  'purchase-request': { zoneId: 'purchase-order', zoneOrder: 0 },
  'product-check': { zoneId: 'purchase-order', zoneOrder: 2 },
  'vendor-check': { zoneId: 'purchase-order', zoneOrder: 2 },
  'product-register-request': { zoneId: 'purchase-order', zoneOrder: 2 },
  'product-register-approval': { zoneId: 'purchase-order', zoneOrder: 3 },
  'vendor-register': { zoneId: 'purchase-order', zoneOrder: 2 },
  'vendor-register-approval': { zoneId: 'purchase-order', zoneOrder: 3 },
  'purchase-order': { zoneId: 'purchase-order', zoneOrder: 5 },
  'po-approval': { zoneId: 'purchase-order', zoneOrder: 6 },
  'shipment-request': { zoneId: 'sales-shipment', zoneOrder: 3 },
  'order-register': { zoneId: 'sales-shipment', zoneOrder: 2 },
  'stock-plus': { zoneId: 'inbound-inventory', zoneOrder: 2 },
  'ap-close': { zoneId: 'inbound-inventory', zoneOrder: 3 },
  'fi-posting': { zoneId: 'inbound-inventory', zoneOrder: 5 },
}

/** cellOrder 0이 의도된 병렬 분기 노드 */
const PARALLEL_CELL_ORDER_ZERO = new Set([
  'purchase-request',
  'product-check',
  'vendor-check',
  'online-order',
  'popup-sales',
  'concert-sales',
])

function resolveCellOrder(node) {
  if (node.cellOrder != null) return node.cellOrder
  if (node.zoneOrder != null) return node.zoneOrder
  if (node.localOrder != null) return node.localOrder
  if (node.phaseOrder != null) return node.phaseOrder
  return 0
}

/** 잘못된 phaseOrder=1 + 비 business-contract zone */
const STALE_PHASE_ORDER_FIXES = {
  'node-mqhkso0a-7ceuz': {
    phaseId: 'procure-to-pay::p10',
    phaseOrder: 16,
    localOrder: 16,
    cellOrder: 3,
    cellSlot: 7,
    laneId: 'partnership',
    name: '매입마감조회',
    system: 'ERP',
    owner: '상생협력팀',
    description: '매입 마감 대상을 조회합니다.',
  },
  'node-mqhkwa5x-sihxe': {
    phaseId: 'procure-to-pay::p11',
    phaseOrder: 17,
    localOrder: 17,
    cellOrder: 4,
    cellSlot: 9,
    laneId: 'partnership',
    name: '전표생성(미결)',
    system: 'ERP',
    owner: '재무팀',
    description: '매입 전표 생성(미결) 처리합니다.',
  },
  'node-mqg215ai-glqwv': {
    phaseId: 'overview::return',
    phaseOrder: 28,
    localOrder: 28,
    cellOrder: 0,
    cellSlot: 7,
    laneId: 'business',
    name: '반품주문등록',
    system: 'ERP',
    owner: '사업부',
    description: '반품 주문을 등록합니다.',
  },
  'node-mqg2200t-bzgvl': {
    phaseId: 'overview::return',
    phaseOrder: 28,
    localOrder: 29,
    cellOrder: 1,
    cellSlot: 8,
    laneId: 'business',
    name: '출고반품요청',
    system: 'ERP→WMS',
    owner: '사업부',
    description: '출고 반품을 WMS로 요청합니다.',
  },
}

const REMOVE_NODE_IDS = new Set(['node-mqkfpf9l-jy7t5'])

const issues = []

function audit() {
  issues.length = 0

  for (const node of ov.nodes) {
    if (node.type === 'phase-connector') continue
    if (node.phaseOrder === 1 && node.processZone && node.processZone !== 'business-contract') {
      issues.push({
        kind: 'stale_phase_order',
        id: node.id,
        name: node.name,
        zone: node.processZone,
      })
    }
  }

  const slotGroups = new Map()
  for (const node of ov.nodes) {
    if (!node.processZone || node.cellSlot == null) continue
    const key = `${node.processZone}:${node.laneId}:${node.cellSlot}`
    if (!slotGroups.has(key)) slotGroups.set(key, [])
    slotGroups.get(key).push(node.id)
  }
  for (const [key, ids] of slotGroups) {
    if (ids.length > 1) {
      issues.push({ kind: 'cell_slot_duplicate', key, nodeIds: ids })
    }
  }

  for (const edge of ov.edges) {
    const src = ov.nodes.find((n) => n.id === edge.source)
    const tgt = ov.nodes.find((n) => n.id === edge.target)
    if (!src || !tgt || src.processZone !== tgt.processZone || src.laneId !== tgt.laneId) continue
    const so = resolveCellOrder(src)
    const to = resolveCellOrder(tgt)
    if (to > so + 1) {
      issues.push({
        kind: 'skip_edge',
        edgeId: edge.id,
        source: src.id,
        target: tgt.id,
        cellOrderGap: to - so,
      })
    }
  }

  return issues
}

function applyFixes() {
  const skipSync = new Set([
    ...Object.keys(STALE_PHASE_ORDER_FIXES),
    ...REMOVE_NODE_IDS,
  ])

  for (const node of ov.nodes) {
    if (skipSync.has(node.id)) continue
    const canonical = overviewById.get(node.id)
    if (!canonical) continue
    if (canonical.phaseOrder != null) node.phaseOrder = canonical.phaseOrder
    if (canonical.phaseId) node.phaseId = canonical.phaseId
    if (canonical.localOrder != null) node.localOrder = canonical.localOrder
    if (canonical.cellOrder != null) node.cellOrder = canonical.cellOrder
    if (canonical.cellSlot != null) node.cellSlot = canonical.cellSlot
    if (canonical.laneId) node.laneId = canonical.laneId
  }

  for (const [id, patch] of Object.entries(STALE_PHASE_ORDER_FIXES)) {
    const node = ov.nodes.find((n) => n.id === id)
    if (!node) continue
    Object.assign(node, patch)
  }

  ov.nodes = ov.nodes.filter((n) => !REMOVE_NODE_IDS.has(n.id))

  const edgeIdsRemove = new Set([
    'order-register-to-order-register-split',
    'edge-mqkfvpka-jsq9g',
  ])

  ov.edges = ov.edges.filter((e) => {
    if (edgeIdsRemove.has(e.id)) return false
    if (REMOVE_NODE_IDS.has(e.source) || REMOVE_NODE_IDS.has(e.target)) return false
    return true
  })

  const hasE24 = ov.edges.some((e) => e.id === 'main:e2e:24')
  if (!hasE24) {
    ov.edges.push({
      id: 'main:e2e:24',
      source: 'order-register',
      target: 'shipment-request',
      condition: '',
      label: '',
      type: 'normal',
      sourceHandle: 'bottom',
      targetHandle: 'top',
      routing: { mode: 'auto' },
    })
  }

  ov.lastModified = new Date().toISOString().slice(0, 10)
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2) + '\n')
}

const before = audit()
console.log('=== Node order audit ===')
console.log(`Issues: ${before.length}`)
for (const issue of before) {
  console.log(JSON.stringify(issue))
}

if (fix) {
  applyFixes()
  const after = audit()
  console.log('\n=== After fix ===')
  console.log(`Nodes: ${ov.nodes.length}, Edges: ${ov.edges.length}`)
  console.log(`Remaining issues: ${after.length}`)
  for (const issue of after) {
    console.log(JSON.stringify(issue))
  }
  console.log('\nWrote', statePath)
} else {
  console.log('\nRun with --fix to apply corrections.')
}
