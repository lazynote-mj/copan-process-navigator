import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { ProcessNodeData } from '../../../lib/layout/elkLayout'
import './process-node.css'
import './database-node.css'
import { NodeStepBadge } from './NodeStepBadge'

const SIDE_HANDLES = [
  { id: 'left', position: Position.Left },
  { id: 'top', position: Position.Top },
  { id: 'right', position: Position.Right },
  { id: 'bottom', position: Position.Bottom },
] as const

function DatabaseNodeCard({ data, selected, width, height }: NodeProps & { data: ProcessNodeData }) {
  const boxW = typeof width === 'number' ? width : 170
  const boxH = typeof height === 'number' ? height : 56
  const title = data.displayName ?? data.name
  const badgeStep = data.stepBadge ?? 0
  const showStepBadge = data.showStepBadge !== false && badgeStep > 0
  const compact = data.compact === true
  const cell3Col = data.cell3Col === true

  return (
    <div
      className={`database-node${compact ? ' database-node--compact' : ''}${cell3Col ? ' database-node--cell-3col' : ''}${selected ? ' database-node--selected' : ''}`}
      style={{ width: boxW, height: boxH }}
    >
      {showStepBadge ? <NodeStepBadge step={badgeStep} className={compact ? 'process-node__step-badge--compact' : ''} /> : null}
      <svg
        className="database-node__shape"
        viewBox={`0 0 ${boxW} ${boxH}`}
        width={boxW}
        height={boxH}
        aria-hidden
      >
        <path
          className="database-node__body"
          d={`M 1 ${boxH * 0.18} V ${boxH * 0.82} C 1 ${boxH * 0.95}, ${boxW - 1} ${boxH * 0.95}, ${boxW - 1} ${boxH * 0.82} V ${boxH * 0.18}`}
        />
        <ellipse
          className="database-node__cap database-node__cap--top"
          cx={boxW / 2}
          cy={boxH * 0.18}
          rx={boxW / 2 - 1}
          ry={Math.max(6, boxH * 0.14)}
        />
        <path
          className="database-node__cap database-node__cap--bottom"
          d={`M 1 ${boxH * 0.82} C 1 ${boxH * 0.95}, ${boxW - 1} ${boxH * 0.95}, ${boxW - 1} ${boxH * 0.82}`}
        />
      </svg>
      <div className="database-node__content">
        <div className="process-node__name">{title}</div>
        {data.system ? <div className="process-node__subtitle">{data.system}</div> : null}
      </div>
      {SIDE_HANDLES.map(({ id, position }) => (
        <Handle
          key={`target-${id}`}
          type="target"
          position={position}
          id={`target-${id}`}
          className="database-node__handle"
        />
      ))}
      {SIDE_HANDLES.map(({ id, position }) => (
        <Handle
          key={`source-${id}`}
          type="source"
          position={position}
          id={`source-${id}`}
          className="database-node__handle database-node__handle--source"
        />
      ))}
    </div>
  )
}

export default memo(DatabaseNodeCard)
