/**
 * Governance Layer 타입 모델 (WP2.1 · ADR-007).
 *
 * Data-first Approval: 업무/마스터 데이터 → 구조화 레코드 → (레코드에 대한) 승인 → 문서 산출물.
 * 승인 대상은 문서가 아니라 구조화된 데이터 레코드다. DocumentArtifact는 승인 이후 생성되는 산출물이다.
 * GovernanceRule/ApprovalPolicy는 정책·규칙 메타데이터이며, 평가·실행 로직(엔진)이 아니다.
 *
 * 본 파일은 구조(타입)만 정의한다 — 런타임 동작·검증·resolver·문서 생성은 후속 WP2.2~2.4의 몫이다.
 * 모든 신규 타입은 additive이며, ERP 특정 값은 하드코딩하지 않는다(string / metadata 위임).
 */

// ── ID 별칭 ──────────────────────────────────────────────
export type GovernanceRuleId = string
export type ApprovalPolicyId = string
export type ApprovalRouteId = string

// ── Governance Rule (정책/규칙 메타데이터 · 실행 엔진 아님) ──
export type GovernanceRuleScope = 'global' | 'workflow' | 'process' | 'record'
export type GovernanceRuleKind = 'validation' | 'approval' | 'constraint'
export type GovernanceRuleSeverity = 'block' | 'warn' | 'info'
/** 규칙 출처. 전결규정(위임전결) 문서는 워크플로 정본이 아니라 참조 입력이다(ADR-007). */
export type GovernanceRuleSource = 'delegation-of-authority' | 'policy' | 'manual'

export type GovernanceRule = {
  id: GovernanceRuleId
  name: string
  description?: string
  scope: GovernanceRuleScope
  /** 대상 엔티티 ID (workflowId 등, ID 기준 — ADR-005 §D5). 미지정 = scope 전체 */
  targetRef?: string
  kind: GovernanceRuleKind
  /** 엔진-무관 선언적 술어. 평가는 후속 WP의 몫이며 여기서는 메타데이터일 뿐이다. */
  expression?: string
  severity?: GovernanceRuleSeverity
  source?: GovernanceRuleSource
  metadata?: Record<string, unknown>
}

// ── Approval ─────────────────────────────────────────────
export type ApprovalStatus =
  | 'draft'
  | 'pending'
  | 'in_review'
  | 'approved'
  | 'rejected'
  | 'withdrawn'
  | 'delegated'

export type ApprovalStep = {
  id: string
  /** 경로 내 순서 (1-based) */
  order: number
  /** 승인 주체는 역할 기준 — 특정 사용자/사번을 하드코딩하지 않는다 */
  approverRole: string
  /** 런타임에 해소된 실제 actor id (optional) */
  approverRef?: string
  policyRef?: ApprovalPolicyId
  status: ApprovalStatus
  /** step 진입 가드 술어 (엔진-무관) */
  condition?: string
  decidedAt?: string
  comment?: string
}

export type ApprovalRoute = {
  id: ApprovalRouteId
  name: string
  steps: ApprovalStep[]
  /** 승인 대상 = 구조화된 데이터 레코드 (Data-first). 문서가 아니다. */
  targetRecordRef?: string
  /** 경로 집계 상태 */
  status: ApprovalStatus
  createdAt: string
}

export type ApprovalPolicyTarget = {
  entity: 'workflow' | 'record' | 'businessObject'
  ref?: string
}

export type ApprovalPolicySource = 'delegation-of-authority' | 'manual'

export type ApprovalPolicy = {
  id: ApprovalPolicyId
  name: string
  description?: string
  appliesTo: ApprovalPolicyTarget
  /** 정책이 조합하는 거버넌스 규칙들 */
  governanceRuleRefs?: GovernanceRuleId[]
  /** 경로 도출 템플릿 (정책 → 경로 생성 규칙). 실제 resolver는 WP2.3. */
  routeTemplate?: Pick<ApprovalRoute, 'name' | 'steps'>
  /** 금액 구간 등 임계값 — 엔진-무관 표현, ERP 하드코딩 금지 */
  thresholds?: Record<string, unknown>
  source?: ApprovalPolicySource
}

// ── Document Artifact (승인 이후 생성물) ──────────────────
export type DocumentArtifactKind = 'approval' | 'record' | 'report' | 'export'
export type DocumentArtifactFormat = 'pdf' | 'hwp' | 'json' | 'html'

export type DocumentArtifact = {
  id: string
  kind: DocumentArtifactKind
  /** 어떤 레코드/승인경로에서 파생됐는가 — Data-first: 데이터가 원천, 문서는 산출물이다. */
  generatedFrom: {
    recordRef?: string
    approvalRouteRef?: ApprovalRouteId
  }
  format?: DocumentArtifactFormat
  createdAt: string
  uri?: string
  metadata?: Record<string, unknown>
}

// ── Runtime State (세션 상태 · 미저장) ────────────────────
/**
 * 세션 운영 상태. ADR-007 / ADR-005 §D3·§D8 기준으로 persistence 대상이 아니며(projection·세션),
 * persisted ProcessData에 부착하지 않는다. 세션 계층 관리는 후속 WP의 몫이다.
 */
export type RuntimeState = {
  /** 로드된 Runtime의 content 버전 미러 (ADR-005 §D3) */
  contentVersion: number
  loadedAt: string
  /** 세션 메타 — persistence 제외 (ADR-005 §D3) */
  dirty: boolean
  /** 진행 중 승인 경로 (projection · 미저장) */
  activeApprovalRoutes?: ApprovalRouteId[]
  validationStatus?: 'unknown' | 'valid' | 'invalid'
}
