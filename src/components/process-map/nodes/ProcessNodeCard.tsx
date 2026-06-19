import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { ProcessNodeData } from '../../../lib/layout/elkLayout'
import { getNodeTypeLabel, NODE_TYPE_META, resolveNodeVisualClass } from '../../../types/nodeTypes'
import type { NodeType } from '../../../types/nodeTypes'
import './process-node.css'

const SIDE_HANDLES = [
  { id: 'left', position: Position.Left },
  { id: 'top', position: Position.Top },
  { id: 'right', position: Position.Right },
  { id: 'bottom', position: Position.Bottom },
] as const

function ProcessNodeCard({ data, selected }: NodeProps & { data: ProcessNodeData }) {
  const nodeType = data.type as NodeType
  const visualClass = resolveNodeVisualClass(nodeType, data.system)
  const dashed = NODE_TYPE_META[nodeType]?.dashedBorder ?? false
  const compact = data.compact === true
  const cell3Col = data.cell3Col === true

  return (
    <div
      className={`process-node process-node--${visualClass}${dashed ? ' process-node--dashed' : ''}${cell3Col ? ' process-node--cell-3col' : compact ? ' process-node--compact' : ''} ${selected ? 'process-node--selected' : ''}`}
    >
      {SIDE_HANDLES.map(({ id, position }) => (
        <Handle
          key={`target-${id}`}
          type="target"
          position={position}
          id={`target-${id}`}
          className="process-node__handle"
        />
      ))}
      {SIDE_HANDLES.map(({ id, position }) => (
        <Handle
          key={`source-${id}`}
          type="source"
          position={position}
          id={`source-${id}`}
          className="process-node__handle process-node__handle--source"
        />
      ))}
      {!compact && <div className="process-node__type">{getNodeTypeLabel(nodeType)}</div>}
      <div className="process-node__name">{data.name}</div>
      {compact && data.system ? (
        <div className="process-node__subtitle">{data.system}</div>
      ) : null}
      {!compact && <div className="process-node__phase">{data.phaseLabel}</div>}
    </div>
  )
}

export default memo(ProcessNodeCard)
