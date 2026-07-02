import type { ProcessStorageAdapter } from '../data/processStorageAdapter'
import type { RuntimeDiagnostic, WorkspaceRuntime } from '../runtime'
import type { TemplateId, TemplateManager } from '../template'

export type ApplicationEnvironment = 'local'

export type ApplicationStorageMode = 'local-json'

export type ApplicationBootstrap = {
  appId: string
  environment: ApplicationEnvironment
  storageMode: ApplicationStorageMode
  activeTemplateId?: TemplateId
  templateManager: TemplateManager
  workspaceRuntime: WorkspaceRuntime
  diagnostics: RuntimeDiagnostic[]
}

export type CreateApplicationBootstrapOptions = {
  appId?: string
  activeTemplateId?: TemplateId
  templateManager?: TemplateManager
  storageAdapter?: ProcessStorageAdapter
  workspaceRuntime?: WorkspaceRuntime
  diagnostics?: RuntimeDiagnostic[]
}
