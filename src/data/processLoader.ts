import type { Edge, Lane, Node, Phase, Process, ProcessStatus } from '../types/process'
import { normalizeProcessNodes, normalizeProcessEdges } from './processExport'
import { getOverviewLanes } from './laneRegistry'

/** JSON meta 파일 (lanes/nodes/edges 제외) */
export type ProcessMeta = {
  id: string
  name: string
  description: string
  version: string
  status: ProcessStatus
  lastModified: string
  owner: string
  phases: Phase[]
}

/** JSON 파일에 lanes가 없을 때 Overview 기본 lane을 붙인다 */
export type ProcessData = Omit<Process, 'lanes'> & {
  lanes?: Lane[]
}

export function attachOverviewLanes(data: ProcessData): Process {
  return {
    ...data,
    lanes: data.lanes ?? getOverviewLanes(),
  }
}

/** meta + nodes.json + edges.json → Process */
export function loadProcessBundle(
  meta: ProcessMeta,
  nodes: Node[],
  edges: Edge[],
): Process {
  const lanes = getOverviewLanes()
  const draft: Process = { ...meta, lanes, nodes: [], edges: [] }

  return {
    ...draft,
    nodes: normalizeProcessNodes(nodes, { ...draft, nodes }),
    edges: normalizeProcessEdges(edges),
  }
}

/** SCM TO-BE flat detail process JSON */
export type DetailProcessFile = {
  id: string
  name: string
  source: string
  version: string
  description: string
  overviewNodeId: string
  status?: ProcessStatus
  lastModified?: string
  owner?: string
  phases?: Phase[]
  lanes?: Lane[]
  nodes: Node[]
  edges: Edge[]
}

export function loadDetailProcessFile(data: DetailProcessFile): Process {
  const lanes = data.lanes?.length ? data.lanes : getOverviewLanes()
  const draft: Process = {
    id: data.id,
    name: data.name,
    description: data.description,
    version: data.version,
    status: data.status ?? 'draft',
    lastModified: data.lastModified ?? '2026-06-15',
    owner: data.owner ?? 'ERP PMO',
    phases: data.phases ?? [],
    lanes,
    nodes: [],
    edges: [],
    source: data.source,
    overviewNodeId: data.overviewNodeId,
  }

  return {
    ...draft,
    nodes: normalizeProcessNodes(data.nodes, { ...draft, nodes: data.nodes }),
    edges: normalizeProcessEdges(data.edges),
  }
}
