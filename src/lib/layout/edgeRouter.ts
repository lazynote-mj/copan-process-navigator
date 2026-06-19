import type { ElkEdgeSection } from './elkEdgePath'
import type { LaneBand, PlacedNode } from './laneLayout'
import { contentLeftX, LAYOUT } from './layoutConfig'
import { COLUMN_WIDTH } from './gridLayout'
import type { Process } from '../../types/process'
import { resolveNodeLocalOrder } from './localOrder'
import { labelPointFromOrthogonalPath } from './edgeLabelPlacement'

type Point = { x: number; y: number }

type Rect = {
  id: string
  x: number
  y: number
  width: number
  height: number
}

export type PathBounds = {
  minX: number
  maxX: number
  minY: number
  maxY: number
  points: Point[]
}

export type RoutedPath = {
  path: string
  labelPoint: Point
}

const SEGMENT_CLEARANCE = LAYOUT.edgeNode

export function parsePathPoints(path: string): Point[] {
  const points: Point[] = []
  const tokens = path.trim().split(/\s+/)
  let i = 0

  while (i < tokens.length) {
    const cmd = tokens[i]
    if (cmd === 'M' || cmd === 'L') {
      const x = Number.parseFloat(tokens[i + 1])
      const y = Number.parseFloat(tokens[i + 2])
      if (!Number.isNaN(x) && !Number.isNaN(y)) {
        points.push({ x, y })
      }
      i += 3
    } else {
      i += 1
    }
  }

  return points
}

export function getPathBounds(path: string): PathBounds {
  const points = parsePathPoints(path)
  if (points.length === 0) {
    return { minX: 0, maxX: 0, minY: 0, maxY: 0, points: [] }
  }

  return {
    minX: Math.min(...points.map((p) => p.x)),
    maxX: Math.max(...points.map((p) => p.x)),
    minY: Math.min(...points.map((p) => p.y)),
    maxY: Math.max(...points.map((p) => p.y)),
    points,
  }
}

export function enforceMinXContentPath(path: string, minX: number): string {
  const points = parsePathPoints(path)
  if (points.length === 0) return path

  const clamped = points.map((p) => ({
    x: Math.max(p.x, minX),
    y: p.y,
  }))

  return clamped.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
}

function toPath(points: Point[]): string {
  const simplified: Point[] = []
  for (const point of points) {
    const prev = simplified[simplified.length - 1]
    if (!prev || prev.x !== point.x || prev.y !== point.y) {
      simplified.push(point)
    }
  }
  return simplified.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
}

function expandRect(rect: Rect, padding: number): Rect {
  return {
    ...rect,
    x: rect.x - padding,
    y: rect.y - padding,
    width: rect.width + padding * 2,
    height: rect.height + padding * 2,
  }
}

function toRects(nodes: PlacedNode[]): Rect[] {
  return nodes.map((node) => ({
    id: node.id,
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
  }))
}

function segmentIntersectsRect(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  rect: Rect,
): boolean {
  const minX = Math.min(x1, x2)
  const maxX = Math.max(x1, x2)
  const minY = Math.min(y1, y2)
  const maxY = Math.max(y1, y2)

  if (Math.abs(y1 - y2) < 0.5) {
    const y = y1
    return y >= rect.y && y <= rect.y + rect.height && maxX >= rect.x && minX <= rect.x + rect.width
  }

  if (Math.abs(x1 - x2) < 0.5) {
    const x = x1
    return x >= rect.x && x <= rect.x + rect.width && maxY >= rect.y && minY <= rect.y + rect.height
  }

  return false
}

function segmentHitsObstacles(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  obstacles: Rect[],
  excludeIds: Set<string>,
): boolean {
  for (const obstacle of obstacles) {
    if (excludeIds.has(obstacle.id)) continue
    if (segmentIntersectsRect(x1, y1, x2, y2, expandRect(obstacle, SEGMENT_CLEARANCE))) {
      return true
    }
  }
  return false
}

function pathHitsObstacles(
  points: Point[],
  obstacles: Rect[],
  excludeIds: Set<string>,
): boolean {
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]
    const b = points[i + 1]
    if (segmentHitsObstacles(a.x, a.y, b.x, b.y, obstacles, excludeIds)) {
      return true
    }
  }
  return false
}

