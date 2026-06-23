import type { Edge, Node, Process } from '../types/process'
import { migrateEdgeHandles } from '../lib/editor/edgeHandles'
import { normalizeNodeType } from '../types/nodeTypes'
import { inferOverviewNodeType } from '../types/overviewNodeTypes'
import { resolveNodeDetailProcessIds } from './overviewDetailProcesses'
import { normalizeEdgeType, resolveEdgeType } from '../types/edgeTypes'
import { resolveNodePhaseOrder } from '../lib/layout/gridLayout'
import { computeLocalOrders, normalizeAllLocalOrders } from '../lib/layout/localOrder'

/** Overview 핵심 흐름 — 수동 bend/handle 고정이 남아도 로드 시 자동 라우팅으로 복원 */
const AUTO_ROUTED_OVERVIEW_EDGE_IDS = new Set([
  'main:e2e:06',
  'overview:ov-cross-exec-procure',
  'main:e2e:06b',
  'main:e2e:07',
  'procure-to-pay:e00',
  'procure-to-pay:e01',
  'main:e2e:21',
])

function normalizeCanonicalOverviewEdge(edge: Edge): Edge {
  if (!AUTO_ROUTED_OVERVIEW_EDGE_IDS.has(edge.id)) {
    return edge
  }
  const { manualRoute: _manualRoute, points: _points, bendPoints: _bendPoints, ...rest } = edge
  return migrateEdgeHandles(
    normalizeEdgeType({
      ...rest,
      routing: {
        mode: 'auto',
        handleAuto: true,
      },
    }),
  )
}

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
  const withOverview =
    process.id === 'to-be-overview' && !withPhase.overviewType
      ? {
          ...withPhase,
          overviewType: inferOverviewNodeType({
            type: withPhase.type,
            system: withPhase.system,
            laneId: withPhase.laneId,
            detailProcessIds: withPhase.detailProcessIds,
            id: withPhase.id,
            hasLinkedDetailProcesses:
              resolveNodeDetailProcessIds(withPhase).length > 0,
          }),
        }
      : withPhase
  if (typeof withOverview.localOrder === 'number' && withOverview.localOrder > 0) {
    return withOverview
  }
  const computed = computeLocalOrders(process).get(withOverview.id)
  if (computed !== undefined) {
    return { ...withOverview, localOrder: computed }
  }
  const lanePeers = process.nodes
    .filter((n) => n.laneId === withOverview.laneId)
    .sort((a, b) => a.id.localeCompare(b.id))
  const index = lanePeers.findIndex((n) => n.id === withOverview.id)
  return { ...withOverview, localOrder: index >= 0 ? index + 1 : 1 }
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
  const seen = new Set<string>()
  const deduped: Edge[] = []
  for (const edge of edges) {
    if (seen.has(edge.id)) continue
    seen.add(edge.id)
    deduped.push(edge)
  }
  return deduped.map((edge) =>
    normalizeCanonicalOverviewEdge(migrateEdgeHandles(normalizeEdgeType(edge))),
  )
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
        detailLayout,
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
        overviewType,
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
        ...(detailLayout?.column != null || detailLayout?.row != null ? { detailLayout } : {}),
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
        ...(overviewType ? { overviewType } : {}),
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
