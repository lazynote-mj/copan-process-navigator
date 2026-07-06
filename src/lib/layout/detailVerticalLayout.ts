import type { Lane, Node, Process } from '../../types/process'
import { getOverviewLanes } from '../../data/laneRegistry'
import { LANE_WIDTH, SWIMLANE_LANE_COUNT } from './swimlaneGridLayout'
import { CANVAS_BOTTOM_PADDING } from './layoutConfig'
import type { LaneBand, PlacedNode } from './laneLayout'
import { resolveNodeLocalOrder } from './localOrder'
import { DETAIL_DOCUMENT, DETAIL_GRID_METRICS, getDetailNodeSize } from './detailLayoutMetrics'
import { isInterfaceRuleNode } from './interfaceRuleLayout'
import type { GridLayoutMetrics } from './gridLayoutMetrics'

type SizedNode = Node & { width: number; height: number; localOrder: number }

export type DetailDocumentLayout = {
  /** Overview와 동일한 5개 lane — order 순 고정 */
  lanes: Lane[]
  usedLaneIds: Set<string>
  laneLefts: Map<string, number>
  /** Overview lane.order 기준 인덱스 (0..4) */
  laneOrder: Map<string, number>
  documentLeft: number
  documentTop: number
  documentWidth: number
  nodeAreaTop: number
  canvasWidth: number
}

function toSizedNode(
  node: Node,
  process: Process,
  metrics: GridLayoutMetrics,
): SizedNode {
  const size =
    node.type === 'decision' || isInterfaceRuleNode(node.type)
      ? getDetailNodeSize(node.type, metrics, node.name)
      : getDetailNodeSize(node.type, metrics)
  return {
    ...node,
    localOrder: resolveNodeLocalOrder(node, process),
    width: size.width,
    height: size.height,
  }
}

/**
 * Detail View Swimlane — registry는 order 기준으로만 쓰고,
 * 표시 멤버십은 process.lanes(프로세스별 laneIds 필터 반영)를 따른다.
 * registry에 없는 마스터 신규 레인도 포함한다.
 */
export function getDetailOverviewLanes(process: Process): Lane[] {
  const overviewLanes = getOverviewLanes()
  const byId = new Map(process.lanes.map((l) => [l.id, l]))
  const fromRegistry = overviewLanes
    .filter((lane) => byId.has(lane.id))
    .map((lane) => byId.get(lane.id) ?? lane)
  const registryIds = new Set(overviewLanes.map((lane) => lane.id))
  const extras = process.lanes.filter((lane) => !registryIds.has(lane.id))
  const lanes = [...fromRegistry, ...extras].sort((a, b) => a.order - b.order)
  return lanes.length > 0 ? lanes : overviewLanes
}

/** 단일 lane Detail — PDF처럼 사업부 1개 lane만 사용 */
export function isDetailSingleLaneProcess(nodes: Node[]): boolean {
  return getUsedLaneIds(nodes).size === 1
}

/**
 * Detail 레이아웃 lane — 단일 lane 프로세스는 5열 폭을 하나의 lane으로 사용 (PDF 사업부 단일 스윔레인)
 */
export function resolveDetailLayoutLanes(process: Process, nodes: Node[]): Lane[] {
  if (!isDetailSingleLaneProcess(nodes)) {
    return getDetailOverviewLanes(process)
  }
  const usedLaneId = [...getUsedLaneIds(nodes)][0]
  const lane = getDetailOverviewLanes(process).find((entry) => entry.id === usedLaneId)
  if (!lane) return getDetailOverviewLanes(process)
  return [
    {
      ...lane,
      order: 1,
      width: LANE_WIDTH * SWIMLANE_LANE_COUNT,
    },
  ]
}

export function getUsedLaneIds(nodes: Node[]): Set<string> {
  return new Set(nodes.map((n) => n.laneId))
}

export function computeDetailDocumentLayout(
  lanes: Lane[],
  usedLaneIds: Set<string>,
): DetailDocumentLayout {
  const { laneWidth, laneGap, paddingX, paddingTop, maxContentWidth } = DETAIL_DOCUMENT
  const lanesInnerWidth = lanes.length * laneWidth + Math.max(0, lanes.length - 1) * laneGap
  const documentWidth = lanesInnerWidth + paddingX * 2
  const canvasWidth = Math.max(documentWidth, maxContentWidth)
  const documentLeft = (canvasWidth - documentWidth) / 2
  const lanesStartX = documentLeft + paddingX

  const laneLefts = new Map<string, number>()
  const laneOrder = new Map<string, number>()
  lanes.forEach((lane, index) => {
    laneLefts.set(lane.id, lanesStartX + index * (laneWidth + laneGap))
    laneOrder.set(lane.id, index)
  })

  const nodeAreaTop =
    paddingTop + DETAIL_DOCUMENT.laneHeaderHeight + DETAIL_DOCUMENT.laneContentPaddingY

  return {
    lanes,
    usedLaneIds,
    laneLefts,
    laneOrder,
    documentLeft,
    documentTop: paddingTop,
    documentWidth,
    nodeAreaTop,
    canvasWidth,
  }
}

