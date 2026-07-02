import type { EdgeType } from '../types/edgeTypes'
import type { NodeType } from '../types/nodeTypes'
import type { NodeControls, NodeInputs, NodeOutputs, ProcessStatus } from '../types/process'
import type { MasterLayer } from '../types/commonMasters'

export type ProcessDefinitionKind = 'overview-source' | 'detail-source'

export type ProcessFlowKind = 'sequence' | 'condition' | 'branch' | 'loop' | 'reference'

export type ProcessDefinitionNode = {
  id: string
  label: string
  /** Node Master 참조. 색상/시스템/기본 lane 등은 Master에서 해석한다. */
  nodeMasterId?: NodeType
  description?: string
  inputs?: NodeInputs
  outputs?: NodeOutputs
  controls?: NodeControls
  linkedProcessIds?: string[]
}

export type ProcessDefinitionFlow = {
  id: string
  source: string
  target: string
  kind: ProcessFlowKind
  condition?: string
  /** Edge Master 참조. 표현/handle/routing policy는 Master에서 해석한다. */
  edgeMasterId?: EdgeType | string
  processGroupId?: string
}

export type ProcessDefinition = {
  id: string
  name: string
  description?: string
  version?: string
  status?: ProcessStatus
  owner?: string
  source?: string
  kind: ProcessDefinitionKind
  overviewNodeId?: string
  nodes: ProcessDefinitionNode[]
  flows: ProcessDefinitionFlow[]
}

export type DefinitionNodeMasterBinding = {
  nodeId: string
  nodeMasterId?: NodeType
  found: boolean
  label?: string
  defaultSystem?: string
}

export type DefinitionMasterBinding = {
  definitionId: string
  nodeBindings: DefinitionNodeMasterBinding[]
}

export type ProcessGeneratorTarget = 'overview' | 'detail'

export type ProcessGeneratorInput = {
  definition: ProcessDefinition
  masters: MasterLayer
}

export type ProcessGeneratorResult<T> = {
  value: T
  diagnostics: Array<{
    code: string
    severity: 'info' | 'warning' | 'error'
    message: string
    nodeId?: string
    flowId?: string
  }>
}

export interface ProcessGenerator<TOverview, TDetail> {
  id: string
  generateOverview(input: ProcessGeneratorInput): ProcessGeneratorResult<TOverview> | Promise<ProcessGeneratorResult<TOverview>>
  generateDetail(input: ProcessGeneratorInput): ProcessGeneratorResult<TDetail> | Promise<ProcessGeneratorResult<TDetail>>
}
