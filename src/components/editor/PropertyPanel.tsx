import { useCallback, useEffect, useState } from 'react'
import type { Edge, Lane, Node, Process, ProcessZone, ProcessZoneId } from '../../types/process'
import {
  EDITABLE_DETAIL_NODE_TYPES,
  getNodeTypeLabel,
  getLaneById,
  getPhaseLabel,
  NODE_TYPE_META,
} from '../../types/process'
import type { EdgeType } from '../../types/edgeTypes'
import type { NodeType } from '../../types/nodeTypes'
import {
  getOverviewNodeTypeLabel,
  OVERVIEW_NODE_TYPE_META,
  overviewTypeToDetailType,
  type OverviewNodeType,
} from '../../types/overviewNodeTypes'
import { formatOverviewNodePrimaryLabel, resolveOverviewNodeType } from '../../lib/overviewNodeDisplay'
import { OVERVIEW_EDGE_LABEL_PRESETS } from '../../lib/overviewEdgeLabels'
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
import { resolveEdgeType } from '../../types/edgeTypes'
import {
  canDeleteLane,
  validateEdge,
  validateLane,
  validateNode,
  validateZone,
} from '../../lib/editor/processEditor'
import type { AppMode, SelectedElement } from '../../lib/editor/selectionTypes'
import type { DetailProcessGroup, OverviewProcessGroup } from '../../types/toBeNavigator'
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
import { NodeConnectionsPanel } from './NodeConnectionsPanel'
import { DetailProcessLinks } from './DetailProcessLinks'
import { ListEditor } from './ListEditor'
import './property-panel.css'
import './node-connections-panel.css'

const CONDITION_PRESETS = ['Y', 'N', '신규', '기존']
const DETAIL_LAYOUT_MAX_COLUMNS = 24
const DETAIL_LAYOUT_MAX_ROWS = 5

/** 편집 폼 Node Type — 실제 사용 노드 중심 */
const NODE_FORM_TYPES: { value: NodeType; label: string }[] = EDITABLE_DETAIL_NODE_TYPES.map((type) => ({
  value: type,
  label: NODE_TYPE_META[type].label,
}))

/** Overview PDF 범례 8종 (+ layout 전용) */
const OVERVIEW_NODE_FORM_TYPES: { value: OverviewNodeType; label: string }[] = (
  Object.values(OVERVIEW_NODE_TYPE_META) as (typeof OVERVIEW_NODE_TYPE_META)[OverviewNodeType][]
).map(({ id, label }) => ({ value: id, label }))

const EDGE_FORM_TYPES: { value: EdgeType; label: string }[] = [
  { value: 'normal', label: 'flow (normal)' },
  { value: 'condition', label: 'approval / condition' },
  { value: 'api', label: 'api (cross-system)' },
  { value: 'exception', label: 'exception' },
  { value: 'return', label: 'return' },
  { value: 'virtual', label: '가상 연결 (virtual)' },
  { value: 'reference', label: '참조 관계 (reference)' },
]

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

type PropertyPanelProps = {
  appMode: AppMode
  selectedElement: SelectedElement | null
  process: Process
  viewMode: 'overview' | 'detail'
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
    </div>
  )
}

