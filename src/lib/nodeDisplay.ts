import type { Node, Process } from '../types/process'

/** decision 노드 하단 라벨 — edge condition id가 아닌 system(G/W 등) 표시 */
export function getDecisionSubtitle(node: Node, _process: Process): string {
  return node.system?.trim() || ''
}
