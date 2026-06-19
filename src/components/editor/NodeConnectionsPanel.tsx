import { useEffect, useState } from 'react'
import type { Edge, Node, Process } from '../../types/process'
import {
  createDefaultIncomingEdge,
  createDefaultOutgoingEdge,
  getDecisionEdgeWarnings,
  getIncomingEdges,
  getOutgoingEdges,
  withEdgeHandleDefaults,
} from '../../lib/editor/edgeHandles'
import { EdgeConnectionFields } from './EdgeConnectionFields'
import './node-connections-panel.css'

type NodeConnectionsPanelProps = {
  node: Node
  process: Process
  disabled?: boolean
  incomingTitle?: string
  outgoingTitle?: string
  onSaveEdge: (edge: Edge, isNew: boolean) => void
  onDeleteEdge: (edgeId: string) => void
  onSelectEdge?: (edgeId: string) => void
}

function ConnectionRow({
  edge,
  process,
  direction,
  fixedNodeId,
  disabled,
  onSave,
  onDelete,
  onSelect,
}: {
  edge: Edge
  process: Process
  direction: 'incoming' | 'outgoing'
  fixedNodeId: string
  disabled?: boolean
  onSave: (edge: Edge) => void
  onDelete: () => void
  onSelect?: () => void
}) {
  const [draft, setDraft] = useState(edge)

  useEffect(() => {
    setDraft(edge)
  }, [edge])

  const commit = (next: Edge) => {
    const normalized = withEdgeHandleDefaults(next)
    setDraft(normalized)
    onSave(normalized)
  }

  return (
    <div className="node-connections-panel__row">
      <div className="node-connections-panel__row-head">
        <button type="button" className="node-connections-panel__edge-id" onClick={onSelect}>
          {edge.id}
        </button>
        {!disabled && (
          <button
            type="button"
            className="property-panel__btn property-panel__btn--danger property-panel__btn--sm"
            onClick={onDelete}
          >
            삭제
          </button>
        )}
      </div>
      <EdgeConnectionFields
        edge={draft}
        process={process}
        disabled={disabled}
        direction={direction}
        fixedNodeId={fixedNodeId}
        onChange={commit}
      />
    </div>
  )
}

export function NodeConnectionsPanel({
  node,
  process,
  disabled = false,
  incomingTitle = '이전 노드',
  outgoingTitle = '다음 노드',
  onSaveEdge,
  onDeleteEdge,
  onSelectEdge,
}: NodeConnectionsPanelProps) {
  const incoming = getIncomingEdges(process, node.id)
  const outgoing = getOutgoingEdges(process, node.id)
  const warnings = getDecisionEdgeWarnings(node, process)

  const addIncoming = () => {
    const edge = createDefaultIncomingEdge(node.id)
    onSaveEdge(edge, true)
  }

  const addOutgoing = () => {
    const edge = createDefaultOutgoingEdge(node.id)
    onSaveEdge(edge, true)
  }

  return (
    <>
      {warnings.length > 0 && (
        <div className="node-connections-panel__warnings">
          {warnings.map((w) => (
            <p key={w} className="property-panel__hint property-panel__hint--warn">
              {w}
            </p>
          ))}
        </div>
      )}

      <div className="property-panel__section">
        <div className="node-connections-panel__header">
          <h3 className="property-panel__section-title">{incomingTitle}</h3>
          {!disabled && (
            <button type="button" className="property-panel__btn property-panel__btn--sm" onClick={addIncoming}>
              + 이전 노드 연결 추가
            </button>
          )}
        </div>
        {incoming.length === 0 ? (
          <p className="property-panel__hint">연결된 이전 노드가 없습니다.</p>
        ) : (
          incoming.map((edge) => (
            <ConnectionRow
              key={edge.id}
              edge={edge}
              process={process}
              direction="incoming"
              fixedNodeId={node.id}
              disabled={disabled}
              onSave={(e) => onSaveEdge(e, false)}
              onDelete={() => onDeleteEdge(edge.id)}
              onSelect={() => onSelectEdge?.(edge.id)}
            />
          ))
        )}
      </div>

      <div className="property-panel__section">
        <div className="node-connections-panel__header">
          <h3 className="property-panel__section-title">{outgoingTitle}</h3>
          {!disabled && (
            <button type="button" className="property-panel__btn property-panel__btn--sm" onClick={addOutgoing}>
              + 다음 노드 연결 추가
            </button>
          )}
        </div>
        {outgoing.length === 0 ? (
          <p className="property-panel__hint">연결된 다음 노드가 없습니다.</p>
        ) : (
          outgoing.map((edge) => (
            <ConnectionRow
              key={edge.id}
              edge={edge}
              process={process}
              direction="outgoing"
              fixedNodeId={node.id}
              disabled={disabled}
              onSave={(e) => onSaveEdge(e, false)}
              onDelete={() => onDeleteEdge(edge.id)}
              onSelect={() => onSelectEdge?.(edge.id)}
            />
          ))
        )}
      </div>
    </>
  )
}
