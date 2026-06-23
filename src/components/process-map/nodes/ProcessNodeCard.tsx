import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { ProcessNodeData } from '../../../lib/layout/elkLayout'
import { getNodeTypeLabel, NODE_TYPE_META, resolveNodeVisualClass } from '../../../types/nodeTypes'
import {
  OVERVIEW_NODE_TYPE_META,
  shouldAppendAutoSuffix,
} from '../../../types/overviewNodeTypes'
import type { NodeType } from '../../../types/nodeTypes'
import './process-node.css'
import { NodeStepBadge } from './NodeStepBadge'

const SIDE_HANDLES = [
  { id: 'left', position: Position.Left },
  { id: 'top', position: Position.Top },
  { id: 'right', position: Position.Right },
  { id: 'bottom', position: Position.Bottom },
] as const

function ProcessNodeCard({ data, selected }: NodeProps & { data: ProcessNodeData }) {
  const nodeType = data.type as NodeType
  const visualClass =
    data.overviewVisualClass ?? resolveNodeVisualClass(nodeType, data.system)
  const dashed =
    data.overviewType != null
      ? (OVERVIEW_NODE_TYPE_META[data.overviewType]?.dashedBorder ?? false)
      : (NODE_TYPE_META[nodeType]?.dashedBorder ?? false)
  const compact = data.compact === true
  const cell3Col = data.cell3Col === true
  const title = data.displayName ?? data.name
  const showSubtitle =
    compact &&
    Boolean(data.system?.trim() || data.overviewType) &&
    !shouldAppendAutoSuffix(data.type) &&
    data.overviewType !== 'manual'

  const badgeStep = data.stepBadge ?? 0
  const showStepBadge = data.showStepBadge !== false && badgeStep > 0

  return (
    <div
      className={`process-node process-node--${visualClass}${dashed ? ' process-node--dashed' : ''}${cell3Col ? ' process-node--cell-3col' : compact ? ' process-node--compact' : ''} ${selected ? 'process-node--selected' : ''}`}
    >
      {showStepBadge ? <NodeStepBadge step={badgeStep} /> : null}
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
      {!compact && !data.displayName && (
        <div className="process-node__type">{getNodeTypeLabel(nodeType)}</div>
      )}
      <div className="process-node__name">{title}</div>
      {showSubtitle ? <div className="process-node__subtitle">{data.system}</div> : null}
    </div>
  )
}

export default memo(ProcessNodeCard)
