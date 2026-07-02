import type { EdgeHandleId, ProcessStatus } from '../../types/process'
import type {
  EdgeLabelView,
  EngineOrientation,
  EnginePoint,
  LayoutLaneBand,
  LayoutModel,
  LayoutNode,
  LayoutZoneBand,
  NavigatorEdgeView,
  NavigatorNodeView,
  NavigatorViewModel,
  ProcessModel,
  RoutedEdge,
} from '../types'

type LegacyNodeData = {
  nodeId: string
  name: string
  type: LayoutNode['type']
  laneId: string
  phaseId: string
  system?: string
  stepBadge?: number
  overviewType?: NavigatorNodeView['overviewType']
  layoutWidth?: number
  layoutHeight?: number
}

type LegacyFlowNode = {
  id: string
  position: EnginePoint
  data: LegacyNodeData
  width?: number
  height?: number
  measured?: Partial<{ width: number; height: number }>
  selected?: boolean
}

type LegacyEdgeData = {
  edgeType?: string
  pathPoints?: EnginePoint[]
  bendPoints?: EnginePoint[]
  sourceHandle?: EdgeHandleId
  targetHandle?: EdgeHandleId
  routeLabelPoint?: EnginePoint
  labelPoint?: EnginePoint
  labelRect?: { x: number; y: number; width: number; height: number }
  labelPlacement?: EdgeLabelView['placement']
  labelHidden?: boolean
  broken?: boolean
  routeIssue?: string
  brokenReason?: string
  derived?: boolean
  readOnly?: boolean
  groupDimmed?: boolean
  groupHighlighted?: boolean
}

type LegacyFlowEdge = {
  id: string
  source: string
  target: string
  label?: unknown
  data?: LegacyEdgeData
  sourceHandle?: string | null
  targetHandle?: string | null
  selected?: boolean
}

type LegacyLaneBand = {
  laneId: string
  laneName: string
  ownerDepartment: string
  x: number
  y: number
  width: number
  height: number
  contentLeft: number
  contentTop: number
  contentRight: number
  contentBottom: number
  inactive?: boolean
}

type LegacyZoneBand = {
  zoneId: string
  label: string
  y: number
  height: number
  bottom: number
}

export type LegacyLayoutResultLike = {
  nodes: LegacyFlowNode[]
  edges: LegacyFlowEdge[]
  laneBands: LegacyLaneBand[]
  canvasBounds: {
    width: number
    height: number
    topPadding: number
    bottomPadding: number
  }
  layoutOrientation?: EngineOrientation
  zoneBands?: LegacyZoneBand[]
}

function toHandleId(handle?: string | null): EdgeHandleId | undefined {
  if (handle === 'top' || handle === 'right' || handle === 'bottom' || handle === 'left') {
    return handle
  }
  return undefined
}

function toLaneBand(band: LegacyLaneBand): LayoutLaneBand {
  return {
    laneId: band.laneId,
    laneName: band.laneName,
    ownerDepartment: band.ownerDepartment,
    x: band.x,
    y: band.y,
    width: band.width,
    height: band.height,
    contentRect: {
      x: band.contentLeft,
      y: band.contentTop,
      width: band.contentRight - band.contentLeft,
      height: band.contentBottom - band.contentTop,
    },
    inactive: band.inactive,
  }
}

function toZoneBand(band: LegacyZoneBand, canvasWidth: number): LayoutZoneBand {
  return {
    zoneId: band.zoneId,
    label: band.label,
    x: 0,
    y: band.y,
    width: canvasWidth,
    height: band.height,
    bottom: band.bottom,
  }
}

function toLayoutNode(node: LegacyFlowNode): LayoutNode {
  return {
    id: node.id,
    nodeId: node.data.nodeId,
    laneId: node.data.laneId,
    phaseId: node.data.phaseId,
    type: node.data.type,
    rect: {
      x: node.position.x,
      y: node.position.y,
      width: node.width ?? node.measured?.width ?? node.data.layoutWidth ?? 0,
      height: node.height ?? node.measured?.height ?? node.data.layoutHeight ?? 0,
    },
  }
}

function toEdgeLabel(edge: LegacyFlowEdge): EdgeLabelView {
  const labelText =
    typeof edge.label === 'string'
      ? edge.label
      : edge.label === null || edge.label === undefined
        ? ''
        : String(edge.label)

  return {
    text: labelText,
    point: edge.data?.labelPoint ?? edge.data?.routeLabelPoint,
    rect: edge.data?.labelRect,
    placement: edge.data?.labelPlacement,
    hidden: edge.data?.labelHidden,
  }
}

function toRoutedEdge(edge: LegacyFlowEdge): RoutedEdge {
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: edge.data?.edgeType,
    sourceHandle: edge.data?.sourceHandle ?? toHandleId(edge.sourceHandle),
    targetHandle: edge.data?.targetHandle ?? toHandleId(edge.targetHandle),
    pathPoints: edge.data?.pathPoints ? edge.data.pathPoints.map((point) => ({ ...point })) : [],
    bendPoints: edge.data?.bendPoints ? edge.data.bendPoints.map((point) => ({ ...point })) : [],
    label: toEdgeLabel(edge),
    status: edge.data?.broken ? 'error' : 'ok',
    issue: edge.data?.routeIssue ?? edge.data?.brokenReason,
    derived: edge.data?.derived,
    readOnly: edge.data?.readOnly,
  }
}

function toNavigatorNode(node: LegacyFlowNode): NavigatorNodeView {
  const layoutNode = toLayoutNode(node)

  return {
    ...layoutNode,
    name: node.data.name,
    system: node.data.system,
    stepBadge: node.data.stepBadge,
    overviewType: node.data.overviewType,
    selected: node.selected,
  }
}

function toNavigatorEdge(edge: LegacyFlowEdge): NavigatorEdgeView {
  const routed = toRoutedEdge(edge)

  return {
    ...routed,
    selected: edge.selected,
    dimmed: edge.data?.groupDimmed,
    highlighted: edge.data?.groupHighlighted,
  }
}

export function legacyLayoutToNavigatorViewModel(
  model: Pick<ProcessModel, 'id' | 'name' | 'kind' | 'version' | 'status'>,
  layoutResult: LegacyLayoutResultLike,
): NavigatorViewModel {
  const laneBands = layoutResult.laneBands.map(toLaneBand)
  const zoneBands = (layoutResult.zoneBands ?? []).map((zone) =>
    toZoneBand(zone, layoutResult.canvasBounds.width),
  )
  const nodes = layoutResult.nodes.map(toNavigatorNode)
  const edges = layoutResult.edges.map(toNavigatorEdge)
  const layout: LayoutModel = {
    processId: model.id,
    orientation: layoutResult.layoutOrientation,
    canvasBounds: {
      x: 0,
      y: 0,
      width: layoutResult.canvasBounds.width,
      height: layoutResult.canvasBounds.height,
      topPadding: layoutResult.canvasBounds.topPadding,
      bottomPadding: layoutResult.canvasBounds.bottomPadding,
    },
    nodes,
    laneBands,
    zoneBands,
  }
  const routing = {
    processId: model.id,
    edges,
  }
  const process: NavigatorViewModel['process'] = {
    id: model.id,
    name: model.name,
    kind: model.kind,
    version: model.version,
    status: model.status as ProcessStatus,
  }

  return {
    process,
    layout,
    routing,
    nodes,
    edges,
    lanes: laneBands,
    zones: zoneBands,
    canvasBounds: layout.canvasBounds,
  }
}
