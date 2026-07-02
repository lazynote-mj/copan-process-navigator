import type { NodeType } from './nodeTypes'
export {
  NODE_TYPES,
  EDITABLE_DETAIL_NODE_TYPES,
  DEFAULT_NODE_TYPE,
  NODE_TYPE_META,
  normalizeNodeType,
  getNodeTypeLabel,
  getDefaultSystemForNodeType,
  isSystemLikeNodeType,
  NODE_TYPE_COLORS,
} from './nodeTypes'
export {
  EDGE_TYPES,
  DEFAULT_EDGE_TYPE,
  resolveEdgeType,
  normalizeEdgeType,
  buildEdgeStrokeStyle,
  buildEdgeMarkerColor,
  isReturnEdgeType,
} from './edgeTypes'
export type { EdgeType } from './edgeTypes'
export type { NodeType } from './nodeTypes'
export type { OverviewNodeType } from './overviewNodeTypes'
export {
  OVERVIEW_NODE_TYPES,
  OVERVIEW_NODE_TYPE_META,
  inferOverviewNodeType,
  overviewTypeToDetailType,
  getOverviewNodeTypeLabel,
  resolveOverviewVisualClass,
} from './overviewNodeTypes'

/** @deprecated process.ts에서 직접 import — nodeTypes.ts 참조 */

/** 프로세스 상태 */
export const PROCESS_STATUSES = ['draft', 'review', 'approved'] as const
export type ProcessStatus = (typeof PROCESS_STATUSES)[number]

export const NODE_REVIEW_STATUSES = ['not-reviewed', 'ok', 'review-required'] as const
export type NodeReviewStatus = (typeof NODE_REVIEW_STATUSES)[number]
export const NODE_REVIEWERS = ['김민정', '김은영', '박정웅'] as const
export type NodeReviewer = (typeof NODE_REVIEWERS)[number]

export type NodeReview = {
  status: NodeReviewStatus
  reviewer?: NodeReviewer | string
  comment?: string
  reviewedAt?: string
}

/**
 * 향후 { id, name, type } 구조로 확장 예정.
 * 현재는 string[] 로 관리한다.
 */
export type ProcessArtifact = string
export type NodeInputs = ProcessArtifact[]
export type NodeOutputs = ProcessArtifact[]
export type NodeControls = ProcessArtifact[]

/** 프로세스 단계 정의 — 화면 표시(label)와 내부 식별(id/order) 분리 */
export type Phase = {
  id: string
  label: string
  order: number
  /** Phase row 높이 (px). 미지정 시 layout engine 기본값 */
  height?: number
}

/** 스윔레인 = 담당 부서/역할 영역 (Lane) */
export type Lane = {
  id: string
  name: string
  order: number
  ownerDepartment: string
  description?: string
  /** 담당 시스템 (Master Data) */
  system?: string
  /** Lane column 폭 (px). 미지정 시 layout engine 기본값 */
  width?: number
}

/** Overview Cross-Functional 업무 Zone (고정 grid row) — node.processZone */
export type ProcessZoneId =
  | 'business-contract'
  | 'purchase-order'
  | 'inbound-inventory'
  | 'sales-shipment'
  | 'return-movement'
  | 'settlement-close'

/** Process Zone (Group Area) — 노드 묶음 시각화 (Lane/Phase/grid와 독립) */
export type ProcessZoneStyle = {
  showBackground?: boolean
  showBorder?: boolean
  borderStyle?: 'dashed' | 'solid'
  visible?: boolean
  opacity?: number
  fill?: string
  stroke?: string
  /** Zone border padding X (px) — node 위치에 영향 없음 */
  paddingX?: number
  /** Zone 상단 header 영역 높이 (px) */
  headerHeight?: number
  /** Zone 하단 padding (px) */
  paddingBottom?: number
  /** Zone 이름 표시 위치 */
  labelPosition?: 'top' | 'bottom' | 'left' | 'right' | 'hidden'
  /** @deprecated headerHeight / paddingBottom 사용 */
  paddingY?: number
}

export type ProcessZone = {
  id: string
  name: string
  type: 'process-zone'
  laneIds: string[]
  phaseIds: string[]
  nodeIds: string[]
  style: ProcessZoneStyle
}

export type Node = {
  id: string
  name: string
  type: NodeType
  /** Overview PDF 범례 타입 — Overview 캔버스 전용 (미지정 시 type에서 추론) */
  overviewType?: import('./overviewNodeTypes').OverviewNodeType
  laneId: string
  phaseId: string
  /** 왼쪽 → 오른쪽 업무 진행 순서 (전역 단계 설명/필터용) */
  phaseOrder?: number
  /** 스윔레인 내 좌→우 배치 순서 (Detail layout X축) */
  localOrder?: number
  /** @deprecated legacy 수동 번호. Detail 원형 번호는 렌더링 시 Flow Execution Order 기준으로 자동 계산 */
  stepBadge?: number
  /** Overview Cross-Functional Y축 업무 Zone */
  processZone?: ProcessZoneId
  /** Cell 내부 업무 흐름 순서 (edge 순서 판단) */
  cellOrder?: number
  /** Cell 내부 표시 slot (1~10, layout 배치). 미지정 시 cellOrder 순으로 자동 부여 */
  cellSlot?: number
  /** Process Detail 가로형 전용 수동 배치 (1-based column/row). Overview cellSlot과 분리 */
  detailLayout?: {
    column?: number
    row?: number
  }
  /** @deprecated Overview는 cellOrder 사용 — 하위 호환 */
  zoneOrder?: number
  /** @deprecated Overview는 processZone 사용 */
  globalStep?: number
  system: string
  owner: string
  description: string
  inputs: NodeInputs
  outputs: NodeOutputs
  controls: NodeControls
  /** Overview 대표 노드 → 연결된 Detail Process id 목록 */
  detailProcessIds?: string[]
  /** Interface Rule — Lane 경계 배치 (Overview) */
  interfaceRuleAnchor?: {
    fromLaneId: string
    toLaneId: string
  }
  /** Connector — split(분기) / merge(합류) */
  connectorSubType?: import('./connectorTypes').ConnectorSubType
  /** 업무 역할 (Master Data) */
  role?: string
  /** business = 업무 보기, system = 시스템 보기 전용 */
  displayLevel?: 'business' | 'system'
  /** cellSlot 기준 미세 위치 조정 (layout 계산 후 적용) */
  offsetX?: number
  offsetY?: number
  /** Builder Review Mode — Internal Review metadata */
  review?: NodeReview
}

