import type {
  EngineOrientation,
  EnginePoint,
  EngineRect,
  LayoutModel,
  NavigatorViewModel,
  ProcessModel,
  RoutingModel,
} from './types'

export type EngineDiagnosticSeverity = 'info' | 'warning' | 'error'

export type EngineDiagnostic = {
  code: string
  severity: EngineDiagnosticSeverity
  message: string
  nodeId?: string
  edgeId?: string
  laneId?: string
  phaseId?: string
}

export type EngineResult<T> = {
  value: T
  diagnostics: EngineDiagnostic[]
}

export type EngineMode = 'preview' | 'persisted'

export type EngineRunContext = {
  mode: EngineMode
  activeProcessGroupId?: string
  selectedNodeIds?: string[]
  selectedEdgeIds?: string[]
}

export type LayoutStrategy = 'auto' | 'respect-hints' | 'manual-overrides'

export type LayoutEngineOptions = {
  orientation?: EngineOrientation
  strategy?: LayoutStrategy
  viewport?: EngineRect
  snapToGrid?: boolean
  gridSize?: EnginePoint
}

export type LayoutEngineInput = {
  process: ProcessModel
  options?: LayoutEngineOptions
  context?: EngineRunContext
}

export type LayoutEngine = {
  id: string
  layout(input: LayoutEngineInput): EngineResult<LayoutModel> | Promise<EngineResult<LayoutModel>>
}

export type RoutingStrategy = 'auto' | 'respect-handles' | 'manual-overrides'

export type RoutingEngineOptions = {
  strategy?: RoutingStrategy
  avoidNodes?: boolean
  avoidZones?: boolean
  preserveManualRoutes?: boolean
  preferStraightSegments?: boolean
}

export type RoutingEngineInput = {
  process: ProcessModel
  layout: LayoutModel
  options?: RoutingEngineOptions
  context?: EngineRunContext
}

export type RoutingEngine = {
  id: string
  route(input: RoutingEngineInput): EngineResult<RoutingModel> | Promise<EngineResult<RoutingModel>>
}

export type RenderingEngineInput = {
  process: ProcessModel
  layout: LayoutModel
  routing: RoutingModel
  context?: EngineRunContext
}

export type RenderingEngine = {
  id: string
  render(
    input: RenderingEngineInput,
  ): EngineResult<NavigatorViewModel> | Promise<EngineResult<NavigatorViewModel>>
}

export type NavigatorEngineInput = {
  process: ProcessModel
  layoutOptions?: LayoutEngineOptions
  routingOptions?: RoutingEngineOptions
  context?: EngineRunContext
}

export type NavigatorEngine = {
  id: string
  layoutEngine: LayoutEngine
  routingEngine: RoutingEngine
  renderingEngine: RenderingEngine
  build(
    input: NavigatorEngineInput,
  ): EngineResult<NavigatorViewModel> | Promise<EngineResult<NavigatorViewModel>>
}
