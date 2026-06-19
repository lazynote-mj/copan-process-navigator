import type { NodeType } from '../../types/nodeTypes'
import { CONNECTOR_NODE_SIZE } from './connectorLayout'
import { getDecisionNodeSize } from './decisionNodeLayout'
import { getInterfaceRuleOverviewSize, isInterfaceRuleNode } from './interfaceRuleLayout'
import { CELL_COLUMN_GAP_MIN, type OverviewGridMetrics } from './overviewGridMetrics'
import { OVERVIEW_MAX_CELL_COLUMNS } from './overviewCellPlacement'

export type CellColumnLayout = {
  columnCenters: number[]
  /** 이 cell의 일반 process 노드 배치 폭 */
  processNodeWidth: number
  /** 열 사이 연결선 전용 간격 */
  columnGap: number
  columnCount: number
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

  if (effectiveColumns <= 1) {
    return {
      columnCenters: [cellLeft + cellWidth / 2],
      processNodeWidth: metrics.nodeWidth,
      columnGap: 0,
      columnCount: 1,
    }
  }

  const contentLeft = cellLeft + metrics.cellPaddingX
  const contentWidth = cellWidth - metrics.cellPaddingX * 2
  const columnGap = Math.max(CELL_COLUMN_GAP_MIN, metrics.nodeGapX)
  const processNodeWidth = metrics.nodeWidth

  return {
    columnCenters: buildColumnCenters(contentLeft, contentWidth, 2, processNodeWidth, columnGap),
    processNodeWidth,
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
  name = '',
): { width: number; height: number } {
  if (type === 'decision') {
    return getDecisionNodeSize(name)
  }
  if (isInterfaceRuleNode(type)) {
    return getInterfaceRuleOverviewSize()
  }
  if (type === 'connector' || type === 'merge') {
    return { ...CONNECTOR_NODE_SIZE }
  }
  return { width: cellLayout.processNodeWidth, height: metrics.nodeHeight }
}
