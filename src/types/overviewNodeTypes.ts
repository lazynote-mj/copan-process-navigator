/**
 * Overview TO-BE PDF 하단 범례 (Docs/06. TO-BE overview.pdf)
 * Detail `nodeTypes.ts`와 별도 — Overview 캔버스 표시·편집용.
 *
 * PDF 범례 7종 + layout 전용(연결점, connector)
 */
export const OVERVIEW_NODE_TYPES = [
  /** 활동(ERP) — 파란 사각형 */
  'erp',
  /** 활동(WMS&OMS) — 주황, 이지어드민·WMS·OMS */
  'wms-oms',
  /** 활동(POS) — 노란, 이지체인·POS·매장 */
  'pos',
  /** 활동(수작업) — 회색 */
  'manual',
  /** 결재진행(G/W) & 구분 — 빨간 마름모 */
  'decision',
  /** 연결프로세스 — 보라, Detail 프로세스 허브 */
  'linked-process',
  /** API 연동 활동 */
  'api',
  /** 연결점 — lane 경계 Rule badge (PDF: 연결점) */
  'connection-point',
  /** split/merge layout */
  'connector',
] as const

export type OverviewNodeType = (typeof OVERVIEW_NODE_TYPES)[number]

export type OverviewNodeTypeMeta = {
  id: OverviewNodeType
  /** Property panel / legend label */
  label: string
  description: string
  /** PDF 범례 부제 — 2행 표기 기본값 */
  defaultSubtitle?: string
  /** 노드명 뒤 괄호 — PDF (AUTO) 등은 type=system에서 별도 처리 */
  displaySuffix?: string
  appendSuffixToName: boolean
  dashedBorder?: boolean
}

/** PDF 하단 범례 */
export const OVERVIEW_NODE_TYPE_META: Record<OverviewNodeType, OverviewNodeTypeMeta> = {
  erp: {
    id: 'erp',
    label: '활동(ERP)',
    description: 'ERP 등록·조회·확정 업무',
    defaultSubtitle: 'ERP',
    appendSuffixToName: false,
  },
  'wms-oms': {
    id: 'wms-oms',
    label: '활동(WMS&OMS)',
    description: '물류센터·이지어드민·WMS·OMS 업무',
    defaultSubtitle: '이지어드민',
    appendSuffixToName: false,
  },
  pos: {
    id: 'pos',
    label: '활동(POS)',
    description: '판매현장·이지체인·POS·매장 업무',
    defaultSubtitle: '이지체인, POS',
    appendSuffixToName: false,
  },
  manual: {
    id: 'manual',
    label: '활동(수작업)',
    description: '시스템 외부 수작업',
    appendSuffixToName: false,
  },
  decision: {
    id: 'decision',
    label: '결재/구분',
    description: '결재진행(G/W) 및 Y/N·신규/기존 분기',
    defaultSubtitle: 'groupware',
    appendSuffixToName: false,
  },
  'linked-process': {
    id: 'linked-process',
    label: '연결프로세스',
    description: 'Detail 프로세스로 연결되는 허브 노드',
    appendSuffixToName: false,
  },
  api: {
    id: 'api',
    label: 'API',
    description: '시스템 간 API·데이터 연동',
    defaultSubtitle: 'API',
    dashedBorder: true,
    appendSuffixToName: false,
  },
  'connection-point': {
    id: 'connection-point',
    label: '연결점',
    description: '연동 구간 자동 판단 (lane 경계)',
    dashedBorder: true,
    appendSuffixToName: false,
  },
  connector: {
    id: 'connector',
    label: 'Connector',
    description: 'Split/Merge 분기·합류',
    appendSuffixToName: false,
  },
}

import type { NodeType } from './nodeTypes'

export type OverviewNodeInferInput = {
  type: NodeType | string
  system?: string
  laneId?: string
  detailProcessIds?: string[]
  id?: string
  /** registry fallback — linked-process 판별 */
  hasLinkedDetailProcesses?: boolean
}

