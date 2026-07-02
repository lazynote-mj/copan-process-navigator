import type { Edge, Node, Process } from '../../types/process'
import type {
  EngineProcessKind,
  ProcessDefinition,
  ProcessEdgeDefinition,
  ProcessModel,
  ProcessNodeDefinition,
} from '../types'

function inferProcessKind(process: Process, kind?: EngineProcessKind): EngineProcessKind {
  if (kind) return kind
  return process.overviewNodeId ? 'detail' : 'overview'
}

function toNodeDefinition(node: Node): ProcessNodeDefinition {
  return {
    id: node.id,
    name: node.name,
    type: node.type,
    description: node.description,
    inputs: [...node.inputs],
    outputs: [...node.outputs],
    controls: [...node.controls],
    detailProcessIds: node.detailProcessIds ? [...node.detailProcessIds] : undefined,
    layoutHints: {
      laneId: node.laneId,
      phaseId: node.phaseId,
      phaseOrder: node.phaseOrder,
      localOrder: node.localOrder,
      cellOrder: node.cellOrder,
      cellSlot: node.cellSlot,
      detailLayout: node.detailLayout ? { ...node.detailLayout } : undefined,
      processZone: node.processZone,
      zoneOrder: node.zoneOrder,
      globalStep: node.globalStep,
      interfaceRuleAnchor: node.interfaceRuleAnchor ? { ...node.interfaceRuleAnchor } : undefined,
      offset:
        node.offsetX !== undefined || node.offsetY !== undefined
          ? { x: node.offsetX ?? 0, y: node.offsetY ?? 0 }
          : undefined,
    },
    renderHints: {
      overviewType: node.overviewType,
      stepBadge: node.stepBadge,
      system: node.system,
      owner: node.owner,
      role: node.role,
      displayLevel: node.displayLevel,
      connectorSubType: node.connectorSubType,
    },
  }
}

function toEdgeDefinition(edge: Edge): ProcessEdgeDefinition {
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    condition: edge.condition,
    type: edge.type,
    processGroupId: edge.processGroupId,
    processId: edge.processId,
    data: edge.data ? { ...edge.data } : undefined,
    routingHints: {
      sourceHandle: edge.sourceHandle,
      targetHandle: edge.targetHandle,
      routing: edge.routing
        ? {
            ...edge.routing,
            points: edge.routing.points ? edge.routing.points.map((point) => ({ ...point })) : undefined,
          }
        : undefined,
      manualRoute: edge.manualRoute,
      bendPoints: edge.bendPoints ? edge.bendPoints.map((point) => ({ ...point })) : undefined,
      points: edge.points ? edge.points.map((point) => ({ ...point })) : undefined,
      priority: edge.priority,
    },
    renderHints: {
      label: edge.label,
      labelPlacement: edge.labelPlacement
        ? {
            offset: edge.labelPlacement.offset ? { ...edge.labelPlacement.offset } : undefined,
            point: edge.labelPlacement.point ? { ...edge.labelPlacement.point } : undefined,
          }
        : undefined,
      displayOnly: edge.displayOnly,
      visibleInOverview: edge.visibleInOverview,
      detailOnly: edge.detailOnly,
      isDerived: edge.isDerived,
    },
  }
}

export function processToDefinition(
  process: Process,
  kind?: EngineProcessKind,
): ProcessDefinition {
  return {
    id: process.id,
    name: process.name,
    description: process.description,
    version: process.version,
    status: process.status,
    lastModified: process.lastModified,
    owner: process.owner,
    kind: inferProcessKind(process, kind),
    source: process.source,
    overviewNodeId: process.overviewNodeId,
    phases: process.phases.map((phase) => ({ ...phase })),
    lanes: process.lanes.map((lane) => ({ ...lane })),
    zones: process.zones ? process.zones.map((zone) => ({ ...zone, style: { ...zone.style } })) : [],
    nodes: process.nodes.map(toNodeDefinition),
    edges: process.edges.map(toEdgeDefinition),
  }
}

export function definitionToModel(definition: ProcessDefinition): ProcessModel {
  const nodeById = new Map(definition.nodes.map((node) => [node.id, node]))
  const edgeById = new Map(definition.edges.map((edge) => [edge.id, edge]))
  const laneById = new Map(definition.lanes.map((lane) => [lane.id, lane]))
  const phaseById = new Map(definition.phases.map((phase) => [phase.id, phase]))
  const zoneById = new Map(definition.zones.map((zone) => [zone.id, zone]))

  return {
    ...definition,
    nodeIds: definition.nodes.map((node) => node.id),
    edgeIds: definition.edges.map((edge) => edge.id),
    laneIds: definition.lanes.map((lane) => lane.id),
    phaseIds: definition.phases.map((phase) => phase.id),
    zoneIds: definition.zones.map((zone) => zone.id),
    nodeById,
    edgeById,
    laneById,
    phaseById,
    zoneById,
  }
}

export function processToModel(process: Process, kind?: EngineProcessKind): ProcessModel {
  return definitionToModel(processToDefinition(process, kind))
}
