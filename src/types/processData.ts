import {
  createDefaultCommonMasters,
  type CommonMasters,
} from './commonMasters'
import type { Edge, Process, ProcessZone } from './process'
import type { Node } from './process'
import type { ProcessInstance } from './processInstance'
import { OVERVIEW_SCOPE } from './processInstance'
import type { Workflow } from './workflow'
import type {
  ApprovalPolicy,
  ApprovalRoute,
  DocumentArtifact,
  GovernanceRule,
} from './governance'
import type {
  DetailProcessGroup,
  OverviewProcessGroup,
  ProcessGroup,
} from './toBeNavigator'

export type ProcessScope = typeof OVERVIEW_SCOPE | string

export type ProcessDataSource =
  | 'local'
  | 'remote'
  | 'imported'
  | 'project-json'
  | 'server-json'
  | 'imported-json'

export type ProcessData = {
  commonMasters: CommonMasters
  processes: ProcessInstance[]
  overviewProcessGroups?: OverviewProcessGroup[]
  detailProcessGroups?: DetailProcessGroup[]
  /** Workflow Grouping Metadata — commonMasters(Master) 아님. 비우면 기존 동작 */
  workflows?: Workflow[]
  /** @deprecated overviewProcessGroups */
  processGroups?: ProcessGroup[]
  // ── Governance Layer (ADR-007 · WP2.1) — additive·optional. 비우면 기존 동작. ──
  // 구조(타입)만 도입한다. 직렬화·검증·resolver·문서 생성은 후속 WP2.2~2.4의 몫이다.
  /** 거버넌스 규칙 메타데이터 (정책/규칙이며 실행 엔진 아님). */
  governanceRules?: GovernanceRule[]
  /** 승인 정책 (경로 도출 규칙). resolver는 WP2.3. */
  approvalPolicies?: ApprovalPolicy[]
  /** 승인 경로 — 구조화 레코드를 대상으로 하는 Data-first 승인(문서 아님). */
  approvalRoutes?: ApprovalRoute[]
  /** 승인 이후 생성되는 문서 산출물 (post-approval output). */
  documentArtifacts?: DocumentArtifact[]
  /**
   * Runtime Entities content 버전 (ADR-005 §D3 / ADR-006 §D4).
   * 저장 파일의 top-level `schemaVersion`(직렬화 스키마 버전)과 구분되는 콘텐츠 논리 버전.
   * WP1은 도입·보존만 담당하며, 증가(version++)는 WP5 applyChangeSet 경계의 몫이다.
   */
  version: number
  updatedAt: string
  dataSource: ProcessDataSource
  /**
   * 세션 메타데이터. persistence 제외(저장 파일에 직렬화하지 않는다).
   * hydrate 시 재계산/무시한다(ADR-005 §D3).
   */
  dirty: boolean
  baselineNodeCount: number
  baselineEdgeCount: number
}

function hasBrokenText(value: unknown): boolean {
  return typeof value === 'string' && value.includes('\uFFFD')
}

function repairGroupText<T extends { id: string; name?: string; description?: string }>(
  saved: T,
  fallback: T,
): T {
  if (!hasBrokenText(saved.name) && !hasBrokenText(saved.description)) return saved

  return {
    ...saved,
    ...(hasBrokenText(saved.name) ? { name: fallback.name } : {}),
    ...(hasBrokenText(saved.description) ? { description: fallback.description } : {}),
  }
}

function mergeGroupLists<T extends { id: string; name?: string; description?: string }>(
  saved: T[] | undefined,
  fallback: T[],
): T[] {
  if (!saved?.length) return fallback
  const savedById = new Map(saved.map((group) => [group.id, group]))
  const merged = fallback.map((base) => {
    const savedGroup = savedById.get(base.id)
    return savedGroup ? repairGroupText(savedGroup, base) : base
  })
  for (const group of saved) {
    if (!fallback.some((base) => base.id === group.id)) {
      merged.push(group)
    }
  }
  return merged
}

export function resolveOverviewProcessGroups(
  data: ProcessData,
  fallback: OverviewProcessGroup[],
): OverviewProcessGroup[] {
  return mergeGroupLists(data.overviewProcessGroups, fallback)
}

export function resolveDetailProcessGroups(
  data: ProcessData,
  fallback: DetailProcessGroup[],
): DetailProcessGroup[] {
  return mergeGroupLists(data.detailProcessGroups, fallback)
}

/** @deprecated resolveOverviewProcessGroups */
export function resolveProcessGroups(
  data: ProcessData,
  fallback: ProcessGroup[],
): ProcessGroup[] {
  return resolveOverviewProcessGroups(data, fallback) as ProcessGroup[]
}

export function getOverviewProcessGroupFromData(
  data: ProcessData,
  groupId: string,
  fallback: OverviewProcessGroup[],
): OverviewProcessGroup | undefined {
  return resolveOverviewProcessGroups(data, fallback).find((group) => group.id === groupId)
}

export function getDetailProcessGroupFromData(
  data: ProcessData,
  groupId: string,
  fallback: DetailProcessGroup[],
): DetailProcessGroup | undefined {
  return resolveDetailProcessGroups(data, fallback).find((group) => group.id === groupId)
}

