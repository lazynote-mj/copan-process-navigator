import { useCallback, useState, type ReactNode } from 'react'
import type { Edge, Lane, Node, Process, ProcessZone, ProcessZoneId } from '../../types/process'
import {
  EDITABLE_DETAIL_NODE_TYPES,
  NODE_REVIEWERS,
  getDefaultSystemForNodeType,
  getNodeTypeLabel,
  getLaneById,
  getPhaseLabel,
  NODE_TYPE_META,
} from '../../types/process'
import type { NodeReviewStatus } from '../../types/process'
import type { NodeType } from '../../types/nodeTypes'
import {
  getOverviewNodeTypeLabel,
} from '../../types/overviewNodeTypes'
import { formatOverviewNodePrimaryLabel, resolveOverviewNodeType } from '../../lib/overviewNodeDisplay'
import { PROCESS_ZONES, type ProcessZoneDef } from '../../lib/layout/overviewProcessZones'
import {
  isNodeInOverviewZone,
  setNodeOverviewZoneMembership,
} from '../../lib/editor/overviewZoneMembership'
import {
  isNodeInProcessGroup,
  setProcessGroupNodeMembership,
  pruneProcessGroupEdgesFromNodes,
} from '../../lib/editor/processGroupMembership'
import {
  OVERVIEW_CELL_MAX_ROWS,
  OVERVIEW_CELL_SLOT_MAX,
  getCellSlotCollisionWarning,
  listCellSlotOptions,
} from '../../lib/layout/overviewCellPlacement'
import { normalizeNodeLocalOrder } from '../../lib/layout/localOrder'
import {
  canDeleteLane,
  validateEdge,
  validateLane,
  validateNode,
  validateZone,
} from '../../lib/editor/processEditor'
import type { AppMode, SelectedElement } from '../../lib/editor/selectionTypes'
import type { DetailProcessGroup, OverviewProcessGroup } from '../../types/toBeNavigator'
import { PROCESS_LIFECYCLE_GROUPS } from '../../data/processLifecycleGroups'
import { panelEventShieldProps } from '../../lib/ui/panelEventShield'
import {
  cloneDetailProcessGroup,
  cloneEdgeData,
  cloneLaneData,
  cloneNodeData,
  cloneProcessGroup,
  cloneZoneData,
  selectedElementKey,
} from '../../lib/editor/selectedElement'
import { withEdgeHandleDefaults } from '../../lib/editor/edgeHandles'
import { isDerivedDisplayEdge, isReadOnlyDisplayEdge, createSavedVirtualEdgeFromDerived } from '../../lib/nodeVisibility'
import { formatNodeSelectLabel, sortNodesForSelect } from '../../lib/editor/sortNodesForSelect'
import { isConnectorNode, resolveConnectorSubType } from '../../lib/layout/connectorLayout'
import { EdgeConnectionFields } from './EdgeConnectionFields'
import { NodeConnectionsPanel } from './NodeConnectionsPanel'
import { DetailProcessLinks } from './DetailProcessLinks'
import { ListEditor } from './ListEditor'
import './property-panel.css'
import './node-connections-panel.css'

const DETAIL_LAYOUT_MAX_COLUMNS = 24
const DETAIL_LAYOUT_MAX_ROWS = 5

/** 편집 폼 Node Type — 실제 사용 노드 중심 */
const NODE_FORM_TYPES: { value: NodeType; label: string }[] = EDITABLE_DETAIL_NODE_TYPES.map((type) => ({
  value: type,
  label: NODE_TYPE_META[type].label,
}))

const NODE_TYPE_USER_HELP: Partial<Record<NodeType, string>> = {
  erp: 'ERP에서 입력, 등록, 조회, 확정하는 업무입니다.',
  'wms-oms': '이지어드민, WMS, OMS에서 처리하는 물류/주문 업무입니다.',
  pos: '이지체인, POS, 매장 등 판매현장에서 처리하는 업무입니다.',
  manual: '시스템이 아니라 사람이 직접 확인하거나 처리하는 업무입니다.',
  approval: '품의, 결재, 승인처럼 확인 절차가 필요한 업무입니다.',
  decision: 'Y/N, 승인 여부, 위탁 여부처럼 다음 흐름이 갈라지는 판단 지점입니다.',
  database: '주문정보, 재고현황처럼 데이터가 저장되거나 조회되는 위치입니다.',
  system: '사용자가 직접 입력하지 않고 시스템이 자동으로 처리하는 단계입니다.',
  interface: '서로 다른 시스템 간 데이터가 전달되는 연동 구간입니다.',
  'interface-rule': '시스템 연동 중 조건을 판단하는 규칙입니다. 사용 시스템은 비워둘 수 있습니다.',
  'linked-process': '다른 상세 프로세스로 이어지는 연결점입니다.',
  external: '협력사, PG사, 고객사 등 외부 주체가 처리하는 업무입니다.',
  exception: '보류, 불일치, 재처리처럼 정상 흐름에서 벗어난 예외 처리입니다.',
}

const NODE_REVIEW_STATUS_OPTIONS: Array<{ value: NodeReviewStatus; label: string }> = [
  { value: 'not-reviewed', label: 'Not Reviewed' },
  { value: 'ok', label: 'OK' },
  { value: 'review-required', label: 'Review Required' },
]

