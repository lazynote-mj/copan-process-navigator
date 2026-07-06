import type { Edge, Lane, Node, Process, ProcessZone } from '../../types/process'
import { DEFAULT_NODE_TYPE, getDefaultSystemForNodeType } from '../../types/nodeTypes'
import { DEFAULT_EDGE_TYPE } from '../../types/edgeTypes'
import { resolveNodeLocalOrder } from '../layout/localOrder'

export function generateId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

export function getNextLocalOrder(process: Process, laneId: string): number {
  const inLane = process.nodes.filter((n) => n.laneId === laneId)
  if (inLane.length === 0) return 1
  return Math.max(...inLane.map((n) => resolveNodeLocalOrder(n, process))) + 1
}

export function getNextLaneOrder(process: Process): number {
  if (process.lanes.length === 0) return 1
  return Math.max(...process.lanes.map((l) => l.order)) + 1
}

export function createDefaultNode(process: Process, laneId?: string): Node {
  const lane = laneId ?? [...process.lanes].sort((a, b) => a.order - b.order)[0]?.id ?? 'business'
  const defaultPhase = [...process.phases].sort((a, b) => a.order - b.order)[0]
  return {
    id: generateId('node'),
    name: '신규 프로세스',
    type: DEFAULT_NODE_TYPE,
    laneId: lane,
    phaseId: defaultPhase?.id ?? 'p1',
    phaseOrder: defaultPhase?.order ?? 1,
    localOrder: getNextLocalOrder(process, lane),
    owner: '',
    system: getDefaultSystemForNodeType(DEFAULT_NODE_TYPE),
    description: '',
    inputs: [],
    outputs: [],
    controls: [],
  }
}

export function createDefaultEdge(process: Process): Edge {
  const first = process.nodes[0]
  const second = process.nodes[1] ?? first
  return {
    id: generateId('edge'),
    source: first?.id ?? '',
    target: second?.id ?? '',
    sourceHandle: 'bottom',
    targetHandle: 'top',
    label: '',
    condition: '',
    type: DEFAULT_EDGE_TYPE,
    routing: { mode: 'auto' },
  }
}

export function createDefaultLane(process: Process): Lane {
  return {
    id: generateId('lane'),
    name: '신규 스윔레인',
    order: getNextLaneOrder(process),
    ownerDepartment: '',
    description: '',
  }
}

export function createDefaultZone(): ProcessZone {
  return {
    id: generateId('zone'),
    name: '자동프로세스',
    type: 'process-zone',
    laneIds: [],
    phaseIds: [],
    nodeIds: [],
    style: {
      showBackground: true,
      showBorder: true,
      borderStyle: 'dashed',
      visible: true,
      opacity: 0.12,
    },
  }
}

export function deleteNodeFromProcess(process: Process, nodeId: string): Process {
  return {
    ...process,
    nodes: process.nodes.filter((n) => n.id !== nodeId),
    edges: process.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
    zones: (process.zones ?? []).map((zone) => ({
      ...zone,
      nodeIds: zone.nodeIds.filter((id) => id !== nodeId),
    })),
  }
}

export function deleteEdgeFromProcess(process: Process, edgeId: string): Process {
  return {
    ...process,
    edges: process.edges.filter((e) => e.id !== edgeId),
  }
}

export function deleteLaneFromProcess(process: Process, laneId: string): Process {
  return {
    ...process,
    lanes: process.lanes.filter((l) => l.id !== laneId),
  }
}

export function deleteZoneFromProcess(process: Process, zoneId: string): Process {
  return {
    ...process,
    zones: (process.zones ?? []).filter((zone) => zone.id !== zoneId),
  }
}

export function sortLanesByOrder(lanes: Lane[]): Lane[] {
  return [...lanes].sort((a, b) => a.order - b.order)
}

export function normalizeLaneOrders(lanes: Lane[]): Lane[] {
  return sortLanesByOrder(lanes).map((lane, index) => ({
    ...lane,
    order: index + 1,
  }))
}

export type ValidationResult = { ok: true } | { ok: false; message: string }

export function validateNode(node: Node, process: Process): ValidationResult {
  if (!node.name.trim()) return { ok: false, message: '노드 이름은 필수입니다.' }
  if (!node.type) return { ok: false, message: '노드 type은 필수입니다.' }
  if (!process.lanes.some((l) => l.id === node.laneId)) {
    return { ok: false, message: '유효한 laneId를 선택하세요.' }
  }
  if (resolveNodeLocalOrder(node, process) < 1) {
    return { ok: false, message: '노드 배치 순서(localOrder)를 확인하세요.' }
  }
  return { ok: true }
}

export function validateEdge(edge: Edge, process: Process): ValidationResult {
  if (!edge.source) return { ok: false, message: 'source 노드를 선택하세요.' }
  if (!edge.target) return { ok: false, message: 'target 노드를 선택하세요.' }
  if (edge.source === edge.target) {
    return { ok: false, message: 'source와 target은 달라야 합니다.' }
  }
  const nodeIds = new Set(process.nodes.map((n) => n.id))
  if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
    return { ok: false, message: '존재하지 않는 노드가 연결에 포함되어 있습니다.' }
  }
  return { ok: true }
}

export function validateLane(lane: Lane): ValidationResult {
  if (!lane.name.trim()) return { ok: false, message: '스윔레인 이름은 필수입니다.' }
  if (!lane.order || lane.order < 1) return { ok: false, message: 'order는 1 이상이어야 합니다.' }
  return { ok: true }
}

export function validateZone(zone: ProcessZone, _process: Process): ValidationResult {
  if (!zone.name.trim()) return { ok: false, message: 'Zone 이름은 필수입니다.' }
  return { ok: true }
}

export function canDeleteLane(process: Process, laneId: string): ValidationResult {
  const hasNodes = process.nodes.some((n) => n.laneId === laneId)
  if (hasNodes) {
    return { ok: false, message: '스윔레인 내 노드가 있어 삭제할 수 없습니다.' }
  }
  return { ok: true }
}

/**
 * 레인은 전역 마스터라 삭제 전 "모든" 프로세스의 노드 참조를 검사해야 한다.
 * 현재 프로세스만 검사하면 다른 프로세스의 노드가 고아가 되어 렌더에서 사라진다.
 */
export function canDeleteLaneAcrossProcesses(
  processes: Array<{ id: string; name: string; nodes: Node[] }>,
  laneId: string,
): ValidationResult {
  const usedBy = processes.filter((process) =>
    process.nodes.some((node) => node.laneId === laneId),
  )
  if (usedBy.length > 0) {
    const names = usedBy.map((process) => process.name).slice(0, 3).join(', ')
    const suffix = usedBy.length > 3 ? ` 외 ${usedBy.length - 3}개` : ''
    return {
      ok: false,
      message: `다음 프로세스에 이 스윔레인의 노드가 있어 삭제할 수 없습니다: ${names}${suffix}`,
    }
  }
  return { ok: true }
}