/** @deprecated getOverviewProcessGroupFromData */
export function getProcessGroupFromData(
  data: ProcessData,
  groupId: string,
  fallback: ProcessGroup[],
): ProcessGroup | undefined {
  return resolveProcessGroups(data, fallback).find((group) => group.id === groupId)
}

export function cloneProcess(process: Process): Process {
  return structuredClone(process)
}

export function cloneProcessInstance(instance: ProcessInstance): ProcessInstance {
  return structuredClone(instance)
}

export function cloneProcessData(data: ProcessData): ProcessData {
  return structuredClone(data)
}

/** instance.laneIds 서브셋 필터 — 무효 id만 남으면 전체 레인으로 안전 fallback */
function resolveLanesForInstance(
  instance: ProcessInstance,
  masters: CommonMasters,
): CommonMasters['lanes'] {
  let lanes = masters.lanes
  if (instance.laneIds?.length) {
    const selected = new Set(instance.laneIds)
    const filtered = masters.lanes.filter((lane) => selected.has(lane.id))
    if (filtered.length > 0) lanes = filtered
  }
  if (instance.autoHideEmptyLanes) {
    const usedLaneIds = new Set(instance.nodes.map((node) => node.laneId))
    const withNodes = lanes.filter((lane) => usedLaneIds.has(lane.id))
    // 노드가 하나도 없는 프로세스는 전부 숨기지 않고 현재 집합을 유지한다
    if (withNodes.length > 0) lanes = withNodes
  }
  return lanes
}

/** commonMasters + instance → 렌더/레이아웃용 Process */
export function resolveProcessWithMasters(
  instance: ProcessInstance,
  masters: CommonMasters,
): Process {
  return {
    id: instance.id,
    name: instance.name,
    description: instance.description ?? '',
    version: instance.version ?? '',
    status: instance.status ?? 'draft',
    lastModified: instance.lastModified ?? '',
    owner: instance.owner ?? '',
    lanes: resolveLanesForInstance(instance, masters),
    laneIds: instance.laneIds,
    autoHideEmptyLanes: instance.autoHideEmptyLanes,
    phases: masters.phases,
    nodes: instance.nodes,
    edges: instance.edges,
    zones: instance.zones,
    overviewNodeId: instance.overviewNodeId,
    source: instance.source,
  }
}

export function getOverviewInstance(data: ProcessData): ProcessInstance | undefined {
  return data.processes.find((p) => p.type === 'overview')
}

export function getProcessInstance(
  data: ProcessData,
  scope: ProcessScope,
): ProcessInstance | undefined {
  if (scope === OVERVIEW_SCOPE) return getOverviewInstance(data)
  return data.processes.find((p) => p.id === scope)
}

export function getProcessByScope(
  data: ProcessData,
  scope: ProcessScope,
): Process | undefined {
  const instance = getProcessInstance(data, scope)
  if (!instance) return undefined
  return resolveProcessWithMasters(instance, data.commonMasters)
}

export function getOverviewProcess(data: ProcessData): Process | undefined {
  return getProcessByScope(data, OVERVIEW_SCOPE)
}

export function findProcessIndex(data: ProcessData, scope: ProcessScope): number {
  if (scope === OVERVIEW_SCOPE) {
    return data.processes.findIndex((p) => p.type === 'overview')
  }
  return data.processes.findIndex((p) => p.id === scope)
}

export function collectAllNodes(data: ProcessData): Node[] {
  return data.processes.flatMap((p) => p.nodes)
}

export function collectAllEdges(data: ProcessData): Edge[] {
  return data.processes.flatMap((p) => p.edges)
}

export function collectAllZones(data: ProcessData): ProcessZone[] {
  return data.processes.flatMap((p) => p.zones ?? [])
}

export function summarizeProcessData(data: ProcessData): {
  nodeCount: number
  edgeCount: number
  zoneCount: number
  processCount: number
} {
  return {
    nodeCount: collectAllNodes(data).length,
    edgeCount: collectAllEdges(data).length,
    zoneCount: collectAllZones(data).length,
    processCount: data.processes.length,
  }
}

/** Process → ProcessInstance (lanes/phases 제외) */
export function processToInstance(
  process: Process,
  type?: 'overview' | 'detail',
): ProcessInstance {
  const kind =
    type ??
    (process.id.includes('overview') || process.name.toLowerCase().includes('overview')
      ? 'overview'
      : 'detail')
  return {
    id: process.id,
    type: kind,
    name: process.name,
    description: process.description,
    version: process.version,
    status: process.status,
    lastModified: process.lastModified,
    owner: process.owner,
    nodes: structuredClone(process.nodes),
    edges: structuredClone(process.edges),
    zones: process.zones ? structuredClone(process.zones) : undefined,
    laneIds: process.laneIds ? [...process.laneIds] : undefined,
    autoHideEmptyLanes: process.autoHideEmptyLanes,
    overviewNodeId: process.overviewNodeId,
    source: process.source,
  }
}

export function extractCommonMastersFromOverview(overview: Process): CommonMasters {
  return createDefaultCommonMasters(
    structuredClone(overview.lanes ?? []),
    structuredClone(overview.phases ?? []),
  )
}

export { OVERVIEW_SCOPE }
