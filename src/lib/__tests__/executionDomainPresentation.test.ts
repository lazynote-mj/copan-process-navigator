import { describe, expect, it } from 'vitest'
import { resolveLaneOrganizations } from '../executionDomainPresentation'
import type { DetailProcessGroup, DomainAssignment } from '../../types/toBeNavigator'
import type { Organization } from '../../types/commonMasters'

const ORGS: Organization[] = [
  { id: 'partner-cooperation', name: '상생협력팀' },
  { id: 'finance-team', name: '재무팀' },
]

const group = (domainAssignments: DomainAssignment[]): DetailProcessGroup => ({
  id: 'g',
  name: 'g',
  description: '',
  detailProcessId: 'p',
  domainAssignments,
})

describe('resolveLaneOrganizations — 경계 조건 (WP4)', () => {
  it('배정된 domain만 조직명으로 매핑한다', () => {
    const m = resolveLaneOrganizations(
      group([{ executionDomainId: 'procurement', organizationId: 'partner-cooperation' }]),
      ORGS,
    )
    expect(m.get('procurement')).toBe('상생협력팀')
    // 배정 없는 domain은 Map에 없음 → subtitle 미표시
    expect(m.has('finance')).toBe(false)
    expect(m.size).toBe(1)
  })

  it('group·배정 없음 → 빈 Map', () => {
    expect(resolveLaneOrganizations(undefined, ORGS).size).toBe(0)
    expect(resolveLaneOrganizations(group([]), ORGS).size).toBe(0)
  })

  it('동일 domain 중복 배정 시 첫 값을 유지(마지막 값으로 덮어쓰지 않음)', () => {
    const m = resolveLaneOrganizations(
      group([
        { executionDomainId: 'procurement', organizationId: 'partner-cooperation' },
        { executionDomainId: 'procurement', organizationId: 'finance-team' }, // 중복 — 무시되어야
      ]),
      ORGS,
    )
    expect(m.get('procurement')).toBe('상생협력팀') // 첫 값(deterministic)
  })

  it('마스터에 없는 조직 id는 id를 fallback으로 표시', () => {
    const m = resolveLaneOrganizations(
      group([{ executionDomainId: 'sales', organizationId: 'unknown-org' }]),
      ORGS,
    )
    expect(m.get('sales')).toBe('unknown-org')
  })
})
