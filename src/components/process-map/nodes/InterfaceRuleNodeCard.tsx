import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { ProcessNodeData } from '../../../lib/layout/elkLayout'
import { INTERFACE_RULE_POLYGON_POINTS } from '../../../lib/layout/interfaceRuleLayout'
import './interface-rule-node.css'

const SIDE_HANDLES = [
  { id: 'left', position: Position.Left },
  { id: 'top', position: Position.Top },
  { id: 'right', position: Position.Right },
  { id: 'bottom', position: Position.Bottom },
] as const

function InterfaceRuleNodeCard({ data, selected }: NodeProps & { data: ProcessNodeData }) {
  const compact = data.compact === true

  return (
    <div
      className={`interface-rule-node${compact ? ' interface-rule-node--compact' : ''}${selected ? ' interface-rule-node--selected' : ''}`}
    >
      <svg className="interface-rule-node__diamond" viewBox="0 0 68 68" aria-hidden>
        <polygon className="interface-rule-node__polygon" points={INTERFACE_RULE_POLYGON_POINTS} />
      </svg>
      <div className="interface-rule-node__content">
        <span className="interface-rule-node__badge">Rule</span>
        <span className="interface-rule-node__name" title={data.name}>
          {data.name}
        </span>
        {data.system ? (
          <span className="interface-rule-node__meta" title={data.system}>
            {data.system}
          </span>
        ) : null}
      </div>
      {!compact &&
        SIDE_HANDLES.map(({ id, position }) => (
          <Handle
            key={`target-${id}`}
            type="target"
            position={position}
            id={`target-${id}`}
            className="interface-rule-node__handle"
          />
        ))}
      {!compact &&
        SIDE_HANDLES.map(({ id, position }) => (
          <Handle
            key={`source-${id}`}
            type="source"
            position={position}
            id={`source-${id}`}
            className="interface-rule-node__handle interface-rule-node__handle--source"
          />
        ))}
    </div>
  )
}

export default memo(InterfaceRuleNodeCard)
