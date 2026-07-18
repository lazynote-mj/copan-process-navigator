import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type { Process } from '../../types/process'
import type { DetailProcessGroup, OverviewProcessGroup } from '../../types/toBeNavigator'
import type { Workflow } from '../../types/workflow'
import {
  PROCESS_LIFECYCLE_GROUPS,
  getLifecycleGroupForDetailProcess,
} from '../../data/processLifecycleGroups'
import {
  buildWorkshopMenuSections,
  menuItemContainsGroup,
  resolveSelectedWorkshopMenuPath,
  type WorkshopMenuBranch,
  type WorkshopMenuItem,
  type WorkshopMenuLeaf,
  type WorkshopMenuSection,
} from '../../lib/sidebar/buildWorkshopMenu'
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
  workflows?: Workflow[]
  selectedGroupId: string | null
  detailProcesses?: Process[]
  onSelectGroup: (groupId: string) => void
  onAddGroup?: () => void
  onEditGroup?: (groupId: string) => void
  onCloneGroup?: (groupId: string, name: string) => boolean
  cloneNotice?: string | null
}

type ProcessGroupMenuProps = OverviewMenuProps | DetailMenuProps

function resolveDetailProcess(
  detailProcessId: string | undefined,
  detailProcesses: Process[] | undefined,
): Process | undefined {
  if (!detailProcessId || !detailProcesses?.length) return undefined
  return detailProcesses.find((process) => process.id === detailProcessId)
}

function buildOverviewLifecycleSections(
  groups: OverviewProcessGroup[],
  detailProcesses: Process[] | undefined,
  resolveLinkedDetailProcessId: ((group: OverviewProcessGroup) => string | undefined) | undefined,
) {
  const groupEntries = groups.map((group, index) => {
    const detailProcessId = resolveLinkedDetailProcessId?.(group)
    const linkedDetail = resolveDetailProcess(detailProcessId, detailProcesses)
    const lifecycleGroup = group.lifecycleGroupId
      ? (PROCESS_LIFECYCLE_GROUPS.find((entry) => entry.id === group.lifecycleGroupId) ?? PROCESS_LIFECYCLE_GROUPS[0])
      : detailProcessId
      ? getLifecycleGroupForDetailProcess(detailProcessId)
      : PROCESS_LIFECYCLE_GROUPS[0]
    return {
      group,
      index,
      linkedDetail,
      lifecycleGroup,
    }
  })

  return PROCESS_LIFECYCLE_GROUPS.map((lifecycleGroup) => ({
    lifecycleGroup,
    entries: groupEntries.filter((entry) => entry.lifecycleGroup.id === lifecycleGroup.id),
  }))
}

