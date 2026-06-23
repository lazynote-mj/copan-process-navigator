import type { NodeType } from '../../types/nodeTypes'
import { CONNECTOR_NODE_SIZE } from './connectorLayout'
import { getInterfaceRuleOverviewSize, isInterfaceRuleNode } from './interfaceRuleLayout'
import { CELL_COLUMN_GAP_MIN, type OverviewGridMetrics } from './overviewGridMetrics'
import { OVERVIEW_MAX_CELL_COLUMNS } from './overviewCellPlacement'

export type CellColumnLayout = {
  columnCenters: number[]
  /** 이 cell의 일반 process 노드 배치 폭 */
  processNodeWidth: number
  /** 판단/분기 노드 배치 폭 — process와 동일하게 lane 폭에 맞춤 */
  branchNodeWidth: number
  /** 열 사이 연결선 전용 간격 */
  columnGap: number
  columnCount: number
}

/** cell padding 안에서 열 수·gap에 맞는 노드 폭 상한 (lane 폭은 변경하지 않음) */
export function maxProcessNodeWidthInCell(
  contentWidth: number,
  columnCount: number,
  columnGap: number,
  metricsNodeWidth: number,
  innerMargin = 16,
): number {
  const effectiveColumns = Math.max(1, columnCount)
  const gapTotal = columnGap * (effectiveColumns - 1)
  const perColumnCap = Math.floor((contentWidth - gapTotal) / effectiveColumns)
  const singleColumnCap = Math.max(0, contentWidth - innerMargin)
  const cap = effectiveColumns <= 1 ? singleColumnCap : perColumnCap
  return Math.min(metricsNodeWidth, Math.max(0, cap))
}

function buildColumnCenters(
  contentLeft: number,
  contentWidth: number,
  columnCount: number,
  processNodeWidth: number,
  columnGap: number,
): number[] {
  const blockWidth = processNodeWidth * columnCount + columnGap * (columnCount - 1)
  const blockStart = contentLeft + (contentWidth - blockWidth) / 2

  return Array.from({ length: columnCount }, (_, col) =>
    blockStart + processNodeWidth / 2 + col * (processNodeWidth + columnGap),
  )
}

/** Cell 내부 열 배치 — swimlane 폭은 변경하지 않음 (최대 2열) */
export function resolveCellColumnLayout(
  cellLeft: number,
  cellWidth: number,
  columnCount: number,
  metrics: OverviewGridMetrics,
): CellColumnLayout {
  const effectiveColumns = Math.min(Math.max(columnCount, 1), OVERVIEW_MAX_CELL_COLUMNS)
  const contentLeft = cellLeft + metrics.cellPaddingX
  const contentWidth = cellWidth - metrics.cellPaddingX * 2
  const columnGap =
    effectiveColumns <= 1 ? 0 : Math.max(CELL_COLUMN_GAP_MIN, metrics.nodeGapX)
  const processNodeWidth = maxProcessNodeWidthInCell(
    contentWidth,
    effectiveColumns,
    columnGap,
    metrics.nodeWidth,
  )
  const branchNodeWidth = processNodeWidth

  if (effectiveColumns <= 1) {
    return {
      columnCenters: [cellLeft + cellWidth / 2],
      processNodeWidth,
      branchNodeWidth,
      columnGap: 0,
      columnCount: 1,
    }
  }

  return {
    columnCenters: buildColumnCenters(contentLeft, contentWidth, 2, processNodeWidth, columnGap),
    processNodeWidth,
    branchNodeWidth,
    columnGap,
    columnCount: 2,
  }
}

export function usesCellProcessNodeWidth(type: NodeType): boolean {
  if (type === 'decision') return false
  if (isInterfaceRuleNode(type)) return false
  if (type === 'connector' || type === 'merge') return false
  return true
}

export function getCellPlacementSize(
  type: NodeType,
  metrics: OverviewGridMetrics,
  cellLayout: CellColumnLayout,
  _name = '',
): { width: number; height: number } {
  if (type === 'decision') {
    return {
      width: Math.min(metrics.decisionWidth, cellLayout.branchNodeWidth),
      height: metrics.decisionHeight,
    }
  }
  if (isInterfaceRuleNode(type)) {
    const size = getInterfaceRuleOverviewSize()
    return {
      width: Math.min(size.width, cellLayout.branchNodeWidth),
      height: size.height,
    }
  }
  if (type === 'connector' || type === 'merge') {
    return { ...CONNECTOR_NODE_SIZE }
  }
  return { width: cellLayout.processNodeWidth, height: metrics.nodeHeight }
}
