import { copanTemplateManifest, COPAN_TEMPLATE_ID } from '../data/copanTemplateManifest'
import type { TemplateDefinition } from './types'

export const copanTemplateDefinition: TemplateDefinition = {
  id: COPAN_TEMPLATE_ID,
  manifest: copanTemplateManifest,
}

export const defaultTemplateRegistry: TemplateDefinition[] = [
  copanTemplateDefinition,
]

