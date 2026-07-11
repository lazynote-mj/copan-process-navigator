import { describe, expect, it } from 'vitest'
import {
  getCategoryDisplayName,
  getWorkflowDisplayName,
  getWorkflowCapabilityId,
} from '../navigationDisplay'
import type { Workflow } from '../../../types/workflow'

const wf = (overrides: Partial<Workflow> & Pick<Workflow, 'workflowId' | 'workflowName'>): Workflow => ({
  category: 'sales',
  ...overrides,
})

describe('getCategoryDisplayName', () => {
  it('구매/입고 카테고리는 짧은 Business Capability 라벨 "구매"로 표시된다', () => {
    expect(getCategoryDisplayName('purchase-inbound')).toBe('구매')
  })

  it('매핑이 그대로인 카테고리는 라벨을 유지한다', () => {
    expect(getCategoryDisplayName('sales')).toBe('판매')
    expect(getCategoryDisplayName('business-start')).toBe('사업 시작')
  })

  it('undefined면 빈 문자열', () => {
    expect(getCategoryDisplayName(undefined)).toBe('')
  })
})

describe('getWorkflowDisplayName', () => {
  it('긴 흐름 이름을 짧은 표시 라벨로 매핑한다', () => {
    expect(getWorkflowDisplayName(wf({ workflowId: 'wf-purchase-to-ap', workflowName: '구매요청 → 입고 → 매입전표' }))).toBe('구매계약')
    expect(getWorkflowDisplayName(wf({ workflowId: 'wf-order-to-sales', workflowName: '주문 → 출고 → 매출전표' }))).toBe('주문출고')
  })

  it('매핑이 없으면 workflowName으로 폴백하되 ~ 를 → 로 정리한다', () => {
    expect(getWorkflowDisplayName(wf({ workflowId: 'wf-unknown', workflowName: '재고이동' }))).toBe('재고이동')
    expect(getWorkflowDisplayName(wf({ workflowId: 'wf-unknown-2', workflowName: 'A ~ B ~ C' }))).toBe('A → B → C')
  })

  it('undefined면 빈 문자열', () => {
    expect(getWorkflowDisplayName(undefined)).toBe('')
  })
})

describe('getWorkflowCapabilityId', () => {
  it('workflow.category를 Business Capability id로 돌려준다', () => {
    expect(getWorkflowCapabilityId(wf({ workflowId: 'w', workflowName: 'n', category: 'returns' }))).toBe('returns')
    expect(getWorkflowCapabilityId(undefined)).toBeUndefined()
  })
})