function DetailProcessGroupMenu(props: DetailMenuProps) {
  const { groups, selectedGroupId, onSelectGroup, onAddGroup, onEditGroup, onCloneGroup, cloneNotice } = props
  const [cloneGroupId, setCloneGroupId] = useState<string | null>(null)
  const [cloneEntryKey, setCloneEntryKey] = useState<string | null>(null)
  const [cloneName, setCloneName] = useState('')
  const [actionMenuGroupId, setActionMenuGroupId] = useState<string | null>(null)
  const [selectedNavigationId, setSelectedNavigationId] = useState<string | null>(null)
  // Progressive Disclosure — 기본은 모두 접힘. 사용자가 수동으로 펼친 항목만 이 집합에 담긴다.
  const [expandedLevel1Keys, setExpandedLevel1Keys] = useState<Set<string>>(new Set())
  const [expandedBranchKeys, setExpandedBranchKeys] = useState<Set<string>>(new Set())

  // Workshop Navigation Projection — Runtime Process는 그대로 두고 발표용 탐색 라벨만 별도 구성한다.
  const workshopSections = useMemo(() => buildWorkshopMenuSections(groups), [groups])

  // 선택된 Detail Process가 속한 Workshop path (자동 전개 대상)
  const selectedPath = useMemo(
    () => resolveSelectedWorkshopMenuPath(workshopSections, selectedGroupId, selectedNavigationId),
    [workshopSections, selectedGroupId, selectedNavigationId],
  )
  const selectedLevel1Key = selectedPath.level1Key
  const selectedBranchKey = selectedPath.branchKey

  // Active path는 항상 열린 것으로 계산하고, 사용자의 수동 펼침 상태는 별도 Set에 보존한다.
  const isLevel1Expanded = (key: string) => key === selectedLevel1Key || expandedLevel1Keys.has(key)
  const toggleLevel1 = (key: string) =>
    setExpandedLevel1Keys((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const isBranchExpanded = (branchKey: string) => branchKey === selectedBranchKey || expandedBranchKeys.has(branchKey)
  const toggleBranch = (branchKey: string) =>
    setExpandedBranchKeys((current) => {
      const next = new Set(current)
      if (next.has(branchKey)) next.delete(branchKey)
      else next.add(branchKey)
      return next
    })

  const renderGroupItem = (
    group: DetailProcessGroup,
    badge: string,
    label: string,
    options?: {
      flattened?: boolean
      itemKey?: string
      selected?: boolean
      onSelect?: () => void
    },
  ) => {
    const itemKey = options?.itemKey ?? group.id
    const selected = options?.selected ?? group.id === selectedGroupId
    return (
    <li key={itemKey}>
      <div
        className={`process-group-menu__item ${
          options?.flattened ? 'process-group-menu__item--flattened' : ''
        } ${selected ? 'process-group-menu__item--active' : ''}`}
      >
        <button
          type="button"
          className="process-group-menu__select process-group-menu__select--compact"
          aria-current={selected ? 'page' : undefined}
          onClick={() => {
            if (options?.onSelect) options.onSelect()
            else onSelectGroup(group.id)
            setActionMenuGroupId(null)
          }}
        >
          <span className="process-group-menu__title">
            {badge ? <span className="process-group-menu__index">{badge}</span> : null}
            <span className="process-group-menu__title-text">{label}</span>
          </span>
        </button>
        {!cloneEntryKey && (onEditGroup || onCloneGroup) ? (
          <button
            type="button"
            className="process-group-menu__more-btn"
            aria-label={`${group.name} 관리 메뉴`}
            aria-expanded={actionMenuGroupId === itemKey}
            onClick={(event) => {
              event.stopPropagation()
              setActionMenuGroupId((current) => (current === itemKey ? null : itemKey))
            }}
          >
            ⋯
          </button>
        ) : null}
        {actionMenuGroupId === itemKey ? (
          <div className="process-group-menu__context-menu" role="menu">
            {onEditGroup ? (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setActionMenuGroupId(null)
                  onEditGroup(group.id)
                }}
              >
                그룹 편집
              </button>
            ) : null}
            {onCloneGroup ? (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setActionMenuGroupId(null)
                  setCloneGroupId(group.id)
                  setCloneEntryKey(itemKey)
                  setCloneName(`${group.name} 복제`)
                }}
              >
                복사해서 새로 만들기
              </button>
            ) : null}
          </div>
        ) : null}
        {cloneEntryKey === itemKey && cloneGroupId === group.id && onCloneGroup ? (
          <form
            className="process-group-menu__clone-form"
            onSubmit={(event) => {
              event.preventDefault()
              if (onCloneGroup(group.id, cloneName)) {
                setCloneGroupId(null)
                setCloneEntryKey(null)
                setCloneName('')
              }
            }}
          >
            <label className="process-group-menu__clone-label">
              새 상세 프로세스 이름
              <input
                className="process-group-menu__clone-input"
                value={cloneName}
                autoFocus
                onChange={(event) => setCloneName(event.target.value)}
                placeholder="새 상세 프로세스 이름을 입력하세요"
              />
            </label>
            <p className="process-group-menu__clone-hint">
              Overview 연결은 별도로 설정해야 합니다.
            </p>
            <div className="process-group-menu__clone-actions">
              <button type="submit" className="process-group-menu__action">
                복제 생성
              </button>
              <button
                type="button"
                className="process-group-menu__action"
                onClick={() => {
                  setCloneGroupId(null)
                  setCloneEntryKey(null)
                  setCloneName('')
                  setActionMenuGroupId(null)
                }}
              >
                취소
              </button>
            </div>
          </form>
        ) : null}
      </div>
    </li>
    )
  }

  const renderWorkshopLeaf = (leaf: WorkshopMenuLeaf) =>
    renderGroupItem(leaf.group, '', leaf.label, {
      itemKey: leaf.navigationId,
      selected: selectedPath.navigationId === leaf.navigationId,
      onSelect: () => {
        setSelectedNavigationId(leaf.navigationId)
        onSelectGroup(leaf.group.id)
      },
    })

  const renderWorkshopBranch = (branch: WorkshopMenuBranch) => {
    const expanded = isBranchExpanded(branch.key)
    const Caret = expanded ? ChevronDown : ChevronRight
    const hasSelectedChild = menuItemContainsGroup(branch, selectedGroupId)
    return (
      <section
        key={branch.key}
        className={`process-group-menu__section process-group-menu__section--workflow ${
          hasSelectedChild ? 'process-group-menu__section--selected' : ''
        }`}
      >
        <button
          type="button"
          className="process-group-menu__section-header"
          aria-expanded={expanded}
          aria-current={hasSelectedChild ? 'true' : undefined}
          onClick={() => toggleBranch(branch.key)}
        >
          <Caret size={14} className="process-group-menu__section-caret" aria-hidden />
          <h3 className="process-group-menu__workflow-name">{branch.label}</h3>
          <span
            className="process-group-menu__workflow-count"
            title={`실행 프로세스 ${branch.totalLeaves}개`}
          >
            {branch.totalLeaves}
          </span>
        </button>
        {expanded ? (
          <ul className="process-group-menu__list process-group-menu__list--variants">
            {branch.leaves.map(renderWorkshopLeaf)}
          </ul>
        ) : null}
      </section>
    )
  }

  const renderWorkshopItem = (item: WorkshopMenuItem) => {
    if (item.kind === 'branch') return renderWorkshopBranch(item)
    return (
      <section
        key={item.navigationId}
        className="process-group-menu__section process-group-menu__section--workflow process-group-menu__section--leaf"
      >
        <ul className="process-group-menu__list process-group-menu__list--leaf">
          {renderWorkshopLeaf(item)}
        </ul>
      </section>
    )
  }

  const renderWorkshopSection = (section: WorkshopMenuSection) => {
    const expanded = isLevel1Expanded(section.key)
    const Caret = expanded ? ChevronDown : ChevronRight
    return (
      <section
        key={section.key}
        className="process-group-menu__capability"
      >
        <button
          type="button"
          className="process-group-menu__capability-header"
          aria-expanded={expanded}
          aria-current={section.key === selectedLevel1Key ? 'true' : undefined}
          onClick={() => toggleLevel1(section.key)}
        >
          <Caret size={14} className="process-group-menu__section-caret" aria-hidden />
          <h3 className="process-group-menu__capability-name">{section.label}</h3>
          <span
            className="process-group-menu__capability-count"
            title={`실행 프로세스 ${section.totalLeaves}개`}
          >
            {section.totalLeaves}
          </span>
        </button>
        {expanded ? (
          <div className="process-group-menu__capability-body">
            {section.items.map(renderWorkshopItem)}
          </div>
        ) : null}
      </section>
    )
  }

  return (
    <nav className="process-group-menu process-group-menu--explorer">
      {cloneNotice ? <p className="process-group-menu__notice">{cloneNotice}</p> : null}
      {onAddGroup ? (
        <div className="process-group-menu__actions">
          <button type="button" className="process-group-menu__action" onClick={onAddGroup}>
            + 그룹 추가
          </button>
        </div>
      ) : null}
      <div className="process-group-menu__sections">
        {workshopSections.length === 0 ? (
          <p className="process-group-menu__empty">표시할 Workflow가 없습니다.</p>
        ) : (
          workshopSections.map(renderWorkshopSection)
        )}
      </div>
    </nav>
  )
}

