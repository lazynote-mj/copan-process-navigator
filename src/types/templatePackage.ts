import type { CommonMasters, LayoutRules, RouterRules, StyleRules } from './commonMasters'
import type { ProcessInstance } from './processInstance'
import type { DetailProcessGroup, OverviewProcessGroup } from './toBeNavigator'

export type TemplatePackageKind = 'process-template-package'

export type TemplatePackageScope = 'platform-default' | 'client-template' | 'sample'

export type TemplatePackageManifest = {
  kind: TemplatePackageKind
  templateId: string
  displayName: string
  version: string
  scope: TemplatePackageScope
  description?: string
  owner?: string
  source?: string
  localStatePath?: string
}

export type TemplateDisplayPolicies = {
  layoutRules?: LayoutRules
  routerRules?: RouterRules
  styleRules?: StyleRules
}

export type ProcessTemplatePackage = {
  manifest: TemplatePackageManifest
  commonMasters: CommonMasters
  processes: ProcessInstance[]
  overviewProcessGroups?: OverviewProcessGroup[]
  detailProcessGroups?: DetailProcessGroup[]
  displayPolicies?: TemplateDisplayPolicies
}

