/**
 * Overview 노드 overviewType 재매핑 (PDF 범례 7종) + 연결선 라벨 보강
 *
 *   node scripts/migrate-overview-node-types.mjs
 */
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const overviewPath = path.join(root, 'src/data/toBeOverview/overview.json')
const statePath = path.join(root, 'public/process-data/state.json')

const OVERVIEW_NODE_DETAIL_PROCESS_IDS = {
  'purchase-request': ['business-to-project', 'consignment-purchase-receipt'],
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

const LEGACY_OVERVIEW_TYPE_MAP = {
  auto: null,
  approval: 'decision',
  interface: 'api',
  external: 'pos',
  exception: 'erp',
  'interface-rule': 'connection-point',
}

const POS_LANE = 'retail-easychain'
const WMS_LANE = 'warehouse-easyadmin'

function normSystem(system) {
  return (system ?? '').trim().toLowerCase()
}

function isCrossSystemFlow(system) {
  return system.includes('→') || system.includes('↔') || system.includes('api')
}

function isPosContext(system, laneId) {
  if (laneId === POS_LANE) return true
  return (
    system.includes('pos') ||
    system.includes('이지체인') ||
    system.includes('easychain') ||
    system.includes('매장')
  )
}

function isWmsOmsContext(system, laneId) {
  if (laneId === WMS_LANE) return true
  return (
    system.includes('wms') ||
    system.includes('oms') ||
    system.includes('이지어드민') ||
    system.includes('easyadmin')
  )
}

function resolveLinkedDetailIds(node) {
  if (node.detailProcessIds?.length) return node.detailProcessIds
  return OVERVIEW_NODE_DETAIL_PROCESS_IDS[node.id] ?? []
}

function inferOverviewNodeType(node) {
  const { type, system, laneId } = node
  const sys = normSystem(system)
  const hasLinked = resolveLinkedDetailIds(node).length > 0

  if (type === 'interface-rule') return 'connection-point'
  if (type === 'connector' || type === 'merge') return 'connector'
  if (hasLinked) return 'linked-process'
  if (type === 'decision' || type === 'approval' || type === 'document') return 'decision'
  if (type === 'manual') return 'manual'
  if (type === 'api' || (type === 'interface' && sys.includes('api'))) return 'api'
  if (type === 'interface' && isCrossSystemFlow(sys)) return 'api'
  if (isPosContext(sys, laneId)) {
    if (type === 'external') return 'pos'
    if (type === 'interface' && isCrossSystemFlow(sys)) return 'api'
    return 'pos'
  }
  if (isWmsOmsContext(sys, laneId)) {
    if (type === 'system' && isCrossSystemFlow(sys)) return 'api'
    if (type === 'interface') return sys.includes('api') ? 'api' : 'wms-oms'
    return 'wms-oms'
  }
  if (type === 'system') {
    if (isCrossSystemFlow(sys)) return 'api'
    return 'erp'
  }
  if (type === 'interface') return 'api'
  if (type === 'external') return 'pos'
  if (type === 'exception') return 'erp'
  return 'erp'
}

function remapOverviewType(node) {
  const legacy = LEGACY_OVERVIEW_TYPE_MAP[node.overviewType]
  if (legacy) return legacy
  return inferOverviewNodeType(node)
}

function systemToFlowLabel(system) {
  const raw = system?.trim()
  if (!raw) return undefined
  const normalized = raw.replace(/\s+/g, '')
  if (/erp→wms/i.test(normalized)) return '(ERP→WMS)'
  if (/wms→erp/i.test(normalized)) return '(WMS→ERP)'
  if (/pos→erp|이지체인→erp/i.test(normalized)) return '(POS→ERP)'
  if (/온라인몰→oms/i.test(normalized)) return '(온라인몰→OMS)'
  if (/api/i.test(raw)) return raw.includes('연동') ? 'API 연동' : 'API'
  if (/^erp$/i.test(raw)) return 'ERP'
  if (raw.includes('→') || raw.includes('↔')) return `(${raw})`
  return undefined
}

const COND_LABELS = {
  newProduct: '신규',
  existingProduct: '기존',
  newVendor: '신규',
  existingVendor: '기존',
  approved: 'Y',
  rejected: 'N',
  mgDeduct: 'Y',
  noMgDeduct: 'N',
  settlementAnomaly: 'Y',
  noSettlementAnomaly: 'N',
}

function enrichEdgeLabel(edge, nodesById) {
  if (edge.label?.trim()) return edge
  const condition = edge.condition?.trim()
  if (condition && COND_LABELS[condition]) {
    return { ...edge, label: COND_LABELS[condition] }
  }
  const source = nodesById[edge.source]
  const inferred = systemToFlowLabel(source?.system)
  if (inferred) return { ...edge, label: inferred }
  if (source?.type === 'interface' || edge.type === 'api') {
    return { ...edge, label: 'API' }
  }
  return edge
}

function migrateProcess(proc) {
  const nodesById = Object.fromEntries(proc.nodes.map((n) => [n.id, n]))
  let nodeChanges = 0
  let edgeChanges = 0

  const nodes = proc.nodes.map((node) => {
    const overviewType = remapOverviewType(node)
    if (node.overviewType === overviewType) return node
    nodeChanges += 1
    return { ...node, overviewType }
  })

  const refreshedById = Object.fromEntries(nodes.map((n) => [n.id, n]))
  const edges = proc.edges.map((edge) => {
    const next = enrichEdgeLabel(edge, refreshedById)
    if (next.label === edge.label) return edge
    edgeChanges += 1
    return next
  })

  return { nodes, edges, nodeChanges, edgeChanges }
}

function migrateOverviewFile(filePath) {
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  const { nodes, edges, nodeChanges, edgeChanges } = migrateProcess(raw)
  fs.writeFileSync(filePath, `${JSON.stringify({ ...raw, nodes, edges }, null, 2)}\n`)
  console.log(
    `${path.relative(root, filePath)}: ${nodeChanges} nodes, ${edgeChanges} edges updated`,
  )
}

function migrateState() {
  const raw = JSON.parse(fs.readFileSync(statePath, 'utf8'))
  const processes = raw.processes ?? raw
  let totalNodes = 0
  let totalEdges = 0
  const nextProcesses = processes.map((proc) => {
    const id = proc.meta?.id ?? proc.id
    if (id !== 'to-be-overview') return proc
    const { nodes, edges, nodeChanges, edgeChanges } = migrateProcess(proc)
    totalNodes += nodeChanges
    totalEdges += edgeChanges
    if (proc.meta) return { ...proc, nodes, edges }
    return { ...proc, nodes, edges }
  })
  const payload = raw.processes ? { ...raw, processes: nextProcesses } : nextProcesses
  fs.writeFileSync(statePath, `${JSON.stringify(payload, null, 2)}\n`)
  console.log(`state.json to-be-overview: ${totalNodes} nodes, ${totalEdges} edges updated`)
}

migrateOverviewFile(overviewPath)
migrateState()

// summary
const ov = JSON.parse(fs.readFileSync(overviewPath, 'utf8'))
const counts = {}
for (const n of ov.nodes) counts[n.overviewType] = (counts[n.overviewType] || 0) + 1
console.log('overviewType distribution:', counts)
const labeled = ov.edges.filter((e) => e.label?.trim()).length
console.log(`edges with label: ${labeled}/${ov.edges.length}`)
