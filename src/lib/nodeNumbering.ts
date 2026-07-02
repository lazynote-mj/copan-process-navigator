import type { Edge, Node, Process } from '../types/process'

const EXCLUDED_NODE_TYPES = new Set([
  'database',
  'linked-process',
  'interface',
  'api',
  'interface-rule',
  'connector',
  'phase-connector',
  'merge',
])

const AUTO_NAME_PATTERN = /\bAUTO\b|자동|전표생성\(미결\)|자동승인/
const SYSTEM_ONLY_PATTERN = /database|system rule|api|interface/i
const MAIN_FLOW_PATTERN = /^(main|y|yes|정상|기본|승인|진행|확정)$/i
const SECONDARY_FLOW_PATTERN = /^(n|no|반려|예외|보완|재작업|취소|실패|오류)$/i

function numeric(value: unknown, fallback = 999): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function resolveColumn(node: Node): number {
  return numeric(node.detailLayout?.column, numeric(node.cellOrder, numeric(node.localOrder)))
}

function resolveRow(node: Node): number {
  return numeric(node.detailLayout?.row, numeric(node.cellSlot))
}

function nodeExecutionSortKey(node: Node): string {
  const column = resolveColumn(node)
  const row = resolveRow(node)
  const offsetX = numeric(node.offsetX, 0)
  const offsetY = numeric(node.offsetY, 0)
  return [
    String(column).padStart(4, '0'),
    String(row).padStart(4, '0'),
    String(offsetX + 10000).padStart(6, '0'),
    String(offsetY + 10000).padStart(6, '0'),
    node.id,
  ].join(':')
}

function normalizeFlowText(value: string | undefined): string {
  return (value ?? '').trim()
}

function edgeFlowPriority(edge: Edge): number {
  const text = [edge.label, edge.condition].map(normalizeFlowText).filter(Boolean).join(' ')
  if (edge.type === 'return') return 4
  if (!text) return 0
  if (MAIN_FLOW_PATTERN.test(text)) return 0
  if (SECONDARY_FLOW_PATTERN.test(text)) return 3
  return 1
}

function isFeedbackEdge(edge: Edge, nodeById: Map<string, Node>): boolean {
  const source = nodeById.get(edge.source)
  const target = nodeById.get(edge.target)
  if (!source || !target) return false
  if (edge.type === 'return') return true
  return edgeFlowPriority(edge) >= 3 && nodeExecutionSortKey(target) <= nodeExecutionSortKey(source)
}

function isNumberedActivityNode(node: Node): boolean {
  if (EXCLUDED_NODE_TYPES.has(node.type)) return false
  if (node.type === 'system') return false
  if (node.displayLevel === 'system') return false
  if (SYSTEM_ONLY_PATTERN.test(node.system)) return false
  if (AUTO_NAME_PATTERN.test(node.name)) return false
  return true
}

export type NodeNumberValue = number | string

export type NodeNumberDebugEntry = {
  nodeId: string
  nodeName: string
  eligible: boolean
  number?: NodeNumberValue
  sortKey: string
  note: string
}

export type NodeNumberDebugInfo = {
  processId: string
  processName: string
  starts: string[]
  entries: NodeNumberDebugEntry[]
}

export type NodeNumberResult = {
  numbers: Map<string, NodeNumberValue>
  debug: NodeNumberDebugInfo
}

function getSortedOutgoingEdges(process: Process, sourceId: string, nodeById: Map<string, Node>): Edge[] {
  return process.edges
    .filter((edge) => edge.source === sourceId && nodeById.has(edge.target))
    .sort((a, b) => {
      const targetA = nodeById.get(a.target)!
      const targetB = nodeById.get(b.target)!
      return (
        edgeFlowPriority(a) - edgeFlowPriority(b) ||
        Number(isFeedbackEdge(a, nodeById)) - Number(isFeedbackEdge(b, nodeById)) ||
        nodeExecutionSortKey(targetA).localeCompare(nodeExecutionSortKey(targetB)) ||
        (a.label ?? '').localeCompare(b.label ?? '') ||
        (a.condition ?? '').localeCompare(b.condition ?? '') ||
        a.id.localeCompare(b.id)
      )
    })
}

