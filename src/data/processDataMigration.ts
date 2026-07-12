import type { CommonMasters } from '../types/commonMasters'
import type { Process } from '../types/process'
import type { ProcessInstance } from '../types/processInstance'
import type {
  DetailProcessGroup,
  OverviewProcessGroup,
  ProcessGroup,
} from '../types/toBeNavigator'
import type { Workflow } from '../types/workflow'
import {
  extractCommonMastersFromOverview,
  processToInstance,
  type ProcessData,
} from '../types/processData'
import {
  buildDetailProcessGroups,
  buildOverviewProcessGroups,
} from './toBeOverview/overviewEdgeRegistry'
import { filterEdgesByExistingEndpoints } from './processExport'
import { normalizeEdgeForStorage } from '../lib/editor/edgeUpdate'
import { EXECUTION_DOMAIN_SCHEMA_VERSION, migrateExecutionDomains } from './executionDomainMigration'

export type ProcessDataFilePayloadV1 = {
  kind: 'copan-process-navigator-state'
  version: 1
  exportedAt: string
  overview: Process
  details: Record<string, Process> | Process[]
}

export type ProcessDataFilePayloadV2 = {
  kind: 'copan-process-navigator-state'
  /**
   * 직렬화 스키마 버전 (ADR-005 §D3 — migration 판단용). 신규 canonical 필드.
   * legacy 파일에서는 이 값이 없고 top-level `version:2`가 스키마 버전 역할을 했다 → 로드 시 back-compat.
   * WP3: Execution Domain 도입으로 3까지 확장(schemaVersion<3 이면 도메인 마이그레이션 적용).
   */
  schemaVersion?: number
  /**
   * schemaVersion 도입 이후: Runtime Entities content 버전.
   * legacy 파일(schemaVersion 미존재)에서는 스키마 버전(=2)이었으므로 content 버전은 로드 시 초기값으로 해석한다.
   */
  version: number
  exportedAt: string
  commonMasters: CommonMasters
  processes: ProcessInstance[]
  overviewProcessGroups?: OverviewProcessGroup[]
  detailProcessGroups?: DetailProcessGroup[]
  /** Workflow Grouping Metadata — commonMasters 밖 최상위 별도 배열 (optional, additive) */
  workflows?: Workflow[]
  /** @deprecated */
  processGroups?: ProcessGroup[]
}

export type ProcessDataFilePayload = ProcessDataFilePayloadV1 | ProcessDataFilePayloadV2

/** Runtime content 버전 초기값 (ADR-005 §D3, WP1 정책: content.version = 1). */
export const INITIAL_CONTENT_VERSION = 1

/** 저장 파일의 직렬화 스키마 버전. legacy는 top-level `version`이 이 역할이었다(back-compat). */
export function resolveSchemaVersion(payload: ProcessDataFilePayload): number {
  return (payload as ProcessDataFilePayloadV2).schemaVersion ?? payload.version
}

export function isV2Payload(
  payload: ProcessDataFilePayload,
): payload is ProcessDataFilePayloadV2 {
  // V2 이상(=processes[] 구조)이면 true. V3는 V2와 구조 동일이므로 포함(WP3).
  return resolveSchemaVersion(payload) >= 2
}

/**
 * Runtime content 버전 해석 (forward-only).
 * - schemaVersion이 있는 파일에서만 top-level `version`이 content 버전이다.
 * - legacy 파일(schemaVersion 미존재)·V1은 초기값을 부여한다.
 */
export function resolveContentVersion(payload: ProcessDataFilePayload): number {
  const v2 = payload as ProcessDataFilePayloadV2
  if (v2.schemaVersion !== undefined && typeof v2.version === 'number') {
    return v2.version
  }
  return INITIAL_CONTENT_VERSION
}

function normalizeV1Details(details: ProcessDataFilePayloadV1['details']): Process[] {
  if (Array.isArray(details)) return details
  return Object.values(details ?? {})
}

function normalizeProcessInstanceEdges(instance: ProcessInstance): ProcessInstance {
  const normalizedEdges = structuredClone(instance.edges).map(normalizeEdgeForStorage)
  const { edges, removed } = filterEdgesByExistingEndpoints(instance.nodes, normalizedEdges)
  if (removed.length > 0) {
    console.warn(
      `[ProcessNavigator] Removed ${removed.length} invalid edge(s) during data migration (${instance.id}): ${removed.map((edge) => edge.id).join(', ')}`,
    )
  }
  return {
    ...instance,
    nodes: structuredClone(instance.nodes),
    edges,
    zones: instance.zones ? structuredClone(instance.zones) : undefined,
  }
}

function processToNormalizedInstance(process: Process, type: 'overview' | 'detail'): ProcessInstance {
  return normalizeProcessInstanceEdges(
    processToInstance(
      {
        ...process,
        edges: process.edges.map(normalizeEdgeForStorage),
      },
      type,
    ),
  )
}

export function migrateV1ToV2(payload: ProcessDataFilePayloadV1): ProcessDataFilePayloadV2 {
  const commonMasters = extractCommonMastersFromOverview(payload.overview)
  const overviewInstance = processToInstance(payload.overview, 'overview')
  const detailInstances = normalizeV1Details(payload.details).map((p) =>
    processToInstance(p, 'detail'),
  )
  return {
    kind: 'copan-process-navigator-state',
    schemaVersion: 2,
    version: INITIAL_CONTENT_VERSION,
    exportedAt: payload.exportedAt,
    commonMasters,
    processes: [overviewInstance, ...detailInstances],
  }
}

