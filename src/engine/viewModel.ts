import type {
  NavigatorEdgeView,
  NavigatorNodeView,
  NavigatorViewModel,
  ProcessModel,
  RoutedEdge,
} from './types'
import type { EngineDiagnostic, EngineResult, RenderingEngineInput } from './contracts'

function buildMissingNodeDiagnostic(nodeId: string): EngineDiagnostic {
  return {
    code: 'navigator-view-model.missing-node-definition',
    severity: 'warning',
    message: `Layout node "${nodeId}" has no matching process node definition.`,
    nodeId,
  }
}

function buildMissingEdgeDiagnostic(edgeId: string): EngineDiagnostic {
  return {
    code: 'navigator-view-model.missing-edge-definition',
    severity: 'warning',
    message: `Routed edge "${edgeId}" has no matching process edge definition.`,
    edgeId,
  }
}

function toNodeView(process: ProcessModel, layoutNode: NavigatorNodeView): NavigatorNodeView {
  const definition = process.nodeById.get(layoutNode.nodeId)
  if (!definition) return layoutNode

  return {
    ...layoutNode,
    name: definition.name,
    system: definition.renderHints.system,
    stepBadge: definition.renderHints.stepBadge,
    overviewType: definition.renderHints.overviewType,
  }
}

function toEdgeView(process: ProcessModel, routedEdge: RoutedEdge): NavigatorEdgeView {
  const definition = process.edgeById.get(routedEdge.id)
  if (!definition) return routedEdge

  return {
    ...routedEdge,
    type: routedEdge.type ?? definition.type,
    label: {
      ...routedEdge.label,
      text: routedEdge.label.text || definition.renderHints.label,
      placement: routedEdge.label.placement ?? definition.renderHints.labelPlacement,
    },
    derived: routedEdge.derived ?? definition.renderHints.isDerived,
  }
}

export function composeNavigatorViewModel({
  process,
  layout,
  routing,
}: RenderingEngineInput): EngineResult<NavigatorViewModel> {
  const diagnostics: EngineDiagnostic[] = []

  for (const layoutNode of layout.nodes) {
    if (!process.nodeById.has(layoutNode.nodeId)) {
      diagnostics.push(buildMissingNodeDiagnostic(layoutNode.nodeId))
    }
  }

  for (const routedEdge of routing.edges) {
    if (!process.edgeById.has(routedEdge.id)) {
      diagnostics.push(buildMissingEdgeDiagnostic(routedEdge.id))
    }
  }

  const nodes = layout.nodes.map((layoutNode) =>
    toNodeView(process, {
      ...layoutNode,
      name: '',
    }),
  )
  const edges = routing.edges.map((routedEdge) => toEdgeView(process, routedEdge))

  return {
    value: {
      process: {
        id: process.id,
        name: process.name,
        kind: process.kind,
        version: process.version,
        status: process.status,
      },
      layout,
      routing,
      nodes,
      edges,
      lanes: layout.laneBands,
      zones: layout.zoneBands,
      canvasBounds: layout.canvasBounds,
    },
    diagnostics,
  }
}
