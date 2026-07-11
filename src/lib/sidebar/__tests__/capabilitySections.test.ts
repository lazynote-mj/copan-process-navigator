import { describe, expect, it } from 'vitest'
import {
  buildCapabilitySections,
  UNCLASSIFIED_CAPABILITY_KEY,
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
