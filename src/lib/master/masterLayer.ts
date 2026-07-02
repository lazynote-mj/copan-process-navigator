import {
  buildEdgeMarkerColor,
  EDGE_TYPES,
  edgeTypeShowsArrow,
  type EdgeType,
} from '../../types/edgeTypes'
import {
  DEFAULT_LAYOUT_RULES,
  type CommonMasters,
  type EdgeMaster,
  type LayoutRuleMaster,
  type MasterLayer,
  type NodeMaster,
  type ZoneMaster,
} from '../../types/commonMasters'
import {
  getDefaultSystemForNodeType,
  NODE_TYPE_COLORS,
  NODE_TYPE_META,
  NODE_TYPES,
  type NodeType,
} from '../../types/nodeTypes'
import type { Process } from '../../types/process'
import { DETAIL_CELL_MAX_ROWS, OVERVIEW_CELL_MAX_ROWS } from '../layout/overviewCellPlacement'

const EDGE_TYPE_LABELS: Record<EdgeType, string> = {
  normal: '일반',
  system: '시스템',
  api: 'API',
  condition: '조건',
  exception: '예외',
  return: '회귀',
  virtual: '가상',
  reference: '참조',
}

function buildNodeMaster(nodeTypes: readonly NodeType[]): NodeMaster[] {
  return nodeTypes.map((id) => {
    const meta = NODE_TYPE_META[id]
    return {
      id,
      label: meta?.label ?? id,
      description: meta?.description ?? '',
      defaultSystem: getDefaultSystemForNodeType(id),
      color: NODE_TYPE_COLORS[id],
      dashedBorder: meta?.dashedBorder,
    }
  })
}

function buildEdgeMaster(edgeTypes: readonly EdgeType[]): EdgeMaster[] {
  return edgeTypes.map((id) => ({
    id,
    label: EDGE_TYPE_LABELS[id] ?? id,
    color: buildEdgeMarkerColor(id),
    dashed: id === 'condition' || id === 'exception' || id === 'return' || id === 'virtual' || id === 'reference',
    arrow: edgeTypeShowsArrow(id),
  }))
}

function buildZoneMaster(process?: Process): ZoneMaster[] {
  return (process?.zones ?? []).map((zone) => ({
    id: zone.id,
    name: zone.name,
    type: zone.type,
    style: { ...zone.style },
  }))
}

export const DEFAULT_LAYOUT_RULE_MASTER: LayoutRuleMaster[] = [
  {
    id: 'overview',
    label: 'Overview Cell Layout',
    maxCellColumns: DEFAULT_LAYOUT_RULES.maxCellColumns ?? 2,
    maxCellRows: OVERVIEW_CELL_MAX_ROWS,
    positionFromSlot: DEFAULT_LAYOUT_RULES.positionFromSlot ?? true,
    rowAlignment: 'stable-slot',
    columnAlignment: 'lane-center',
    zoneAffectsNodePlacement: false,
  },
  {
    id: 'detail',
    label: 'Process Detail Cell Layout',
    maxCellColumns: DEFAULT_LAYOUT_RULES.maxCellColumns ?? 2,
    maxCellRows: DETAIL_CELL_MAX_ROWS,
    positionFromSlot: DEFAULT_LAYOUT_RULES.positionFromSlot ?? true,
    rowAlignment: 'stable-slot',
    columnAlignment: 'lane-center',
    zoneAffectsNodePlacement: false,
  },
]

export type ResolveMasterLayerOptions = {
  process?: Process
}

export function resolveMasterLayer(
  commonMasters: CommonMasters,
  options: ResolveMasterLayerOptions = {},
): MasterLayer {
  const existing = commonMasters.masterLayer
  const nodeTypes = commonMasters.nodeTypes?.length ? commonMasters.nodeTypes : NODE_TYPES
  const edgeTypes = commonMasters.edgeTypes?.length ? commonMasters.edgeTypes : EDGE_TYPES

  return {
    version: existing?.version ?? 1,
    nodeMaster: existing?.nodeMaster?.length ? existing.nodeMaster : buildNodeMaster(nodeTypes),
    edgeMaster: existing?.edgeMaster?.length ? existing.edgeMaster : buildEdgeMaster(edgeTypes),
    laneMaster: existing?.laneMaster?.length ? existing.laneMaster : commonMasters.lanes,
    phaseMaster: existing?.phaseMaster?.length ? existing.phaseMaster : commonMasters.phases,
    zoneMaster: existing?.zoneMaster?.length ? existing.zoneMaster : buildZoneMaster(options.process),
    layoutRuleMaster: existing?.layoutRuleMaster?.length
      ? existing.layoutRuleMaster
      : DEFAULT_LAYOUT_RULE_MASTER,
  }
}

export function getLayoutRuleMaster(
  masterLayer: MasterLayer,
  scope: LayoutRuleMaster['id'],
): LayoutRuleMaster {
  return (
    masterLayer.layoutRuleMaster.find((rule) => rule.id === scope)
    ?? DEFAULT_LAYOUT_RULE_MASTER.find((rule) => rule.id === scope)
    ?? DEFAULT_LAYOUT_RULE_MASTER[0]
  )
}
