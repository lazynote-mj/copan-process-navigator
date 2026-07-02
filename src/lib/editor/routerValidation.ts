import type { Edge, EdgeHandleId, EdgeRoutingPoint, Node } from '../../types/process'
import {
  cloneProcessData,
  type ProcessData,
} from '../../types/processData'
import {
  DETAIL_CELL_MAX_ROWS,
  OVERVIEW_CELL_MAX_ROWS,
  clampCellSlot,
  normalizeLegacyCellSlot,
} from '../layout/overviewCellPlacement'
import {
  normalizeEdgeRoutingPersistence,
  resolveEdgeSourceHandle,
  resolveEdgeTargetHandle,
} from './edgeHandles'

const VALID_HANDLES = new Set<EdgeHandleId>(['top', 'right', 'bottom', 'left'])

export type RouterValidationSeverity = 'error' | 'warning' | 'fixed'

export type RouterValidationCode =
  | 'manual-handle-auto'
  | 'auto-edge-bend-points'
  | 'auto-edge-points'
  | 'invalid-routing-point'
  | 'detail-offset'
  | 'invalid-handle'
  | 'invalid-cell-slot'
  | 'broken-edge'
  | 'orphan-bend'

export type RouterValidationIssue = {
  code: RouterValidationCode
  severity: RouterValidationSeverity
  processId: string
  processName: string
  edgeId?: string
  nodeId?: string
  message: string
  fix?: string
}

export type RouterValidationReport = {
  ok: boolean
  issues: RouterValidationIssue[]
  errors: number
  warnings: number
  fixed: number
  checkedProcesses: number
  checkedNodes: number
  checkedEdges: number
  changed: boolean
}

export type RouterValidationResult = {
  data: ProcessData
  report: RouterValidationReport
}

