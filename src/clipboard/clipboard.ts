import type { ClipboardPayload } from './types'

export type PlatformClipboard = {
  get: () => ClipboardPayload | null
  set: (payload: ClipboardPayload | null) => void
  clear: () => void
}

export function createPlatformClipboard(initialPayload: ClipboardPayload | null = null): PlatformClipboard {
  let current = initialPayload

  return {
    get: () => current,
    set: (payload) => {
      current = payload
    },
    clear: () => {
      current = null
    },
  }
}
