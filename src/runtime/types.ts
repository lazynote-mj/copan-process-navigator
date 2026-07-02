import type { CommonMasters } from '../types/commonMasters'
import type { ProcessDefinition } from '../definition'
import type { ProcessStorageAdapter } from '../data/processStorageAdapter'
import type { ProcessTemplatePackage, TemplatePackageManifest } from '../types/templatePackage'
import type { DetailProcessGroup, OverviewProcessGroup } from '../types/toBeNavigator'

export type RuntimeStatus = 'idle' | 'ready' | 'error'

export type RuntimeDiagnosticSeverity = 'info' | 'warning' | 'error'

export type RuntimeDiagnostic = {
  code: string
  severity: RuntimeDiagnosticSeverity
  message: string
  source?: string
}

export type ActiveTemplate = {
  manifest: TemplatePackageManifest
  package?: ProcessTemplatePackage
}

export type TemplateProcessRegistry = {
  overviewProcessGroups?: OverviewProcessGroup[]
  detailProcessGroups?: DetailProcessGroup[]
}

export type TemplateGeneratorPlaceholder = {
  id: string
  status: 'not-configured' | 'configured'
}

export type TemplateDiagnosticsPlaceholder = {
  diagnostics: RuntimeDiagnostic[]
}

export type TemplateRuntime = {
  id: string
  status: RuntimeStatus
  manifest?: TemplatePackageManifest
  activeTemplate?: ActiveTemplate
  storageAdapter: ProcessStorageAdapter
  masters?: CommonMasters
  processDefinitions: ProcessDefinition[]
  processRegistry: TemplateProcessRegistry
  generator: TemplateGeneratorPlaceholder
  diagnostics: TemplateDiagnosticsPlaceholder
}

export type WorkspaceRuntime = {
  id: string
  name: string
  status: RuntimeStatus
  activeTemplateId?: string
  templateRuntime: TemplateRuntime
}

export type CreateTemplateRuntimeOptions = {
  id?: string
  activeTemplate?: ActiveTemplate
  storageAdapter?: ProcessStorageAdapter
  masters?: CommonMasters
  processDefinitions?: ProcessDefinition[]
  processRegistry?: TemplateProcessRegistry
  diagnostics?: RuntimeDiagnostic[]
}

export type CreateWorkspaceRuntimeOptions = {
  id?: string
  name?: string
  activeTemplateId?: string
  templateRuntime?: TemplateRuntime
  storageAdapter?: ProcessStorageAdapter
}
