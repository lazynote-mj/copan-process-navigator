import type { Process, Node } from '../../types/process'
import {
  getLaneById,
  getPhaseLabel,
  NODE_TYPES,
  NODE_TYPE_META,
  getNodeTypeLabel,
} from '../../types/process'
import type { NodeType } from '../../types/process'
import { resolveNodePhaseOrder } from '../../lib/layout/gridLayout'
import { resolveNodeLocalOrder } from '../../lib/layout/localOrder'
import { downloadProcessJson } from '../../data/processExport'
import './node-detail.css'

type NodeDetailProps = {
  process: Process
  node: Node | null
  onNodeTypeChange?: (nodeId: string, type: NodeType) => void
  onNodePhaseOrderChange?: (nodeId: string, phaseOrder: number) => void
  onNodeLocalOrderChange?: (nodeId: string, localOrder: number) => void
}

function ArtifactList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null

  return (
    <div className="node-detail__section">
      <h3 className="node-detail__section-title">{title}</h3>
      <ul className="node-detail__list">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  )
}

export function NodeDetail({
  process,
  node,
  onNodeTypeChange,
  onNodePhaseOrderChange,
  onNodeLocalOrderChange,
}: NodeDetailProps) {
  if (!node) {
    return (
      <div>
        <button
          type="button"
          className="node-detail__export"
          onClick={() => downloadProcessJson(process)}
        >
          JSON Export
        </button>
        <p className="node-detail__empty">
          프로세스맵에서 노드를 클릭하면
          <br />
          상세 업무 정보가 표시됩니다.
        </p>
      </div>
    )
  }

  const lane = getLaneById(process, node.laneId)
  const phaseLabel = getPhaseLabel(process, node.phaseId)
  const phaseOrder = resolveNodePhaseOrder(node, process)
  const localOrder = resolveNodeLocalOrder(node, process)

  return (
    <div className="node-detail">
      <button
        type="button"
        className="node-detail__export"
        onClick={() => downloadProcessJson(process)}
      >
        JSON Export
      </button>

      <div className="node-detail__header">
        <span className={`node-detail__type node-detail__type--${node.type}`}>
          {getNodeTypeLabel(node.type)}
        </span>
        <h2 className="node-detail__name">{node.name}</h2>
      </div>

      <div className="node-detail__field">
        <label className="node-detail__field-label" htmlFor="node-type-select">
          노드 유형
        </label>
        <select
          id="node-type-select"
          className="node-detail__select"
          value={node.type}
          onChange={(e) => onNodeTypeChange?.(node.id, e.target.value as NodeType)}
        >
          {NODE_TYPES.map((type) => (
            <option key={type} value={type}>
              {NODE_TYPE_META[type].label} — {NODE_TYPE_META[type].description}
            </option>
          ))}
        </select>
      </div>

      <div className="node-detail__field">
        <label className="node-detail__field-label" htmlFor="node-phase-order">
          phaseOrder
        </label>
        <input
          id="node-phase-order"
          type="number"
          min={1}
          className="node-detail__input"
          value={phaseOrder}
          onChange={(e) => {
            const next = Number.parseInt(e.target.value, 10)
            if (!Number.isNaN(next) && next > 0) {
              onNodePhaseOrderChange?.(node.id, next)
            }
          }}
        />
        <p className="node-detail__field-hint">전체 프로세스 단계 순서 (설명/필터용)</p>
      </div>

      <div className="node-detail__field">
        <label className="node-detail__field-label" htmlFor="node-local-order">
          스윔레인 내 순서
        </label>
        <input
          id="node-local-order"
          type="number"
          min={1}
          className="node-detail__input"
          value={localOrder}
          onChange={(e) => {
            const next = Number.parseInt(e.target.value, 10)
            if (!Number.isNaN(next) && next > 0) {
              onNodeLocalOrderChange?.(node.id, next)
            }
          }}
        />
        <p className="node-detail__field-hint">스윔레인 내 좌→우 배치 순서 (localOrder)</p>
      </div>

      <p className="node-detail__description">{node.description}</p>

      <dl className="node-detail__meta">
        <div className="node-detail__meta-row">
          <dt>단계</dt>
          <dd>{phaseLabel}</dd>
        </div>
        <div className="node-detail__meta-row">
          <dt>Lane</dt>
          <dd>
            {lane?.name ?? node.laneId}
            {lane ? ` (${lane.ownerDepartment})` : ''}
          </dd>
        </div>
        <div className="node-detail__meta-row">
          <dt>담당</dt>
          <dd>{node.owner}</dd>
        </div>
        <div className="node-detail__meta-row">
          <dt>시스템</dt>
          <dd>{node.system}</dd>
        </div>
      </dl>

      <ArtifactList title="Inputs" items={node.inputs} />
      <ArtifactList title="Outputs" items={node.outputs} />
      <ArtifactList title="Controls" items={node.controls} />
    </div>
  )
}
