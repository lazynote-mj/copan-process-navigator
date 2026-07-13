import type { Organization } from '../types/commonMasters'
import type { DomainAssignment } from '../types/toBeNavigator'

/**
 * WP5-A — Variant/Process 기본 Execution Domain Assignment 편집 순수 로직.
 * ADR-011/012: 편집 대상은 Business Policy(DetailProcessGroup.domainAssignments)뿐이다.
 * node.laneId·layout·persistence 그래프에는 절대 관여하지 않는다(UI는 이 함수만 호출).
 * 이 모듈은 특정 Property Panel 구현에 종속되지 않는다(향후 전용 Editor 패널로 이식 가능).
 */

export type DomainRow = { id: string; name: string; order: number }
type DomainMasterLike = { id: string; name: string; order: number }

/**
 * 편집 화면에 표시할 Execution Domain 행 목록.
 * = (프로세스 노드가 사용 중인 domain) ∪ (기존 assignment의 domain), canonical order로 정렬.
 * 사용도 배정도 없는 domain은 제외한다.
 */
export function resolveEditableDomains(
  nodeDomainIds: Iterable<string>,
  domainAssignments: DomainAssignment[] | undefined,
  executionDomains: DomainMasterLike[],
): DomainRow[] {
  const used = new Set<string>(nodeDomainIds)
  for (const a of domainAssignments ?? []) used.add(a.executionDomainId)
  const byId = new Map(executionDomains.map((d) => [d.id, d]))
  return [...used]
    .map((id) => byId.get(id) ?? { id, name: id, order: Number.MAX_SAFE_INTEGER })
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
    .map((d) => ({ id: d.id, name: d.name, order: d.order }))
}

/** 선택 가능한 조직 = active organization(active 필드 없으면 전체). */
export function listAssignableOrganizations(organizations: Organization[] | undefined): Organization[] {
  return (organizations ?? []).filter((o) => o.active !== false)
}

export class DomainAssignmentError extends Error {}

/**
 * 특정 Execution Domain의 담당 조직을 설정/변경/해제한다. **domainAssignments 배열만** 반환.
 * - organizationId가 비면 해당 domain 배정 제거(해제).
 * - 비어있지 않으면 organizations 마스터에 존재해야 함(임의/미존재 문자열 저장 거부).
 * - domain당 최대 1개(교체). 동일 조직이 여러 domain을 맡는 것은 허용.
 * - 결과는 executionDomains의 canonical order로 deterministic하게 정렬.
 */
export function setDomainOrganization(
  domainAssignments: DomainAssignment[] | undefined,
  executionDomainId: string,
  organizationId: string,
  ctx: { organizations: Organization[] | undefined; executionDomains: DomainMasterLike[] },
): DomainAssignment[] {
  const orgIds = new Set((ctx.organizations ?? []).map((o) => o.id))
  const trimmed = organizationId.trim()
  if (trimmed && !orgIds.has(trimmed)) {
    throw new DomainAssignmentError(`organization '${trimmed}' 은 마스터에 없습니다.`)
  }

  // domain당 1개 유지: 기존에서 해당 domain 제거 후, 조직이 있으면 추가.
  const next = (domainAssignments ?? []).filter((a) => a.executionDomainId !== executionDomainId)
  if (trimmed) next.push({ executionDomainId, organizationId: trimmed })

  // canonical domain order로 deterministic 정렬.
  const order = new Map(ctx.executionDomains.map((d, i) => [d.id, d.order ?? i]))
  return next.sort(
    (a, b) =>
      (order.get(a.executionDomainId) ?? Number.MAX_SAFE_INTEGER) -
        (order.get(b.executionDomainId) ?? Number.MAX_SAFE_INTEGER) ||
      a.executionDomainId.localeCompare(b.executionDomainId),
  )
}