function findClearY(
  preferredY: number,
  x1: number,
  x2: number,
  obstacles: Rect[],
  excludeIds: Set<string>,
): number {
  const minX = Math.min(x1, x2)
  const maxX = Math.max(x1, x2)

  for (let step = 0; step <= 8; step++) {
    for (const delta of step === 0 ? [0] : [step * 28, -step * 28]) {
      const y = preferredY + delta
      if (!segmentHitsObstacles(minX, y, maxX, y, obstacles, excludeIds)) {
        return y
      }
    }
  }

  return preferredY
}

function finalizeRoute(points: Point[], minContentX: number): RoutedPath {
  const path = enforceMinXContentPath(toPath(points), minContentX)
  const pathPoints = parsePathPoints(path)
  return {
    path,
    labelPoint: labelPointFromOrthogonalPath(pathPoints, minContentX),
  }
}

export function translateSections(
  sections: ElkEdgeSection[],
  dx: number,
  dy: number,
): ElkEdgeSection[] {
  const map = (p: Point) => ({ x: p.x + dx, y: p.y + dy })
  return sections.map((section) => ({
    startPoint: map(section.startPoint),
    endPoint: map(section.endPoint),
    bendPoints: section.bendPoints?.map(map),
  }))
}

/** normal-forward — 최단 직각 경로 */
export function buildDirectForwardPath(
  source: PlacedNode,
  target: PlacedNode,
  parallelIndex: number,
  allNodes: PlacedNode[],
  minContentX: number,
): RoutedPath {
  const obstacles = toRects(allNodes)
  const excludeIds = new Set([source.id, target.id])
  const laneOffset = parallelIndex * 10

  const sx = Math.max(source.x + source.width, minContentX)
  const sy = source.y + source.height / 2 + laneOffset
  const tx = Math.max(target.x, minContentX)
  const ty = target.y + target.height / 2 + laneOffset
  const stub = 16

  let points: Point[]

  if (Math.abs(sy - ty) < 10 && tx >= sx - 8) {
    points = [
      { x: sx, y: sy },
      { x: tx, y: ty },
    ]
  } else if (tx >= sx - 8) {
    const midX = sx + Math.max(stub, Math.min((tx - sx) * 0.55, 140))
    points = [
      { x: sx, y: sy },
      { x: midX, y: sy },
      { x: midX, y: ty },
      { x: tx, y: ty },
    ]
  } else {
    const dropX = sx + stub
    points = [
      { x: sx, y: sy },
      { x: dropX, y: sy },
      { x: dropX, y: ty },
      { x: tx, y: ty },
    ]
  }

  if (pathHitsObstacles(points, obstacles, excludeIds)) {
    const altMidX = sx + stub + Math.abs(parallelIndex) * LAYOUT.edgeEdge
    points = [
      { x: sx, y: sy },
      { x: altMidX, y: sy },
      { x: altMidX, y: ty },
      { x: tx, y: ty },
    ]
  }

  return finalizeRoute(points, minContentX)
}

/** cross-lane-step — source bottom → target top, 필요 시 L자 (x 차이 큼) */
export function buildCrossLaneStepPath(
  source: PlacedNode,
  target: PlacedNode,
  parallelIndex: number,
  minContentX: number,
): RoutedPath {
  const offsetX = parallelIndex * 8
  const sx = Math.max(nodeCenterX(source) + offsetX, minContentX)
  const sy = source.y + source.height
  const tx = Math.max(nodeCenterX(target) + offsetX, minContentX)
  const ty = target.y

  let points: Point[]

  if (Math.abs(sx - tx) < 10) {
    points = [
      { x: sx, y: sy },
      { x: tx, y: ty },
    ]
  } else {
    const midY = sy + Math.max(16, (ty - sy) * 0.45)
    points = [
      { x: sx, y: sy },
      { x: sx, y: midY },
      { x: tx, y: midY },
      { x: tx, y: ty },
    ]
  }

  return finalizeRoute(points, minContentX)
}

