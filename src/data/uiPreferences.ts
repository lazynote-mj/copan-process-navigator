const UI_STORAGE_KEY = 'copan-process-navigator.ui'

export type UiPreferences = {
  viewMode?: 'overview' | 'detail'
  detailProcessId?: string
  selectedGroupId?: string | null
  isLeftOpen?: boolean
  isRightOpen?: boolean
  appMode?: 'view' | 'edit'
}

export function readUiPreferences(): UiPreferences {
  try {
    const raw = localStorage.getItem(UI_STORAGE_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as UiPreferences
  } catch {
    return {}
  }
}

export function writeUiPreferences(prefs: UiPreferences): void {
  try {
    localStorage.setItem(UI_STORAGE_KEY, JSON.stringify(prefs))
  } catch {
    // ignore
  }
}

export function clearUiPreferences(): void {
  try {
    localStorage.removeItem(UI_STORAGE_KEY)
  } catch {
    // ignore
  }
}

/** 업무 데이터 localStorage 키 제거 (legacy draft 정리) */
export function clearLegacyProcessStorage(): void {
  try {
    const keys = Object.keys(localStorage)
    for (const key of keys) {
      if (key.startsWith('copan-process-navigator.') && key !== UI_STORAGE_KEY) {
        localStorage.removeItem(key)
      }
    }
  } catch {
    // ignore
  }
}

export function hasLegacyProcessStorage(): boolean {
  try {
    return Object.keys(localStorage).some(
      (key) => key.startsWith('copan-process-navigator.') && key !== UI_STORAGE_KEY,
    )
  } catch {
    return false
  }
}
