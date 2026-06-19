import type { ConnectorSubType } from '../../types/connectorTypes'
import type { Edge, EdgeHandleId, Node, Process } from '../../types/process'
import {
  resolveEdgeSourceHandle,
  resolveEdgeTargetHandle,
  hasUserSpecifiedHandles,
} from '../editor/edgeHandles'
import type { PlacedNode } from './laneLayout'

export const CONNECTOR_NODE_SIZE = { width: 16, height: 16 } as const
export const CONNECTOR_GAP = 40

export function isConnectorNodeType(type: string | undefined): boolean {
  return type === 'connector' || type === 'merge'
}

export function isConnectorNode(node: Pick<Node, 'type'>): boolean {
  return isConnectorNodeType(node.type)
}

export function resolveConnectorSubType(node: Node): ConnectorSubType {
  if (node.connectorSubType) return node.connectorSubType
  if (node.type === 'merge') return 'merge'
  return 'split'
}

function centerX(placed: PlacedNode): number {
  return placed.x + placed.width / 2
}

function bottomY(placed: PlacedNode): number {
  return placed.y + placed.height
}

export function inferSplitOutgoingHandle(
  connector: PlacedNode,
  target: PlacedNode,
): EdgeHandleId {
  const cx = centerX(connector)
  const tx = centerX(target)
  if (tx < cx - 6) return 'left'
  if (tx > cx + 6) return 'right'
  const ty = target.y + target.height / 2
  if (ty > bottomY(connector) + 4) return 'bottom'
  return 'bottom'
}

export function inferMergeIncomingHandle(
  source: PlacedNode,
  connector: PlacedNode,
): EdgeHandleId {
  const cx = centerX(connector)
  const sx = centerX(source)
  if (sx < cx - 6) return 'left'
  if (sx > cx + 6) return 'right'
  return 'top'
}

export function resolveConnectorEdgeHandles(
  edge: Edge,
  process: Process,
  placedMap: Map<string, PlacedNode>,
): { sourceHandle: EdgeHandleId; targetHandle: EdgeHandleId } | null {
  const lockedSource = resolveEdgeSourceHandle(edge)
  const lockedTarget = resolveEdgeTargetHandle(edge)
  if (hasUserSpecifiedHandles(edge) && lockedSource && lockedTarget) {
    return { sourceHandle: lockedSource, targetHandle: lockedTarget }
  }

  const sourceNode = process.nodes.find((node) => node.id === edge.source)
  const targetNode = process.nodes.find((node) => node.id === edge.target)
  if (!sourceNode || !targetNode) return null

  if (isConnectorNode(targetNode)) {
    const sourcePlaced = placedMap.get(sourceNode.id)
    const connectorPlaced = placedMap.get(targetNode.id)
    if (resolveConnectorSubType(targetNode) === 'merge' && sourcePlaced && connectorPlaced) {
      const explicit = resolveEdgeTargetHandle(edge)
      return {
        sourceHandle: resolveEdgeSourceHandle(edge) ?? 'bottom',
        targetHandle: explicit ?? inferMergeIncomingHandle(sourcePlaced, connectorPlaced),
      }
    }
    return {
      sourceHandle: resolveEdgeSourceHandle(edge) ?? 'bottom',
      targetHandle: 'top',
    }
  }

  if (isConnectorNode(sourceNode)) {
    const connectorPlaced = placedMap.get(sourceNode.id)
    const targetPlaced = placedMap.get(targetNode.id)
    if (!connectorPlaced || !targetPlaced) {
      return { sourceHandle: 'bottom', targetHandle: 'top' }
    }

    if (resolveConnectorSubType(sourceNode) === 'split') {
      const explicit = resolveEdgeSourceHandle(edge)
      return {
        sourceHandle: explicit ?? inferSplitOutgoingHandle(connectorPlaced, targetPlaced),
        targetHandle: resolveEdgeTargetHandle(edge) ?? 'top',
      }
    }

    if (resolveConnectorSubType(sourceNode) === 'merge') {
      return {
        sourceHandle: resolveEdgeSourceHandle(edge) ?? 'bottom',
        targetHandle: resolveEdgeTargetHandle(edge) ?? 'top',
      }
    }
  }

  return null
}

export function placeConnectorNodes(process: Process, placed: PlacedNode[]): PlacedNode[] {
  const placedMap = new Map(placed.map((node) => [node.id, node]))
  const result = placed.filter((node) => !isConnectorNodeType(process.nodes.find((n) => n.id === node.id)?.type))
  const connectors = process.nodes.filter(isConnectorNode)

  for (const connector of connectors) {
    const inEdges = process.edges.filter((edge) => edge.target === connector.id)
    const outEdges = process.edges.filter((edge) => edge.source === connector.id)
    const subType = resolveConnectorSubType(connector)

    const incoming = inEdges
      .map((edge) => placedMap.get(edge.source))
      .filter((node): node is PlacedNode => node != null)
    const outgoing = outEdges
      .map((edge) => placedMap.get(edge.target))
      .filter((node): node is PlacedNode => node != null)

    let x = 0
    let y = 0

    if (subType === 'split' && incoming.length > 0) {
      const maxIncomingBottom = Math.max(...incoming.map(bottomY))
      const targetCx =
        outgoing.length > 0
          ? outgoing.reduce((sum, node) => sum + centerX(node), 0) / outgoing.length
          : centerX(incoming[0])
      x = targetCx - CONNECTOR_NODE_SIZE.width / 2
      y = maxIncomingBottom + CONNECTOR_GAP

      if (outgoing.length > 0) {
        const minOutgoingTop = Math.min(...outgoing.map((node) => node.y))
        const maxY = minOutgoingTop - CONNECTOR_GAP - CONNECTOR_NODE_SIZE.height
        if (maxY >= maxIncomingBottom + CONNECTOR_GAP) {
          y = Math.min(y, maxY)
        }
      }
    } else if (subType === 'merge' && incoming.length > 0) {
      const sourceCx = incoming.reduce((sum, node) => sum + centerX(node), 0) / incoming.length
      const maxBottom = Math.max(...incoming.map(bottomY))
      x = sourceCx - CONNECTOR_NODE_SIZE.width / 2
      y = maxBottom + CONNECTOR_GAP
    } else if (outgoing.length > 0) {
      const target = outgoing[0]
      x = centerX(target) - CONNECTOR_NODE_SIZE.width / 2
      y = target.y - CONNECTOR_GAP - CONNECTOR_NODE_SIZE.height
    }

    result.push({
      id: connector.id,
      laneId: connector.laneId,
      x,
      y,
      width: CONNECTOR_NODE_SIZE.width,
      height: CONNECTOR_NODE_SIZE.height,
    })
  }

  return result
}
