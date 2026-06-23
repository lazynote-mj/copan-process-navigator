import fs from 'fs'
import { getOverviewGridLayout } from '../src/lib/layout/overviewGridLayout.ts'
import { routeOrthogonalEdge, countOrthogonalBends, getCollidedNodes } from '../src/lib/layout/orthogonalEdgeRouter.ts'

const raw = JSON.parse(fs.readFileSync('public/process-data/state.json', 'utf8'))
const p = raw.processes.find((x) => x.id === 'to-be-overview')
p.lanes = raw.commonMasters.lanes
p.phases = p.phases ?? raw.commonMasters.phases ?? []

const layout = getOverviewGridLayout(p)
const placed = layout.nodes.map((n) => ({
  id: n.id,
  x: n.position.x,
  y: n.position.y,
  width: n.style?.width ?? 140,
  height: n.style?.height ?? 44,
  laneId: n.data.laneId,
}))

const edge = p.edges.find((e) => e.source === 'purchase-order' && e.target === 'inbound-info')
const src = placed.find((n) => n.id === 'purchase-order')
const tgt = placed.find((n) => n.id === 'inbound-info')
const exclude = new Set([src.id, tgt.id])

for (const id of ['purchase-order', 'inbound-info', 'product-register-approval', 'po-approval']) {
  const n = placed.find((x) => x.id === id)
  const meta = p.nodes.find((x) => x.id === id)
  if (!n) continue
  console.log(id, { slot: meta?.cellSlot, cx: n.x + n.width / 2, y: n.y })
}

const straight = [
  { x: 726, y: 419 },
  { x: 726, y: 431 },
  { x: 726, y: 757 },
  { x: 726, y: 769 },
]
const hits = placed.filter((n) => {
  if (exclude.has(n.id)) return false
  const pad = 14
  for (let i = 0; i < straight.length - 1; i++) {
    const a = straight[i]
    const b = straight[i + 1]
    const minX = Math.min(a.x, b.x) - pad
    const maxX = Math.max(a.x, b.x) + pad
    const minY = Math.min(a.y, b.y)
    const maxY = Math.max(a.y, b.y)
    if (
      n.x + n.width + pad > minX &&
      n.x - pad < maxX &&
      n.y + n.height + pad > minY &&
      n.y - pad < maxY
    ) {
      return true
    }
  }
  return false
})
console.log(
  'straight collisions',
  hits.map((n) => ({ id: n.id, name: p.nodes.find((x) => x.id === n.id)?.name, ...n })),
)
console.log('straight hits', hits.length)
console.log('getCollidedNodes straight', getCollidedNodes(straight, placed, exclude, 16, p))

const route = routeOrthogonalEdge({
  edge,
  source: src,
  target: tgt,
  placed,
  parallelIndex: 0,
  minContentX: 0,
  process: p,
  overviewMode: true,
})
console.log('route bends', countOrthogonalBends(route.points), route.points)
