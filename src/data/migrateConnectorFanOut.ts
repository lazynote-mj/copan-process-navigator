import type { ConnectorSubType } from '../types/connectorTypes'
import type { Node, Process, ProcessZone } from '../types/process'
import { migrateEdgeHandles } from '../lib/editor/edgeHandles'
import { isBranchNodeType } from '../lib/layout/decisionAnchors'
import { isConnectorNode, resolveConnectorSubType } from '../lib/layout/connectorLayout'
import { cellSlotToRowCol } from '../lib/layout/overviewCellPlacement'

const KNOWN_SPLIT_IDS: Record<string, { connectorId: string; name: string }> = {
  'purchase-request': { connectorId: 'master-data-split', name: '기준정보 확인' },
}

function inferSplitOutgoingHandleFromSlot(target: Node): 'left' | 'right' | 'bottom' {
  if (target.cellSlot == null) return 'bottom'
  const { col } = cellSlotToRowCol(target.cellSlot)
  return col === 0 ? 'left' : 'right'
}

function createSplitConnector(source: Node, connectorId: string, name: string): Node {
  return {
    id: connectorId,
    name,
    type: 'connector',
    connectorSubType: 'split' satisfies ConnectorSubType,
    laneId: source.laneId,
    phaseId: source.phaseId,
    phaseOrder: source.phaseOrder,
    localOrder: source.localOrder,
    processZone: source.processZone,
    cellOrder: (source.cellOrder ?? source.zoneOrder ?? 0) + 1,
    system: source.system,
    owner: source.owner,
    description: `${source.name} 이후 병렬 분기`,
    inputs: [],
    outputs: [],
    controls: [],
  }
}

function ensureZoneIncludesConnector(zones: ProcessZone[] | undefined, connectorId: string, siblingIds: string[]): ProcessZone[] {
  const list = zones ?? []
  const siblingSet = new Set(siblingIds)
  const zoneIndex = list.findIndex((zone) => zone.nodeIds.some((id) => siblingSet.has(id)))
  if (zoneIndex < 0) return list

  const zone = list[zoneIndex]
  if (zone.nodeIds.includes(connectorId)) return list

  const nextZones = [...list]
  nextZones[zoneIndex] = { ...zone, nodeIds: [...zone.nodeIds, connectorId] }
  return nextZones
}

/**
 * 비-decision 노드에서 2개 이상 직접 분기하는 edge를 Split connector 구조로 정규화.
 * 저장된 state.json 등 레거시 fan-out을 자동 보정.
 */
export function migrateFanOutToSplitConnectors(process: Process): Process {
  const nodes = [...process.nodes]
  let edges = process.edges.map((edge) => migrateEdgeHandles(edge))
  const nodeById = () => new Map(nodes.map((node) => [node.id, node]))

  const sourcesToMigrate: string[] = []
  for (const node of nodes) {
    if (isConnectorNode(node) || isBranchNodeType(node.type)) continue

    const outgoing = edges.filter((edge) => edge.source === node.id)
    const directTargets = outgoing.filter((edge) => {
      const target = nodeById().get(edge.target)
      return target && !isConnectorNode(target)
    })

    const viaSplit = outgoing.some((edge) => {
      const target = nodeById().get(edge.target)
      return target && isConnectorNode(target) && resolveConnectorSubType(target) === 'split'
    })

    if (viaSplit || directTargets.length < 2) continue
    sourcesToMigrate.push(node.id)
  }

  if (sourcesToMigrate.length === 0) {
    return process
  }

  for (const sourceId of sourcesToMigrate) {
    const sourceNode = nodeById().get(sourceId)
    if (!sourceNode) continue

    const known = KNOWN_SPLIT_IDS[sourceId]
    const connectorId = known?.connectorId ?? `${sourceId}-split`
    const connectorName = known?.name ?? 'Split'

    if (!nodeById().has(connectorId)) {
      nodes.push(createSplitConnector(sourceNode, connectorId, connectorName))
    }

    const directEdges = edges.filter((edge) => {
      if (edge.source !== sourceId) return false
      const target = nodeById().get(edge.target)
      return target && !isConnectorNode(target)
    })

    const hasIncomingToSplit = edges.some(
      (edge) => edge.source === sourceId && edge.target === connectorId,
    )

    if (!hasIncomingToSplit) {
      edges.push({
        id: `${sourceId}-to-${connectorId}`,
        source: sourceId,
        target: connectorId,
        type: 'normal',
        label: '',
        condition: '',
        sourceHandle: 'bottom',
        targetHandle: 'top',
        routing: { mode: 'auto' },
      })
    }

    edges = edges.map((edge) => {
      if (!directEdges.some((direct) => direct.id === edge.id)) return edge

      const targetNode = nodeById().get(edge.target)
      const sourceHandle = targetNode
        ? inferSplitOutgoingHandleFromSlot(targetNode)
        : 'bottom'

      return migrateEdgeHandles({
        ...edge,
        source: connectorId,
        sourceHandle,
        targetHandle: edge.targetHandle ?? 'top',
      })
    })
  }

  const zones = sourcesToMigrate.reduce((acc, sourceId) => {
    const known = KNOWN_SPLIT_IDS[sourceId]
    const connectorId = known?.connectorId ?? `${sourceId}-split`
    const directTargets = process.edges
      .filter((edge) => edge.source === sourceId)
      .map((edge) => edge.target)
    return ensureZoneIncludesConnector(acc, connectorId, directTargets)
  }, process.zones ?? [])

  return { ...process, nodes, edges, zones }
}
