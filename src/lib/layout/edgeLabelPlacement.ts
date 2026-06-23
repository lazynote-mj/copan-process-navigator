import type { EdgeHandleId, Node } from '../../types/process'
import type { EdgeType } from '../../types/edgeTypes'
import type { PlacedNode } from './laneLayout'
import type { Segment } from './orthogonalEdgeRouter'
import { isBranchNodeType, getDecisionDiamondVertex } from './decisionAnchors'
import { DECISION_NODE_LAYOUT } from './decisionNodeLayout'

export type Point = { x: number; y: number }
export type LabelSegmentOrientation = 'horizontal' | 'vertical'
export type LabelRect = { x: number; y: number; width: number; height: number }
export type LabelSide = 'above' | 'below' | 'left' | 'right'

const MIN_SEGMENT_LENGTH = 28
const LABEL_HALF_H = 11
const NODE_PAD = 18
const BRANCH_NODE_PAD = DECISION_NODE_LAYOUT.exclusionPadding + 10
const EDGE_PAD = 8
/** 배지 가장자리 ↔ 연결선 최소 간격 — LABEL_GAP 과 동일하게 유지 */
const MIN_LINE_CLEARANCE = 2
const LABEL_GAP = 2
const BRANCH_LABEL_GAP = 2
const LABEL_GAPS = [1, 2, 3] as const
const BRANCH_MIN_APPROACH_DIST = 22
const REGULAR_MIN_DEPARTURE_DIST = 18
const SHORT_VERTICAL_STUB_MAX = 20
const LONG_LABEL_HALF_W = 32
const LONG_LABEL_CHAR_COUNT = 18
/** 배지 텍스트 ↔ 선/노드 — 약 1글자(6.5px) 간격 */
const CHAR_GAP = 7

type SourceDepartureContext = {
  source: PlacedNode
  sourceType?: string
  labelHalfW: number
  sourceHandle?: EdgeHandleId
  segmentOrientation?: LabelSegmentOrientation
  /** 판단·interface-rule — 꼭지점 근처만 제외 */
  branchNode?: boolean
}

type TargetApproachContext = {
  target: PlacedNode
  targetType?: string
  labelHalfW: number
  targetHandle: EdgeHandleId
  segmentOrientation?: LabelSegmentOrientation
  branchNode?: boolean
  /** 노드/선에 글자 1자 간격으로 붙이는 배치 */
  tight?: boolean
}

export type LabelAnchor = {
  mid: Point
  orientation: LabelSegmentOrientation
  segmentIndex: number
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

function pointOnSegment(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
}

/** 꼭짓점/노드 출발점에서 최소 px 이후 t 값들 */
function departureTsFromMinDistance(
  segLen: number,
  minDist: number,
  preferNearSource = false,
): number[] {
  if (segLen < minDist + 6) return [0.55, 0.65]
  const t0 = minDist / segLen
  const base = [t0, t0 + 0.08, t0 + 0.16, t0 + 0.24].filter((t) => t <= 0.82)
  if (!preferNearSource || segLen < minDist * 2.5) return base
  const early = [0.07, 0.1, 0.13, 0.16].filter((t) => t * segLen >= 14 && t < (base[0] ?? 1))
  return [...new Set([...early, ...base])]
}

/** 타깃 진입 직전 t — 긴 라벨은 노드 위에 걸치지 않도록 폭만큼 더 이른 t */
function approachTsFromMinDistance(segLen: number, minDist: number, halfW = 0): number[] {
  const widthMargin = halfW > LONG_LABEL_HALF_W ? halfW * 0.92 + LABEL_GAP : 0
  const effectiveMin = minDist + widthMargin
  if (segLen < effectiveMin + 6) return [0.45, 0.35, 0.28]
  const tMax = 1 - effectiveMin / segLen
  const candidates = [tMax, tMax - 0.08, tMax - 0.14, tMax - 0.2, tMax - 0.26]
  return candidates.filter((t) => t >= 0.12)
}

/** 긴 가로 진입 라벨 — target(left) 쪽이 아닌 source 쪽 segment에 배치 */
function approachTsPreferSourceSide(segLen: number, halfW: number): number[] {
  const labelSpan = halfW * 2 + LABEL_GAP * 2 + 12
  const minT = Math.min(0.58, labelSpan / segLen + 0.05)
  const candidates = [0.18, 0.26, 0.34, 0.42, minT, minT + 0.1, minT + 0.18]
  return [...new Set(candidates.filter((t) => t >= 0.1 && t <= 0.62))].sort((a, b) => a - b)
}

function findPrimaryVerticalDropSegment(
  points: Point[],
  minLen = 24,
): { a: Point; b: Point; segmentIndex: number; len: number } | null {
  let best: { a: Point; b: Point; segmentIndex: number; len: number } | null = null
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!
    const b = points[i + 1]!
    if (!isVerticalSegment(a, b)) continue
    const len = segmentLength(a, b)
    if (len < minLen) continue
    if (!best || len > best.len || (Math.abs(len - best.len) < 4 && i < best.segmentIndex)) {
      best = { a, b, segmentIndex: i, len }
    }
  }
  return best
}

function tryTightTextPlacement(options: {
  point: Point
  labelText: string
  segmentIndex: number
  placed: PlacedNode[]
  excludeIds: Set<string>
  pathSegments: Segment[]
  existingLabelRects: LabelRect[]
  nodeTypes?: Map<string, string>
  sourceDeparture?: SourceDepartureContext
  targetApproach?: TargetApproachContext
}): { point: Point; hidden: boolean; labelRect: LabelRect } | null {
  const box = labelRectFromCenterPoint(options.point, options.labelText)
  if (
    isLabelClear(
      box,
      options.placed,
      options.excludeIds,
      options.pathSegments,
      options.segmentIndex,
      options.existingLabelRects,
      options.nodeTypes,
      options.sourceDeparture,
      options.targetApproach,
    )
  ) {
    return { point: options.point, hidden: false, labelRect: box }
  }
  return null
}

