import type { Workflow } from '../../types/workflow'
import type { ProcessLifecycleGroupId } from '../../config/appConfig'
import { PROCESS_LIFECYCLE_GROUPS } from '../../data/processLifecycleGroups'

/**
 * Navigation Display Layer (v0.9) — UI 표시 이름 매핑.
 *
 * ADR-008/009 유지: Workflow가 1차 내비게이션 정체성(`workflowId`)이고,
 * 여기서 만드는 표시 이름은 **데이터가 아니라 UI 라벨**이다(ProcessData/스키마/샘플데이터 무변경).
 *
 * - `workflowName`  = 내부 정체성("주문 → 출고 → 매출전표")
 * - `workflowDisplayName` = 짧은 UI 라벨("주문출고")
 * - `categoryDisplayName` = Business Capability 라벨("판매")
 *
 * Business Capability = `workflow.category`(=Lifecycle id)를 표시 계층으로 묶은 것.
 * 이는 canonical tree가 아니라 View-layer grouping이며 Workflow 계층을 건너뛰지 않는다.
 */

/** Business Capability(카테고리) 표시 라벨 — 없으면 Lifecycle 라벨로 폴백. */
const CATEGORY_DISPLAY_NAMES: Partial<Record<ProcessLifecycleGroupId, string>> = {
  'business-start': '사업 시작',
  'master-data': '기준정보',
  'purchase-inbound': '구매',
  'sales': '판매',
  'returns': '반품',
  'inventory': '재고',
  'settlement': '정산',
}

/**
 * Workflow 표시 라벨 — 긴 "A → B → C" 흐름 이름을 짧은 업무 라벨로.
 * 여기 없으면 `workflowName`을 그대로 쓰되 흐름 구분자 `~`를 `→`로 정리한다(폴백).
 */
const WORKFLOW_DISPLAY_NAMES: Record<string, string> = {
  'wf-business-to-purchase': '상품사업',
  'wf-business-to-expense': '서비스사업',
  'wf-business-to-project': '프로젝트사업',
  'wf-purchase-to-ap': '구매계약',
  'wf-purchase-request-to-ap': '일반구매',
  'wf-order-to-sales': '주문출고',
  'wf-service-order-to-sales': '서비스판매',
  'wf-order-return': '판매반품',
}

const lifecycleLabelById = new Map(PROCESS_LIFECYCLE_GROUPS.map((group) => [group.id, group.label]))

/** 흐름 구분자 정리(표시 전용) — 원본 데이터는 바꾸지 않는다. */
function tidyFlowName(name: string): string {
  return name.replace(/\s*~\s*/g, ' → ').trim()
}

/** Business Capability 표시 라벨. 매핑 없으면 Lifecycle 라벨, 그것도 없으면 빈 문자열. */
export function getCategoryDisplayName(categoryId: ProcessLifecycleGroupId | undefined): string {
  if (!categoryId) return ''
  return CATEGORY_DISPLAY_NAMES[categoryId] ?? lifecycleLabelById.get(categoryId) ?? ''
}

/** Workflow 표시 라벨. 매핑 없으면 정리된 workflowName으로 폴백. */
export function getWorkflowDisplayName(workflow: Workflow | undefined): string {
  if (!workflow) return ''
  return WORKFLOW_DISPLAY_NAMES[workflow.workflowId] ?? tidyFlowName(workflow.workflowName)
}

/** Workflow가 속한 Business Capability(카테고리) id. */
export function getWorkflowCapabilityId(
  workflow: Workflow | undefined,
): ProcessLifecycleGroupId | undefined {
  return workflow?.category
}
