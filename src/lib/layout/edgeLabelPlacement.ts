import type { PlacedNode } from './laneLayout'
import type { Segment } from './orthogonalEdgeRouter'

export type Point = { x: number; y: number }
export type LabelSegmentOrientation = 'horizontal' | 'vertical'

const LABEL_OFFSET = 14
const MIN_SEGMENT_LENGTH = 28
const LABEL_HALF_W = 22
const LABEL_HALF_H = 11
const NODE_PAD = 10
const EDGE_PAD = 12

export type LabelAnchor = {
  mid: Point
  orientation: LabelSegmentOrientation
}

function isHorizontalSegment(a: Point, b: Point): boolean {
  return Math.abs(a.y - b.y) < 1
}

function isVerticalSegment(a: Point, b: Point): boolean {
  return Math.abs(a.x - b.x) < 1
}

function segmentLength(a: Point, b: Point): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y)
}

/** 세그먼트 중점 + 방향 → 라벨 anchor */
export function anchorFromSegment(a: Point, b: Point, minContentX: number): LabelAnchor {
  const midX = (a.x + b.x) / 2
  const midY = (a.y + b.y) / 2

  if (isHorizontalSegment(a, b)) {
    return {
      mid: { x: Math.max(midX, minContentX), y: midY },
      orientation: 'horizontal',
    }
  }

  return {
    mid: { x: midX, y: midY },
    orientation: 'vertical',
  }
}

/** 가로 구간 → 위, 세로 구간 → 오른쪽 */
export function labelPointFromAnchor(anchor: LabelAnchor): Point {
  if (anchor.orientation === 'horizontal') {
    return { x: anchor.mid.x, y: anchor.mid.y - LABEL_OFFSET }
  }
  return { x: anchor.mid.x + LABEL_OFFSET, y: anchor.mid.y }
}

export function findLabelAnchor(
  points: Point[],
  minContentX: number,
  preferFirstSegment = false,
): LabelAnchor | null {
  if (points.length < 2) return null

  if (preferFirstSegment) {
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i]
      const b = points[i + 1]
      const len = segmentLength(a, b)
      if (len < 4) continue
      if (!isHorizontalSegment(a, b) && !isVerticalSegment(a, b)) continue
      return anchorFromSegment(a, b, minContentX)
    }
  }

  const segments: { a: Point; b: Point; len: number }[] = []
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]
    const b = points[i + 1]
    const len = segmentLength(a, b)
    if (len < MIN_SEGMENT_LENGTH) continue
    if (!isHorizontalSegment(a, b) && !isVerticalSegment(a, b)) continue
    segments.push({ a, b, len })
  }

  if (segments.length === 0) return null

  const chosen = preferFirstSegment
    ? segments[0]
    : segments.reduce((best, seg) => (seg.len > best.len ? seg : best), segments[0])

  return anchorFromSegment(chosen.a, chosen.b, minContentX)
}

export function labelPointFromOrthogonalPath(
  points: Point[],
  minContentX: number,
  preferFirstSegment = false,
): Point {
  const anchor = findLabelAnchor(points, minContentX, preferFirstSegment)
  if (anchor) return labelPointFromAnchor(anchor)

  const mid = points[Math.floor(points.length / 2)] ?? points[0]
  return { x: Math.max(mid.x, minContentX), y: mid.y - LABEL_OFFSET }
}

function labelBounds(center: Point, orientation: LabelSegmentOrientation) {
  return {
    x: center.x - LABEL_HALF_W,
    y:
      orientation === 'horizontal'
        ? center.y - LABEL_HALF_H
        : center.y - LABEL_HALF_H,
    width: LABEL_HALF_W * 2,
    height:
      orientation === 'horizontal'
        ? LABEL_HALF_H * 2 + LABEL_OFFSET
        : LABEL_HALF_H * 2,
  }
}

function rectsOverlap(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
}

function labelOverlapsNode(
  center: Point,
  orientation: LabelSegmentOrientation,
  placed: PlacedNode[],
  excludeIds: Set<string>,
): boolean {
  const box = labelBounds(center, orientation)
  return placed.some((node) => {
    if (excludeIds.has(node.id)) return false
    const nodeRect = {
      x: node.x - NODE_PAD,
      y: node.y - NODE_PAD,
      width: node.width + NODE_PAD * 2,
      height: node.height + NODE_PAD * 2,
    }
    return rectsOverlap(box, nodeRect)
  })
}

