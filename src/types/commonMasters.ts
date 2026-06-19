import type { EdgeType } from './edgeTypes'
import type { Lane, Phase } from './process'
import type { NodeType } from './nodeTypes'

/** Layout engine 공통 규칙 */
export type LayoutRules = {
  maxCellColumns?: number
  cellSlotMax?: number
  /** lane+phase+cellSlot 기반 배치 — node x/y 직접 입력 금지 */
  positionFromSlot?: boolean
}

/** Edge router 공통 규칙 */
export type RouterRules = {
  edgeNodeMargin?: number
  edgeEdgeGap?: number
  outerDetourLast?: boolean
}

/** 표시/색상 공통 규칙 */
export type StyleRules = {
  /** 업무 보기에서 숨길 node type */
  hiddenInBusinessView?: NodeType[]
  /** 업무 보기에서 숨길 edge type */
  hiddenEdgeTypesInBusinessView?: EdgeType[]
}

export type HandleRules = {
  /** auto mode 기본 handle 쌍 */
  defaultSourceHandle?: 'top' | 'right' | 'bottom' | 'left'
  defaultTargetHandle?: 'top' | 'right' | 'bottom' | 'left'
}

export type ViewModeConfig = {
  id: 'business' | 'system'
  label: string
}

/** Overview + 모든 Detail이 공유하는 마스터 설정 */
export type CommonMasters = {
  lanes: Lane[]
  phases: Phase[]
  nodeTypes?: NodeType[]
  edgeTypes?: EdgeType[]
  handleRules?: HandleRules
  layoutRules?: LayoutRules
  routerRules?: RouterRules
  styleRules?: StyleRules
  viewModes?: ViewModeConfig[]
}

export const DEFAULT_LAYOUT_RULES: LayoutRules = {
  maxCellColumns: 2,
  cellSlotMax: 10,
  positionFromSlot: true,
}

export const DEFAULT_ROUTER_RULES: RouterRules = {
  edgeNodeMargin: 16,
  edgeEdgeGap: 8,
  outerDetourLast: true,
}

export const DEFAULT_STYLE_RULES: StyleRules = {
  hiddenInBusinessView: ['interface', 'interface-rule', 'api'],
}

export const DEFAULT_VIEW_MODES: ViewModeConfig[] = [
  { id: 'business', label: '업무' },
  { id: 'system', label: '시스템' },
]

export function createDefaultCommonMasters(lanes: Lane[], phases: Phase[]): CommonMasters {
  return {
    lanes,
    phases,
    layoutRules: { ...DEFAULT_LAYOUT_RULES },
    routerRules: { ...DEFAULT_ROUTER_RULES },
    styleRules: { ...DEFAULT_STYLE_RULES },
    handleRules: {
      defaultSourceHandle: 'bottom',
      defaultTargetHandle: 'top',
    },
    viewModes: [...DEFAULT_VIEW_MODES],
  }
}
