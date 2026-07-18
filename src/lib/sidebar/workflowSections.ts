import type { DetailProcessGroup } from '../../types/toBeNavigator'
import type { Workflow } from '../../types/workflow'
import type { ProcessLifecycleGroup, ProcessLifecycleGroupId } from '../../config/appConfig'
import {
  PROCESS_LIFECYCLE_GROUPS,
  resolveLifecycleGroupForDetailGroup,
} from '../../data/processLifecycleGroups'
import { getCategoryDisplayName } from './navigationDisplay'

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

/**
 * ADR-008 Workflow-first Navigation — Sidebar 최상위 구조.
 *
 * Category(Lifecycle)를 외곽 트리로 쓰지 않고 **Workflow를 1차 섹션**으로 삼는다.
 * - workflowId가 workflows[]에 해석되는 그룹 → 해당 Workflow 섹션(정렬: workflow.order → workflowName)
 * - workflowId가 없거나 미해석 → 단일 후행 "미분류 Workflow" fallback 섹션(호환 안전망일 뿐, canonical 아님)
 * - 각 Workflow 내부 Variant는 variantOrder → name 순
 *
 * Lifecycle은 여기서 트리 계층이 아니라 Workflow의 metadata(workflow.category)로만 남는다.
 */
export const UNCLASSIFIED_WORKFLOW_KEY = '__unclassified-workflow__'
export const UNCLASSIFIED_WORKFLOW_LABEL = '미분류 Workflow'

export type WorkflowSection = {
  /** 섹션 키 (workflowId 또는 fallback sentinel) — 접기/펼치기·React key용 */
  key: string
  /** fallback 섹션이면 undefined */
  workflow?: Workflow
  fallback: boolean
  /** 섹션에 속한 Detail Process(Variant)들 (정렬됨) */
  groups: DetailProcessGroup[]
}

/**
 * 단일 Variant 판정(Navigation Tree 표시 전용, ADR-010 Option A) —
 * Workflow에 Detail Process(Variant)가 **하나뿐이면 라벨의 의미와 무관하게** true.
 * 이 경우 Variant 행을 숨기고 Workflow 행 자체를 선택 가능한 Leaf로 렌더한다
 * (과잉 계층 제거·클릭 최소화). 선택 타깃은 그 유일한 Detail Process(`detailProcessId` 불변)다.
 *
 * Variant 데이터·의미는 Runtime/Builder/검색/상세 헤더 컨텍스트에서 그대로 보존된다 —
 * 이는 Tree 렌더 판단일 뿐 데이터(Workflow→Detail 관계)를 바꾸지 않는다.
 * fallback("미분류") 섹션은 예외 감지기이므로 평탄화하지 않는다(false).
 */
export function isSoleVariant(section: WorkflowSection): boolean {
  return !section.fallback && section.groups.length === 1
}

export function buildWorkflowSections(
  groups: DetailProcessGroup[],
  workflows: Workflow[] | undefined,
): WorkflowSection[] {
  const workflowById = new Map((workflows ?? []).map((wf) => [wf.workflowId, wf]))

  const byWorkflow = new Map<string, DetailProcessGroup[]>()
  const fallback: DetailProcessGroup[] = []
  for (const group of groups) {
    const wfId = group.workflowId
    if (wfId && workflowById.has(wfId)) {
      const list = byWorkflow.get(wfId) ?? []
      list.push(group)
      byWorkflow.set(wfId, list)
    } else {
      // workflowId 결측 또는 미해석 → 미분류 fallback (렌더 전용 안전망)
      fallback.push(group)
    }
  }

  // 순서 = canonical workflows[] 배열 순서(ADR-008). order 필드는 카테고리별 값이라 쓰지 않는다.
  // 그룹이 하나도 없는 Workflow는 노이즈 방지를 위해 표시하지 않는다.
  const sections: WorkflowSection[] = []
  for (const workflow of workflows ?? []) {
    const wfGroups = byWorkflow.get(workflow.workflowId)
    if (wfGroups && wfGroups.length > 0) {
      sections.push({
        key: workflow.workflowId,
        workflow,
        fallback: false,
        groups: sortVariants(wfGroups),
      })
    }
  }

  if (fallback.length > 0) {
    sections.push({
      key: UNCLASSIFIED_WORKFLOW_KEY,
      workflow: undefined,
      fallback: true,
      groups: sortVariants(fallback),
    })
  }

  return sections
}

