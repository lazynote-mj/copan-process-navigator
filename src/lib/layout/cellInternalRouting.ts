import type { Edge, EdgeHandleId, Node, Process } from '../../types/process'
import { hasUserSpecifiedHandles } from '../editor/edgeHandles'
import {
  computeCellGridLayoutFromSlots,
  getCellNodesInOrder,
  resolveCellSlotAssignments,
  resolveNodeCellOrder,
} from './overviewCellPlacement'
import { isSettlementBranchNode } from './settlementGroupLayout'

export type CellInternalHandles = {
  sourceHandle: EdgeHandleId
  targetHandle: EdgeHandleId
}

export type CellGridNodeContext = {
  node: Node
  index: number
  row: number
  col: number
  cellOrder: number
  cellSlot: number
}

export function nodesShareCell(a: Node, b: Node): boolean {
  if (!a.processZone || !b.processZone) return false
  return a.processZone === b.processZone && a.laneId === b.laneId
}

export { getCellNodesInOrder }

export function getCellGridNodeContext(node: Node, process: Process): CellGridNodeContext | null {
  if (!node.processZone) return null
  const cellNodes = getCellNodesInOrder(process, node.processZone, node.laneId)
  const index = cellNodes.findIndex((n) => n.id === node.id)
  if (index < 0) return null

  const assignments = resolveCellSlotAssignments(cellNodes)
  const assignment = assignments.get(node.id)
  if (!assignment) return null

  return {
    node,
    index,
    row: assignment.row,
    col: assignment.col,
    cellOrder: resolveNodeCellOrder(node),
    cellSlot: assignment.slot,
  }
}

/**
 * cellSlot 기준 LEFT→RIGHT 열 전환 (LEFT column → RIGHT column)
 * edge 순서는 cellOrder, handle은 실제 배치(col) 기준
 */
export function isColumnTransitionEdge(
  sourceNode: Node,
  targetNode: Node,
  process: Process,
): boolean {
  if (!nodesShareCell(sourceNode, targetNode)) return false

  const source = getCellGridNodeContext(sourceNode, process)
  const target = getCellGridNodeContext(targetNode, process)
  if (!source || !target) return false

  const layout = computeCellGridLayoutFromSlots(
    resolveCellSlotAssignments(
      getCellNodesInOrder(process, sourceNode.processZone!, sourceNode.laneId),
    ).values(),
  )
  if (layout.columnCount < 2) return false

  return target.col > source.col
}

/**
 * 같은 cell 내 edge handle 쌍 — cellSlot 배치(row/col) 기준
 */
export function resolveCellInternalEdgeHandles(
  edge: Edge,
  process: Process,
): CellInternalHandles | null {
  const sourceNode = process.nodes.find((n) => n.id === edge.source)
  const targetNode = process.nodes.find((n) => n.id === edge.target)
  if (!sourceNode || !targetNode) return null
  if (!nodesShareCell(sourceNode, targetNode)) return null
  if (hasUserSpecifiedHandles(edge)) return null

  // 예외·승인 분기 노드는 Decision branch routing에 맡김 (순차 cell 내부 규칙 제외)
  if (isSettlementBranchNode(targetNode) || targetNode.type === 'exception') {
    return null
  }

  const source = getCellGridNodeContext(sourceNode, process)
  const target = getCellGridNodeContext(targetNode, process)
  if (!source || !target) return null

  if (target.col > source.col) {
    return { sourceHandle: 'right', targetHandle: 'left' }
  }

  if (source.col === target.col) {
    if (target.row > source.row) {
      return { sourceHandle: 'bottom', targetHandle: 'top' }
    }
    if (target.row < source.row) {
      return { sourceHandle: 'top', targetHandle: 'bottom' }
    }
  }

  return null
}

export function isCellColumnTransitionFlow(
  edge: Edge,
  process: Process,
  sourceHandle?: EdgeHandleId,
  targetHandle?: EdgeHandleId,
): boolean {
  const sourceNode = process.nodes.find((n) => n.id === edge.source)
  const targetNode = process.nodes.find((n) => n.id === edge.target)
  if (!sourceNode || !targetNode) return false
  if (!isColumnTransitionEdge(sourceNode, targetNode, process)) return false
  if (sourceHandle && targetHandle) {
    return sourceHandle === 'right' && targetHandle === 'left'
  }
  return true
}
