import type { Edge, EdgeHandleId, Process } from '../../types/process'
import { hasUserSpecifiedHandles, resolveEdgeSourceHandle, resolveEdgeTargetHandle } from '../editor/edgeHandles'
import { resolveCellInternalEdgeHandles, isColumnTransitionEdge } from './cellInternalRouting'
import { resolveConnectorEdgeHandles } from './connectorLayout'
import {
  inferDecisionTargetSide,
  inferFlowSourceSide,
  inferFlowTargetSide,
} from './edgeFlowDirection'
import { inferDecisionIncomingHandle } from './decisionAnchors'
import { inferDecisionOutgoingPair } from './decisionNodeLayout'
import { isBranchNodeType } from './interfaceRuleLayout'
import type { PlacedNode } from './laneLayout'

export const OFFSET_STEP = 14

const SLOT_RATIOS = [0.5, 0.35, 0.65, 0.25, 0.75] as const

const POSITIVE_TOKENS = [
  'y',
  'yes',
  'true',
  'approve',
  'approved',
  'approval',
  '신규',
  '승인',
  'newvendor',
  'new',
  'settlementanomaly',
] as const

const NEGATIVE_TOKENS = [
  'n',
  'no',
  'false',
  'reject',
  'rejected',
  '반려',
  '기존',
  'existingvendor',
  'existing',
] as const

const POSITIVE_SIDES: EdgeHandleId[] = ['right', 'bottom', 'top', 'left']
const NEGATIVE_SIDES: EdgeHandleId[] = ['bottom', 'left', 'top', 'right']
const OTHER_SIDES: EdgeHandleId[] = ['right', 'bottom', 'left', 'top']

export type BranchPolarity = 'positive' | 'negative' | 'other'

export type EdgeBranchContext = {
  sourceGroupIndex: number
  sourceGroupSize: number
  targetGroupIndex: number
  targetGroupSize: number
  sourceAnchorRatio: number
  targetAnchorRatio: number
  segmentOffset: number
  targetSegmentOffset: number
  parallelIndex: number
  preferredSourceHandle?: EdgeHandleId
  preferredTargetHandle?: EdgeHandleId
  pinSourceHandle: boolean
  pinTargetHandle: boolean
  isDecisionBranch: boolean
  isCellInternalFlow: boolean
  isColumnTransitionFlow: boolean
  isConnectorFlow: boolean
}

export function anchorRatioForIndex(index: number): number {
  return SLOT_RATIOS[index % SLOT_RATIOS.length] ?? 0.5
}

export function segmentOffsetForIndex(index: number): number {
  if (index <= 0) return 0
  const magnitude = Math.ceil(index / 2) * OFFSET_STEP
  return index % 2 === 1 ? magnitude : -magnitude
}

export function centeredParallelIndex(index: number, groupSize: number): number {
  return index - (groupSize - 1) / 2
}

function normalizeToken(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, '')
}

export function classifyBranchPolarity(edge: Edge): BranchPolarity {
  const raw = `${edge.condition} ${edge.label}`.trim()
  if (!raw) return 'other'
  const normalized = normalizeToken(raw)
  const compact = raw.replace(/\s+/g, '')

  for (const token of POSITIVE_TOKENS) {
    if (normalized.includes(normalizeToken(token)) || compact.includes(token)) return 'positive'
  }
  for (const token of NEGATIVE_TOKENS) {
    if (normalized.includes(normalizeToken(token)) || compact.includes(token)) return 'negative'
  }
  return 'other'
}

export function preferredSidesForPolarity(polarity: BranchPolarity): EdgeHandleId[] {
  if (polarity === 'positive') return POSITIVE_SIDES
  if (polarity === 'negative') return NEGATIVE_SIDES
  return OTHER_SIDES
}

/**
 * Edge routing 전 그룹핑 — source outgoing / target incoming slot·offset 할당
 */
