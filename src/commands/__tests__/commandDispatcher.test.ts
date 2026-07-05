import { describe, expect, it, vi } from 'vitest'
import { createCommandDispatcher } from '../commandDispatcher'
import { createCommandRegistry } from '../commandRegistry'
import type { Command, CommandContext } from '../types'

function makeCommand(overrides: Partial<Command>): Command {
  return {
    id: 'copyNodes',
    label: 'Test Command',
    canExecute: () => true,
    execute: () => true,
    ...overrides,
  }
}

const fakeContext = () => ({}) as CommandContext

describe('command dispatcher permission gating', () => {
  it('permission이 없는 command는 permission 검사 없이 실행된다', () => {
    const execute = vi.fn(() => true)
    const dispatcher = createCommandDispatcher(
      createCommandRegistry([makeCommand({ execute })]),
      fakeContext,
      { hasPermission: () => false },
    )
    expect(dispatcher.canExecute('copyNodes')).toBe(true)
    expect(dispatcher.execute('copyNodes')).toBe(true)
    expect(execute).toHaveBeenCalled()
  })

  it('permission이 거부되면 canExecute/execute 모두 차단된다', () => {
    const execute = vi.fn(() => true)
    const dispatcher = createCommandDispatcher(
      createCommandRegistry([makeCommand({ permission: 'edit-node-edge', execute })]),
      fakeContext,
      { hasPermission: () => false },
    )
    expect(dispatcher.canExecute('copyNodes')).toBe(false)
    expect(dispatcher.execute('copyNodes')).toBe(false)
    expect(execute).not.toHaveBeenCalled()
  })

  it('permission이 허용되면 command 자체 canExecute로 넘어간다', () => {
    const dispatcher = createCommandDispatcher(
      createCommandRegistry([
        makeCommand({ permission: 'edit-node-edge', canExecute: () => false }),
      ]),
      fakeContext,
      { hasPermission: (p) => p === 'edit-node-edge' },
    )
    expect(dispatcher.canExecute('copyNodes')).toBe(false)
    const allowed = createCommandDispatcher(
      createCommandRegistry([makeCommand({ permission: 'edit-node-edge' })]),
      fakeContext,
      { hasPermission: (p) => p === 'edit-node-edge' },
    )
    expect(allowed.canExecute('copyNodes')).toBe(true)
  })

  it('등록되지 않은 command는 실행되지 않는다', () => {
    const dispatcher = createCommandDispatcher(createCommandRegistry([]), fakeContext)
    expect(dispatcher.canExecute('undo')).toBe(false)
    expect(dispatcher.execute('undo')).toBe(false)
  })
})
