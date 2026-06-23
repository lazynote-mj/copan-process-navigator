import type { Process } from '../../types/process'
import type { DetailProcessGroup, OverviewProcessGroup } from '../../types/toBeNavigator'
import type { OverviewHighlightMode } from '../../lib/editor/viewModeTypes'
import './process-group-menu.css'

type OverviewMenuProps = {
  variant: 'overview'
  groups: OverviewProcessGroup[]
  selectedGroupId: string | null
  relatedOnly: boolean
  detailProcesses?: Process[]
  resolveLinkedDetailProcessId?: (group: OverviewProcessGroup) => string | undefined
  onSelectGroup: (groupId: string | null) => void
  onRelatedOnlyChange: (value: boolean) => void
  onOpenDetail: (groupId: string) => void
  onAddGroup?: () => void
  onEditGroup?: (groupId: string) => void
}

type DetailMenuProps = {
  variant: 'detail'
  groups: DetailProcessGroup[]
  selectedGroupId: string | null
  detailProcesses?: Process[]
  onSelectGroup: (groupId: string) => void
  onAddGroup?: () => void
  onEditGroup?: (groupId: string) => void
}

type ProcessGroupMenuProps = OverviewMenuProps | DetailMenuProps

function resolveDetailProcess(
  detailProcessId: string | undefined,
  detailProcesses: Process[] | undefined,
): Process | undefined {
  if (!detailProcessId || !detailProcesses?.length) return undefined
  return detailProcesses.find((process) => process.id === detailProcessId)
}

export function ProcessGroupMenu(props: ProcessGroupMenuProps) {
  if (props.variant === 'detail') {
    const { groups, selectedGroupId, onSelectGroup, onAddGroup, onEditGroup } = props
    return (
      <nav className="process-group-menu">
        <p className="process-group-menu__hint">
          각 단계별 프로세스 상세 설명이며, 일부는 Overview 강조 그룹과 선택적으로 연결됩니다.
        </p>
        {onAddGroup ? (
          <div className="process-group-menu__actions">
            <button type="button" className="process-group-menu__action" onClick={onAddGroup}>
              + 그룹 추가
            </button>
          </div>
        ) : null}
        <ul className="process-group-menu__list">
          {groups.map((group, index) => {
            return (
              <li key={group.id}>
                <div
                  className={`process-group-menu__item ${
                    group.id === selectedGroupId ? 'process-group-menu__item--active' : ''
                  }`}
                >
                  <button
                    type="button"
                    className="process-group-menu__select"
                    onClick={() => onSelectGroup(group.id)}
                  >
                    <span className="process-group-menu__index">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span className="process-group-menu__title">{group.name}</span>
                    <span className="process-group-menu__desc">{group.description}</span>
                  </button>
                  {onEditGroup ? (
                    <button
                      type="button"
                      className="process-group-menu__detail-btn"
                      onClick={() => onEditGroup(group.id)}
                    >
                      그룹 편집
                    </button>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ul>
      </nav>
    )
  }

  const {
    groups,
    selectedGroupId,
    relatedOnly,
    detailProcesses,
    resolveLinkedDetailProcessId,
    onSelectGroup,
    onRelatedOnlyChange,
    onOpenDetail,
    onAddGroup,
    onEditGroup,
  } = props

  return (
    <nav className="process-group-menu">
      <p className="process-group-menu__hint">
        Overview 프로세스 그룹은 전체 맵에서 해당 노드·연결선만 강조합니다. 연결된 상세 프로세스가
        있는 그룹만 심화(상세) 보기를 열 수 있습니다.
      </p>

      <div className="process-group-menu__actions">
        <button
          type="button"
          className={`process-group-menu__action ${selectedGroupId === null ? 'process-group-menu__action--active' : ''}`}
          onClick={() => onSelectGroup(null)}
        >
          전체 보기
        </button>
        {onAddGroup ? (
          <button type="button" className="process-group-menu__action" onClick={onAddGroup}>
            + 그룹 추가
          </button>
        ) : null}
        <label className="process-group-menu__toggle">
          <input
            type="checkbox"
            checked={relatedOnly}
            disabled={!selectedGroupId}
            onChange={(e) => onRelatedOnlyChange(e.target.checked)}
          />
          <span>관련 항목만 보기</span>
        </label>
      </div>

      <ul className="process-group-menu__list">
        {groups.map((group, index) => {
          const linkedDetailProcessId = resolveLinkedDetailProcessId?.(group)
          const linkedDetail = resolveDetailProcess(linkedDetailProcessId, detailProcesses)
          return (
            <li key={group.id}>
              <div
                className={`process-group-menu__item ${
                  group.id === selectedGroupId ? 'process-group-menu__item--active' : ''
                }`}
              >
                <button
                  type="button"
                  className="process-group-menu__select"
                  onClick={() => onSelectGroup(group.id)}
                >
                  <span className="process-group-menu__index">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="process-group-menu__title">{group.name}</span>
                  <span className="process-group-menu__desc">{group.description}</span>
                  <span className="process-group-menu__meta">
                    Overview 노드 {group.overviewNodeIds.length}개 · 연결선{' '}
                    {group.overviewEdgeIds.length}개
                    {linkedDetail
                      ? ` · 상세 ${linkedDetail.nodes.length}노드/${linkedDetail.edges.length}연결`
                      : ''}
                  </span>
                </button>
                {group.linkedDetailGroupId ? (
                  <button
                    type="button"
                    className="process-group-menu__detail-btn"
                    onClick={() => onOpenDetail(group.id)}
                  >
                    상세 보기
                  </button>
                ) : null}
                {onEditGroup ? (
                  <button
                    type="button"
                    className="process-group-menu__detail-btn"
                    onClick={() => onEditGroup(group.id)}
                  >
                    그룹 편집
                  </button>
                ) : null}
              </div>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

export function resolveHighlightMode(
  selectedGroupId: string | null,
  relatedOnly: boolean,
): OverviewHighlightMode {
  if (!selectedGroupId) return 'all'
  return relatedOnly ? 'filter' : 'dim'
}
