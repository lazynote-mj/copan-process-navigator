import type { CommandId, CommandPayload, CommandContext } from './types'
import type { CommandRegistry } from './commandRegistry'

export type CommandDispatcher = {
  canExecute: (id: CommandId, payload?: CommandPayload) => boolean
  execute: (id: CommandId, payload?: CommandPayload) => boolean
}

export function createCommandDispatcher(
  registry: CommandRegistry,
  getContext: () => CommandContext,
): CommandDispatcher {
  return {
    canExecute: (id, payload) => {
      const command = registry.get(id)
      return command ? command.canExecute(getContext(), payload) : false
    },
    execute: (id, payload) => {
      const command = registry.get(id)
      if (!command) return false
      const context = getContext()
      if (!command.canExecute(context, payload)) return false
      return command.execute(context, payload)
    },
  }
}