/**
 * Navigation Display Layer(v0.9) — Business Capability → Workflow → Detail Process 3계층.
 *
 * `buildWorkflowSections`(Workflow→Detail 2계층)를 `workflow.category`로 한 번 더 묶는다.
 * Business Capability는 표시 계층(View grouping)일 뿐 canonical tree가 아니며, Workflow 계층을
 * 절대 건너뛰지 않는다(ADR-008/009).
 *
 * - 정렬: `PROCESS_LIFECYCLE_GROUPS` 순서(=category 표준 순서). capability 내부 Workflow 순서는
 *   `buildWorkflowSections`(canonical workflows[] 순서)를 그대로 유지한다.
 * - workflowId 미해석(fallback 섹션) 또는 category 결측 Workflow → 후행 "미분류" capability(예외 감지용).
 * - 그룹이 없는 capability는 표시하지 않는다.
 */
export const UNCLASSIFIED_CAPABILITY_KEY = '__unclassified-capability__'
export const UNCLASSIFIED_CAPABILITY_LABEL = '미분류'

export type CapabilitySection = {
  /** capability(category) id 또는 fallback sentinel — 접기/펼치기·React key용 */
  key: string
  categoryId?: ProcessLifecycleGroupId
  /** Business Capability 표시 라벨 */
  displayName: string
  fallback: boolean
  /** 이 capability에 속한 Workflow 섹션들 (정렬됨) */
  workflowSections: WorkflowSection[]
  /** 헤더 카운트용 — 소속 Detail Process(Variant) 총합 */
  totalGroups: number
}

export type SelectedProcessPath = {
  capabilityKey?: string
  workflowKey?: string
}

const PLACEHOLDER_VARIANT_LABELS = new Set(['단일', '기본', 'default'])

export function countWorkflowProcessLeaves(section: WorkflowSection): number {
  return section.groups.length
}

export function countCapabilityProcessLeaves(sections: WorkflowSection[]): number {
  return sections.reduce((total, section) => total + countWorkflowProcessLeaves(section), 0)
}

export function sectionContainsProcess(section: WorkflowSection, groupId: string | null): boolean {
  return groupId != null && section.groups.some((group) => group.id === groupId)
}

export function capabilityContainsProcess(capability: CapabilitySection, groupId: string | null): boolean {
  return groupId != null && capability.workflowSections.some((section) => sectionContainsProcess(section, groupId))
}

export function resolveSelectedProcessPath(
  capabilities: CapabilitySection[],
  selectedGroupId: string | null,
): SelectedProcessPath {
  if (!selectedGroupId) return {}
  const capability = capabilities.find((entry) => capabilityContainsProcess(entry, selectedGroupId))
  const workflow = capability?.workflowSections.find((section) => sectionContainsProcess(section, selectedGroupId))
  return {
    capabilityKey: capability?.key,
    workflowKey: workflow?.key,
  }
}

export function isPlaceholderVariantLabel(
  variantLabel: string | undefined,
  workflowDisplayName: string,
): boolean {
  const label = (variantLabel ?? '').trim()
  if (!label) return true
  return PLACEHOLDER_VARIANT_LABELS.has(label.toLowerCase()) || label === workflowDisplayName
}

export function getProcessLeafLabel(
  group: DetailProcessGroup,
  workflowDisplayName: string,
): string {
  const variantLabel = (group.variantLabel ?? '').trim()
  if (!variantLabel) return group.name
  if (isPlaceholderVariantLabel(variantLabel, workflowDisplayName)) return group.name
  return variantLabel
}

export function buildCapabilitySections(
  groups: DetailProcessGroup[],
  workflows: Workflow[] | undefined,
): CapabilitySection[] {
  const workflowSections = buildWorkflowSections(groups, workflows)

  const byCapability = new Map<ProcessLifecycleGroupId, WorkflowSection[]>()
  const exceptions: WorkflowSection[] = []
  for (const section of workflowSections) {
    const capabilityId = section.fallback ? undefined : section.workflow?.category
    if (!capabilityId) {
      exceptions.push(section)
      continue
    }
    const list = byCapability.get(capabilityId) ?? []
    list.push(section)
    byCapability.set(capabilityId, list)
  }

  const capabilities: CapabilitySection[] = []
  for (const lifecycle of PROCESS_LIFECYCLE_GROUPS) {
    const sections = byCapability.get(lifecycle.id)
    if (sections && sections.length > 0) {
      capabilities.push({
        key: lifecycle.id,
        categoryId: lifecycle.id,
        displayName: getCategoryDisplayName(lifecycle.id),
        fallback: false,
        workflowSections: sections,
        totalGroups: countCapabilityProcessLeaves(sections),
      })
    }
  }

  if (exceptions.length > 0) {
    capabilities.push({
      key: UNCLASSIFIED_CAPABILITY_KEY,
      categoryId: undefined,
      displayName: UNCLASSIFIED_CAPABILITY_LABEL,
      fallback: true,
      workflowSections: exceptions,
      totalGroups: countCapabilityProcessLeaves(exceptions),
    })
  }

  return capabilities
}
