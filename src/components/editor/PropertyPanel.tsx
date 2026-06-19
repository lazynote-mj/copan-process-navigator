import { useCallback, useState } from 'react'
import type { Edge, Lane, Node, Process, ProcessZone, ProcessZoneId } from '../../types/process'
import {
  getNodeTypeLabel,
  getLaneById,
  getPhaseLabel,
} from '../../types/process'
import type { EdgeType } from '../../types/edgeTypes'
import type { NodeType } from '../../types/nodeTypes'
import { PROCESS_ZONES, type ProcessZoneDef } from '../../lib/layout/overviewProcessZones'
import {
  isNodeInOverviewZone,
  setNodeOverviewZoneMembership,
} from '../../lib/editor/overviewZoneMembership'
import { CELL_SLOT_MAX, getCellSlotCollisionWarning, getLaneCellSlotCollisionWarning, listCellSlotOptions } from '../../lib/layout/overviewCellPlacement'
import { resolveNodePhaseOrder } from '../../lib/layout/gridLayout'
import { resolveNodeLocalOrder } from '../../lib/layout/localOrder'
import { resolveEdgeType } from '../../types/edgeTypes'
import {
  canDeleteLane,
  validateEdge,
  validateLane,
  validateNode,
  validateZone,
} from '../../lib/editor/processEditor'
import type { AppMode, SelectedElement } from '../../lib/editor/selectionTypes'
import { panelEventShieldProps } from '../../lib/ui/panelEventShield'
import { cloneEdgeData, cloneLaneData, cloneNodeData, cloneZoneData, selectedElementKey } from '../../lib/editor/selectedElement'
import type { EdgeValidationStatus } from '../../lib/layout/edgeRouteValidation'
import { withEdgeHandleDefaults, patchEdgeHandles, unlockEdgeHandles, lockEdgeHandles, isHandleAutoEnabled } from '../../lib/editor/edgeHandles'
import { isDerivedDisplayEdge, isReadOnlyDisplayEdge, createSavedVirtualEdgeFromDerived } from '../../lib/nodeVisibility'
import { formatNodeSelectLabel, sortNodesForSelect } from '../../lib/editor/sortNodesForSelect'
import { isConnectorNode, resolveConnectorSubType } from '../../lib/layout/connectorLayout'
import { HandleSelect } from './HandleSelect'
import { NodeConnectionsPanel } from './NodeConnectionsPanel'
import { DetailProcessLinks } from './DetailProcessLinks'
import { ListEditor } from './ListEditor'
import './property-panel.css'
import './node-connections-panel.css'

const CONDITION_PRESETS = ['Y', 'N', '신규', '기존']

/** 편집 폼 Node Type — 사용자 친화 라벨 */
const NODE_FORM_TYPES: { value: NodeType; label: string }[] = [
  { value: 'erp', label: 'Process' },
  { value: 'approval', label: 'Approval' },
  { value: 'decision', label: 'Decision' },
  { value: 'interface-rule', label: 'Interface Rule' },
  { value: 'connector', label: 'Connector' },
  { value: 'system', label: 'System' },
  { value: 'external', label: 'External' },
  { value: 'manual', label: 'Manual' },
  { value: 'interface', label: 'Interface' },
  { value: 'api', label: 'API' },
  { value: 'database', label: 'Database' },
  { value: 'document', label: 'Document' },
  { value: 'exception', label: 'Exception' },
]

const EDGE_FORM_TYPES: { value: EdgeType; label: string }[] = [
  { value: 'normal', label: 'normal' },
  { value: 'condition', label: 'approval / condition' },
  { value: 'system', label: 'system' },
  { value: 'api', label: 'api' },
  { value: 'exception', label: 'exception' },
  { value: 'return', label: 'return' },
  { value: 'virtual', label: '가상 연결 (virtual)' },
  { value: 'reference', label: '참조 관계 (reference)' },
]

