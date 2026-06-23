import type { Edge, Node } from '../types/process'
import { resolveEdgeType } from '../types/edgeTypes'

/** PDF Overview 연결선 라벨 — Property Panel 프리셋 */
export const OVERVIEW_EDGE_LABEL_PRESETS = [
  'Y',
  'N',
  '신규',
  '기존',
  'ERP',
  'API',
  '재고인식(+)',
  '재고인식(-)',
  '(ERP→WMS)',
  '(WMS→ERP)',
  '(POS→ERP)',
  '(온라인몰→OMS)',
  'API 연동',
] as const

export type OverviewEdgeLabelPreset = (typeof OVERVIEW_EDGE_LABEL_PRESETS)[number]

/** system 필드 → PDF 괄호 라벨 */
export function systemToFlowLabel(system?: string): string | undefined {
  const raw = system?.trim()
  if (!raw) return undefined

  const normalized = raw
    .replace(/\s+/g, '')
    .replace(/API/gi, 'API')
    .replace(/→/g, '→')

  const pairs: [RegExp, string][] = [
    [/erp→wms/i, '(ERP→WMS)'],
    [/wms→erp/i, '(WMS→ERP)'],
    [/pos→erp|이지체인→erp/i, '(POS→ERP)'],
    [/온라인몰→oms|cafe24.*oms/i, '(온라인몰→OMS)'],
    [/omsapi|oms\s*api/i, 'API'],
  ]

  for (const [pattern, label] of pairs) {
    if (pattern.test(normalized) || pattern.test(raw)) return label
  }

  if (/api/i.test(raw)) return 'API'
  if (/^erp$/i.test(raw)) return 'ERP'

  if (raw.includes('→') || raw.includes('↔')) {
    return `(${raw.replace(/\s*API\s*/gi, ' ').trim()})`
  }

  return undefined
}

/** Overview system/integration edge — PDF 라벨 추론 */
export function inferOverviewEdgeLabel(
  edge: Edge,
  source?: Pick<Node, 'type' | 'system' | 'name'>,
  target?: Pick<Node, 'type' | 'system' | 'name'>,
): string | undefined {
  const existing = edge.label?.trim()
  if (existing) return existing

  const edgeType = resolveEdgeType(edge)
  if (edgeType === 'condition') return undefined

  const fromSource = systemToFlowLabel(source?.system)
  if (fromSource) return fromSource

  if (source?.type === 'interface' || source?.type === 'api') {
    return systemToFlowLabel(source.system) ?? 'API'
  }

  if (edgeType === 'system' || edgeType === 'api') {
    return systemToFlowLabel(source?.system) ?? 'API'
  }

  if (target && source) {
    const srcSys = (source.system ?? '').toLowerCase()
    const tgtSys = (target.system ?? '').toLowerCase()
    if (srcSys.includes('erp') && tgtSys.includes('wms')) return '(ERP→WMS)'
    if (srcSys.includes('wms') && tgtSys.includes('erp')) return '(WMS→ERP)'
  }

  return undefined
}

/** 저장용 — condition 분기는 label 유지, integration edge만 보강 */
export function enrichOverviewEdgeLabel(
  edge: Edge,
  source?: Node,
  target?: Node,
): Edge {
  if (edge.label?.trim()) return edge
  const condition = edge.condition?.trim()
  if (condition) {
    const condLabels: Record<string, string> = {
      newProduct: '신규',
      existingProduct: '기존',
      newVendor: '신규',
      existingVendor: '기존',
      approved: 'Y',
      rejected: 'N',
      mgDeduct: 'Y',
      noMgDeduct: 'N',
      settlementAnomaly: 'Y',
      noSettlementAnomaly: 'N',
    }
    if (condLabels[condition]) {
      return { ...edge, label: condLabels[condition] }
    }
  }

  const inferred = inferOverviewEdgeLabel(edge, source, target)
  if (!inferred) return edge
  return { ...edge, label: inferred }
}
