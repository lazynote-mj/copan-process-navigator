import type { Command, CommandId } from './types'

export type CommandRegistry = {
  get: (id: CommandId) => Command | undefined
  list: () => Command[]
}

export function createCommandRegistry(commands: Command[]): CommandRegistry {
  const byId = new Map<CommandId, Command>()
  for (const command of commands) {
    byId.set(command.id, command)
  }

  return {
    get: (id) => byId.get(id),
    list: () => [...byId.values()],
  }
}