export function ensureProcessGroupFields(data: ProcessData): ProcessData {
  const overviewProcessGroups = data.overviewProcessGroups?.length
    ? data.overviewProcessGroups
    : structuredClone(buildOverviewProcessGroups())
  const detailProcessGroups = data.detailProcessGroups?.length
    ? data.detailProcessGroups
    : structuredClone(buildDetailProcessGroups())
  return {
    ...data,
    overviewProcessGroups,
    detailProcessGroups,
  }
}

export function buildProcessDataFromPayload(
  payload: ProcessDataFilePayload,
  dataSource: ProcessData['dataSource'],
): ProcessData {
  // V1(schemaVersion<2)만 V1→V2 승격. V2/V3는 구조가 동일하므로 그대로 사용.
  let v2: ProcessDataFilePayloadV2 =
    resolveSchemaVersion(payload) < 2 ? migrateV1ToV2(payload as ProcessDataFilePayloadV1) : (payload as ProcessDataFilePayloadV2)

  // WP3 — Execution Domain 마이그레이션(schemaVersion<3 에서만). idempotent·무손실.
  if (resolveSchemaVersion(payload) < EXECUTION_DOMAIN_SCHEMA_VERSION) {
    const migrated = migrateExecutionDomains({
      commonMasters: v2.commonMasters,
      processes: v2.processes,
      detailProcessGroups: v2.detailProcessGroups,
    })
    if (migrated.warnings.length > 0) {
      console.warn(
        `[ProcessNavigator] Execution Domain migration: ${migrated.warnings.length} warning(s)`,
        migrated.warnings.slice(0, 8),
      )
    }
    v2 = {
      ...v2,
      commonMasters: migrated.commonMasters,
      processes: migrated.processes,
      detailProcessGroups: migrated.detailProcessGroups,
    }
  }

  const processes = v2.processes.map(normalizeProcessInstanceEdges)
  const commonMasters = structuredClone(v2.commonMasters)
  const summary = {
    nodeCount: processes.reduce((n, p) => n + p.nodes.length, 0),
    edgeCount: processes.reduce((n, p) => n + p.edges.length, 0),
  }
  const base: ProcessData = {
    commonMasters,
    processes,
    // content 버전은 원본 payload 기준으로 해석한다(legacy·V1 → 초기값, schemaVersion 파일 → 보존).
    version: resolveContentVersion(payload),
    updatedAt: v2.exportedAt,
    dataSource,
    dirty: false,
    baselineNodeCount: summary.nodeCount,
    baselineEdgeCount: summary.edgeCount,
    // Workflow Grouping Metadata 보존 — 없으면 미정의(기존 payload 하위호환)
    ...(v2.workflows ? { workflows: structuredClone(v2.workflows) } : {}),
  }
  if (v2.overviewProcessGroups?.length || v2.detailProcessGroups?.length) {
    return ensureProcessGroupFields({
      ...base,
      overviewProcessGroups: v2.overviewProcessGroups
        ? structuredClone(v2.overviewProcessGroups)
        : undefined,
      detailProcessGroups: v2.detailProcessGroups
        ? structuredClone(v2.detailProcessGroups)
        : undefined,
    })
  }
  return ensureProcessGroupFields(base)
}

export function createInitialProcessData(
  overview: Process,
  detailProcesses: Process[],
): ProcessData {
  const commonMasters = extractCommonMastersFromOverview(overview)
  const processes: ProcessInstance[] = [
    processToNormalizedInstance(overview, 'overview'),
    ...detailProcesses.map((p) => processToNormalizedInstance(p, 'detail')),
  ]
  const nodeCount = processes.reduce((n, p) => n + p.nodes.length, 0)
  const edgeCount = processes.reduce((n, p) => n + p.edges.length, 0)
  return ensureProcessGroupFields({
    commonMasters,
    processes,
    version: INITIAL_CONTENT_VERSION,
    updatedAt: new Date().toISOString(),
    dataSource: 'project-json',
    dirty: false,
    baselineNodeCount: nodeCount,
    baselineEdgeCount: edgeCount,
  })
}

export function processDataToFilePayload(data: ProcessData): ProcessDataFilePayloadV2 {
  const normalized = ensureProcessGroupFields(data)
  return {
    kind: 'copan-process-navigator-state',
    // WP3 — Execution Domain 도입 후 저장 파일은 schemaVersion 3. reload 시 재마이그레이션 skip.
    schemaVersion: EXECUTION_DOMAIN_SCHEMA_VERSION,
    // content 버전은 Runtime에서 관리(WP1: 보존). dirty는 직렬화하지 않는다(ADR-005 §D3).
    version: normalized.version,
    exportedAt: normalized.updatedAt,
    commonMasters: structuredClone(normalized.commonMasters),
    processes: normalized.processes.map((p) => normalizeProcessInstanceEdges(structuredClone(p))),
    overviewProcessGroups: structuredClone(normalized.overviewProcessGroups ?? []),
    detailProcessGroups: structuredClone(normalized.detailProcessGroups ?? []),
    // Workflow Grouping Metadata — 있을 때만 직렬화 (기존 파일 하위호환)
    ...(normalized.workflows ? { workflows: structuredClone(normalized.workflows) } : {}),
  }
}
