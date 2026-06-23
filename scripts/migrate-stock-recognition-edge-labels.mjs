/**
 * PDF Overview: 재고인식(+/-)는 노드가 아니라 연결선 라벨.
 * stock-plus / stock-minus 노드 제거 후 edge label로 이전.
 *
 *   node scripts/migrate-stock-recognition-edge-labels.mjs
 */
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const overviewPath = path.join(root, 'src/data/toBeOverview/overview.json')
const statePath = path.join(root, 'public/process-data/state.json')
const processGroupsPath = path.join(root, 'src/data/toBeOverview/process-groups.json')
const e2ePath = path.join(root, 'src/data/toBeOverview/e2e-main-flow.json')
const subFlowsPath = path.join(root, 'src/data/toBeOverview/sub-process-flows.json')

const STOCK_NODE_IDS = new Set(['stock-plus', 'stock-minus'])

const CONFIRM_NODE_PATCH = {
  'inbound-confirm': { type: 'system', overviewType: 'wms-oms' },
  'shipment-confirm': { type: 'system', overviewType: 'wms-oms' },
  'return-confirm': { type: 'system', overviewType: 'wms-oms' },
}

function patchConfirmNodes(nodes) {
  return nodes.map((node) => {
    const patch = CONFIRM_NODE_PATCH[node.id]
    if (!patch) return node
    return { ...node, ...patch }
  })
}

function removeStockNodes(nodes) {
  return nodes.filter((node) => !STOCK_NODE_IDS.has(node.id))
}

function remapEdges(edges) {
  const removedIds = new Set()
  let next = edges.filter((edge) => {
    if (STOCK_NODE_IDS.has(edge.source) || STOCK_NODE_IDS.has(edge.target)) {
      removedIds.add(edge.id)
      return false
    }
    return true
  })

  const has = (source, target) => next.some((e) => e.source === source && e.target === target)

  const add = (edge) => {
    if (has(edge.source, edge.target)) {
      next = next.map((e) =>
        e.source === edge.source && e.target === edge.target
          ? { ...e, label: edge.label, type: edge.type ?? e.type }
          : e,
      )
      return
    }
    next.push(edge)
  }

  add({
    id: 'overview:inbound-info-check',
    source: 'inbound-info',
    target: 'inbound-check',
    condition: '',
    label: 'API',
    type: 'system',
    sourceHandle: 'bottom',
    targetHandle: 'top',
    routing: { mode: 'auto' },
  })

  add({
    id: 'overview:inbound-check-confirm',
    source: 'inbound-check',
    target: 'inbound-confirm',
    condition: '',
    label: 'API',
    type: 'system',
    sourceHandle: 'right',
    targetHandle: 'left',
    routing: { mode: 'auto' },
  })

  add({
    id: 'overview:inbound-confirm-ap',
    source: 'inbound-confirm',
    target: 'ap-close',
    condition: '',
    label: '재고인식(+)',
    type: 'system',
    sourceHandle: 'right',
    targetHandle: 'left',
    routing: { mode: 'auto' },
  })

  add({
    id: 'overview:shipment-confirm-stock-minus',
    source: 'shipment-confirm',
    target: 'sales-inquiry',
    condition: '',
    label: '재고인식(-)',
    type: 'system',
    sourceHandle: 'right',
    targetHandle: 'left',
    routing: { mode: 'auto' },
  })

  add({
    id: 'overview:return-confirm-stock-plus',
    source: 'return-confirm',
    target: 'sales-inquiry',
    condition: '',
    label: '재고인식(+)',
    type: 'system',
    sourceHandle: 'right',
    targetHandle: 'left',
    routing: { mode: 'auto' },
  })

  return { edges: next, removedIds }
}

function migrateProcess(proc) {
  const nodes = patchConfirmNodes(removeStockNodes(proc.nodes))
  const { edges } = remapEdges(proc.edges)
  return { ...proc, nodes, edges }
}

function migrateOverviewFile(filePath) {
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  const migrated = migrateProcess(raw)
  fs.writeFileSync(filePath, `${JSON.stringify(migrated, null, 2)}\n`)
  console.log(
    `${path.relative(root, filePath)}: nodes ${raw.nodes.length}→${migrated.nodes.length}, edges ${raw.edges.length}→${migrated.edges.length}`,
  )
}

function migrateState() {
  const raw = JSON.parse(fs.readFileSync(statePath, 'utf8'))
  const processes = raw.processes ?? raw
  const next = processes.map((proc) => {
    const id = proc.meta?.id ?? proc.id
    if (id !== 'to-be-overview') return proc
    return migrateProcess(proc)
  })
  fs.writeFileSync(
    statePath,
    `${JSON.stringify(raw.processes ? { ...raw, processes: next } : next, null, 2)}\n`,
  )
  console.log('state.json to-be-overview updated')
}

function stripFromList(list) {
  return list.filter((id) => !STOCK_NODE_IDS.has(id))
}

function migrateProcessGroups() {
  const groups = JSON.parse(fs.readFileSync(processGroupsPath, 'utf8'))
  for (const g of groups) {
    if (Array.isArray(g.overviewNodeIds)) {
      g.overviewNodeIds = stripFromList(g.overviewNodeIds)
    }
  }
  fs.writeFileSync(processGroupsPath, `${JSON.stringify(groups, null, 2)}\n`)
  console.log('process-groups.json updated')
}

function migrateE2e() {
  const e2e = JSON.parse(fs.readFileSync(e2ePath, 'utf8'))
  e2e.nodes = stripFromList(e2e.nodes ?? [])
  const replacements = {
    'main:e2e:17': {
      id: 'main:e2e:17',
      source: 'inbound-confirm',
      target: 'ap-close',
      label: '재고인식(+)',
      type: 'system',
    },
    'main:e2e:18': {
      id: 'main:e2e:18',
      source: 'inbound-confirm',
      target: 'ap-close',
      label: '재고인식(+)',
      type: 'system',
    },
    'main:e2e:28': {
      id: 'main:e2e:28',
      source: 'shipment-confirm',
      target: 'sales-inquiry',
      label: '재고인식(-)',
      type: 'system',
    },
    'main:e2e:29': {
      id: 'main:e2e:29',
      source: 'shipment-confirm',
      target: 'sales-inquiry',
      label: '재고인식(-)',
      type: 'system',
    },
  }

  e2e.edges = (e2e.edges ?? [])
    .filter((e) => !STOCK_NODE_IDS.has(e.source) && !STOCK_NODE_IDS.has(e.target))
    .map((e) => replacements[e.id] ?? e)

  fs.writeFileSync(e2ePath, `${JSON.stringify(e2e, null, 2)}\n`)
  console.log('e2e-main-flow.json updated')
}

function migrateSubFlows() {
  const sub = JSON.parse(fs.readFileSync(subFlowsPath, 'utf8'))
  for (const g of sub.groups ?? []) {
    if (Array.isArray(g.nodeIds)) {
      g.nodeIds = stripFromList(g.nodeIds)
    }
    if (Array.isArray(g.links)) {
      g.links = g.links.map((link) => {
        if (link.source === 'stock-minus' && link.target === 'consignment-stock-status') {
          return { ...link, source: 'sales-close', id: 'sub:consignment:00' }
        }
        return link
      })
    }
  }
  fs.writeFileSync(subFlowsPath, `${JSON.stringify(sub, null, 2)}\n`)
  console.log('sub-process-flows.json updated')
}

migrateOverviewFile(overviewPath)
migrateState()
migrateProcessGroups()
migrateE2e()
migrateSubFlows()
