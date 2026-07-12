import { describe, expect, it } from 'vitest'
import {
  CANONICAL_EXECUTION_DOMAINS,
  CANONICAL_ORGANIZATIONS,
  extractDomainAssignments,
  resolveDomainMapping,
  syntheticDomainId,
  syntheticOrganizationId,
  type NodeLaneRef,
} from '../executionDomainMigration'

// ── fixtures ──────────────────────────────────────────────────────────────────

/** 단일조직 Variant (구매 도메인 = 상생협력만) */
const fxSingleOrg: NodeLaneRef[] = [
  { id: 'n1', laneId: 'partnership' },
  { id: 'n2', laneId: 'partnership' },
  { id: 'n3', laneId: 'finance' },
]

/** 다중조직 Variant (구매 도메인에 상생협력 + 경영혁신 혼재) → conflict */
const fxMultiOrg: NodeLaneRef[] = [
  { id: 'a1', laneId: 'partnership' },
  { id: 'a2', laneId: 'partnership' },
  { id: 'a3', laneId: 'lane-mr8i71rk-rr7ki' }, // 경영혁신
]

/** registry 도메인 스킴 (조직 id 없음) */
const fxRegistryScheme: NodeLaneRef[] = [
  { id: 'r1', laneId: 'lane-purchasing' },
  { id: 'r2', laneId: 'lane-logistics' },
]

/** 이미 마이그레이션된(비충돌 canonical 도메인) 노드 — 순수 no-op idempotency */
const fxMigrated: NodeLaneRef[] = [
  { id: 'm1', laneId: 'procurement' },
  { id: 'm2', laneId: 'logistics' },
]

// ── resolveDomainMapping ────────────────────────────────────────────────────────

describe('resolveDomainMapping — legacy lane → Execution Domain', () => {
  it('state 스킴 조직 lane을 정확한 도메인+조직으로 매핑(confidence 1.0)', () => {
    expect(resolveDomainMapping('partnership')).toMatchObject({
      executionDomainId: 'procurement',
      organizationId: 'partner-cooperation',
      confidence: 1.0,
      ambiguous: false,
      synthetic: false,
    })
    expect(resolveDomainMapping('warehouse-easyadmin').executionDomainId).toBe('logistics')
    expect(resolveDomainMapping('retail-easychain').executionDomainId).toBe('sales')
  })

  it('상생협력·경영혁신·(인사총무 via name)이 모두 구매(procurement)로 수렴', () => {
    expect(resolveDomainMapping('partnership').executionDomainId).toBe('procurement')
    expect(resolveDomainMapping('lane-mr8i71rk-rr7ki').executionDomainId).toBe('procurement')
    expect(resolveDomainMapping('lane-x', '인사·총무팀')).toMatchObject({
      executionDomainId: 'procurement',
      organizationId: 'hr-ga',
    })
  })

  it('registry 도메인 스킴은 도메인만 매핑하고 조직은 비운다', () => {
    const r = resolveDomainMapping('lane-purchasing')
    expect(r.executionDomainId).toBe('procurement')
    expect(r.organizationId).toBeUndefined()
  })

  it('lane-requester/lane-erp는 business로 하드코딩하지 않고 ambiguous 처리', () => {
    const req = resolveDomainMapping('lane-requester')
    expect(req.ambiguous).toBe(true)
    expect(req.confidence).toBeLessThan(1)
    expect(req.warning?.code).toBe('LEGACY_MAPPING_AMBIGUOUS')
    expect(resolveDomainMapping('lane-erp').ambiguous).toBe(true)
  })

  it('알 수 없는 lane은 synthetic 도메인으로 보존 + UNKNOWN_LANE_SYNTHETIC warning', () => {
    const r = resolveDomainMapping('고객지원팀')
    expect(r.synthetic).toBe(true)
    expect(r.executionDomainId).toBe(syntheticDomainId('고객지원팀'))
    expect(r.organizationId).toBe(syntheticOrganizationId('고객지원팀'))
    expect(r.warning?.code).toBe('UNKNOWN_LANE_SYNTHETIC')
  })

  it('idempotent — 이미 canonical/synthetic 도메인 id면 identity(조직 없음, warning 없음)', () => {
    expect(resolveDomainMapping('procurement')).toMatchObject({
      executionDomainId: 'procurement',
      confidence: 1,
      synthetic: false,
    })
    expect(resolveDomainMapping('procurement').organizationId).toBeUndefined()
    expect(resolveDomainMapping('procurement').warning).toBeUndefined()
    // synthetic 재적용
    const legacy = syntheticDomainId('고객지원팀')
    expect(resolveDomainMapping(legacy)).toMatchObject({ executionDomainId: legacy, synthetic: true })
    // business/finance는 legacy org-id ∩ canonical domain-id 충돌이지만 도메인 값은 안정
    expect(resolveDomainMapping('business').executionDomainId).toBe('business')
    expect(resolveDomainMapping('finance').executionDomainId).toBe('finance')
  })
})

