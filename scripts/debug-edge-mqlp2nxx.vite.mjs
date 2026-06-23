import fs from 'fs'
import { createServer } from 'vite'

const server = await createServer({ logLevel: 'error' })
try {
  await server.ssrLoadModule('/src/lib/layout/decisionNodeLayout.ts')
  const { getOverviewGridLayout } = await server.ssrLoadModule('/src/lib/layout/overviewGridLayout.ts')
  const { routeOrthogonalEdge, getCollidedNodes, countOrthogonalBends } = await server.ssrLoadModule(
    '/src/lib/layout/orthogonalEdgeRouter.ts',
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
    width: Number(n.style?.width ?? 140),
    height: Number(n.style?.height ?? 44),
    laneId: n.data.laneId,
  }))

  const edgeId = 'edge-mqlp2nxx-ffvac'
  const edge = p.edges.find((e) => e.id === edgeId)
  const src = placed.find((n) => n.id === edge.source)
  const tgt = placed.find((n) => n.id === edge.target)

  console.log('edge', edge)
  console.log('source', src)
  console.log('target', tgt)

  const flowEdge = layout.edges.find((e) => e.id === edgeId)
  if (flowEdge?.data) {
    const d = flowEdge.data
    console.log('layout validation', {
      status: d.validationStatus,
      issue: d.routeIssue,
      label: d.routeIssueLabel,
      fix: d.suggestedFix,
      broken: d.broken,
      collided: d.collidedNodeNames,
      bends: d.bendCount,
    })
  }

  if (src && tgt) {
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
    const exclude = new Set([src.id, tgt.id])
    const collided = getCollidedNodes(route.points, placed, exclude, 16, p)
    console.log('route', {
      handles: `${route.sourceHandle}->${route.targetHandle}`,
      bends: countOrthogonalBends(route.points),
      validation: route.routeValidation,
      points: route.points,
      collided: collided.map((n) => ({ id: n.id, name: p.nodes.find((x) => x.id === n.id)?.name })),
    })
  }
} finally {
  await server.close()
}
