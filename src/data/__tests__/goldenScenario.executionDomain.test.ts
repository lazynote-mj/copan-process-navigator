import { describe, expect, it } from 'vitest'
import golden from './fixtures/golden-purchase-to-ap.json'
import {
  extractDomainAssignments,
  migrateExecutionDomains,
  normalizeExecutionDomains,
  resolveDomainMapping,
  validateExecutionDomainIntegrity,
  type NodeLaneRef,
} from '../executionDomainMigration'
import {
  buildProcessDataFromPayload,
  processDataToFilePayload,
  type ProcessDataFilePayload,
} from '../processDataMigration'
import { filePayloadToProcessData } from '../processDataIO'
import { resolveLaneOrganizations } from '../../lib/executionDomainPresentation'
import { setDomainOrganization, DomainAssignmentError } from '../../lib/executionDomainAssignmentEditing'

/**
 * WP3 Golden Scenario — 실제 대표 프로세스(구매/발주)로 전체 파이프라인을 검증한다.
 *   Legacy Load → Migration → Registry Sync → Reload → (Overview/Detail Render) → Save → Reload → 동일 결과
 *
 * WP3 게이트: Overview/Detail Render를 제외한 8개 pending을 실제 assertion으로 전환한다.
 * Render 2건은 후속 UI WP의 todo로 유지한다.
 */

const CANON_DOMAINS = new Set(['business', 'procurement', 'logistics', 'sales', 'finance'])
const fixturePayload = golden as unknown as ProcessDataFilePayload
const laneName = new Map(golden.commonMasters.lanes.map((l) => [l.id, l.name]))
const nodesOf = (pid: string): NodeLaneRef[] => {
  const p = golden.processes.find((x) => x.id === pid)!
  return p.nodes.map((n) => ({ id: n.id, laneId: n.laneId, laneName: laneName.get(n.laneId) }))
}

// ── Migration 단계 (WP2-A 프리미티브 × 실제 데이터) ─────────────────────────────

