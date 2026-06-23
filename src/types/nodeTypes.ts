/** Detail 프로세스 Node Type — Overview는 overviewNodeTypes.ts 참조 */
export const NODE_TYPES = [
  'manual',
  'erp',
  'wms-oms',
  'pos',
  'approval',
  'decision',
  'system',
  'interface',
  'interface-rule',
  'linked-process',
  'external',
  'exception',
  'connector',
  'merge',
  'phase-connector',
  'api',
  'database',
  'document',
] as const

export type NodeType = (typeof NODE_TYPES)[number]

export const DEFAULT_NODE_TYPE: NodeType = 'erp'

/** 사용자 편집 패널에 노출하는 Detail 노드 타입 */
export const EDITABLE_DETAIL_NODE_TYPES = [
  'erp',
  'wms-oms',
  'pos',
  'manual',
  'approval',
  'decision',
  'database',
  'system',
  'interface',
  'interface-rule',
  'linked-process',
  'external',
  'exception',
] as const satisfies readonly NodeType[]

export type NodeTypeMeta = {
  id: NodeType
  label: string
  description: string
  dashedBorder?: boolean
}

export const NODE_TYPE_META: Record<NodeType, NodeTypeMeta> = {
  manual: {
    id: 'manual',
    label: '수작업',
    description: '시스템 외부에서 사람이 판단/확인/수행하는 업무',
  },
  erp: {
    id: 'erp',
    label: 'ERP 활동',
    description: 'ERP에서 입력, 등록, 조회, 확정하는 업무',
  },
  'wms-oms': {
    id: 'wms-oms',
    label: 'WMS/OMS 활동',
    description: '물류센터, 이지어드민, WMS, OMS에서 수행하는 업무',
  },
  pos: {
    id: 'pos',
    label: 'POS 활동',
    description: '판매현장, 이지체인, POS, 매장에서 수행하는 업무',
  },
  approval: {
    id: 'approval',
    label: '결재/품의',
    description: '그룹웨어 결재 또는 승인 절차',
  },
  decision: {
    id: 'decision',
    label: '판단/분기',
    description: 'Y/N 또는 조건 판단이 필요한 분기 노드',
  },
  system: {
    id: 'system',
    label: '시스템 자동처리',
    description: 'ERP 또는 시스템 내부에서 자동 생성/처리되는 노드',
  },
  interface: {
    id: 'interface',
    label: '시스템 연동/API',
    description: 'ERP, WMS, OMS, POS, 온라인몰 간 API 또는 데이터 연동',
    dashedBorder: true,
  },
  'interface-rule': {
    id: 'interface-rule',
    label: 'Interface Rule',
    description: '시스템 연동 구간의 자동 판단 조건 (Overview: Lane 경계 Rule Badge)',
    dashedBorder: true,
  },
  'linked-process': {
    id: 'linked-process',
    label: '연결프로세스',
    description: '별도 상세 프로세스로 이어지는 참조 노드',
  },
  external: {
    id: 'external',
    label: '외부/상대방 처리',
    description: '협력업체, PG사, B2B 수출 등 외부 주체와 연결되는 노드',
  },
  exception: {
    id: 'exception',
    label: '예외처리',
    description: '수량 불일치, 보류, 예외 대응, 재처리',
    dashedBorder: true,
  },
  connector: {
    id: 'connector',
    label: 'Connector',
    description: 'Split/Merge 분기·합류 연결점',
  },
  merge: {
    id: 'merge',
    label: '합류',
    description: '병렬 분기 완료 후 단일 흐름으로 합류하는 지점',
  },
  'phase-connector': {
    id: 'phase-connector',
    label: 'Phase 연결',
    description: 'Overview End-to-End phase 전환 connector (layout 전용)',
  },
  api: {
    id: 'api',
    label: 'API 연동',
    description: '시스템 간 API 연동',
    dashedBorder: true,
  },
  database: {
    id: 'database',
    label: 'DB / 저장소',
    description: '시스템 데이터 저장소',
  },
  document: {
    id: 'document',
    label: '문서 / 증빙',
    description: '출력물·증빙 문서',
  },
}

const LEGACY_TYPE_MAP: Record<string, NodeType> = {
  process: 'erp',
  approval: 'approval',
  system: 'system',
  decision: 'decision',
}

export function normalizeNodeType(type: string, system?: string): NodeType {
  if (type === 'phase-connector' || type === 'section-connector') {
    return 'phase-connector'
  }
  if (type === 'merge') {
    return 'connector'
  }
  if (type === 'connector') {
    return 'connector'
  }
  if (type === 'api' || type === 'database' || type === 'document') {
    return type as NodeType
  }

  if (NODE_TYPES.includes(type as NodeType)) {
    return type as NodeType
  }

  if (type === 'process') {
    const sys = (system ?? '').toLowerCase()
    if (sys === 'manual' || sys.includes('수작업')) {
      return 'manual'
    }
    return 'erp'
  }

  return LEGACY_TYPE_MAP[type] ?? DEFAULT_NODE_TYPE
}

export function getNodeTypeLabel(type: NodeType | string): string {
  const meta = NODE_TYPE_META[type as NodeType]
  return meta?.label ?? type
}

/** Detail view 노드 색상 — type + system 기반 */
export function resolveNodeVisualClass(type: NodeType, system?: string): string {
  const sys = (system ?? '').toLowerCase()
  if (type === 'manual') return 'manual'
  if (type === 'wms-oms') return 'wms-oms'
  if (type === 'pos') return 'pos'
  if (type === 'linked-process') return 'linked-process'
  if (type === 'approval' || type === 'document') return type === 'document' ? 'document' : 'approval'
  if (type === 'interface' || type === 'api') {
    if (type === 'api') return 'api'
    if (sys === 'api' || sys.includes('api')) return 'api'
    return 'interface'
  }
  if (type === 'database') return 'database'
  if (type === 'erp') return 'erp'
  if (type === 'system') {
    if (sys.includes('이지어드민') || sys.includes('easyadmin')) return 'system-easyadmin'
    if (sys.includes('이지체인') || sys.includes('easychain')) return 'system-easychain'
    if (sys.includes('erp')) return 'system-erp'
    return 'system'
  }
  return type
}

export const SYSTEM_LIKE_NODE_TYPES = new Set<NodeType>(['system', 'interface', 'api', 'database'])

export function isSystemLikeNodeType(type: NodeType | string): boolean {
  return SYSTEM_LIKE_NODE_TYPES.has(type as NodeType)
}

export const NODE_TYPE_COLORS: Record<NodeType, string> = {
  manual: '#94a3b8',
  erp: '#3b82f6',
  'wms-oms': '#f97316',
  pos: '#eab308',
  approval: '#8b5cf6',
  decision: '#f59e0b',
  system: '#10b981',
  interface: '#14b8a6',
  'interface-rule': '#0d9488',
  'linked-process': '#7c3aed',
  external: '#475569',
  exception: '#f472b6',
  connector: '#64748b',
  merge: '#64748b',
  'phase-connector': '#cbd5e1',
  api: '#0d9488',
  database: '#0369a1',
  document: '#a855f7',
}
