import type { Edge, Process } from '../../types/process'
import type { EdgeType } from '../../types/edgeTypes'
import { resolveEdgeType } from '../../types/edgeTypes'
import { patchEdgeHandles, resolveEdgeSourceHandle, resolveEdgeTargetHandle } from '../../lib/editor/edgeHandles'
import { formatNodeSelectLabel, sortNodesForSelect } from '../../lib/editor/sortNodesForSelect'
import { HandleSelect } from './HandleSelect'
import type { EdgeHandleId } from '../../types/process'

const CONDITION_PRESETS = ['Y', 'N', '신규', '기존']

const EDGE_FORM_TYPES: { value: EdgeType; label: string }[] = [
  { value: 'normal', label: 'normal' },
  { value: 'condition', label: 'condition' },
  { value: 'system', label: 'system' },
  { value: 'api', label: 'api' },
  { value: 'exception', label: 'exception' },
  { value: 'return', label: 'return' },
  { value: 'virtual', label: '가상 연결 (virtual)' },
  { value: 'reference', label: '참조 관계 (reference)' },
]

type EdgeConnectionFieldsProps = {
  edge: Edge
  process: Process
  disabled?: boolean
  direction: 'incoming' | 'outgoing'
  fixedNodeId: string
  onChange: (edge: Edge) => void
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
  const nodeOptions = sortNodesForSelect(process.nodes.filter((n) => n.id !== fixedNodeId))

  const patch = (partial: Partial<Edge>) => onChange({ ...edge, ...partial })

  return (
    <div className="edge-connection-fields">
      {direction === 'incoming' ? (
        <div className="property-panel__field">
          <label className="property-panel__label">이전 노드 (source)</label>
          <select
            className="property-panel__select"
            value={edge.source}
            disabled={disabled}
            onChange={(e) => patch({ source: e.target.value })}
          >
            <option value="">선택…</option>
            {nodeOptions.map((n) => (
              <option key={n.id} value={n.id}>
                {formatNodeSelectLabel(n)}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div className="property-panel__field">
          <label className="property-panel__label">다음 노드 (target)</label>
          <select
            className="property-panel__select"
            value={edge.target}
            disabled={disabled}
            onChange={(e) => patch({ target: e.target.value })}
          >
            <option value="">선택…</option>
            {nodeOptions.map((n) => (
              <option key={n.id} value={n.id}>
                {formatNodeSelectLabel(n)}
              </option>
            ))}
          </select>
        </div>
      )}

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

      <div className="property-panel__field">
        <label className="property-panel__label">Edge Type</label>
        <select
          className="property-panel__select"
          value={edgeType}
          disabled={disabled}
          onChange={(e) => patch({ type: e.target.value as EdgeType, routing: { mode: 'auto' } })}
        >
          {EDGE_FORM_TYPES.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="property-panel__field">
        <label className="property-panel__label">Label</label>
        <input
          className="property-panel__input"
          value={edge.label}
          disabled={disabled}
          onChange={(e) => patch({ label: e.target.value })}
        />
      </div>

      <div className="property-panel__field">
        <label className="property-panel__label">Condition</label>
        <input
          className="property-panel__input"
          list="edge-condition-presets"
          value={edge.condition}
          disabled={disabled}
          onChange={(e) => patch({ condition: e.target.value })}
        />
        <datalist id="edge-condition-presets">
          {CONDITION_PRESETS.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </div>
    </div>
  )
}