export function computeEdgeBranchContexts(
  edges: Edge[],
  placed: PlacedNode[],
  process: Process,
  detailLaneOrder?: Map<string, number>,
): Map<string, EdgeBranchContext> {
  const placedMap = new Map(placed.map((n) => [n.id, n]))
  const nodeTypeMap = new Map(process.nodes.map((n) => [n.id, n.type]))
  const result = new Map<string, EdgeBranchContext>()

  const outgoingBySource = new Map<string, Edge[]>()
  for (const edge of edges) {
    const list = outgoingBySource.get(edge.source) ?? []
    list.push(edge)
    outgoingBySource.set(edge.source, list)
  }

  const sourceSideByEdge = new Map<string, EdgeHandleId>()
  const targetSideByEdge = new Map<string, EdgeHandleId>()
  const cellInternalEdges = new Set<string>()
  const connectorEdges = new Set<string>()

  for (const edge of edges) {
    if (hasUserSpecifiedHandles(edge)) {
      sourceSideByEdge.set(edge.id, resolveEdgeSourceHandle(edge)!)
      targetSideByEdge.set(edge.id, resolveEdgeTargetHandle(edge)!)
      continue
    }

    const cellHandles = resolveCellInternalEdgeHandles(edge, process)
    if (cellHandles) {
      cellInternalEdges.add(edge.id)
      sourceSideByEdge.set(edge.id, cellHandles.sourceHandle)
      targetSideByEdge.set(edge.id, cellHandles.targetHandle)
      continue
    }

    const connectorHandles = resolveConnectorEdgeHandles(edge, process, placedMap)
    if (connectorHandles) {
      connectorEdges.add(edge.id)
      sourceSideByEdge.set(edge.id, connectorHandles.sourceHandle)
      targetSideByEdge.set(edge.id, connectorHandles.targetHandle)
    }
  }

  for (const [sourceId, outgoing] of outgoingBySource) {
    const source = placedMap.get(sourceId)
    if (!source) continue

    const isDecision = isBranchNodeType(nodeTypeMap.get(sourceId))

    if (isDecision) {
      for (const edge of outgoing) {
        if (cellInternalEdges.has(edge.id) || connectorEdges.has(edge.id)) continue
        const target = placedMap.get(edge.target)
        if (!target) continue
        const [sh, th] = inferDecisionOutgoingPair(source, target, edge)
        sourceSideByEdge.set(edge.id, resolveEdgeSourceHandle(edge) ?? sh)
        if (!resolveEdgeTargetHandle(edge)) {
          targetSideByEdge.set(edge.id, th)
        }
      }
      continue
    }

    const bySide = new Map<EdgeHandleId, Edge[]>()
    for (const edge of outgoing) {
      if (cellInternalEdges.has(edge.id) || connectorEdges.has(edge.id)) continue
      if (hasUserSpecifiedHandles(edge)) continue
      const target = placedMap.get(edge.target)
      const side = target ? inferFlowSourceSide(source, target, edge) : 'right'
      const list = bySide.get(side) ?? []
      list.push(edge)
      bySide.set(side, list)
    }

    for (const [side, groupEdges] of bySide) {
      const sorted = [...groupEdges].sort((a, b) => a.id.localeCompare(b.id))
      for (const edge of sorted) {
        sourceSideByEdge.set(edge.id, side)
      }
    }
  }

  for (const edge of edges) {
    if (cellInternalEdges.has(edge.id) || connectorEdges.has(edge.id)) continue
    if (hasUserSpecifiedHandles(edge)) continue
    const source = placedMap.get(edge.source)
    const target = placedMap.get(edge.target)
    if (!source || !target) continue

    const isDecisionTarget = isBranchNodeType(nodeTypeMap.get(edge.target))
    if (isDecisionTarget) {
      targetSideByEdge.set(
        edge.id,
        resolveEdgeTargetHandle(edge) ?? inferDecisionIncomingHandle(source, target, edge),
      )
      continue
    }

    const sourceSide =
      sourceSideByEdge.get(edge.id) ?? inferFlowSourceSide(source, target, edge)
    const isDecisionSource = isBranchNodeType(nodeTypeMap.get(edge.source))
    if (isDecisionSource && targetSideByEdge.has(edge.id)) {
      continue
    }
    targetSideByEdge.set(
      edge.id,
      isDecisionSource
        ? inferDecisionTargetSide(source, target, sourceSide, edge)
        : inferFlowTargetSide(source, target, sourceSide, edge),
    )
  }

  const sourceGroups = new Map<string, Edge[]>()
  for (const edge of edges) {
    const side = sourceSideByEdge.get(edge.id) ?? 'right'
    const key = `${edge.source}:${side}`
    const list = sourceGroups.get(key) ?? []
    list.push(edge)
    sourceGroups.set(key, list)
  }

  const targetGroups = new Map<string, Edge[]>()
  for (const edge of edges) {
    const side = targetSideByEdge.get(edge.id) ?? 'left'
    const key = `${edge.target}:${side}`
    const list = targetGroups.get(key) ?? []
    list.push(edge)
    targetGroups.set(key, list)
  }

  for (const edge of edges) {
    const source = placedMap.get(edge.source)
    const target = placedMap.get(edge.target)
    if (!source || !target) continue

    const isDetailAdjacentCrossLane =
      detailLaneOrder != null &&
      source.laneId !== target.laneId &&
      detailLaneOrder.has(source.laneId) &&
      detailLaneOrder.has(target.laneId) &&
      Math.abs(
        (detailLaneOrder.get(source.laneId) ?? 0) - (detailLaneOrder.get(target.laneId) ?? 0),
      ) === 1

    const sourceNode = process.nodes.find((n) => n.id === edge.source)
    const targetNode = process.nodes.find((n) => n.id === edge.target)
    const isOverviewCrossLaneZone =
      detailLaneOrder == null &&
      sourceNode?.processZone != null &&
      targetNode?.processZone != null &&
      sourceNode.processZone === targetNode.processZone &&
      sourceNode.laneId !== targetNode.laneId &&
      target.x > source.x + source.width - 4

    if ((isDetailAdjacentCrossLane || isOverviewCrossLaneZone) && !hasUserSpecifiedHandles(edge)) {
      sourceSideByEdge.set(edge.id, 'right')
      targetSideByEdge.set(edge.id, 'left')
    }

    const sourceSide = sourceSideByEdge.get(edge.id) ?? inferFlowSourceSide(source, target, edge)
    const isDecisionSource = isBranchNodeType(nodeTypeMap.get(edge.source))
    const targetSide =
      targetSideByEdge.get(edge.id) ??
      (isDecisionSource
        ? inferDecisionTargetSide(source, target, sourceSide, edge)
        : inferFlowTargetSide(source, target, sourceSide, edge))

    const sourceGroup = sourceGroups.get(`${edge.source}:${sourceSide}`) ?? [edge]
    const targetGroup = targetGroups.get(`${edge.target}:${targetSide}`) ?? [edge]

    const sortedSource = [...sourceGroup].sort(
      (a, b) => (a.priority ?? 0) - (b.priority ?? 0) || a.id.localeCompare(b.id),
    )
    const sortedTarget = [...targetGroup].sort(
      (a, b) => (a.priority ?? 0) - (b.priority ?? 0) || a.id.localeCompare(b.id),
    )

    const sourceGroupIndex = sortedSource.findIndex((e) => e.id === edge.id)
    const targetGroupIndex = sortedTarget.findIndex((e) => e.id === edge.id)
    const sourceGroupSize = sortedSource.length
    const targetGroupSize = sortedTarget.length

    const isDecision = isBranchNodeType(nodeTypeMap.get(edge.source))
    const isDecisionTarget = isBranchNodeType(nodeTypeMap.get(edge.target))
    const multiOutgoing = (outgoingBySource.get(edge.source)?.length ?? 0) >= 2
    const isConnectorFlow = connectorEdges.has(edge.id)
    const isCellInternal = cellInternalEdges.has(edge.id) || isConnectorFlow
    const isColumnTransition =
      isDetailAdjacentCrossLane ||
      isOverviewCrossLaneZone ||
      (isCellInternal &&
        sourceSide === 'right' &&
        targetSide === 'left' &&
        sourceNode != null &&
        targetNode != null &&
        isColumnTransitionEdge(sourceNode, targetNode, process))

    result.set(edge.id, {
      sourceGroupIndex: Math.max(0, sourceGroupIndex),
      sourceGroupSize,
      targetGroupIndex: Math.max(0, targetGroupIndex),
      targetGroupSize,
      sourceAnchorRatio: isCellInternal || isDecision || isDecisionTarget ? 0.5 : anchorRatioForIndex(Math.max(0, sourceGroupIndex)),
      targetAnchorRatio: isCellInternal || isDecisionTarget ? 0.5 : anchorRatioForIndex(Math.max(0, targetGroupIndex)),
      segmentOffset:
        isCellInternal || sourceGroupSize < 2
          ? 0
          : segmentOffsetForIndex(Math.max(0, sourceGroupIndex)),
      targetSegmentOffset:
        isCellInternal || targetGroupSize < 2
          ? 0
          : segmentOffsetForIndex(Math.max(0, targetGroupIndex)),
      parallelIndex: isCellInternal
        ? 0
        : centeredParallelIndex(Math.max(0, sourceGroupIndex), sourceGroupSize),
      preferredSourceHandle: sourceSide,
      preferredTargetHandle: targetSide,
      pinSourceHandle:
        isDetailAdjacentCrossLane ||
        isOverviewCrossLaneZone ||
        isCellInternal ||
        (isDecision && multiOutgoing) ||
        hasUserSpecifiedHandles(edge),
      pinTargetHandle:
        isDetailAdjacentCrossLane ||
        isOverviewCrossLaneZone ||
        isCellInternal ||
        isDecisionTarget ||
        hasUserSpecifiedHandles(edge),
      isDecisionBranch: isDecision && multiOutgoing,
      isCellInternalFlow: isCellInternal,
      isColumnTransitionFlow: isColumnTransition,
      isConnectorFlow,
    })
  }

  return result
}

/** @deprecated parallel index only — computeEdgeBranchContexts 사용 */
export function computeParallelEdgeIndices(edges: Edge[]): Map<string, number> {
  const groups = new Map<string, string[]>()
  for (const edge of edges) {
    const key = [edge.source, edge.target].sort().join('->')
    const list = groups.get(key) ?? []
    list.push(edge.id)
    groups.set(key, list)
  }
  const result = new Map<string, number>()
  for (const ids of groups.values()) {
    const sorted = [...ids].sort()
    sorted.forEach((id, index) => {
      result.set(id, centeredParallelIndex(index, sorted.length))
    })
  }
  return result
}
