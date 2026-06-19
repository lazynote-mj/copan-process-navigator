import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { ProcessNodeData } from '../../../lib/layout/elkLayout'
import { NODE_LAYOUT } from '../../../lib/layout/nodeLayoutSizes'
import { DECISION_POLYGON_POINTS, isLongDecisionTitle } from '../../../lib/layout/decisionNodeLayout'
import { getDecisionHandleOffset } from '../../../lib/layout/decisionAnchors'
import './decision-node.css'

function DecisionNodeCard({ data, selected, width, height }: NodeProps & { data: ProcessNodeData }) {
  const boxW = typeof width === 'number' ? width : NODE_LAYOUT.decision.width
  const boxH = typeof height === 'number' ? height : NODE_LAYOUT.decision.height

  const sides = (['top', 'left', 'right', 'bottom'] as const).map((id) => {
    const offset = getDecisionHandleOffset(boxW, boxH, id)
    return { id, style: { left: offset.left, top: offset.top } }
  })

  return (
    <div
      className={`decision-node${selected ? ' decision-node--selected' : ''}${isLongDecisionTitle(data.name) ? ' decision-node--long' : ''}`}
      style={{ width: boxW, height: boxH }}
    >
      <svg
        className="decision-node__diamond"
        viewBox="0 0 120 76"
        width={boxW}
        height={boxH}
        aria-hidden
      >
        <polygon className="decision-node__polygon" points={DECISION_POLYGON_POINTS} />
      </svg>
      <div className="decision-node__content">
        <span className="decision-node__label">판단</span>
        <span className="decision-node__name" title={data.name}>
          {data.name}
        </span>
        {(data.decisionSubtitle ?? data.system) && (
          <span className="decision-node__meta" title={data.decisionSubtitle ?? data.system}>
            {data.decisionSubtitle ?? data.system}
          </span>
        )}
      </div>

      {sides.map(({ id, style }) => (
        <Handle
          key={`target-${id}`}
          type="target"
          position={id === 'top' ? Position.Top : id === 'bottom' ? Position.Bottom : id === 'left' ? Position.Left : Position.Right}
          id={`target-${id}`}
          className="decision-node__handle"
          style={style}
        />
      ))}
      {sides.map(({ id, style }) => (
        <Handle
          key={`source-${id}`}
          type="source"
          position={id === 'top' ? Position.Top : id === 'bottom' ? Position.Bottom : id === 'left' ? Position.Left : Position.Right}
          id={`source-${id}`}
          className="decision-node__handle decision-node__handle--source"
          style={style}
        />
      ))}
    </div>
  )
}

export default memo(DecisionNodeCard)