/** same-side handle 수직 drop leg — 첫 글자가 선에서 CHAR_GAP */
export function resolveVerticalDropLegLabelPlacement(options: {
  points: Point[]
  sourceHandle: EdgeHandleId
  minContentX: number
  placed: PlacedNode[]
  excludeIds: Set<string>
  ownSegments?: Segment[]
  labelText?: string
  existingLabelRects?: LabelRect[]
  nodeTypes?: Map<string, string>
  sourcePlaced?: PlacedNode
  sourceType?: string
}): { point: Point; hidden: boolean; labelRect?: LabelRect } | null {
  const {
    points,
    sourceHandle,
    placed,
    excludeIds,
    ownSegments = [],
    labelText = '',
    existingLabelRects = [],
    nodeTypes,
    sourcePlaced,
    sourceType,
  } = options

  const vertical = findPrimaryVerticalDropSegment(points)
  if (!vertical) return null

  const { a, b, segmentIndex, len } = vertical
  const pathSegments = ownSegments.length > 0 ? ownSegments : pathSegmentsFromPoints(points)
  const ts = branchDepartureTs(len, estimateLabelHalfWidth(labelText))
  const sourceDeparture: SourceDepartureContext | undefined = sourcePlaced
    ? {
        source: sourcePlaced,
        sourceType,
        labelHalfW: estimateLabelHalfWidth(labelText),
        sourceHandle,
        segmentOrientation: 'vertical',
      }
    : undefined

  for (const t of ts) {
    const linePoint = pointOnSegment(a, b, t)
    const point =
      sourceHandle === 'left'
        ? labelPointBesideVerticalLineLeft(linePoint, labelText)
        : labelPointBesideVerticalLineRight(linePoint, labelText)
    const placedLabel = tryTightTextPlacement({
      point,
      labelText,
      segmentIndex,
      placed,
      excludeIds,
      pathSegments,
      existingLabelRects,
      nodeTypes,
      sourceDeparture,
    })
    if (placedLabel) return placedLabel
  }

  return null
}

/** 판단노드 분기 출구 — 꼭짓점에서 8~14px 구간 우선 */
function branchDepartureTs(segLen: number, halfW: number): number[] {
  const minDist = Math.max(8, Math.min(14, 10 + halfW * 0.06))
  if (segLen < minDist + 2) return [0.42, 0.55]
  const t0 = minDist / segLen
  const candidates = [t0, t0 + 0.02, t0 + 0.04, t0 + 0.07, t0 + 0.1, t0 + 0.14, t0 + 0.18]
  return candidates.filter((t) => t <= 0.34)
}

/** 마름모 꼭짓점 주변만 제외 — 라벨은 출구 선 바로 옆에 둠 */
function branchNodeDepartureExclusionRect(
  source: PlacedNode,
  sourceHandle: EdgeHandleId,
): LabelRect {
  const vertex = getDecisionDiamondVertex(source, sourceHandle)
  const w = 18
  const h = 14
  switch (sourceHandle) {
    case 'right':
      return { x: vertex.x - w, y: vertex.y - h, width: w + 4, height: h * 2 }
    case 'left':
      return { x: vertex.x - 4, y: vertex.y - h, width: w + 4, height: h * 2 }
    case 'bottom':
      return { x: vertex.x - w, y: vertex.y - 4, width: w * 2, height: h + 4 }
    case 'top':
      return { x: vertex.x - w, y: vertex.y - h, width: w * 2, height: h + 4 }
    default:
      return { x: vertex.x - w, y: vertex.y - h, width: w * 2, height: h * 2 }
  }
}

/** 라벨 텍스트 길이 기반 반폭 (재고인식(+) 등 긴 라벨) */
export function estimateLabelHalfWidth(label?: string): number {
  return estimateLabelTextWidth(label) / 2
}

/** 실제 텍스트 폭 — translate(-50%) 중심 배치용 */
function estimateLabelTextWidth(label?: string): number {
  const text = label?.trim() ?? ''
  if (!text) return 44
  return text.length * 6.5 + 10
}

function labelRectFromCenterPoint(point: Point, text: string): LabelRect {
  const w = estimateLabelTextWidth(text)
  const h = LABEL_HALF_H * 2
  return { x: point.x - w / 2, y: point.y - h / 2, width: w, height: h }
}

/** 수직선 오른쪽 — 첫 글자(좌측)가 선에서 CHAR_GAP */
function labelPointBesideVerticalLineRight(linePoint: Point, text: string): Point {
  const w = estimateLabelTextWidth(text)
  return { x: linePoint.x + CHAR_GAP + w / 2, y: linePoint.y }
}

/** 수직선 왼쪽 — 마지막 글자(우측)가 선에서 CHAR_GAP */
function labelPointBesideVerticalLineLeft(linePoint: Point, text: string): Point {
  const w = estimateLabelTextWidth(text)
  return { x: linePoint.x - CHAR_GAP - w / 2, y: linePoint.y }
}

/** 노드 좌측 — 마지막 글자(우측)가 nodeLeft - CHAR_GAP */
function labelPointBesideNodeLeft(
  nodeLeft: number,
  y: number,
  text: string,
  verticalSide: 'above' | 'below' = 'above',
): Point {
  const w = estimateLabelTextWidth(text)
  const h = LABEL_HALF_H * 2
  const centerX = nodeLeft - CHAR_GAP - w / 2
  const centerY =
    verticalSide === 'above' ? y - CHAR_GAP - h / 2 : y + CHAR_GAP + h / 2
  return { x: centerX, y: centerY }
}

