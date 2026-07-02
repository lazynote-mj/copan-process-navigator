import type { LayoutRuleMaster } from '../../types/commonMasters'
import type { Edge, Node } from '../../types/process'
import {
  clampCellSlot,
  rowColToCellSlot,
} from '../layout/overviewCellPlacement'
import { resolveNodeCellOrder } from '../layout/overviewCellPlacement'

export type DefaultCellSlotScope = 'overview' | 'detail'

export type DefaultCellSlotOptions = {
  scope: DefaultCellSlotScope
  layoutRule: LayoutRuleMaster
  edges?: Edge[]
}

function nodeSortKey(node: Node): number {
  return (
    node.cellOrder
    ?? node.phaseOrder
    ?? node.localOrder
    ?? node.zoneOrder
    ?? resolveNodeCellOrder(node)
    ?? 0
  )
}

function getNodeCellKey(node: Node, scope: DefaultCellSlotScope): string {
  if (scope === 'overview') {
    return `${node.processZone ?? node.phaseId}::${node.laneId}`
  }
  return node.laneId
}

function isAuxiliaryDetailNode(node: Node, edges: Edge[]): boolean {
  if (node.type === 'linked-process' || node.type === 'exception') return true
  return edges.some((edge) => edge.target === node.id && edge.condition && edge.condition !== 'Y')
}

function pickColumn(node: Node, index: number, nodesInCell: Node[], options: DefaultCellSlotOptions): number {
  if (options.layoutRule.maxCellColumns <= 1) return 0
  if (options.scope === 'overview') {
    return index >= options.layoutRule.maxCellRows ? 1 : 0
  }
  if (isAuxiliaryDetailNode(node, options.edges ?? [])) return 1
  if (nodesInCell.length > options.layoutRule.maxCellRows && index >= options.layoutRule.maxCellRows) return 1
  return 0
}

export function resolveDefaultCellSlot(
  node: Node,
  allNodes: Node[],
  options: DefaultCellSlotOptions,
): number {
  if (node.cellSlot != null) {
    return clampCellSlot(node.cellSlot, options.layoutRule.maxCellRows)
  }

  const cellKey = getNodeCellKey(node, options.scope)
  const nodesInCell = allNodes
    .filter((candidate) => getNodeCellKey(candidate, options.scope) === cellKey)
    .sort((a, b) => nodeSortKey(a) - nodeSortKey(b) || a.id.localeCompare(b.id))

  const index = Math.max(0, nodesInCell.findIndex((candidate) => candidate.id === node.id))
  const col = pickColumn(node, index, nodesInCell, options)
  const row = index % options.layoutRule.maxCellRows
  return rowColToCellSlot(row, col, options.layoutRule.maxCellRows)
}

export function resolveDefaultCellSlots(
  nodes: Node[],
  options: DefaultCellSlotOptions,
): Map<string, number> {
  const slots = new Map<string, number>()
  for (const node of nodes) {
    slots.set(node.id, resolveDefaultCellSlot(node, nodes, options))
  }
  return slots
}

export function applyDefaultCellSlots(
  nodes: Node[],
  options: DefaultCellSlotOptions,
): Node[] {
  return nodes.map((node) => ({
    ...node,
    cellSlot: resolveDefaultCellSlot(node, nodes, options),
  }))
}
