import { describe, expect, it } from 'vitest'
import { Package, Receipt, Truck } from 'lucide-react'
import { getWorkflowIcon } from '../workflowIcon'
import type { Workflow } from '../../../types/workflow'

const wf = (overrides: Partial<Workflow>): Workflow => ({
  workflowId: 'wf-x',
  workflowName: 'x',
  ...overrides,
})

describe('getWorkflowIcon', () => {
  it('workflow가 없으면 폴백 아이콘', () => {
    expect(getWorkflowIcon(undefined)).toBe(Package)
  })

  it('category 기준 아이콘 (판매 → Truck)', () => {
    expect(getWorkflowIcon(wf({ category: 'sales' }))).toBe(Truck)
  })

  it('workflowId 오버라이드가 category보다 우선 (서비스 판매 → Receipt)', () => {
    expect(
      getWorkflowIcon(wf({ workflowId: 'wf-service-order-to-sales', category: 'sales' })),
    ).toBe(Receipt)
  })

  it('알 수 없는 category는 폴백', () => {
    expect(getWorkflowIcon(wf({ category: undefined }))).toBe(Package)
  })
})
