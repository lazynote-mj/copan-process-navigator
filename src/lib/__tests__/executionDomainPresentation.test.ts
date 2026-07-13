import { describe, expect, it } from 'vitest'
import { projectLane, resolveLaneOrganizations, resolveNodePolicy } from '../executionDomainPresentation'
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

describe('resolveNodePolicy — Node 담당 조직 정책 해석 (WP5-B)', () => {
  const g = group([{ executionDomainId: 'procurement', organizationId: 'partner-cooperation' }])

  it('node.organizationId 존재 → override (이 업무에서 재정의)', () => {
    const r = resolveNodePolicy({ laneId: 'procurement', organizationId: 'finance-team' }, g, ORGS)
    expect(r).toEqual({ organizationName: '재무팀', source: 'override' })
  })
  it('override 없음 + Variant assignment 존재 → inherited (Variant 기본값 상속)', () => {
    const r = resolveNodePolicy({ laneId: 'procurement' }, g, ORGS)
    expect(r).toEqual({ organizationName: '상생협력팀', source: 'inherited' })
  })
  it('둘 다 없음 → none (미지정)', () => {
    const r = resolveNodePolicy({ laneId: 'sales' }, g, ORGS)
    expect(r).toEqual({ source: 'none' })
    expect(r.organizationName).toBeUndefined()
  })
  it('우선순위: override가 Variant 배정보다 우선', () => {
    // procurement에 Variant=상생협력팀이지만 node override=재무팀 → override 우선
    const r = resolveNodePolicy({ laneId: 'procurement', organizationId: 'finance-team' }, g, ORGS)
    expect(r.source).toBe('override')
    expect(r.organizationName).toBe('재무팀')
  })
})

describe('projectLane — Overview/Detail lane presentation 정책 (WP6)', () => {
  const domain = { id: 'procurement', name: '구매' }
  const orgMap = new Map([['procurement', '상생협력팀']])

  it('Overview projection: subtitle은 항상 undefined (조직 미표시)', () => {
    expect(projectLane(domain, 'overview')).toEqual({ id: 'procurement', label: '구매', subtitle: undefined })
    // 조직 맵이 있어도 Overview는 무시
    expect(projectLane(domain, 'overview', orgMap).subtitle).toBeUndefined()
  })

  it('Detail projection: subtitle = 해석된 담당 조직명', () => {
    expect(projectLane(domain, 'detail', orgMap)).toEqual({ id: 'procurement', label: '구매', subtitle: '상생협력팀' })
    // 배정 없는 domain은 subtitle 없음
    expect(projectLane({ id: 'finance', name: '재무' }, 'detail', orgMap).subtitle).toBeUndefined()
  })

  it('organization 변경 → Detail subtitle만 변경, Overview subtitle은 항상 비어 있음', () => {
    const changed = new Map([['procurement', '경영혁신팀']])
    expect(projectLane(domain, 'detail', changed).subtitle).toBe('경영혁신팀') // Detail 변경됨
    expect(projectLane(domain, 'overview', changed).subtitle).toBeUndefined() // Overview 불변(빈값)
  })

  it('Overview presentation은 organization 맵과 무관 — label/id 동일(lane 구조 불변)', () => {
    const a = projectLane(domain, 'overview', orgMap)
    const b = projectLane(domain, 'overview', new Map([['procurement', '경영혁신팀']]))
    expect(a).toEqual(b) // 조직이 바뀌어도 Overview projection 동일
  })
})