function labelOverlapsSegments(
  center: Point,
  orientation: LabelSegmentOrientation,
  segments: Segment[],
): boolean {
  const box = labelBounds(center, orientation)
  for (const seg of segments) {
    const pad = EDGE_PAD
    if (Math.abs(seg.y1 - seg.y2) < 1) {
      const y = seg.y1
      if (y >= box.y - pad && y <= box.y + box.height + pad) {
        const segMin = Math.min(seg.x1, seg.x2)
        const segMax = Math.max(seg.x1, seg.x2)
        if (segMax >= box.x - pad && segMin <= box.x + box.width + pad) return true
      }
    }
    if (Math.abs(seg.x1 - seg.x2) < 1) {
      const x = seg.x1
      if (x >= box.x - pad && x <= box.x + box.width + pad) {
        const segMin = Math.min(seg.y1, seg.y2)
        const segMax = Math.max(seg.y1, seg.y2)
        if (segMax >= box.y - pad && segMin <= box.y + box.height + pad) return true
      }
    }
  }
  return false
}

function isLabelClear(
  center: Point,
  orientation: LabelSegmentOrientation,
  placed: PlacedNode[],
  excludeIds: Set<string>,
  otherSegments: Segment[],
): boolean {
  if (labelOverlapsNode(center, orientation, placed, excludeIds)) return false
  if (otherSegments.length > 0 && labelOverlapsSegments(center, orientation, otherSegments)) return false
  return true
}

/** anchor 기준 선호 방향 → 대안 오프셋 순서로 collision-free 지점 탐색 */
export function resolveLabelPlacement(options: {
  points: Point[]
  minContentX: number
  placed: PlacedNode[]
  excludeIds: Set<string>
  existingSegments?: Segment[]
  ownSegments?: Segment[]
  preferFirstSegment?: boolean
  /** decision/condition 분기 라벨 — 겹쳐도 표시 */
  alwaysVisible?: boolean
}): { point: Point; hidden: boolean } {
  const {
    points,
    minContentX,
    placed,
    excludeIds,
    existingSegments = [],
    ownSegments = [],
    preferFirstSegment = false,
    alwaysVisible = false,
  } = options

  const anchor = findLabelAnchor(points, minContentX, preferFirstSegment)
  if (!anchor) {
    const fallback = labelPointFromOrthogonalPath(points, minContentX, preferFirstSegment)
    return { point: fallback, hidden: false }
  }

  const otherSegments = existingSegments.filter(
    (seg) => !ownSegments.some((own) => own === seg),
  )

  const { orientation } = anchor

  const offsets =
    orientation === 'horizontal'
      ? [
          { dx: 0, dy: -LABEL_OFFSET },
          { dx: 0, dy: -LABEL_OFFSET * 2 },
          { dx: LABEL_OFFSET, dy: -LABEL_OFFSET },
          { dx: -LABEL_OFFSET, dy: -LABEL_OFFSET },
          { dx: 0, dy: LABEL_OFFSET },
          { dx: 0, dy: -LABEL_OFFSET * 3 },
        ]
      : [
          { dx: LABEL_OFFSET, dy: 0 },
          { dx: LABEL_OFFSET * 2, dy: 0 },
          { dx: LABEL_OFFSET, dy: -LABEL_OFFSET },
          { dx: LABEL_OFFSET, dy: LABEL_OFFSET },
          { dx: -LABEL_OFFSET, dy: 0 },
          { dx: LABEL_OFFSET * 3, dy: 0 },
        ]

  let bestFallback = labelPointFromAnchor(anchor)

  for (const { dx, dy } of offsets) {
    const candidate = { x: anchor.mid.x + dx, y: anchor.mid.y + dy }
    if (isLabelClear(candidate, orientation, placed, excludeIds, otherSegments)) {
      return { point: candidate, hidden: false }
    }
    if (alwaysVisible) {
      bestFallback = candidate
    }
  }

  return { point: bestFallback, hidden: alwaysVisible ? false : true }
}
