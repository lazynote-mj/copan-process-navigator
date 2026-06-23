import type { Edge } from '../types/process'
import {
  cloneProcessData,
  collectAllEdges,
  getOverviewInstance,
  resolveProcessWithMasters,
  summarizeProcessData,
  type ProcessData,
} from '../types/processData'
import { buildProcessDataFromPayload, processDataToFilePayload } from './processDataMigration'
import type { ProcessDataFilePayload } from './processDataMigration'
import { normalizeProcessEdges, normalizeProcessNodes } from './processExport'
import { formatTimestamp } from './workingStateStats'

export type { ProcessDataFilePayload } from './processDataMigration'
export { processDataToFilePayload } from './processDataMigration'

export type ExportValidationResult = {
  ok: boolean
  nodeCount: number
  edgeCount: number
  processCount: number
  edgesWithHandles: number
  edgesMissingHandles: string[]
  message: string
}

export type PreExportValidationResult = {
  ok: boolean
  message: string
}

function applyOverviewMigration(data: ProcessData): ProcessData {
  const overviewInstance = getOverviewInstance(data)
  if (!overviewInstance) return data

  const resolved = resolveProcessWithMasters(overviewInstance, data.commonMasters)
  const idx = data.processes.findIndex((p) => p.type === 'overview')
  if (idx < 0) return data

  const processes = [...data.processes]
  processes[idx] = {
    ...processes[idx],
    nodes: resolved.nodes,
    edges: resolved.edges,
  }
  return { ...data, processes }
}

export function filePayloadToProcessData(
  payload: ProcessDataFilePayload,
  dataSource: ProcessData['dataSource'] = 'imported-json',
): ProcessData {
  const imported = buildProcessDataFromPayload(payload, dataSource)
  return applyOverviewMigration(imported)
}

function validateV1Overview(overview: {
  overview?: {
    id?: string
    nodes?: unknown
    edges?: unknown
    lanes?: unknown
  }
  details?: Record<string, {
    id?: string
    nodes?: unknown
    edges?: unknown
    lanes?: unknown
  }>
}) {
  if (!overview.overview?.id) {
    throw new Error('overview 데이터가 누락되었습니다.')
  }
  if (!Array.isArray(overview.overview.nodes)) {
    throw new Error('overview.nodes 배열이 필요합니다.')
  }
  if (!Array.isArray(overview.overview.edges)) {
    throw new Error('overview.edges 배열이 필요합니다.')
  }
  if (!Array.isArray(overview.overview.lanes)) {
    throw new Error('overview.lanes 배열이 필요합니다.')
  }
  const details = overview.details ?? {}
  if (typeof details !== 'object') {
    throw new Error('details 객체가 필요합니다.')
  }
  for (const [id, process] of Object.entries(details)) {
    if (!process?.id) {
      throw new Error(`details[${id}] 프로세스 id가 누락되었습니다.`)
    }
    if (!Array.isArray(process.nodes)) {
      throw new Error(`details[${id}].nodes 배열이 필요합니다.`)
    }
    if (!Array.isArray(process.edges)) {
      throw new Error(`details[${id}].edges 배열이 필요합니다.`)
    }
  }
}

function validateV2Payload(payload: {
  commonMasters?: { lanes?: unknown; phases?: unknown }
  processes?: Array<{ id?: string; type?: string; nodes?: unknown; edges?: unknown }>
}) {
  if (!payload.commonMasters) {
    throw new Error('commonMasters가 누락되었습니다.')
  }
  if (!Array.isArray(payload.commonMasters.lanes)) {
    throw new Error('commonMasters.lanes 배열이 필요합니다.')
  }
  if (!Array.isArray(payload.commonMasters.phases)) {
    throw new Error('commonMasters.phases 배열이 필요합니다.')
  }
  if (!Array.isArray(payload.processes)) {
    throw new Error('processes 배열이 필요합니다.')
  }
  const hasOverview = payload.processes.some((p) => p.type === 'overview')
  if (!hasOverview) {
    throw new Error('type: "overview" 프로세스가 필요합니다.')
  }
  for (const process of payload.processes) {
    if (!process?.id) {
      throw new Error('processes[].id가 누락되었습니다.')
    }
    if (!Array.isArray(process.nodes)) {
      throw new Error(`processes[${process.id}].nodes 배열이 필요합니다.`)
    }
    if (!Array.isArray(process.edges)) {
      throw new Error(`processes[${process.id}].edges 배열이 필요합니다.`)
    }
  }
}

