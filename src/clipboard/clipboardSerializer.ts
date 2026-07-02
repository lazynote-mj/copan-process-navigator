import type { Node } from '../types/process'
import type { ClipboardNodeData } from './types'

function cloneValue<T>(value: T): T {
  return typeof structuredClone === 'function'
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value)) as T
}

function finiteOr(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

export function serializeNodeForClipboard(node: Node): ClipboardNodeData {
  const copy = cloneValue(node) as Node & {
    selected?: unknown
    dragging?: unknown
    position?: unknown
    measured?: unknown
    data?: unknown
    diagnostics?: unknown
  }

  delete (copy as Partial<Node>).id
  delete copy.selected
  delete copy.dragging
  delete copy.position
  delete copy.measured
  delete copy.data
  delete copy.diagnostics

  return copy as ClipboardNodeData
}

export function deserializeClipboardNode(
  data: ClipboardNodeData,
  id: string,
  offsetX = 20,
  offsetY = 20,
): Node {
  const node = cloneValue(data)
  return {
    ...node,
    id,
    offsetX: finiteOr(node.offsetX, 0) + offsetX,
    offsetY: finiteOr(node.offsetY, 0) + offsetY,
    inputs: [...(node.inputs ?? [])],
    outputs: [...(node.outputs ?? [])],
    controls: [...(node.controls ?? [])],
    detailProcessIds: node.detailProcessIds ? [...node.detailProcessIds] : undefined,
    interfaceRuleAnchor: node.interfaceRuleAnchor ? { ...node.interfaceRuleAnchor } : undefined,
    detailLayout: node.detailLayout ? { ...node.detailLayout } : undefined,
  }
}