/** zone gap — source bottom → gap corridor → target top (cross-zone, 짧은 수평) */
export function buildZoneGapDownPath(
  source: PlacedNode,
  target: PlacedNode,
  corridorY: number,
  parallelIndex: number,
  minContentX: number,
): RoutedPath {
  const offsetX = parallelIndex * 8
  const sx = Math.max(nodeCenterX(source) + offsetX, minContentX)
  const sy = source.y + source.height
  const tx = Math.max(nodeCenterX(target) + offsetX, minContentX)
  const ty = target.y
  const routeY = corridorY + parallelIndex * 4

  const points: Point[] =
    Math.abs(sx - tx) < 10
      ? [
          { x: sx, y: sy },
          { x: sx, y: routeY },
          { x: tx, y: routeY },
          { x: tx, y: ty },
        ]
      : [
          { x: sx, y: sy },
          { x: sx, y: routeY },
          { x: tx, y: routeY },
          { x: tx, y: ty },
        ]

  return finalizeRoute(points, minContentX)
}

/** zone gap — source top → gap corridor → target bottom (역방향 cross-zone) */
export function buildZoneGapUpPath(
  source: PlacedNode,
  target: PlacedNode,
  corridorY: number,
  parallelIndex: number,
  minContentX: number,
): RoutedPath {
  const offsetX = parallelIndex * 8
  const sx = Math.max(nodeCenterX(source) + offsetX, minContentX)
  const sy = source.y
  const tx = Math.max(nodeCenterX(target) + offsetX, minContentX)
  const ty = target.y + target.height
  const routeY = corridorY + parallelIndex * 4

  const points: Point[] = [
    { x: sx, y: sy },
    { x: sx, y: routeY },
    { x: tx, y: routeY },
    { x: tx, y: ty },
  ]

  return finalizeRoute(points, minContentX)
}

/** vertical-up — source top → target bottom */
export function buildVerticalUpPath(
  source: PlacedNode,
  target: PlacedNode,
  parallelIndex: number,
  minContentX: number,
): RoutedPath {
  const offsetX = parallelIndex * 8
  const sx = Math.max(nodeCenterX(source) + offsetX, minContentX)
  const sy = source.y
  const tx = Math.max(nodeCenterX(target) + offsetX, minContentX)
  const ty = target.y + target.height

  const points: Point[] =
    Math.abs(sx - tx) < 10
      ? [
          { x: sx, y: sy },
          { x: tx, y: ty },
        ]
      : [
          { x: sx, y: sy },
          { x: sx, y: sy - 16 },
          { x: tx, y: sy - 16 },
          { x: tx, y: ty },
        ]

  return finalizeRoute(points, minContentX)
}

/** corner-down — 다음 lane + 다음 phase, 짧은 L자 */
export function buildCornerDownPath(
  source: PlacedNode,
  target: PlacedNode,
  parallelIndex: number,
  minContentX: number,
): RoutedPath {
  const offsetY = parallelIndex * 8
  const sx = Math.max(source.x + source.width, minContentX)
  const sy = source.y + source.height / 2 + offsetY
  const tx = Math.max(nodeCenterX(target) + parallelIndex * 6, minContentX)
  const ty = target.y
  const stub = 28
  const midX = Math.min(sx + stub, tx)

  const points: Point[] =
    Math.abs(midX - tx) < 8
      ? [
          { x: sx, y: sy },
          { x: midX, y: sy },
          { x: midX, y: ty },
        ]
      : [
          { x: sx, y: sy },
          { x: midX, y: sy },
          { x: midX, y: ty },
          { x: tx, y: ty },
        ]

  return finalizeRoute(points, minContentX)
}

