import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { ConnectorSubType } from '../../../types/connectorTypes'
import type { ProcessNodeData } from '../../../lib/layout/elkLayout'
import { resolveConnectorSubType } from '../../../lib/layout/connectorLayout'
import type { Node } from '../../../types/process'
import './connector-node.css'

const HANDLES = [
  { id: 'top', position: Position.Top },
  { id: 'left', position: Position.Left },
  { id: 'right', position: Position.Right },
  { id: 'bottom', position: Position.Bottom },
] as const

type ConnectorNodeData = ProcessNodeData & {
  connectorSubType?: ConnectorSubType
}

function ConnectorNodeCard({ data, selected }: NodeProps & { data: ConnectorNodeData }) {
  const subType: ConnectorSubType =
    data.connectorSubType ??
    resolveConnectorSubType({ type: data.type, connectorSubType: data.connectorSubType } as Node)

  return (
    <div
      className={`connector-node connector-node--${subType}${selected ? ' connector-node--selected' : ''}`}
      title={data.name}
    >
      <div className="connector-node__circle" aria-hidden />
      {selected && (
        <span className="connector-node__label">{data.name}</span>
      )}
      {HANDLES.map(({ id, position }) => (
        <Handle
          key={`target-${id}`}
          type="target"
          position={position}
          id={`target-${id}`}
          className="connector-node__handle"
        />
      ))}
      {HANDLES.map(({ id, position }) => (
        <Handle
          key={`source-${id}`}
          type="source"
          position={position}
          id={`source-${id}`}
          className="connector-node__handle connector-node__handle--source"
        />
      ))}
    </div>
  )
}

export default memo(ConnectorNodeCard)
