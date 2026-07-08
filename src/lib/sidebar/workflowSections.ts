import type { DetailProcessGroup } from '../../types/toBeNavigator'
import type { Workflow } from '../../types/workflow'
import type { ProcessLifecycleGroup } from '../../config/appConfig'
import {
  PROCESS_LIFECYCLE_GROUPS,
  resolveLifecycleGroupForDetailGroup,
} from '../../data/processLifecycleGroups'

/**
 * Sidebar detail 메뉴 그룹핑 — Category → Workflow → Variant 3계층.
 *
 * - Category: 기존 Lifecycle 7종 (변경 없음)
 * - Workflow: 그룹의 workflowId로 2차 그룹핑. workflows[]에서 이름/순서 조회
 * - Variant: Workflow 안의 개별 DetailProcessGroup (variantLabel/variantOrder)
 *
 * fallback:
 * - workflowId가 없거나(미매핑) workflows[]에 정의가 없으면 카테고리 직속(ungrouped)
 * - workflows 자체가 없으면 전 그룹이 ungrouped → 현행 2단 구조와 동일
 */

export type WorkflowVariantNode = {
  /** 단일 Variant Workflow 여부 — 과계층화 방지용 */
  flattened: boolean
  workflow?: Workflow
  /** flattened=true면 헤더 없이 이 그룹 하나만 렌더 */
  groups: DetailProcessGroup[]
}

export type WorkflowCategorySection = {
  lifecycleGroup: ProcessLifecycleGroup
  /** Workflow로 묶인 노드들 (단일 Variant는 flattened) */
  workflows: WorkflowVariantNode[]
  /** 카테고리 직속 (미매핑) 그룹 */
  ungrouped: DetailProcessGroup[]
  /** 이 카테고리의 전체 그룹 수 (헤더 뱃지용) */
  totalGroups: number
}

function sortVariants(groups: DetailProcessGroup[]): DetailProcessGroup[] {
  return [...groups].sort((a, b) => {
    const ao = a.variantOrder ?? Number.MAX_SAFE_INTEGER
    const bo = b.variantOrder ?? Number.MAX_SAFE_INTEGER
    if (ao !== bo) return ao - bo
    return a.name.localeCompare(b.name)
  })
}

export function buildDetailWorkflowSections(
  groups: DetailProcessGroup[],
  workflows: Workflow[] | undefined,
): WorkflowCategorySection[] {
  const workflowById = new Map((workflows ?? []).map((wf) => [wf.workflowId, wf]))

  return PROCESS_LIFECYCLE_GROUPS.map((lifecycleGroup) => {
    const inCategory = groups.filter(
      (group) => resolveLifecycleGroupForDetailGroup(group).id === lifecycleGroup.id,
    )

    // workflowId → 그룹 묶음 (정의된 Workflow만). 미매핑/미정의는 ungrouped
    const byWorkflow = new Map<string, DetailProcessGroup[]>()
    const ungrouped: DetailProcessGroup[] = []
    for (const group of inCategory) {
      const wfId = group.workflowId
      if (wfId && workflowById.has(wfId)) {
        const list = byWorkflow.get(wfId) ?? []
        list.push(group)
        byWorkflow.set(wfId, list)
      } else {
        ungrouped.push(group)
      }
    }

    // Workflow 순서: workflow.order → workflowName
    const workflowNodes: WorkflowVariantNode[] = [...byWorkflow.entries()]
      .map(([wfId, wfGroups]) => ({ workflow: workflowById.get(wfId)!, groups: sortVariants(wfGroups) }))
      .sort((a, b) => {
        const ao = a.workflow.order ?? Number.MAX_SAFE_INTEGER
        const bo = b.workflow.order ?? Number.MAX_SAFE_INTEGER
        if (ao !== bo) return ao - bo
        return a.workflow.workflowName.localeCompare(b.workflow.workflowName)
      })
      .map((node) => ({
        // 단일 Variant Workflow는 과계층화 방지 — 헤더 없이 평탄화
        flattened: node.groups.length <= 1,
        workflow: node.workflow,
        groups: node.groups,
      }))

    return {
      lifecycleGroup,
      workflows: workflowNodes,
      ungrouped,
      totalGroups: inCategory.length,
    }
  })
}
