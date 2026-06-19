import type { Node } from '../../types/process'

/** Property Panel 노드 select — 가나다순, 동명이면 id 오름차순 */
export function sortNodesForSelect<T extends Pick<Node, 'id' | 'name'>>(nodes: T[]): T[] {
  return [...nodes].sort(
    (a, b) => a.name.localeCompare(b.name, 'ko-KR') || a.id.localeCompare(b.id),
  )
}

export function formatNodeSelectLabel(node: Pick<Node, 'id' | 'name'>): string {
  return `${node.name} (${node.id})`
}
