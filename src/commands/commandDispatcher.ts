import { can } from '../config/appConfig'
import type { NavigatorPermission } from '../config/roleConfig'
import type { CommandId, CommandPayload, CommandContext } from './types'
import type { CommandRegistry } from './commandRegistry'

export type CommandDispatcher = {
  canExecute: (id: CommandId, payload?: CommandPayload) => boolean
  execute: (id: CommandId, payload?: CommandPayload) => boolean
}

export type CommandDispatcherOptions = {
  /** permission 검사 주입점 — 기본은 배포 Role 기준 can() */
  hasPermission?: (permission: NavigatorPermission) => boolean
}

export function createCommandDispatcher(
  registry: CommandRegistry,
  getContext: () => CommandContext,
  options?: CommandDispatcherOptions,
): CommandDispatcher {
  const hasPermission = options?.hasPermission ?? can
  return {
    canExecute: (id, payload) => {
      const command = registry.get(id)
      if (!command) return false
      if (command.permission && !hasPermission(command.permission)) return false
      return command.canExecute(getContext(), payload)
    },
    execute: (id, payload) => {
      const command = registry.get(id)
      if (!command) return false
      if (command.permission && !hasPermission(command.permission)) return false
      const context = getContext()
      if (!command.canExecute(context, payload)) return false
      return command.execute(context, payload)
    },
  }
}
