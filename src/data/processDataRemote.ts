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
/** Phase 2A.2 — optimistic concurrency 토큰 헤더. */
export const BASE_REVISION_HEADER = 'X-Base-Revision'

/** 서버가 먼저 저장했을 때(409) 던지는 식별 가능한 에러. */
export class SaveConflictError extends Error {
  readonly conflict = true
  readonly currentRevision?: number
  constructor(message: string, currentRevision?: number) {
    super(message)
    this.name = 'SaveConflictError'
    this.currentRevision = currentRevision
  }
}

/**
 * Phase 2A.2 — 클라이언트가 로드한 concurrency 토큰(revision)을 세션 메모리에 보존한다.
 * - local runtime 파일에서 로드: 파일의 revision(없으면 0=legacy 로컬 파일).
 * - 시드(state.json)에서 로드 또는 파일 없음: null = bootstrap(첫 저장).
 * 저장 성공 시 서버가 반환한 새 revision으로 교체한다.
 */
let loadedRevision: number | null = null

/** 테스트/디버그용 — 현재 보존된 base revision. */
export function getLoadedRevision(): number | null {
  return loadedRevision
}

function readRevision(payload: ProcessDataFilePayload): number | null {
  const value = (payload as { revision?: unknown }).revision
  return typeof value === 'number' && Number.isInteger(value) ? value : null
}

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
  const local = await fetchProcessDataPayload(REMOTE_LOCAL_STATE_URL)
  if (local) {
    // local 파일: revision을 토큰으로 보존(없으면 0 = Phase 2A.1 legacy 파일).
    loadedRevision = readRevision(local) ?? 0
    return filePayloadToProcessData(local, 'server-json')
  }

  const seed = await fetchProcessDataPayload(REMOTE_STATE_URL)
  if (seed) {
    // 시드에서 로드 → 아직 local runtime 파일이 없음 → 첫 저장은 bootstrap.
    loadedRevision = null
    return filePayloadToProcessData(seed, 'server-json')
  }

  loadedRevision = null
  return null
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

  // Phase 2A.2 — 로드 시점 토큰을 함께 보낸다. bootstrap(null)이면 헤더를 생략한다.
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (loadedRevision !== null) {
    headers[BASE_REVISION_HEADER] = String(loadedRevision)
  }

  const response = await fetch(REMOTE_SAVE_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload, null, 2),
  })

  if (response.status === 409) {
    // stale write — 서버가 파일을 덮어쓰지 않았다. 조용히 재시도하지 않고 명확히 표면화한다.
    const info = (await response.json().catch(() => ({}))) as {
      message?: string
      currentRevision?: number
    }
    throw new SaveConflictError(
      info.message ??
        '다른 세션이 이미 저장했습니다. 최신 데이터를 다시 불러온 뒤 저장하세요.',
      info.currentRevision,
    )
  }

  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || '서버 저장에 실패했습니다. dev 서버(npm run dev)에서 실행 중인지 확인하세요.')
  }

  // 저장 성공 → 서버가 발급한 새 토큰으로 교체한다.
  const result = (await response.json().catch(() => ({}))) as { revision?: number }
  if (typeof result.revision === 'number') {
    loadedRevision = result.revision
  }

  return {
    ...data,
    updatedAt: exportedAt,
    dataSource: 'server-json',
    dirty: false,
  }
}
