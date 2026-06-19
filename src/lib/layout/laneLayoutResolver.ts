import type { Lane, Process } from '../../types/process'
import {
  CANVAS_PADDING_X,
  GRID_LEFT_OFFSET,
  LANE_GAP,
  LANE_WIDTH,
  type SwimlaneGridConfig,
} from './swimlaneGridLayout'

export function resolveLaneWidth(lane: Lane, defaultWidth = LANE_WIDTH): number {
  return lane.width ?? defaultWidth
}

export function laneColumnLeftFromProcess(
  process: Process,
  laneOrder: number,
  labelWidth: number,
  defaultLaneWidth = LANE_WIDTH,
): number {
  const sorted = [...process.lanes].sort((a, b) => a.order - b.order)
  let x = CANVAS_PADDING_X + GRID_LEFT_OFFSET + labelWidth
  for (const lane of sorted) {
    if (lane.order >= laneOrder) break
    x += resolveLaneWidth(lane, defaultLaneWidth) + LANE_GAP
  }
  return x
}

export function resolveLaneCellWidth(
  process: Process,
  laneId: string,
  defaultWidth: number,
): number {
  const lane = process.lanes.find((l) => l.id === laneId)
  return lane ? resolveLaneWidth(lane, defaultWidth) : defaultWidth
}

export function buildSwimlaneGridFromProcess(
  process: Process,
  labelWidth: number,
  defaultLaneWidth = LANE_WIDTH,
  laneHeaderHeight = 52,
  returnRouteColumnWidth = 16,
): SwimlaneGridConfig {
  const sorted = [...process.lanes].sort((a, b) => a.order - b.order)
  const maxWidth = sorted.reduce(
    (max, lane) => Math.max(max, resolveLaneWidth(lane, defaultLaneWidth)),
    defaultLaneWidth,
  )
  return {
    leftLabelWidth: labelWidth,
    laneWidth: maxWidth,
    laneGap: LANE_GAP,
    laneCount: sorted.length || 1,
    canvasPaddingX: CANVAS_PADDING_X,
    gridLeftOffset: GRID_LEFT_OFFSET,
    laneHeaderHeight,
    returnRouteColumnWidth,
  }
}

export function gridContentWidthFromProcess(
  process: Process,
  labelWidth: number,
  defaultLaneWidth = LANE_WIDTH,
): number {
  const sorted = [...process.lanes].sort((a, b) => a.order - b.order)
  const lanesWidth = sorted.reduce(
    (sum, lane, index) =>
      sum + resolveLaneWidth(lane, defaultLaneWidth) + (index < sorted.length - 1 ? LANE_GAP : 0),
    0,
  )
  return CANVAS_PADDING_X + GRID_LEFT_OFFSET + labelWidth + lanesWidth
}

export function resolvePhaseMinHeight(process: Process, nodes: import('../../types/process').Node[]): number {
  let min = 0
  for (const node of nodes) {
    const phase = process.phases.find((p) => p.id === node.phaseId)
    if (phase?.height) min = Math.max(min, phase.height)
  }
  return min
}

/** edge.priority 오름차순 (동일 시 id) */
export function sortEdgesByPriority(edges: import('../../types/process').Edge[]): import('../../types/process').Edge[] {
  return [...edges].sort(
    (a, b) => (a.priority ?? 0) - (b.priority ?? 0) || a.id.localeCompare(b.id),
  )
}