function NodeForm({
  node,
  process,
  disabled,
  viewMode,
  onChange,
}: {
  node: Node
  process: Process
  disabled: boolean
  viewMode: 'overview' | 'detail'
  onChange: (node: Node) => void
}) {
  const sortedLanes = [...process.lanes].sort((a, b) => a.order - b.order)
  const cellSlotWarning = viewMode === 'overview' ? getCellSlotCollisionWarning(node, process) : null
  const isConnector = isConnectorNode(node)
  const connectorSubType = isConnector ? resolveConnectorSubType(node) : undefined
  const overviewNodeType = viewMode === 'overview' ? resolveOverviewNodeType(node) : undefined

  return (
    <>
      <div className="property-panel__section">
        <h3 className="property-panel__section-title">기본정보</h3>
        <div className="property-panel__field">
          <label className="property-panel__label">Node ID</label>
          <input className="property-panel__input" value={node.id} disabled readOnly />
        </div>
        <div className="property-panel__field">
          <label className="property-panel__label">이름</label>
          <input
            className="property-panel__input"
            value={node.name}
            disabled={disabled}
            onChange={(e) => onChange({ ...node, name: e.target.value })}
          />
        </div>
        <div className="property-panel__field">
          <label className="property-panel__label">{viewMode === 'overview' ? 'Overview Type' : 'Node Type'}</label>
          <select
            className="property-panel__select"
            value={viewMode === 'overview' ? overviewNodeType : node.type}
            disabled={disabled}
            onChange={(e) => {
              if (viewMode === 'overview') {
                const nextOverviewType = e.target.value as OverviewNodeType
                const nextDetailType = overviewTypeToDetailType(nextOverviewType)
                if (nextDetailType === 'manual') {
                  const { connectorSubType: _removed, stepBadge: _stepBadge, ...rest } = node
                  onChange({
                    ...rest,
                    overviewType: nextOverviewType,
                    type: nextDetailType,
                  } as Node)
                  return
                }
                if (nextDetailType === 'connector') {
                  onChange({
                    ...node,
                    overviewType: nextOverviewType,
                    type: nextDetailType,
                    connectorSubType: node.connectorSubType ?? 'split',
                  })
                  return
                }
                const { connectorSubType: _removed, ...rest } = node
                onChange({
                  ...rest,
                  overviewType: nextOverviewType,
                  type: nextDetailType,
                } as Node)
                return
              }
              const nextType = e.target.value as NodeType
              if (nextType === 'manual') {
                const { connectorSubType: _removed, overviewType: _overview, stepBadge: _stepBadge, ...rest } = node
                onChange({ ...rest, type: nextType } as Node)
                return
              }
              if (nextType === 'linked-process') {
                const {
                  connectorSubType: _removed,
                  overviewType: _overview,
                  stepBadge: _stepBadge,
                  ...rest
                } = node
                onChange({ ...rest, type: nextType, system: node.system || '연결 프로세스' } as Node)
                return
              }
              if (nextType === 'connector') {
                onChange({
                  ...node,
                  type: nextType,
                  connectorSubType: node.connectorSubType ?? 'split',
                })
                return
              }
              const { connectorSubType: _removed, overviewType: _overview, ...rest } = node
              onChange({ ...rest, type: nextType } as Node)
            }}
          >
            {(viewMode === 'overview' ? OVERVIEW_NODE_FORM_TYPES : NODE_FORM_TYPES).map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
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
            <label className="property-panel__label">Type</label>
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
            <label className="property-panel__label">노드 순서</label>
            <input
              type="number"
              min={0}
              className="property-panel__input"
              value={node.type === 'manual' || node.type === 'linked-process' ? 0 : node.stepBadge ?? ''}
              disabled={disabled || node.type === 'manual' || node.type === 'linked-process'}
              placeholder="자동"
              onChange={(e) => {
                const raw = e.target.value
                if (raw === '') {
                  const { stepBadge: _removed, ...rest } = node
                  onChange(rest as Node)
                  return
                }
                const value = Number.parseInt(raw, 10)
                if (!Number.isNaN(value) && value >= 0) {
                  onChange({ ...node, stepBadge: value })
                }
              }}
            />
            <p className="property-panel__hint">
              비워두면 자동 번호, 0이면 숨김. Manual/Linked Process 노드는 번호를 표시하지 않습니다.
            </p>
          </div>
        )}
      </div>

      <div className="property-panel__section">
        <h3 className="property-panel__section-title">위치 정보</h3>
        <div className="property-panel__field">
          <label className="property-panel__label">Swimlane</label>
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
            <label className="property-panel__label">Zone</label>
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
            <p className="property-panel__hint">Overview 업무 구간 (Y축 Zone)</p>
          </div>
        )}
        {process.phases.length > 0 && (
          <div className="property-panel__field">
            <label className="property-panel__label">단계 (Phase)</label>
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
          </div>
        )}
        <div className="property-panel__field">
          <label className="property-panel__label">
            {viewMode === 'detail' ? '상세 위치' : '셀 내 위치 (cellSlot)'}
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
              ? `프로세스 상세에서는 가로형 기준 열(진행 위치)과 1~${DETAIL_LAYOUT_MAX_ROWS}행 트랙을 지정합니다. 자동이면 노드 유형과 순서 기준으로 배치합니다.`
              : `LEFT 1~${OVERVIEW_CELL_MAX_ROWS}행 / RIGHT ${OVERVIEW_CELL_MAX_ROWS + 1}~${OVERVIEW_CELL_SLOT_MAX}행 (2열 최대). 미지정 시 자동 배치`}
          </p>
          {cellSlotWarning && (
            <p className="property-panel__hint property-panel__hint--warn">{cellSlotWarning}</p>
          )}
          {isConnector && (
            <p className="property-panel__hint">Connector는 연결 관계 기준으로 자동 배치됩니다.</p>
          )}
        </div>
      </div>

      <div className="property-panel__section">
        <h3 className="property-panel__section-title">업무 정보</h3>
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
        <div className="property-panel__field">
          <label className="property-panel__label">설명</label>
          <textarea
            className="property-panel__textarea"
            value={node.description}
            disabled={disabled}
            onChange={(e) => onChange({ ...node, description: e.target.value })}
          />
        </div>
      </div>

      <ListEditor label="입력값" items={node.inputs} disabled={disabled} onChange={(inputs) => onChange({ ...node, inputs })} />
      <ListEditor label="출력값" items={node.outputs} disabled={disabled} onChange={(outputs) => onChange({ ...node, outputs })} />
      <ListEditor label="통제" items={node.controls} disabled={disabled} onChange={(controls) => onChange({ ...node, controls })} />
    </>
  )
}

