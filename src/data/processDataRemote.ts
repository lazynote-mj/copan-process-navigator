import {
  filePayloadToProcessData,
  processDataToFilePayload,
  validateImportPayload,
  validatePreExport,
  type ProcessDataFilePayload,
} from './processDataIO'
import { summarizeProcessData, type ProcessData } from '../types/processData'

export const REMOTE_STATE_URL = '/process-data/state.json'
export const REMOTE_SAVE_URL = '/api/process-data'

export async function loadRemoteProcessData(): Promise<ProcessData | null> {
  const response = await fetch(`${REMOTE_STATE_URL}?t=${Date.now()}`, { cache: 'no-store' })
  if (response.status === 404) return null
  if (!response.ok) {
    throw new Error(`데이터를 불러오지 못했습니다. (${response.status})`)
  }

  const payload = validateImportPayload((await response.json()) as ProcessDataFilePayload)
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
