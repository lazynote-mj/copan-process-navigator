import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { ProcessNodeData } from '../../../lib/layout/elkLayout'
import './merge-node.css'

const HANDLES = [
  { id: 'top', position: Position.Top },
  { id: 'left', position: Position.Left },
  { id: 'right', position: Position.Right },
  { id: 'bottom', position: Position.Bottom },
] as const

function MergeNodeCard({ data, selected }: NodeProps & { data: ProcessNodeData }) {
  return (
    <div className={`merge-node${selected ? ' merge-node--selected' : ''}`}>
      <div className="merge-node__circle" aria-hidden />
      <span className="merge-node__label" title={data.name}>
        {data.name}
      </span>
      {HANDLES.map(({ id, position }) => (
        <Handle
          key={`target-${id}`}
          type="target"
          position={position}
          id={`target-${id}`}
          className="merge-node__handle"
        />
      ))}
      {HANDLES.map(({ id, position }) => (
        <Handle
          key={`source-${id}`}
          type="source"
          position={position}
          id={`source-${id}`}
          className="merge-node__handle merge-node__handle--source"
        />
      ))}
    </div>
  )
}

export default memo(MergeNodeCard)
