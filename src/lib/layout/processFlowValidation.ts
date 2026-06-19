import type { Edge, Node, Process } from '../../types/process'

export type ProcessFlowIssue = {
  kind: 'missing-node' | 'decision-branch' | 'missing-edge-endpoint'
  message: string
  nodeId?: string
  edgeId?: string
}

export function validateDecisionNodes(process: Process): ProcessFlowIssue[] {
  const issues: ProcessFlowIssue[] = []
  const outgoing = new Map<string, Edge[]>()

  for (const edge of process.edges) {
    const list = outgoing.get(edge.source) ?? []
    list.push(edge)
    outgoing.set(edge.source, list)
  }

  for (const node of process.nodes) {
    if (node.type !== 'decision') continue
    const branches = outgoing.get(node.id) ?? []
    if (branches.length < 2) {
      issues.push({
        kind: 'decision-branch',
        nodeId: node.id,
        message: `Decision node "${node.name}" (${node.id}) must have at least 2 outgoing edges (found ${branches.length}).`,
      })
    }
  }

  return issues
}

export function validateEdgeEndpoints(process: Process): ProcessFlowIssue[] {
  const nodeIds = new Set(process.nodes.map((n) => n.id))
  const issues: ProcessFlowIssue[] = []

  for (const edge of process.edges) {
    if (!nodeIds.has(edge.source)) {
      issues.push({
        kind: 'missing-edge-endpoint',
        edgeId: edge.id,
        nodeId: edge.source,
        message: `Edge "${edge.id}" references missing source node: ${edge.source}`,
      })
    }
    if (!nodeIds.has(edge.target)) {
      issues.push({
        kind: 'missing-edge-endpoint',
        edgeId: edge.id,
        nodeId: edge.target,
        message: `Edge "${edge.id}" references missing target node: ${edge.target}`,
      })
    }
  }

  return issues
}

export function validateProcessFlow(process: Process): ProcessFlowIssue[] {
  return [...validateDecisionNodes(process), ...validateEdgeEndpoints(process)]
}

export function logProcessFlowIssues(process: Process, issues: ProcessFlowIssue[]): void {
  if (issues.length === 0) return
  for (const issue of issues) {
    if (issue.kind === 'missing-edge-endpoint') {
      console.warn(`[ProcessNavigator] Missing target node: ${issue.nodeId} (edge ${issue.edgeId})`)
    } else {
      console.warn(`[ProcessNavigator] ${issue.message}`)
    }
  }
  console.warn(`[ProcessNavigator] Process "${process.id}" flow validation: ${issues.length} issue(s).`)
}

export function findNode(process: Process, nodeId: string): Node | undefined {
  return process.nodes.find((n) => n.id === nodeId)
}