function anchorFromSegment(
  a: Point,
  b: Point,
  minContentX: number,
  segmentIndex: number,
  t = 0.5,
): LabelAnchor {
  const midX = a.x + (b.x - a.x) * t
  const midY = a.y + (b.y - a.y) * t

  if (isHorizontalSegment(a, b)) {
    return {
      mid: { x: Math.max(midX, minContentX), y: midY },
      orientation: 'horizontal',
      segmentIndex,
    }
  }

  return {
    mid: { x: midX, y: midY },
    orientation: 'vertical',
    segmentIndex,
  }
}

/** 라벨 박스 — 선/노드와 겹치지 않도록 anchor 한쪽에만 배치 */
function labelBounds(
  center: Point,
  halfW: number,
  side: LabelSide,
  gap = LABEL_GAP,
): LabelRect {
  const halfH = LABEL_HALF_H
  switch (side) {
    case 'above':
      return {
        x: center.x - halfW,
        y: center.y - gap - halfH * 2,
        width: halfW * 2,
        height: halfH * 2,
      }
    case 'below':
      return {
        x: center.x - halfW,
        y: center.y + gap,
        width: halfW * 2,
        height: halfH * 2,
      }
    case 'left':
      return {
        x: center.x - gap - halfW * 2,
        y: center.y - halfH,
        width: halfW * 2,
        height: halfH * 2,
      }
    case 'right':
      return {
        x: center.x + gap,
        y: center.y - halfH,
        width: halfW * 2,
        height: halfH * 2,
      }
  }
}

function rectsOverlap(
  a: LabelRect,
  b: LabelRect,
): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
}

function segmentToRect(seg: Segment, pad: number): LabelRect {
  return {
    x: Math.min(seg.x1, seg.x2) - pad,
    y: Math.min(seg.y1, seg.y2) - pad,
    width: Math.abs(seg.x2 - seg.x1) + pad * 2,
    height: Math.abs(seg.y2 - seg.y1) + pad * 2,
  }
}

function nodeExclusionRect(node: PlacedNode, nodeType?: string): LabelRect {
  const pad = isBranchNodeType(nodeType) ? BRANCH_NODE_PAD : NODE_PAD
  return {
    x: node.x - pad,
    y: node.y - pad,
    width: node.width + pad * 2,
    height: node.height + pad * 2,
  }
}

/** 출발 segment — 경로 방향으로만 확장 (라벨 side 방향은 막지 않음) */
function sourceDepartureExclusionRect(
  source: PlacedNode,
  sourceType: string | undefined,
  labelHalfW: number,
  sourceHandle?: EdgeHandleId,
  segmentOrientation?: LabelSegmentOrientation,
): LabelRect {
  const base = nodeExclusionRect(source, sourceType)
  const along = Math.max(10, labelHalfW * 0.3)
  const cross = 6

  if (segmentOrientation === 'vertical') {
    switch (sourceHandle) {
      case 'bottom':
        return { ...base, height: base.height + along, width: base.width + cross * 2 }
      case 'top':
        return { ...base, y: base.y - cross, height: base.height + along + cross, width: base.width + cross * 2 }
      default:
        return { ...base, height: base.height + along, width: base.width + cross * 2 }
    }
  }

  if (segmentOrientation === 'horizontal') {
    switch (sourceHandle) {
      case 'right':
        return { ...base, width: base.width + along, height: base.height + cross * 2 }
      case 'left':
        return { ...base, x: base.x - along, width: base.width + along, height: base.height + cross * 2 }
      default:
        return { ...base, width: base.width + cross * 2, height: base.height + along }
    }
  }

  switch (sourceHandle) {
    case 'right':
      return { ...base, width: base.width + along, height: base.height + cross * 2 }
    case 'left':
      return { ...base, x: base.x - along, width: base.width + along, height: base.height + cross * 2 }
    case 'bottom':
      return { ...base, height: base.height + along, width: base.width + cross * 2 }
    case 'top':
      return { ...base, y: base.y - along, height: base.height + along, width: base.width + cross * 2 }
    default:
      return { ...base, width: base.width + cross * 2, height: base.height + Math.max(along, cross * 2) }
  }
}

/** 타깃 진입 라벨 — 노드 본체와 겹치지 않도록 handle 방향으로 확장 */
function targetApproachExclusionRect(
  target: PlacedNode,
  targetType: string | undefined,
  labelHalfW: number,
  targetHandle: EdgeHandleId,
  segmentOrientation?: LabelSegmentOrientation,
  tight = false,
): LabelRect {
  if (isBranchNodeType(targetType) && targetHandle) {
    const vertex = getDecisionDiamondVertex(target, targetHandle)
    const w = Math.max(18, labelHalfW * 0.35)
    const h = 14
    switch (targetHandle) {
      case 'left':
        return { x: vertex.x - 4, y: vertex.y - h, width: w + 8, height: h * 2 }
      case 'right':
        return { x: vertex.x - w, y: vertex.y - h, width: w + 8, height: h * 2 }
      case 'top':
        return { x: vertex.x - w, y: vertex.y - h, width: w * 2, height: h + 6 }
      case 'bottom':
        return { x: vertex.x - w, y: vertex.y - 4, width: w * 2, height: h + 6 }
      default:
        return nodeExclusionRect(target, targetType)
    }
  }

  const base = nodeExclusionRect(target, targetType)
  const along = Math.max(12, labelHalfW * 0.2)
  const cross = 8

  if (segmentOrientation === 'horizontal') {
    switch (targetHandle) {
      case 'left': {
        if (tight) {
          return { ...base, width: base.width + CHAR_GAP + 2, height: base.height + 6 }
        }
        const along =
          labelHalfW > LONG_LABEL_HALF_W ? labelHalfW * 1.05 + 28 : Math.max(12, labelHalfW * 0.2)
        return { ...base, width: base.width + along, height: base.height + cross * 2 }
      }
      case 'right':
        return { ...base, x: base.x - along, width: base.width + along, height: base.height + cross * 2 }
      default:
        return { ...base, height: base.height + cross * 2, width: base.width + cross * 2 }
    }
  }

  if (segmentOrientation === 'vertical') {
    switch (targetHandle) {
      case 'top':
        return { ...base, y: base.y - along, height: base.height + along, width: base.width + cross * 2 }
      case 'bottom':
        return { ...base, height: base.height + along, width: base.width + cross * 2 }
      default:
        return { ...base, width: base.width + cross * 2, height: base.height + along }
    }
  }

  return base
}

