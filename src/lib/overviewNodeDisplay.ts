import type { Node, Process } from '../types/process'
import { resolveNodeDetailProcessIds } from '../data/overviewDetailProcesses'
import {
  inferOverviewNodeType,
  OVERVIEW_NODE_TYPE_META,
  shouldAppendAutoSuffix,
  type OverviewNodeType,
} from '../types/overviewNodeTypes'

export function resolveOverviewNodeType(node: Node): OverviewNodeType {
  if (node.overviewType && node.overviewType in OVERVIEW_NODE_TYPE_META) {
    return node.overviewType
  }
  return inferOverviewNodeType({
    type: node.type,
    system: node.system,
    laneId: node.laneId,
    detailProcessIds: node.detailProcessIds,
    id: node.id,
    hasLinkedDetailProcesses: resolveNodeDetailProcessIds(node).length > 0,
  })
}

/** Overview 노드 1행 — PDF: 반품확정(AUTO), 수작업은 접미사 없음 */
export function formatOverviewNodePrimaryLabel(node: Node): string {
  if (shouldAppendAutoSuffix(node.type)) {
    return `${node.name}(AUTO)`
  }

  const overviewType = resolveOverviewNodeType(node)
  const meta = OVERVIEW_NODE_TYPE_META[overviewType]
  if (meta.appendSuffixToName && meta.displaySuffix) {
    return `${node.name}(${meta.displaySuffix})`
  }
  return node.name
}

/** Overview 노드 2행 — PDF 범례 부제 (ERP, 이지어드민, groupware 등) */
export function formatOverviewNodeSubtitle(node: Node, process?: Process): string {
  const overviewType = resolveOverviewNodeType(node)
  const meta = OVERVIEW_NODE_TYPE_META[overviewType]
  const system = node.system?.trim() ?? ''

  if (overviewType === 'decision') {
    const withCondition = process?.edges.find(
      (e) => e.source === node.id && e.condition?.trim(),
    )
    if (withCondition?.condition?.trim()) return withCondition.condition.trim()
    if (system) return system
    return meta.defaultSubtitle ?? ''
  }

  if (overviewType === 'api') {
    return system || meta.defaultSubtitle || 'API'
  }

  if (overviewType === 'linked-process') {
    const detailIds = resolveNodeDetailProcessIds(node)
    if (detailIds.length === 1) return detailIds[0]
    if (detailIds.length > 1) return `Detail ${detailIds.length}건`
    return system
  }

  if (system) return system

  return meta.defaultSubtitle ?? ''
}
