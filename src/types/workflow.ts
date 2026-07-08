import type { ProcessLifecycleGroupId } from '../config/appConfig'

/**
 * Workflow / Variant 그룹핑 메타데이터.
 * DataModel.md "Workflow Grouping Metadata" 절 기준 — commonMasters(Master)가 아니라
 * payload 최상위 별도 배열로 저장되는 optional 뷰 메타데이터다.
 * 실행 데이터(Node/Edge/Lane)가 아니며, 없어도 Process는 그대로 동작한다.
 */

export type WorkflowId = string
export type VariantId = string

export type WorkflowStatus = 'active' | 'draft' | 'deprecated'

export type Workflow = {
  workflowId: WorkflowId
  workflowName: string
  /** 기존 lifecycleGroupId 값 재사용 */
  category?: ProcessLifecycleGroupId
  status?: WorkflowStatus
  /** 표시용 단계 라벨 — 노드와 미연결 */
  steps?: string[]
  order?: number
  description?: string
  // ── 확장 슬롯 (Phase 2+ 선택 도입, 전부 optional) ──
  searchKeywords?: string[]
  aiKeywords?: string[]
  tags?: string[]
  relatedErpModules?: string[]
  requiredMasterData?: string[]
  requiredRoles?: string[]
  trigger?: string
  entryCondition?: string
  exitCondition?: string
  relatedWorkflowIds?: WorkflowId[]
}