export function validateImportPayload(payload: unknown): ProcessDataFilePayload {
  const parsed = payload as Partial<ProcessDataFilePayload> & {
    overview?: unknown
    details?: unknown
    commonMasters?: unknown
    processes?: unknown
  }
  if (parsed?.kind !== 'copan-process-navigator-state') {
    throw new Error('지원하지 않는 JSON 형식입니다.')
  }

  if (parsed.version === 2) {
    validateV2Payload(parsed as Parameters<typeof validateV2Payload>[0])
    return parsed as ProcessDataFilePayload
  }

  if (parsed.version === 1) {
    validateV1Overview(parsed as Parameters<typeof validateV1Overview>[0])
    return parsed as ProcessDataFilePayload
  }

  throw new Error('지원하지 않는 JSON 버전입니다. (version 1 또는 2)')
}

export function parseProcessDataFile(content: string): ProcessDataFilePayload {
  return validateImportPayload(JSON.parse(content))
}

export function validatePreExport(data: ProcessData): PreExportValidationResult {
  const summary = summarizeProcessData(data)
  const edges = collectAllEdges(data)

  if (summary.nodeCount === 0) {
    return { ok: false, message: '노드가 없습니다. 저장을 중단합니다.' }
  }
  if (summary.edgeCount === 0) {
    return { ok: false, message: '연결선이 없습니다. 저장을 중단합니다.' }
  }
  if (data.baselineEdgeCount > 0 && summary.edgeCount < data.baselineEdgeCount * 0.7) {
    return {
      ok: false,
      message: '연결선 수가 비정상적으로 감소했습니다. 저장을 중단합니다.',
    }
  }
  const broken = edges.filter((edge) => !edge.source?.trim() || !edge.target?.trim())
  if (broken.length > 0) {
    return {
      ok: false,
      message: `source/target 없는 연결선 ${broken.length}개가 있습니다. 저장을 중단합니다.`,
    }
  }

  return { ok: true, message: '' }
}

function normalizeInstanceForExport(
  data: ProcessData,
  instance: NonNullable<ReturnType<typeof getOverviewInstance>>,
) {
  const resolved = resolveProcessWithMasters(instance, data.commonMasters)
  return {
    ...instance,
    nodes: normalizeProcessNodes(resolved.nodes, resolved),
    edges: normalizeProcessEdges(resolved.edges),
  }
}

export function validateExportedPayload(payload: ProcessDataFilePayload): ExportValidationResult {
  let edges: Edge[] = []
  let nodeCount = 0
  let processCount = 0

  if (payload.version === 2) {
    for (const process of payload.processes) {
      processCount += 1
      nodeCount += process.nodes.filter((node) => node.type !== 'phase-connector').length
      edges.push(...process.edges)
    }
  } else {
    processCount = 1 + Object.keys(payload.details ?? {}).length
    nodeCount = payload.overview.nodes.filter((node) => node.type !== 'phase-connector').length
    edges = [...payload.overview.edges]
    for (const process of Object.values(payload.details ?? {})) {
      nodeCount += process.nodes.filter((node) => node.type !== 'phase-connector').length
      if (process?.edges?.length) edges.push(...process.edges)
    }
  }

  const edgesMissingHandles = edges
    .filter((edge) => !edge.sourceHandle || !edge.targetHandle)
    .map((edge) => edge.id)
  const edgesWithHandles = edges.length - edgesMissingHandles.length
  const ok = edgesMissingHandles.length === 0

  return {
    ok,
    nodeCount,
    edgeCount: edges.length,
    processCount,
    edgesWithHandles,
    edgesMissingHandles,
    message: ok
      ? `검증 완료: Edges ${edges.length}개, handle 포함 ${edgesWithHandles}개`
      : `검증 경고: Edges ${edges.length}개 중 handle 누락 ${edgesMissingHandles.length}개`,
  }
}

export function validateExportedJsonText(jsonText: string): ExportValidationResult {
  return validateExportedPayload(JSON.parse(jsonText) as ProcessDataFilePayload)
}

export function buildExportSummaryLog(data: ProcessData) {
  const exportData = cloneProcessData(data)
  const summary = summarizeProcessData(exportData)
  return {
    nodes: summary.nodeCount,
    edges: summary.edgeCount,
    processes: summary.processCount,
    updatedAt: exportData.updatedAt,
    updatedAtLabel: formatTimestamp(exportData.updatedAt),
  }
}

export function downloadProcessDataJson(data: ProcessData): string {
  const exportedAt = new Date().toISOString()
  const payload = processDataToFilePayload({
    ...data,
    updatedAt: exportedAt,
    processes: data.processes.map((instance) =>
      normalizeInstanceForExport(data, instance),
    ),
  })
  const jsonText = JSON.stringify(payload, null, 2)

  console.log('EXPORT SUMMARY', buildExportSummaryLog({ ...data, updatedAt: exportedAt }))

  const date = exportedAt.slice(0, 10)
  const blob = new Blob([jsonText], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `process-navigator-state-${date}.json`
  anchor.click()
  URL.revokeObjectURL(url)

  return jsonText
}
