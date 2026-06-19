/**
 * Swimlane Header / Body Grid 공통 좌표계.
 * Header(HTML grid)와 Body(React Flow canvas)는 이 config만 사용한다.
 */

export const SWIMLANE_LANE_COUNT = 5

export type SwimlaneGridConfig = {
  leftLabelWidth: number
  laneWidth: number
  laneGap: number
  laneCount: number
  canvasPaddingX: number
  gridLeftOffset: number
  laneHeaderHeight: number
  returnRouteColumnWidth: number
}

/** @deprecated 명시적 alias — Overview */
export const LEFT_LABEL_WIDTH = 96
export const LANE_WIDTH = 360
export const LANE_GAP = 0
export const LANE_COUNT = SWIMLANE_LANE_COUNT
export const CANVAS_PADDING_X = 0
export const GRID_LEFT_OFFSET = 0

export const OVERVIEW_SWIMLANE_GRID: SwimlaneGridConfig = {
  leftLabelWidth: LEFT_LABEL_WIDTH,
  laneWidth: LANE_WIDTH,
  laneGap: LANE_GAP,
  laneCount: LANE_COUNT,
  canvasPaddingX: CANVAS_PADDING_X,
  gridLeftOffset: GRID_LEFT_OFFSET,
  laneHeaderHeight: 52,
  returnRouteColumnWidth: 16,
}

/** Detail — 좌측 Zone/Phase 컬럼 없음 */
export const DETAIL_SWIMLANE_GRID: SwimlaneGridConfig = {
  ...OVERVIEW_SWIMLANE_GRID,
  leftLabelWidth: 0,
}

export function metricsToSwimlaneGrid(metrics: {
  zoneLabelColumnWidth: number
  cellWidth: number
  laneHeaderHeight: number
  returnRouteColumnWidth: number
  laneCount?: number
}): SwimlaneGridConfig {
  return {
    leftLabelWidth: metrics.zoneLabelColumnWidth,
    laneWidth: metrics.cellWidth,
    laneGap: LANE_GAP,
    laneCount: metrics.laneCount ?? LANE_COUNT,
    canvasPaddingX: CANVAS_PADDING_X,
    gridLeftOffset: GRID_LEFT_OFFSET,
    laneHeaderHeight: metrics.laneHeaderHeight,
    returnRouteColumnWidth: metrics.returnRouteColumnWidth,
  }
}

export function getSwimlaneGridConfig(hideZoneColumn: boolean): SwimlaneGridConfig {
  return hideZoneColumn ? DETAIL_SWIMLANE_GRID : OVERVIEW_SWIMLANE_GRID
}

/** lane index 0-based */
export function laneStartX(laneIndex: number, config: SwimlaneGridConfig = OVERVIEW_SWIMLANE_GRID): number {
  const stride = config.laneWidth + config.laneGap
  return (
    config.canvasPaddingX +
    config.gridLeftOffset +
    config.leftLabelWidth +
    laneIndex * stride
  )
}

/** process.lanes `order` — 1-based */
export function laneOrderToStartX(
  laneOrder: number,
  config: SwimlaneGridConfig = OVERVIEW_SWIMLANE_GRID,
): number {
  return laneStartX(laneOrder - 1, config)
}

export function gridContentWidth(config: SwimlaneGridConfig = OVERVIEW_SWIMLANE_GRID): number {
  const lanesWidth =
    config.laneCount * config.laneWidth + Math.max(0, config.laneCount - 1) * config.laneGap
  return (
    config.canvasPaddingX +
    config.gridLeftOffset +
    config.leftLabelWidth +
    lanesWidth +
    config.returnRouteColumnWidth
  )
}

/** Header / Body 동일 grid-template-columns */
export function swimlaneGridTemplateColumns(config: SwimlaneGridConfig): string {
  if (config.leftLabelWidth > 0) {
    return `${config.leftLabelWidth}px repeat(${config.laneCount}, ${config.laneWidth}px)`
  }
  return `repeat(${config.laneCount}, ${config.laneWidth}px)`
}

export function scaledGridContentWidth(
  config: SwimlaneGridConfig,
  scale: number,
  layoutWidth?: number,
): number {
  const base = layoutWidth ?? gridContentWidth(config)
  return base * scale
}

export function scaledSwimlaneGridTemplateColumns(
  config: SwimlaneGridConfig,
  scale: number,
): string {
  const left = config.leftLabelWidth * scale
  const lane = config.laneWidth * scale
  if (config.leftLabelWidth > 0) {
    return `${left}px repeat(${config.laneCount}, ${lane}px)`
  }
  return `repeat(${config.laneCount}, ${lane}px)`
}
