import type { Process } from '../../types/process'

function laneLayoutPart(process: Process): string {
  return [...process.lanes]
    .sort((a, b) => a.order - b.order)
    .map((lane) => `${lane.id}:${lane.order}`)
    .join('|')
}

function nodeLayoutPart(process: Process): string {
  return process.nodes
    .map(
      (node) =>
        `${node.id}:${node.laneId}:${node.type}:${node.processZone ?? ''}:${node.cellOrder ?? ''}:${node.cellSlot ?? ''}:${node.detailLayout?.column ?? ''}:${node.detailLayout?.row ?? ''}:${node.localOrder ?? ''}:${node.zoneOrder ?? ''}:${node.offsetX ?? 0}:${node.offsetY ?? 0}`,
    )
    .join('|')
}

function edgeRoutingPart(process: Process): string {
  return [...process.edges]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((edge) => {
      const routing = edge.routing
      const bendKey = routing?.points?.map((p) => `${p.x},${p.y}`).join(';') ?? ''
      return [
        edge.id,
        edge.source,
        edge.target,
        edge.sourceHandle ?? '',
        edge.targetHandle ?? '',
        edge.type ?? '',
        routing?.mode ?? 'auto',
        routing?.handleAuto === true ? '1' : '0',
        routing?.handlesLocked === true ? '1' : '0',
        bendKey,
      ].join(':')
    })
    .join('|')
}

/** 노드·lane 배치에 영향 — edge topology 제외 */
export function getProcessNodeLayoutKey(process: Process): string {
  return `${process.id}::${laneLayoutPart(process)}::${nodeLayoutPart(process)}`
}

/** edge 경로 재계산에만 영향 — 노드 x/y·lane·zone 배치 제외 */
export function getProcessEdgeRoutingKey(process: Process): string {
  return `${process.id}::${edgeRoutingPart(process)}`
}

/** 레이아웃에 영향을 주는 필드만 포함 — label/condition 등 메타 변경 시 맵 재배치 방지 */
export function getProcessLayoutKey(process: Process): string {
  return `${getProcessNodeLayoutKey(process)}::${edgeRoutingPart(process)}`
}
