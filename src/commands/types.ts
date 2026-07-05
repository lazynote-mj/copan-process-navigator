import type { ClipboardPayload } from '../clipboard'
import type { NavigatorPermission } from '../config/roleConfig'
import type { ProcessDataStoreValue } from '../data/processDataStore'
import type { SelectedElement } from '../lib/editor/selectionTypes'
import type { AppMode } from '../lib/editor/selectionTypes'
import type { ViewMode } from '../lib/editor/viewModeTypes'
import type { SelectionChangeOptions, SelectionManager } from '../selection'
import type { Node, Process } from '../types/process'
import type { ProcessScope } from '../types/processData'

export type CommandId =
  | 'copyNodes'
  | 'pasteNodes'
  | 'duplicateNodes'
  | 'deleteSelection'
  | 'undo'
  | 'redo'

export type CommandPayload =
  | {
      nodeIds?: string[]
    }
  | undefined

export type CommandClipboard = {
  get: () => ClipboardPayload | null
  set: (payload: ClipboardPayload | null) => void
}

export type CommandContext = {
  appMode: AppMode
  viewMode: ViewMode
  activeProcess: Process
  activeScope: ProcessScope
  selectedElement: SelectedElement | null
  selectedNodeIds: string[]
  selectedEdgeIds: string[]
  selectionManager: SelectionManager
  clipboard: CommandClipboard
  store: ProcessDataStoreValue
  setNodeSelection: (
    nodeIds: string[],
    options?: SelectionChangeOptions,
  ) => { nodeIds: string[]; primaryNodeId: string | null } | void
  clearSelection: (options?: SelectionChangeOptions) => void
  selectNode: (node: Node) => void
  clearSelectedElement: () => void
  openPropertyPanel: () => void
}

export type Command = {
  id: CommandId
  label: string
  shortcutLabel?: string
  /** 실행에 필요한 permission — dispatcher가 현재 Role 기준으로 검사한다 */
  permission?: NavigatorPermission
  canExecute: (context: CommandContext, payload?: CommandPayload) => boolean
  execute: (context: CommandContext, payload?: CommandPayload) => boolean
}
