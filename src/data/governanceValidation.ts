import type { ProcessData } from '../types/processData'
import type { ApprovalStatus } from '../types/governance'

/**
 * WP2.2 — Governance Runtime Validation (구조 검증 · 읽기 전용 · 결정적).
 *
 * ADR-007 Governance Layer의 무결성만 검증한다. 실행/routing/resolver/문서생성/UI는 다루지 않는다(WP2.3+).
 * - 순수 함수: ProcessData를 변경하지 않는다.
 * - 결정적: 이슈를 (entityType, entityId, code, path)로 정렬해 입력 순서와 무관하게 동일 결과를 낸다.
 * - 비-throw: routerValidation 컨벤션을 따라 구조화 결과를 반환한다(예외를 던지지 않는다).
 * - 미배선: 저장을 차단하지 않는다(WP2.2 범위 = baseline 검증 함수).
 *
 * 모델 정합: WP2.1(ADR-007)에 실제 존재하는 참조만 검증한다.
 * - ApprovalPolicy.governanceRuleRefs → GovernanceRule
 * - ApprovalStep.policyRef → ApprovalPolicy
 * - DocumentArtifact.generatedFrom.approvalRouteRef → ApprovalRoute
 * (스펙의 ApprovalPolicy.approvalRouteRef · ApprovalRoute.policyRef · generatedFrom.recordRef는
 *  현 모델에 대응 필드/엔티티가 없어 결정적으로 검증할 수 없다 → 도입 시 확장.)
 */

export type GovernanceValidationSeverity = 'error' | 'warning'

export type GovernanceEntityType =
  | 'governanceRule'
  | 'approvalPolicy'
  | 'approvalRoute'
  | 'approvalStep'
  | 'documentArtifact'
  | 'processData'

export type GovernanceValidationCode =
  | 'duplicate-id'
  | 'empty-required-field'
  | 'missing-reference'
  | 'empty-route-steps'
  | 'invalid-step-order'
  | 'invalid-approval-status'
  | 'artifact-provenance-missing'
  | 'runtime-state-persisted'

export type GovernanceValidationIssue = {
  code: GovernanceValidationCode
  severity: GovernanceValidationSeverity
  entityType: GovernanceEntityType
  entityId?: string
  /** 문제 필드/경로 (예: 'name', 'steps[2].order', 'governanceRuleRefs[0]') */
  path?: string
  message: string
}

export type GovernanceValidationReport = {
  /** error가 하나도 없으면 true (warning은 ok를 막지 않는다). */
  ok: boolean
  issues: GovernanceValidationIssue[]
  errors: number
  warnings: number
}

/**
 * 런타임 검증용 ApprovalStatus 화이트리스트.
 * NOTE: union은 런타임 표현이 없어 값을 열거한다 — governance.ts의 ApprovalStatus와 동기화 유지.
 */
const KNOWN_APPROVAL_STATUSES: ReadonlySet<string> = new Set<ApprovalStatus>([
  'draft',
  'pending',
  'in_review',
  'approved',
  'rejected',
  'withdrawn',
  'delegated',
])

function isNonEmptyString(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0
}

/** 배열 내 중복 id를 error로 수집한다(두 번째 이후 발생을 표시). */
function collectDuplicateIds(
  items: ReadonlyArray<{ id: string }>,
  entityType: GovernanceEntityType,
  out: GovernanceValidationIssue[],
): void {
  const seen = new Set<string>()
  for (const item of items) {
    if (!isNonEmptyString(item.id)) continue // 빈 id는 required 검사에서 별도로 잡는다
    if (seen.has(item.id)) {
      out.push({
        code: 'duplicate-id',
        severity: 'error',
        entityType,
        entityId: item.id,
        path: 'id',
        message: `중복된 ${entityType} id입니다: ${item.id}`,
      })
    } else {
      seen.add(item.id)
    }
  }
}

/**
 * Governance Layer 구조 검증. ProcessData를 읽기만 한다.
 * governance 배열이 없거나 비어 있으면 이슈 없이 통과한다(하위호환).
 */
