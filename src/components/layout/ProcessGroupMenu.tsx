import type { ProcessGroup } from '../../types/toBeNavigator'
import type { OverviewHighlightMode } from '../../lib/editor/viewModeTypes'
import './process-group-menu.css'

type ProcessGroupMenuProps = {
  groups: ProcessGroup[]
  selectedGroupId: string | null
  relatedOnly: boolean
  showOverviewControls?: boolean
  onSelectGroup: (groupId: string | null) => void
  onRelatedOnlyChange: (value: boolean) => void
  onOpenDetail: (groupId: string) => void
}

export function ProcessGroupMenu({
  groups,
  selectedGroupId,
  relatedOnly,
  showOverviewControls = true,
  onSelectGroup,
  onRelatedOnlyChange,
  onOpenDetail,
}: ProcessGroupMenuProps) {
  return (
    <nav className="process-group-menu">
      <p className="process-group-menu__hint">
        {showOverviewControls
          ? '프로세스 그룹을 선택하면 Overview에서 관련 노드/연결선이 강조됩니다.'
          : '상세 프로세스를 선택하거나 다른 그룹으로 이동하세요.'}
      </p>

      {showOverviewControls && (
        <div className="process-group-menu__actions">
        <button
          type="button"
          className={`process-group-menu__action ${selectedGroupId === null ? 'process-group-menu__action--active' : ''}`}
          onClick={() => onSelectGroup(null)}
        >
          전체 보기
        </button>
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
      )}

      <ul className="process-group-menu__list">
        {groups.map((group, index) => (
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
                  노드 {group.overviewNodeIds.length}개 · 연결선 {group.overviewEdgeIds.length}개
                </span>
              </button>
              <button
                type="button"
                className="process-group-menu__detail-btn"
                onClick={() => onOpenDetail(group.id)}
              >
                상세 보기
              </button>
            </div>
          </li>
        ))}
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
