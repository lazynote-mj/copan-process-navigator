import type { EdgeType } from '../../types/edgeTypes'
import {
  buildEdgeMarkerColor,
  buildEdgeStrokeStyle,
  EDGE_DASHED_STROKE_WIDTH,
} from '../../types/edgeTypes'

export type EdgeValidationStatus = 'ok' | 'warning' | 'error'

export type EdgeRouteValidation = {
  validationStatus: EdgeValidationStatus
  routeIssue?: string
  routeIssueLabel?: string
  suggestedFix?: string
  collidedNodeIds?: string[]
  collidedNodeNames?: string[]
  bendCount?: number
  routingStatus?: string
}

export const EDGE_ERROR_STROKE = {
  stroke: '#dc2626',
  strokeWidth: EDGE_DASHED_STROKE_WIDTH,
  strokeDasharray: '6 4',
  strokeLinecap: 'round' as const,
} as const

export const EDGE_WARNING_STROKE = {
  stroke: '#d97706',
  strokeWidth: EDGE_DASHED_STROKE_WIDTH,
  strokeDasharray: '5 4',
  strokeLinecap: 'round' as const,
} as const

/** Overview cross-zone gutter 등 — 4 bend까지는 정상 */
const EXCESSIVE_BEND_WARNING = 5

export function resolveEdgeRouteValidation(input: {
  broken?: boolean
  brokenReason?: string
  missingNodeId?: string
  hasNodeCollision?: boolean
  collidedNodes?: Array<{ id: string; name: string }>
  routingStatus?: string
  bendCount?: number
  pathEmpty?: boolean
  missingSourceHandle?: boolean
  missingTargetHandle?: boolean
  handleMismatch?: boolean
  /** manual route — 노드 접촉은 경고(편집자 의도 경로) */
  manualRoute?: boolean
}): EdgeRouteValidation {
  const bendCount = input.bendCount ?? 0
  const collidedNodeIds = input.collidedNodes?.map((node) => node.id)
  const collidedNodeNames = input.collidedNodes?.map((node) => node.name)

  if (input.broken) {
    return {
      validationStatus: 'error',
      routeIssue: 'missing_endpoint',
      routeIssueLabel: input.brokenReason?.includes('source')
        ? '오류: source node 없음'
        : input.brokenReason?.includes('target')
          ? '오류: target node 없음'
          : '오류: 연결 endpoint 없음',
      suggestedFix: input.missingNodeId
        ? `누락된 노드(${input.missingNodeId})를 복구하거나 연결선 source/target을 수정하세요.`
        : 'source/target 노드가 layout에 존재하는지 확인하세요.',
      bendCount,
      routingStatus: input.routingStatus,
      collidedNodeIds,
      collidedNodeNames,
    }
  }

  if (input.pathEmpty) {
    return {
      validationStatus: 'error',
      routeIssue: 'route_failed',
      routeIssueLabel: '오류: route 계산 실패',
      suggestedFix: 'source/target handle과 node 위치를 확인한 뒤 routing mode를 auto로 재계산하세요.',
      bendCount,
      routingStatus: input.routingStatus,
    }
  }

  if (input.missingSourceHandle || input.missingTargetHandle) {
    return {
      validationStatus: 'error',
      routeIssue: 'missing_handle',
      routeIssueLabel: input.missingSourceHandle
        ? '오류: source handle 없음'
        : '오류: target handle 없음',
      suggestedFix: 'Property Panel에서 출발/도착면을 지정하거나 Handle 자동을 활성화하세요.',
      bendCount,
      routingStatus: input.routingStatus,
    }
  }

  if (input.handleMismatch) {
    return {
      validationStatus: 'error',
      routeIssue: 'handle_mismatch',
      routeIssueLabel: '오류: handle 불일치',
      suggestedFix: '저장된 handle과 실제 route anchor가 다릅니다. handle을 다시 지정하세요.',
      bendCount,
      routingStatus: input.routingStatus,
    }
  }

  if (input.hasNodeCollision && (input.collidedNodes?.length ?? 0) > 0) {
    if (input.manualRoute) {
      return {
        validationStatus: 'warning',
        routeIssue: 'manual_route_collision',
        routeIssueLabel: '경고: manual route 노드 접촉',
        suggestedFix: '편집자가 지정한 경로가 노드와 겹칩니다. 필요 시 bend를 조정하세요.',
        collidedNodeIds,
        collidedNodeNames,
        bendCount,
        routingStatus: input.routingStatus,
      }
    }
    return {
      validationStatus: 'error',
      routeIssue: 'node_collision',
      routeIssueLabel: '오류: 노드 관통',
      suggestedFix: '경로가 다른 노드를 관통합니다. handle 변경 또는 manual bend로 우회하세요.',
      collidedNodeIds,
      collidedNodeNames,
      bendCount,
      routingStatus: input.routingStatus,
    }
  }

  if (bendCount >= EXCESSIVE_BEND_WARNING) {
    return {
      validationStatus: 'warning',
      routeIssue: 'excessive_bends',
      routeIssueLabel: '경고: bend 과다',
      suggestedFix: '출발/도착면을 조정하거나 manual route로 단순화를 검토하세요.',
      bendCount,
      routingStatus: input.routingStatus,
    }
  }

  if (input.routingStatus === 'reroutedDueToCollision') {
    return {
      validationStatus: 'ok',
      routeIssue: 'auto_rerouted',
      routeIssueLabel: '정상 (경로 자동 보정됨)',
      suggestedFix: 'collision 회피를 위해 route가 자동 보정되었습니다.',
      bendCount,
      routingStatus: input.routingStatus,
    }
  }

  return {
    validationStatus: 'ok',
    routeIssueLabel: '정상',
    bendCount,
    routingStatus: input.routingStatus,
  }
}

export function buildEdgeDisplayStyle(
  edgeType: EdgeType,
  validation: EdgeRouteValidation,
): {
  style: { stroke: string; strokeWidth: number; strokeDasharray?: string; opacity?: number }
  markerColor: string
  statusClass?: string
} {
  if (validation.validationStatus === 'error') {
    return {
      style: { ...EDGE_ERROR_STROKE },
      markerColor: EDGE_ERROR_STROKE.stroke,
      statusClass: 'process-edge--error',
    }
  }

  if (validation.validationStatus === 'warning') {
    return {
      style: { ...EDGE_WARNING_STROKE },
      markerColor: EDGE_WARNING_STROKE.stroke,
      statusClass: 'process-edge--warning',
    }
  }

  const base = buildEdgeStrokeStyle(edgeType)
  return {
    style: base,
    markerColor: buildEdgeMarkerColor(edgeType),
  }
}

export function validationStatusLabel(validation: EdgeRouteValidation): string {
  return validation.routeIssueLabel ?? '정상'
}

/** ProcessEdgeData / edge.data 저장용 */
export function validationToEdgeData(validation: EdgeRouteValidation): Record<string, unknown> {
  return {
    validationStatus: validation.validationStatus,
    routeIssue: validation.routeIssue,
    routeIssueLabel: validation.routeIssueLabel,
    suggestedFix: validation.suggestedFix,
    collidedNodeIds: validation.collidedNodeIds,
    collidedNodeNames: validation.collidedNodeNames,
    bendCount: validation.bendCount,
    routingStatus: validation.routingStatus,
  }
}
