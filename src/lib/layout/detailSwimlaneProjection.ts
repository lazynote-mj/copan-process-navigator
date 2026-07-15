import type { Lane, Process } from '../../types/process'

export const DEFAULT_DETAIL_LANE_IDS = ['business', 'procurement', 'logistics', 'sales', 'finance'] as const
export const GENERAL_PURCHASE_LANE_IDS = ['business', 'procurement', 'finance'] as const

export type CanonicalDetailLaneId = (typeof DEFAULT_DETAIL_LANE_IDS)[number]

export const GENERAL_PURCHASE_PROCESS_IDS = new Set([
  '구매-요청-매입전표-생성-인사총무',
  '구매-요청-매입-전표-생성-it-s-w',
])

const CANONICAL_LANE_LABELS: Record<CanonicalDetailLaneId, string> = {
  business: '사업',
  procurement: '구매',
  logistics: '물류센터',
  sales: '매장/POS',
  finance: '재무',
}

const LEGACY_LANE_ALIASES: Record<string, CanonicalDetailLaneId> = {
  partnership: 'procurement',
  'warehouse-easyadmin': 'logistics',
  'retail-easychain': 'sales',
}

export function canonicalizeDetailLaneId(laneId: string): string {
  return LEGACY_LANE_ALIASES[laneId] ?? laneId
}

function isCanonicalDetailLaneId(laneId: string): laneId is CanonicalDetailLaneId {
  return DEFAULT_DETAIL_LANE_IDS.includes(laneId as CanonicalDetailLaneId)
}

function buildLane(laneId: CanonicalDetailLaneId, sourceLanes: Lane[]): Lane {
  const source = sourceLanes.find((lane) => lane.id === laneId)
  return {
    ...(source ?? { id: laneId, ownerDepartment: '' }),
    id: laneId,
    name: CANONICAL_LANE_LABELS[laneId],
    order: DEFAULT_DETAIL_LANE_IDS.indexOf(laneId) + 1,
  }
}

function resolvePolicyLaneIds(process: Process): CanonicalDetailLaneId[] {
  return GENERAL_PURCHASE_PROCESS_IDS.has(process.id)
    ? [...GENERAL_PURCHASE_LANE_IDS]
    : [...DEFAULT_DETAIL_LANE_IDS]
}

export function buildVisibleDetailLanes(process: Process): Lane[] {
  const visible = new Set<CanonicalDetailLaneId>(resolvePolicyLaneIds(process))

  for (const node of process.nodes) {
    const canonicalId = canonicalizeDetailLaneId(node.laneId)
    if (isCanonicalDetailLaneId(canonicalId)) {
      visible.add(canonicalId)
    }
  }

  return DEFAULT_DETAIL_LANE_IDS
    .filter((laneId) => visible.has(laneId))
    .map((laneId) => buildLane(laneId, process.lanes))
}

export function projectDetailSwimlanes(process: Process): Process {
  return {
    ...process,
    lanes: buildVisibleDetailLanes(process),
    nodes: process.nodes.map((node) => {
      const projectedNode = {
        ...node,
        laneId: canonicalizeDetailLaneId(node.laneId),
      }

      if (!node.interfaceRuleAnchor) {
        return projectedNode
      }

      return {
        ...projectedNode,
        interfaceRuleAnchor: {
          fromLaneId: canonicalizeDetailLaneId(node.interfaceRuleAnchor.fromLaneId),
          toLaneId: canonicalizeDetailLaneId(node.interfaceRuleAnchor.toLaneId),
        },
      }
    }),
    zones: process.zones?.map((zone) => ({
      ...zone,
      laneIds: [...new Set(zone.laneIds.map(canonicalizeDetailLaneId))],
    })),
  }
}
