#!/usr/bin/env node
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const statePath = path.join(root, 'public/process-data/state.json')
const meta = JSON.parse(fs.readFileSync(path.join(root, 'src/data/processes/business-to-project/meta.json'), 'utf8'))
const nodes = JSON.parse(fs.readFileSync(path.join(root, 'src/data/processes/business-to-project/nodes.json'), 'utf8'))
const edges = JSON.parse(fs.readFileSync(path.join(root, 'src/data/processes/business-to-project/edges.json'), 'utf8'))

const state = JSON.parse(fs.readFileSync(statePath, 'utf8'))
const idx = state.processes.findIndex((p) => p.id === 'business-to-project')
if (idx < 0) {
  console.error('business-to-project not found in state.json')
  process.exit(1)
}

const routing = { mode: 'auto', handleAuto: true }
state.processes[idx] = {
  ...state.processes[idx],
  nodes,
  edges: edges.map((edge) => ({ ...edge, routing: { ...routing } })),
  zones: meta.zones ?? [],
}

fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`)
console.log(`Updated business-to-project: ${nodes.length} nodes, ${edges.length} edges, ${meta.zones?.length ?? 0} zones`)
