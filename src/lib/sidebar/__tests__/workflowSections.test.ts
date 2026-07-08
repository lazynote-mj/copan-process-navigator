import { describe, expect, it } from 'vitest'
import { buildDetailWorkflowSections } from '../workflowSections'
import type { DetailProcessGroup } from '../../../types/toBeNavigator'
import type { Workflow } from '../../../types/workflow'

const wf = (id: string, name: string, order?: number): Workflow => ({
  workflowId: id,
  workflowName: name,
  category: 'sales',
  order,
})

const grp = (
  id: string,
  overrides: Partial<DetailProcessGroup> = {},
): DetailProcessGroup => ({
  id,
  name: id,
  description: '',
  detailProcessId: id,
  lifecycleGroupId: 'sales',
  ...overrides,
})

const sales = (sections: ReturnType<typeof buildDetailWorkflowSections>) =>
  sections.find((s) => s.lifecycleGroup.id === 'sales')!

describe('buildDetailWorkflowSections', () => {
  it('여러 Variant를 가진 Workflow는 헤더 + Variant 목록으로 묶인다', () => {
    const workflows = [wf('wf-order-to-sales', '주문 → 출고 → 매출전표', 1)]
    const groups = [
      grp('g1', { workflowId: 'wf-order-to-sales', variantLabel: 'B2C', variantOrder: 3 }),
      grp('g2', { workflowId: 'wf-order-to-sales', variantLabel: 'B2B 국내', variantOrder: 1 }),
      grp('g3', { workflowId: 'wf-order-to-sales', variantLabel: 'B2B 해외', variantOrder: 2 }),
    ]
    const node = sales(buildDetailWorkflowSections(groups, workflows)).workflows[0]
    expect(node.flattened).toBe(false)
    expect(node.workflow?.workflowName).toBe('주문 → 출고 → 매출전표')
    // variantOrder 순 정렬
    expect(node.groups.map((g) => g.variantLabel)).toEqual(['B2B 국내', 'B2B 해외', 'B2C'])
  })

  it('단일 Variant Workflow는 과계층화 방지를 위해 flattened 처리된다', () => {
    const workflows = [wf('wf-single', '단일 흐름', 1)]
    const groups = [grp('g1', { workflowId: 'wf-single', variantLabel: '단일', variantOrder: 1 })]
    const node = sales(buildDetailWorkflowSections(groups, workflows)).workflows[0]
    expect(node.flattened).toBe(true)
    expect(node.groups).toHaveLength(1)
  })

  it('workflowId가 없는(미매핑) 그룹은 카테고리 직속 ungrouped로 간다', () => {
    const groups = [grp('g1', { workflowId: undefined })]
    const section = sales(buildDetailWorkflowSections(groups, []))
    expect(section.workflows).toHaveLength(0)
    expect(section.ungrouped.map((g) => g.id)).toEqual(['g1'])
  })

  it('workflows[]에 정의되지 않은 workflowId도 ungrouped fallback', () => {
    const groups = [grp('g1', { workflowId: 'wf-unknown' })]
    const section = sales(buildDetailWorkflowSections(groups, [wf('wf-other', '다른 흐름')]))
    expect(section.workflows).toHaveLength(0)
    expect(section.ungrouped.map((g) => g.id)).toEqual(['g1'])
  })

  it('workflows가 undefined면 전 그룹이 ungrouped (현행 2단 fallback)', () => {
    const groups = [
      grp('g1', { workflowId: 'wf-order-to-sales' }),
      grp('g2', { workflowId: 'wf-order-to-sales' }),
    ]
    const section = sales(buildDetailWorkflowSections(groups, undefined))
    expect(section.workflows).toHaveLength(0)
    expect(section.ungrouped).toHaveLength(2)
  })

  it('Workflow는 order 기준으로 정렬된다', () => {
    const workflows = [wf('wf-b', 'B흐름', 2), wf('wf-a', 'A흐름', 1)]
    const groups = [
      grp('g1', { workflowId: 'wf-b', variantLabel: 'x', variantOrder: 1 }),
      grp('g2', { workflowId: 'wf-b', variantLabel: 'y', variantOrder: 2 }),
      grp('g3', { workflowId: 'wf-a', variantLabel: 'z', variantOrder: 1 }),
      grp('g4', { workflowId: 'wf-a', variantLabel: 'w', variantOrder: 2 }),
    ]
    const names = sales(buildDetailWorkflowSections(groups, workflows)).workflows.map(
      (n) => n.workflow?.workflowName,
    )
    expect(names).toEqual(['A흐름', 'B흐름'])
  })

  it('totalGroups는 Workflow + ungrouped 전체 그룹 수', () => {
    const workflows = [wf('wf-x', 'X', 1)]
    const groups = [
      grp('g1', { workflowId: 'wf-x', variantLabel: 'a', variantOrder: 1 }),
      grp('g2', { workflowId: 'wf-x', variantLabel: 'b', variantOrder: 2 }),
      grp('g3', { workflowId: undefined }),
    ]
    const section = sales(buildDetailWorkflowSections(groups, workflows))
    expect(section.totalGroups).toBe(3)
  })

  it('모든 Lifecycle 카테고리 섹션이 항상 반환된다 (빈 것 포함)', () => {
    const sections = buildDetailWorkflowSections([], [])
    expect(sections.length).toBeGreaterThanOrEqual(7)
    expect(sections.every((s) => s.totalGroups === 0)).toBe(true)
  })
})
