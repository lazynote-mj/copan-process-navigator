import type { Edge } from './process'

/** Edge 시각/라우팅 타입 — node type과 독립 */
export const EDGE_TYPES = [
  'normal',
  /** @deprecated data 마이그레이션 대상 — api 또는 normal 사용 */
  'system',
  'api',
  'condition',
  'exception',
  'return',
  'virtual',
  'reference',
] as const

export type EdgeType = (typeof EDGE_TYPES)[number]

export const DEFAULT_EDGE_TYPE: EdgeType = 'normal'

/** 노드 테두리 — process-node.css `border: 1.5px solid` */
export const NODE_BORDER_WIDTH = 1.5

/** 실선 연결선 — 노드 테두리와 동일해 흐름선이 또렷하게 보이도록 */
export const EDGE_STROKE_WIDTH = NODE_BORDER_WIDTH

/** 점선 연결선 — dash gap·opacity로 얇아 보이는 것을 보정 */
export const EDGE_DASHED_STROKE_WIDTH = 1.65

const LEGACY_RETURN_TYPES = new Set(['return', 'back', 'loop', 'rework'])

const EXCEPTION_CONDITIONS = new Set([
  'creditExceeded',
  'rejected',
  'onHold',
  'reReview',
  'escalated',
])

export function resolveEdgeType(edge: Edge): EdgeType {
  const raw = edge.type?.trim()
  if (raw === 'system') {
    return 'normal'
  }
  if (raw && EDGE_TYPES.includes(raw as EdgeType)) {
    return raw as EdgeType
  }
  if (raw && LEGACY_RETURN_TYPES.has(raw)) {
    return 'return'
  }
  if (edge.condition && EXCEPTION_CONDITIONS.has(edge.condition)) {
    return 'exception'
  }
  if (edge.condition) {
    return 'condition'
  }
  return DEFAULT_EDGE_TYPE
}

export function normalizeEdgeType(edge: Edge): Edge {
  return {
    ...edge,
    type: resolveEdgeType(edge),
  }
}

export function buildEdgeStrokeStyle(edgeType: EdgeType): {
  stroke: string
  strokeWidth: number
  strokeDasharray?: string
  strokeLinecap?: 'round'
  opacity?: number
} {
  switch (edgeType) {
    case 'normal':
      return { stroke: '#475569', strokeWidth: EDGE_STROKE_WIDTH, strokeLinecap: 'round' }
    case 'system':
      return { stroke: '#475569', strokeWidth: EDGE_STROKE_WIDTH, strokeLinecap: 'round' }
    case 'api':
      return { stroke: '#059669', strokeWidth: EDGE_STROKE_WIDTH, strokeLinecap: 'round' }
    case 'condition':
      return {
        stroke: '#7c3aed',
        strokeWidth: EDGE_DASHED_STROKE_WIDTH,
        strokeDasharray: '7 5',
        strokeLinecap: 'round',
        opacity: 0.9,
      }
    case 'exception':
      return {
        stroke: '#e11d48',
        strokeWidth: EDGE_DASHED_STROKE_WIDTH,
        strokeDasharray: '6 4',
        strokeLinecap: 'round',
        opacity: 0.9,
      }
    case 'return':
      return {
        stroke: '#64748b',
        strokeWidth: EDGE_DASHED_STROKE_WIDTH,
        strokeDasharray: '6 4',
        strokeLinecap: 'round',
        opacity: 0.82,
      }
    case 'virtual':
      return {
        stroke: '#94a3b8',
        strokeWidth: EDGE_DASHED_STROKE_WIDTH,
        strokeDasharray: '4 4',
        strokeLinecap: 'round',
        opacity: 0.88,
      }
    case 'reference':
      return {
        stroke: '#cbd5e1',
        strokeWidth: EDGE_DASHED_STROKE_WIDTH,
        strokeDasharray: '2 4',
        strokeLinecap: 'round',
        opacity: 0.92,
      }
  }
}

export function buildEdgeMarkerColor(edgeType: EdgeType): string {
  switch (edgeType) {
    case 'normal':
      return '#475569'
    case 'system':
      return '#475569'
    case 'api':
      return '#059669'
    case 'condition':
      return '#7c3aed'
    case 'exception':
      return '#e11d48'
    case 'return':
      return '#64748b'
    case 'virtual':
      return '#94a3b8'
    case 'reference':
      return '#cbd5e1'
  }
}

export function edgeTypeShowsArrow(edgeType: EdgeType): boolean {
  return edgeType !== 'reference'
}

export function isReturnEdgeType(edgeType: EdgeType): boolean {
  return edgeType === 'return'
}