function OverviewProcessGroupMenu(props: OverviewMenuProps) {
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
  const [actionMenuGroupId, setActionMenuGroupId] = useState<string | null>(null)
  const lifecycleSections = buildOverviewLifecycleSections(groups, detailProcesses, resolveLinkedDetailProcessId)

  return (
    <nav className="process-group-menu">
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

      <div className="process-group-menu__sections">
        {lifecycleSections.map(({ lifecycleGroup, entries }) => (
          <section key={lifecycleGroup.id} className="process-group-menu__section">
            <header className="process-group-menu__section-header">
              <h3>{lifecycleGroup.label}</h3>
              <span>{entries.length}</span>
            </header>
            {entries.length === 0 ? (
              <p className="process-group-menu__empty">Overview 그룹 없음</p>
            ) : (
              <ul className="process-group-menu__list">
                {entries.map(({ group, linkedDetail }, index) => (
                  <li key={group.id}>
                    <div
                      className={`process-group-menu__item ${
                        group.id === selectedGroupId ? 'process-group-menu__item--active' : ''
                      }`}
                    >
                      <button
                        type="button"
                        className="process-group-menu__select process-group-menu__select--compact"
                        onClick={() => {
                          onSelectGroup(group.id)
                          setActionMenuGroupId(null)
                        }}
                      >
                        <span className="process-group-menu__title">
                          <span className="process-group-menu__index">
                            {String(index + 1).padStart(2, '0')}
                          </span>
                          <span className="process-group-menu__title-text">{group.name}</span>
                          <span className="process-group-menu__count-badge">
                            {group.overviewNodeIds.length}
                          </span>
                        </span>
                      </button>
                      {(group.linkedDetailGroupId || onEditGroup) ? (
                        <button
                          type="button"
                          className="process-group-menu__more-btn"
                          aria-label={`${group.name} 관리 메뉴`}
                          aria-expanded={actionMenuGroupId === group.id}
                          onClick={(event) => {
                            event.stopPropagation()
                            setActionMenuGroupId((current) => (current === group.id ? null : group.id))
                          }}
                        >
                          ⋯
                        </button>
                      ) : null}
                      {actionMenuGroupId === group.id ? (
                        <div className="process-group-menu__context-menu" role="menu">
                          {group.linkedDetailGroupId ? (
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => {
                                setActionMenuGroupId(null)
                                onOpenDetail(group.id)
                              }}
                            >
                              상세 보기
                              {linkedDetail ? ` · ${linkedDetail.nodes.length}노드` : ''}
                            </button>
                          ) : null}
                          {onEditGroup ? (
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => {
                                setActionMenuGroupId(null)
                                onEditGroup(group.id)
                              }}
                            >
                              그룹 편집
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </nav>
  )
}

export function ProcessGroupMenu(props: ProcessGroupMenuProps) {
  return props.variant === 'detail'
    ? <DetailProcessGroupMenu {...props} />
    : <OverviewProcessGroupMenu {...props} />
}
