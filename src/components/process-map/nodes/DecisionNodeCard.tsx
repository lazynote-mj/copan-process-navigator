import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { ProcessNodeData } from '../../../lib/layout/elkLayout'
import { NODE_LAYOUT } from '../../../lib/layout/nodeLayoutSizes'
import { resolveDecisionLayoutForSize } from '../../../lib/layout/decisionNodeSpec'
import { getDecisionHandleOffset } from '../../../lib/layout/decisionAnchors'
import './process-node.css'
import './decision-node.css'
import { NodeStepBadge } from './NodeStepBadge'
import { NodeReviewBadge } from './NodeReviewBadge'

function finiteOr(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function finiteStylePoint(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback
}

function DecisionNodeCard({ data, selected, width, height }: NodeProps & { data: ProcessNodeData }) {
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
        transform: 'translate(-50%, -50%)',
      },
    }
  })

  return (
    <div
      className={`decision-node${compact ? ' process-node--compact' : ''}${selected ? ' decision-node--selected' : ''}`}
      style={{ width: boxW, height: boxH }}
    >
      {showStepBadge ? <NodeStepBadge step={badgeStep} /> : null}
      <NodeReviewBadge reviewMode={data.reviewMode} status={data.reviewStatus} />
      <svg
        className="decision-node__diamond"
        viewBox={`0 0 ${layoutSpec.layoutWidth} ${layoutSpec.layoutHeight}`}
        width={boxW}
        height={boxH}
        aria-hidden
      >
        <polygon className="decision-node__polygon" points={layoutSpec.polygonPoints} />
      </svg>
      <div className="decision-node__content">
        <span className="process-node__name" title={data.displayName ?? data.name}>
          {data.displayName ?? data.name}
        </span>
        {(data.decisionSubtitle ?? data.system) && (
          <span className="process-node__subtitle" title={data.decisionSubtitle ?? data.system}>
            {data.decisionSubtitle ?? data.system}
          </span>
        )}
      </div>

      {sides.map(({ id, style }) => (
        <Handle
          key={`target-${id}`}
          type="target"
          position={Position.Top}
          id={`target-${id}`}
          className="decision-node__handle"
          style={style}
        />
      ))}
      {sides.map(({ id, style }) => (
        <Handle
          key={`source-${id}`}
          type="source"
          position={Position.Top}
          id={`source-${id}`}
          className="decision-node__handle decision-node__handle--source"
          style={style}
        />
      ))}
    </div>
  )
}

export default memo(DecisionNodeCard)