function approachPreferredSides(
  targetHandle: EdgeHandleId,
  orientation: LabelSegmentOrientation,
  halfW: number,
): LabelSide[] {
  const base = branchPreferredSides(targetHandle, orientation, 'approach')
  if (halfW <= LONG_LABEL_HALF_W) return base
  if (orientation === 'horizontal') {
    if (targetHandle === 'left') return ['left', 'above', 'below']
    if (targetHandle === 'right') return ['right', 'above', 'below']
  }
  if (orientation === 'vertical') {
    if (targetHandle === 'top') return ['above', 'left', 'right']
    if (targetHandle === 'bottom') return ['below', 'left', 'right']
  }
  return base
}

function labelOverlapsRect(box: LabelRect, rect: LabelRect): boolean {
  return rectsOverlap(box, rect)
}

function labelOverlapsNode(
  box: LabelRect,
  placed: PlacedNode[],
  excludeIds: Set<string>,
  nodeTypes?: Map<string, string>,
): boolean {
  return placed.some((node) => {
    if (excludeIds.has(node.id)) return false
    const nodeRect = nodeExclusionRect(node, nodeTypes?.get(node.id))
    return rectsOverlap(box, nodeRect)
  })
}

function labelOverlapsSegments(
  box: LabelRect,
  segments: Segment[],
  anchorSegmentIndex: number | null,
): boolean {
  for (let i = 0; i < segments.length; i++) {
    const pad = i === anchorSegmentIndex ? MIN_LINE_CLEARANCE : EDGE_PAD
    const segBox = segmentToRect(segments[i], pad)
    if (rectsOverlap(box, segBox)) return true
  }
  return false
}

function labelOverlapsLabels(box: LabelRect, existing: LabelRect[]): boolean {
  return existing.some((other) => rectsOverlap(box, other))
}

function isLabelClear(
  box: LabelRect,
  placed: PlacedNode[],
  excludeIds: Set<string>,
  pathSegments: Segment[],
  anchorSegmentIndex: number | null,
  existingLabelRects: LabelRect[],
  nodeTypes?: Map<string, string>,
  sourceDeparture?: SourceDepartureContext,
  targetApproach?: TargetApproachContext,
): boolean {
  if (sourceDeparture) {
    const sourceRect =
      sourceDeparture.branchNode && sourceDeparture.sourceHandle
        ? branchNodeDepartureExclusionRect(sourceDeparture.source, sourceDeparture.sourceHandle)
        : sourceDepartureExclusionRect(
            sourceDeparture.source,
            sourceDeparture.sourceType,
            sourceDeparture.labelHalfW,
            sourceDeparture.sourceHandle,
            sourceDeparture.segmentOrientation,
          )
    if (labelOverlapsRect(box, sourceRect)) return false
  }

  if (targetApproach) {
    const targetRect = targetApproachExclusionRect(
      targetApproach.target,
      targetApproach.targetType,
      targetApproach.labelHalfW,
      targetApproach.targetHandle,
      targetApproach.segmentOrientation,
      targetApproach.tight,
    )
    if (labelOverlapsRect(box, targetRect)) return false
  }

  if (labelOverlapsNode(box, placed, excludeIds, nodeTypes)) return false
  if (labelOverlapsSegments(box, pathSegments, anchorSegmentIndex)) return false
  if (labelOverlapsLabels(box, existingLabelRects)) return false
  return true
}

function labelRectCenter(box: LabelRect): Point {
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

function listSegmentAnchors(
  points: Point[],
  minContentX: number,
  preferFirstSegment: boolean,
  preferEndpointSegments = false,
): LabelAnchor[] {
  if (points.length < 2) return []

  const segments: { a: Point; b: Point; len: number; index: number }[] = []
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!
    const b = points[i + 1]!
    const len = segmentLength(a, b)
    const minLen = i === 0 || i === points.length - 2 ? 12 : MIN_SEGMENT_LENGTH
    if (len < minLen) continue
    if (!isHorizontalSegment(a, b) && !isVerticalSegment(a, b)) continue
    segments.push({ a, b, len, index: i })
  }

  if (segments.length === 0) return []

  let ordered: typeof segments
  if (preferEndpointSegments && segments.length > 1) {
    const first = segments[0]!
    const last = segments[segments.length - 1]!
    const middle = segments
      .slice(1, -1)
      .sort((a, b) => b.len - a.len)
    ordered = preferFirstSegment ? [first, last, ...middle] : [last, first, ...middle]
  } else {
    ordered = preferFirstSegment
      ? [...segments].sort((a, b) => a.index - b.index)
      : [...segments].sort((a, b) => b.len - a.len)
  }

  const anchors: LabelAnchor[] = []
  for (const seg of ordered) {
    const isEndpoint = seg.index === ordered[0]?.index
    const ts = isEndpoint && preferFirstSegment
      ? departureTsFromMinDistance(seg.len, REGULAR_MIN_DEPARTURE_DIST)
      : isEndpoint && preferEndpointSegments && !preferFirstSegment
        ? approachTsFromMinDistance(seg.len, REGULAR_MIN_DEPARTURE_DIST)
        : isEndpoint
          ? [0.35, 0.5, 0.65]
          : [0.5, 0.35, 0.65, 0.25, 0.75]
    for (const t of ts) {
      anchors.push(anchorFromSegment(seg.a, seg.b, minContentX, seg.index, t))
    }
  }
  return anchors
}

