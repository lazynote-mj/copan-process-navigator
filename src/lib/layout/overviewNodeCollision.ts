import type { Node, Process } from '../../types/process'
import type { PlacedNode } from './laneLayout'
import { isOverviewDecisionType, type OverviewVerticalMetrics } from './overviewVerticalMetrics'

function expandedRect(node: PlacedNode, gapX: number, gapY: number) {
  return {
    x: node.x - gapX / 2,
    y: node.y - gapY / 2,
    width: node.width + gapX,
    height: node.height + gapY,
  }
}

function rectsOverlap(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  )
}

export function nodesOverlap(
  a: PlacedNode,
  b: PlacedNode,
  metrics: OverviewVerticalMetrics,
): boolean {
  if (a.id === b.id) return false
  return rectsOverlap(
    expandedRect(a, metrics.nodeGapX, metrics.nodeGapY),
    expandedRect(b, metrics.nodeGapX, metrics.nodeGapY),
  )
}

export function hasAnyNodeOverlap(placed: PlacedNode[], metrics: OverviewVerticalMetrics): boolean {
  for (let i = 0; i < placed.length; i++) {
    for (let j = i + 1; j < placed.length; j++) {
      if (nodesOverlap(placed[i], placed[j], metrics)) return true
    }
  }
  return false
}

function laneBounds(laneId: string, process: Process, metrics: OverviewVerticalMetrics) {
  const lane = process.lanes.find((l) => l.id === laneId)
  const order = lane?.order ?? 1
  const left = metrics.zoneLabelColumnWidth + (order - 1) * metrics.laneColumnWidth + metrics.laneContentPaddingX
  const right = left + metrics.laneColumnWidth - metrics.laneContentPaddingX * 2
  return { left, right }
}

/** 배치 후 node bounding box 충돌 보정 */
export function resolveOverviewNodeCollisions(
  placed: PlacedNode[],
  processNodes: Node[],
  process: Process,
  metrics: OverviewVerticalMetrics,
  maxPasses = 96,
): PlacedNode[] {
  const nodeById = new Map(processNodes.map((n) => [n.id, n]))
  const byId = new Map(placed.map((n) => [n.id, { ...n }]))

  for (let pass = 0; pass < maxPasses; pass++) {
    let moved = false
    const snapshot = [...byId.values()]

    for (let i = 0; i < snapshot.length; i++) {
      for (let j = i + 1; j < snapshot.length; j++) {
        let a = byId.get(snapshot[i].id)!
        let b = byId.get(snapshot[j].id)!
        if (!nodesOverlap(a, b, metrics)) continue

        const aMeta = nodeById.get(a.id)
        const bMeta = nodeById.get(b.id)
        const aDecision = aMeta ? isOverviewDecisionType(aMeta.type) : false
        const bDecision = bMeta ? isOverviewDecisionType(bMeta.type) : false

        if (a.laneId === b.laneId) {
          if (aDecision && !bDecision) {
            b = { ...b, y: Math.max(b.y, a.y + a.height + metrics.nodeGapY) }
          } else if (bDecision && !aDecision) {
            a = { ...a, y: Math.max(a.y, b.y + b.height + metrics.nodeGapY) }
          } else {
            const upper = a.y <= b.y ? a : b
            const lower = upper === a ? b : a
            const push = upper.y + upper.height + metrics.nodeGapY - lower.y
            if (push > 0) {
              lower.y += push
              if (lower === a) a = lower
              else b = lower
            }
          }
        } else {
          if (aDecision && !bDecision) {
            b = { ...b, y: b.y + metrics.nodeGapY }
          } else if (bDecision && !aDecision) {
            a = { ...a, y: a.y + metrics.nodeGapY }
          }

          if (nodesOverlap(a, b, metrics)) {
            const lower = a.y <= b.y ? b : a
            lower.y += metrics.nodeGapY
            if (lower === a) a = lower
            else b = lower
          }
        }

        byId.set(a.id, a)
        byId.set(b.id, b)
        moved = true
      }
    }

    if (!moved) break
  }

  return [...byId.values()].map((node) => {
    const { left, right } = laneBounds(node.laneId, process, metrics)
    const x = Math.min(Math.max(node.x, left), Math.max(left, right - node.width))
    return { ...node, x }
  })
}

export function wouldOverlapAtY(
  node: PlacedNode,
  newY: number,
  others: PlacedNode[],
  selfId: string,
  metrics: OverviewVerticalMetrics,
): boolean {
  const test = { ...node, y: newY }
  return others.some((o) => o.id !== selfId && nodesOverlap(test, o, metrics))
}

export function trySetNodeY(
  node: PlacedNode,
  newY: number,
  others: PlacedNode[],
  metrics: OverviewVerticalMetrics,
): PlacedNode | null {
  if (wouldOverlapAtY(node, newY, others, node.id, metrics)) return null
  return { ...node, y: newY }
}