describe('Golden Scenario — Migration 매핑 (실제 구매/발주 데이터)', () => {
  it('상생협력·경영혁신이 서로 다른 프로세스에서 모두 procurement로 병합, 조직은 보존', () => {
    expect(resolveDomainMapping('partnership').executionDomainId).toBe('procurement')
    expect(resolveDomainMapping('lane-mr8i71rk-rr7ki').executionDomainId).toBe('procurement')
    expect(resolveDomainMapping('partnership').organizationId).toBe('partner-cooperation')
    expect(resolveDomainMapping('lane-mr8i71rk-rr7ki').organizationId).toBe('business-innovation')
  })

  it('purchase-to-ap-invoice: 4도메인 배정, override·warning 0', () => {
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

  it('도메인 병합 증명: legacy lane 5종 → domain 4종(구매 조직 2개가 1컬럼)', () => {
    const all = [...nodesOf('purchase-to-ap-invoice'), ...nodesOf('구매-요청-매입-전표-생성-it-s-w')]
    const legacy = new Set(all.map((n) => n.laneId))
    const domains = new Set(all.map((n) => resolveDomainMapping(n.laneId, n.laneName).executionDomainId))
    expect(legacy.size).toBeGreaterThan(domains.size)
    expect(domains.size).toBeLessThanOrEqual(5)
  })
})

// ── WP3 Golden Gate (pending → 실제 assertion) ─────────────────────────────────

describe('Golden Scenario — WP3 파이프라인 게이트', () => {
  it('Legacy Load: schemaVersion<3 payload가 손실 없이 로드된다', () => {
    const data = buildProcessDataFromPayload(fixturePayload, 'server-json')
    expect(data.processes.length).toBe(golden.processes.length)
    const totalNodes = data.processes.reduce((n, p) => n + p.nodes.length, 0)
    expect(totalNodes).toBe(golden.processes.reduce((n, p) => n + p.nodes.length, 0))
  })

  it('V2→V3 Migration: commonMasters가 Execution Domain + Organization 마스터로 전환', () => {
    const m = migrateExecutionDomains({
      commonMasters: golden.commonMasters,
      processes: golden.processes,
      detailProcessGroups: golden.detailProcessGroups,
    })
    expect(m.commonMasters.lanes.map((l) => l.id)).toEqual(
      expect.arrayContaining(['business', 'procurement', 'logistics', 'sales', 'finance']),
    )
    expect(m.commonMasters.organizations?.map((o) => o.id)).toEqual(
      expect.arrayContaining(['partner-cooperation', 'business-innovation']),
    )
  })

  it('domain-native node laneId: 모든 노드가 canonical 도메인 id를 참조', () => {
    const data = buildProcessDataFromPayload(fixturePayload, 'server-json')
    for (const p of data.processes) {
      for (const n of p.nodes) expect(CANON_DOMAINS.has(n.laneId)).toBe(true)
    }
  })

  it('DetailProcessGroup assignment 보존: 구매→상생협력 / it-s-w 구매→경영혁신', () => {
    const data = buildProcessDataFromPayload(fixturePayload, 'server-json')
    const g1 = data.detailProcessGroups?.find((g) => g.detailProcessId === 'purchase-to-ap-invoice')
    const g2 = data.detailProcessGroups?.find((g) => g.detailProcessId === '구매-요청-매입-전표-생성-it-s-w')
    expect(g1?.domainAssignments).toContainEqual({ executionDomainId: 'procurement', organizationId: 'partner-cooperation' })
    expect(g2?.domainAssignments).toContainEqual({ executionDomainId: 'procurement', organizationId: 'business-innovation' })
  })

  it('Registry Sync 후 domain 정규화: legacy laneId 재주입 → normalization으로 canonical 재수렴', () => {
    // registry sync가 legacy org-laneId를 다시 넣은 상황을 재현
    const reinjected = [{ id: 're', type: 'detail', nodes: [{ id: 'x', laneId: 'partnership' }, { id: 'y', laneId: 'lane-mr8i71rk-rr7ki' }] }]
    const norm = normalizeExecutionDomains(reinjected, laneName)
    expect(norm.changed).toBe(true)
    expect(norm.processes[0].nodes.map((n) => n.laneId)).toEqual(['procurement', 'procurement'])
  })

  it('v3 Reload 시 migration 재적용 없음 (idempotent, 배정 미덮어쓰기)', () => {
    const data = buildProcessDataFromPayload(fixturePayload, 'server-json')
    const saved = processDataToFilePayload(data) // schemaVersion 3
    expect(saved.schemaVersion).toBe(3)
    const reloaded = buildProcessDataFromPayload(saved, 'server-json')
    const g1 = data.detailProcessGroups?.find((g) => g.detailProcessId === 'purchase-to-ap-invoice')?.domainAssignments
    const g2 = reloaded.detailProcessGroups?.find((g) => g.detailProcessId === 'purchase-to-ap-invoice')?.domainAssignments
    expect(g2).toEqual(g1) // 재추출로 덮어쓰지 않음
  })

  it('dangling execution-domain / organization reference 0', () => {
    const data = buildProcessDataFromPayload(fixturePayload, 'server-json')
    const integrity = validateExecutionDomainIntegrity({
      commonMasters: data.commonMasters,
      processes: data.processes,
      detailProcessGroups: data.detailProcessGroups,
    })
    expect(integrity.danglingDomainRefs).toEqual([])
    expect(integrity.danglingOrgRefs).toEqual([])
    expect(integrity.ok).toBe(true)
  })

  it('Save → Reload → 동일 결과 (node/edge·domain·assignment 불변)', () => {
    const load1 = buildProcessDataFromPayload(fixturePayload, 'server-json')
    const save1 = processDataToFilePayload(load1)
    const load2 = buildProcessDataFromPayload(save1, 'server-json')
    const laneIds = (d: typeof load1) => d.processes.flatMap((p) => p.nodes.map((n) => n.laneId))
    expect(laneIds(load2)).toEqual(laneIds(load1))
    expect(load2.detailProcessGroups?.map((g) => g.domainAssignments)).toEqual(
      load1.detailProcessGroups?.map((g) => g.domainAssignments),
    )
  })

  // WP4 — Presentation 게이트 (todo → 실제 assertion 전환)
  it('Overview Render: lane = Execution Domain(≤5), 조직은 lane/subtitle로 렌더되지 않음', () => {
    const data = buildProcessDataFromPayload(fixturePayload, 'server-json')
    const domainNames = data.commonMasters.lanes.map((l) => l.name)
    // lane 이름은 도메인명(사업/구매/…)이고 조직명(사업부/상생협력팀 등)이 아니다
    expect(data.commonMasters.lanes.length).toBeLessThanOrEqual(5)
    for (const orgName of ['사업부', '상생협력팀', '경영혁신팀', '재무팀']) {
      expect(domainNames).not.toContain(orgName)
    }
    // Overview 프로세스는 group이 없으므로 조직 subtitle 없음(빈 Map)
    const overviewOrgs = resolveLaneOrganizations(undefined, data.commonMasters.organizations)
    expect(overviewOrgs.size).toBe(0)
  })

  it('Detail Render: 도메인 lane 배치 + 담당 조직 보조정보(subtitle) resolve', () => {
    const data = buildProcessDataFromPayload(fixturePayload, 'server-json')
    const orgs = data.commonMasters.organizations
    const g1 = data.detailProcessGroups?.find((g) => g.detailProcessId === 'purchase-to-ap-invoice')
    const g2 = data.detailProcessGroups?.find((g) => g.detailProcessId === '구매-요청-매입-전표-생성-it-s-w')
    // 같은 procurement 도메인이 Variant마다 다른 조직으로 보조표시
    expect(resolveLaneOrganizations(g1, orgs).get('procurement')).toBe('상생협력팀')
    expect(resolveLaneOrganizations(g2, orgs).get('procurement')).toBe('경영혁신팀')
    expect(resolveLaneOrganizations(g1, orgs).get('finance')).toBe('재무팀')
  })

  it('Organization 변경은 lane(도메인) 집합·순서·node laneId에 영향 없음 (레이아웃 불변)', () => {
    const data = buildProcessDataFromPayload(fixturePayload, 'server-json')
    const domainKeysBefore = data.commonMasters.lanes.map((l) => l.id)
    const nodeLanesBefore = data.processes.flatMap((p) => p.nodes.map((n) => n.laneId)).sort()
    // 조직 배정을 상생협력팀→경영혁신팀으로 바꿔도 (subtitle 값만 변함)
    const g1 = data.detailProcessGroups!.find((g) => g.detailProcessId === 'purchase-to-ap-invoice')!
    g1.domainAssignments = g1.domainAssignments!.map((a) =>
      a.executionDomainId === 'procurement' ? { ...a, organizationId: 'business-innovation' } : a,
    )
    // 레이아웃 키(도메인 집합·node laneId)는 불변
    expect(data.commonMasters.lanes.map((l) => l.id)).toEqual(domainKeysBefore)
    expect(data.processes.flatMap((p) => p.nodes.map((n) => n.laneId)).sort()).toEqual(nodeLanesBefore)
    // subtitle(보조정보)만 바뀐다
    expect(resolveLaneOrganizations(g1, data.commonMasters.organizations).get('procurement')).toBe('경영혁신팀')
  })
})

// ── 추가 검증 (사용자 지정) ──────────────────────────────────────────────────────

describe('Golden Scenario — 추가 무결성 검증', () => {
  it('①: domainAssignments가 serialize/reload 경로에서 보존된다', () => {
    // serialize(processDataToFilePayload) → reload(build) 라운드트립. (fixture엔 overview가 없어
    //  strict import 검증 대신 실제 runtime load 함수로 보존을 확인한다.)
    const data = buildProcessDataFromPayload(fixturePayload, 'server-json')
    const roundTrip = filePayloadToProcessData(processDataToFilePayload(data), 'server-json')
    const src = data.detailProcessGroups?.find((g) => g.detailProcessId === 'purchase-to-ap-invoice')?.domainAssignments
    const dst = roundTrip.detailProcessGroups?.find((g) => g.detailProcessId === 'purchase-to-ap-invoice')?.domainAssignments
    expect(dst).toEqual(src)
    expect(dst?.length).toBeGreaterThan(0)
  })

  it('②: business/finance(legacy=canonical id) 는 v3에서 재추출 없이 value-stable', () => {
    const data = buildProcessDataFromPayload(fixturePayload, 'server-json') // v2→v3
    const saved = processDataToFilePayload(data)
    const reloaded = buildProcessDataFromPayload(saved, 'server-json') // v3 → skip
    const fin = (d: typeof data) =>
      d.detailProcessGroups
        ?.flatMap((g) => g.domainAssignments ?? [])
        .filter((a) => a.executionDomainId === 'finance')
    expect(fin(reloaded)).toEqual(fin(data)) // 중복·변경 없음
  })

  it('③: registry sync가 legacy id 재주입해도 normalization이 canonical로 재수렴', () => {
    const legacy = [{ id: 'p', nodes: [{ id: 'a', laneId: 'warehouse-easyadmin' }, { id: 'b', laneId: 'retail-easychain' }] }]
    const once = normalizeExecutionDomains(legacy, laneName)
    const twice = normalizeExecutionDomains(once.processes, laneName)
    expect(once.processes[0].nodes.map((n) => n.laneId)).toEqual(['logistics', 'sales'])
    expect(twice.changed).toBe(false) // 이미 canonical → no-op
  })

  it('④: migrate/load/save/reload 를 두 번 수행해도 결과 동일', () => {
    const r1 = processDataToFilePayload(buildProcessDataFromPayload(fixturePayload, 'server-json'))
    const r2 = processDataToFilePayload(buildProcessDataFromPayload(r1, 'server-json'))
    const shape = (p: ProcessDataFilePayload) =>
      JSON.stringify({
        lanes: (p as { commonMasters: { lanes: unknown[] } }).commonMasters.lanes,
        groups: (p as { detailProcessGroups?: unknown[] }).detailProcessGroups,
      })
    expect(shape(r2)).toEqual(shape(r1))
  })
})

// ── WP5-A: Variant assignment editing (구매 상생협력팀 → 경영혁신팀) ───────────────

describe('Golden Scenario — WP5-A Assignment Editing', () => {
  const load = () => buildProcessDataFromPayload(fixturePayload, 'server-json')
  const P = 'purchase-to-ap-invoice'
  const editCtx = (data: ReturnType<typeof load>) => ({
    organizations: data.commonMasters.organizations,
    executionDomains: data.commonMasters.lanes,
  })
  const invariants = (data: ReturnType<typeof load>) => ({
    laneIds: data.processes.flatMap((p) => p.nodes.map((n) => n.laneId)).sort(),
    laneMaster: data.commonMasters.lanes.map((l) => `${l.id}:${l.order}`),
    edges: data.processes.flatMap((p) => p.edges.map((e) => `${e.source}->${e.target}`)).sort(),
  })

  it('구매 담당 조직 상생협력팀 → 경영혁신팀: subtitle·resolve 변경, 그래프 불변, save/reload 유지', () => {
    const data = load()
    const group = data.detailProcessGroups!.find((g) => g.detailProcessId === P)!
    const before = invariants(data)
    // 편집 전: 구매 = 상생협력팀
    expect(resolveLaneOrganizations(group, data.commonMasters.organizations).get('procurement')).toBe('상생협력팀')

    // 편집: DetailProcessGroup.domainAssignments만 변경
    group.domainAssignments = setDomainOrganization(
      group.domainAssignments,
      'procurement',
      'business-innovation',
      editCtx(data),
    )

    // 즉시 반영: resolve 결과 변경
    expect(resolveLaneOrganizations(group, data.commonMasters.organizations).get('procurement')).toBe('경영혁신팀')
    // 그래프 불변: node.laneId·lane master·edge topology
    const after = invariants(data)
    expect(after.laneIds).toEqual(before.laneIds)
    expect(after.laneMaster).toEqual(before.laneMaster)
    expect(after.edges).toEqual(before.edges)

    // save → reload 후 경영혁신팀 유지
    const reloaded = buildProcessDataFromPayload(processDataToFilePayload(data), 'server-json')
    const rg = reloaded.detailProcessGroups!.find((g) => g.detailProcessId === P)!
    expect(resolveLaneOrganizations(rg, reloaded.commonMasters.organizations).get('procurement')).toBe('경영혁신팀')
    // reload 후에도 node.laneId 불변
    expect(reloaded.processes.flatMap((p) => p.nodes.map((n) => n.laneId)).sort()).toEqual(before.laneIds)
  })

  it('organization master에 없는 id 저장 거부', () => {
    const data = load()
    const group = data.detailProcessGroups!.find((g) => g.detailProcessId === P)!
    expect(() => setDomainOrganization(group.domainAssignments, 'procurement', '임의문자열', editCtx(data))).toThrow(
      DomainAssignmentError,
    )
  })

  it('동일 domain 중복 assignment 생성 방지, 동일 조직 여러 domain 허용', () => {
    const data = load()
    const group = data.detailProcessGroups!.find((g) => g.detailProcessId === P)!
    let a = setDomainOrganization(group.domainAssignments, 'procurement', 'business-innovation', editCtx(data))
    expect(a.filter((x) => x.executionDomainId === 'procurement')).toHaveLength(1) // 중복 없음
    a = setDomainOrganization(a, 'business', 'finance-team', editCtx(data)) // 같은 조직 다른 domain
    a = setDomainOrganization(a, 'finance', 'finance-team', editCtx(data))
    expect(a.filter((x) => x.organizationId === 'finance-team')).toHaveLength(2) // 허용
  })
})