function branchPreferredSides(
  handle: EdgeHandleId,
  orientation: LabelSegmentOrientation,
  mode: 'departure' | 'approach',
): LabelSide[] {
  if (orientation === 'horizontal') {
    if (mode === 'departure') {
      if (handle === 'right') return ['above', 'below', 'right']
      if (handle === 'left') return ['above', 'below', 'left']
      return ['above', 'below']
    }
    if (handle === 'left') return ['above', 'below', 'left']
    if (handle === 'right') return ['above', 'below', 'right']
    return ['above', 'below']
  }

  if (mode === 'departure') {
    if (handle === 'bottom') return ['below', 'right', 'left', 'above']
    if (handle === 'top') return ['above', 'right', 'left', 'below']
    if (handle === 'right') return ['right', 'above', 'below']
    return ['left', 'above', 'below']
  }

  if (handle === 'top') return ['above', 'right', 'left']
  if (handle === 'bottom') return ['below', 'right', 'left']
  if (handle === 'left') return ['left', 'above', 'below']
  return ['right', 'above', 'below']
}

function tryLabelOnSegment(options: {
  a: Point
  b: Point
  segmentIndex: number
  ts: number[]
  sides: LabelSide[]
  gap: number
  halfW: number
  minContentX: number
  placed: PlacedNode[]
  excludeIds: Set<string>
  pathSegments: Segment[]
  existingLabelRects: LabelRect[]
  nodeTypes?: Map<string, string>
  sourceDeparture?: SourceDepartureContext
  targetApproach?: TargetApproachContext
}): { point: Point; hidden: boolean; labelRect: LabelRect } | null {
  const {
    a,
    b,
    segmentIndex,
    ts,
    sides,
    gap,
    halfW,
    minContentX,
    placed,
    excludeIds,
    pathSegments,
    existingLabelRects,
    nodeTypes,
    sourceDeparture,
    targetApproach,
  } = options

  const orientation: LabelSegmentOrientation = isHorizontalSegment(a, b) ? 'horizontal' : 'vertical'
  const departureContext = sourceDeparture
    ? { ...sourceDeparture, segmentOrientation: orientation }
    : undefined
  const approachContext = targetApproach
    ? { ...targetApproach, segmentOrientation: orientation }
    : undefined
  const gaps: number[] = [...LABEL_GAPS]
  if (!gaps.includes(gap)) gaps.push(gap)

  for (const t of ts) {
    const linePoint = pointOnSegment(a, b, t)
    const anchorX = orientation === 'horizontal' ? Math.max(linePoint.x, minContentX) : linePoint.x
    const anchor = { x: anchorX, y: linePoint.y }

    for (const side of sides) {
      for (const sideGap of gaps) {
        const box = labelBounds(anchor, halfW, side, sideGap)
        if (
          isLabelClear(
            box,
            placed,
            excludeIds,
            pathSegments,
            segmentIndex,
            existingLabelRects,
            nodeTypes,
            departureContext,
            approachContext,
          )
        ) {
          return { point: labelRectCenter(box), hidden: false, labelRect: box }
        }
      }
    }
  }

  return null
}

export function inferHandleFromPathSegment(a: Point, b: Point): EdgeHandleId {
  const dx = b.x - a.x
  const dy = b.y - a.y
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'right' : 'left'
  return dy >= 0 ? 'bottom' : 'top'
}

function pathSegmentsFromPoints(points: Point[]): Segment[] {
  return points.slice(0, -1).map((a, i) => ({
    x1: a.x,
    y1: a.y,
    x2: points[i + 1]!.x,
    y2: points[i + 1]!.y,
  }))
}

/** 판단·인터페이스 분기 노드에서 나가는 선 — 꼭짓점 출구 직후 */
export function resolveBranchDepartureLabelPlacement(options: {
  points: Point[]
  sourceHandle: EdgeHandleId
  minContentX: number
  placed: PlacedNode[]
  excludeIds: Set<string>
  ownSegments?: Segment[]
  labelText?: string
  existingLabelRects?: LabelRect[]
  nodeTypes?: Map<string, string>
  sourcePlaced?: PlacedNode
  sourceType?: string
}): { point: Point; hidden: boolean; labelRect?: LabelRect } {
  const {
    points,
    sourceHandle,
    minContentX,
    placed,
    excludeIds,
    ownSegments = [],
    labelText = '',
    existingLabelRects = [],
    nodeTypes,
    sourcePlaced,
    sourceType,
  } = options

  if (points.length < 2) {
    return { point: points[0] ?? { x: 0, y: 0 }, hidden: true }
  }

  const a = points[0]!
  const b = points[1]!
  const segLen = segmentLength(a, b)
  if (segLen < 4 || (!isHorizontalSegment(a, b) && !isVerticalSegment(a, b))) {
    return { point: a, hidden: true }
  }

  const halfW = estimateLabelHalfWidth(labelText)
  const pathSegments = ownSegments.length > 0 ? ownSegments : pathSegmentsFromPoints(points)
  const orientation: LabelSegmentOrientation = isHorizontalSegment(a, b) ? 'horizontal' : 'vertical'
  const sides = branchPreferredSides(sourceHandle, orientation, 'departure')
  const ts = branchDepartureTs(segLen, halfW)
  const branchSourceDeparture: SourceDepartureContext | undefined = sourcePlaced
    ? {
        source: sourcePlaced,
        sourceType,
        labelHalfW: halfW,
        sourceHandle,
        branchNode: isBranchNodeType(sourceType),
      }
    : undefined

  const placedOnSegment = tryLabelOnSegment({
    a,
    b,
    segmentIndex: 0,
    ts,
    sides,
    gap: BRANCH_LABEL_GAP,
    halfW,
    minContentX,
    placed,
    excludeIds,
    pathSegments,
    existingLabelRects,
    nodeTypes,
    sourceDeparture: branchSourceDeparture,
  })
  if (placedOnSegment) return placedOnSegment

  if (
    orientation === 'vertical' &&
    segLen < SHORT_VERTICAL_STUB_MAX &&
    (sourceHandle === 'top' || sourceHandle === 'bottom') &&
    points.length >= 3
  ) {
    const a1 = points[1]!
    const b1 = points[2]!
    const horizLen = segmentLength(a1, b1)
    if (isHorizontalSegment(a1, b1) && horizLen >= 8) {
      const horizPlaced = tryLabelOnSegment({
        a: a1,
        b: b1,
        segmentIndex: 1,
        ts: branchDepartureTs(horizLen, halfW),
        sides: branchPreferredSides(sourceHandle, 'horizontal', 'departure'),
        gap: BRANCH_LABEL_GAP,
        halfW,
        minContentX,
        placed,
        excludeIds,
        pathSegments,
        existingLabelRects,
        nodeTypes,
        sourceDeparture: branchSourceDeparture,
      })
      if (horizPlaced) return horizPlaced
    }
  }

  const t0 = ts[0] ?? 0.12
  const anchor = pointOnSegment(a, b, t0)
  const side = sides[0] ?? (orientation === 'horizontal' ? 'above' : 'right')
  const box = labelBounds(anchor, halfW, side, 1)
  return { point: labelRectCenter(box), hidden: false, labelRect: box }
}

