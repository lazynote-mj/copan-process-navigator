import type { Edge } from './process'

/** Edge 시각/라우팅 타입 — node type과 독립 */
export const EDGE_TYPES = [
  'normal',
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
  opacity?: number
} {
  switch (edgeType) {
    case 'normal':
      return { stroke: '#475569', strokeWidth: 2.5 }
    case 'system':
      return { stroke: '#7c3aed', strokeWidth: 2.5, strokeDasharray: '6 4' }
    case 'api':
      return { stroke: '#059669', strokeWidth: 2, strokeDasharray: '5 3' }
    case 'condition':
      return { stroke: '#7c3aed', strokeWidth: 2, strokeDasharray: '7 5', opacity: 0.85 }
    case 'exception':
      return { stroke: '#e11d48', strokeWidth: 2, strokeDasharray: '6 4', opacity: 0.85 }
    case 'return':
      return { stroke: '#64748b', strokeWidth: 2, strokeDasharray: '6 4', opacity: 0.75 }
    case 'virtual':
      return { stroke: '#94a3b8', strokeWidth: 2, strokeDasharray: '4 4', opacity: 0.85 }
    case 'reference':
      return { stroke: '#cbd5e1', strokeWidth: 1.5, strokeDasharray: '2 4', opacity: 0.9 }
  }
}

export function buildEdgeMarkerColor(edgeType: EdgeType): string {
  switch (edgeType) {
    case 'normal':
      return '#475569'
    case 'system':
      return '#7c3aed'
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