/** 노드 handle — edge 연결점 (사면 중앙) */
export type EdgeHandleId = 'top' | 'right' | 'bottom' | 'left'

export type EdgeRoutingPoint = { x: number; y: number }

/** Edge label 수동 배치 — route 재계산과 분리해서 저장 */
export type EdgeLabelPlacement = {
  /** 라우터가 계산한 기본 라벨 위치 기준 offset */
  offset?: EdgeRoutingPoint
  /** @deprecated 이전 절대 좌표 저장값 */
  point?: EdgeRoutingPoint
}

/** Edge 경로 편집 설정 — node 좌표는 저장하지 않음 */
export type EdgeRoutingConfig = {
  mode: 'auto' | 'manual'
  points?: EdgeRoutingPoint[]
  sourceHandle?: EdgeHandleId
  targetHandle?: EdgeHandleId
  /** 패널에서 handle을 명시 지정했을 때 auto router override 방지 */
  handlesLocked?: boolean
  /** true면 geometry 기반 handle 자동 선택 (handlesLocked와 반대) */
  handleAuto?: boolean
  /** collision으로 auto reroute 발생 시 표시 */
  status?: 'reroutedDueToCollision'
}

/** Edge 확장 data — React Flow / 라우터 런타임 값 (선택적 persist) */
export type EdgeData = Record<string, unknown>

/** 노드 간 연결 (Edge) — type은 node type과 독립 */
export type Edge = {
  id: string
  source: string
  target: string
  /** 분기 조건 식별자. 무조건 흐름은 "" */
  condition: string
  /** 화면 표시용 라벨 */
  label: string
  /** 라벨 수동 위치 */
  labelPlacement?: EdgeLabelPlacement
  /** normal | system | condition | exception | return — edge 스타일·라우팅 */
  type?: import('./edgeTypes').EdgeType | string
  /** 출발 노드 연결면 (사용자 지정 시 router 우선) */
  sourceHandle?: EdgeHandleId
  /** 도착 노드 연결면 (사용자 지정 시 router 우선) */
  targetHandle?: EdgeHandleId
  /** orthogonal edge routing (auto / manual bend points) */
  routing?: EdgeRoutingConfig
  /** true면 저장된 bend/path를 router가 재계산하지 않음 */
  manualRoute?: boolean
  /** 수동 bend 중간점 (routing.points와 동일 의미, JSON 호환) */
  bendPoints?: EdgeRoutingPoint[]
  /** 수동 경로 중간점 (legacy/호환) */
  points?: EdgeRoutingPoint[]
  /** 표시 전용 연결선 (virtual/reference) */
  displayOnly?: boolean
  /** 업무 보기 runtime derived bridge — JSON 저장 금지 */
  isDerived?: boolean
  /** 라우팅 우선순위 (낮을수록 우선, 병렬 edge 정렬) */
  priority?: number
  /** Process Group / 필터 뷰 식별 */
  processGroupId?: string
  /** 확장 메타 — export 시 보존 */
  data?: EdgeData
  processId?: string
  visibleInOverview?: boolean
  detailOnly?: boolean
}

/** ERP TO-BE 프로세스 전체 데이터 */
export type Process = {
  id: string
  name: string
  description: string
  version: string
  status: ProcessStatus
  lastModified: string
  owner: string
  phases: Phase[]
  lanes: Lane[]
  nodes: Node[]
  edges: Edge[]
  /** Process Zone (Group Area) — 노드 묶음 시각적 강조 */
  zones?: ProcessZone[]
  /** SCM TO-BE 등 원천 식별 */
  source?: string
  /** Overview 대표 노드 id */
  overviewNodeId?: string
}

/** 프로세스 목록용 요약 정보 */
export type ProcessSummary = Pick<
  Process,
  'id' | 'name' | 'description' | 'version' | 'status' | 'owner'
>

export function getPhaseById(process: Process, phaseId: string): Phase | undefined {
  return process.phases.find((p) => p.id === phaseId)
}

export function getSortedPhases(process: Process): Phase[] {
  return [...process.phases].sort((a, b) => a.order - b.order)
}

export function getLaneById(process: Process, laneId: string): Lane | undefined {
  return process.lanes.find((l) => l.id === laneId)
}

export function getNodeById(process: Process, nodeId: string): Node | undefined {
  return process.nodes.find((n) => n.id === nodeId)
}

export function getEdgeById(process: Process, edgeId: string): Edge | undefined {
  return process.edges.find((e) => e.id === edgeId)
}

/** Focus View용 — 특정 phaseId에 속한 노드 목록 */
export function getNodesByPhaseId(process: Process, phaseId: string): Node[] {
  return process.nodes.filter((n) => n.phaseId === phaseId)
}

export function getPhaseLabel(process: Process, phaseId: string): string {
  return getPhaseById(process, phaseId)?.label ?? phaseId
}

export function getPhaseByOrder(process: Process, order: number): Phase | undefined {
  return process.phases.find((p) => p.order === order)
}
