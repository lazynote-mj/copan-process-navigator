#!/usr/bin/env node
/**
 * src/data/processes/*.json → public/process-data/state.json detail 프로세스 동기화
 * - 중복 edge id 제거
 * - nodes/edges/zones를 canonical JSON 기준으로 교체
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const statePath = path.join(root, 'public/process-data/state.json')
const registryPath = path.join(root, 'src/data/processRegistry.json')
const processesDir = path.join(root, 'src/data/processes')

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'))
}

function dedupeEdges(edges) {
  const seen = new Set()
  const out = []
  for (const edge of edges) {
    if (seen.has(edge.id)) continue
    seen.add(edge.id)
    out.push({
      ...edge,
      routing: edge.routing ?? { mode: 'auto', handleAuto: true },
    })
  }
  return out
}

function loadDetailProcess(id, file) {
  const filePath = path.join(processesDir, file)
  if (!fs.existsSync(filePath)) {
    console.warn(`  skip ${id}: missing ${file}`)
    return null
  }
  return readJson(filePath)
}

function loadBusinessToProject() {
  const meta = readJson(path.join(processesDir, 'business-to-project/meta.json'))
  const nodes = readJson(path.join(processesDir, 'business-to-project/nodes.json'))
  const edges = readJson(path.join(processesDir, 'business-to-project/edges.json'))
  return {
    ...meta,
    source: 'SCM TO-BE',
    overviewNodeId: 'order-register',
    lanes: [],
    nodes,
    edges,
    zones: meta.zones ?? [],
  }
}

const registry = readJson(registryPath)
const state = readJson(statePath)

const sources = [
  loadBusinessToProject(),
  ...registry.processes.map((entry) => loadDetailProcess(entry.id, entry.file)),
].filter(Boolean)

let updated = 0
for (const source of sources) {
  const idx = state.processes.findIndex((p) => p.id === source.id)
  if (idx < 0) {
    console.log(`+ add ${source.id}`)
    state.processes.push({
      id: source.id,
      type: 'detail',
      name: source.name,
      description: source.description ?? '',
      version: source.version ?? 'v1.0',
      status: source.status ?? 'draft',
      lastModified: source.lastModified ?? '2026-06-15',
      owner: source.owner ?? 'ERP PMO',
      nodes: source.nodes,
      edges: dedupeEdges(source.edges),
      zones: source.zones ?? [],
      overviewNodeId: source.overviewNodeId,
      source: source.source ?? 'SCM TO-BE',
    })
    updated++
    continue
  }

  const prev = state.processes[idx]
  const nextEdges = dedupeEdges(source.edges)
  const prevEdgeIds = new Set(prev.edges?.map((e) => e.id) ?? [])
  const nextEdgeIds = new Set(nextEdges.map((e) => e.id))
  const dupCount = (prev.edges?.length ?? 0) - prevEdgeIds.size
  const missing = [...nextEdgeIds].filter((id) => !prevEdgeIds.has(id))
  const extra = [...prevEdgeIds].filter((id) => !nextEdgeIds.has(id))

  if (
    dupCount > 0 ||
    missing.length > 0 ||
    extra.length > 0 ||
    (prev.nodes?.length ?? 0) !== source.nodes.length
  ) {
    console.log(
      `~ ${source.id}: nodes ${prev.nodes?.length ?? 0}→${source.nodes.length}, edges ${prev.edges?.length ?? 0}→${nextEdges.length}` +
        (dupCount ? ` (dup ${dupCount})` : '') +
        (missing.length ? ` +[${missing.join(',')}]` : '') +
        (extra.length ? ` -[${extra.join(',')}]` : ''),
    )
  }

  state.processes[idx] = {
    ...prev,
    name: source.name,
    description: source.description ?? prev.description,
    nodes: source.nodes,
    edges: nextEdges,
    zones: source.zones ?? prev.zones ?? [],
    overviewNodeId: source.overviewNodeId ?? prev.overviewNodeId,
    source: source.source ?? prev.source,
  }
  updated++
}

state.updatedAt = new Date().toISOString()

const scmGroupsPath = path.join(root, 'src/data/toBeOverview/detail-process-groups.json')
const overviewGroupsPath = path.join(root, 'src/data/toBeOverview/overview-process-groups.json')
if (fs.existsSync(overviewGroupsPath)) {
  state.overviewProcessGroups = JSON.parse(fs.readFileSync(overviewGroupsPath, 'utf8'))
  console.log(`Synced ${state.overviewProcessGroups.length} overview process group(s)`)
}
if (fs.existsSync(scmGroupsPath)) {
  state.detailProcessGroups = JSON.parse(fs.readFileSync(scmGroupsPath, 'utf8'))
  console.log(`Synced ${state.detailProcessGroups.length} detail process group(s)`)
}
delete state.processGroups

fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`)
console.log(`\nSynced ${updated} detail process(es) → ${statePath}`)
