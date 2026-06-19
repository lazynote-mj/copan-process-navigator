import type { Node, Process } from '../types/process'

/** decision 노드 하단 라벨 — condition 우선, 없으면 system */
export function getDecisionSubtitle(node: Node, process: Process): string {
  const withCondition = process.edges.find(
    (e) => e.source === node.id && e.condition && e.condition.trim().length > 0,
  )
  if (withCondition?.condition) {
    return withCondition.condition.trim()
  }
  return node.system?.trim() || ''
}
