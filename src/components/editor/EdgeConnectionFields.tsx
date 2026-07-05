import type { Edge, Process } from '../../types/process'
import type { EdgeType } from '../../types/edgeTypes'
import { resolveEdgeType } from '../../types/edgeTypes'
import { patchEdgeHandles, resolveEdgeSourceHandle, resolveEdgeTargetHandle } from '../../lib/editor/edgeHandles'
import { sortNodesForSelect } from '../../lib/editor/sortNodesForSelect'
import { HandleSelect } from './HandleSelect'
import type { EdgeHandleId } from '../../types/process'

const EDGE_LABEL_PRESETS = [
  'Y',
  'N',
  '승인',
  '반려',
  'API 연동',
  '재고(+)',
  '재고(-)',
  'AUTO',
  'G/W 상신',
  '전표생성(미결)',
]

const EDGE_FORM_TYPES: { value: EdgeType; label: string }[] = [
  { value: 'normal', label: '일반 흐름' },
  { value: 'condition', label: '승인/판단 흐름' },
  { value: 'api', label: '시스템 연동' },
  { value: 'reference', label: '연결 프로세스' },
  { value: 'virtual', label: '표시 전용 연결선' },
  { value: 'exception', label: '예외 흐름' },
  { value: 'return', label: '반려/되돌림' },
]

type EdgeConnectionFieldsProps = {
  edge: Edge
  process: Process
  disabled?: boolean
  direction: 'incoming' | 'outgoing' | 'both'
  fixedNodeId?: string
  onChange: (edge: Edge) => void
}

function formatBusinessNodeLabel(node: Pick<Edge, 'id'> & { name?: string }, nodes: Process['nodes']): string {
  const duplicateCount = nodes.filter((n) => n.name === node.name).length
  if (!node.name) return node.id
  return duplicateCount > 1 ? `${node.name} (${node.id})` : node.name
}

function formatOptionalBoolean(value: boolean | undefined): string {
  if (value === true) return 'true'
  if (value === false) return 'false'
  return '-'
}

function formatPointCount(edge: Edge): string {
  const routingPoints = edge.routing?.points?.length ?? 0
  const bendPoints = edge.bendPoints?.length ?? 0
  const legacyPoints = edge.points?.length ?? 0
  return `routing ${routingPoints} / bend ${bendPoints} / legacy ${legacyPoints}`
}

