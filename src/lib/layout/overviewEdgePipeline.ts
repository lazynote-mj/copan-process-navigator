import type { Edge as FlowEdge } from '@xyflow/react'
import type { Process } from '../../types/process'
import {
  buildBrokenFlowEdge,
  buildOrthogonalFlowEdgeWithCollisionRetry,
  accumulateEdgeLabelRect,
  type BuiltOrthogonalEdge,
} from './buildOrthogonalFlowEdge'
import { assertPathRespectsContentLeft } from './edgeRouter'
import type { PlacedNode } from './laneLayout'
import type { Segment } from './orthogonalEdgeRouter'
import type { LabelRect } from './edgeLabelPlacement'
import { computeEdgeBranchContexts } from './edgeBranchRouting'
import { logProcessFlowIssues, validateProcessFlow } from './processFlowValidation'
import { sortEdgesByPriority } from './laneLayoutResolver'

type BuildProcessEdgesOptions = {
  /** Cross-lane corridor·장애물 회피 — Overview·Detail 공통 orthogonal router */
  overviewMode?: boolean
}

/** JSON edges 배열 기준 — layout/위치로 edge 삭제 금지 */
export function buildProcessEdges(
  process: Process,
  placed: PlacedNode[],
  minContentX: number,
  options: BuildProcessEdgesOptions = {},
): { flowEdges: FlowEdge[]; built: BuiltOrthogonalEdge[] } {
  const overviewMode = options.overviewMode ?? true
  logProcessFlowIssues(process, validateProcessFlow(process))

  const routableEdges = sortEdgesByPriority(process.edges)

  const branchContexts = computeEdgeBranchContexts(routableEdges, placed, process)
  const placedMap = new Map(placed.map((n) => [n.id, n]))
  const existingSegments: Segment[] = []
  const existingLabelRects: LabelRect[] = []
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

    const branchContext = branchContexts.get(edge.id)
    const parallelIndex = branchContext?.parallelIndex ?? 0

    const result = buildOrthogonalFlowEdgeWithCollisionRetry(
      edge,
      source,
      target,
      placed,
      parallelIndex,
      minContentX,
      existingSegments,
      { overviewMode, process, branchContext, existingLabelRects },
    )

    if (result.path) assertPathRespectsContentLeft(result.path, minContentX)
    existingSegments.push(...result.segments)
    accumulateEdgeLabelRect(existingLabelRects, result.route)
    built.push(result)
  }

  return { flowEdges: built.map((b) => b.flowEdge), built }
}

/** @deprecated buildProcessEdges 사용 */
export const buildOverviewEdges = buildProcessEdges
