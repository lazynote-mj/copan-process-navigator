import type { Node, Process } from '../../types/process'
import type { NodeType } from '../../types/nodeTypes'
import {
  contentLeftX,
  CANVAS_RIGHT_MARGIN,
} from './layoutConfig'
import type { PlacedNode } from './laneLayout'
import { resolveNodeLocalOrder } from './localOrder'
import {
  DEFAULT_GRID_METRICS,
  getNodeSizeForMetrics,
  type GridLayoutMetrics,
} from './gridLayoutMetrics'
import { stackGapBetween } from './nodeLayoutSizes'

/** lane 내부 local column width (default) */
export const COLUMN_WIDTH = DEFAULT_GRID_METRICS.columnWidth

/** 같은 lane/localOrder 셀 내 노드 세로 간격 (default) */
export const NODE_VERTICAL_GAP = DEFAULT_GRID_METRICS.nodeVerticalGap

export function getGridNodeSize(
  type: NodeType,
  metrics: GridLayoutMetrics = DEFAULT_GRID_METRICS,
): { width: number; height: number } {
  return getNodeSizeForMetrics(type, metrics)
}

/** phaseOrder — 전역 단계 설명/필터용 */
export function resolveNodePhaseOrder(node: Node, process: Process): number {
  if (typeof node.phaseOrder === 'number' && node.phaseOrder > 0) {
    return node.phaseOrder
  }
  const phase = process.phases.find((p) => p.id === node.phaseId)
  return phase?.order ?? 1
}

export function normalizeNodePhaseOrder(node: Node, process: Process): Node {
  return {
    ...node,
    phaseOrder: resolveNodePhaseOrder(node, process),
  }
}

type SizedNode = Node & { width: number; height: number; localOrder: number }

function toSizedNode(
  node: Node,
  process: Process,
  metrics: GridLayoutMetrics,
): SizedNode {
  const size = getGridNodeSize(node.type, metrics)
  return {
    ...node,
    localOrder: resolveNodeLocalOrder(node, process),
    width: size.width,
    height: size.height,
  }
}

function stackHeight(nodes: SizedNode[], metrics: GridLayoutMetrics): number {
  if (nodes.length === 0) return 0
  let sum = nodes[0].height
  for (let i = 1; i < nodes.length; i++) {
    sum += stackGapBetween(nodes[i - 1].type, nodes[i].type, metrics.nodeVerticalGap, metrics.decisionNodeGap)
    sum += nodes[i].height
  }
  return sum
}

/** lane별 grid 높이 */
export function computeGridLaneHeights(
  lanes: Process['lanes'],
  nodes: Node[],
  process: Process,
  metrics: GridLayoutMetrics = DEFAULT_GRID_METRICS,
): Map<string, number> {
  const heights = new Map<string, number>()
  const sized = nodes.map((n) => toSizedNode(n, process, metrics))
  const laneMinHeight = metrics.laneMinHeight

  for (const lane of [...lanes].sort((a, b) => a.order - b.order)) {
    const laneNodes = sized.filter((n) => n.laneId === lane.id)
    if (laneNodes.length === 0) {
      heights.set(lane.id, laneMinHeight)
      continue
    }

    const byColumn = new Map<number, SizedNode[]>()
    for (const node of laneNodes) {
      const list = byColumn.get(node.localOrder) ?? []
      list.push(node)
      byColumn.set(node.localOrder, list)
    }

    let maxStack: number = metrics.nodeHeight
    for (const columnNodes of byColumn.values()) {
      columnNodes.sort((a, b) => a.id.localeCompare(b.id))
      maxStack = Math.max(maxStack, stackHeight(columnNodes, metrics))
    }

    heights.set(
      lane.id,
      Math.max(laneMinHeight, maxStack + metrics.laneContentPaddingY * 2),
    )
  }

  return heights
}

function columnLeftX(localOrder: number, nodeWidth: number, columnWidth: number): number {
  const columnStart = contentLeftX() + (localOrder - 1) * columnWidth
  return columnStart + Math.max(0, Math.floor((columnWidth - nodeWidth) / 2))
}

/**
 * localOrder(X) × laneOrder(Y) 배치.
 * 각 lane의 첫 노드는 contentLeftX()에서 시작.
 */
export function placeNodesOnGrid(
  process: Process,
  nodes: Node[],
  laneTops: Map<string, number>,
  laneHeights: Map<string, number>,
  metrics: GridLayoutMetrics = DEFAULT_GRID_METRICS,
): PlacedNode[] {
  const sized = nodes.map((n) => toSizedNode(n, process, metrics))
  const placed: PlacedNode[] = []

  const lanes = [...process.lanes].sort((a, b) => a.order - b.order)

  for (const lane of lanes) {
    const laneTop = laneTops.get(lane.id) ?? 0
    const laneHeight = laneHeights.get(lane.id) ?? metrics.laneMinHeight
    const laneNodes = sized.filter((n) => n.laneId === lane.id)

    const byColumn = new Map<number, SizedNode[]>()
    for (const node of laneNodes) {
      const list = byColumn.get(node.localOrder) ?? []
      list.push(node)
      byColumn.set(node.localOrder, list)
    }

    for (const columnNodes of byColumn.values()) {
      columnNodes.sort((a, b) => a.id.localeCompare(b.id))
      const totalStack = stackHeight(columnNodes, metrics)
      let y = laneTop + (laneHeight - totalStack) / 2

      for (let i = 0; i < columnNodes.length; i++) {
        const node = columnNodes[i]
        const nodeY =
          columnNodes.length === 1
            ? laneTop + (laneHeight - node.height) / 2
            : y
        placed.push({
          id: node.id,
          laneId: lane.id,
          x: columnLeftX(node.localOrder, node.width, metrics.columnWidth),
          y: nodeY,
          width: node.width,
          height: node.height,
        })
        if (i < columnNodes.length - 1) {
          y +=
            node.height +
            stackGapBetween(node.type, columnNodes[i + 1].type, metrics.nodeVerticalGap, metrics.decisionNodeGap)
        }
      }
    }
  }

  return placed
}

/** lane별 최대 localOrder 기준 canvas width */
export function computeGridCanvasWidth(
  nodes: Node[],
  process: Process,
  metrics: GridLayoutMetrics = DEFAULT_GRID_METRICS,
): number {
  if (nodes.length === 0) {
    return contentLeftX() + metrics.columnWidth + CANVAS_RIGHT_MARGIN
  }

  let maxRight = contentLeftX() + metrics.columnWidth

  for (const lane of process.lanes) {
    const laneNodes = nodes.filter((n) => n.laneId === lane.id)
    if (laneNodes.length === 0) continue

    const maxLocal = Math.max(
      ...laneNodes.map((n) => resolveNodeLocalOrder(n, process)),
    )
    const laneRight =
      contentLeftX() +
      (maxLocal - 1) * metrics.columnWidth +
      metrics.nodeWidth +
      metrics.columnWidth * 0.2
    maxRight = Math.max(maxRight, laneRight)
  }

  return maxRight + CANVAS_RIGHT_MARGIN + metrics.columnWidth * 0.5
}
