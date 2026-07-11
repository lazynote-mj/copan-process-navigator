import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type { Process } from '../../types/process'
import type { DetailProcessGroup, OverviewProcessGroup } from '../../types/toBeNavigator'
import type { Workflow } from '../../types/workflow'
import {
  PROCESS_LIFECYCLE_GROUPS,
  getLifecycleGroupForDetailProcess,
} from '../../data/processLifecycleGroups'
import {
  buildCapabilitySections,
  UNCLASSIFIED_WORKFLOW_LABEL,
  type CapabilitySection,
  type WorkflowSection,
} from '../../lib/sidebar/workflowSections'
import { getWorkflowIcon } from '../../lib/sidebar/workflowIcon'
import { getWorkflowDisplayName } from '../../lib/sidebar/navigationDisplay'
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

/** Lifecycle은 ADR-008에서 트리가 아니라 metadata(badge) — 라벨만 조회한다. */
function lifecycleLabelOf(categoryId: string | undefined): string | undefined {
  if (!categoryId) return undefined
  return PROCESS_LIFECYCLE_GROUPS.find((group) => group.id === categoryId)?.label
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
  const { groups, workflows, selectedGroupId, onSelectGroup, onAddGroup, onEditGroup, onCloneGroup, cloneNotice } = props
  const [cloneGroupId, setCloneGroupId] = useState<string | null>(null)
  const [cloneName, setCloneName] = useState('')
  const [actionMenuGroupId, setActionMenuGroupId] = useState<string | null>(null)
  const [collapsedWorkflowIds, setCollapsedWorkflowIds] = useState<Set<string>>(new Set())
  const [collapsedCapabilityKeys, setCollapsedCapabilityKeys] = useState<Set<string>>(new Set())

  // Navigation Display Layer — Business Capability → Workflow → Detail Process 3계층.
  // Workflow는 여전히 1차 내비게이션 정체성이고, Capability는 표시 grouping이다 (ADR-008/009).
  const capabilities = buildCapabilitySections(groups, workflows)

  // 선택된 Detail Process가 속한 Capability/Workflow는 접혀 있어도 자동 펼침
  const selectedCapability = selectedGroupId
    ? capabilities.find((cap) =>
        cap.workflowSections.some((s) => s.groups.some((g) => g.id === selectedGroupId)),
      )
    : undefined
  const selectedCapabilityKey = selectedCapability?.key
  const selectedSectionKey = selectedCapability?.workflowSections.find((s) =>
    s.groups.some((g) => g.id === selectedGroupId),
  )?.key

  const isCapabilityExpanded = (key: string) =>
    key === selectedCapabilityKey || !collapsedCapabilityKeys.has(key)
  const toggleCapability = (key: string) =>
    setCollapsedCapabilityKeys((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const isWorkflowExpanded = (sectionKey: string) =>
    sectionKey === selectedSectionKey || !collapsedWorkflowIds.has(sectionKey)
  const toggleWorkflow = (sectionKey: string) =>
    setCollapsedWorkflowIds((current) => {
      const next = new Set(current)
      if (next.has(sectionKey)) next.delete(sectionKey)
      else next.add(sectionKey)
      return next
    })

  const renderGroupItem = (
    group: DetailProcessGroup,
    badge: string,
    label: string,
    options?: { flattened?: boolean; Icon?: typeof ChevronDown },
  ) => {
    const Icon = options?.Icon
    return (
    <li key={group.id}>
      <div
        className={`process-group-menu__item ${
          options?.flattened ? 'process-group-menu__item--flattened' : ''
        } ${group.id === selectedGroupId ? 'process-group-menu__item--active' : ''}`}
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
            {Icon ? <Icon size={14} className="process-group-menu__workflow-icon" aria-hidden /> : null}
            {badge ? <span className="process-group-menu__index">{badge}</span> : null}
            <span className="process-group-menu__title-text">{label}</span>
          </span>
        </button>
        {!cloneGroupId && (onEditGroup || onCloneGroup) ? (
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
                  setCloneName(`${group.name} 복제`)
                }}
              >
                복사해서 새로 만들기
              </button>
            ) : null}
          </div>
        ) : null}
        {cloneGroupId === group.id && onCloneGroup ? (
          <form
            className="process-group-menu__clone-form"
            onSubmit={(event) => {
              event.preventDefault()
              if (onCloneGroup(group.id, cloneName)) {
                setCloneGroupId(null)
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

  const renderWorkflowSection = (section: WorkflowSection) => {
    const expanded = isWorkflowExpanded(section.key)
    const Caret = expanded ? ChevronDown : ChevronRight
    const Icon = getWorkflowIcon(section.workflow)
    // ADR-008 — Workflow는 단일 Variant여도 항상 이름을 노출한다(내비게이션 정체성 유지).
    // 표시 라벨은 짧은 workflowDisplayName을 쓰되 내부 정체성(workflowId)은 그대로다.
    const name = getWorkflowDisplayName(section.workflow) || UNCLASSIFIED_WORKFLOW_LABEL
    const lifecycleLabel = lifecycleLabelOf(section.workflow?.category)
    return (
      <section
        key={section.key}
        className={`process-group-menu__section process-group-menu__section--workflow ${
          section.fallback ? 'process-group-menu__section--fallback' : ''
        }`}
      >
        <button
          type="button"
          className="process-group-menu__section-header"
          aria-expanded={expanded}
          onClick={() => toggleWorkflow(section.key)}
        >
          <Caret size={14} className="process-group-menu__section-caret" aria-hidden />
          <Icon size={14} className="process-group-menu__workflow-icon" aria-hidden />
          <h3 className="process-group-menu__workflow-name">{name}</h3>
          {lifecycleLabel ? (
            <span className="process-group-menu__section-badge" title={`분류: ${lifecycleLabel}`}>
              {lifecycleLabel}
            </span>
          ) : null}
          <span
            className="process-group-menu__workflow-count"
            title={`실행 유형 ${section.groups.length}개`}
          >
            {section.groups.length}
          </span>
        </button>
        {expanded ? (
          <ul className="process-group-menu__list process-group-menu__list--variants">
            {section.groups.map((group) =>
              // Variant = Detail Process: 라벨 중심 (선택 타깃 = group.id → detailProcessId 불변)
              renderGroupItem(group, '', group.variantLabel ?? group.name),
            )}
          </ul>
        ) : null}
      </section>
    )
  }

  const renderCapabilitySection = (capability: CapabilitySection) => {
    const expanded = isCapabilityExpanded(capability.key)
    const Caret = expanded ? ChevronDown : ChevronRight
    return (
      <section
        key={capability.key}
        className={`process-group-menu__capability ${
          capability.fallback ? 'process-group-menu__capability--fallback' : ''
        }`}
      >
        <button
          type="button"
          className="process-group-menu__capability-header"
          aria-expanded={expanded}
          onClick={() => toggleCapability(capability.key)}
        >
          <Caret size={14} className="process-group-menu__section-caret" aria-hidden />
          <h3 className="process-group-menu__capability-name">{capability.displayName}</h3>
          <span
            className="process-group-menu__capability-count"
            title={`실행 프로세스 ${capability.totalGroups}개`}
          >
            {capability.totalGroups}
          </span>
        </button>
        {expanded ? (
          <div className="process-group-menu__capability-body">
            {capability.workflowSections.map(renderWorkflowSection)}
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
        {capabilities.length === 0 ? (
          <p className="process-group-menu__empty">표시할 Workflow가 없습니다.</p>
        ) : (
          capabilities.map(renderCapabilitySection)
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
