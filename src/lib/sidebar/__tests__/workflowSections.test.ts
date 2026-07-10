import { describe, expect, it } from 'vitest'
import {
  buildDetailWorkflowSections,
  buildWorkflowSections,
  UNCLASSIFIED_WORKFLOW_KEY,
} from '../workflowSections'
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

// ADR-008 Navigation Phase 1 — Workflow-first Sidebar
describe('buildWorkflowSections (Workflow-first)', () => {
  it('[1][5][11] Workflow가 최상위 섹션이고 canonical workflows[] 배열 순서를 따른다', () => {
    // 배열 순서(=canonical) 유지: order 필드가 아니라 workflows[] 나열 순서를 따른다
    const workflows = [wf('wf-b', 'B흐름', 2), wf('wf-a', 'A흐름', 1)]
    const groups = [
      grp('g1', { workflowId: 'wf-b', variantLabel: 'x', variantOrder: 1 }),
      grp('g2', { workflowId: 'wf-a', variantLabel: 'y', variantOrder: 1 }),
    ]
    const sections = buildWorkflowSections(groups, workflows)
    expect(sections.map((s) => s.workflow?.workflowName)).toEqual(['B흐름', 'A흐름'])
    expect(sections.every((s) => !s.fallback)).toBe(true)
  })

  it('그룹이 없는 Workflow는 섹션으로 표시하지 않는다(노이즈 방지)', () => {
    const workflows = [wf('wf-a', 'A', 1), wf('wf-empty', '빈 흐름', 2)]
    const sections = buildWorkflowSections([grp('g1', { workflowId: 'wf-a' })], workflows)
    expect(sections.map((s) => s.workflow?.workflowName)).toEqual(['A'])
  })

  it('[2] 모든 그룹이 workflowId를 가지면 미분류 fallback 섹션이 없다', () => {
    const workflows = [wf('wf-a', 'A', 1)]
    const groups = [grp('g1', { workflowId: 'wf-a' }), grp('g2', { workflowId: 'wf-a' })]
    const sections = buildWorkflowSections(groups, workflows)
    expect(sections.some((s) => s.fallback)).toBe(false)
  })

  it('[3][11] workflowId 결측/미해석 항목은 마지막 "미분류 Workflow" fallback에만 들어간다', () => {
    const workflows = [wf('wf-a', 'A', 1)]
    const groups = [
      grp('g1', { workflowId: 'wf-a' }),
      grp('g2', { workflowId: undefined }),
      grp('g3', { workflowId: 'wf-unknown' }),
    ]
    const sections = buildWorkflowSections(groups, workflows)
    const last = sections[sections.length - 1]
    expect(last.fallback).toBe(true)
    expect(last.key).toBe(UNCLASSIFIED_WORKFLOW_KEY)
    expect(last.groups.map((g) => g.id).sort()).toEqual(['g2', 'g3'])
  })

  it('[4] 각 Detail Process는 정확히 한 번만 나타난다', () => {
    const workflows = [wf('wf-a', 'A', 1), wf('wf-b', 'B', 2)]
    const groups = [
      grp('g1', { workflowId: 'wf-a' }),
      grp('g2', { workflowId: 'wf-b' }),
      grp('g3', { workflowId: undefined }),
    ]
    const sections = buildWorkflowSections(groups, workflows)
    const allIds = sections.flatMap((s) => s.groups.map((g) => g.id))
    expect(allIds.sort()).toEqual(['g1', 'g2', 'g3'])
    expect(new Set(allIds).size).toBe(allIds.length)
  })

  it('[6] Workflow 내부 Variant는 variantOrder 순으로 결정적 정렬된다', () => {
    const workflows = [wf('wf-a', 'A', 1)]
    const groups = [
      grp('g1', { workflowId: 'wf-a', variantLabel: 'C', variantOrder: 3 }),
      grp('g2', { workflowId: 'wf-a', variantLabel: 'A', variantOrder: 1 }),
      grp('g3', { workflowId: 'wf-a', variantLabel: 'B', variantOrder: 2 }),
    ]
    const section = buildWorkflowSections(groups, workflows)[0]
    expect(section.groups.map((g) => g.variantLabel)).toEqual(['A', 'B', 'C'])
  })

  it('[8] 단일 Variant Workflow도 flatten 없이 Workflow 섹션으로 유지된다(정체성 노출)', () => {
    const workflows = [wf('wf-solo', '단일 흐름', 1)]
    const section = buildWorkflowSections([grp('g1', { workflowId: 'wf-solo' })], workflows)[0]
    expect(section.fallback).toBe(false)
    expect(section.workflow?.workflowName).toBe('단일 흐름')
    expect(section.groups).toHaveLength(1)
  })

  it('입력 순서와 무관하게 결정적 결과', () => {
    const workflows = [wf('wf-a', 'A', 1), wf('wf-b', 'B', 2)]
    const a = buildWorkflowSections(
      [grp('g2', { workflowId: 'wf-b' }), grp('g1', { workflowId: 'wf-a' })],
      workflows,
    )
    const b = buildWorkflowSections(
      [grp('g1', { workflowId: 'wf-a' }), grp('g2', { workflowId: 'wf-b' })],
      workflows,
    )
    expect(a.map((s) => s.key)).toEqual(b.map((s) => s.key))
  })
})
