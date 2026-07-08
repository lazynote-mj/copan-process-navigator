import { useState } from 'react'
import type { Process } from '../../types/process'
import type { DetailProcessGroup, OverviewProcessGroup } from '../../types/toBeNavigator'
import type { Workflow } from '../../types/workflow'
import {
  PROCESS_LIFECYCLE_GROUPS,
  getLifecycleGroupForDetailProcess,
} from '../../data/processLifecycleGroups'
import {
  buildDetailWorkflowSections,
  type WorkflowVariantNode,
} from '../../lib/sidebar/workflowSections'
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
  const { groups, workflows, selectedGroupId, onSelectGroup, onAddGroup, onEditGroup, onCloneGroup, cloneNotice } = props
  const [cloneGroupId, setCloneGroupId] = useState<string | null>(null)
  const [cloneName, setCloneName] = useState('')
  const [actionMenuGroupId, setActionMenuGroupId] = useState<string | null>(null)
  const [collapsedWorkflowIds, setCollapsedWorkflowIds] = useState<Set<string>>(new Set())

  const sections = buildDetailWorkflowSections(groups, workflows)

  // active Variant가 속한 Workflow는 접혀 있어도 자동 펼침
  const selectedWorkflowId = selectedGroupId
    ? groups.find((g) => g.id === selectedGroupId)?.workflowId
    : undefined
  const isWorkflowExpanded = (workflowId: string) =>
    workflowId === selectedWorkflowId || !collapsedWorkflowIds.has(workflowId)
  const toggleWorkflow = (workflowId: string) =>
    setCollapsedWorkflowIds((current) => {
      const next = new Set(current)
      if (next.has(workflowId)) next.delete(workflowId)
      else next.add(workflowId)
      return next
    })

  const renderGroupItem = (
    group: DetailProcessGroup,
    badge: string,
    label: string,
    options?: { flattened?: boolean },
  ) => (
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

  const renderWorkflowNode = (node: WorkflowVariantNode) => {
    // 단일 Variant Workflow는 과계층화 방지 — 헤더 없이 단일 행
    if (node.flattened) {
      const only = node.groups[0]
      if (!only) return null
      // Flatten Workflow — Workflow 헤더 스타일 유지, caret/count/순번만 제거
      const label = node.workflow?.workflowName ?? only.name
      return (
        <ul key={node.workflow?.workflowId ?? only.id} className="process-group-menu__list process-group-menu__list--flattened">
          {renderGroupItem(only, '', label, { flattened: true })}
        </ul>
      )
    }
    const workflow = node.workflow!
    const expanded = isWorkflowExpanded(workflow.workflowId)
    return (
      <div key={workflow.workflowId} className="process-group-menu__workflow">
        <button
          type="button"
          className="process-group-menu__workflow-header"
          aria-expanded={expanded}
          onClick={() => toggleWorkflow(workflow.workflowId)}
        >
          <span className="process-group-menu__workflow-caret">{expanded ? '▾' : '▸'}</span>
          <span className="process-group-menu__workflow-name">{workflow.workflowName}</span>
          <span
            className="process-group-menu__workflow-count"
            title={`실행 유형 ${node.groups.length}개`}
          >
            {node.groups.length}개
          </span>
        </button>
        {expanded ? (
          <ul className="process-group-menu__list process-group-menu__list--variants">
            {node.groups.map((group, index) =>
              renderGroupItem(
                group,
                String(group.variantOrder ?? index + 1).padStart(2, '0'),
                group.variantLabel ?? group.name,
              ),
            )}
          </ul>
        ) : null}
      </div>
    )
  }

  return (
    <nav className="process-group-menu">
      {cloneNotice ? <p className="process-group-menu__notice">{cloneNotice}</p> : null}
      {onAddGroup ? (
        <div className="process-group-menu__actions">
          <button type="button" className="process-group-menu__action" onClick={onAddGroup}>
            + 그룹 추가
          </button>
        </div>
      ) : null}
      <div className="process-group-menu__sections">
        {sections.map(({ lifecycleGroup, workflows: workflowNodes, ungrouped, totalGroups }) => (
          <section key={lifecycleGroup.id} className="process-group-menu__section">
            <header className="process-group-menu__section-header">
              <h3>{lifecycleGroup.label}</h3>
              <span>{totalGroups}</span>
            </header>
            {totalGroups === 0 ? (
              <p className="process-group-menu__empty">추가 후보 검토 영역</p>
            ) : (
              <>
                {workflowNodes.map(renderWorkflowNode)}
                {ungrouped.length > 0 ? (
                  <ul className="process-group-menu__list">
                    {ungrouped.map((group, index) =>
                      renderGroupItem(group, String(index + 1).padStart(2, '0'), group.name),
                    )}
                  </ul>
                ) : null}
              </>
            )}
          </section>
        ))}
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
