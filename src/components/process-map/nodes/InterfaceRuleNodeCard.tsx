import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { ProcessNodeData } from '../../../lib/layout/elkLayout'
import { NODE_LAYOUT } from '../../../lib/layout/nodeLayoutSizes'
import { resolveDecisionLayoutForSize } from '../../../lib/layout/decisionNodeSpec'
import { getDecisionHandleOffset } from '../../../lib/layout/decisionAnchors'
import './process-node.css'
import './interface-rule-node.css'
import { NodeStepBadge } from './NodeStepBadge'
import { NodeReviewBadge } from './NodeReviewBadge'

function finiteOr(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function finiteStylePoint(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback
}

function InterfaceRuleNodeCard({ data, selected, width, height }: NodeProps & { data: ProcessNodeData }) {
  const boxW = finiteOr(width, finiteOr(data.layoutWidth, NODE_LAYOUT.decision.width))
  const boxH = finiteOr(height, finiteOr(data.layoutHeight, NODE_LAYOUT.decision.height))
  const layoutSpec = resolveDecisionLayoutForSize(boxW, boxH)
  const compact = data.compact === true
  const badgeStep = data.stepBadge
  const showStepBadge = data.showStepBadge !== false && badgeStep != null && String(badgeStep).trim() !== ''

  const sides = (['top', 'left', 'right', 'bottom'] as const).map((id) => {
    const offset = getDecisionHandleOffset(boxW, boxH, id)
    return {
      id,
      style: {
        left: finiteStylePoint(offset.left, boxW / 2),
        top: finiteStylePoint(offset.top, boxH / 2),
      },
    }
  })

  return (
    <div
      className={`interface-rule-node${compact ? ' process-node--compact' : ''}${selected ? ' interface-rule-node--selected' : ''}`}
      style={{ width: boxW, height: boxH }}
    >
      {showStepBadge ? <NodeStepBadge step={badgeStep} /> : null}
      <NodeReviewBadge reviewMode={data.reviewMode} status={data.reviewStatus} />
      <svg
        className="interface-rule-node__diamond"
        viewBox={`0 0 ${layoutSpec.layoutWidth} ${layoutSpec.layoutHeight}`}
        width={boxW}
        height={boxH}
        aria-hidden
      >
        <polygon className="interface-rule-node__polygon" points={layoutSpec.polygonPoints} />
      </svg>
      <div className="interface-rule-node__content">
        <span className="process-node__name" title={data.name}>
          {data.name}
        </span>
        {data.system ? (
          <span className="process-node__subtitle" title={data.system}>
            {data.system}
          </span>
        ) : null}
      </div>

      {sides.map(({ id, style }) => (
        <Handle
          key={`target-${id}`}
          type="target"
          position={id === 'top' ? Position.Top : id === 'bottom' ? Position.Bottom : id === 'left' ? Position.Left : Position.Right}
          id={`target-${id}`}
          className="interface-rule-node__handle"
          style={style}
        />
      ))}
      {sides.map(({ id, style }) => (
        <Handle
          key={`source-${id}`}
          type="source"
          position={id === 'top' ? Position.Top : id === 'bottom' ? Position.Bottom : id === 'left' ? Position.Left : Position.Right}
          id={`source-${id}`}
          className="interface-rule-node__handle interface-rule-node__handle--source"
          style={style}
        />
      ))}
    </div>
  )
}

export default memo(InterfaceRuleNodeCard)
