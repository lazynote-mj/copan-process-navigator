import type { Organization } from '../../types/commonMasters'
import type { DomainAssignment } from '../../types/toBeNavigator'
import { listAssignableOrganizations, type DomainRow } from '../../lib/executionDomainAssignmentEditing'

/**
 * Execution Domain Assignment 편집기 (WP5-A) — Business Policy(DetailProcessGroup.domainAssignments) 편집.
 *
 * ⚠ Temporary host: 현재는 우측 Property Panel의 프로세스 컨텍스트에 마운트되지만, 이는 **임시 위치**다.
 * Role/RACI/AI Agent/KPI로 확장되면 전용 **Business Policy Panel/Drawer로 이동**할 예정이다.
 * 그러므로 이 컴포넌트는 특정 Property Panel 구현에 **종속되지 않는 독립 컴포넌트**로 유지한다
 * (props는 domains/assignments/organizations/onChange만; 부모가 배정 변경만 처리).
 * node.laneId·layout·persistence 그래프에는 관여하지 않는다.
 */
type Props = {
  /** 표시할 Execution Domain 행 (canonical order) */
  domains: DomainRow[]
  /** 현재 domain→조직 배정 */
  assignments: DomainAssignment[]
  /** 선택 가능한 조직 마스터 */
  organizations: Organization[]
  disabled?: boolean
  /** domain의 담당 조직 변경. 빈 문자열이면 배정 해제. */
  onChange: (executionDomainId: string, organizationId: string) => void
}

export function ExecutionDomainAssignmentEditor({ domains, assignments, organizations, disabled, onChange }: Props) {
  const orgByDomain = new Map(assignments.map((a) => [a.executionDomainId, a.organizationId]))
  const assignable = listAssignableOrganizations(organizations)

  if (domains.length === 0) return null

  return (
    <div className="property-panel__section edac">
      <h3 className="property-panel__section-title">프로세스 설정</h3>
      <p className="property-panel__hint">실행 영역별 담당 조직(기본 배정). 조직 변경은 lane·노드 위치에 영향을 주지 않습니다.</p>
      <div className="edac__list">
        {domains.map((domain) => (
          <div key={domain.id} className="edac__row">
            <span className="edac__domain">{domain.name}</span>
            <select
              className="edac__org"
              aria-label={`${domain.name} 담당 조직`}
              value={orgByDomain.get(domain.id) ?? ''}
              disabled={disabled}
              onChange={(event) => onChange(domain.id, event.target.value)}
            >
              <option value="">(미지정)</option>
              {assignable.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </div>
  )
}
