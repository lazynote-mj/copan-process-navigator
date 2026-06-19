import type { Edge, Node, ProcessStatus, ProcessZone } from './process'

export type ProcessKind = 'overview' | 'detail'

/** 프로세스별 독립 데이터 — lanes/phases는 commonMasters에서 주입 */
export type ProcessInstance = {
  id: string
  type: ProcessKind
  name: string
  description?: string
  version?: string
  status?: ProcessStatus
  lastModified?: string
  owner?: string
  nodes: Node[]
  edges: Edge[]
  zones?: ProcessZone[]
  /** Detail — 연결된 Overview 대표 노드 id */
  overviewNodeId?: string
  source?: string
}

export const OVERVIEW_SCOPE = 'overview' as const

export function isOverviewInstance(instance: ProcessInstance): boolean {
  return instance.type === 'overview'
}
