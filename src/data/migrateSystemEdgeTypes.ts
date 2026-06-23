import type { Edge, Node, Process } from '../types/process'

export type SystemEdgeMigrationTarget = 'api' | 'normal'

const INTEGRATION_NODE_TYPES = new Set(['interface', 'api'])

/** ERP↔WMS/OMS/POS 등 cross-system 연동 문구 */
export function isCrossSystemIntegrationText(system?: string): boolean {
  const s = (system ?? '').trim().toLowerCase()
  if (!s) return false
  return (
    s.includes('→') ||
    s.includes('↔') ||
    s.includes('api') ||
    (s.includes('erp') && (s.includes('wms') || s.includes('oms'))) ||
    (s.includes('wms') && s.includes('erp')) ||
    (s.includes('pos') && s.includes('erp')) ||
    (s.includes('이지체인') && s.includes('erp')) ||
    (s.includes('이지어드민') && (s.includes('erp') || s.includes('↔')))
  )
}

/** legacy edge.type=system → api | normal */
export function inferMigratedSystemEdgeType(
  _edge: Edge,
  source?: Node,
  target?: Node,
): SystemEdgeMigrationTarget {
  if (isCrossSystemIntegrationText(source?.system) || isCrossSystemIntegrationText(target?.system)) {
    return 'api'
  }

  if (source?.laneId && target?.laneId && source.laneId !== target.laneId) {
    return 'api'
  }

  if (
    INTEGRATION_NODE_TYPES.has(source?.type ?? '') ||
    INTEGRATION_NODE_TYPES.has(target?.type ?? '')
  ) {
    return 'api'
  }

  if (source?.type === 'interface-rule') {
    if (
      INTEGRATION_NODE_TYPES.has(target?.type ?? '') ||
      isCrossSystemIntegrationText(target?.system)
    ) {
      return 'api'
    }
    return 'normal'
  }

  return 'normal'
}

export type SystemEdgeMigrationResult = {
  edges: Edge[]
  changed: number
  toApi: number
  toNormal: number
}

export function migrateSystemEdgesInProcess(process: Process): SystemEdgeMigrationResult {
  const nodesById = new Map(process.nodes.map((node) => [node.id, node]))
  let changed = 0
  let toApi = 0
  let toNormal = 0

  const edges = process.edges.map((edge) => {
    if (edge.type !== 'system') return edge
    const source = nodesById.get(edge.source)
    const target = nodesById.get(edge.target)
    const nextType = inferMigratedSystemEdgeType(edge, source, target)
    changed += 1
    if (nextType === 'api') toApi += 1
    else toNormal += 1
    return { ...edge, type: nextType }
  })

  return { edges, changed, toApi, toNormal }
}
