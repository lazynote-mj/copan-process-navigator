import {
  filePayloadToProcessData,
  processDataToFilePayload,
  validateImportPayload,
  validatePreExport,
  type ProcessDataFilePayload,
} from './processDataIO'
import { summarizeProcessData, type ProcessData } from '../types/processData'

/** 커밋된 시드 / published sample (fallback 전용, 앱이 write하지 않음). */
export const REMOTE_STATE_URL = '/process-data/state.json'
/** Phase 2A.1 — dev-local runtime 파일 (편집 대상, untracked). */
export const REMOTE_LOCAL_STATE_URL = '/process-data/state.local.json'
export const REMOTE_SAVE_URL = '/api/process-data'

/**
 * 단일 URL에서 payload를 읽는다.
 * - 404: 파일 없음 → null (fallback 신호)
 * - 비-JSON 응답(SPA fallback으로 index.html 등): 없음으로 간주 → null
 * - 그 외 비정상 상태: throw
 */
async function fetchProcessDataPayload(url: string): Promise<ProcessDataFilePayload | null> {
  const response = await fetch(`${url}?t=${Date.now()}`, { cache: 'no-store' })
  if (response.status === 404) return null
  if (!response.ok) {
    throw new Error(`데이터를 불러오지 못했습니다. (${response.status})`)
  }
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.includes('json')) return null
  return validateImportPayload((await response.json()) as ProcessDataFilePayload)
}

export async function loadRemoteProcessData(): Promise<ProcessData | null> {
  // Phase 2A.1 — dev-local runtime 파일을 우선 로드하고, 없으면 커밋 시드로 fallback한다.
  // 시드는 앱이 write하지 않으므로 fresh 체크아웃은 기존과 동일하게 시드를 로드한다.
  const payload =
    (await fetchProcessDataPayload(REMOTE_LOCAL_STATE_URL)) ??
    (await fetchProcessDataPayload(REMOTE_STATE_URL))
  if (!payload) return null
  return filePayloadToProcessData(payload, 'server-json')
}

export async function saveRemoteProcessData(data: ProcessData): Promise<ProcessData> {
  const preCheck = validatePreExport(data)
  if (!preCheck.ok) {
    throw new Error(preCheck.message)
  }

  const exportedAt = new Date().toISOString()
  const payload = processDataToFilePayload({ ...data, updatedAt: exportedAt })
  const totals = summarizeProcessData(data)

  console.log('EXPORT SUMMARY', {
    nodes: totals.nodeCount,
    edges: totals.edgeCount,
    processes: totals.processCount,
    updatedAt: exportedAt,
  })

  const response = await fetch(REMOTE_SAVE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload, null, 2),
  })

  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || '서버 저장에 실패했습니다. dev 서버(npm run dev)에서 실행 중인지 확인하세요.')
  }

  return {
    ...data,
    updatedAt: exportedAt,
    dataSource: 'server-json',
    dirty: false,
  }
}
