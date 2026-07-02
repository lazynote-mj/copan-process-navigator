import { createTemplateRuntime } from '../runtime'
import type {
  CreateTemplateManagerOptions,
  TemplateDefinition,
  TemplateId,
  TemplateManager,
  TemplateManagerPlaceholderResult,
} from './types'

const notImplemented = (): TemplateManagerPlaceholderResult => ({
  ok: false,
  reason: 'not-implemented',
})

export function createTemplateManager(
  options: CreateTemplateManagerOptions = {},
): TemplateManager {
  const templates = new Map<TemplateId, TemplateDefinition>()
  let activeTemplateId = options.activeTemplateId

  for (const template of options.templates ?? []) {
    templates.set(template.id, template)
  }

  const createRuntime = (templateId = activeTemplateId) => {
    if (!templateId) return undefined
    const template = templates.get(templateId)
    if (!template) return undefined

    return createTemplateRuntime({
      activeTemplate: {
        manifest: template.manifest,
        package: template.package,
      },
      storageAdapter: template.storageAdapter,
    })
  }

  return {
    register(template) {
      templates.set(template.id, template)
      return template
    },
    get(templateId) {
      return templates.get(templateId)
    },
    list() {
      return Array.from(templates.values())
    },
    activate(templateId) {
      const template = templates.get(templateId)
      if (!template) return undefined
      activeTemplateId = templateId
      const runtime = createRuntime(templateId)
      if (!runtime) return undefined
      return {
        template,
        activeTemplate: {
          manifest: template.manifest,
          package: template.package,
        },
        runtime,
      }
    },
    getActiveTemplateId() {
      return activeTemplateId
    },
    getActiveTemplate() {
      return activeTemplateId ? templates.get(activeTemplateId) : undefined
    },
    createRuntime,
    cloneTemplate: notImplemented,
    importTemplate: notImplemented,
    exportTemplate: notImplemented,
    deleteTemplate: notImplemented,
    updateTemplate: notImplemented,
  }
}