/** 긴 설명 라벨 — cross-zone·API 등은 목적지 노드 근처가 읽기 좋음 */
export function shouldPreferTargetLabelPlacement(
  edgeType: EdgeType,
  labelText: string | undefined,
  sourceNode?: Node,
  targetNode?: Node,
): boolean {
  const text = labelText?.trim() ?? ''
  if (!text) return false
  const halfW = estimateLabelHalfWidth(text)
  const isLong = halfW > LONG_LABEL_HALF_W || text.length > LONG_LABEL_CHAR_COUNT
  if (!isLong) return false
  if (edgeType === 'api' || edgeType === 'virtual') return true
  if (
    sourceNode?.processZone &&
    targetNode?.processZone &&
    sourceNode.processZone !== targetNode.processZone
  ) {
    return true
  }
  if (sourceNode?.laneId && targetNode?.laneId && sourceNode.laneId !== targetNode.laneId) {
    return true
  }
  return false
}

/** 판단·인터페이스 분기 노드로 들어오는 선 — 마지막 segment 진입 직전 */
export function resolveBranchApproachLabelPlacement(options: {
  points: Point[]
  targetHandle: EdgeHandleId
  minContentX: number
  placed: PlacedNode[]
  excludeIds: Set<string>
  ownSegments?: Segment[]
  labelText?: string
  existingLabelRects?: LabelRect[]
  nodeTypes?: Map<string, string>
  targetPlaced?: PlacedNode
  targetType?: string
}): { point: Point; hidden: boolean; labelRect?: LabelRect } | null {
  const {
    points,
    targetHandle,
    minContentX,
    placed,
    excludeIds,
    ownSegments = [],
    labelText = '',
    existingLabelRects = [],
    nodeTypes,
    targetPlaced,
    targetType,
  } = options

  if (points.length < 2) return null

  const lastIndex = points.length - 2
  const halfW = estimateLabelHalfWidth(labelText)
  const pathSegments = ownSegments.length > 0 ? ownSegments : pathSegmentsFromPoints(points)
  const segmentCandidates = [lastIndex, lastIndex - 1].filter((i) => i >= 0)
  const nodeCollisionExcludeIds = targetPlaced
    ? new Set([...excludeIds].filter((id) => id !== targetPlaced.id))
    : excludeIds
  const targetApproachContext: TargetApproachContext | undefined = targetPlaced
    ? {
        target: targetPlaced,
        targetType,
        labelHalfW: halfW,
        targetHandle,
        branchNode: isBranchNodeType(targetType),
      }
    : undefined

  for (const segmentIndex of segmentCandidates) {
    const a = points[segmentIndex]!
    const b = points[segmentIndex + 1]!
    const segLen = segmentLength(a, b)
    if (segLen < 8) continue
    if (!isHorizontalSegment(a, b) && !isVerticalSegment(a, b)) continue

    const orientation: LabelSegmentOrientation = isHorizontalSegment(a, b) ? 'horizontal' : 'vertical'
    const isLongLabel = halfW > LONG_LABEL_HALF_W
    const horizontalLeftApproach =
      orientation === 'horizontal' && targetHandle === 'left' && isLongLabel

    if (horizontalLeftApproach && targetPlaced) {
      const tightContext: TargetApproachContext = {
        target: targetPlaced,
        targetType,
        labelHalfW: halfW,
        targetHandle,
        segmentOrientation: 'horizontal',
        branchNode: isBranchNodeType(targetType),
        tight: true,
      }
      const nodeLeft = targetPlaced.x
      const lineY = a.y
      for (const verticalSide of ['above', 'below'] as const) {
        const point = labelPointBesideNodeLeft(nodeLeft, lineY, labelText, verticalSide)
        const tightLabel = tryTightTextPlacement({
          point,
          labelText,
          segmentIndex,
          placed,
          excludeIds: nodeCollisionExcludeIds,
          pathSegments,
          existingLabelRects,
          nodeTypes,
          targetApproach: tightContext,
        })
        if (tightLabel) return tightLabel
      }
    }

    const sides: LabelSide[] = horizontalLeftApproach
      ? (['above', 'left', 'below', 'right'] as const)
      : approachPreferredSides(targetHandle, orientation, halfW)
    const minApproach = isLongLabel ? 14 : BRANCH_MIN_APPROACH_DIST
    const ts = horizontalLeftApproach
      ? approachTsPreferSourceSide(segLen, halfW)
      : approachTsFromMinDistance(segLen, minApproach, halfW)

    const placedOnSegment = tryLabelOnSegment({
      a,
      b,
      segmentIndex,
      ts,
      sides,
      gap: BRANCH_LABEL_GAP,
      halfW,
      minContentX,
      placed,
      excludeIds: nodeCollisionExcludeIds,
      pathSegments,
      existingLabelRects,
      nodeTypes,
      targetApproach: targetApproachContext,
    })
    if (placedOnSegment) return placedOnSegment
  }

  return null
}