function resolveStartNodes(process: Process, nodeById: Map<string, Node>): Node[] {
  const incoming = new Set(
    process.edges
      .filter((edge) => nodeById.has(edge.source) && nodeById.has(edge.target) && !isFeedbackEdge(edge, nodeById))
      .map((edge) => edge.target),
  )
  const starts = process.nodes.filter((node) => !incoming.has(node.id))
  return (starts.length > 0 ? starts : process.nodes)
    .slice()
    .sort((a, b) => nodeExecutionSortKey(a).localeCompare(nodeExecutionSortKey(b)))
}

function branchSuffix(index: number): string {
  return String.fromCharCode('A'.charCodeAt(0) + index)
}

export function buildAutoNodeNumberResult(process: Process): NodeNumberResult {
  const nodeById = new Map(process.nodes.map((node) => [node.id, node]))
  const visited = new Set<string>()
  const numbers = new Map<string, NodeNumberValue>()
  const notes = new Map<string, string>()
  let nextNumber = 1

  const assignNumber = (node: Node, forcedNumber?: NodeNumberValue) => {
    if (!isNumberedActivityNode(node) || numbers.has(node.id)) return
    const number = forcedNumber ?? nextNumber
    numbers.set(node.id, number)
    notes.set(node.id, forcedNumber ? 'branch' : 'main')
    if (forcedNumber == null) nextNumber += 1
  }

  const visit = (node: Node) => {
    if (visited.has(node.id)) return
    visited.add(node.id)
    assignNumber(node)

    const outgoing = getSortedOutgoingEdges(process, node.id, nodeById)
      .filter((edge) => {
        const target = nodeById.get(edge.target)
        if (!target) return false
        return !(visited.has(target.id) && isFeedbackEdge(edge, nodeById))
      })

    const executableForwardEdges = outgoing.filter((edge) => {
      const target = nodeById.get(edge.target)
      return Boolean(target && !visited.has(target.id) && !isFeedbackEdge(edge, nodeById))
    })
    const numberedBranchEdges = executableForwardEdges.filter((edge, edgeIndex, edges) => {
      const target = nodeById.get(edge.target)
      return Boolean(
        target &&
        isNumberedActivityNode(target) &&
        !numbers.has(target.id) &&
        edges.findIndex((candidate) => candidate.target === edge.target) === edgeIndex,
      )
    })

    const isBranch = numberedBranchEdges.length > 1
    if (isBranch) {
      const branchBase = nextNumber
      numberedBranchEdges.forEach((edge, branchIndex) => {
        const target = nodeById.get(edge.target)
        if (target && isNumberedActivityNode(target) && !numbers.has(target.id)) {
          assignNumber(target, `${branchBase}${branchSuffix(branchIndex)}`)
        }
      })
      const assignedBranchHeads = numberedBranchEdges.some((edge) => {
        const target = nodeById.get(edge.target)
        return Boolean(target && numbers.get(target.id)?.toString().startsWith(String(branchBase)))
      })
      if (assignedBranchHeads) nextNumber += 1
    }

    for (const edge of outgoing) {
      if (isFeedbackEdge(edge, nodeById)) continue
      const target = nodeById.get(edge.target)
      if (target) visit(target)
    }
  }

  for (const node of resolveStartNodes(process, nodeById)) visit(node)
  for (const node of process.nodes.slice().sort((a, b) => nodeExecutionSortKey(a).localeCompare(nodeExecutionSortKey(b)))) {
    visit(node)
  }

  const debug: NodeNumberDebugInfo = {
    processId: process.id,
    processName: process.name,
    starts: resolveStartNodes(process, nodeById).map((node) => node.id),
    entries: process.nodes
      .slice()
      .sort((a, b) => nodeExecutionSortKey(a).localeCompare(nodeExecutionSortKey(b)))
      .map((node) => ({
        nodeId: node.id,
        nodeName: node.name,
        eligible: isNumberedActivityNode(node),
        number: numbers.get(node.id),
        sortKey: nodeExecutionSortKey(node),
        note: notes.get(node.id) ?? (isNumberedActivityNode(node) ? 'unreached-fallback' : 'excluded'),
      })),
  }

  return { numbers, debug }
}

export function buildAutoNodeNumberMap(process: Process): Map<string, NodeNumberValue> {
  return buildAutoNodeNumberResult(process).numbers
}
