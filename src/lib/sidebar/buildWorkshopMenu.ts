import {
  WORKSHOP_MENU_CONFIG,
  type WorkshopMenuEntry,
  type WorkshopMenuStatus,
} from '../../config/workshopMenuConfig'
import type { DetailProcessGroup } from '../../types/toBeNavigator'

export type WorkshopMenuLeaf = {
  kind: 'leaf'
  navigationId: string
  label: string
  group: DetailProcessGroup
  status: WorkshopMenuStatus
  searchAliases: string[]
}

export type WorkshopMenuBranch = {
  kind: 'branch'
  key: string
  label: string
  leaves: WorkshopMenuLeaf[]
  totalLeaves: number
}

export type WorkshopMenuItem = WorkshopMenuLeaf | WorkshopMenuBranch

export type WorkshopMenuSection = {
  key: string
  label: string
  items: WorkshopMenuItem[]
  totalLeaves: number
}

export type SelectedWorkshopMenuPath = {
  level1Key?: string
  branchKey?: string
  navigationId?: string
}

const LIVE_STATUSES = new Set<WorkshopMenuStatus>(['implemented', 'implemented-alias'])

function isLiveEntry(entry: WorkshopMenuEntry): entry is WorkshopMenuEntry & { processId: string } {
  return LIVE_STATUSES.has(entry.status) && Boolean(entry.processId)
}

function makeLevel1Key(label: string): string {
  return `workshop-level1:${label}`
}

function makeBranchKey(level1: string, level2: string): string {
  return `workshop-level2:${level1}:${level2}`
}

function makeLeaf(entry: WorkshopMenuEntry & { processId: string }, group: DetailProcessGroup): WorkshopMenuLeaf {
  return {
    kind: 'leaf',
    navigationId: entry.navigationId,
    label: entry.level3 ?? entry.navigationLabel,
    group,
    status: entry.status,
    searchAliases: entry.searchAliases ?? [],
  }
}

export function buildWorkshopMenuSections(
  groups: DetailProcessGroup[],
  config: WorkshopMenuEntry[] = WORKSHOP_MENU_CONFIG,
): WorkshopMenuSection[] {
  const groupByProcessId = new Map(groups.map((group) => [group.detailProcessId, group]))
  const sections: WorkshopMenuSection[] = []
  const sectionByLevel1 = new Map<string, WorkshopMenuSection>()
  const branchByKey = new Map<string, WorkshopMenuBranch>()

  for (const entry of config) {
    if (!isLiveEntry(entry)) continue

    const group = groupByProcessId.get(entry.processId)
    if (!group) continue

    const level1Key = makeLevel1Key(entry.level1)
    let section = sectionByLevel1.get(level1Key)
    if (!section) {
      section = {
        key: level1Key,
        label: entry.level1,
        items: [],
        totalLeaves: 0,
      }
      sectionByLevel1.set(level1Key, section)
      sections.push(section)
    }

    const leaf = makeLeaf(entry, group)
    section.totalLeaves += 1

    if (!entry.level3) {
      section.items.push({
        ...leaf,
        label: entry.navigationLabel || entry.level2,
      })
      continue
    }

    const branchKey = makeBranchKey(entry.level1, entry.level2)
    let branch = branchByKey.get(branchKey)
    if (!branch) {
      branch = {
        kind: 'branch',
        key: branchKey,
        label: entry.level2,
        leaves: [],
        totalLeaves: 0,
      }
      branchByKey.set(branchKey, branch)
      section.items.push(branch)
    }
    branch.leaves.push(leaf)
    branch.totalLeaves += 1
  }

  return sections
}

export function menuItemContainsGroup(item: WorkshopMenuItem, groupId: string | null): boolean {
  if (!groupId) return false
  if (item.kind === 'leaf') return item.group.id === groupId
  return item.leaves.some((leaf) => leaf.group.id === groupId)
}

export function sectionContainsGroup(section: WorkshopMenuSection, groupId: string | null): boolean {
  if (!groupId) return false
  return section.items.some((item) => menuItemContainsGroup(item, groupId))
}

export function resolveSelectedWorkshopMenuPath(
  sections: WorkshopMenuSection[],
  selectedGroupId: string | null,
  preferredNavigationId?: string | null,
): SelectedWorkshopMenuPath {
  if (!selectedGroupId) return {}

  for (const section of sections) {
    for (const item of section.items) {
      if (item.kind === 'leaf') {
        if (
          item.group.id === selectedGroupId &&
          (!preferredNavigationId || item.navigationId === preferredNavigationId)
        ) {
          return {
            level1Key: section.key,
            navigationId: item.navigationId,
          }
        }
        continue
      }

      for (const leaf of item.leaves) {
        if (
          leaf.group.id === selectedGroupId &&
          (!preferredNavigationId || leaf.navigationId === preferredNavigationId)
        ) {
          return {
            level1Key: section.key,
            branchKey: item.key,
            navigationId: leaf.navigationId,
          }
        }
      }
    }
  }

  for (const section of sections) {
    for (const item of section.items) {
      if (item.kind === 'leaf' && item.group.id === selectedGroupId) {
        return {
          level1Key: section.key,
          navigationId: item.navigationId,
        }
      }

      if (item.kind === 'branch') {
        const leaf = item.leaves.find((entry) => entry.group.id === selectedGroupId)
        if (leaf) {
          return {
            level1Key: section.key,
            branchKey: item.key,
            navigationId: leaf.navigationId,
          }
        }
      }
    }
  }

  return {}
}
