import type { Organization } from '../types/commonMasters'
import type { DetailProcessGroup } from '../types/toBeNavigator'

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