/** 같은 행 N 반려 — 첫 가로 회랑(또는 단일 가로 manual) segment */
function findSameRowReturnHorizontalSegment(
  points: Point[],
): { a: Point; b: Point; segmentIndex: number } | null {
  if (points.length < 2) return null

  if (points.length === 2) {
    const a = points[0]!
    const b = points[1]!
    if (isHorizontalSegment(a, b) && segmentLength(a, b) >= 24) {
      return { a, b, segmentIndex: 0 }
    }
    return null
  }

  const stubA = points[0]!
  const stubB = points[1]!
  if (isVerticalSegment(stubA, stubB) && points.length >= 3) {
    const horizA = points[1]!
    const horizB = points[2]!
    if (isHorizontalSegment(horizA, horizB) && segmentLength(horizA, horizB) >= 24) {
      return { a: horizA, b: horizB, segmentIndex: 1 }
    }
  }

  return null
}

/** 같은 행 N 반려 가로 회랑 — source x 근처, 선 아래(PDF 스타일) */
export function resolveDecisionSameRowReturnLabelPlacement(options: {
  points: Point[]
  labelText?: string
  sourceHandle: EdgeHandleId
  minContentX: number
  placed: PlacedNode[]
  excludeIds: Set<string>
  ownSegments?: Segment[]
  existingLabelRects?: LabelRect[]
  nodeTypes?: Map<string, string>
  sourcePlaced?: PlacedNode
  sourceType?: string
}): { point: Point; hidden: boolean; labelRect?: LabelRect } | null {
  const {
    points,
    sourceHandle,
    minContentX,
    placed,
    excludeIds,
    ownSegments = [],
    labelText = '',
    existingLabelRects = [],
    nodeTypes,
    sourcePlaced,
    sourceType,
  } = options

  const segment = findSameRowReturnHorizontalSegment(points)
  if (!segment) return null

  const { a, b, segmentIndex } = segment
  const segLen = segmentLength(a, b)
  const halfW = estimateLabelHalfWidth(labelText)
  const pathSegments = ownSegments.length > 0 ? ownSegments : pathSegmentsFromPoints(points)
  const sides: LabelSide[] = ['below', 'above', 'left', 'right']
  const ts = branchDepartureTs(segLen, halfW)
  const branchSourceDeparture: SourceDepartureContext | undefined = sourcePlaced
    ? {
        source: sourcePlaced,
        sourceType,
        labelHalfW: halfW,
        sourceHandle,
        branchNode: isBranchNodeType(sourceType),
      }
    : undefined

  const placedOnSegment = tryLabelOnSegment({
    a,
    b,
    segmentIndex,
    ts,
    sides,
    gap: BRANCH_LABEL_GAP,
    halfW,
    minContentX,
    placed,
    excludeIds,
    pathSegments,
    existingLabelRects,
    nodeTypes,
    sourceDeparture: branchSourceDeparture,
  })
  if (placedOnSegment) return placedOnSegment

  const t0 = ts[0] ?? 0.12
  const anchor = pointOnSegment(a, b, t0)
  const box = labelBounds(anchor, halfW, 'below', BRANCH_LABEL_GAP)
  return { point: labelRectCenter(box), hidden: false, labelRect: box }
}

/** 같은 행 N 반려 가로 구간 — 선 바로 아래 프레임 박스 중심 */
export function resolveDecisionUnderpassLabelPlacement(
  points: Point[],
  labelText?: string,
): { point: Point; hidden: boolean; labelRect: LabelRect } | null {
  if (points.length < 2) return null

  let best: { midX: number; y: number; len: number } | null = null
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!
    const b = points[i + 1]!
    if (Math.abs(a.y - b.y) > 1) continue
    const len = Math.abs(a.x - b.x)
    if (len < 24) continue
    const y = a.y
    const midX = (a.x + b.x) / 2
    if (!best || y > best.y || (Math.abs(y - best.y) < 1 && len > best.len)) {
      best = { midX, y, len }
    }
  }

  if (!best) return null

  const halfW = estimateLabelHalfWidth(labelText)
  const anchor = { x: best.midX, y: best.y }
  const box = labelBounds(anchor, halfW, 'below', BRANCH_LABEL_GAP)
  return { point: labelRectCenter(box), hidden: false, labelRect: box }
}

