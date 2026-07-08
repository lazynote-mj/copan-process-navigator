import {
  Rocket,
  ShoppingCart,
  Truck,
  Undo2,
  Repeat,
  Receipt,
  Database,
  Package,
  type LucideIcon,
} from 'lucide-react'
import type { Workflow } from '../../types/workflow'
import type { ProcessLifecycleGroupId } from '../../config/appConfig'

/**
 * Workflow → 대표 아이콘 (UI 계산 전용, 데이터 무관).
 * workflowId 세부 오버라이드 → category 기본 → 폴백 순으로 해석.
 * 흐름을 빠르게 구분하기 위한 Explorer UX 요소.
 */

const BY_WORKFLOW_ID: Record<string, LucideIcon> = {
  // 판매: 표준(출고 트럭) vs 서비스(영수증)
  'wf-service-order-to-sales': Receipt,
}

const BY_CATEGORY: Record<ProcessLifecycleGroupId, LucideIcon> = {
  'business-start': Rocket,
  'master-data': Database,
  'purchase-inbound': ShoppingCart,
  'sales': Truck,
  'returns': Undo2,
  'inventory': Repeat,
  'settlement': Receipt,
}

export function getWorkflowIcon(workflow: Workflow | undefined): LucideIcon {
  if (!workflow) return Package
  const byId = BY_WORKFLOW_ID[workflow.workflowId]
  if (byId) return byId
  if (workflow.category && BY_CATEGORY[workflow.category]) {
    return BY_CATEGORY[workflow.category]
  }
  return Package
}
