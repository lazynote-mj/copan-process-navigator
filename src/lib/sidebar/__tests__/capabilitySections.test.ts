import { describe, expect, it } from 'vitest'
import {
  buildCapabilitySections,
  isMeaninglessSoleVariant,
  UNCLASSIFIED_CAPABILITY_KEY,
  type WorkflowSection,
} from '../workflowSections'
import type { DetailProcessGroup } from '../../../types/toBeNavigator'
import type { Workflow } from '../../../types/workflow'
import type { ProcessLifecycleGroupId } from '../../../config/appConfig'

const wf = (id: string, name: string, category: ProcessLifecycleGroupId, order?: number): Workflow => ({
  workflowId: id,
  workflowName: name,
  category,
  order,
})

const grp = (id: string, workflowId: string, overrides: Partial<DetailProcessGroup> = {}): DetailProcessGroup => ({
  id,
  name: id,
  description: '',
  detailProcessId: id,
  workflowId,
  ...overrides,
})

const workflows: Workflow[] = [
  wf('wf-purchase-to-ap', '구매요청 → 입고 → 매입전표', 'purchase-inbound', 1),
  wf('wf-purchase-request-to-ap', '구매요청 → 매입전표', 'purchase-inbound', 2),
  wf('wf-order-to-sales', '주문 → 출고 → 매출전표', 'sales', 1),
]

describe('buildCapabilitySections — Business Capability → Workflow → Detail (v0.9)', () => {
  it('workflow.category로 Capability를 묶고 표시 라벨을 채운다', () => {
    const groups = [
      grp('g-purchase', 'wf-purchase-to-ap', { variantLabel: '제/상품' }),
      grp('g-general', 'wf-purchase-request-to-ap', { variantLabel: '서비스' }),
      grp('g-sales', 'wf-order-to-sales', { variantLabel: 'B2B 국내' }),
    ]
    const capabilities = buildCapabilitySections(groups, workflows)

    const purchase = capabilities.find((c) => c.categoryId === 'purchase-inbound')!
    expect(purchase.displayName).toBe('구매')
    // 구매 Capability 아래 Workflow 2개(구매계약/일반구매)
    expect(purchase.workflowSections.map((s) => s.workflow?.workflowId)).toEqual([
      'wf-purchase-to-ap',
      'wf-purchase-request-to-ap',
    ])
    expect(purchase.totalGroups).toBe(2)

    const sales = capabilities.find((c) => c.categoryId === 'sales')!
    expect(sales.displayName).toBe('판매')
    expect(sales.totalGroups).toBe(1)
  })

  it('Capability는 PROCESS_LIFECYCLE_GROUPS 표준 순서를 따른다 (purchase-inbound 먼저, sales 다음)', () => {
    const groups = [
      grp('g-sales', 'wf-order-to-sales'),
      grp('g-purchase', 'wf-purchase-to-ap'),
    ]
    const capabilities = buildCapabilitySections(groups, workflows)
    expect(capabilities.map((c) => c.categoryId)).toEqual(['purchase-inbound', 'sales'])
  })

  it('그룹이 없는 Capability는 표시하지 않는다', () => {
    const capabilities = buildCapabilitySections([grp('g-sales', 'wf-order-to-sales')], workflows)
    expect(capabilities).toHaveLength(1)
    expect(capabilities[0].categoryId).toBe('sales')
  })

  it('workflowId 미해석 그룹은 후행 "미분류" Capability(fallback)로 감지된다', () => {
    const groups = [
      grp('g-sales', 'wf-order-to-sales'),
      grp('g-orphan', 'wf-does-not-exist'),
    ]
    const capabilities = buildCapabilitySections(groups, workflows)
    const fallback = capabilities.find((c) => c.key === UNCLASSIFIED_CAPABILITY_KEY)!
    expect(fallback.fallback).toBe(true)
    expect(fallback.workflowSections.some((s) => s.groups.some((g) => g.id === 'g-orphan'))).toBe(true)
    // 정상 데이터에서는 fallback이 없어야 하므로 마지막에 위치
    expect(capabilities[capabilities.length - 1].key).toBe(UNCLASSIFIED_CAPABILITY_KEY)
  })
})

describe('isMeaninglessSoleVariant — 단일 Variant 억제 규칙 (v0.9)', () => {
  const section = (workflow: Workflow | undefined, variantLabels: (string | undefined)[], fallback = false): WorkflowSection => ({
    key: workflow?.workflowId ?? 'fallback',
    workflow,
    fallback,
    groups: variantLabels.map((variantLabel, i) => grp(`g${i}`, workflow?.workflowId ?? 'x', { variantLabel })),
  })
  const storage = wf('wf-storage', '저장위치 등록', 'master-data')
  const servSales = wf('wf-service-order-to-sales', '주문 → 매출전표(서비스)', 'sales')

  it('단일 placeholder 라벨은 억제한다(true)', () => {
    expect(isMeaninglessSoleVariant(section(storage, ['단일']))).toBe(true)
  })
  it('빈 라벨도 억제한다(true)', () => {
    expect(isMeaninglessSoleVariant(section(storage, [undefined]))).toBe(true)
    expect(isMeaninglessSoleVariant(section(storage, ['  ']))).toBe(true)
  })
  it('라벨이 Workflow 표시명과 동일하면 억제한다(true)', () => {
    // getWorkflowDisplayName(wf-service-order-to-sales) = '서비스판매'
    expect(isMeaninglessSoleVariant(section(servSales, ['서비스판매']))).toBe(true)
  })
  it('의미 있는 단일 Variant(서비스판매 → 서비스)는 유지한다(false)', () => {
    expect(isMeaninglessSoleVariant(section(servSales, ['서비스']))).toBe(false)
  })
  it('Variant가 2개 이상이면 억제하지 않는다(false)', () => {
    expect(isMeaninglessSoleVariant(section(storage, ['단일', '단일']))).toBe(false)
  })
  it('fallback 섹션은 억제하지 않는다(예외 감지 유지)', () => {
    expect(isMeaninglessSoleVariant(section(undefined, ['단일'], true))).toBe(false)
  })
})
