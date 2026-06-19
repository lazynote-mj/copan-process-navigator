import { summarizeProcessData, type ProcessData } from '../types/processData'

export type WorkingStateSummary = {
  nodeCount: number
  edgeCount: number
  laneCount: number
  processCount: number
  lastModifiedAt: string
  lastModifiedLabel: string
}

export function summarizeFromProcessData(data: ProcessData): WorkingStateSummary {
  const summary = summarizeProcessData(data)
  return {
    nodeCount: summary.nodeCount,
    edgeCount: summary.edgeCount,
    laneCount: data.commonMasters.lanes.length,
    processCount: summary.processCount,
    lastModifiedAt: data.updatedAt,
    lastModifiedLabel: formatTimestamp(data.updatedAt),
  }
}

export function formatTimestamp(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export type { ExportValidationResult } from './processDataIO'
