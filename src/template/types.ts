import type { ProcessStorageAdapter } from '../data/processStorageAdapter'
import type { ActiveTemplate, TemplateRuntime } from '../runtime'
import type { ProcessTemplatePackage, TemplatePackageManifest } from '../types/templatePackage'

export type TemplateId = string

export type TemplateDefinition = {
  id: TemplateId
  manifest: TemplatePackageManifest
  package?: ProcessTemplatePackage
  storageAdapter?: ProcessStorageAdapter
}

export type TemplateActivationResult = {
  template: TemplateDefinition
  activeTemplate: ActiveTemplate
  runtime: TemplateRuntime
}

export type TemplateManagerPlaceholderResult = {
  ok: false
  reason: 'not-implemented'
}

export type TemplateManager = {
  register: (template: TemplateDefinition) => TemplateDefinition
  get: (templateId: TemplateId) => TemplateDefinition | undefined
  list: () => TemplateDefinition[]
  activate: (templateId: TemplateId) => TemplateActivationResult | undefined
  getActiveTemplateId: () => TemplateId | undefined
  getActiveTemplate: () => TemplateDefinition | undefined
  createRuntime: (templateId?: TemplateId) => TemplateRuntime | undefined
  cloneTemplate: () => TemplateManagerPlaceholderResult
  importTemplate: () => TemplateManagerPlaceholderResult
  exportTemplate: () => TemplateManagerPlaceholderResult
  deleteTemplate: () => TemplateManagerPlaceholderResult
  updateTemplate: () => TemplateManagerPlaceholderResult
}

export type CreateTemplateManagerOptions = {
  templates?: TemplateDefinition[]
  activeTemplateId?: TemplateId
}

