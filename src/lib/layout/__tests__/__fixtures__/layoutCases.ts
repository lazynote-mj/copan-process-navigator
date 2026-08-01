import type { Node as FlowNode } from '@xyflow/react'
import { toBeNavigator } from '../../../../data/toBeNavigatorRegistry'
import type { LayoutOptions, ProcessNodeData } from '../../elkLayout'
import type { PlacedNode } from '../../laneLayout'
import type { Process } from '../../../../types/process'

export type LayoutCase = {
  /** 스냅샷 키이자 불변식 위반 리포트의 case 이름 */
  name: string
  process: Process
  options: LayoutOptions
}

/** 번들된 registry 전체(overview 1 + detail 25)를 앱과 동일한 옵션으로 배치하는 케이스 */
export const layoutCases: LayoutCase[] = [
  { name: 'overview', process: toBeNavigator.overview, options: { overviewVertical: true } },
  ...toBeNavigator.detailProcesses.map((process) => ({
    name: process.id,
    process,
    options: { detailHorizontal: true } as LayoutOptions,
  })),
]

/**
 * 레이아웃 결과의 FlowNode를 라우터 충돌 판정이 받는 PlacedNode로 되돌린다.
 * 라우터는 layoutWidth/layoutHeight를 기준으로 bbox를 잡으므로 동일하게 맞춘다.
 */
export function toPlacedNodes(nodes: FlowNode<ProcessNodeData>[]): PlacedNode[] {
  return nodes.map((node) => ({
    id: node.id,
    laneId: node.data.laneId ?? '',
    x: node.position.x,
    y: node.position.y,
    width: node.data.layoutWidth ?? node.width ?? 0,
    height: node.data.layoutHeight ?? node.height ?? 0,
  }))
}
