import type { Edge, Node, Process } from '../types/process'
import { migrateEdgeHandles } from '../lib/editor/edgeHandles'
import { normalizeNodeType } from '../types/nodeTypes'
import { normalizeEdgeType, resolveEdgeType } from '../types/edgeTypes'
import { resolveNodePhaseOrder } from '../lib/layout/gridLayout'
import { computeLocalOrders, normalizeAllLocalOrders } from '../lib/layout/localOrder'

function normalizeNode(node: Node, process: Process): Node {
  const normalizedType = normalizeNodeType(node.type, node.system)
  const withType = {
    ...node,
    type: normalizedType,
    ...(normalizedType === 'connector' && node.type === 'merge' && !node.connectorSubType
      ? { connectorSubType: 'merge' as const }
      : {}),
  }
  const withPhase = {
    ...withType,
    phaseOrder: resolveNodePhaseOrder(withType, process),
  }
  if (typeof withPhase.localOrder === 'number' && withPhase.localOrder > 0) {
    return withPhase
  }
  const computed = computeLocalOrders(process).get(withPhase.id)
  if (computed !== undefined) {
    return { ...withPhase, localOrder: computed }
  }
  const lanePeers = process.nodes
    .filter((n) => n.laneId === withPhase.laneId)
    .sort((a, b) => a.id.localeCompare(b.id))
  const index = lanePeers.findIndex((n) => n.id === withPhase.id)
  return { ...withPhase, localOrder: index >= 0 ? index + 1 : 1 }
}

export function normalizeProcessNodes(nodes: Node[], process?: Process): Node[] {
  if (!process) {
    return nodes.map((node) => ({
      ...node,
      type: normalizeNodeType(node.type, node.system),
    }))
  }
  return nodes.map((node) => normalizeNode(node, process))
}

export function normalizeProcessEdges(edges: Edge[]): Edge[] {
  return edges.map((edge) => migrateEdgeHandles(normalizeEdgeType(edge)))
}

export function serializeEdgeForExport(edge: Edge) {
  const normalized = migrateEdgeHandles(normalizeEdgeType(edge))
  return {
    ...normalized,
    type: resolveEdgeType(normalized),
  }
}

export function buildProcessExport(process: Process) {
  const { id, name, description, version, status, lastModified, owner, phases, lanes } = process

  return {
    meta: {
      id,
      name,
      description,
      version,
      status,
      lastModified,
      owner,
      phases,
    },
    lanes: [...lanes].sort((a, b) => a.order - b.order).map(({ id, name, order, ownerDepartment, description }) => ({
      id,
      name,
      order,
      ownerDepartment,
      ...(description ? { description } : {}),
    })),
    nodes: process.nodes
      .filter((n) => n.type !== 'phase-connector')
      .map(
      ({
        id,
        name,
        type,
        laneId,
        phaseId,
        phaseOrder,
        localOrder,
        processZone,
        cellOrder,
        cellSlot,
        zoneOrder,
        globalStep,
        system,
        owner,
        description,
        inputs,
        outputs,
        controls,
        detailProcessIds,
        interfaceRuleAnchor,
        connectorSubType,
        role,
        displayLevel,
        offsetX,
        offsetY,
      }) => ({
        id,
        name,
        type,
        laneId,
        phaseId,
        phaseOrder: phaseOrder ?? resolveNodePhaseOrder(
          { id, name, type, laneId, phaseId, system, owner, description, inputs, outputs, controls },
          process,
        ),
        localOrder: localOrder ?? normalizeAllLocalOrders(
          [{ id, name, type, laneId, phaseId, system, owner, description, inputs, outputs, controls }],
          process,
        )[0].localOrder,
        ...(processZone != null ? { processZone } : {}),
        ...(cellOrder != null ? { cellOrder } : {}),
        ...(cellSlot != null ? { cellSlot } : {}),
        ...(zoneOrder != null && cellOrder == null ? { zoneOrder } : {}),
        ...(globalStep != null ? { globalStep } : {}),
        system,
        owner,
        description,
        inputs,
        outputs,
        controls,
        ...(detailProcessIds?.length ? { detailProcessIds } : {}),
        ...(interfaceRuleAnchor ? { interfaceRuleAnchor } : {}),
        ...(connectorSubType ? { connectorSubType } : {}),
        ...(role ? { role } : {}),
        ...(displayLevel ? { displayLevel } : {}),
        ...(offsetX != null && offsetX !== 0 ? { offsetX } : {}),
        ...(offsetY != null && offsetY !== 0 ? { offsetY } : {}),
      }),
    ),
    edges: process.edges.map((edge) => serializeEdgeForExport(edge)),
    ...(process.zones?.length
      ? {
          zones: process.zones.map(({ id, name, type, laneIds, phaseIds, nodeIds, style }) => ({
            id,
            name,
            type,
            laneIds,
            phaseIds,
            nodeIds,
            style,
          })),
        }
      : {}),
  }
}

export function downloadProcessJson(process: Process): void {
  const payload = buildProcessExport(process)
  const date = new Date().toISOString().slice(0, 10)
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `process-${process.id}-${date}.json`
  anchor.click()
  URL.revokeObjectURL(url)
}
