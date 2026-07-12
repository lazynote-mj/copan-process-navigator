import { describe, expect, it } from 'vitest'
import golden from './fixtures/golden-purchase-to-ap.json'
import { extractDomainAssignments, resolveDomainMapping, type NodeLaneRef } from '../executionDomainMigration'

/**
 * WP3 Golden Scenario — 실제 대표 프로세스(구매/발주)로 전체 파이프라인을 검증한다.
 *
 *   Legacy Load → Migration → Registry Sync → Reload → Overview Render → Detail Render → Save → Reload → 동일 결과
 *
 * 이 시나리오 통과가 WP3의 게이트이며, WP4~WP10의 회귀 기준이다.
 * - **지금 검증 가능(WP2-A 프리미티브 × 실제 fixture)**: Migration 매핑·도메인 병합·조직 배정.
 * - **WP3+ 구현 후 green 전환**: 아래 it.todo — pipeline wiring / registry sync / rendering / round-trip.
 *
 * Golden Fixture: purchase-to-ap-invoice(사업·구매(상생협력)·물류·재무) + it-s-w(경영혁신→구매).
 * 두 프로세스의 '구매' 도메인이 서로 다른 조직(상생협력 vs 경영혁신)으로 배정되지만
 * 동일 Execution Domain(procurement) 한 컬럼으로 병합되어야 한다.
 */

type FxProcess = { id: string; nodes: Array<{ id: string; laneId: string }> }
const laneName = new Map(golden.commonMasters.lanes.map((l) => [l.id, l.name]))
const nodesOf = (pid: string): NodeLaneRef[] => {
  const p = (golden.processes as FxProcess[]).find((x) => x.id === pid)!
  return p.nodes.map((n) => ({ id: n.id, laneId: n.laneId, laneName: laneName.get(n.laneId) }))
}

describe('Golden Scenario — Migration 단계 (WP2-A 프리미티브 × 실제 구매/발주 데이터)', () => {
  it('상생협력·경영혁신이 서로 다른 프로세스에서 모두 procurement 도메인으로 병합된다', () => {
    expect(resolveDomainMapping('partnership').executionDomainId).toBe('procurement')
    expect(resolveDomainMapping('lane-mr8i71rk-rr7ki').executionDomainId).toBe('procurement')
    // 조직은 서로 다르게 보존
    expect(resolveDomainMapping('partnership').organizationId).toBe('partner-cooperation')
    expect(resolveDomainMapping('lane-mr8i71rk-rr7ki').organizationId).toBe('business-innovation')
  })

  it('purchase-to-ap-invoice: 4개 도메인 배정, override·warning 0', () => {
    const { assignments, nodeOverrides, warnings } = extractDomainAssignments(nodesOf('purchase-to-ap-invoice'))
    expect(assignments).toEqual(
      expect.arrayContaining([
        { executionDomainId: 'business', organizationId: 'business-division' },
        { executionDomainId: 'procurement', organizationId: 'partner-cooperation' },
        { executionDomainId: 'logistics', organizationId: 'logistics-center' },
        { executionDomainId: 'finance', organizationId: 'finance-team' },
      ]),
    )
    expect(nodeOverrides).toHaveLength(0)
    expect(warnings).toHaveLength(0)
  })

  it('it-s-w variant: 구매 도메인이 경영혁신으로 배정(같은 도메인, 다른 조직)', () => {
    const { assignments } = extractDomainAssignments(nodesOf('구매-요청-매입-전표-생성-it-s-w'))
    expect(assignments).toContainEqual({ executionDomainId: 'procurement', organizationId: 'business-innovation' })
  })

  it('도메인 병합 증명: 두 프로세스의 legacy lane 5종 → domain 4종(구매 조직 2개가 1컬럼으로)', () => {
    const allNodes = [...nodesOf('purchase-to-ap-invoice'), ...nodesOf('구매-요청-매입-전표-생성-it-s-w')]
    const legacyLanes = new Set(allNodes.map((n) => n.laneId))
    const domains = new Set(allNodes.map((n) => resolveDomainMapping(n.laneId, n.laneName).executionDomainId))
    expect(legacyLanes.size).toBeGreaterThan(domains.size) // 병합 발생
    expect([...domains].sort()).toEqual(['business', 'finance', 'logistics', 'procurement'])
    // Overview는 조직(6)이 아니라 도메인(≤5)만 렌더해야 한다
    expect(domains.size).toBeLessThanOrEqual(5)
  })
})

/**
 * WP3+ 전체 파이프라인 게이트 (구현 후 it.todo → it 전환).
 * 각 항목의 "동일 결과(invariant)"를 통과 기준으로 고정한다.
 */
describe('Golden Scenario — 전체 파이프라인 게이트 (WP3+ 구현 후 활성화)', () => {
  it.todo('Legacy Load: schemaVersion<3 fixture가 손실 없이 로드된다')
  it.todo('Migration: node.laneId가 domain-native로, group.domainAssignments가 생성된다(구매→상생협력/경영혁신)')
  it.todo('Registry Sync: hydrate(registry 덮어쓰기) 후에도 node.laneId가 domain-native로 정규화된다')
  it.todo('Reload: schemaVersion=3 재로드 시 재마이그레이션·재추출 없음(idempotent)')
  it.todo('Overview Render: lane 수 = Execution Domain 수(≤5), 조직은 lane으로 렌더되지 않음')
  it.todo('Detail Render: purchase-to-ap가 도메인 lane으로 배치, 담당 조직은 보조정보로 resolve(구매→상생협력)')
  it.todo('Save→Reload→동일 결과: node/edge 수·executionDomainId·domainAssignments·조직 해석 모두 불변, dangling ref 0')
})