function NodeView({
  node,
  process,
  viewMode,
  detailProcesses,
  onOpenDetailProcess,
}: {
  node: Node
  process: Process
  viewMode: 'overview' | 'detail'
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
        <div className="property-panel__dl-row"><dt>Lane</dt><dd>{lane?.name ?? node.laneId}</dd></div>
        <div className="property-panel__dl-row"><dt>단계</dt><dd>{getPhaseLabel(process, node.phaseId)}</dd></div>
        <div className="property-panel__dl-row"><dt>담당</dt><dd>{node.owner || '-'}</dd></div>
        <div className="property-panel__dl-row"><dt>시스템</dt><dd>{node.system || '-'}</dd></div>
      </dl>
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
  viewMode,
  onChange,
}: {
  edge: Edge
  process: Process
  disabled: boolean
  viewMode: 'overview' | 'detail'
  onChange: (edge: Edge) => void
}) {
  const labelPresets =
    viewMode === 'overview' ? [...OVERVIEW_EDGE_LABEL_PRESETS] : [...CONDITION_PRESETS]
  const edgeType = resolveEdgeType(edge)
  const isDerived = isDerivedDisplayEdge(edge)
  const isVirtualType = resolveEdgeType(edge) === 'virtual'
  const readOnly = disabled || isReadOnlyDisplayEdge(edge)
  const patch = (partial: Partial<Edge>) => onChange(withEdgeHandleDefaults({ ...edge, ...partial }))
  const nodeOptions = sortNodesForSelect(process.nodes)

  return (
    <>
      {isDerived && (
        <p className="property-panel__hint">
          업무 보기에서 API 숨김으로 생성된 임시 연결선입니다. 시스템 보기에서 원본 연결선을 수정하세요.
        </p>
      )}
      {isVirtualType && !isDerived && (
        <p className="property-panel__hint">
          표시 전용 가상 연결선입니다. source/target, handle, label을 수정하고 저장할 수 있습니다.
        </p>
      )}
      <div className="property-panel__section">
        <h3 className="property-panel__section-title">Edge 설정</h3>
        <div className="property-panel__field"><label className="property-panel__label">Edge ID</label><input className="property-panel__input" value={edge.id} disabled readOnly /></div>
        <div className="property-panel__field">
          <label className="property-panel__label">Source Node</label>
          <select className="property-panel__select" value={edge.source} disabled={readOnly} onChange={(e) => patch({ source: e.target.value })}>
            <option value="">선택…</option>
            {nodeOptions.map((n) => (<option key={n.id} value={n.id}>{formatNodeSelectLabel(n)}</option>))}
          </select>
        </div>
        <div className="property-panel__field">
          <label className="property-panel__label">Target Node</label>
          <select className="property-panel__select" value={edge.target} disabled={readOnly} onChange={(e) => patch({ target: e.target.value })}>
            <option value="">선택…</option>
            {nodeOptions.map((n) => (<option key={n.id} value={n.id}>{formatNodeSelectLabel(n)}</option>))}
          </select>
        </div>
        <div className="property-panel__field">
          <label className="property-panel__label">Edge Type</label>
          <select className="property-panel__select" value={edgeType} disabled={disabled} onChange={(e) => patch({ type: e.target.value as EdgeType })}>
            {EDGE_FORM_TYPES.map(({ value, label }) => (<option key={value} value={value}>{label}</option>))}
          </select>
        </div>
        <div className="property-panel__field">
          <label className="property-panel__label">Label</label>
          <textarea
            className="property-panel__textarea"
            value={edge.label}
            disabled={disabled}
            onChange={(e) => patch({ label: e.target.value })}
          />
          {labelPresets.length > 0 && (
            <select
              className="property-panel__select"
              value=""
              disabled={disabled}
              onChange={(e) => {
                if (e.target.value) patch({ label: e.target.value })
              }}
            >
              <option value="">라벨 프리셋 선택…</option>
              {labelPresets.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          )}
          <p className="property-panel__hint">Enter로 줄바꿈할 수 있습니다. 선택한 연결선의 라벨은 화면에서 드래그해 위치를 조정할 수 있습니다.</p>
          {edge.labelPlacement?.point && (
            <button
              type="button"
              className="property-panel__button"
              disabled={disabled}
              onClick={() => patch({ labelPlacement: undefined })}
            >
              라벨 위치 자동
            </button>
          )}
        </div>
        <div className="property-panel__field">
          <label className="property-panel__label">Condition</label>
          <input className="property-panel__input" list="edge-condition-presets" value={edge.condition} disabled={disabled} onChange={(e) => patch({ condition: e.target.value })} />
          <datalist id="edge-condition-presets">{CONDITION_PRESETS.map((c) => (<option key={c} value={c} />))}</datalist>
        </div>
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
        <label className="property-panel__label">포함 Node</label>
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
  disabled,
  onChange,
  onOpenDetailProcess,
}: {
  group: DetailProcessGroup
  detailProcesses: Process[]
  overviewProcessGroups: OverviewProcessGroup[]
  disabled: boolean
  onChange: (group: DetailProcessGroup) => void
  onOpenDetailProcess?: (processId: string) => void
}) {
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
        <h3 className="property-panel__section-title">Lane 설정</h3>
        <div className="property-panel__field"><label className="property-panel__label">Lane 이름</label><input className="property-panel__input" value={lane.name} disabled={disabled} onChange={(e) => onChange({ ...lane, name: e.target.value })} /></div>
        <div className="property-panel__field"><label className="property-panel__label">Lane ID</label><input className="property-panel__input" value={lane.id} disabled readOnly /></div>
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
      <h3 className="property-panel__section-title">업무 Zone 설정</h3>
      <div className="property-panel__field">
        <label className="property-panel__label">Zone 이름</label>
        <input className="property-panel__input" value={zoneDef.label} disabled readOnly />
      </div>
      <div className="property-panel__field">
        <label className="property-panel__label">Zone ID</label>
        <input className="property-panel__input" value={zoneDef.id} disabled readOnly />
      </div>
      <div className="property-panel__field">
        <label className="property-panel__label">포함 Node</label>
        <p className="property-panel__hint">체크 변경 시 즉시 반영되며 Zone 영역 높이가 재계산됩니다.</p>
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
      <h3 className="property-panel__section-title">Process Zone 목록</h3>
      <p className="property-panel__hint">생성된 Zone을 클릭하면 이름·포함 노드·스타일을 수정할 수 있습니다.</p>
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
      <h3 className="property-panel__section-title">Process Zone 설정</h3>
      <div className="property-panel__field">
        <label className="property-panel__label">Zone 이름</label>
        <input
          className="property-panel__input"
          value={zone.name}
          disabled={disabled}
          onChange={(e) => applyChange({ ...zone, name: e.target.value })}
        />
      </div>
      <div className="property-panel__field">
        <label className="property-panel__label">Zone ID</label>
        <input className="property-panel__input" value={zone.id} disabled readOnly />
      </div>
      <div className="property-panel__field">
        <label className="property-panel__label">Zone 이름 위치</label>
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
        <label className="property-panel__label">포함 Node</label>
        <p className="property-panel__hint">체크 변경 시 Process Zone 영역이 즉시 갱신됩니다.</p>
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
    detailProcesses,
    onOpenDetailProcess,
    onSaveNode,
    onSaveEdge,
    onSaveLane,
    onSaveZone,
    onSaveProcessGroup,
    onSaveDetailProcessGroup,
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

  useEffect(() => {
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
    // Re-init draft only when selection identity changes — not on every process sync.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectionKey])

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
      return true
    },
    [onSaveDetailProcessGroup],
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
            targetLabel="Node"
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
            targetLabel="Node"
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
              onChange={setDraftNode}
            />
            {isEditMode && !isNewNode && (
              <NodeConnectionsPanel
                node={draftNode}
                process={process}
                disabled={!isEditMode}
                incomingTitle={isConnectorNode(draftNode) ? 'Input' : '이전 노드'}
                outgoingTitle={isConnectorNode(draftNode) ? 'Output' : '다음 노드'}
                onSaveEdge={(edge, isNew) => onSaveEdge(withEdgeHandleDefaults(edge), isNew, { keepNodeId: draftNode.id })}
                onDeleteEdge={(edgeId) => onDeleteEdge(edgeId, { keepNodeId: draftNode.id })}
                onSelectEdge={onSelectEdge}
              />
            )}
          </>
        ) : (
          <>
            <ViewModeEditHint onRequestEditMode={onRequestEditMode} />
            <NodeView
              node={draftNode}
              process={process}
              viewMode={viewMode}
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
            targetLabel="Edge"
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
            targetLabel="Edge"
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
            targetLabel="Lane"
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
            targetLabel="Lane"
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
            targetLabel="Process Group"
            error={error}
            onSave={() => commitProcessGroup(draftProcessGroup)}
            onCancel={onCancelNew}
          />
        ) : isEditMode ? (
          <EditItemActions
            targetLabel="Process Group"
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
            targetLabel="Detail Group"
            error={error}
            onSave={() => commitDetailProcessGroup(draftDetailProcessGroup)}
            onCancel={onCancelNew}
          />
        ) : isEditMode ? (
          <EditItemActions
            targetLabel="Detail Group"
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
          disabled={!isEditMode && !isNewGroup}
          onChange={setDraftDetailProcessGroup}
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
            targetLabel="Zone"
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
            targetLabel="Zone"
            error={error}
            onSave={() => commitZone(draftZone)}
            onCancel={reloadFromSelected}
            canDelete
            onDelete={() => {
              if (window.confirm('이 Process Zone을 삭제하시겠습니까?')) onDeleteZone(draftZone.id)
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
            ? '편집할 항목을 선택하세요. 노드·연결선·스윔레인·Process Zone(점선 박스)을 클릭하거나 상단 + 버튼으로 추가할 수 있습니다.'
            : '프로세스맵에서 노드 또는 Process Zone을 클릭하면 상세 정보가 표시됩니다.'}
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
