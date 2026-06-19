import type { Edge as FlowEdge } from '@xyflow/react'
import type { Process } from '../../types/process'
import {
  buildBrokenFlowEdge,
  buildOrthogonalFlowEdge,
  type BuiltOrthogonalEdge,
} from './buildOrthogonalFlowEdge'
import { assertPathRespectsContentLeft } from './edgeRouter'
import type { PlacedNode } from './laneLayout'
import { countNodeCollisionsOnPath, isNearEdge, type Segment } from './orthogonalEdgeRouter'
import { OVERVIEW_GRID_METRICS } from './overviewGridMetrics'
import { computeEdgeBranchContexts } from './edgeBranchRouting'
import { logProcessFlowIssues, validateProcessFlow } from './processFlowValidation'
import { isInterfaceRuleNode } from './interfaceRuleLayout'
import { sortEdgesByPriority } from './laneLayoutResolver'

/** JSON edges 배열 기준 — layout/위치로 edge 삭제 금지 */
export function buildOverviewEdges(
  process: Process,
  placed: PlacedNode[],
  minContentX: number,
): { flowEdges: FlowEdge[]; built: BuiltOrthogonalEdge[] } {
  logProcessFlowIssues(process, validateProcessFlow(process))

  const nodeById = new Map(process.nodes.map((node) => [node.id, node]))
  const routableEdges = sortEdgesByPriority(
    process.edges.filter((edge) => {
      const src = nodeById.get(edge.source)
      const tgt = nodeById.get(edge.target)
      return !isInterfaceRuleNode(src?.type) && !isInterfaceRuleNode(tgt?.type)
    }),
  )

  const branchContexts = computeEdgeBranchContexts(routableEdges, placed, process)
  const placedMap = new Map(placed.map((n) => [n.id, n]))
  const metrics = OVERVIEW_GRID_METRICS
  const existingSegments: Segment[] = []
  const built: BuiltOrthogonalEdge[] = []

  for (const edge of routableEdges) {
    const source = placedMap.get(edge.source)
    const target = placedMap.get(edge.target)

    if (!source && !target) {
      console.warn(
        `[ProcessNavigator] Cannot render edge ${edge.id}: both endpoints missing from layout.`,
      )
      continue
    }

    if (!source || !target) {
      const missingId = !source ? edge.source : edge.target
      const role = !source ? 'source' : 'target'
      built.push(buildBrokenFlowEdge(edge, missingId, role, { source, target }))
      continue
    }

    const exclude = new Set([source.id, target.id])
    const branchContext = branchContexts.get(edge.id)
    const parallelIndex = branchContext?.parallelIndex ?? 0
    const nearEdge = isNearEdge(source, target, process)

    let result = buildOrthogonalFlowEdge(
      edge,
      source,
      target,
      placed,
      parallelIndex,
      minContentX,
      existingSegments,
      { overviewMode: true, process, branchContext },
    )

    if (
      !nearEdge &&
      countNodeCollisionsOnPath(result.route.points, placed, exclude, metrics.edgeNodeMargin, process) > 0
    ) {
      const retry = buildOrthogonalFlowEdge(
        edge,
        source,
        target,
        placed,
        parallelIndex,
        minContentX,
        existingSegments,
        { overviewMode: true, preferCorridor: true, process, branchContext },
      )
      if (
        countNodeCollisionsOnPath(retry.route.points, placed, exclude, metrics.edgeNodeMargin, process) <
        countNodeCollisionsOnPath(result.route.points, placed, exclude, metrics.edgeNodeMargin, process)
      ) {
        result = retry
      }
    }

    if (
      !nearEdge &&
      countNodeCollisionsOnPath(result.route.points, placed, exclude, metrics.edgeNodeMargin, process) > 0
    ) {
      const lastResort = buildOrthogonalFlowEdge(
        edge,
        source,
        target,
        placed,
        parallelIndex + 3,
        minContentX,
        existingSegments,
        { overviewMode: true, preferCorridor: true, process, branchContext },
      )
      if (
        countNodeCollisionsOnPath(lastResort.route.points, placed, exclude, metrics.edgeNodeMargin, process) <
        countNodeCollisionsOnPath(result.route.points, placed, exclude, metrics.edgeNodeMargin, process)
      ) {
        result = lastResort
      }
    }

    if (result.path) assertPathRespectsContentLeft(result.path, minContentX)
    existingSegments.push(...result.segments)
    built.push(result)
  }

  return { flowEdges: built.map((b) => b.flowEdge), built }
}
