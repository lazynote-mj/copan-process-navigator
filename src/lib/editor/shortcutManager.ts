export type ShortcutPlatform = 'mac' | 'windows' | 'linux'

export type BuiltInShortcutId =
  | 'copy'
  | 'paste'
  | 'delete'
  | 'undo'
  | 'redo'
  | 'selectAll'
  | 'duplicate'
  | 'addEdge'

export type ShortcutId = BuiltInShortcutId | (string & {})

export type ShortcutDefinition = {
  id: ShortcutId
  mac: string[]
  windows: string[]
  linux?: string[]
  label: string
}

const SHORTCUTS: ShortcutDefinition[] = [
  { id: 'copy', label: 'Copy', mac: ['Meta+C', 'Ctrl+C'], windows: ['Ctrl+C'] },
  { id: 'paste', label: 'Paste', mac: ['Meta+V', 'Ctrl+V'], windows: ['Ctrl+V'] },
  { id: 'delete', label: 'Delete', mac: ['Delete', 'Backspace'], windows: ['Delete', 'Backspace'] },
  { id: 'undo', label: 'Undo', mac: ['Meta+Z', 'Ctrl+Z'], windows: ['Ctrl+Z'] },
  {
    id: 'redo',
    label: 'Redo',
    mac: ['Shift+Meta+Z', 'Ctrl+Y', 'Shift+Ctrl+Z'],
    windows: ['Ctrl+Y', 'Shift+Ctrl+Z'],
  },
  { id: 'selectAll', label: 'Select All', mac: ['Meta+A'], windows: ['Ctrl+A'] },
  { id: 'duplicate', label: 'Duplicate', mac: ['Meta+D', 'Ctrl+D'], windows: ['Ctrl+D'] },
  { id: 'addEdge', label: 'Add Edge', mac: ['Meta+L'], windows: ['Ctrl+L'] },
]

const shortcutById = new Map<string, ShortcutDefinition>(SHORTCUTS.map((shortcut) => [shortcut.id, shortcut]))

export function registerShortcut(definition: ShortcutDefinition): void {
  shortcutById.set(definition.id, definition)
}

export function resolveShortcutPlatform(): ShortcutPlatform {
  const platform = globalThis.navigator?.platform?.toLowerCase() ?? ''
  const userAgent = globalThis.navigator?.userAgent?.toLowerCase() ?? ''
  if (platform.includes('mac') || userAgent.includes('mac os')) return 'mac'
  if (platform.includes('win') || userAgent.includes('windows')) return 'windows'
  return 'linux'
}

export function getShortcutDefinition(id: ShortcutId): ShortcutDefinition {
  const shortcut = shortcutById.get(id)
  if (!shortcut) throw new Error(`Unknown shortcut: ${id}`)
  return shortcut
}

function definitionsForPlatform(definition: ShortcutDefinition, platform = resolveShortcutPlatform()): string[] {
  if (platform === 'mac') return definition.mac
  if (platform === 'linux') return definition.linux ?? definition.windows
  return definition.windows
}

function formatChord(chord: string, platform: ShortcutPlatform): string {
  const parts = chord.split('+')
  if (platform === 'mac') {
    return parts
      .map((part) => {
        if (part === 'Meta') return '⌘'
        if (part === 'Shift') return '⇧'
        if (part === 'Ctrl') return '⌃'
        if (part === 'Alt') return '⌥'
        if (part === 'Backspace') return '⌫'
        return part
      })
      .join('')
  }
  return parts
    .map((part) => {
      if (part === 'Ctrl') return 'Ctrl'
      if (part === 'Shift') return 'Shift'
      if (part === 'Meta') return 'Meta'
      if (part === 'Alt') return 'Alt'
      return part
    })
    .join('+')
}

export function getShortcut(id: ShortcutId, platform = resolveShortcutPlatform()): string {
  return formatChord(definitionsForPlatform(getShortcutDefinition(id), platform)[0] ?? '', platform)
}

function normalizeEventKey(event: KeyboardEvent): string {
  if (event.key === ' ') return 'Space'
  if (event.key === 'Esc') return 'Escape'
  if (event.key.length === 1) return event.key.toUpperCase()
  return event.key
}

function eventMatchesChord(event: KeyboardEvent, chord: string): boolean {
  const parts = new Set(chord.split('+'))
  const key = [...parts].find((part) => !['Meta', 'Ctrl', 'Shift', 'Alt'].includes(part))
  if (!key || normalizeEventKey(event) !== key) return false
  return (
    event.metaKey === parts.has('Meta') &&
    event.ctrlKey === parts.has('Ctrl') &&
    event.shiftKey === parts.has('Shift') &&
    event.altKey === parts.has('Alt')
  )
}

export function isShortcutEvent(
  event: KeyboardEvent,
  id: ShortcutId,
  platform = resolveShortcutPlatform(),
): boolean {
  return definitionsForPlatform(getShortcutDefinition(id), platform).some((chord) => eventMatchesChord(event, chord))
}

export function isEditableShortcutTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null
  if (!element) return false
  const editable = element.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]')
  return Boolean(editable)
}
