import type { Node as FlowNode } from '@xyflow/react'
import type { Node, Process } from '../types/process'
import { getLaneById, getPhaseLabel } from '../types/process'
import type { ProcessNodeData } from './layout/elkLayout'
import { resolveNodeLocalOrder } from './layout/localOrder'
import { resolveNodePhaseOrder } from './layout/gridLayout'
import { getDecisionSubtitle } from './nodeDisplay'
import { isConnectorNode, resolveConnectorSubType } from './layout/connectorLayout'
import type { PlacedNode } from './layout/laneLayout'

type PlacedFlowNode = PlacedNode & { cell3Col?: boolean }

export function buildProcessFlowNode(
  source: Node,
  process: Process,
  placed: PlacedFlowNode,
  compact = false,
): FlowNode<ProcessNodeData> {
  const lane = getLaneById(process, source.laneId)
  const isDecision = source.type === 'decision'
  const isInterfaceRule = source.type === 'interface-rule'
  const isConnector = isConnectorNode(source)

  return {
    id: placed.id,
    type: isDecision
      ? 'decisionNode'
      : isInterfaceRule
        ? 'interfaceRuleNode'
        : isConnector
          ? 'connectorNode'
          : 'processNode',
    position: { x: placed.x, y: placed.y },
    data: {
      nodeId: source.id,
      name: source.name,
      type: source.type,
      laneId: source.laneId,
      laneName: lane?.name ?? source.laneId,
      phaseId: source.phaseId,
      phaseLabel: getPhaseLabel(process, source.phaseId),
      phaseOrder: resolveNodePhaseOrder(source, process),
      localOrder: resolveNodeLocalOrder(source, process),
      system: source.system,
      decisionSubtitle: isDecision ? getDecisionSubtitle(source, process) : undefined,
      connectorSubType: isConnector ? resolveConnectorSubType(source) : undefined,
      compact: isInterfaceRule ? true : isDecision ? false : isConnector ? true : placed.cell3Col ? true : compact,
      cell3Col: placed.cell3Col === true,
    },
    style: { width: placed.width, height: placed.height },
    zIndex: isInterfaceRule ? 11 : isConnector ? 12 : 10,
    className: [
      isDecision ? 'process-node-flow--decision' : '',
      isInterfaceRule ? 'process-node-flow--interface-rule' : '',
      isConnector ? 'process-node-flow--connector' : '',
      placed.cell3Col ? 'process-node-flow--cell-3col' : '',
      !isDecision && !isInterfaceRule && !isConnector && compact && !placed.cell3Col
        ? 'process-node-flow--compact'
        : '',
    ]
      .filter(Boolean)
      .join(' ') || undefined,
  }
}
