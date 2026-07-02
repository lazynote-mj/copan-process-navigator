import {
  createNodeClipboardPayload,
  isClipboardNodeSupported,
  pasteNodeClipboardPayload,
} from '../clipboard'
import { getShortcut } from '../lib/editor/shortcutManager'
import type { Command, CommandContext, CommandPayload } from './types'

function payloadNodeIds(payload?: CommandPayload): string[] | undefined {
  return payload && 'nodeIds' in payload && payload.nodeIds?.length ? payload.nodeIds : undefined
}

function resolveClipboardNodeIds(context: CommandContext, payload?: CommandPayload): string[] {
  const explicitNodeIds = payloadNodeIds(payload)
  const selectionNodeIds = context.selectionManager.getByType('node').map((item) => item.id)
  const ids = explicitNodeIds?.length
    ? explicitNodeIds
    : selectionNodeIds.length > 0
      ? selectionNodeIds
      : context.selectedNodeIds.length > 0
        ? context.selectedNodeIds
        : context.selectedElement?.type === 'node'
          ? [context.selectedElement.id]
          : []
  const valid = new Set(context.activeProcess.nodes.map((node) => node.id))
  const copyable = new Map(context.activeProcess.nodes.map((node) => [node.id, isClipboardNodeSupported(node)]))
  return [...new Set(ids)].filter((id) => valid.has(id) && copyable.get(id))
}

function selectedNodeAndEdgeIds(context: CommandContext): { nodeIds: string[]; edgeIds: string[] } {
  const snapshot = context.selectionManager.getSnapshot()
  const selectedNodeIds = snapshot.items.filter((item) => item.type === 'node').map((item) => item.id)
  const selectedEdgeIds = snapshot.items.filter((item) => item.type === 'edge').map((item) => item.id)
  return {
    nodeIds: selectedNodeIds.length > 0 ? selectedNodeIds : context.selectedNodeIds,
    edgeIds: selectedEdgeIds.length > 0 ? selectedEdgeIds : context.selectedEdgeIds,
  }
}

function pasteClipboardPayload(context: CommandContext, clipboard: NonNullable<ReturnType<CommandContext['clipboard']['get']>>): boolean {
  const pasted = pasteNodeClipboardPayload(clipboard, {
    process: context.activeProcess,
    viewMode: context.viewMode,
  })
  if (pasted.nodes.length === 0) return false

  const savedProcess = context.store.addNodesAndEdges(context.activeScope, pasted.nodes, [])
  const savedLastNode =
    savedProcess?.nodes.find((node) => node.id === pasted.nodes[pasted.nodes.length - 1]?.id)
    ?? pasted.nodes[pasted.nodes.length - 1]
  if (!savedLastNode) return false

  context.setNodeSelection(pasted.nodes.map((node) => node.id), { source: 'clipboard' })
  context.selectNode(savedLastNode)
  context.openPropertyPanel()
  return true
}

export const copyNodesCommand: Command = {
  id: 'copyNodes',
  label: 'Copy Nodes',
  shortcutLabel: getShortcut('copy'),
  canExecute: (context, payload) => context.appMode === 'edit' && resolveClipboardNodeIds(context, payload).length > 0,
  execute: (context, payload) => {
    const nodeIds = resolveClipboardNodeIds(context, payload)
    const clipboard = createNodeClipboardPayload(context.activeProcess, nodeIds)
    if (!clipboard) return false
    context.clipboard.set(clipboard)
    return true
  },
}

export const pasteNodesCommand: Command = {
  id: 'pasteNodes',
  label: 'Paste Nodes',
  shortcutLabel: getShortcut('paste'),
  canExecute: (context) => context.appMode === 'edit' && context.clipboard.get() != null,
  execute: (context) => {
    const clipboard = context.clipboard.get()
    if (!clipboard) return false
    return pasteClipboardPayload(context, clipboard)
  },
}

export const duplicateNodesCommand: Command = {
  id: 'duplicateNodes',
  label: 'Duplicate Nodes',
  shortcutLabel: getShortcut('duplicate'),
  canExecute: (context, payload) => copyNodesCommand.canExecute(context, payload),
  execute: (context, payload) => {
    const nodeIds = resolveClipboardNodeIds(context, payload)
    const clipboard = createNodeClipboardPayload(context.activeProcess, nodeIds)
    if (!clipboard) return false
    context.clipboard.set(clipboard)
    return pasteClipboardPayload(context, clipboard)
  },
}

export const deleteSelectionCommand: Command = {
  id: 'deleteSelection',
  label: 'Delete Selection',
  shortcutLabel: getShortcut('delete'),
  canExecute: (context) => {
    const { nodeIds, edgeIds } = selectedNodeAndEdgeIds(context)
    if (nodeIds.length > 0 || edgeIds.length > 0) return true
    return context.selectedElement?.type === 'node' || context.selectedElement?.type === 'edge'
  },
  execute: (context) => {
    const selected = selectedNodeAndEdgeIds(context)
    const validNodeIds = new Set(context.activeProcess.nodes.map((node) => node.id))
    const protectedNodeIds = new Set(
      context.activeProcess.nodes
        .filter((node) => node.type === 'phase-connector' || node.type === 'merge')
        .map((node) => node.id),
    )
    const validEdgeIds = new Set(context.activeProcess.edges.map((edge) => edge.id))

    const nodeIds = selected.nodeIds.filter((id) => validNodeIds.has(id) && !protectedNodeIds.has(id))
    const edgeIds = selected.edgeIds.filter((id) => validEdgeIds.has(id))

    if (nodeIds.length === 0 && edgeIds.length === 0) {
      if (context.selectedElement?.type === 'node') {
        const node = context.activeProcess.nodes.find((entry) => entry.id === context.selectedElement?.id)
        if (node && node.type !== 'phase-connector' && node.type !== 'merge') nodeIds.push(node.id)
      }
      if (context.selectedElement?.type === 'edge') {
        const edge = context.activeProcess.edges.find((entry) => entry.id === context.selectedElement?.id)
        if (edge) edgeIds.push(edge.id)
      }
    }

    if (nodeIds.length === 0 && edgeIds.length === 0) return false
    context.store.deleteElements(context.activeScope, { nodeIds, edgeIds })
    context.clearSelectedElement()
    context.clearSelection({ source: 'shortcut' })
    return true
  },
}

export const undoCommand: Command = {
  id: 'undo',
  label: 'Undo',
  shortcutLabel: getShortcut('undo'),
  canExecute: () => true,
  execute: (context) => {
    const applied = context.store.undo()
    if (applied) {
      context.clearSelectedElement()
      context.clearSelection({ source: 'shortcut' })
    }
    return applied
  },
}

export const redoCommand: Command = {
  id: 'redo',
  label: 'Redo',
  shortcutLabel: getShortcut('redo'),
  canExecute: () => true,
  execute: (context) => {
    const applied = context.store.redo()
    if (applied) {
      context.clearSelectedElement()
      context.clearSelection({ source: 'shortcut' })
    }
    return applied
  },
}

export const editorCommands: Command[] = [
  copyNodesCommand,
  pasteNodesCommand,
  duplicateNodesCommand,
  deleteSelectionCommand,
  undoCommand,
  redoCommand,
]