function formatReviewDate(value: string | undefined): string {
  if (!value) return '자동'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function updateNodeReview(
  node: Node,
  patch: Partial<NonNullable<Node['review']>>,
): Node {
  const current = node.review ?? { status: 'not-reviewed' as NodeReviewStatus }
  const next = {
    ...current,
    ...patch,
  }
  if (next.status === 'not-reviewed') {
    const { reviewedAt: _removed, ...rest } = next
    return { ...node, review: rest }
  }
  return {
    ...node,
    review: {
      ...next,
      reviewedAt: new Date().toISOString(),
    },
  }
}

function normalizeDetailLayoutValue(raw: string, max: number): number | undefined {
  if (raw === '') return undefined
  const parsed = Number.parseInt(raw, 10)
  if (Number.isNaN(parsed)) return undefined
  return Math.min(max, Math.max(1, parsed))
}

function resolveDetailRowValue(node: Node): '' | string {
  return node.detailLayout?.row != null ? String(node.detailLayout.row) : ''
}

function resolveDetailColumnValue(node: Node): '' | string {
  return node.detailLayout?.column != null ? String(node.detailLayout.column) : ''
}

function patchDetailLayout(node: Node, patch: { column?: number; row?: number }): Node {
  const nextLayout = {
    ...node.detailLayout,
    ...patch,
  }
  if (nextLayout.column == null) delete nextLayout.column
  if (nextLayout.row == null) delete nextLayout.row
  if (nextLayout.column == null && nextLayout.row == null) {
    const { detailLayout: _removed, ...rest } = node
    return rest as Node
  }
  return { ...node, detailLayout: nextLayout }
}

function patchDetailColumn(node: Node, raw: string): Node {
  return patchDetailLayout(node, { column: normalizeDetailLayoutValue(raw, DETAIL_LAYOUT_MAX_COLUMNS) })
}

function patchDetailRow(node: Node, raw: string): Node {
  return patchDetailLayout(node, { row: normalizeDetailLayoutValue(raw, DETAIL_LAYOUT_MAX_ROWS) })
}

function formatReadonlyValue(value: string | number | undefined | null): string {
  if (value == null || value === '') return '-'
  return String(value)
}

function resolveNodeMasterLabel(node: Node): string {
  return `${getNodeTypeLabel(node.type)} (${node.type})`
}

function resolveGeneratorRuleLabel(viewMode: 'overview' | 'detail'): string {
  return viewMode === 'overview'
    ? 'Overview legacy adapter'
    : 'Process Detail legacy adapter'
}

function resolveZoneLabel(node: Node): string {
  if (!node.processZone) return '-'
  return PROCESS_ZONES.find((zone) => zone.id === node.processZone)?.label ?? node.processZone
}

function resolveNodeDiagnostics(process: Process, node: Node): string {
  const warnings: string[] = []

  if (node.phaseId && !process.phases.some((phase) => phase.id === node.phaseId)) {
    warnings.push('Process Stage master 미연결')
  }
  if (node.offsetX != null && !Number.isFinite(node.offsetX)) {
    warnings.push('Offset X invalid')
  }
  if (node.offsetY != null && !Number.isFinite(node.offsetY)) {
    warnings.push('Offset Y invalid')
  }
  if (node.laneId && !process.lanes.some((lane) => lane.id === node.laneId)) {
    warnings.push('Swimlane master 미연결')
  }

  return warnings.length > 0 ? warnings.join(', ') : 'OK'
}

function resolveProcessGroupMemberships(
  node: Node,
  process: Process,
  viewMode: 'overview' | 'detail',
  overviewProcessGroups?: OverviewProcessGroup[],
  detailProcessGroups?: DetailProcessGroup[],
): string {
  const groupIds =
    viewMode === 'overview'
      ? overviewProcessGroups
          ?.filter((group) => group.overviewNodeIds.includes(node.id))
          .map((group) => group.id)
      : detailProcessGroups
          ?.filter((group) => group.detailProcessId === process.id)
          .map((group) => group.id)

  return groupIds && groupIds.length > 0 ? groupIds.join(', ') : '-'
}

type PropertyPanelProps = {
  appMode: AppMode
  selectedElement: SelectedElement | null
  process: Process
  viewMode: 'overview' | 'detail'
  reviewMode?: boolean
  detailProcesses?: Process[]
  overviewProcessGroups?: OverviewProcessGroup[]
  detailProcessGroups?: DetailProcessGroup[]
  onOpenDetailProcess?: (processId: string) => void
  onRequestEditMode?: () => void
  onSaveNode: (node: Node, isNew: boolean) => void
  onSaveEdge: (edge: Edge, isNew: boolean, options?: { keepNodeId?: string }) => void
  onSaveLane: (lane: Lane, isNew: boolean) => void
  onSaveZone: (zone: ProcessZone, isNew: boolean) => void
  onSaveProcessGroup?: (group: OverviewProcessGroup) => void
  onSaveDetailProcessGroup?: (group: DetailProcessGroup) => void
  /** Lane Master 전체 목록 — 프로세스별 표시 레인 선택 UI용 */
  masterLanes?: Lane[]
  onSaveProcessLaneDisplay?: (
    processId: string,
    settings: { laneIds?: string[]; autoHideEmptyLanes?: boolean },
  ) => void
  onProcessGroupDraftChange?: (group: OverviewProcessGroup) => void
  savedProcessGroup?: OverviewProcessGroup
  savedDetailProcessGroup?: DetailProcessGroup
  linkedDetailProcessId?: string
  onDeleteNode: (id: string) => void
  onDeleteEdge: (id: string, options?: { keepNodeId?: string }) => void
  onDeleteLane: (id: string) => void
  onDeleteZone: (id: string) => void
  onCancelNew: () => void
  onSelectEdge?: (edgeId: string) => void
  onSelectZone?: (zoneId: string) => void
}

function ViewModeEditHint({ onRequestEditMode }: { onRequestEditMode?: () => void }) {
  if (!onRequestEditMode) return null
  return (
    <div className="property-panel__view-hint">
      <p className="property-panel__hint">보기 모드입니다. 속성을 수정하려면 편집 모드로 전환하세요.</p>
      <button type="button" className="property-panel__btn property-panel__btn--primary" onClick={onRequestEditMode}>
        편집 모드로 전환
      </button>
    </div>
  )
}

function EditItemActions({
  targetLabel,
  error,
  onSave,
  onCancel,
  onDelete,
  canDelete,
}: {
  targetLabel: string
  error?: string | null
  onSave: () => void
  onCancel: () => void
  onDelete?: () => void
  canDelete?: boolean
}) {
  return (
    <div className="property-panel__sticky-toolbar">
      <div className="property-panel__meta">
        <span className="property-panel__badge">{targetLabel}</span>
        <span className="property-panel__badge property-panel__badge--edit">편집</span>
        <div className="property-panel__actions">
          <button type="button" className="property-panel__btn property-panel__btn--primary" onClick={onSave}>
            저장
          </button>
          <button type="button" className="property-panel__btn" onClick={onCancel}>
            취소
          </button>
          {canDelete && onDelete && (
            <button type="button" className="property-panel__btn property-panel__btn--danger" onClick={onDelete}>
              삭제
            </button>
          )}
        </div>
      </div>
      {error && <p className="property-panel__error">{error}</p>}
      <p className="property-panel__hint property-panel__save-hint">
        ⓘ 변경사항은 전체 저장 후 적용됩니다.
      </p>
    </div>
  )
}


function NewItemActions({
  targetLabel,
  error,
  onSave,
  onCancel,
}: {
  targetLabel: string
  error?: string | null
  onSave: () => void
  onCancel: () => void
}) {
  return (
    <div className="property-panel__sticky-toolbar">
      <div className="property-panel__meta">
        <span className="property-panel__badge">{targetLabel}</span>
        <span className="property-panel__badge property-panel__badge--edit">신규</span>
        <div className="property-panel__actions">
          <button type="button" className="property-panel__btn property-panel__btn--primary" onClick={onSave}>
            추가
          </button>
          <button type="button" className="property-panel__btn" onClick={onCancel}>
            취소
          </button>
        </div>
      </div>
      {error && <p className="property-panel__error">{error}</p>}
      <p className="property-panel__hint property-panel__save-hint">
        ⓘ 변경사항은 전체 저장 후 적용됩니다.
      </p>
    </div>
  )
}

function NodeForm({
  node,
  process,
  disabled,
  viewMode,
  connections,
  overviewProcessGroups,
  detailProcessGroups,
  reviewMode = false,
  onChange,
}: {
  node: Node
  process: Process
  disabled: boolean
  viewMode: 'overview' | 'detail'
  connections?: ReactNode
  overviewProcessGroups?: OverviewProcessGroup[]
  detailProcessGroups?: DetailProcessGroup[]
  reviewMode?: boolean
  onChange: (node: Node) => void
}) {
  const sortedLanes = [...process.lanes].sort((a, b) => a.order - b.order)
  const cellSlotWarning = viewMode === 'overview' ? getCellSlotCollisionWarning(node, process) : null
  const isConnector = isConnectorNode(node)
  const connectorSubType = isConnector ? resolveConnectorSubType(node) : undefined
  const overviewNodeType = viewMode === 'overview' ? resolveOverviewNodeType(node) : undefined
  const [legacyStageEditable, setLegacyStageEditable] = useState(false)
  const stageMetadata = node as Node & {
    inferredStageId?: string
    generatorStage?: string
  }
  const processGroupMemberships = resolveProcessGroupMemberships(
    node,
    process,
    viewMode,
    overviewProcessGroups,
    detailProcessGroups,
  )
  const nodeTypeOptions = NODE_FORM_TYPES.some((option) => option.value === node.type)
    ? NODE_FORM_TYPES
    : [
        ...NODE_FORM_TYPES,
        {
          value: node.type,
          label: getNodeTypeLabel(node.type),
        },
      ]

  const patchNodeType = (nextType: NodeType): Node => {
    const nextSystem = getDefaultSystemForNodeType(nextType)
    if (nextType === 'manual') {
      const {
        connectorSubType: _removed,
        overviewType: _overview,
        stepBadge: _stepBadge,
        ...rest
      } = node
      return { ...rest, type: nextType, system: nextSystem } as Node
    }
    if (nextType === 'linked-process') {
      const {
        connectorSubType: _removed,
        overviewType: _overview,
        stepBadge: _stepBadge,
        ...rest
      } = node
      return { ...rest, type: nextType, system: nextSystem } as Node
    }
    if (nextType === 'connector') {
      const { overviewType: _overview, ...rest } = node
      return {
        ...rest,
        type: nextType,
        system: nextSystem,
        connectorSubType: node.connectorSubType ?? 'split',
      }
    }
    const { connectorSubType: _removed, overviewType: _overview, ...rest } = node
    return { ...rest, type: nextType, system: nextSystem } as Node
  }

  return (
    <>
      <div className="property-panel__section">
        <h3 className="property-panel__section-title">기본 정보</h3>
        <div className="property-panel__field">
          <label className="property-panel__label">현재 프로세스</label>
          <input className="property-panel__input" value={process.name} disabled readOnly />
          <p className="property-panel__hint">지금 수정 중인 상세 프로세스입니다. 노드에서 직접 바꾸지 않습니다.</p>
        </div>
        <div className="property-panel__field">
          <label className="property-panel__label">업무명</label>
          <input
            className="property-panel__input"
            value={node.name}
            disabled={disabled}
            onChange={(e) => onChange({ ...node, name: e.target.value })}
          />
        </div>
        <div className="property-panel__field">
          <label className="property-panel__label">노드 유형</label>
          <select
            className="property-panel__select"
            value={node.type}
            disabled={disabled}
            onChange={(e) => {
              onChange(patchNodeType(e.target.value as NodeType))
            }}
          >
            {nodeTypeOptions.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <p className="property-panel__hint">
            {NODE_TYPE_USER_HELP[node.type] ?? NODE_TYPE_META[node.type]?.description ?? '업무 성격에 맞는 노드 유형을 선택합니다.'}
          </p>
        </div>
        {viewMode === 'overview' && overviewNodeType ? (
          <p className="property-panel__hint">
            캔버스 표기: {formatOverviewNodePrimaryLabel({ ...node, overviewType: overviewNodeType })}
            {formatOverviewNodePrimaryLabel({ ...node, overviewType: overviewNodeType }) !== node.name
              ? ''
              : node.system
                ? ` · 부제: ${node.system}`
                : ''}
          </p>
        ) : null}
        {isConnector && (
          <div className="property-panel__field">
            <label className="property-panel__label">연결점 유형</label>
            <select
              className="property-panel__select"
              value={connectorSubType}
              disabled={disabled}
              onChange={(e) =>
                onChange({
                  ...node,
                  type: 'connector',
                  connectorSubType: e.target.value as 'split' | 'merge',
                })
              }
            >
              <option value="split">Split</option>
              <option value="merge">Merge</option>
            </select>
          </div>
        )}
        {viewMode === 'detail' && (
          <div className="property-panel__field">
            <label className="property-panel__label">화면 번호</label>
            <p className="property-panel__hint">
              연결 흐름 기준으로 자동 표시됩니다. 자동 번호는 저장하지 않으며, 번호 제외 노드는 표시하지 않습니다.
            </p>
          </div>
        )}
      </div>

      <div className="property-panel__section">
        <h3 className="property-panel__section-title">담당/시스템</h3>
        <div className="property-panel__field">
          <label className="property-panel__label">담당 조직</label>
          <input
            className="property-panel__input"
            value={node.owner}
            disabled={disabled}
            onChange={(e) => onChange({ ...node, owner: e.target.value })}
          />
        </div>
        <div className="property-panel__field">
          <label className="property-panel__label">사용 시스템</label>
          <input
            className="property-panel__input"
            value={node.system}
            disabled={disabled}
            onChange={(e) => onChange({ ...node, system: e.target.value })}
          />
        </div>
      </div>

      <div className="property-panel__section">
        <h3 className="property-panel__section-title">위치</h3>
        <div className="property-panel__field">
          <label className="property-panel__label">담당 영역</label>
          <select
            className="property-panel__select"
            value={node.laneId}
            disabled={disabled}
            onChange={(e) => onChange({ ...node, laneId: e.target.value })}
          >
            {sortedLanes.map((lane) => (
              <option key={lane.id} value={lane.id}>
                {lane.name} ({lane.id})
              </option>
            ))}
          </select>
        </div>
        {viewMode === 'overview' && (
          <div className="property-panel__field">
            <label className="property-panel__label">프로세스 구역</label>
            <select
              className="property-panel__select"
              value={node.processZone ?? 'business-contract'}
              disabled={disabled}
              onChange={(e) => onChange({ ...node, processZone: e.target.value as ProcessZoneId })}
            >
              {PROCESS_ZONES.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.label}
                </option>
              ))}
            </select>
            <p className="property-panel__hint">Overview에서 업무가 속한 큰 구간입니다.</p>
          </div>
        )}
        <div className="property-panel__field">
          <label className="property-panel__label">표시 순서</label>
          <input
            type="number"
            min={0}
            className="property-panel__input"
            value={node.cellOrder ?? ''}
            disabled={disabled || isConnector}
            placeholder="자동"
            onChange={(e) => {
              const raw = e.target.value
              if (raw === '') {
                const { cellOrder: _removed, ...rest } = node
                onChange(rest as Node)
                return
              }
              const value = Number.parseInt(raw, 10)
              if (!Number.isNaN(value) && value >= 0) {
                onChange({ ...node, cellOrder: value })
              }
            }}
          />
          <p className="property-panel__hint">같은 담당 영역 안에서 왼쪽에서 오른쪽으로 이어지는 업무 순서를 정합니다.</p>
        </div>
        <div className="property-panel__field">
          <label className="property-panel__label">
            행/열 위치
          </label>
          {viewMode === 'detail' ? (
            <div className="property-panel__inline-controls">
              <select
                className="property-panel__select"
                value={resolveDetailColumnValue(node)}
                disabled={disabled || isConnector}
                onChange={(e) => onChange(patchDetailColumn(node, e.target.value))}
              >
                <option value="">자동 열</option>
                {Array.from({ length: DETAIL_LAYOUT_MAX_COLUMNS }, (_, index) => index + 1).map((column) => (
                  <option key={column} value={column}>
                    {column}열
                  </option>
                ))}
              </select>
              <select
                className="property-panel__select"
                value={resolveDetailRowValue(node)}
                disabled={disabled || isConnector}
                onChange={(e) => onChange(patchDetailRow(node, e.target.value))}
              >
                <option value="">자동 행</option>
                {Array.from({ length: DETAIL_LAYOUT_MAX_ROWS }, (_, index) => index + 1).map((row) => (
                  <option key={row} value={row}>
                    {row}행
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <select
              className="property-panel__select"
              value={node.cellSlot ?? ''}
              disabled={disabled || isConnector}
              onChange={(e) => {
                const raw = e.target.value
                if (raw === '') {
                  const { cellSlot: _removed, ...rest } = node
                  onChange(rest as Node)
                  return
                }
                const v = Number.parseInt(raw, 10)
                if (!Number.isNaN(v) && v >= 1 && v <= OVERVIEW_CELL_SLOT_MAX) onChange({ ...node, cellSlot: v })
              }}
            >
              <option value="">자동</option>
              {listCellSlotOptions(OVERVIEW_CELL_SLOT_MAX, OVERVIEW_CELL_MAX_ROWS).map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          )}
          <p className="property-panel__hint">
            {viewMode === 'detail'
              ? `프로세스 상세에서는 열(진행 위치)과 1~${DETAIL_LAYOUT_MAX_ROWS}행을 지정합니다. 자동이면 노드 유형과 순서 기준으로 배치합니다.`
              : `Overview에서는 좌/우 영역의 표시 위치입니다. 미지정 시 자동 배치합니다.`}
          </p>
          {cellSlotWarning && (
            <p className="property-panel__hint property-panel__hint--warn">{cellSlotWarning}</p>
          )}
          {isConnector && (
            <p className="property-panel__hint">Connector는 연결 관계 기준으로 자동 배치됩니다.</p>
          )}
        </div>
      </div>

      {connections}

      {reviewMode ? (
        <div className="property-panel__section property-panel__section--review">
          <h3 className="property-panel__section-title">Internal Review</h3>
          <div className="property-panel__field">
            <label className="property-panel__label">Review Status</label>
            <select
              className="property-panel__select"
              value={node.review?.status ?? 'not-reviewed'}
              disabled={disabled}
              onChange={(e) => onChange(updateNodeReview(node, { status: e.target.value as NodeReviewStatus }))}
            >
              {NODE_REVIEW_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="property-panel__field">
            <label className="property-panel__label">Reviewer</label>
            <select
              className="property-panel__select"
              value={node.review?.reviewer ?? ''}
              disabled={disabled}
              onChange={(e) => onChange(updateNodeReview(node, { reviewer: e.target.value || undefined }))}
            >
              <option value="">선택</option>
              {NODE_REVIEWERS.map((reviewer) => (
                <option key={reviewer} value={reviewer}>
                  {reviewer}
                </option>
              ))}
            </select>
          </div>
          <div className="property-panel__field">
            <label className="property-panel__label">Comment</label>
            <textarea
              className="property-panel__textarea"
              value={node.review?.comment ?? ''}
              disabled={disabled}
              onChange={(e) => onChange(updateNodeReview(node, { comment: e.target.value }))}
            />
          </div>
          <div className="property-panel__field">
            <label className="property-panel__label">Reviewed Date</label>
            <input
              className="property-panel__input"
              value={formatReviewDate(node.review?.reviewedAt)}
              disabled
              readOnly
            />
            <p className="property-panel__hint">OK 또는 Review Required로 저장할 때 자동으로 기록됩니다.</p>
          </div>
        </div>
      ) : null}

      <div className="property-panel__section">
        <h3 className="property-panel__section-title">설명/메모</h3>
        <div className="property-panel__field">
          <label className="property-panel__label">설명</label>
          <textarea
            className="property-panel__textarea"
            value={node.description}
            disabled={disabled}
            onChange={(e) => onChange({ ...node, description: e.target.value })}
          />
          <p className="property-panel__hint">현업 검토 시 이 업무에서 확인해야 할 내용을 적습니다.</p>
        </div>
      </div>

      <details className="property-panel__advanced">
        <summary className="property-panel__advanced-summary">Advanced / Developer</summary>
        <div className="property-panel__section property-panel__section--advanced">
          <h3 className="property-panel__section-title">Documentation Metadata</h3>
          <p className="property-panel__hint">
            입력값, 출력값, 통제는 현재 layout/routing/generator의 핵심 입력이 아닌 업무 설명용 metadata입니다.
          </p>
          <ListEditor label="입력값" items={node.inputs} disabled={disabled} onChange={(inputs) => onChange({ ...node, inputs })} />
          <ListEditor label="출력값" items={node.outputs} disabled={disabled} onChange={(outputs) => onChange({ ...node, outputs })} />
          <ListEditor label="통제" items={node.controls} disabled={disabled} onChange={(controls) => onChange({ ...node, controls })} />
        </div>
        <div className="property-panel__section property-panel__section--advanced">
          <h3 className="property-panel__section-title">Business Activity</h3>
          <div className="property-panel__field">
            <label className="property-panel__label">Activity</label>
            <input className="property-panel__input" value={node.name} disabled readOnly />
          </div>
          <div className="property-panel__field">
            <label className="property-panel__label">Node Master</label>
            <input className="property-panel__input" value={resolveNodeMasterLabel(node)} disabled readOnly />
          </div>
          <div className="property-panel__field">
            <label className="property-panel__label">Generator</label>
            <input className="property-panel__input" value={resolveGeneratorRuleLabel(viewMode)} disabled readOnly />
          </div>
        </div>
        <div className="property-panel__section property-panel__section--advanced">
          <h3 className="property-panel__section-title">Legacy Stage Metadata</h3>
          <p className="property-panel__hint">
            현재 Stage 값은 내부 보조 정보이며, 화면 배치는 담당 영역 / 프로세스 구역 / 표시 순서 / 행·열 위치 기준으로 결정됩니다.
          </p>
          <label className="property-panel__checkbox-item property-panel__field--inline">
            <input
              type="checkbox"
              checked={legacyStageEditable}
              disabled={disabled}
              onChange={(e) => setLegacyStageEditable(e.target.checked)}
            />
            <span>Edit legacy stage metadata</span>
          </label>
          <div className="property-panel__field">
            <label className="property-panel__label">phaseId</label>
            {legacyStageEditable && process.phases.length > 0 ? (
              <select
                className="property-panel__select"
                value={node.phaseId}
                disabled={disabled}
                onChange={(e) => {
                  const phase = process.phases.find((p) => p.id === e.target.value)
                  onChange({
                    ...node,
                    phaseId: e.target.value,
                    ...(phase ? { phaseOrder: phase.order } : {}),
                  })
                }}
              >
                {[...process.phases]
                  .sort((a, b) => a.order - b.order)
                  .map((phase) => (
                    <option key={phase.id} value={phase.id}>
                      {phase.label} ({phase.id})
                    </option>
                  ))}
              </select>
            ) : (
              <input className="property-panel__input" value={formatReadonlyValue(node.phaseId)} disabled readOnly />
            )}
          </div>
          <div className="property-panel__field">
            <label className="property-panel__label">phaseOrder</label>
            <input
              type={legacyStageEditable ? 'number' : 'text'}
              min={0}
              className="property-panel__input"
              value={legacyStageEditable ? node.phaseOrder ?? '' : formatReadonlyValue(node.phaseOrder)}
              disabled={disabled || !legacyStageEditable}
              readOnly={!legacyStageEditable}
              onChange={(e) => {
                if (e.target.value === '') {
                  const { phaseOrder: _removed, ...rest } = node
                  onChange(rest as Node)
                  return
                }
                const value = Number.parseInt(e.target.value, 10)
                if (!Number.isNaN(value) && value >= 0) {
                  onChange({ ...node, phaseOrder: value })
                }
              }}
            />
          </div>
          <dl className="property-panel__dl property-panel__dl--compact">
            <div className="property-panel__dl-row"><dt>currentPhaseLabel</dt><dd>{getPhaseLabel(process, node.phaseId)}</dd></div>
            <div className="property-panel__dl-row"><dt>inferredStageId</dt><dd>{formatReadonlyValue(stageMetadata.inferredStageId)}</dd></div>
            <div className="property-panel__dl-row"><dt>generatorStage</dt><dd>{formatReadonlyValue(stageMetadata.generatorStage)}</dd></div>
            <div className="property-panel__dl-row"><dt>stage diagnostics</dt><dd>{resolveNodeDiagnostics(process, node)}</dd></div>
          </dl>
        </div>
        <div className="property-panel__section property-panel__section--advanced">
          <h3 className="property-panel__section-title">Developer Info</h3>
          <dl className="property-panel__dl property-panel__dl--compact">
            <div className="property-panel__dl-row"><dt>nodeId</dt><dd>{node.id}</dd></div>
            <div className="property-panel__dl-row"><dt>businessActivityId</dt><dd>-</dd></div>
            <div className="property-panel__dl-row"><dt>nodeMasterId</dt><dd>{node.type}</dd></div>
            <div className="property-panel__dl-row"><dt>processId</dt><dd>{process.id}</dd></div>
            <div className="property-panel__dl-row"><dt>phaseId</dt><dd>{formatReadonlyValue(node.phaseId)}</dd></div>
            <div className="property-panel__dl-row"><dt>phaseOrder</dt><dd>{formatReadonlyValue(node.phaseOrder)}</dd></div>
            <div className="property-panel__dl-row"><dt>zoneId</dt><dd>{formatReadonlyValue(node.processZone)}</dd></div>
            <div className="property-panel__dl-row"><dt>zone</dt><dd>{resolveZoneLabel(node)}</dd></div>
            <div className="property-panel__dl-row"><dt>processGroupIds</dt><dd>{processGroupMemberships}</dd></div>
            <div className="property-panel__dl-row"><dt>cellOrder</dt><dd>{formatReadonlyValue(node.cellOrder)}</dd></div>
            <div className="property-panel__dl-row"><dt>cellSlot</dt><dd>{formatReadonlyValue(node.cellSlot)}</dd></div>
            <div className="property-panel__dl-row"><dt>detailColumn</dt><dd>{formatReadonlyValue(node.detailLayout?.column)}</dd></div>
            <div className="property-panel__dl-row"><dt>detailRow</dt><dd>{formatReadonlyValue(node.detailLayout?.row)}</dd></div>
            <div className="property-panel__dl-row"><dt>offsetX</dt><dd>{formatReadonlyValue(node.offsetX)}</dd></div>
            <div className="property-panel__dl-row"><dt>offsetY</dt><dd>{formatReadonlyValue(node.offsetY)}</dd></div>
            <div className="property-panel__dl-row"><dt>diagnostics</dt><dd>{resolveNodeDiagnostics(process, node)}</dd></div>
          </dl>
        </div>
      </details>
    </>
  )
}

function NodeView({
  node,
  process,
  viewMode,
  reviewMode = false,
  detailProcesses,
  onOpenDetailProcess,
}: {
  node: Node
  process: Process
  viewMode: 'overview' | 'detail'
  reviewMode?: boolean
  detailProcesses?: Process[]
  onOpenDetailProcess?: (processId: string) => void
}) {
  const lane = getLaneById(process, node.laneId)
  const overviewNodeType = viewMode === 'overview' ? resolveOverviewNodeType(node) : undefined
  const displayName =
    viewMode === 'overview' ? formatOverviewNodePrimaryLabel(node) : node.name
  return (
    <>
      <span
        className={`node-detail__type node-detail__type--${viewMode === 'overview' ? overviewNodeType : node.type}`}
      >
        {viewMode === 'overview' && overviewNodeType
          ? getOverviewNodeTypeLabel(overviewNodeType)
          : getNodeTypeLabel(node.type)}
      </span>
      <h2 className="property-panel__view-name">{displayName}</h2>
      <p className="property-panel__view-desc">{node.description || '설명 없음'}</p>
      <dl className="property-panel__dl">
        <div className="property-panel__dl-row"><dt>담당 영역</dt><dd>{lane?.name ?? node.laneId}</dd></div>
        <div className="property-panel__dl-row"><dt>담당</dt><dd>{node.owner || '-'}</dd></div>
        <div className="property-panel__dl-row"><dt>시스템</dt><dd>{node.system || '-'}</dd></div>
      </dl>
      {reviewMode ? (
        <div className="property-panel__section property-panel__section--review">
          <h3 className="property-panel__section-title">Internal Review</h3>
          <dl className="property-panel__dl property-panel__dl--compact">
            <div className="property-panel__dl-row">
              <dt>Status</dt>
              <dd>{NODE_REVIEW_STATUS_OPTIONS.find((option) => option.value === (node.review?.status ?? 'not-reviewed'))?.label}</dd>
            </div>
            <div className="property-panel__dl-row"><dt>Reviewer</dt><dd>{node.review?.reviewer ?? '-'}</dd></div>
            <div className="property-panel__dl-row"><dt>Reviewed Date</dt><dd>{formatReviewDate(node.review?.reviewedAt)}</dd></div>
            <div className="property-panel__dl-row"><dt>Comment</dt><dd>{node.review?.comment || '-'}</dd></div>
          </dl>
        </div>
      ) : null}
      {viewMode === 'overview' && detailProcesses && onOpenDetailProcess ? (
        <DetailProcessLinks
          node={node}
          detailProcesses={detailProcesses}
          onOpenDetailProcess={onOpenDetailProcess}
        />
      ) : null}
    </>
  )
}

function EdgeForm({
  edge,
  process,
  disabled,
  viewMode: _viewMode,
  onChange,
}: {
  edge: Edge
  process: Process
  disabled: boolean
  viewMode: 'overview' | 'detail'
  onChange: (edge: Edge) => void
}) {
  const isDerived = isDerivedDisplayEdge(edge)
  const readOnly = disabled || isReadOnlyDisplayEdge(edge)

  return (
    <>
      {isDerived && (
        <p className="property-panel__hint">
          업무 보기에서 API 숨김으로 생성된 임시 연결선입니다. 시스템 보기에서 원본 연결선을 수정하세요.
        </p>
      )}
      {edge.type === 'virtual' && !isDerived && (
        <p className="property-panel__hint">
          표시 전용 연결선입니다. 이전 업무, 다음 업무, 연결 라벨을 수정하고 저장할 수 있습니다.
        </p>
      )}
      <div className="property-panel__section">
        <h3 className="property-panel__section-title">연결 관계</h3>
        <EdgeConnectionFields
          edge={edge}
          process={process}
          disabled={readOnly}
          direction="both"
          onChange={(nextEdge) => onChange(withEdgeHandleDefaults(nextEdge))}
        />
        {edge.labelPlacement?.point && (
          <button
            type="button"
            className="property-panel__button"
            disabled={readOnly}
            onClick={() => onChange(withEdgeHandleDefaults({ ...edge, labelPlacement: undefined }))}
          >
            라벨 위치 자동
          </button>
        )}
      </div>
    </>
  )
}

function ProcessGroupForm({
  group,
  process,
  detailProcessGroups,
  disabled,
  onChange,
  onOpenDetailProcess,
  linkedDetailProcessId,
}: {
  group: OverviewProcessGroup
  process: Process
  detailProcessGroups: DetailProcessGroup[]
  disabled: boolean
  onChange: (group: OverviewProcessGroup) => void
  onOpenDetailProcess?: (processId: string) => void
  linkedDetailProcessId?: string
}) {
  const selectableNodes = sortNodesForSelect(
    process.nodes.filter((node) => node.type !== 'phase-connector' && node.type !== 'merge'),
  )

  const toggleNode = (node: Node) => {
    const include = !isNodeInProcessGroup(group, node.id)
    onChange(setProcessGroupNodeMembership(group, node.id, include, process.edges))
  }

  return (
    <div className="property-panel__section">
      <h3 className="property-panel__section-title">프로세스 그룹</h3>
      <div className="property-panel__field">
        <label className="property-panel__label">그룹명</label>
        <input
          className="property-panel__input"
          value={group.name}
          disabled={disabled}
          onChange={(e) => onChange({ ...group, name: e.target.value })}
        />
      </div>
      <div className="property-panel__field">
        <label className="property-panel__label">설명</label>
        <textarea
          className="property-panel__textarea"
          value={group.description}
          disabled={disabled}
          onChange={(e) => onChange({ ...group, description: e.target.value })}
        />
      </div>
      <div className="property-panel__field">
        <label className="property-panel__label">Lifecycle Group</label>
        <select
          className="property-panel__select"
          value={group.lifecycleGroupId ?? ''}
          disabled={disabled}
          onChange={(e) => {
            const value = e.target.value
            if (!value) {
              const { lifecycleGroupId: _removed, ...rest } = group
              onChange(rest)
              return
            }
            onChange({ ...group, lifecycleGroupId: value as OverviewProcessGroup['lifecycleGroupId'] })
          }}
        >
          <option value="">연결 상세 기준 자동 배치</option>
          {PROCESS_LIFECYCLE_GROUPS.map((lifecycleGroup) => (
            <option key={lifecycleGroup.id} value={lifecycleGroup.id}>
              {lifecycleGroup.label}
            </option>
          ))}
        </select>
        <p className="property-panel__hint">
          Overview 메뉴에서 이 그룹이 표시될 상위 Lifecycle입니다. 비우면 연결된 상세 프로세스 기준으로 자동 배치됩니다.
        </p>
      </div>
      <div className="property-panel__field">
        <label className="property-panel__label">그룹 ID</label>
        <input className="property-panel__input" value={group.id} disabled readOnly />
      </div>
      <div className="property-panel__field">
        <label className="property-panel__label">연결 상세 그룹</label>
        <select
          className="property-panel__select"
          value={group.linkedDetailGroupId ?? ''}
          disabled={disabled}
          onChange={(e) => {
            const value = e.target.value
            if (!value) {
              const { linkedDetailGroupId: _removed, ...rest } = group
              onChange(rest)
              return
            }
            onChange({ ...group, linkedDetailGroupId: value })
          }}
        >
          <option value="">연결 없음</option>
          {detailProcessGroups.map((detailGroup) => (
            <option key={detailGroup.id} value={detailGroup.id}>
              {detailGroup.name} ({detailGroup.id})
            </option>
          ))}
        </select>
      </div>
      <div className="property-panel__field">
        <label className="property-panel__label">포함 요소</label>
        <p className="property-panel__hint">
          노드 {group.overviewNodeIds.length}개 · 연결선 {group.overviewEdgeIds.length}개
        </p>
      </div>
      <div className="property-panel__field">
        <label className="property-panel__label">포함 업무</label>
        <p className="property-panel__hint">
          노드를 추가하면 해당 노드와 직접 연결되고 양쪽 끝점이 모두 포함된 연결선만 추가됩니다. 저장 버튼으로 확정하세요.
        </p>
        <div className="property-panel__checkbox-list">
          {selectableNodes.map((node) => (
            <label key={node.id} className="property-panel__checkbox-item">
              <input
                type="checkbox"
                checked={isNodeInProcessGroup(group, node.id)}
                disabled={disabled}
                onChange={() => toggleNode(node)}
              />
              <span>{formatNodeSelectLabel(node)}</span>
            </label>
          ))}
        </div>
      </div>
      {onOpenDetailProcess && linkedDetailProcessId && (
        <div className="property-panel__field">
          <button
            type="button"
            className="property-panel__btn property-panel__btn--primary"
            onClick={() => onOpenDetailProcess(linkedDetailProcessId)}
          >
            연결된 상세 프로세스 열기
          </button>
        </div>
      )}
      <p className="property-panel__hint">
        그룹을 선택한 뒤 포함 노드를 클릭하면 관련 연결선과 라벨이 강조됩니다.
      </p>
    </div>
  )
}

function DetailProcessGroupForm({
  group,
  detailProcesses,
  overviewProcessGroups,
  masterLanes,
  processLaneIds,
  autoHideEmptyLanes,
  disabled,
  onChange,
  onProcessLaneIdsChange,
  onAutoHideEmptyLanesChange,
  onOpenDetailProcess,
}: {
  group: DetailProcessGroup
  detailProcesses: Process[]
  overviewProcessGroups: OverviewProcessGroup[]
  masterLanes: Lane[]
  /** null = 전체 레인 표시 */
  processLaneIds: string[] | null
  autoHideEmptyLanes: boolean
  disabled: boolean
  onChange: (group: DetailProcessGroup) => void
  onProcessLaneIdsChange: (laneIds: string[] | null) => void
  onAutoHideEmptyLanesChange: (enabled: boolean) => void
  onOpenDetailProcess?: (processId: string) => void
}) {
  const linkedProcess = detailProcesses.find((entry) => entry.id === group.detailProcessId)
  const usedLaneIds = new Set((linkedProcess?.nodes ?? []).map((node) => node.laneId))
  const selectedLaneIds = processLaneIds ?? masterLanes.map((lane) => lane.id)
  const toggleLane = (laneId: string, checked: boolean) => {
    const next = new Set(selectedLaneIds)
    if (checked) next.add(laneId)
    else next.delete(laneId)
    const ordered = masterLanes.map((lane) => lane.id).filter((id) => next.has(id))
    onProcessLaneIdsChange(ordered.length === masterLanes.length ? null : ordered)
  }
  return (
    <div className="property-panel__section">
      <h3 className="property-panel__section-title">프로세스 상세 그룹</h3>
      <div className="property-panel__field">
        <label className="property-panel__label">그룹명</label>
        <input
          className="property-panel__input"
          value={group.name}
          disabled={disabled}
          onChange={(e) => onChange({ ...group, name: e.target.value })}
        />
      </div>
      <div className="property-panel__field">
        <label className="property-panel__label">설명</label>
        <textarea
          className="property-panel__textarea"
          value={group.description}
          disabled={disabled}
          onChange={(e) => onChange({ ...group, description: e.target.value })}
        />
      </div>
      <div className="property-panel__field">
        <label className="property-panel__label">Lifecycle Group</label>
        <select
          className="property-panel__select"
          value={group.lifecycleGroupId ?? ''}
          disabled={disabled}
          onChange={(e) => {
            const value = e.target.value
            if (!value) {
              const { lifecycleGroupId: _removed, ...rest } = group
              onChange(rest)
              return
            }
            onChange({ ...group, lifecycleGroupId: value as DetailProcessGroup['lifecycleGroupId'] })
          }}
        >
          <option value="">기본 분류 기준 자동 배치</option>
          {PROCESS_LIFECYCLE_GROUPS.map((lifecycleGroup) => (
            <option key={lifecycleGroup.id} value={lifecycleGroup.id}>
              {lifecycleGroup.label}
            </option>
          ))}
        </select>
        <p className="property-panel__hint">
          프로세스 상세 메뉴에서 이 프로세스가 속할 Lifecycle 카테고리입니다. 복제된 프로세스는 원본 카테고리를 이어받습니다.
        </p>
      </div>
      {masterLanes.length > 0 ? (
        <div className="property-panel__field">
          <label className="property-panel__label">표시 레인</label>
          <label className="property-panel__checkbox-item">
            <input
              type="checkbox"
              checked={autoHideEmptyLanes}
              disabled={disabled}
              onChange={(e) => onAutoHideEmptyLanesChange(e.target.checked)}
            />
            <span>노드 없는 레인 자동 숨김</span>
          </label>
          <div className="property-panel__checkbox-list">
            {masterLanes.map((lane) => {
              const used = usedLaneIds.has(lane.id)
              const checked = selectedLaneIds.includes(lane.id)
              const autoHidden = autoHideEmptyLanes && !used
              return (
                <label key={lane.id} className="property-panel__checkbox-item">
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={disabled || used || autoHideEmptyLanes}
                    onChange={(e) => toggleLane(lane.id, e.target.checked)}
                  />
                  <span>
                    {lane.name}
                    {used ? ' (노드 배치됨)' : autoHidden && checked ? ' (자동 숨김)' : ''}
                  </span>
                </label>
              )
            })}
          </div>
          <p className="property-panel__hint">
            {autoHideEmptyLanes
              ? '노드가 있는 레인만 표시됩니다. 노드를 추가/삭제하면 레인이 자동으로 나타나고 사라집니다.'
              : '이 프로세스 상세에 표시할 스윔레인입니다. 노드가 배치된 레인은 해제할 수 없고, 전체 선택 시 새 레인이 추가되면 자동으로 함께 표시됩니다.'}
          </p>
        </div>
      ) : null}
      <div className="property-panel__field">
        <label className="property-panel__label">그룹 ID</label>
        <input className="property-panel__input" value={group.id} disabled readOnly />
      </div>
      <div className="property-panel__field">
        <label className="property-panel__label">연결 상세 프로세스</label>
        <select
          className="property-panel__select"
          value={group.detailProcessId}
          disabled={disabled}
          onChange={(e) => {
            const process = detailProcesses.find((entry) => entry.id === e.target.value)
            onChange({
              ...group,
              detailProcessId: e.target.value,
              name: group.name.trim() ? group.name : (process?.name ?? group.name),
              description: group.description.trim() ? group.description : (process?.description ?? group.description),
            })
          }}
        >
          <option value="">선택…</option>
          {detailProcesses.map((process) => (
            <option key={process.id} value={process.id}>
              {process.name} ({process.id})
            </option>
          ))}
        </select>
      </div>
      <div className="property-panel__field">
        <label className="property-panel__label">연결 Overview 그룹</label>
        <select
          className="property-panel__select"
          value={group.linkedOverviewGroupId ?? ''}
          disabled={disabled}
          onChange={(e) => {
            const value = e.target.value
            if (!value) {
              const { linkedOverviewGroupId: _removed, ...rest } = group
              onChange(rest)
              return
            }
            onChange({ ...group, linkedOverviewGroupId: value })
          }}
        >
          <option value="">연결 없음</option>
          {overviewProcessGroups.map((overviewGroup) => (
            <option key={overviewGroup.id} value={overviewGroup.id}>
              {overviewGroup.name} ({overviewGroup.id})
            </option>
          ))}
        </select>
      </div>
      {onOpenDetailProcess && group.detailProcessId ? (
        <div className="property-panel__field">
          <button
            type="button"
            className="property-panel__btn property-panel__btn--primary"
            onClick={() => onOpenDetailProcess(group.detailProcessId)}
          >
            상세 프로세스 열기
          </button>
        </div>
      ) : null}
      <p className="property-panel__hint">
        이 그룹은 프로세스 상세 좌측 메뉴에 표시되며, 선택 시 연결된 상세 프로세스 화면을 엽니다.
      </p>
    </div>
  )
}

function LaneForm({ lane, disabled, onChange }: { lane: Lane; disabled: boolean; onChange: (lane: Lane) => void }) {
  return (
    <>
      <div className="property-panel__section">
        <h3 className="property-panel__section-title">담당 영역 설정</h3>
        <div className="property-panel__field"><label className="property-panel__label">담당 영역 이름</label><input className="property-panel__input" value={lane.name} disabled={disabled} onChange={(e) => onChange({ ...lane, name: e.target.value })} /></div>
        <div className="property-panel__field"><label className="property-panel__label">담당 영역 ID</label><input className="property-panel__input" value={lane.id} disabled readOnly /></div>
        <div className="property-panel__field"><label className="property-panel__label">표시 순서</label><input type="number" min={1} className="property-panel__input" value={lane.order} disabled={disabled} onChange={(e) => { const v = Number.parseInt(e.target.value, 10); if (!Number.isNaN(v) && v > 0) onChange({ ...lane, order: v }) }} /></div>
        <div className="property-panel__field"><label className="property-panel__label">관련 조직</label><input className="property-panel__input" value={lane.ownerDepartment} disabled={disabled} onChange={(e) => onChange({ ...lane, ownerDepartment: e.target.value })} /></div>
        <div className="property-panel__field"><label className="property-panel__label">높이</label><input className="property-panel__input" value="자동 (레이아웃)" disabled readOnly /></div>
        <div className="property-panel__field"><label className="property-panel__label">설명</label><textarea className="property-panel__textarea" value={lane.description ?? ''} disabled={disabled} onChange={(e) => onChange({ ...lane, description: e.target.value })} /></div>
      </div>
    </>
  )
}

function OverviewZoneForm({
  zoneDef,
  process,
  disabled,
  onSaveNode,
}: {
  zoneDef: ProcessZoneDef
  process: Process
  disabled: boolean
  onSaveNode: (node: Node, isNew: boolean) => void
}) {
  const selectableNodes = sortNodesForSelect(
    process.nodes.filter((node) => node.type !== 'phase-connector' && node.type !== 'merge'),
  )

  const toggleNode = (node: Node) => {
    const include = !isNodeInOverviewZone(node, zoneDef.id)
    const next = setNodeOverviewZoneMembership(node, zoneDef.id, include)
    onSaveNode(next, false)
  }

  return (
    <div className="property-panel__section">
        <h3 className="property-panel__section-title">업무 구역 설정</h3>
      <div className="property-panel__field">
        <label className="property-panel__label">구역 이름</label>
        <input className="property-panel__input" value={zoneDef.label} disabled readOnly />
      </div>
      <div className="property-panel__field">
        <label className="property-panel__label">구역 ID</label>
        <input className="property-panel__input" value={zoneDef.id} disabled readOnly />
      </div>
      <div className="property-panel__field">
        <label className="property-panel__label">포함 업무</label>
        <p className="property-panel__hint">체크 변경 시 즉시 반영되며 구역 높이가 재계산됩니다.</p>
        <div className="property-panel__checkbox-list">
          {selectableNodes.map((node) => (
            <label key={node.id} className="property-panel__checkbox-item">
              <input
                type="checkbox"
                checked={isNodeInOverviewZone(node, zoneDef.id)}
                disabled={disabled}
                onChange={() => toggleNode(node)}
              />
              <span>{formatNodeSelectLabel(node)}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  )
}

function ProcessZoneList({
  zones,
  onSelect,
}: {
  zones: ProcessZone[]
  onSelect: (zoneId: string) => void
}) {
  if (zones.length === 0) return null

  return (
    <div className="property-panel__section">
      <h3 className="property-panel__section-title">프로세스 구역 목록</h3>
      <p className="property-panel__hint">생성된 구역을 클릭하면 이름·포함 업무·표시 방식을 수정할 수 있습니다.</p>
      <ul className="property-panel__zone-list">
        {zones.map((zone) => (
          <li key={zone.id}>
            <button type="button" className="property-panel__zone-list-btn" onClick={() => onSelect(zone.id)}>
              <span>{zone.name}</span>
              <span className="property-panel__checkbox-meta">{zone.nodeIds.length} nodes</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function ZoneForm({
  zone,
  process,
  disabled,
  isNew,
  onChange,
  onApply,
}: {
  zone: ProcessZone
  process: Process
  disabled: boolean
  isNew?: boolean
  onChange: (zone: ProcessZone) => void
  onApply?: (zone: ProcessZone) => void
}) {
  const applyChange = (updated: ProcessZone) => {
    onChange(updated)
    if (!isNew) onApply?.(updated)
  }

  const selectableNodes = sortNodesForSelect(
    process.nodes.filter((node) => node.type !== 'phase-connector'),
  )

  const toggleNode = (nodeId: string) => {
    const next = zone.nodeIds.includes(nodeId)
      ? zone.nodeIds.filter((id) => id !== nodeId)
      : [...zone.nodeIds, nodeId]
    applyChange({ ...zone, nodeIds: next })
  }

  const style = zone.style ?? {}

  return (
    <div className="property-panel__section">
      <h3 className="property-panel__section-title">프로세스 구역 설정</h3>
      <div className="property-panel__field">
        <label className="property-panel__label">구역 이름</label>
        <input
          className="property-panel__input"
          value={zone.name}
          disabled={disabled}
          onChange={(e) => applyChange({ ...zone, name: e.target.value })}
        />
      </div>
      <div className="property-panel__field">
        <label className="property-panel__label">구역 ID</label>
        <input className="property-panel__input" value={zone.id} disabled readOnly />
      </div>
      <div className="property-panel__field">
        <label className="property-panel__label">구역 이름 위치</label>
        <select
          className="property-panel__select"
          value={style.labelPosition ?? 'top'}
          disabled={disabled}
          onChange={(e) =>
            applyChange({
              ...zone,
              style: {
                ...style,
                labelPosition: e.target.value as NonNullable<ProcessZone['style']['labelPosition']>,
              },
            })
          }
        >
          <option value="top">상단</option>
          <option value="bottom">하단</option>
          <option value="left">좌측</option>
          <option value="right">우측</option>
          <option value="hidden">숨김</option>
        </select>
      </div>
      <div className="property-panel__field">
        <label className="property-panel__label">포함 업무</label>
        <p className="property-panel__hint">체크 변경 시 프로세스 구역이 즉시 갱신됩니다.</p>
        <div className="property-panel__checkbox-list">
          {selectableNodes.map((node) => (
            <label key={node.id} className="property-panel__checkbox-item">
              <input
                type="checkbox"
                checked={zone.nodeIds.includes(node.id)}
                disabled={disabled}
                onChange={() => toggleNode(node.id)}
              />
              <span>{node.name}</span>
              <span className="property-panel__checkbox-meta">{node.id}</span>
            </label>
          ))}
        </div>
      </div>
      <div className="property-panel__field property-panel__field--inline">
        <label className="property-panel__checkbox-item">
          <input
            type="checkbox"
            checked={style.showBackground ?? true}
            disabled={disabled}
            onChange={(e) =>
              applyChange({ ...zone, style: { ...style, showBackground: e.target.checked } })
            }
          />
          <span>Background 표시</span>
        </label>
      </div>
      <div className="property-panel__field property-panel__field--inline">
        <label className="property-panel__checkbox-item">
          <input
            type="checkbox"
            checked={style.showBorder ?? true}
            disabled={disabled}
            onChange={(e) =>
              applyChange({ ...zone, style: { ...style, showBorder: e.target.checked } })
            }
          />
          <span>Border 표시</span>
        </label>
      </div>
      <div className="property-panel__field">
        <label className="property-panel__label">Border style</label>
        <select
          className="property-panel__input"
          value={style.borderStyle ?? 'dashed'}
          disabled={disabled}
          onChange={(e) =>
            applyChange({
              ...zone,
              style: { ...style, borderStyle: e.target.value as 'dashed' | 'solid' },
            })
          }
        >
          <option value="dashed">dashed</option>
          <option value="solid">solid</option>
        </select>
      </div>
      <div className="property-panel__field">
        <label className="property-panel__label">배경색</label>
        <input
          type="color"
          className="property-panel__input property-panel__input--color"
          value={style.fill ?? '#94a3b8'}
          disabled={disabled}
          onChange={(e) =>
            applyChange({ ...zone, style: { ...style, fill: e.target.value } })
          }
        />
      </div>
      <div className="property-panel__field">
        <label className="property-panel__label">테두리색</label>
        <input
          type="color"
          className="property-panel__input property-panel__input--color"
          value={style.stroke ?? '#64748b'}
          disabled={disabled}
          onChange={(e) =>
            applyChange({ ...zone, style: { ...style, stroke: e.target.value } })
          }
        />
      </div>
      <div className="property-panel__field">
        <label className="property-panel__label">투명도</label>
        <input
          type="range"
          min={0}
          max={0.4}
          step={0.01}
          className="property-panel__input"
          value={style.opacity ?? 0.12}
          disabled={disabled}
          onChange={(e) =>
            applyChange({
              ...zone,
              style: { ...style, opacity: Number.parseFloat(e.target.value) },
            })
          }
        />
      </div>
      <div className="property-panel__field">
        <label className="property-panel__label">좌우 여백</label>
        <input
          type="number"
          min={8}
          max={80}
          className="property-panel__input"
          value={style.paddingX ?? 24}
          disabled={disabled}
          onChange={(e) => {
            const value = Number.parseInt(e.target.value, 10)
            if (!Number.isNaN(value)) {
              applyChange({ ...zone, style: { ...style, paddingX: value } })
            }
          }}
        />
      </div>
      <div className="property-panel__field">
        <label className="property-panel__label">상단 제목 여백</label>
        <input
          type="number"
          min={18}
          max={96}
          className="property-panel__input"
          value={style.headerHeight ?? 36}
          disabled={disabled}
          onChange={(e) => {
            const value = Number.parseInt(e.target.value, 10)
            if (!Number.isNaN(value)) {
              applyChange({ ...zone, style: { ...style, headerHeight: value } })
            }
          }}
        />
      </div>
      <div className="property-panel__field">
        <label className="property-panel__label">하단 여백</label>
        <input
          type="number"
          min={8}
          max={96}
          className="property-panel__input"
          value={style.paddingBottom ?? 32}
          disabled={disabled}
          onChange={(e) => {
            const value = Number.parseInt(e.target.value, 10)
            if (!Number.isNaN(value)) {
              applyChange({ ...zone, style: { ...style, paddingBottom: value } })
            }
          }}
        />
      </div>
    </div>
  )
}

type PropertyPanelEditorProps = PropertyPanelProps & {
  selectedElement: SelectedElement
}

function PropertyPanelEditor(props: PropertyPanelEditorProps) {
  const {
    appMode,
    selectedElement,
    process,
    viewMode,
    reviewMode,
    detailProcesses,
    onOpenDetailProcess,
    onSaveNode,
    onSaveEdge,
    onSaveLane,
    onSaveZone,
    onSaveProcessGroup,
    onSaveDetailProcessGroup,
    masterLanes,
    onSaveProcessLaneDisplay,
    onProcessGroupDraftChange,
    savedProcessGroup,
    savedDetailProcessGroup,
    linkedDetailProcessId,
    onDeleteNode,
    onDeleteEdge,
    onDeleteLane,
    onDeleteZone,
    onCancelNew,
    onSelectEdge,
    onRequestEditMode,
  } = props

  const isEditMode = appMode === 'edit'

  const [draftNode, setDraftNode] = useState<Node | null>(
    selectedElement.type === 'node' || selectedElement.type === 'new-node' ? cloneNodeData(selectedElement.data as Node) : null,
  )
  const [draftEdge, setDraftEdge] = useState<Edge | null>(
    selectedElement.type === 'edge' || selectedElement.type === 'new-edge' ? cloneEdgeData(selectedElement.data as Edge) : null,
  )
  const [draftLane, setDraftLane] = useState<Lane | null>(
    selectedElement.type === 'lane' || selectedElement.type === 'new-lane' ? cloneLaneData(selectedElement.data as Lane) : null,
  )
  const [draftZone, setDraftZone] = useState<ProcessZone | null>(
    selectedElement.type === 'zone' || selectedElement.type === 'new-zone'
      ? cloneZoneData(selectedElement.data as ProcessZone)
      : null,
  )
  const [draftProcessGroup, setDraftProcessGroup] = useState<OverviewProcessGroup | null>(
    selectedElement.type === 'process-group' || selectedElement.type === 'new-process-group'
      ? cloneProcessGroup(selectedElement.data as OverviewProcessGroup)
      : null,
  )
  const [draftDetailProcessGroup, setDraftDetailProcessGroup] = useState<DetailProcessGroup | null>(
    selectedElement.type === 'detail-process-group' || selectedElement.type === 'new-detail-process-group'
      ? cloneDetailProcessGroup(selectedElement.data as DetailProcessGroup)
      : null,
  )
  const [error, setError] = useState<string | null>(null)

  const reloadFromSelected = useCallback(() => {
    setError(null)
    if (selectedElement.type === 'node' || selectedElement.type === 'new-node') {
      setDraftNode(cloneNodeData(selectedElement.data as Node))
    }
    if (selectedElement.type === 'edge' || selectedElement.type === 'new-edge') {
      setDraftEdge(cloneEdgeData(selectedElement.data as Edge))
    }
    if (selectedElement.type === 'lane' || selectedElement.type === 'new-lane') {
      setDraftLane(cloneLaneData(selectedElement.data as Lane))
    }
    if (selectedElement.type === 'zone' || selectedElement.type === 'new-zone') {
      setDraftZone(cloneZoneData(selectedElement.data as ProcessZone))
    }
    if (selectedElement.type === 'process-group' || selectedElement.type === 'new-process-group') {
      setDraftProcessGroup(cloneProcessGroup(selectedElement.data as OverviewProcessGroup))
    }
    if (selectedElement.type === 'detail-process-group' || selectedElement.type === 'new-detail-process-group') {
      setDraftDetailProcessGroup(cloneDetailProcessGroup(selectedElement.data as DetailProcessGroup))
    }
  }, [selectedElement])

  const selectionKey = selectedElementKey(selectedElement)
  const processGroupMembershipKey =
    selectedElement.type === 'process-group' || selectedElement.type === 'new-process-group'
      ? [
          selectedElement.type,
          selectedElement.id,
          selectedElement.data.overviewNodeIds.join('|'),
          selectedElement.data.overviewEdgeIds.join('|'),
        ].join(':')
      : ''

  // Re-init draft only when selection identity changes — not on every process sync.
  // (render 중 상태 조정 패턴 — effect 재실행 대신 즉시 반영)
  const [prevSelectionKey, setPrevSelectionKey] = useState(selectionKey)
  if (prevSelectionKey !== selectionKey) {
    setPrevSelectionKey(selectionKey)
    setError(null)
    if (selectedElement.type === 'node' || selectedElement.type === 'new-node') {
      setDraftNode(cloneNodeData(selectedElement.data as Node))
    }
    if (selectedElement.type === 'edge' || selectedElement.type === 'new-edge') {
      setDraftEdge(cloneEdgeData(selectedElement.data as Edge))
    }
    if (selectedElement.type === 'lane' || selectedElement.type === 'new-lane') {
      setDraftLane(cloneLaneData(selectedElement.data as Lane))
    }
    if (selectedElement.type === 'zone' || selectedElement.type === 'new-zone') {
      setDraftZone(cloneZoneData(selectedElement.data as ProcessZone))
    }
    if (selectedElement.type === 'process-group' || selectedElement.type === 'new-process-group') {
      setDraftProcessGroup(cloneProcessGroup(selectedElement.data as OverviewProcessGroup))
    }
    if (selectedElement.type === 'detail-process-group' || selectedElement.type === 'new-detail-process-group') {
      setDraftDetailProcessGroup(cloneDetailProcessGroup(selectedElement.data as DetailProcessGroup))
    }
  }

  // Re-sync group membership changes from canvas clicks without resetting text edits.
  const [prevMembershipKey, setPrevMembershipKey] = useState(processGroupMembershipKey)
  if (prevMembershipKey !== processGroupMembershipKey) {
    setPrevMembershipKey(processGroupMembershipKey)
    if (selectedElement.type === 'process-group' || selectedElement.type === 'new-process-group') {
      setDraftProcessGroup(cloneProcessGroup(selectedElement.data as OverviewProcessGroup))
    }
  }

  // 프로세스별 레인 표시 설정 draft — 선택 그룹/연결 프로세스가 바뀌면 재초기화 (null = 전체 표시)
  const laneDraftKey = `${selectionKey}:${draftDetailProcessGroup?.detailProcessId ?? ''}`
  const linkedDetailProcess = detailProcesses?.find(
    (entry) => entry.id === draftDetailProcessGroup?.detailProcessId,
  )
  const [draftProcessLaneIds, setDraftProcessLaneIds] = useState<string[] | null>(() =>
    linkedDetailProcess?.laneIds ? [...linkedDetailProcess.laneIds] : null,
  )
  const [draftAutoHideEmptyLanes, setDraftAutoHideEmptyLanes] = useState<boolean>(
    () => linkedDetailProcess?.autoHideEmptyLanes ?? false,
  )
  const [prevLaneDraftKey, setPrevLaneDraftKey] = useState(laneDraftKey)
  if (prevLaneDraftKey !== laneDraftKey) {
    setPrevLaneDraftKey(laneDraftKey)
    setDraftProcessLaneIds(linkedDetailProcess?.laneIds ? [...linkedDetailProcess.laneIds] : null)
    setDraftAutoHideEmptyLanes(linkedDetailProcess?.autoHideEmptyLanes ?? false)
  }

  const commitNode = useCallback(
    (node: Node) => {
      const normalized = normalizeNodeLocalOrder(node, process)
      const r = validateNode(normalized, process)
      if (!r.ok) {
        setError(r.message)
        return false
      }
      setError(null)
      onSaveNode(normalized, false)
      setDraftNode(cloneNodeData(normalized))
      return true
    },
    [onSaveNode, process],
  )

  const commitEdge = useCallback(
    (edge: Edge) => {
      const normalized = withEdgeHandleDefaults(edge)
      const r = validateEdge(normalized, process)
      if (!r.ok) {
        setError(r.message)
        return false
      }
      setError(null)
      onSaveEdge(normalized, false)
      return true
    },
    [onSaveEdge, process],
  )

  const commitLane = useCallback(
    (lane: Lane) => {
      const r = validateLane(lane)
      if (!r.ok) {
        setError(r.message)
        return false
      }
      setError(null)
      onSaveLane(lane, false)
      return true
    },
    [onSaveLane],
  )

  const commitZone = useCallback(
    (zone: ProcessZone) => {
      const r = validateZone(zone, process)
      if (!r.ok) {
        setError(r.message)
        return false
      }
      setError(null)
      onSaveZone(zone, false)
      return true
    },
    [onSaveZone, process],
  )

  const commitProcessGroup = useCallback(
    (group: OverviewProcessGroup) => {
      const name = group.name.trim()
      if (!name) {
        setError('그룹명을 입력하세요.')
        return false
      }
      setError(null)
      const pruned = pruneProcessGroupEdgesFromNodes(group, process.edges)
      onSaveProcessGroup?.({ ...pruned, name })
      return true
    },
    [onSaveProcessGroup, process.edges],
  )

  const commitDetailProcessGroup = useCallback(
    (group: DetailProcessGroup) => {
      const name = group.name.trim()
      if (!name) {
        setError('그룹명을 입력하세요.')
        return false
      }
      if (!group.detailProcessId) {
        setError('연결 상세 프로세스를 선택하세요.')
        return false
      }
      setError(null)
      onSaveDetailProcessGroup?.({ ...group, name })
      if (onSaveProcessLaneDisplay && group.detailProcessId) {
        onSaveProcessLaneDisplay(group.detailProcessId, {
          laneIds: draftProcessLaneIds ?? undefined,
          autoHideEmptyLanes: draftAutoHideEmptyLanes,
        })
      }
      return true
    },
    [onSaveDetailProcessGroup, onSaveProcessLaneDisplay, draftProcessLaneIds, draftAutoHideEmptyLanes],
  )

  const handleProcessGroupChange = useCallback(
    (group: OverviewProcessGroup) => {
      setDraftProcessGroup(group)
      if (selectedElement.type === 'process-group') {
        onProcessGroupDraftChange?.(group)
      }
    },
    [onProcessGroupDraftChange, selectedElement.type],
  )

  if ((selectedElement.type === 'node' || selectedElement.type === 'new-node') && draftNode) {
    const isNewNode = selectedElement.type === 'new-node'

    return (
      <div className="property-panel">
        {isNewNode ? (
          <NewItemActions
            targetLabel="업무"
            error={error}
            onSave={() => {
              const normalized = normalizeNodeLocalOrder(draftNode, process)
              const r = validateNode(normalized, process)
              if (!r.ok) { setError(r.message); return }
              setError(null)
              onSaveNode(normalized, true)
              setDraftNode(cloneNodeData(normalized))
            }}
            onCancel={onCancelNew}
          />
        ) : isEditMode ? (
          <EditItemActions
            targetLabel="업무"
            error={error}
            onSave={() => commitNode(draftNode)}
            onCancel={reloadFromSelected}
            canDelete
            onDelete={() => {
              if (window.confirm('이 노드를 삭제하면 연결된 연결선도 함께 삭제됩니다. 계속하시겠습니까?')) {
                onDeleteNode(draftNode.id)
              }
            }}
          />
        ) : null}
        {isEditMode || isNewNode ? (
          <>
            <NodeForm
              node={draftNode}
              process={process}
              disabled={!isEditMode}
              viewMode={viewMode}
              overviewProcessGroups={props.overviewProcessGroups}
              detailProcessGroups={props.detailProcessGroups}
              reviewMode={reviewMode}
              connections={
                isEditMode && !isNewNode ? (
                  <div className="property-panel__section">
                    <h3 className="property-panel__section-title">연결 관계</h3>
                    <NodeConnectionsPanel
                      node={draftNode}
                      process={process}
                      disabled={!isEditMode}
                      incomingTitle={isConnectorNode(draftNode) ? '들어오는 연결' : '이전 업무'}
                      outgoingTitle={isConnectorNode(draftNode) ? '나가는 연결' : '다음 업무'}
                      onSaveEdge={(edge, isNew) => onSaveEdge(withEdgeHandleDefaults(edge), isNew, { keepNodeId: draftNode.id })}
                      onDeleteEdge={(edgeId) => onDeleteEdge(edgeId, { keepNodeId: draftNode.id })}
                      onSelectEdge={onSelectEdge}
                    />
                  </div>
                ) : null
              }
              onChange={setDraftNode}
            />
          </>
        ) : (
          <>
            <ViewModeEditHint onRequestEditMode={onRequestEditMode} />
            <NodeView
              node={draftNode}
              process={process}
              viewMode={viewMode}
              reviewMode={reviewMode}
              detailProcesses={detailProcesses}
              onOpenDetailProcess={onOpenDetailProcess}
            />
          </>
        )}
      </div>
    )
  }

  if ((selectedElement.type === 'edge' || selectedElement.type === 'new-edge') && draftEdge) {
    const isNewEdge = selectedElement.type === 'new-edge'
    const isReadOnlyEdge = isReadOnlyDisplayEdge(draftEdge)

    return (
      <div className="property-panel">
        {isNewEdge ? (
          <NewItemActions
            targetLabel="연결선"
            error={error}
            onSave={() => {
              const normalized = withEdgeHandleDefaults(draftEdge)
              const r = validateEdge(normalized, process)
              if (!r.ok) { setError(r.message); return }
              setError(null)
              onSaveEdge(normalized, true)
            }}
            onCancel={onCancelNew}
          />
        ) : isReadOnlyEdge ? (
          <>
            <div className="property-panel__view-only-banner">
              업무 보기 임시 derived 연결선 (read-only)
            </div>
            {isEditMode && isDerivedDisplayEdge(draftEdge) && (
              <div className="property-panel__field">
                <button
                  type="button"
                  className="property-panel__btn property-panel__btn--primary"
                  onClick={() => {
                    const saved = createSavedVirtualEdgeFromDerived(draftEdge)
                    const r = validateEdge(saved, process)
                    if (!r.ok) {
                      setError(r.message)
                      return
                    }
                    setError(null)
                    onSaveEdge(saved, true)
                    onSelectEdge?.(saved.id)
                  }}
                >
                  가상 연결로 저장 (편집 가능)
                </button>
                <p className="property-panel__hint">
                  동일 source/target으로 저장된 virtual edge가 생기면 derived 표시는 사라집니다.
                </p>
              </div>
            )}
          </>
        ) : (
          <EditItemActions
            targetLabel="연결선"
            error={error}
            onSave={() => commitEdge(draftEdge)}
            onCancel={reloadFromSelected}
            canDelete={isEditMode}
            onDelete={() => onDeleteEdge(draftEdge.id)}
          />
        )}
        <EdgeForm
          edge={draftEdge}
          process={process}
          disabled={!isEditMode}
          viewMode={viewMode}
          onChange={setDraftEdge}
        />
      </div>
    )
  }

  if ((selectedElement.type === 'lane' || selectedElement.type === 'new-lane') && draftLane) {
    const isNewLane = selectedElement.type === 'new-lane'

    return (
      <div className="property-panel">
        {isNewLane ? (
          <NewItemActions
            targetLabel="담당 영역"
            error={error}
            onSave={() => {
              const r = validateLane(draftLane)
              if (!r.ok) { setError(r.message); return }
              setError(null)
              onSaveLane(draftLane, true)
            }}
            onCancel={onCancelNew}
          />
        ) : (
          <EditItemActions
            targetLabel="담당 영역"
            error={error}
            onSave={() => commitLane(draftLane)}
            onCancel={reloadFromSelected}
            canDelete={isEditMode}
            onDelete={() => {
              const c = canDeleteLane(process, draftLane.id)
              if (!c.ok) { window.alert(c.message); return }
              if (window.confirm('이 스윔레인을 삭제하시겠습니까?')) onDeleteLane(draftLane.id)
            }}
          />
        )}
        <LaneForm
          lane={draftLane}
          disabled={!isEditMode}
          onChange={setDraftLane}
        />
      </div>
    )
  }

  if ((selectedElement.type === 'process-group' || selectedElement.type === 'new-process-group') && draftProcessGroup) {
    const isNewGroup = selectedElement.type === 'new-process-group'
    return (
      <div className="property-panel">
        {isNewGroup ? (
          <NewItemActions
            targetLabel="Overview 그룹"
            error={error}
            onSave={() => commitProcessGroup(draftProcessGroup)}
            onCancel={onCancelNew}
          />
        ) : isEditMode ? (
          <EditItemActions
            targetLabel="Overview 그룹"
            error={error}
            onSave={() => commitProcessGroup(draftProcessGroup)}
            onCancel={() => {
              setError(null)
              const restored = savedProcessGroup ?? (selectedElement.data as OverviewProcessGroup)
              const next = cloneProcessGroup(restored)
              setDraftProcessGroup(next)
              onProcessGroupDraftChange?.(next)
            }}
          />
        ) : (
          <ViewModeEditHint onRequestEditMode={onRequestEditMode} />
        )}
        <ProcessGroupForm
          group={draftProcessGroup}
          process={process}
          detailProcessGroups={props.detailProcessGroups ?? []}
          disabled={!isEditMode}
          onChange={handleProcessGroupChange}
          onOpenDetailProcess={onOpenDetailProcess}
          linkedDetailProcessId={linkedDetailProcessId}
        />
      </div>
    )
  }

  if (
    (selectedElement.type === 'detail-process-group' ||
      selectedElement.type === 'new-detail-process-group') &&
    draftDetailProcessGroup
  ) {
    const isNewGroup = selectedElement.type === 'new-detail-process-group'
    return (
      <div className="property-panel">
        {isNewGroup ? (
          <NewItemActions
            targetLabel="상세 프로세스 그룹"
            error={error}
            onSave={() => commitDetailProcessGroup(draftDetailProcessGroup)}
            onCancel={onCancelNew}
          />
        ) : isEditMode ? (
          <EditItemActions
            targetLabel="상세 프로세스 그룹"
            error={error}
            onSave={() => commitDetailProcessGroup(draftDetailProcessGroup)}
            onCancel={() => {
              setError(null)
              const restored = savedDetailProcessGroup ?? (selectedElement.data as DetailProcessGroup)
              setDraftDetailProcessGroup(cloneDetailProcessGroup(restored))
            }}
          />
        ) : (
          <ViewModeEditHint onRequestEditMode={onRequestEditMode} />
        )}
        <DetailProcessGroupForm
          group={draftDetailProcessGroup}
          detailProcesses={detailProcesses ?? []}
          overviewProcessGroups={props.overviewProcessGroups ?? []}
          masterLanes={masterLanes ?? []}
          processLaneIds={draftProcessLaneIds}
          autoHideEmptyLanes={draftAutoHideEmptyLanes}
          disabled={!isEditMode && !isNewGroup}
          onChange={setDraftDetailProcessGroup}
          onProcessLaneIdsChange={setDraftProcessLaneIds}
          onAutoHideEmptyLanesChange={setDraftAutoHideEmptyLanes}
          onOpenDetailProcess={onOpenDetailProcess}
        />
      </div>
    )
  }

  if (selectedElement.type === 'overview-zone') {
    return (
      <div className="property-panel">
        {!isEditMode && <ViewModeEditHint onRequestEditMode={onRequestEditMode} />}
        <OverviewZoneForm
          zoneDef={selectedElement.data}
          process={process}
          disabled={!isEditMode}
          onSaveNode={onSaveNode}
        />
      </div>
    )
  }

  if ((selectedElement.type === 'zone' || selectedElement.type === 'new-zone') && draftZone) {
    const isNewZone = selectedElement.type === 'new-zone'

    return (
      <div className="property-panel">
        {isNewZone ? (
          <NewItemActions
            targetLabel="프로세스 구역"
            error={error}
            onSave={() => {
              const r = validateZone(draftZone, process)
              if (!r.ok) { setError(r.message); return }
              setError(null)
              onSaveZone(draftZone, true)
            }}
            onCancel={onCancelNew}
          />
        ) : isEditMode ? (
          <EditItemActions
            targetLabel="프로세스 구역"
            error={error}
            onSave={() => commitZone(draftZone)}
            onCancel={reloadFromSelected}
            canDelete
            onDelete={() => {
              if (window.confirm('이 프로세스 구역을 삭제하시겠습니까?')) onDeleteZone(draftZone.id)
            }}
          />
        ) : (
          <ViewModeEditHint onRequestEditMode={onRequestEditMode} />
        )}
        <ZoneForm
          zone={draftZone}
          process={process}
          disabled={!isEditMode}
          isNew={isNewZone}
          onChange={setDraftZone}
          onApply={(zone) => {
            if (!isNewZone && isEditMode) onSaveZone(zone, false)
          }}
        />
      </div>
    )
  }

  return (
    <p className="property-panel__empty property-panel__error">
      선택한 항목을 표시할 수 없습니다.
    </p>
  )
}

export function PropertyPanel(props: PropertyPanelProps) {
  const { appMode, selectedElement, process, onSelectZone } = props
  const isEditMode = appMode === 'edit'
  const processZones = process.zones ?? []

  if (!selectedElement) {
    return (
      <div className="property-panel node-detail-panel" {...panelEventShieldProps}>
        <p className="property-panel__empty">
          {isEditMode
            ? '편집할 항목을 선택하세요. 업무·연결선·담당 영역·프로세스 구역을 클릭하거나 상단 + 버튼으로 추가할 수 있습니다.'
            : '프로세스맵에서 업무 또는 프로세스 구역을 클릭하면 상세 정보가 표시됩니다.'}
        </p>
        {onSelectZone && processZones.length > 0 && (
          <ProcessZoneList zones={processZones} onSelect={onSelectZone} />
        )}
      </div>
    )
  }

  return (
    <div className="node-detail-panel" {...panelEventShieldProps}>
      <PropertyPanelEditor key={selectedElementKey(selectedElement)} {...props} selectedElement={selectedElement} />
    </div>
  )
}