type PropertyPanelProps = {
  appMode: AppMode
  selectedElement: SelectedElement | null
  process: Process
  viewMode: 'overview' | 'detail'
  detailProcesses?: Process[]
  onOpenDetailProcess?: (processId: string) => void
  onRequestEditMode?: () => void
  onSaveNode: (node: Node, isNew: boolean) => void
  onSaveEdge: (edge: Edge, isNew: boolean, options?: { keepNodeId?: string }) => void
  onSaveLane: (lane: Lane, isNew: boolean) => void
  onSaveZone: (zone: ProcessZone, isNew: boolean) => void
  onDeleteNode: (id: string) => void
  onDeleteEdge: (id: string, options?: { keepNodeId?: string }) => void
  onDeleteLane: (id: string) => void
  onDeleteZone: (id: string) => void
  onCancelNew: () => void
  onSelectEdge?: (edgeId: string) => void
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
    <>
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
    </>
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
    <>
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
    </>
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
  const zone = node.processZone ?? 'business-contract'
  const cellSlotWarning =
    viewMode === 'overview'
      ? getCellSlotCollisionWarning(node, process)
      : getLaneCellSlotCollisionWarning(node, process)
  const isConnector = isConnectorNode(node)
  const connectorSubType = isConnector ? resolveConnectorSubType(node) : undefined

  return (
    <>
      <div className="property-panel__section">
        <h3 className="property-panel__section-title">기본정보</h3>
        <div className="property-panel__field">
          <label className="property-panel__label">Node ID</label>
          <input
            className="property-panel__input"
            value={node.id}
            disabled={disabled}
            onChange={(e) => onChange({ ...node, id: e.target.value.trim() })}
          />
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
          <label className="property-panel__label">Node Type</label>
          <select
            className="property-panel__select"
            value={node.type}
            disabled={disabled}
            onChange={(e) => {
              const nextType = e.target.value as NodeType
              if (nextType === 'connector') {
                onChange({
                  ...node,
                  type: nextType,
                  connectorSubType: node.connectorSubType ?? 'split',
                })
                return
              }
              const { connectorSubType: _removed, ...rest } = node
              onChange({ ...rest, type: nextType } as Node)
            }}
          >
            {NODE_FORM_TYPES.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
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
        <div className="property-panel__field">
          <label className="property-panel__label">Zone</label>
          <select
            className="property-panel__select"
            value={zone}
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
        {viewMode === 'detail' && (
          <div className="property-panel__field">
            <label className="property-panel__label">localOrder</label>
            <input
              type="number"
              min={1}
              className="property-panel__input"
              value={node.localOrder ?? resolveNodeLocalOrder(node, process)}
              disabled={disabled}
              onChange={(e) => {
                const v = Number.parseInt(e.target.value, 10)
                if (!Number.isNaN(v) && v > 0) onChange({ ...node, localOrder: v })
              }}
            />
            <p className="property-panel__hint">스윔레인 내 상→하 배치 순서 (cellOrder 미지정 시 사용)</p>
          </div>
        )}
        <div className="property-panel__field">
          <label className="property-panel__label">업무 순서 (cellOrder)</label>
          <input
            type="number"
            min={0}
            className="property-panel__input"
            value={node.cellOrder ?? node.zoneOrder ?? 0}
            disabled={disabled}
            onChange={(e) => {
              const v = Number.parseInt(e.target.value, 10)
              if (!Number.isNaN(v) && v >= 0) onChange({ ...node, cellOrder: v, zoneOrder: v })
            }}
          />
          <p className="property-panel__hint">업무 흐름·edge 순서 판단에 사용</p>
        </div>
        <div className="property-panel__field">
          <label className="property-panel__label">셀 내 위치 (cellSlot)</label>
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
              if (!Number.isNaN(v) && v >= 1 && v <= CELL_SLOT_MAX) onChange({ ...node, cellSlot: v })
            }}
          >
            <option value="">자동 (cellOrder 순)</option>
            {listCellSlotOptions().map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <p className="property-panel__hint">LEFT 1~5행 / RIGHT 6~10행 (2열 최대). 미지정 시 cellOrder 기준 자동 배치</p>
          {cellSlotWarning && (
            <p className="property-panel__hint property-panel__hint--warn">{cellSlotWarning}</p>
          )}
          {isConnector && (
            <p className="property-panel__hint">Connector는 연결 관계 기준으로 자동 배치됩니다.</p>
          )}
        </div>
        <div className="property-panel__field property-panel__field--inline">
          <label className="property-panel__label">미세 조정 offsetX</label>
          <input
            type="number"
            className="property-panel__input"
            value={node.offsetX ?? 0}
            disabled={disabled}
            onChange={(e) => {
              const v = Number.parseInt(e.target.value, 10)
              onChange({ ...node, offsetX: Number.isNaN(v) ? 0 : v })
            }}
          />
        </div>
        <div className="property-panel__field property-panel__field--inline">
          <label className="property-panel__label">offsetY</label>
          <input
            type="number"
            className="property-panel__input"
            value={node.offsetY ?? 0}
            disabled={disabled}
            onChange={(e) => {
              const v = Number.parseInt(e.target.value, 10)
              onChange({ ...node, offsetY: Number.isNaN(v) ? 0 : v })
            }}
          />
        </div>
        <div className="property-panel__field">
          <label className="property-panel__label">role</label>
          <input
            className="property-panel__input"
            value={node.role ?? ''}
            disabled={disabled}
            onChange={(e) => onChange({ ...node, role: e.target.value })}
          />
        </div>
        <div className="property-panel__field">
          <label className="property-panel__label">displayLevel</label>
          <select
            className="property-panel__select"
            value={node.displayLevel ?? 'business'}
            disabled={disabled}
            onChange={(e) =>
              onChange({
                ...node,
                displayLevel: e.target.value === 'system' ? 'system' : undefined,
              })
            }
          >
            <option value="business">업무 보기</option>
            <option value="system">시스템 보기 전용</option>
          </select>
        </div>
        {node.type === 'interface-rule' && (
          <>
            <div className="property-panel__field">
              <label className="property-panel__label">Interface Rule — From Lane</label>
              <select
                className="property-panel__select"
                value={node.interfaceRuleAnchor?.fromLaneId ?? 'warehouse-easyadmin'}
                disabled={disabled}
                onChange={(e) =>
                  onChange({
                    ...node,
                    interfaceRuleAnchor: {
                      fromLaneId: e.target.value,
                      toLaneId: node.interfaceRuleAnchor?.toLaneId ?? 'finance',
                    },
                  })
                }
              >
                {sortedLanes.map((lane) => (
                  <option key={lane.id} value={lane.id}>
                    {lane.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="property-panel__field">
              <label className="property-panel__label">Interface Rule — To Lane</label>
              <select
                className="property-panel__select"
                value={node.interfaceRuleAnchor?.toLaneId ?? 'finance'}
                disabled={disabled}
                onChange={(e) =>
                  onChange({
                    ...node,
                    interfaceRuleAnchor: {
                      fromLaneId: node.interfaceRuleAnchor?.fromLaneId ?? 'warehouse-easyadmin',
                      toLaneId: e.target.value,
                    },
                  })
                }
              >
                {sortedLanes.map((lane) => (
                  <option key={lane.id} value={lane.id}>
                    {lane.name}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}
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
  return (
    <>
      <span className={`node-detail__type node-detail__type--${node.type}`}>{getNodeTypeLabel(node.type)}</span>
      <h2 className="property-panel__view-name">{node.name}</h2>
      <p className="property-panel__view-desc">{node.description || '설명 없음'}</p>
      <dl className="property-panel__dl">
        <div className="property-panel__dl-row"><dt>Lane</dt><dd>{lane?.name ?? node.laneId}</dd></div>
        <div className="property-panel__dl-row"><dt>localOrder</dt><dd>{resolveNodeLocalOrder(node, process)}</dd></div>
        <div className="property-panel__dl-row"><dt>phaseOrder</dt><dd>{resolveNodePhaseOrder(node, process)}</dd></div>
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

function EdgeForm({ edge, process, disabled, onChange }: { edge: Edge; process: Process; disabled: boolean; onChange: (edge: Edge) => void }) {
  const edgeType = resolveEdgeType(edge)
  const isDerived = isDerivedDisplayEdge(edge)
  const isVirtualType = resolveEdgeType(edge) === 'virtual'
  const readOnly = disabled || isReadOnlyDisplayEdge(edge)
  const patch = (partial: Partial<Edge>) => onChange(withEdgeHandleDefaults({ ...edge, ...partial }))
  const patchHandles = (partial: { sourceHandle?: Edge['sourceHandle']; targetHandle?: Edge['targetHandle'] }) =>
    onChange(patchEdgeHandles(edge, partial))
  const nodeOptions = sortNodesForSelect(process.nodes)
  const handleAuto = isHandleAutoEnabled(edge)
  const routeMeta = edge.data as Record<string, unknown> | undefined
  const validationStatus = routeMeta?.validationStatus as EdgeValidationStatus | undefined
  const routeIssueLabel = routeMeta?.routeIssueLabel as string | undefined
  const routeIssue = routeMeta?.routeIssue as string | undefined
  const suggestedFix = routeMeta?.suggestedFix as string | undefined
  const collidedNodeIds = routeMeta?.collidedNodeIds as string[] | undefined
  const bendCount = routeMeta?.bendCount as number | undefined
  const routingStatus = routeMeta?.routingStatus as string | undefined

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
        <div className="edge-connection-fields__handles">
          <HandleSelect
            label="출발면"
            value={edge.sourceHandle ?? 'bottom'}
            disabled={readOnly}
            onChange={(sourceHandle) => patchHandles({ sourceHandle })}
          />
          <HandleSelect
            label="도착면"
            value={edge.targetHandle ?? 'top'}
            disabled={readOnly}
            onChange={(targetHandle) => patchHandles({ targetHandle })}
          />
        </div>
        {!readOnly && (
          <div className="property-panel__field">
            <label className="property-panel__label">
              <input
                type="checkbox"
                checked={handleAuto && edge.routing?.mode !== 'manual'}
                disabled={disabled || edge.routing?.mode === 'manual'}
                onChange={(e) => {
                  if (e.target.checked) onChange(unlockEdgeHandles(edge))
                  else onChange(lockEdgeHandles(withEdgeHandleDefaults(edge)))
                }}
              />{' '}
              Handle 자동 (router가 geometry 기준 선택)
            </label>
            {!handleAuto && edge.routing?.mode !== 'manual' && (
              <p className="property-panel__hint">출발/도착면을 지정하면 router가 해당 handle을 우선합니다.</p>
            )}
          </div>
        )}
        <div className="property-panel__field">
          <label className="property-panel__label">Edge Type</label>
          <select className="property-panel__select" value={edgeType} disabled={disabled} onChange={(e) => patch({ type: e.target.value as EdgeType })}>
            {EDGE_FORM_TYPES.map(({ value, label }) => (<option key={value} value={value}>{label}</option>))}
          </select>
        </div>
        <div className="property-panel__field">
          <label className="property-panel__label">priority</label>
          <input
            type="number"
            className="property-panel__input"
            value={edge.priority ?? 0}
            disabled={disabled}
            onChange={(e) => {
              const v = Number.parseInt(e.target.value, 10)
              patch({ priority: Number.isNaN(v) ? 0 : v })
            }}
          />
        </div>
        <div className="property-panel__field">
          <label className="property-panel__label">processGroupId</label>
          <input
            className="property-panel__input"
            value={edge.processGroupId ?? ''}
            disabled={disabled}
            onChange={(e) => patch({ processGroupId: e.target.value || undefined })}
          />
        </div>
        <div className="property-panel__field"><label className="property-panel__label">Label</label><input className="property-panel__input" value={edge.label} disabled={disabled} onChange={(e) => patch({ label: e.target.value })} /></div>
        <div className="property-panel__field">
          <label className="property-panel__label">Condition</label>
          <input className="property-panel__input" list="edge-condition-presets" value={edge.condition} disabled={disabled} onChange={(e) => patch({ condition: e.target.value })} />
          <datalist id="edge-condition-presets">{CONDITION_PRESETS.map((c) => (<option key={c} value={c} />))}</datalist>
        </div>
      </div>
      <div className="property-panel__section">
        <h3 className="property-panel__section-title">Route Status</h3>
        <div className="property-panel__field">
          <label className="property-panel__label">상태</label>
          <input
            className="property-panel__input"
            value={routeIssueLabel ?? (validationStatus === 'ok' ? '정상' : validationStatus ?? '—')}
            disabled
            readOnly
          />
        </div>
        {validationStatus ? (
          <div className="property-panel__field">
            <label className="property-panel__label">validationStatus</label>
            <input className="property-panel__input" value={validationStatus} disabled readOnly />
          </div>
        ) : null}
        {routeIssue ? (
          <div className="property-panel__field">
            <label className="property-panel__label">routeIssue</label>
            <input className="property-panel__input" value={routeIssue} disabled readOnly />
          </div>
        ) : null}
        {collidedNodeIds && collidedNodeIds.length > 0 ? (
          <div className="property-panel__field">
            <label className="property-panel__label">collidedNodeIds</label>
            <input className="property-panel__input" value={collidedNodeIds.join(', ')} disabled readOnly />
          </div>
        ) : null}
        {typeof bendCount === 'number' ? (
          <div className="property-panel__field">
            <label className="property-panel__label">bendCount</label>
            <input className="property-panel__input" value={String(bendCount)} disabled readOnly />
          </div>
        ) : null}
        {routingStatus ? (
          <div className="property-panel__field">
            <label className="property-panel__label">routingStatus</label>
            <input className="property-panel__input" value={routingStatus} disabled readOnly />
          </div>
        ) : null}
        {suggestedFix ? (
          <div className="property-panel__field">
            <label className="property-panel__label">suggestedFix</label>
            <p className="property-panel__hint">{suggestedFix}</p>
          </div>
        ) : null}
      </div>
    </>
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

function ZoneForm({
  zone,
  process,
  disabled,
  onChange,
  onApply,
}: {
  zone: ProcessZone
  process: Process
  disabled: boolean
  onChange: (zone: ProcessZone) => void
  onApply?: (zone: ProcessZone) => void
}) {
  const selectableNodes = sortNodesForSelect(
    process.nodes.filter((node) => node.type !== 'phase-connector'),
  )

  const toggleNode = (nodeId: string) => {
    const next = zone.nodeIds.includes(nodeId)
      ? zone.nodeIds.filter((id) => id !== nodeId)
      : [...zone.nodeIds, nodeId]
    const updated = { ...zone, nodeIds: next }
    onChange(updated)
    onApply?.(updated)
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
          onChange={(e) => onChange({ ...zone, name: e.target.value })}
        />
      </div>
      <div className="property-panel__field">
        <label className="property-panel__label">Zone ID</label>
        <input className="property-panel__input" value={zone.id} disabled readOnly />
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
            onChange={(e) => onChange({ ...zone, style: { ...style, showBackground: e.target.checked } })}
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
            onChange={(e) => onChange({ ...zone, style: { ...style, showBorder: e.target.checked } })}
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
            onChange({
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
        <label className="property-panel__label">Padding X (px)</label>
        <input
          type="number"
          className="property-panel__input"
          min={0}
          value={style.paddingX ?? 24}
          disabled={disabled}
          onChange={(e) => {
            const v = Number.parseInt(e.target.value, 10)
            const updated = { ...zone, style: { ...style, paddingX: Number.isNaN(v) ? 24 : v } }
            onChange(updated)
            onApply?.(updated)
          }}
        />
      </div>
      <div className="property-panel__field">
        <label className="property-panel__label">Header 높이 (px)</label>
        <input
          type="number"
          className="property-panel__input"
          min={0}
          value={style.headerHeight ?? style.paddingY ?? 36}
          disabled={disabled}
          onChange={(e) => {
            const v = Number.parseInt(e.target.value, 10)
            const updated = {
              ...zone,
              style: { ...style, headerHeight: Number.isNaN(v) ? 36 : v },
            }
            onChange(updated)
            onApply?.(updated)
          }}
        />
      </div>
      <div className="property-panel__field">
        <label className="property-panel__label">Padding Bottom (px)</label>
        <input
          type="number"
          className="property-panel__input"
          min={0}
          value={style.paddingBottom ?? style.paddingY ?? 32}
          disabled={disabled}
          onChange={(e) => {
            const v = Number.parseInt(e.target.value, 10)
            const updated = {
              ...zone,
              style: { ...style, paddingBottom: Number.isNaN(v) ? 32 : v },
            }
            onChange(updated)
            onApply?.(updated)
          }}
        />
        <p className="property-panel__hint">
          Zone border만 변경됩니다. 외부 node와 최소 40px 간격은 자동 적용됩니다.
        </p>
      </div>
      <div className="property-panel__field property-panel__field--inline">
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
  }, [selectedElement])

  const commitNode = useCallback(
    (node: Node) => {
      const r = validateNode(node, process)
      if (!r.ok) {
        setError(r.message)
        return false
      }
      setError(null)
      onSaveNode(node, false)
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

  if ((selectedElement.type === 'node' || selectedElement.type === 'new-node') && draftNode) {
    const isNewNode = selectedElement.type === 'new-node'

    return (
      <div className="property-panel">
        {isNewNode ? (
          <NewItemActions
            targetLabel="Node"
            error={error}
            onSave={() => {
              const r = validateNode(draftNode, process)
              if (!r.ok) { setError(r.message); return }
              setError(null)
              onSaveNode(draftNode, true)
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
  const { appMode, selectedElement } = props
  const isEditMode = appMode === 'edit'

  if (!selectedElement) {
    return (
      <div className="property-panel node-detail-panel" {...panelEventShieldProps}>
        <p className="property-panel__empty">
          {isEditMode
            ? '편집할 항목을 선택하세요. 노드·연결선·스윔레인·Zone 타이틀을 클릭하거나 상단 + 버튼으로 추가할 수 있습니다.'
            : '프로세스맵에서 노드를 클릭하면 상세 정보가 표시됩니다.'}
        </p>
      </div>
    )
  }

  return (
    <div className="node-detail-panel" {...panelEventShieldProps}>
      <PropertyPanelEditor key={selectedElementKey(selectedElement)} {...props} selectedElement={selectedElement} />
    </div>
  )
}