/** direct-cross-lane — source bottom → target top, 최단 직각 */
export function buildDirectCrossLanePath(
  source: PlacedNode,
  target: PlacedNode,
  parallelIndex: number,
  allNodes: PlacedNode[],
  minContentX: number,
): RoutedPath {
  const obstacles = toRects(allNodes)
  const excludeIds = new Set([source.id, target.id])
  const offsetX = parallelIndex * 10

  const sx = Math.max(nodeCenterX(source) + offsetX, minContentX)
  const sy = source.y + source.height
  const tx = Math.max(nodeCenterX(target) + offsetX, minContentX)
  const ty = target.y
  const stub = 12

  let points: Point[]

  if (Math.abs(sx - tx) < 8) {
    points = [
      { x: sx, y: sy },
      { x: tx, y: ty },
    ]
  } else {
    const midY = sy + Math.max(stub, (ty - sy) * 0.45)
    points = [
      { x: sx, y: sy },
      { x: sx, y: midY },
      { x: tx, y: midY },
      { x: tx, y: ty },
    ]
  }

  if (pathHitsObstacles(points, obstacles, excludeIds)) {
    const detourY = midYBetween(source, target, obstacles, excludeIds, sy, ty)
    points = [
      { x: sx, y: sy },
      { x: sx, y: detourY },
      { x: tx, y: detourY },
      { x: tx, y: ty },
    ]
  }

  return finalizeRoute(points, minContentX)
}

function nodeCenterX(node: PlacedNode): number {
  return node.x + node.width / 2
}

function midYBetween(
  source: PlacedNode,
  target: PlacedNode,
  obstacles: Rect[],
  excludeIds: Set<string>,
  sy: number,
  ty: number,
): number {
  const preferred = sy + (ty - sy) * 0.5
  const minX = Math.min(source.x, target.x)
  const maxX = Math.max(source.x + source.width, target.x + target.width)
  return findClearY(preferred, minX, maxX, obstacles, excludeIds)
}

/** long cross-lane — source.right → routingColumn → target.left (node 이동 없음) */
export function findRoutingColumnX(
  source: PlacedNode,
  target: PlacedNode,
  process: Process,
  _placed: PlacedNode[],
  _minContentX: number,
): number {
  const sourceLocal = resolveNodeLocalOrder(
    process.nodes.find((n) => n.id === source.id)!,
    process,
  )
  const targetLocal = resolveNodeLocalOrder(
    process.nodes.find((n) => n.id === target.id)!,
    process,
  )

  const occupied = new Set<number>()
  for (const node of process.nodes) {
    occupied.add(resolveNodeLocalOrder(node, process))
  }

  const minCol = Math.min(sourceLocal, targetLocal)
  const maxCol = Math.max(sourceLocal, targetLocal)

  /** 1) source~target 사이 빈 column */
  for (let col = minCol + 1; col < maxCol; col++) {
    if (!occupied.has(col)) {
      return contentLeftX() + (col - 0.5) * COLUMN_WIDTH
    }
  }

  /** 2) target 우측 빈 column */
  for (let col = maxCol + 1; col <= maxCol + 4; col++) {
    if (!occupied.has(col)) {
      return contentLeftX() + (col - 0.5) * COLUMN_WIDTH
    }
  }

  /** 3) canvas 확장 — lane 최대 column 바깥 */
  const globalMax = Math.max(...process.nodes.map((n) => resolveNodeLocalOrder(n, process)))
  return contentLeftX() + (globalMax + 1.5) * COLUMN_WIDTH
}

export function buildLongCrossLanePath(
  source: PlacedNode,
  target: PlacedNode,
  process: Process,
  placed: PlacedNode[],
  parallelIndex: number,
  minContentX: number,
): RoutedPath {
  const routingX = findRoutingColumnX(source, target, process, placed, minContentX)
  const laneOffset = parallelIndex * 10

  const sx = Math.max(source.x + source.width, minContentX)
  const sy = source.y + source.height / 2 + laneOffset
  const tx = Math.max(target.x, minContentX)
  const ty = target.y + target.height / 2 + laneOffset

  const routeX = Math.max(routingX + parallelIndex * 8, sx + 12)

  const points: Point[] = [
    { x: sx, y: sy },
    { x: routeX, y: sy },
    { x: routeX, y: ty },
    { x: tx, y: ty },
  ]

  return finalizeRoute(points, minContentX)
}

