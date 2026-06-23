import fs from 'fs'
// Break edgeLabelPlacement ↔ decisionNodeLayout circular init before router imports
await import('../src/lib/layout/decisionNodeLayout.ts')
const { getOverviewGridLayout } = await import('../src/lib/layout/overviewGridLayout.ts')
const { routeOrthogonalEdge, countOrthogonalBends, getCollidedNodes } = await import(
  '../src/lib/layout/orthogonalEdgeRouter.ts',
)

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

const edgeId = 'edge-mqloxmni-04c9q'
const srcId = 'node-mqkytkqz-1iibf'
const tgtId = 'mg-deduct-check'

const edge = p.edges.find((e) => e.id === edgeId)
const src = placed.find((n) => n.id === srcId)
const tgt = placed.find((n) => n.id === tgtId)
const exclude = new Set([srcId, tgtId])

console.log('source', srcId, { x: src.x, y: src.y, w: src.width, h: src.height, lane: src.laneId })
console.log('target', tgtId, { x: tgt.x, y: tgt.y, w: tgt.width, h: tgt.height, lane: tgt.laneId })
console.log('source meta', p.nodes.find((n) => n.id === srcId))
console.log('target meta', p.nodes.find((n) => n.id === tgtId))

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

const bends = countOrthogonalBends(route.points)
console.log('route handles', route.sourceHandle, '->', route.targetHandle)
console.log('bend count', bends)
console.log('points', route.points)
console.log(
  'collisions',
  getCollidedNodes(route.points, placed, exclude, 16, p).map((n) => n.id),
)
