import { localJsonProcessStorage } from '../data/processStorageAdapter'
import type { CreateTemplateRuntimeOptions, TemplateRuntime } from './types'

export function createTemplateRuntime(
  options: CreateTemplateRuntimeOptions = {},
): TemplateRuntime {
  const activeTemplate = options.activeTemplate

  return {
    id: options.id ?? activeTemplate?.manifest.templateId ?? 'template-runtime',
    status: 'ready',
    manifest: activeTemplate?.manifest,
    activeTemplate,
    storageAdapter: options.storageAdapter ?? localJsonProcessStorage,
    masters: options.masters ?? activeTemplate?.package?.commonMasters,
    processDefinitions: options.processDefinitions ?? [],
    processRegistry: options.processRegistry ?? {
      overviewProcessGroups: activeTemplate?.package?.overviewProcessGroups,
      detailProcessGroups: activeTemplate?.package?.detailProcessGroups,
    },
    generator: {
      id: 'generator-placeholder',
      status: 'not-configured',
    },
    diagnostics: {
      diagnostics: options.diagnostics ?? [],
    },
  }
}

