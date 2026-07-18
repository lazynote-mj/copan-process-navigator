import { describe, expect, it } from 'vitest'
import {
  DomainAssignmentError,
  listAssignableOrganizations,
  resolveEditableDomains,
  setDomainOrganization,
} from '../executionDomainAssignmentEditing'
import type { Organization } from '../../types/commonMasters'
import type { DomainAssignment } from '../../types/toBeNavigator'

const DOMAINS = [
  { id: 'business', name: '사업', order: 1 },
  { id: 'procurement', name: '구매', order: 2 },
  { id: 'logistics', name: '물류', order: 3 },
  { id: 'sales', name: '매장/POS', order: 4 },
  { id: 'finance', name: '재무', order: 5 },
]
const ORGS: Organization[] = [
  { id: 'business-division', name: '사업부' },
  { id: 'partner-cooperation', name: '상생협력팀' },
  { id: 'business-innovation', name: '경영혁신팀', active: true },
  { id: 'retired-team', name: '폐지된팀', active: false },
]

describe('resolveEditableDomains', () => {
  it('노드 사용 domain ∪ assignment domain 을 canonical order로 표시', () => {
    const rows = resolveEditableDomains(
      ['finance', 'business'],
      [{ executionDomainId: 'procurement', organizationId: 'partner-cooperation' }],
      DOMAINS,
    )
    expect(rows.map((r) => r.id)).toEqual(['business', 'procurement', 'finance'])
  })
  it('사용도 배정도 없는 domain은 제외', () => {
    const rows = resolveEditableDomains(['business'], [], DOMAINS)
    expect(rows.map((r) => r.id)).toEqual(['business'])
  })
})

describe('listAssignableOrganizations', () => {
  it('active !== false 만 (active 없으면 포함)', () => {
    const ids = listAssignableOrganizations(ORGS).map((o) => o.id)
    expect(ids).toContain('business-division') // active 없음 → 포함
    expect(ids).toContain('business-innovation')
    expect(ids).not.toContain('retired-team') // active:false 제외
  })
})

describe('setDomainOrganization', () => {
  const ctx = { organizations: ORGS, executionDomains: DOMAINS }
  it('조직 변경: 상생협력팀 → 경영혁신팀 (domain당 1개 교체)', () => {
    const next = setDomainOrganization(
      [{ executionDomainId: 'procurement', organizationId: 'partner-cooperation' }],
      'procurement',
      'business-innovation',
      ctx,
    )
    expect(next).toEqual([{ executionDomainId: 'procurement', organizationId: 'business-innovation' }])
  })
  it('마스터에 없는 organizationId 저장 거부', () => {
    expect(() => setDomainOrganization([], 'procurement', 'not-real', ctx)).toThrow(DomainAssignmentError)
  })
  it('빈 값 → 해당 domain 배정 해제', () => {
    const next = setDomainOrganization(
      [{ executionDomainId: 'procurement', organizationId: 'partner-cooperation' }],
      'procurement',
      '',
      ctx,
    )
    expect(next).toEqual([])
  })
  it('동일 domain 중복 생성 금지(교체만)', () => {
    const start: DomainAssignment[] = [{ executionDomainId: 'procurement', organizationId: 'partner-cooperation' }]
    const next = setDomainOrganization(start, 'procurement', 'business-innovation', ctx)
    expect(next.filter((a) => a.executionDomainId === 'procurement')).toHaveLength(1)
  })
  it('동일 조직을 여러 domain에 배정 허용', () => {
    let a: DomainAssignment[] = setDomainOrganization([], 'business', 'business-division', ctx)
    a = setDomainOrganization(a, 'finance', 'business-division', ctx)
    expect(a.filter((x) => x.organizationId === 'business-division')).toHaveLength(2)
  })
  it('결과는 canonical domain order로 deterministic 정렬', () => {
    let a: DomainAssignment[] = setDomainOrganization([], 'finance', 'business-division', ctx)
    a = setDomainOrganization(a, 'business', 'business-division', ctx)
    expect(a.map((x) => x.executionDomainId)).toEqual(['business', 'finance'])
  })
})