type ValidationOptions = {
  autofix?: boolean
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isValidHandle(value: unknown): value is EdgeHandleId {
  return typeof value === 'string' && VALID_HANDLES.has(value as EdgeHandleId)
}

function isFinitePoint(point: unknown): point is EdgeRoutingPoint {
  const candidate = point as Partial<EdgeRoutingPoint> | null | undefined
  return isFiniteNumber(candidate?.x) && isFiniteNumber(candidate?.y)
}

function cloneFinitePoints(points: unknown): EdgeRoutingPoint[] {
  if (!Array.isArray(points)) return []
  return points.filter(isFinitePoint).map((point) => ({ x: point.x, y: point.y }))
}

function hasInvalidPoints(points: unknown): boolean {
  return Array.isArray(points) && points.some((point) => !isFinitePoint(point))
}

function issue(
  issues: RouterValidationIssue[],
  autofix: boolean,
  fixed: boolean,
  item: Omit<RouterValidationIssue, 'severity'>,
) {
  issues.push({
    ...item,
    severity: fixed ? 'fixed' : autofix ? 'warning' : 'warning',
  })
}

function error(issues: RouterValidationIssue[], item: Omit<RouterValidationIssue, 'severity'>) {
  issues.push({ ...item, severity: 'error' })
}

function processSlotMaxRows(processType: string | undefined): number {
  return processType === 'overview' ? OVERVIEW_CELL_MAX_ROWS : DETAIL_CELL_MAX_ROWS
}

function sanitizeDetailLayout(layout: Node['detailLayout']): { value?: Node['detailLayout']; changed: boolean } {
  if (!layout) return { changed: false }
  const next: NonNullable<Node['detailLayout']> = { ...layout }
  let changed = false
  if (next.column != null && !isFiniteNumber(next.column)) {
    delete next.column
    changed = true
  }
  if (next.row != null && !isFiniteNumber(next.row)) {
    delete next.row
    changed = true
  }
  if (next.column != null && next.column < 1) {
    next.column = 1
    changed = true
  }
  if (next.row != null && next.row < 1) {
    next.row = 1
    changed = true
  }
  return {
    value: next.column != null || next.row != null ? next : undefined,
    changed,
  }
}

function sanitizeEdgeHandles(edge: Edge): { edge: Edge; changed: boolean } {
  let next = edge
  let changed = false
  const rootSourceValid = edge.sourceHandle == null || isValidHandle(edge.sourceHandle)
  const rootTargetValid = edge.targetHandle == null || isValidHandle(edge.targetHandle)
  const routingSourceValid = edge.routing?.sourceHandle == null || isValidHandle(edge.routing.sourceHandle)
  const routingTargetValid = edge.routing?.targetHandle == null || isValidHandle(edge.routing.targetHandle)

  if (!rootSourceValid || !rootTargetValid || !routingSourceValid || !routingTargetValid) {
    next = {
      ...next,
      ...(rootSourceValid ? {} : { sourceHandle: undefined }),
      ...(rootTargetValid ? {} : { targetHandle: undefined }),
      routing: next.routing
        ? {
            ...next.routing,
            ...(routingSourceValid ? {} : { sourceHandle: undefined }),
            ...(routingTargetValid ? {} : { targetHandle: undefined }),
          }
        : next.routing,
    }
    changed = true
  }

  return { edge: next, changed }
}

function sanitizeRouting(edge: Edge): { edge: Edge; changed: boolean } {
  let next = edge
  let changed = false
  const routing = next.routing
  const isManualWithHandleAuto = routing?.mode === 'manual' && routing.handleAuto === true
  const isAuto = routing?.mode === 'auto' || isManualWithHandleAuto || routing?.handleAuto === true

  const routingPoints = cloneFinitePoints(routing?.points)
  const bendPoints = cloneFinitePoints(next.bendPoints)
  const legacyPoints = cloneFinitePoints(next.points)
  const hasInvalid =
    hasInvalidPoints(routing?.points) ||
    hasInvalidPoints(next.bendPoints) ||
    hasInvalidPoints(next.points)

  if (hasInvalid) {
    next = {
      ...next,
      ...(routing ? { routing: { ...routing, points: routingPoints.length ? routingPoints : undefined } } : {}),
      bendPoints: bendPoints.length ? bendPoints : undefined,
      points: legacyPoints.length ? legacyPoints : undefined,
    }
    changed = true
  }

  if (isManualWithHandleAuto) {
    next = {
      ...next,
      manualRoute: undefined,
      bendPoints: undefined,
      points: undefined,
      routing: { mode: 'auto', handleAuto: true },
    }
    changed = true
  } else if (isAuto && (next.bendPoints?.length || next.points?.length || next.routing?.points?.length)) {
    next = {
      ...next,
      manualRoute: undefined,
      bendPoints: undefined,
      points: undefined,
      routing: {
        ...next.routing,
        mode: 'auto',
        handleAuto: next.routing?.handleAuto !== false,
        points: undefined,
      },
    }
    changed = true
  } else {
    const normalized = normalizeEdgeRoutingPersistence(next)
    if (
      normalized.manualRoute !== next.manualRoute ||
      normalized.bendPoints !== next.bendPoints ||
      normalized.points !== next.points ||
      JSON.stringify(normalized.routing ?? {}) !== JSON.stringify(next.routing ?? {})
    ) {
      next = normalized
      changed = true
    }
  }

  return { edge: next, changed }
}

export function validateRouterData(
  data: ProcessData,
  options: ValidationOptions = {},
): RouterValidationResult {
  const autofix = options.autofix === true
  const next = cloneProcessData(data)
  const issues: RouterValidationIssue[] = []
  let changed = false
  let checkedNodes = 0
  let checkedEdges = 0

  next.processes.forEach((process) => {
    const nodeIds = new Set(process.nodes.map((node) => node.id))
    const maxRows = processSlotMaxRows(process.type)
    checkedNodes += process.nodes.length
    checkedEdges += process.edges.length

    process.nodes = process.nodes.map((node) => {
      let nextNode = node

      if (node.cellSlot != null && (!isFiniteNumber(node.cellSlot) || node.cellSlot < 1)) {
        const fixedSlot = 1
        issue(issues, autofix, autofix, {
          code: 'invalid-cell-slot',
          processId: process.id,
          processName: process.name,
          nodeId: node.id,
          message: `${node.name}의 행/열 위치 값이 유효하지 않습니다.`,
          fix: `cellSlot=${fixedSlot}`,
        })
        if (autofix) {
          nextNode = { ...nextNode, cellSlot: fixedSlot }
          changed = true
        }
      } else if (node.cellSlot != null) {
        const normalized = clampCellSlot(normalizeLegacyCellSlot(node.cellSlot, maxRows), maxRows)
        if (normalized !== node.cellSlot) {
          issue(issues, autofix, autofix, {
            code: 'invalid-cell-slot',
            processId: process.id,
            processName: process.name,
            nodeId: node.id,
            message: `${node.name}의 행/열 위치 값이 현재 grid 범위를 벗어났습니다.`,
            fix: `cellSlot ${node.cellSlot} → ${normalized}`,
          })
          if (autofix) {
            nextNode = { ...nextNode, cellSlot: normalized }
            changed = true
          }
        }
      }

      if (
        !isFiniteNumber(node.offsetX ?? 0) ||
        !isFiniteNumber(node.offsetY ?? 0) ||
        node.offsetX !== 0 ||
        node.offsetY !== 0
      ) {
        const invalidOffset = !isFiniteNumber(node.offsetX ?? 0) || !isFiniteNumber(node.offsetY ?? 0)
        issue(issues, autofix, autofix && invalidOffset, {
          code: 'detail-offset',
          processId: process.id,
          processName: process.name,
          nodeId: node.id,
          message: invalidOffset
            ? `${node.name}의 위치 보정값이 유효하지 않습니다.`
            : `${node.name}에 위치 보정값이 있습니다.`,
          fix: invalidOffset ? 'offsetX/offsetY=0' : '수동 보정값 검토 필요',
        })
        if (autofix && invalidOffset) {
          nextNode = { ...nextNode, offsetX: 0, offsetY: 0 }
          changed = true
        }
      }

      const detailLayout = sanitizeDetailLayout(node.detailLayout)
      if (detailLayout.changed) {
        issue(issues, autofix, autofix, {
          code: 'detail-offset',
          processId: process.id,
          processName: process.name,
          nodeId: node.id,
          message: `${node.name}의 상세 배치 row/column 값이 유효하지 않습니다.`,
          fix: 'detailLayout row/column 정리',
        })
        if (autofix) {
          nextNode = { ...nextNode, detailLayout: detailLayout.value }
          changed = true
        }
      }

      return nextNode
    })

    process.edges = process.edges.map((edge) => {
      let nextEdge = edge
      const sourceExists = nodeIds.has(edge.source)
      const targetExists = nodeIds.has(edge.target)

      if (!sourceExists || !targetExists) {
        error(issues, {
          code: 'broken-edge',
          processId: process.id,
          processName: process.name,
          edgeId: edge.id,
          message: `연결선의 ${!sourceExists ? '이전 업무' : '다음 업무'} 노드를 찾을 수 없습니다.`,
          fix: '노드 연결을 수동으로 재지정해야 합니다.',
        })
      }

      const hasSavedBends =
        (edge.routing?.points?.length ?? 0) > 0 ||
        (edge.bendPoints?.length ?? 0) > 0 ||
        (edge.points?.length ?? 0) > 0
      if ((!sourceExists || !targetExists) && hasSavedBends) {
        error(issues, {
          code: 'orphan-bend',
          processId: process.id,
          processName: process.name,
          edgeId: edge.id,
          message: '노드 연결이 깨진 연결선에 bend/path 값이 남아 있습니다.',
          fix: '먼저 source/target을 복구해야 합니다.',
        })
      }

      const rootSourceInvalid = edge.sourceHandle != null && !isValidHandle(edge.sourceHandle)
      const rootTargetInvalid = edge.targetHandle != null && !isValidHandle(edge.targetHandle)
      const routingSourceInvalid = edge.routing?.sourceHandle != null && !isValidHandle(edge.routing.sourceHandle)
      const routingTargetInvalid = edge.routing?.targetHandle != null && !isValidHandle(edge.routing.targetHandle)
      if (rootSourceInvalid || rootTargetInvalid || routingSourceInvalid || routingTargetInvalid) {
        issue(issues, autofix, autofix, {
          code: 'invalid-handle',
          processId: process.id,
          processName: process.name,
          edgeId: edge.id,
          message: '연결선의 출발/도착면 값이 유효하지 않습니다.',
          fix: '잘못된 handle 제거 후 자동 handle 사용',
        })
        if (autofix) {
          const sanitized = sanitizeEdgeHandles(nextEdge)
          nextEdge = sanitized.edge
          changed = changed || sanitized.changed
        }
      }

      if (edge.routing?.mode === 'manual' && edge.routing.handleAuto === true) {
        issue(issues, autofix, autofix, {
          code: 'manual-handle-auto',
          processId: process.id,
          processName: process.name,
          edgeId: edge.id,
          message: '수동 라우팅과 자동 handle 설정이 함께 저장되어 있습니다.',
          fix: 'auto routing으로 정리',
        })
      }

      if ((edge.routing?.mode === 'auto' || edge.routing?.handleAuto === true) && edge.bendPoints?.length) {
        issue(issues, autofix, autofix, {
          code: 'auto-edge-bend-points',
          processId: process.id,
          processName: process.name,
          edgeId: edge.id,
          message: '자동 연결선에 legacy bendPoints가 남아 있습니다.',
          fix: 'bendPoints 제거',
        })
      }

      if (
        (edge.routing?.mode === 'auto' || edge.routing?.handleAuto === true) &&
        ((edge.points?.length ?? 0) > 0 || (edge.routing?.points?.length ?? 0) > 0)
      ) {
        issue(issues, autofix, autofix, {
          code: 'auto-edge-points',
          processId: process.id,
          processName: process.name,
          edgeId: edge.id,
          message: '자동 연결선에 저장된 path point가 남아 있습니다.',
          fix: 'points 제거',
        })
      }

      if (
        hasInvalidPoints(edge.routing?.points) ||
        hasInvalidPoints(edge.bendPoints) ||
        hasInvalidPoints(edge.points)
      ) {
        issue(issues, autofix, autofix, {
          code: 'invalid-routing-point',
          processId: process.id,
          processName: process.name,
          edgeId: edge.id,
          message: '연결선 path point에 유효하지 않은 좌표가 있습니다.',
          fix: '유효한 point만 보존',
        })
      }

      if (autofix) {
        const routed = sanitizeRouting(nextEdge)
        nextEdge = routed.edge
        changed = changed || routed.changed
      }

      const sourceHandle = resolveEdgeSourceHandle(nextEdge)
      const targetHandle = resolveEdgeTargetHandle(nextEdge)
      if ((sourceHandle && !isValidHandle(sourceHandle)) || (targetHandle && !isValidHandle(targetHandle))) {
        error(issues, {
          code: 'invalid-handle',
          processId: process.id,
          processName: process.name,
          edgeId: edge.id,
          message: '자동 보정 후에도 유효하지 않은 handle이 남아 있습니다.',
          fix: '연결선 설정을 수동으로 확인해야 합니다.',
        })
      }

      return nextEdge
    })
  })

  const errors = issues.filter((item) => item.severity === 'error').length
  const warnings = issues.filter((item) => item.severity === 'warning').length
  const fixed = issues.filter((item) => item.severity === 'fixed').length

  return {
    data: next,
    report: {
      ok: errors === 0,
      issues,
      errors,
      warnings,
      fixed,
      checkedProcesses: next.processes.length,
      checkedNodes,
      checkedEdges,
      changed,
    },
  }
}

export function formatRouterValidationMessage(report: RouterValidationReport): string {
  if (report.ok) {
    if (report.fixed > 0) return `Router 데이터 ${report.fixed}건을 자동 보정했습니다.`
    if (report.warnings > 0) return `Router 데이터 경고 ${report.warnings}건이 있습니다.`
    return 'Router 데이터가 정상입니다.'
  }
  return `Router 데이터 오류 ${report.errors}건이 있어 저장을 중단합니다.`
}