export function validateGovernance(data: ProcessData): GovernanceValidationReport {
  const issues: GovernanceValidationIssue[] = []

  const rules = data.governanceRules ?? []
  const policies = data.approvalPolicies ?? []
  const routes = data.approvalRoutes ?? []
  const artifacts = data.documentArtifacts ?? []

  // ── A. 중복 id ──
  collectDuplicateIds(rules, 'governanceRule', issues)
  collectDuplicateIds(policies, 'approvalPolicy', issues)
  collectDuplicateIds(routes, 'approvalRoute', issues)
  collectDuplicateIds(artifacts, 'documentArtifact', issues)

  // 참조 해석용 id 집합
  const ruleIds = new Set(rules.map((r) => r.id))
  const policyIds = new Set(policies.map((p) => p.id))
  const routeIds = new Set(routes.map((r) => r.id))

  // ── GovernanceRule: 필수 라벨 ──
  for (const rule of rules) {
    if (!isNonEmptyString(rule.id)) {
      issues.push({ code: 'empty-required-field', severity: 'error', entityType: 'governanceRule', path: 'id', message: 'GovernanceRule.id가 비어 있습니다.' })
    }
    if (!isNonEmptyString(rule.name)) {
      issues.push({ code: 'empty-required-field', severity: 'error', entityType: 'governanceRule', entityId: rule.id, path: 'name', message: 'GovernanceRule.name이 비어 있습니다.' })
    }
  }

  // ── ApprovalPolicy: 필수 라벨 + governanceRuleRefs 참조 무결성 ──
  for (const policy of policies) {
    if (!isNonEmptyString(policy.id)) {
      issues.push({ code: 'empty-required-field', severity: 'error', entityType: 'approvalPolicy', path: 'id', message: 'ApprovalPolicy.id가 비어 있습니다.' })
    }
    if (!isNonEmptyString(policy.name)) {
      issues.push({ code: 'empty-required-field', severity: 'error', entityType: 'approvalPolicy', entityId: policy.id, path: 'name', message: 'ApprovalPolicy.name이 비어 있습니다.' })
    }
    const refs = policy.governanceRuleRefs ?? []
    refs.forEach((ref, index) => {
      if (!ruleIds.has(ref)) {
        issues.push({
          code: 'missing-reference',
          severity: 'error',
          entityType: 'approvalPolicy',
          entityId: policy.id,
          path: `governanceRuleRefs[${index}]`,
          message: `ApprovalPolicy가 존재하지 않는 GovernanceRule을 참조합니다: ${ref}`,
        })
      }
    })
  }

  // ── ApprovalRoute + ApprovalStep: 구조/순서/상태/참조 ──
  for (const route of routes) {
    if (!isNonEmptyString(route.id)) {
      issues.push({ code: 'empty-required-field', severity: 'error', entityType: 'approvalRoute', path: 'id', message: 'ApprovalRoute.id가 비어 있습니다.' })
    }
    if (!isNonEmptyString(route.name)) {
      issues.push({ code: 'empty-required-field', severity: 'error', entityType: 'approvalRoute', entityId: route.id, path: 'name', message: 'ApprovalRoute.name이 비어 있습니다.' })
    }
    if (!KNOWN_APPROVAL_STATUSES.has(route.status)) {
      issues.push({ code: 'invalid-approval-status', severity: 'error', entityType: 'approvalRoute', entityId: route.id, path: 'status', message: `ApprovalRoute.status가 허용된 값이 아닙니다: ${String(route.status)}` })
    }

    const steps = route.steps ?? []
    if (steps.length === 0) {
      issues.push({ code: 'empty-route-steps', severity: 'error', entityType: 'approvalRoute', entityId: route.id, path: 'steps', message: 'ApprovalRoute에 ApprovalStep이 최소 1개 필요합니다.' })
    }

    const seenOrders = new Set<number>()
    steps.forEach((step, index) => {
      const stepPath = `steps[${index}]`
      if (!isNonEmptyString(step.approverRole)) {
        issues.push({ code: 'empty-required-field', severity: 'error', entityType: 'approvalStep', entityId: step.id, path: `${stepPath}.approverRole`, message: 'ApprovalStep.approverRole이 비어 있습니다.' })
      }
      if (!KNOWN_APPROVAL_STATUSES.has(step.status)) {
        issues.push({ code: 'invalid-approval-status', severity: 'error', entityType: 'approvalStep', entityId: step.id, path: `${stepPath}.status`, message: `ApprovalStep.status가 허용된 값이 아닙니다: ${String(step.status)}` })
      }
      // 결정적 순서: 양의 정수 + route 내 유일
      if (!Number.isInteger(step.order) || step.order < 1) {
        issues.push({ code: 'invalid-step-order', severity: 'error', entityType: 'approvalStep', entityId: step.id, path: `${stepPath}.order`, message: `ApprovalStep.order는 1 이상의 정수여야 합니다: ${String(step.order)}` })
      } else if (seenOrders.has(step.order)) {
        issues.push({ code: 'invalid-step-order', severity: 'error', entityType: 'approvalStep', entityId: step.id, path: `${stepPath}.order`, message: `ApprovalRoute 내 중복된 ApprovalStep.order입니다: ${step.order}` })
      } else {
        seenOrders.add(step.order)
      }
      if (step.policyRef !== undefined && !policyIds.has(step.policyRef)) {
        issues.push({ code: 'missing-reference', severity: 'error', entityType: 'approvalStep', entityId: step.id, path: `${stepPath}.policyRef`, message: `ApprovalStep이 존재하지 않는 ApprovalPolicy를 참조합니다: ${step.policyRef}` })
      }
    })
  }

  // ── DocumentArtifact: 참조 무결성 + provenance ──
  for (const artifact of artifacts) {
    if (!isNonEmptyString(artifact.id)) {
      issues.push({ code: 'empty-required-field', severity: 'error', entityType: 'documentArtifact', path: 'id', message: 'DocumentArtifact.id가 비어 있습니다.' })
    }
    const from = artifact.generatedFrom ?? {}
    if (from.approvalRouteRef !== undefined && !routeIds.has(from.approvalRouteRef)) {
      issues.push({ code: 'missing-reference', severity: 'error', entityType: 'documentArtifact', entityId: artifact.id, path: 'generatedFrom.approvalRouteRef', message: `DocumentArtifact가 존재하지 않는 ApprovalRoute를 참조합니다: ${from.approvalRouteRef}` })
    }
    // Data-first: 산출물은 무언가(레코드/승인경로)에서 파생돼야 한다. 둘 다 없으면 경고.
    if (!isNonEmptyString(from.recordRef) && !isNonEmptyString(from.approvalRouteRef)) {
      issues.push({ code: 'artifact-provenance-missing', severity: 'warning', entityType: 'documentArtifact', entityId: artifact.id, path: 'generatedFrom', message: 'DocumentArtifact.generatedFrom에 recordRef/approvalRouteRef가 모두 없습니다(파생 원천 불명).' })
    }
  }

  // ── RuntimeState 비저장 불변식 (ADR-007) ──
  if ('runtimeStates' in (data as Record<string, unknown>)) {
    issues.push({ code: 'runtime-state-persisted', severity: 'error', entityType: 'processData', path: 'runtimeStates', message: 'RuntimeState는 persistence 대상이 아닙니다(ProcessData에 runtimeStates가 존재).' })
  }

  // 결정적 정렬
  issues.sort((a, b) => {
    return (
      a.entityType.localeCompare(b.entityType) ||
      (a.entityId ?? '').localeCompare(b.entityId ?? '') ||
      a.code.localeCompare(b.code) ||
      (a.path ?? '').localeCompare(b.path ?? '')
    )
  })

  const errors = issues.reduce((n, i) => (i.severity === 'error' ? n + 1 : n), 0)
  const warnings = issues.length - errors
  return { ok: errors === 0, issues, errors, warnings }
}
