import { localJsonProcessStorage } from '../data/processStorageAdapter'
import { createTemplateRuntime } from './templateRuntime'
import type { CreateWorkspaceRuntimeOptions, WorkspaceRuntime } from './types'

export function createWorkspaceRuntime(
  options: CreateWorkspaceRuntimeOptions = {},
): WorkspaceRuntime {
  const templateRuntime =
    options.templateRuntime ??
    createTemplateRuntime({
      storageAdapter: options.storageAdapter ?? localJsonProcessStorage,
    })

  return {
    id: options.id ?? 'local-workspace',
    name: options.name ?? 'Local Workspace',
    status: 'ready',
    activeTemplateId:
      options.activeTemplateId ??
      templateRuntime.activeTemplate?.manifest.templateId,
    templateRuntime,
  }
}
