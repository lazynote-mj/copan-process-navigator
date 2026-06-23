/**
 * Overview return-movement zone: remove detail step nodes, keep 3 hub nodes only.
 * Run: node scripts/migrate-return-movement-hubs.mjs
 */
import fs from 'fs'

const REMOVE_NODE_IDS = new Set([
  'return-shipment-request',
  'return-inbound-check',
  'return-inbound-register',
  'return-confirm',
  'warehouse-transfer-request',
  'warehouse-transfer',
  'warehouse-transfer-confirm',
  'free-gift-approval',
  'other-outbound-request',
  'other-outbound-confirm',
  'store-transfer-rt',
  'store-transfer',
  'node-mqg215ai-glqwv',
  // overview.json only — legacy return detail
  'node-mqg2200t-bzgvl',
])

const HUB_NODES = [
  {
    id: 'return-handling',
    name: '반품',
    type: 'interface',
    laneId: 'business',
    phaseId: 'overview::return',
    phaseOrder: 28,
    localOrder: 28,
    processZone: 'return-movement',
    cellOrder: 0,
    cellSlot: 1,
    system: 'ERP·WMS',
    owner: '사업부',
    description: '반품 처리 — Detail 프로세스로 이동',
    detailProcessIds: ['b2b-domestic-return'],
    inputs: [],
    outputs: [],
    controls: [],
    overviewType: 'linked-process',
  },
  {
    id: 'stock-transfer-handling',
    name: '재고이동',
    type: 'interface',
    laneId: 'business',
    phaseId: 'overview::warehouse-transfer',
    phaseOrder: 29,
    localOrder: 29,
    processZone: 'return-movement',
    cellOrder: 0,
    cellSlot: 2,
    system: 'ERP·WMS',
    owner: '사업부',
    description: '창고 간 재고 이동 — Detail 프로세스로 이동',
    detailProcessIds: ['stock-transfer'],
    inputs: [],
    outputs: [],
    controls: [],
    overviewType: 'linked-process',
  },
  {
    id: 'other-issue-handling',
    name: '기타출고',
    type: 'interface',
    laneId: 'business',
    phaseId: 'overview::other-outbound',
    phaseOrder: 30,
    localOrder: 30,
    processZone: 'return-movement',
    cellOrder: 0,
    cellSlot: 3,
    system: 'ERP·WMS',
    owner: '사업부',
    description: '무상증정·기타출고 — Detail 프로세스로 이동',
    detailProcessIds: ['other-issue'],
    inputs: [],
    outputs: [],
    controls: [],
    overviewType: 'linked-process',
  },
]

const PROCESS_GROUP_PATCHES = {
  'sub-returns': {
    overviewNodeIds: ['return-handling'],
    overviewEdgeIds: [],
  },
  'sub-warehouse-transfer': {
    overviewNodeIds: ['stock-transfer-handling'],
    overviewEdgeIds: [],
  },
  'sub-other-outbound': {
    overviewNodeIds: ['other-issue-handling'],
    overviewEdgeIds: [],
  },
}

function touchesRemoved(edge) {
  return REMOVE_NODE_IDS.has(edge.source) || REMOVE_NODE_IDS.has(edge.target)
}

function migrateOverviewProcess(process) {
  const kept = process.nodes.filter((n) => !REMOVE_NODE_IDS.has(n.id))
  const hubIds = new Set(HUB_NODES.map((h) => h.id))
  const withoutHubs = kept.filter((n) => !hubIds.has(n.id))
  process.nodes = [...withoutHubs, ...HUB_NODES]

  process.edges = process.edges.filter((e) => !touchesRemoved(e))

  // Fix consignment return rule zone (was misplaced in return-movement in overview shell)
  for (const node of process.nodes) {
    if (node.id === 'interface-rule-consignment-return') {
      node.processZone = 'sales-shipment'
      node.laneId = node.laneId ?? 'warehouse-easyadmin'
    }
  }

  if (process.zones?.length) {
    for (const zone of process.zones) {
      if (zone.nodeIds?.length) {
        zone.nodeIds = zone.nodeIds.filter((id) => !REMOVE_NODE_IDS.has(id))
        for (const hub of HUB_NODES) {
          if (hub.processZone === zone.id && !zone.nodeIds.includes(hub.id)) {
            zone.nodeIds.push(hub.id)
          }
        }
      }
    }
  }
}

function patchProcessGroups(groups) {
  if (!groups?.length) return groups
  const byId = new Map(groups.map((g) => [g.id, g]))
  for (const [id, patch] of Object.entries(PROCESS_GROUP_PATCHES)) {
    const group = byId.get(id)
    if (group) {
      group.overviewNodeIds = patch.overviewNodeIds
      group.overviewEdgeIds = patch.overviewEdgeIds
    } else if (id === 'sub-warehouse-transfer') {
      groups.push({
        id: 'sub-warehouse-transfer',
        name: '재고이동',
        description: '창고 간 재고 이동 — Overview 대표 노드에서 상세 프로세스로 이동',
        overviewNodeIds: patch.overviewNodeIds,
        overviewEdgeIds: patch.overviewEdgeIds,
        detailProcessId: 'stock-transfer',
      })
    }
  }
  return groups
}

function run() {
  const statePath = 'public/process-data/state.json'
  const overviewPath = 'src/data/toBeOverview/overview.json'
  const groupsPath = 'src/data/toBeOverview/process-groups.json'

  const state = JSON.parse(fs.readFileSync(statePath, 'utf8'))
  const overview = JSON.parse(fs.readFileSync(overviewPath, 'utf8'))
  const groups = JSON.parse(fs.readFileSync(groupsPath, 'utf8'))

  const stateOverview = state.processes.find((p) => p.id === 'to-be-overview')
  if (!stateOverview) throw new Error('to-be-overview not found in state.json')

  migrateOverviewProcess(stateOverview)
  migrateOverviewProcess(overview)

  state.processGroups = patchProcessGroups(state.processGroups ?? groups)
  const nextGroups = patchProcessGroups(groups)

  fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`)
  fs.writeFileSync(overviewPath, `${JSON.stringify(overview, null, 2)}\n`)
  fs.writeFileSync(groupsPath, `${JSON.stringify(nextGroups, null, 2)}\n`)

  const rm = stateOverview.nodes.filter((n) => n.processZone === 'return-movement')
  console.log('return-movement nodes after migration:', rm.map((n) => n.id).join(', '))
  console.log(
    'removed edges from state:',
    stateOverview.edges.filter((e) =>
      ['edge-mqkzfoiy-0l55o', 'edge-mqkzg8y5-pyppw', 'edge-mqkzgpt2-um35d', 'edge-mqm2foyb-a5b91', 'edge-mqnno2sk-y28g1'].includes(e.id),
    ).length === 0
      ? 'ok (all gone)'
      : 'some remain',
  )
}

run()