function preferredSidesForAnchor(
  anchor: LabelAnchor,
  preferFirstSegment: boolean,
): LabelSide[] {
  if (anchor.orientation === 'horizontal') {
    return preferFirstSegment ? ['above', 'below', 'right', 'left'] : ['above', 'below', 'left', 'right']
  }
  return preferFirstSegment ? ['right', 'left', 'above', 'below'] : ['right', 'left', 'below', 'above']
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
  /** 출발·도착 segment 우선 (source 근처 → target 근처) */
  preferEndpointSegments?: boolean
  labelText?: string
  existingLabelRects?: LabelRect[]
  nodeTypes?: Map<string, string>
  sourcePlaced?: PlacedNode
  sourceType?: string
  sourceHandle?: EdgeHandleId
  /** decision/condition — 가능한 한 겹침 없이, 없으면 숨김 */
  alwaysVisible?: boolean
}): { point: Point; hidden: boolean; labelRect?: LabelRect } {
  const {
    points,
    minContentX,
    placed,
    excludeIds,
    ownSegments = [],
    preferFirstSegment = false,
    preferEndpointSegments = true,
    labelText = '',
    existingLabelRects = [],
    nodeTypes,
    sourcePlaced,
    sourceType,
    sourceHandle,
    alwaysVisible = false,
  } = options

  const halfW = estimateLabelHalfWidth(labelText)
  const minDepartureDist =
    REGULAR_MIN_DEPARTURE_DIST + Math.min(16, Math.max(0, halfW - 22) * 0.2)
  const anchors = listSegmentAnchors(
    points,
    minContentX,
    preferFirstSegment,
    preferEndpointSegments,
  )

  if (anchors.length === 0) {
    const fallback = labelPointFromOrthogonalPath(points, minContentX, preferFirstSegment, labelText)
    return { point: fallback, hidden: !alwaysVisible }
  }

  const pathSegmentsForCheck = ownSegments.length > 0 ? ownSegments : points.slice(0, -1).map((a, i) => ({
    x1: a.x,
    y1: a.y,
    x2: points[i + 1]!.x,
    y2: points[i + 1]!.y,
  }))

  if (preferFirstSegment && pathSegmentsForCheck[0]) {
    const seg = pathSegmentsForCheck[0]!
    const a = { x: seg.x1, y: seg.y1 }
    const b = { x: seg.x2, y: seg.y2 }
    const segLen = segmentLength(a, b)
    if (segLen >= 8 && (isHorizontalSegment(a, b) || isVerticalSegment(a, b))) {
      const orientation: LabelSegmentOrientation = isHorizontalSegment(a, b) ? 'horizontal' : 'vertical'
      const handle = sourceHandle ?? inferHandleFromPathSegment(a, b)
      const departure = tryLabelOnSegment({
        a,
        b,
        segmentIndex: 0,
        ts: departureTsFromMinDistance(segLen, minDepartureDist, halfW > 28),
        sides: branchPreferredSides(handle, orientation, 'departure'),
        gap: LABEL_GAP,
        halfW,
        minContentX,
        placed,
        excludeIds,
        pathSegments: pathSegmentsForCheck,
        existingLabelRects,
        nodeTypes,
        sourceDeparture: sourcePlaced
          ? { source: sourcePlaced, sourceType, labelHalfW: halfW, sourceHandle: handle }
          : undefined,
      })
      if (departure) return departure
    }
  }

  for (const anchor of anchors) {
    const onFirstSegment = anchor.segmentIndex === 0
    const sides = preferredSidesForAnchor(anchor, preferFirstSegment && onFirstSegment)
    const allSides: LabelSide[] = ['above', 'below', 'left', 'right']
    const sideOrder = [...sides, ...allSides.filter((s) => !sides.includes(s))]

    for (const side of sideOrder) {
      for (const sideGap of LABEL_GAPS) {
        const box = labelBounds(anchor.mid, halfW, side, sideGap)
        if (
          isLabelClear(
            box,
            placed,
            excludeIds,
            pathSegmentsForCheck,
            anchor.segmentIndex,
            existingLabelRects,
            nodeTypes,
            onFirstSegment && sourcePlaced
              ? {
                  source: sourcePlaced,
                  sourceType,
                  labelHalfW: halfW,
                  sourceHandle,
                  segmentOrientation: anchor.orientation,
                }
              : undefined,
          )
        ) {
          return { point: labelRectCenter(box), hidden: false, labelRect: box }
        }
      }
    }
  }

  const fallbackAnchor = anchors[0]!
  const fallbackSide: LabelSide = fallbackAnchor.orientation === 'horizontal' ? 'above' : 'right'
  const fallbackBox = labelBounds(fallbackAnchor.mid, halfW, fallbackSide, LABEL_GAP)

  return {
    point: labelRectCenter(fallbackBox),
    hidden: !alwaysVisible,
    labelRect: alwaysVisible ? fallbackBox : undefined,
  }
}

export function labelRectFromPlacement(point: Point, labelText?: string, side: LabelSide = 'above'): LabelRect {
  return labelBounds(point, estimateLabelHalfWidth(labelText), side)
}

/** 가로 구간 → 위, 세로 구간 → 오른쪽 (선 바로 옆) */
export function labelPointFromAnchor(anchor: LabelAnchor): Point {
  const halfW = 22
  const side: LabelSide = anchor.orientation === 'horizontal' ? 'above' : 'right'
  const box = labelBounds(anchor.mid, halfW, side, LABEL_GAP)
  return labelRectCenter(box)
}

export function findLabelAnchor(
  points: Point[],
  minContentX: number,
  preferFirstSegment = false,
): LabelAnchor | null {
  return listSegmentAnchors(points, minContentX, preferFirstSegment)[0] ?? null
}

export function labelPointFromOrthogonalPath(
  points: Point[],
  minContentX: number,
  preferFirstSegment = false,
  labelText?: string,
): Point {
  const anchor = findLabelAnchor(points, minContentX, preferFirstSegment)
  if (anchor) {
    const halfW = estimateLabelHalfWidth(labelText)
    const point = labelPointFromAnchor(anchor)
    const box = labelBounds(point, halfW, anchor.orientation === 'horizontal' ? 'above' : 'right')
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
  }

  const mid = points[Math.floor(points.length / 2)] ?? points[0]!
  const box = labelBounds(
    { x: Math.max(mid.x, minContentX), y: mid.y },
    estimateLabelHalfWidth(labelText),
    'above',
    LABEL_GAP,
  )
  return labelRectCenter(box)
}