export function EdgeConnectionFields({
  edge,
  process,
  disabled = false,
  direction,
  fixedNodeId,
  onChange,
}: EdgeConnectionFieldsProps) {
  const edgeType = resolveEdgeType(edge)
  const nodeOptions = sortNodesForSelect(
    fixedNodeId ? process.nodes.filter((n) => n.id !== fixedNodeId) : process.nodes,
  )

  const patch = (partial: Partial<Edge>) => onChange({ ...edge, ...partial })
  const patchType = (type: EdgeType) => {
    patch({
      type,
      routing: { ...edge.routing, mode: 'auto' },
      displayOnly: type === 'virtual' ? true : undefined,
    })
  }

  return (
    <div className="edge-connection-fields">
      {(direction === 'incoming' || direction === 'both') && (
        <div className="property-panel__field">
          <label className="property-panel__label">이전 업무</label>
          <select
            className="property-panel__select"
            value={edge.source}
            disabled={disabled}
            onChange={(e) => patch({ source: e.target.value })}
          >
            <option value="">선택…</option>
            {nodeOptions.map((n) => (
              <option key={n.id} value={n.id}>
                {formatBusinessNodeLabel(n, process.nodes)}
              </option>
            ))}
          </select>
        </div>
      )}

      {(direction === 'outgoing' || direction === 'both') && (
        <div className="property-panel__field">
          <label className="property-panel__label">다음 업무</label>
          <select
            className="property-panel__select"
            value={edge.target}
            disabled={disabled}
            onChange={(e) => patch({ target: e.target.value })}
          >
            <option value="">선택…</option>
            {nodeOptions.map((n) => (
              <option key={n.id} value={n.id}>
                {formatBusinessNodeLabel(n, process.nodes)}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="property-panel__field">
        <label className="property-panel__label">연결 유형</label>
        <select
          className="property-panel__select"
          value={edgeType}
          disabled={disabled}
          onChange={(e) => patchType(e.target.value as EdgeType)}
        >
          {EDGE_FORM_TYPES.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="property-panel__field">
        <label className="property-panel__label">연결 라벨</label>
        <textarea
          className="property-panel__textarea edge-connection-fields__label"
          value={edge.label}
          disabled={disabled}
          onChange={(e) => patch({ label: e.target.value })}
        />
        <select
          className="property-panel__select edge-connection-fields__preset"
          value=""
          disabled={disabled}
          onChange={(e) => {
            if (e.target.value) patch({ label: e.target.value })
          }}
        >
          <option value="">라벨 프리셋 선택…</option>
          {EDGE_LABEL_PRESETS.map((label) => (
            <option key={label} value={label}>
              {label}
            </option>
          ))}
        </select>
        <p className="property-panel__hint">연결선 옆에 표시할 문구입니다. Enter로 줄바꿈할 수 있습니다.</p>
      </div>

      <div className="property-panel__field">
        <label className="property-panel__label">조건</label>
        <input
          className="property-panel__input"
          value={edge.condition}
          disabled={disabled}
          onChange={(e) => patch({ condition: e.target.value })}
        />
        <p className="property-panel__hint">Y/N, 승인/반려처럼 흐름이 갈라지는 기준을 입력합니다.</p>
      </div>

      <details className="property-panel__advanced edge-connection-fields__advanced">
        <summary className="property-panel__advanced-summary">고급 연결 설정</summary>
        <p className="property-panel__hint">
          연결 위치나 내부 ID를 직접 확인해야 할 때만 사용합니다.
        </p>
        <div className="edge-connection-fields__handles">
          <HandleSelect
            label="출발면"
            value={(resolveEdgeSourceHandle(edge) ?? 'bottom') as EdgeHandleId}
            disabled={disabled}
            onChange={(sourceHandle) => onChange(patchEdgeHandles(edge, { sourceHandle }))}
          />
          <HandleSelect
            label="도착면"
            value={(resolveEdgeTargetHandle(edge) ?? 'top') as EdgeHandleId}
            disabled={disabled}
            onChange={(targetHandle) => onChange(patchEdgeHandles(edge, { targetHandle }))}
          />
        </div>
        <dl className="property-panel__dl property-panel__dl--compact">
          <div className="property-panel__dl-row"><dt>edgeId</dt><dd>{edge.id}</dd></div>
          <div className="property-panel__dl-row"><dt>sourceId</dt><dd>{edge.source || '-'}</dd></div>
          <div className="property-panel__dl-row"><dt>targetId</dt><dd>{edge.target || '-'}</dd></div>
          <div className="property-panel__dl-row"><dt>sourceHandle</dt><dd>{edge.sourceHandle ?? edge.routing?.sourceHandle ?? '-'}</dd></div>
          <div className="property-panel__dl-row"><dt>targetHandle</dt><dd>{edge.targetHandle ?? edge.routing?.targetHandle ?? '-'}</dd></div>
          <div className="property-panel__dl-row"><dt>routingMode</dt><dd>{edge.routing?.mode ?? '-'}</dd></div>
          <div className="property-panel__dl-row"><dt>handleAuto</dt><dd>{formatOptionalBoolean(edge.routing?.handleAuto)}</dd></div>
          <div className="property-panel__dl-row"><dt>routePoints</dt><dd>{formatPointCount(edge)}</dd></div>
          <div className="property-panel__dl-row"><dt>displayOnly</dt><dd>{formatOptionalBoolean(edge.displayOnly)}</dd></div>
          <div className="property-panel__dl-row"><dt>isDerived</dt><dd>{formatOptionalBoolean(edge.isDerived)}</dd></div>
          <div className="property-panel__dl-row"><dt>manualRoute</dt><dd>{formatOptionalBoolean(edge.manualRoute)}</dd></div>
        </dl>
      </details>
    </div>
  )
}
