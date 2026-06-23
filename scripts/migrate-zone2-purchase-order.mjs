/**
 * Zone 2 · 구매·발주 — state.json 을 overview.json 설계에 맞게 정렬
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const statePath = path.join(root, 'public/process-data/state.json')
const overviewPath = path.join(root, 'src/data/toBeOverview/overview.json')

const state = JSON.parse(fs.readFileSync(statePath, 'utf8'))
const overview = JSON.parse(fs.readFileSync(overviewPath, 'utf8'))

const ov = state.processes.find((p) => p.id === 'to-be-overview')
if (!ov) throw new Error('to-be-overview not found')

const overviewById = new Map(overview.nodes.map((n) => [n.id, n]))

const RENAME = {
  'node-mqhm27ka-y41py': 'product-register-request',
  'node-mqhm3415-s0x6r': 'product-register-approval',
  'node-mqhltm4t-el6dq': 'vendor-register-approval',
}

const REMOVE_NODE_IDS = new Set(['node-mqk4l3ai-882sn'])

const CANONICAL_PURCHASE_IDS = [
  'purchase-request',
  'master-data-split',
  'product-check',
  'vendor-check',
  'product-register-request',
  'product-register-approval',
  'vendor-register',
  'vendor-register-approval',
  'master-data-complete',
  'purchase-order',
  'po-approval',
]

const EDGE_IDS_REMOVE = new Set([
  'main:e2e:08',
  'main:e2e:09',
  'edge-mqjb3v8p-e6iks',
  'edge-mqhmwsvf-rpeh2',
  'edge-mqjb32xq-g0cr1',
  'edge-mqhfu68e-x0t2y',
  'edge-mqkfdcp5-j1yo2',
  'edge-mqk4m6m4-6ljdt',
  'edge-mqk4mvwu-y2wje',
])

const PROCURE_EDGE_IDS = new Set([
  'procure-to-pay:e00',
  'procure-to-pay:e01',
  'procure-to-pay:e01b',
  'procure-to-pay:e02',
  'procure-to-pay:e02a',
  'procure-to-pay:e02b',
  'procure-to-pay:e02c',
  'procure-to-pay:e02d',
  'procure-to-pay:e02e',
  'procure-to-pay:e02f',
  'procure-to-pay:e02g',
  'procure-to-pay:e04',
])

function remapId(id) {
  return RENAME[id] ?? id
}

// --- phases: merge missing from overview ---
const phaseById = new Map(state.commonMasters.phases.map((p) => [p.id, p]))
for (const phase of overview.meta.phases) {
  if (!phaseById.has(phase.id)) {
    state.commonMasters.phases.push({ ...phase })
    phaseById.set(phase.id, phase)
  }
}
if (!phaseById.has('procure-to-pay::p1b')) {
  state.commonMasters.phases.push({
    id: 'procure-to-pay::p1b',
    label: '기준정보 확인',
    order: 8,
  })
}
state.commonMasters.phases.sort((a, b) => a.order - b.order)

// --- nodes ---
const nodeById = new Map()
for (const node of ov.nodes) {
  if (REMOVE_NODE_IDS.has(node.id)) continue
  const id = remapId(node.id)
  let next = { ...node, id }
  if (overviewById.has(id)) {
    next = { ...overviewById.get(id) }
  } else if (RENAME[node.id]) {
    const canonical = overviewById.get(id)
    if (canonical) next = { ...canonical }
  }
  nodeById.set(id, next)
}

for (const id of CANONICAL_PURCHASE_IDS) {
  if (!nodeById.has(id) && overviewById.has(id)) {
    nodeById.set(id, { ...overviewById.get(id) })
  }
}

ov.nodes = [...nodeById.values()]

// --- edges ---
const edgeById = new Map()
for (const edge of ov.edges) {
  if (EDGE_IDS_REMOVE.has(edge.id)) continue
  if (REMOVE_NODE_IDS.has(edge.source) || REMOVE_NODE_IDS.has(edge.target)) continue
  if (RENAME[edge.source] || RENAME[edge.target]) {
    edgeById.set(edge.id, {
      ...edge,
      source: remapId(edge.source),
      target: remapId(edge.target),
      ...(edge.data ? { data: undefined } : {}),
    })
    continue
  }
  edgeById.set(edge.id, edge.data ? { ...edge, data: undefined } : edge)
}

for (const edge of overview.edges) {
  if (!PROCURE_EDGE_IDS.has(edge.id)) continue
  edgeById.set(edge.id, { ...edge })
}

// purchase-order ↔ po-approval from overview
for (const edge of overview.edges) {
  if (edge.id === 'edge-mqfxrz2i-9kkfw' || edge.id === 'edge-mqfxx3lq-4c11a') {
    edgeById.set(edge.id, { ...edge })
  }
}

// po-approval Y → inbound-info (keep existing if present)
const poToInbound = ov.edges.find((e) => e.source === 'po-approval' && e.target === 'inbound-info')
if (poToInbound && !EDGE_IDS_REMOVE.has(poToInbound.id)) {
  edgeById.set(poToInbound.id, { ...poToInbound, data: undefined })
}

ov.edges = [...edgeById.values()]

// --- zones ---
const masterZone = {
  id: 'zone-master-data-check',
  name: '기준정보 확인 / 신규 신청',
  type: 'process-zone',
  laneIds: [],
  phaseIds: [],
  nodeIds: [
    'master-data-split',
    'product-check',
    'product-register-request',
    'product-register-approval',
    'vendor-check',
    'vendor-register',
    'vendor-register-approval',
    'master-data-complete',
  ],
  style: {
    showBackground: true,
    showBorder: true,
    borderStyle: 'dashed',
    visible: true,
    opacity: 0.12,
  },
}

const zones = ov.zones ?? []
const zoneIdx = zones.findIndex((z) => z.name?.includes('기준정보') || z.id === 'zone-mqi2txz2-2t3l6')
if (zoneIdx >= 0) {
  zones[zoneIdx] = masterZone
} else {
  zones.push(masterZone)
}
ov.zones = zones

ov.lastModified = new Date().toISOString().slice(0, 10)

fs.writeFileSync(statePath, JSON.stringify(state, null, 2) + '\n')

console.log('Migration complete.')
console.log('Nodes:', ov.nodes.length)
console.log('Edges:', ov.edges.length)
console.log(
  'Purchase zone nodes:',
  ov.nodes.filter((n) => n.processZone === 'purchase-order').map((n) => n.id).join(', '),
)
