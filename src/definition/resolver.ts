import { resolveEdgeType } from '../types/edgeTypes'
import type { Edge, Node, Process } from '../types/process'
import type { MasterLayer } from '../types/commonMasters'
import type {
  DefinitionMasterBinding,
  ProcessDefinition,
  ProcessDefinitionFlow,
  ProcessDefinitionKind,
  ProcessDefinitionNode,
  ProcessFlowKind,
} from './types'

function inferDefinitionKind(process: Process, kind?: ProcessDefinitionKind): ProcessDefinitionKind {
  if (kind) return kind
  return process.overviewNodeId ? 'detail-source' : 'overview-source'
}

function toDefinitionNode(node: Node): ProcessDefinitionNode {
  return {
    id: node.id,
    label: node.name,
    nodeMasterId: node.type,
    description: node.description || undefined,
    inputs: node.inputs.length > 0 ? [...node.inputs] : undefined,
    outputs: node.outputs.length > 0 ? [...node.outputs] : undefined,
    controls: node.controls.length > 0 ? [...node.controls] : undefined,
    linkedProcessIds: node.detailProcessIds?.length ? [...node.detailProcessIds] : undefined,
  }
}

function inferFlowKind(edge: Edge): ProcessFlowKind {
  const type = resolveEdgeType(edge)
  if (type === 'return') return 'loop'
  if (type === 'reference' || type === 'virtual') return 'reference'
  if (edge.condition) return 'condition'
  return 'sequence'
}

function toDefinitionFlow(edge: Edge): ProcessDefinitionFlow {
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    kind: inferFlowKind(edge),
    condition: edge.condition || undefined,
    edgeMasterId: resolveEdgeType(edge),
    processGroupId: edge.processGroupId,
  }
}

export type ProcessDefinitionResolverOptions = {
  kind?: ProcessDefinitionKind
  includeDisplayOnlyFlows?: boolean
}

export function resolveProcessDefinitionFromProcess(
  process: Process,
  options: ProcessDefinitionResolverOptions = {},
): ProcessDefinition {
  const includeDisplayOnlyFlows = options.includeDisplayOnlyFlows ?? false
  const nodes = process.nodes
    .filter((node) => node.type !== 'phase-connector' && node.type !== 'merge')
    .map(toDefinitionNode)
  const nodeIds = new Set(nodes.map((node) => node.id))
  const flows = process.edges
    .filter((edge) => includeDisplayOnlyFlows || !edge.displayOnly)
    .filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target))
    .map(toDefinitionFlow)

  return {
    id: process.id,
    name: process.name,
    description: process.description || undefined,
    version: process.version || undefined,
    status: process.status,
    owner: process.owner || undefined,
    source: process.source,
    kind: inferDefinitionKind(process, options.kind),
    overviewNodeId: process.overviewNodeId,
    nodes,
    flows,
  }
}

export function bindDefinitionToNodeMaster(
  definition: ProcessDefinition,
  masters: MasterLayer,
): DefinitionMasterBinding {
  const nodeMasterById = new Map(masters.nodeMaster.map((master) => [master.id, master]))
  return {
    definitionId: definition.id,
    nodeBindings: definition.nodes.map((node) => {
      const master = node.nodeMasterId ? nodeMasterById.get(node.nodeMasterId) : undefined
      return {
        nodeId: node.id,
        nodeMasterId: node.nodeMasterId,
        found: Boolean(master),
        label: master?.label,
        defaultSystem: master?.defaultSystem,
      }
    }),
  }
}