// ── extractDomainAssignments ────────────────────────────────────────────────────

describe('extractDomainAssignments — Variant 단위 조직 배정 추출', () => {
  it('단일조직 → 도메인당 1 배정, 조직 보존, override 없음', () => {
    const { assignments, nodeOverrides, warnings } = extractDomainAssignments(fxSingleOrg)
    expect(assignments).toEqual(
      expect.arrayContaining([
        { executionDomainId: 'procurement', organizationId: 'partner-cooperation' },
        { executionDomainId: 'finance', organizationId: 'finance-team' },
      ]),
    )
    expect(nodeOverrides).toHaveLength(0)
    expect(warnings).toHaveLength(0)
  })

  it('다중조직 → 첫 조직=기본 배정, 나머지=node override + MULTI_ORG_DOMAIN warning(무손실)', () => {
    const { assignments, nodeOverrides, warnings } = extractDomainAssignments(fxMultiOrg)
    expect(assignments).toContainEqual({ executionDomainId: 'procurement', organizationId: 'partner-cooperation' })
    expect(nodeOverrides).toContainEqual({ nodeId: 'a3', organizationId: 'business-innovation' })
    expect(warnings.some((w) => w.code === 'MULTI_ORG_DOMAIN' && w.executionDomainId === 'procurement')).toBe(true)
  })

  it('조직 id 없는 registry 도메인 스킴 → 배정 생성 안 함(레이아웃만 도메인)', () => {
    const { assignments, nodeOverrides } = extractDomainAssignments(fxRegistryScheme)
    expect(assignments).toHaveLength(0)
    expect(nodeOverrides).toHaveLength(0)
  })

  it('idempotent — 비충돌 canonical 도메인 노드는 배정을 재생성하지 않는다', () => {
    const { assignments, nodeOverrides, warnings } = extractDomainAssignments(fxMigrated)
    expect(assignments).toHaveLength(0)
    expect(nodeOverrides).toHaveLength(0)
    expect(warnings).toHaveLength(0)
  })

  it('충돌 id(business/finance: legacy org-id ∩ domain-id)는 재추출 시 value-stable', () => {
    // 'finance'는 두 세계에서 같은 문자열이라 항상 finance-team으로 매핑된다.
    // 재추출을 해도 값이 동일(무해). 실제 파이프라인은 schemaVersion 게이트로 재추출 자체를 막는다.
    const once = extractDomainAssignments([{ id: 'x', laneId: 'finance' }])
    const twice = extractDomainAssignments([{ id: 'x', laneId: 'finance' }])
    expect(once.assignments).toEqual(twice.assignments)
    expect(once.assignments).toEqual([{ executionDomainId: 'finance', organizationId: 'finance-team' }])
  })
})

// ── canonical 마스터 시드 ────────────────────────────────────────────────────────

describe('canonical 마스터 시드', () => {
  it('Execution Domain 5종 + order 1..5', () => {
    expect(CANONICAL_EXECUTION_DOMAINS.map((d) => d.id)).toEqual([
      'business',
      'procurement',
      'logistics',
      'sales',
      'finance',
    ])
    expect(CANONICAL_EXECUTION_DOMAINS.map((d) => d.order)).toEqual([1, 2, 3, 4, 5])
  })

  it('Organization 마스터에 7개 조직 포함', () => {
    const ids = CANONICAL_ORGANIZATIONS.map((o) => o.id)
    expect(ids).toContain('partner-cooperation')
    expect(ids).toContain('business-innovation')
    expect(ids).toContain('hr-ga')
    expect(CANONICAL_ORGANIZATIONS).toHaveLength(7)
  })
})
