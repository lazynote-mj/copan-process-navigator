import { describe, expect, it } from 'vitest'
import type { ProcessData } from '../../types/processData'
import type {
  ApprovalPolicy,
  ApprovalRoute,
  DocumentArtifact,
  GovernanceRule,
} from '../../types/governance'
import { validateGovernance } from '../governanceValidation'

/**
 * WP2.2 — Governance Runtime Validation 검증.
 * validateGovernance는 순수·읽기전용·결정적이며 예외를 던지지 않는다.
 */

type GovernanceArrays = {
  governanceRules?: GovernanceRule[]
  approvalPolicies?: ApprovalPolicy[]
  approvalRoutes?: ApprovalRoute[]
  documentArtifacts?: DocumentArtifact[]
}

/** 검증기는 governance 배열 + 'runtimeStates' 유무만 읽으므로 partial을 ProcessData로 취급한다. */
function makeData(gov: GovernanceArrays & Record<string, unknown> = {}): ProcessData {
  return gov as unknown as ProcessData
}

const rule = (id: string, name = `rule ${id}`): GovernanceRule => ({
  id,
  name,
  scope: 'workflow',
  kind: 'approval',
})

const route = (id: string, name = `route ${id}`, orders: number[] = [1]): ApprovalRoute => ({
  id,
  name,
  status: 'draft',
  createdAt: '2026-07-10T00:00:00Z',
  steps: orders.map((order, i) => ({
    id: `${id}-step-${i}`,
    order,
    approverRole: 'reviewer',
    status: 'pending',
  })),
})

