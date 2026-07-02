import type { EdgeType } from '../types/edgeTypes'
import type { NodeType } from '../types/nodeTypes'
import type {
  EdgeData,
  EdgeHandleId,
  EdgeLabelPlacement,
  EdgeRoutingConfig,
  EdgeRoutingPoint,
  Lane,
  NodeControls,
  NodeInputs,
  NodeOutputs,
  Phase,
  ProcessStatus,
  ProcessZone,
  ProcessZoneId,
} from '../types/process'
import type { OverviewNodeType } from '../types/overviewNodeTypes'

export type EngineProcessKind = 'overview' | 'detail'
export type EngineOrientation = 'horizontal' | 'vertical'

export type EnginePoint = {
  x: number
  y: number
}

export type EngineSize = {
  width: number
  height: number
}

export type EngineRect = EnginePoint & EngineSize

export type ProcessNodeLayoutHints = {
  laneId: string
  phaseId: string
  phaseOrder?: number
  localOrder?: number
  cellOrder?: number
  cellSlot?: number
  detailLayout?: {
    column?: number
    row?: number
  }
  processZone?: ProcessZoneId
  zoneOrder?: number
  globalStep?: number
  interfaceRuleAnchor?: {
    fromLaneId: string
    toLaneId: string
  }
  offset?: EnginePoint
}

export type ProcessNodeRenderHints = {
  overviewType?: OverviewNodeType
  stepBadge?: number
  system: string
  owner: string
  role?: string
  displayLevel?: 'business' | 'system'
  connectorSubType?: string
}

export type ProcessNodeDefinition = {
  id: string
  name: string
  type: NodeType
  description: string
  inputs: NodeInputs
  outputs: NodeOutputs
  controls: NodeControls
  detailProcessIds?: string[]
  layoutHints: ProcessNodeLayoutHints
  renderHints: ProcessNodeRenderHints
}

export type ProcessEdgeRoutingHints = {
  sourceHandle?: EdgeHandleId
  targetHandle?: EdgeHandleId
  routing?: EdgeRoutingConfig
  manualRoute?: boolean
  bendPoints?: EdgeRoutingPoint[]
  points?: EdgeRoutingPoint[]
  priority?: number
}

export type ProcessEdgeRenderHints = {
  label: string
  labelPlacement?: EdgeLabelPlacement
  displayOnly?: boolean
  visibleInOverview?: boolean
  detailOnly?: boolean
  isDerived?: boolean
}

export type ProcessEdgeDefinition = {
  id: string
  source: string
  target: string
  condition: string
  type?: EdgeType | string
  processGroupId?: string
  processId?: string
  data?: EdgeData
  routingHints: ProcessEdgeRoutingHints
  renderHints: ProcessEdgeRenderHints
}

export type ProcessDefinition = {
  id: string
  name: string
  description: string
  version: string
  status: ProcessStatus
  lastModified: string
  owner: string
  kind: EngineProcessKind
  source?: string
  overviewNodeId?: string
  phases: Phase[]
  lanes: Lane[]
  zones: ProcessZone[]
  nodes: ProcessNodeDefinition[]
  edges: ProcessEdgeDefinition[]
}

export type ProcessModel = ProcessDefinition & {
  nodeIds: string[]
  edgeIds: string[]
  laneIds: string[]
  phaseIds: string[]
  zoneIds: string[]
  nodeById: ReadonlyMap<string, ProcessNodeDefinition>
  edgeById: ReadonlyMap<string, ProcessEdgeDefinition>
  laneById: ReadonlyMap<string, Lane>
  phaseById: ReadonlyMap<string, Phase>
  zoneById: ReadonlyMap<string, ProcessZone>
}

export type LayoutNode = {
  id: string
  nodeId: string
  rect: EngineRect
  laneId: string
  phaseId: string
  type: NodeType
}

export type LayoutLaneBand = EngineRect & {
  laneId: string
  laneName: string
  ownerDepartment: string
  contentRect: EngineRect
  inactive?: boolean
}

export type LayoutZoneBand = EngineRect & {
  zoneId: string
  label: string
  bottom: number
}

export type LayoutModel = {
  processId: string
  orientation?: EngineOrientation
  canvasBounds: EngineRect & {
    topPadding: number
    bottomPadding: number
  }
  nodes: LayoutNode[]
  laneBands: LayoutLaneBand[]
  zoneBands: LayoutZoneBand[]
}

export type EdgeLabelView = {
  text: string
  point?: EnginePoint
  rect?: EngineRect
  placement?: EdgeLabelPlacement
  hidden?: boolean
}

export type RoutedEdge = {
  id: string
  source: string
  target: string
  type?: EdgeType | string
  sourceHandle?: EdgeHandleId
  targetHandle?: EdgeHandleId
  pathPoints: EnginePoint[]
  bendPoints: EnginePoint[]
  label: EdgeLabelView
  status?: 'ok' | 'warning' | 'error'
  issue?: string
  derived?: boolean
  readOnly?: boolean
}

export type RoutingModel = {
  processId: string
  edges: RoutedEdge[]
}

export type NavigatorNodeView = LayoutNode & {
  name: string
  system?: string
  stepBadge?: number
  overviewType?: OverviewNodeType
  selected?: boolean
  dimmed?: boolean
  highlighted?: boolean
}

export type NavigatorEdgeView = RoutedEdge & {
  selected?: boolean
  dimmed?: boolean
  highlighted?: boolean
}

export type NavigatorViewModel = {
  process: {
    id: string
    name: string
    kind: EngineProcessKind
    version: string
    status: ProcessStatus
  }
  layout: LayoutModel
  routing: RoutingModel
  nodes: NavigatorNodeView[]
  edges: NavigatorEdgeView[]
  lanes: LayoutLaneBand[]
  zones: LayoutZoneBand[]
  canvasBounds: LayoutModel['canvasBounds']
}
