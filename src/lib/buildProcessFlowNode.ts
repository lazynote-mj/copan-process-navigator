import type { Node as FlowNode } from '@xyflow/react'
import type { Node, Process } from '../types/process'
import { getLaneById, getPhaseLabel } from '../types/process'
import type { ProcessNodeData } from './layout/elkLayout'
import { resolveNodeLocalOrder } from './layout/localOrder'
import { resolveNodePhaseOrder } from './layout/gridLayout'
import { getDecisionSubtitle } from './nodeDisplay'
import {
  formatOverviewNodePrimaryLabel,
  formatOverviewNodeSubtitle,
  resolveOverviewNodeType,
} from './overviewNodeDisplay'
import { resolveNodeVisualClass } from '../types/nodeTypes'
import { isConnectorNode, resolveConnectorSubType } from './layout/connectorLayout'
import type { PlacedNode } from './layout/laneLayout'

type PlacedFlowNode = PlacedNode & { cell3Col?: boolean }

export function buildProcessFlowNode(
  source: Node,
  process: Process,
  placed: PlacedFlowNode,
  compact = false,
  scope: 'overview' | 'detail' = compact ? 'overview' : 'detail',
  autoStepBadge?: number | string,
  showAutoNumber = true,
): FlowNode<ProcessNodeData> {
  const lane = getLaneById(process, source.laneId)
  const isDecision = source.type === 'decision'
  const isInterfaceRule = source.type === 'interface-rule'
  const isConnector = isConnectorNode(source)
  const isDatabase = source.type === 'database'
  const isOverview = scope === 'overview'
  const stepBadge = isOverview ? undefined : autoStepBadge
  const overviewType = isOverview
    ? resolveOverviewNodeType(source)
    : source.overviewType
  const overviewVisualClass = isOverview
    ? resolveNodeVisualClass(source.type, source.system)
    : undefined
  const displayName = isOverview ? formatOverviewNodePrimaryLabel(source) : undefined
  const overviewSubtitle = isOverview ? formatOverviewNodeSubtitle(source, process) : undefined

  return {
    id: placed.id,
    type: isDecision
      ? 'decisionNode'
      : isInterfaceRule
        ? 'interfaceRuleNode'
        : isDatabase
          ? 'databaseNode'
          : isConnector
            ? 'connectorNode'
            : 'processNode',
    position: { x: placed.x, y: placed.y },
    data: {
      nodeId: source.id,
      name: source.name,
      displayName,
      overviewType,
      type: source.type,
      laneId: source.laneId,
      laneName: lane?.name ?? source.laneId,
      phaseId: source.phaseId,
      phaseLabel: getPhaseLabel(process, source.phaseId),
      phaseOrder: resolveNodePhaseOrder(source, process),
      localOrder: resolveNodeLocalOrder(source, process),
      stepBadge,
      system: isOverview ? overviewSubtitle || source.system : source.system,
      decisionSubtitle: isDecision
        ? isOverview
          ? overviewSubtitle || getDecisionSubtitle(source, process)
          : getDecisionSubtitle(source, process)
        : undefined,
      connectorSubType: isConnector ? resolveConnectorSubType(source) : undefined,
      compact: isDecision || isInterfaceRule ? compact : isConnector ? true : placed.cell3Col ? true : compact,
      cell3Col: placed.cell3Col === true,
      overviewVisualClass,
      showStepBadge: !isOverview && showAutoNumber && stepBadge != null && String(stepBadge).trim() !== '',
      layoutWidth: placed.width,
      layoutHeight: placed.height,
      reviewMode: false,
      reviewStatus: source.review?.status ?? 'not-reviewed',
    },
    style: { width: placed.width, height: placed.height },
    zIndex: isInterfaceRule ? 11 : isConnector ? 12 : 10,
    className: [
      isDecision ? 'process-node-flow--decision' : '',
      isInterfaceRule ? 'process-node-flow--interface-rule' : '',
      isDatabase ? 'process-node-flow--database' : '',
      isConnector ? 'process-node-flow--connector' : '',
      placed.cell3Col ? 'process-node-flow--cell-3col' : '',
      !isDecision && !isInterfaceRule && !isDatabase && !isConnector && compact && !placed.cell3Col
        ? 'process-node-flow--compact'
        : '',
    ]
      .filter(Boolean)
      .join(' ') || undefined,
  }
}
