import { createWorkspaceRuntime } from '../runtime'
import { createTemplateManager, defaultTemplateRegistry } from '../template'
import type { ApplicationBootstrap, CreateApplicationBootstrapOptions } from './types'

export function createApplicationBootstrap(
  options: CreateApplicationBootstrapOptions = {},
): ApplicationBootstrap {
  const templateManager =
    options.templateManager ??
    createTemplateManager({
      templates: defaultTemplateRegistry,
      activeTemplateId: options.activeTemplateId,
    })
  const activeTemplateId =
    options.activeTemplateId ?? templateManager.getActiveTemplateId()
  const activation = activeTemplateId ? templateManager.activate(activeTemplateId) : undefined
  const workspaceRuntime =
    options.workspaceRuntime ??
    createWorkspaceRuntime({
      activeTemplateId: activation?.template.id ?? activeTemplateId,
      templateRuntime: activation?.runtime,
      storageAdapter: options.storageAdapter,
    })

  return {
    appId: options.appId ?? 'universal-process-platform',
    environment: 'local',
    storageMode: 'local-json',
    activeTemplateId: templateManager.getActiveTemplateId() ?? workspaceRuntime.activeTemplateId,
    templateManager,
    workspaceRuntime,
    diagnostics: options.diagnostics ?? [],
  }
}
