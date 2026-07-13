import type { Organization } from '../types/commonMasters'
import type { DetailProcessGroup } from '../types/toBeNavigator'

/**
 * Lane presentation projection (WP6) — Overview/Detail의 lane 표시 정책을 **명시적으로** 분리한다.
 * `ownerDepartment` 빈 값에 의존한 우연한 동작 대신, 여기서 정책을 단일 소스로 고정한다.
 * - Overview: Execution Domain name만. subtitle은 **어떤 경우에도 undefined**(조직 미표시).
 * - Detail  : Execution Domain name + 해석된 담당 조직명(subtitle).
 */
export type LanePresentation = { id: string; label: string; subtitle?: string }

export function projectLane(
  lane: { id: string; name: string },
  mode: 'overview' | 'detail',
  organizationByDomain?: Map<string, string>,
): LanePresentation {
  return {
    id: lane.id,
    label: lane.name,
    subtitle: mode === 'overview' ? undefined : organizationByDomain?.get(lane.id),
  }
}

/**
 * Execution Domain 프레젠테이션 resolver (WP4).
 * ADR-011/012: 조직 배정은 Business Policy(DetailProcessGroup.domainAssignments)에 있고,
 * Presentation은 이를 **조회만** 한다(레이아웃에 무영향). Detail lane subtitle 등 보조 표시용.
 *
 * 경계 조건:
 * - 배정이 없는 domain은 Map에 없음 → subtitle 미표시.
 * - 동일 domain에 중복 assignment가 있으면 **첫 값을 유지**(deterministic invariant, 마지막 값으로
 *   임의 덮어쓰지 않음). 정상 데이터에서는 domain당 1개다.
 * - 조직 id가 마스터에 없으면 id를 fallback으로 표시.
 *
 * @returns Map<executionDomainId, organizationName> — 배정이 없으면 빈 Map.
 */
export function resolveLaneOrganizations(
  group: DetailProcessGroup | undefined,
  organizations: Organization[] | undefined,
): Map<string, string> {
  const orgName = new Map((organizations ?? []).map((o) => [o.id, o.name]))
  const result = new Map<string, string>()
  for (const assignment of group?.domainAssignments ?? []) {
    if (result.has(assignment.executionDomainId)) continue // 첫 값 유지(중복 무시)
    result.set(assignment.executionDomainId, orgName.get(assignment.organizationId) ?? assignment.organizationId)
  }
  return result
}