function stackHeight(nodes: SizedNode[], gap: number): number {
  if (nodes.length === 0) return 0
  let sum = nodes[0].height
  for (let i = 1; i < nodes.length; i++) {
    sum += gap + nodes[i].height
  }
  return sum
}

/** 모든 lane column 높이를 최대값으로 맞춤 — Overview 좌표계 정렬 */
export function alignDetailLaneHeights(heights: Map<string, number>, lanes: Lane[]): Map<string, number> {
  const maxH = Math.max(
    DETAIL_DOCUMENT.laneMinHeight,
    ...lanes.map((l) => heights.get(l.id) ?? DETAIL_DOCUMENT.laneMinHeight),
  )
  const aligned = new Map<string, number>()
  for (const lane of lanes) {
    aligned.set(lane.id, maxH)
  }
  return aligned
}

/** lane별 높이 — 마지막 node + edge 여유, 최소 600px */
export function computeDetailLaneHeights(
  lanes: Lane[],
  nodes: Node[],
  process: Process,
  doc: DetailDocumentLayout,
  metrics: GridLayoutMetrics = DETAIL_GRID_METRICS,
): Map<string, number> {
  const heights = new Map<string, number>()
  const sized = nodes.map((n) => toSizedNode(n, process, metrics))
  const gap = metrics.nodeVerticalGap
  const { laneMinHeight, laneContentPaddingY, laneBottomPadding } = DETAIL_DOCUMENT

  const nodeAreaTop = doc.nodeAreaTop
  const headerAndPad = nodeAreaTop - doc.documentTop + laneContentPaddingY

  for (const lane of lanes) {
    const laneNodes = sized
      .filter((n) => n.laneId === lane.id)
      .sort((a, b) => a.localOrder - b.localOrder)

    if (laneNodes.length === 0) {
      heights.set(lane.id, laneMinHeight)
      continue
    }

    const nodesStack = stackHeight(laneNodes, gap)
    const contentHeight = headerAndPad + nodesStack + laneBottomPadding
    heights.set(lane.id, Math.max(laneMinHeight, contentHeight))
  }

  return alignDetailLaneHeights(heights, lanes)
}

/**
 * Detail document layout — lane 컬럼 내 node 중앙 정렬, 위→아래 flow.
 */
export function placeNodesDetailVertical(
  process: Process,
  nodes: Node[],
  lanes: Lane[],
  doc: DetailDocumentLayout,
  _laneHeights: Map<string, number>,
  metrics: GridLayoutMetrics = DETAIL_GRID_METRICS,
): PlacedNode[] {
  const sized = nodes.map((n) => toSizedNode(n, process, metrics))
  const placed: PlacedNode[] = []
  const gap = metrics.nodeVerticalGap
  const { laneWidth } = DETAIL_DOCUMENT

  for (const lane of lanes) {
    const laneLeft = doc.laneLefts.get(lane.id) ?? 0
    const laneNodes = sized
      .filter((n) => n.laneId === lane.id)
      .sort((a, b) => a.localOrder - b.localOrder)

    let y = doc.nodeAreaTop
    for (let i = 0; i < laneNodes.length; i++) {
      const node = laneNodes[i]
      placed.push({
        id: node.id,
        laneId: lane.id,
        x: laneLeft + (laneWidth - node.width) / 2,
        y,
        width: node.width,
        height: node.height,
      })
      if (i < laneNodes.length - 1) {
        y += node.height + gap
      }
    }
  }

  return placed
}

export function buildDetailLaneBands(
  lanes: Lane[],
  doc: DetailDocumentLayout,
  laneHeights: Map<string, number>,
): LaneBand[] {
  const { laneWidth } = DETAIL_DOCUMENT
  const innerPad = 12

  return lanes.map((lane) => {
    const x = doc.laneLefts.get(lane.id) ?? 0
    const height = laneHeights.get(lane.id) ?? DETAIL_DOCUMENT.laneMinHeight
    const inactive = !doc.usedLaneIds.has(lane.id)

    return {
      laneId: lane.id,
      laneName: lane.name,
      ownerDepartment: lane.ownerDepartment,
      x,
      y: doc.documentTop,
      width: laneWidth,
      height,
      contentLeft: x + innerPad,
      contentTop: doc.nodeAreaTop,
      contentBottom: doc.documentTop + height - innerPad,
      contentRight: x + laneWidth - innerPad,
      inactive,
    }
  })
}

export function computeDetailCanvasHeight(laneBands: LaneBand[]): number {
  if (laneBands.length === 0) {
    return DETAIL_DOCUMENT.paddingTop + DETAIL_DOCUMENT.laneMinHeight + CANVAS_BOTTOM_PADDING
  }
  const maxBottom = Math.max(...laneBands.map((b) => b.y + b.height))
  return maxBottom + DETAIL_DOCUMENT.paddingBottom + CANVAS_BOTTOM_PADDING
}

export function computeDetailCanvasWidth(
  doc: DetailDocumentLayout,
  placed: PlacedNode[],
  edgeMaxX: number,
): number {
  const maxNodeRight =
    placed.length > 0 ? Math.max(...placed.map((n) => n.x + n.width)) : doc.canvasWidth
  return Math.max(doc.canvasWidth, maxNodeRight + DETAIL_DOCUMENT.paddingX, edgeMaxX + DETAIL_DOCUMENT.paddingX)
}