describe('validateGovernance', () => {
  it('[1] governance 배열이 전혀 없으면 통과', () => {
    const report = validateGovernance(makeData())
    expect(report.ok).toBe(true)
    expect(report.issues).toEqual([])
    expect(report.errors).toBe(0)
  })

  it('[2] 유효한 governance 그래프는 통과', () => {
    const data = makeData({
      governanceRules: [rule('gr-1'), rule('gr-2')],
      approvalPolicies: [
        { id: 'ap-1', name: 'policy 1', appliesTo: { entity: 'workflow' }, governanceRuleRefs: ['gr-1', 'gr-2'] },
      ],
      approvalRoutes: [
        {
          id: 'ar-1',
          name: 'route 1',
          status: 'pending',
          createdAt: '2026-07-10T00:00:00Z',
          steps: [
            { id: 's1', order: 1, approverRole: 'lead', status: 'pending', policyRef: 'ap-1' },
            { id: 's2', order: 2, approverRole: 'director', status: 'draft' },
          ],
        },
      ],
      documentArtifacts: [
        { id: 'doc-1', kind: 'approval', generatedFrom: { approvalRouteRef: 'ar-1' }, createdAt: '2026-07-10T00:00:00Z' },
      ],
    })
    const report = validateGovernance(data)
    expect(report.ok).toBe(true)
    expect(report.errors).toBe(0)
  })

  it('[3] 중복 id는 error', () => {
    const report = validateGovernance(makeData({ governanceRules: [rule('dup'), rule('dup')] }))
    expect(report.ok).toBe(false)
    expect(report.issues.some((i) => i.code === 'duplicate-id' && i.entityId === 'dup')).toBe(true)
  })

  it('[4] 존재하지 않는 ApprovalRoute 참조(DocumentArtifact)는 error', () => {
    const report = validateGovernance(
      makeData({
        documentArtifacts: [
          { id: 'doc-x', kind: 'approval', generatedFrom: { approvalRouteRef: 'missing-route' }, createdAt: 'x' },
        ],
      }),
    )
    expect(report.ok).toBe(false)
    expect(
      report.issues.some((i) => i.code === 'missing-reference' && i.path === 'generatedFrom.approvalRouteRef'),
    ).toBe(true)
  })

  it('[5] 존재하지 않는 GovernanceRule 참조는 error', () => {
    const report = validateGovernance(
      makeData({
        approvalPolicies: [
          { id: 'ap-x', name: 'p', appliesTo: { entity: 'workflow' }, governanceRuleRefs: ['ghost'] },
        ],
      }),
    )
    expect(report.ok).toBe(false)
    expect(report.issues.some((i) => i.code === 'missing-reference' && i.entityType === 'approvalPolicy')).toBe(true)
  })

  it('[6] 빈 steps route는 error', () => {
    const report = validateGovernance(
      makeData({
        approvalRoutes: [{ id: 'ar-empty', name: 'r', status: 'draft', createdAt: 'x', steps: [] }],
      }),
    )
    expect(report.ok).toBe(false)
    expect(report.issues.some((i) => i.code === 'empty-route-steps')).toBe(true)
  })

  it('[7] 잘못된 step order(중복)는 error', () => {
    const report = validateGovernance(makeData({ approvalRoutes: [route('ar-dup', 'r', [1, 1])] }))
    expect(report.ok).toBe(false)
    expect(report.issues.some((i) => i.code === 'invalid-step-order')).toBe(true)
  })

  it('[7b] 잘못된 step order(0/음수/비정수)도 error', () => {
    const report = validateGovernance(makeData({ approvalRoutes: [route('ar-neg', 'r', [0])] }))
    expect(report.issues.some((i) => i.code === 'invalid-step-order')).toBe(true)
  })

  it('[invalid status] union 밖의 status는 error', () => {
    const data = makeData({
      approvalRoutes: [
        { id: 'ar-s', name: 'r', status: 'bogus' as never, createdAt: 'x', steps: [{ id: 's', order: 1, approverRole: 'x', status: 'pending' }] },
      ],
    })
    const report = validateGovernance(data)
    expect(report.issues.some((i) => i.code === 'invalid-approval-status')).toBe(true)
  })

  it('[provenance] 원천 없는 DocumentArtifact는 warning(ok는 유지)', () => {
    const report = validateGovernance(
      makeData({ documentArtifacts: [{ id: 'doc-w', kind: 'report', generatedFrom: {}, createdAt: 'x' }] }),
    )
    expect(report.warnings).toBeGreaterThan(0)
    expect(report.ok).toBe(true) // warning은 ok를 막지 않는다
  })

  it('[8] governance 필드 없는 기존 ProcessData는 통과', () => {
    const data = makeData({
      commonMasters: {},
      processes: [],
      version: 1,
      updatedAt: '',
      dataSource: 'server-json',
      dirty: false,
      baselineNodeCount: 0,
      baselineEdgeCount: 0,
    })
    const report = validateGovernance(data)
    expect(report.ok).toBe(true)
    expect(report.issues).toEqual([])
  })

  it('[9] 입력을 변경하지 않는다(non-mutating)', () => {
    const rules = [rule('gr-1')]
    const data = makeData({ governanceRules: rules, approvalRoutes: [route('ar-1')] })
    const before = JSON.stringify(data)
    validateGovernance(data)
    expect(JSON.stringify(data)).toBe(before)
    // 배열 참조도 교체/재정렬되지 않음
    expect(data.governanceRules).toBe(rules)
  })

  it('[10] 정상 ProcessData에는 runtimeStates가 없다; 주입되면 error로 잡는다', () => {
    expect(validateGovernance(makeData({ approvalRoutes: [route('ok')] })).issues.some((i) => i.code === 'runtime-state-persisted')).toBe(false)
    const injected = validateGovernance(makeData({ runtimeStates: [{}] }))
    expect(injected.ok).toBe(false)
    expect(injected.issues.some((i) => i.code === 'runtime-state-persisted')).toBe(true)
  })

  it('[deterministic] 이슈 순서는 입력 순서와 무관하게 안정적', () => {
    const a = validateGovernance(makeData({ governanceRules: [rule('b'), rule('b'), rule('a'), rule('a')] }))
    const b = validateGovernance(makeData({ governanceRules: [rule('a'), rule('a'), rule('b'), rule('b')] }))
    expect(a.issues.map((i) => `${i.entityId}:${i.code}`)).toEqual(b.issues.map((i) => `${i.entityId}:${i.code}`))
  })
})