/** cross-lane — 비인접 lane 또는 X 거리가 큰 경우 */
export function buildCrossLanePath(
  source: PlacedNode,
  target: PlacedNode,
  parallelIndex: number,
  allNodes: PlacedNode[],
  minContentX: number,
): RoutedPath {
  const obstacles = toRects(allNodes)
  const excludeIds = new Set([source.id, target.id])

  const sx = Math.max(source.x + source.width, minContentX)
  const sy = source.y + source.height / 2
  const tx = Math.max(target.x, minContentX)
  const ty = target.y + target.height / 2
  const stub = 24
  const laneOffset = parallelIndex * 12

  const routeX = Math.max(
    minContentX,
    Math.min(
      sx + stub + Math.abs(parallelIndex) * LAYOUT.edgeEdge,
      Math.max(sx, tx) + 80,
    ),
  )

  let routeY1 = findClearY(sy + laneOffset, sx, routeX, obstacles, excludeIds)
  let routeY2 = findClearY(ty + laneOffset, routeX, tx - stub, obstacles, excludeIds)

  let points: Point[]

  if (Math.abs(routeY1 - routeY2) < 8 && tx >= sx - 8) {
    points = [
      { x: sx, y: routeY1 },
      { x: tx, y: routeY2 },
    ]
  } else {
    const preEntryX = Math.max(tx - stub, minContentX)
    routeY2 = findClearY(ty, routeX, preEntryX, obstacles, excludeIds)
    points = [
      { x: sx, y: routeY1 },
      { x: routeX, y: routeY1 },
      { x: routeX, y: routeY2 },
      { x: preEntryX, y: routeY2 },
      { x: preEntryX, y: ty },
      { x: tx, y: ty },
    ]
  }

  return finalizeRoute(points, minContentX)
}

/** return/back — 하단 routing area 사용 */
export function buildReturnEdgePath(
  source: PlacedNode,
  target: PlacedNode,
  bands: LaneBand[],
  parallelIndex: number,
  minContentX: number,
  allNodes: PlacedNode[],
): RoutedPath {
  const obstacles = toRects(allNodes)
  const excludeIds = new Set([source.id, target.id])

  const sourceBand = bands.find((b) => b.laneId === source.laneId)
  const targetBand = bands.find((b) => b.laneId === target.laneId)

  const sx = Math.max(source.x + source.width, minContentX)
  const sy = source.y + source.height / 2
  const tx = Math.max(target.x, minContentX)
  const ty = target.y + target.height / 2
  const stub = 28

  const baseBottom = Math.max(
    sourceBand?.contentBottom ?? source.y + source.height,
    targetBand?.contentBottom ?? target.y + target.height,
  )
  let bottomY = baseBottom + 28 + Math.abs(parallelIndex) * 16

  bottomY = findClearY(
    bottomY,
    Math.min(sx, tx) - stub,
    Math.max(sx, tx) + stub * 2,
    obstacles,
    excludeIds,
  )

  const points: Point[] = [
    { x: sx, y: sy },
    { x: sx + stub, y: sy },
    { x: sx + stub, y: bottomY },
    { x: tx - stub, y: bottomY },
    { x: tx - stub, y: ty },
    { x: tx, y: ty },
  ]

  return finalizeRoute(points, minContentX)
}

export function adjustLabelPointForNodes(
  point: Point,
  nodes: PlacedNode[],
  excludeIds: Set<string>,
  minContentX: number,
): Point {
  const overlaps = (p: Point) =>
    nodes.some((node) => {
      if (excludeIds.has(node.id)) return false
      return (
        p.x >= node.x - 8 &&
        p.x <= node.x + node.width + 8 &&
        p.y >= node.y - 8 &&
        p.y <= node.y + node.height + 8
      )
    })

  const base = { x: Math.max(point.x, minContentX), y: point.y }
  if (!overlaps(base)) return base

  for (const delta of [18, -18, 32, -32, 48, -48]) {
    const candidate = { x: base.x, y: base.y + delta }
    if (!overlaps(candidate)) return candidate
  }

  return base
}

export function assertPathRespectsContentLeft(path: string, minX: number = contentLeftX()): void {
  const bounds = getPathBounds(path)
  if (bounds.minX < minX - 0.5) {
    console.warn(
      `[ProcessNavigator] edge path가 lane header/contentLeft(${minX})를 침범합니다. minX=${bounds.minX}`,
    )
  }
}
