/**
 * edge.type=system → api | normal 마이그레이션
 *
 *   node scripts/migrate-system-edge-types.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { migrateSystemEdgesInProcess } from '../src/data/migrateSystemEdgeTypes.ts'

const root = path.resolve(import.meta.dirname, '..')

function collectJsonFiles(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) collectJsonFiles(full, acc)
    else if (entry.name.endsWith('.json')) acc.push(full)
  }
  return acc
}

function isProcessShape(raw) {
  return Array.isArray(raw?.nodes) && Array.isArray(raw?.edges)
}

function migrateProcessFile(filePath) {
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  if (!isProcessShape(raw)) return null

  const { edges, changed, toApi, toNormal } = migrateSystemEdgesInProcess(raw)
  if (changed === 0) return null

  fs.writeFileSync(filePath, `${JSON.stringify({ ...raw, edges }, null, 2)}\n`)
  return { changed, toApi, toNormal }
}

function migrateStateFile(filePath) {
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  const processes = raw.processes ?? (Array.isArray(raw) ? raw : null)
  if (!Array.isArray(processes)) return null

  let totalChanged = 0
  let totalApi = 0
  let totalNormal = 0
  const nextProcesses = processes.map((proc) => {
    if (!isProcessShape(proc)) return proc
    const { edges, changed, toApi, toNormal } = migrateSystemEdgesInProcess(proc)
    totalChanged += changed
    totalApi += toApi
    totalNormal += toNormal
    if (changed === 0) return proc
    return proc.meta ? { ...proc, edges } : { ...proc, edges }
  })

  if (totalChanged === 0) return null

  const payload = raw.processes ? { ...raw, processes: nextProcesses } : nextProcesses
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`)
  return { changed: totalChanged, toApi: totalApi, toNormal: totalNormal }
}

let grandChanged = 0
let grandApi = 0
let grandNormal = 0

const statePath = path.join(root, 'public/process-data/state.json')
const stateResult = migrateStateFile(statePath)
if (stateResult) {
  console.log(
    `${path.relative(root, statePath)}: ${stateResult.changed} edges (api=${stateResult.toApi}, normal=${stateResult.toNormal})`,
  )
  grandChanged += stateResult.changed
  grandApi += stateResult.toApi
  grandNormal += stateResult.toNormal
}

const processDirs = [
  path.join(root, 'src/data/toBeOverview'),
  path.join(root, 'src/data/processes'),
]

for (const dir of processDirs) {
  for (const filePath of collectJsonFiles(dir)) {
    const result = migrateProcessFile(filePath)
    if (!result) continue
    console.log(
      `${path.relative(root, filePath)}: ${result.changed} edges (api=${result.toApi}, normal=${result.toNormal})`,
    )
    grandChanged += result.changed
    grandApi += result.toApi
    grandNormal += result.toNormal
  }
}

console.log(`\nTotal: ${grandChanged} system edges → api=${grandApi}, normal=${grandNormal}`)