const POS_LANE = 'retail-easychain'
const WMS_LANE = 'warehouse-easyadmin'

function normSystem(system?: string): string {
  return (system ?? '').trim().toLowerCase()
}

function isCrossSystemFlow(system: string): boolean {
  return system.includes('→') || system.includes('↔') || system.includes('api')
}

function isPosContext(system: string, laneId?: string): boolean {
  if (laneId === POS_LANE) return true
  return (
    system.includes('pos') ||
    system.includes('이지체인') ||
    system.includes('easychain') ||
    system.includes('매장')
  )
}

function isWmsOmsContext(system: string, laneId?: string): boolean {
  if (laneId === WMS_LANE) return true
  return (
    system.includes('wms') ||
    system.includes('oms') ||
    system.includes('이지어드민') ||
    system.includes('easyadmin')
  )
}

/** Detail type + lane/system → Overview PDF 범례 타입 */
export function inferOverviewNodeType(input: OverviewNodeInferInput): OverviewNodeType {
  const { type, system, laneId, detailProcessIds, hasLinkedDetailProcesses } = input
  const sys = normSystem(system)

  if (type === 'interface-rule') return 'connection-point'
  if (type === 'connector' || type === 'merge') return 'connector'

  if (detailProcessIds?.length || hasLinkedDetailProcesses) {
    return 'linked-process'
  }

  if (type === 'decision' || type === 'approval' || type === 'document') {
    return 'decision'
  }
  if (type === 'manual') return 'manual'

  if (type === 'api' || (type === 'interface' && sys.includes('api'))) {
    return 'api'
  }

  if (type === 'interface' && isCrossSystemFlow(sys)) {
    return 'api'
  }

  if (isPosContext(sys, laneId)) {
    if (type === 'external') return 'pos'
    if (type === 'interface' && isCrossSystemFlow(sys)) return 'api'
    return 'pos'
  }

  if (isWmsOmsContext(sys, laneId)) {
    if (type === 'system' && isCrossSystemFlow(sys)) return 'api'
    if (type === 'interface') return sys.includes('api') ? 'api' : 'wms-oms'
    return 'wms-oms'
  }

  if (type === 'system') {
    if (isCrossSystemFlow(sys)) return 'api'
    if (isPosContext(sys, laneId)) return 'pos'
    if (isWmsOmsContext(sys, laneId)) return 'wms-oms'
    return 'erp'
  }

  if (type === 'interface') return 'api'
  if (type === 'external') return 'pos'
  if (type === 'exception') return 'erp'

  if (OVERVIEW_NODE_TYPES.includes(type as OverviewNodeType)) {
    return type as OverviewNodeType
  }

  return 'erp'
}

/** Overview type → Detail layout/routing type */
export function overviewTypeToDetailType(overviewType: OverviewNodeType): NodeType {
  switch (overviewType) {
    case 'connection-point':
      return 'interface-rule'
    case 'connector':
      return 'connector'
    case 'api':
      return 'interface'
    case 'linked-process':
      return 'erp'
    case 'wms-oms':
    case 'pos':
      return 'erp'
    default:
      return overviewType as NodeType
  }
}

export function getOverviewNodeTypeLabel(type: OverviewNodeType | string): string {
  return OVERVIEW_NODE_TYPE_META[type as OverviewNodeType]?.label ?? type
}

export function resolveOverviewVisualClass(overviewType: OverviewNodeType, _system?: string): string {
  switch (overviewType) {
    case 'manual':
      return 'manual'
    case 'decision':
      return 'decision'
    case 'erp':
      return 'erp'
    case 'wms-oms':
      return 'wms-oms'
    case 'pos':
      return 'pos'
    case 'linked-process':
      return 'linked-process'
    case 'api':
      return 'api'
    case 'connection-point':
      return 'connection-point'
    case 'connector':
      return 'connector'
    default:
      return 'erp'
  }
}

/** PDF (AUTO) — detail type=system 자동 처리 노드 */
export function shouldAppendAutoSuffix(type: string): boolean {
  return type === 'system'
}
