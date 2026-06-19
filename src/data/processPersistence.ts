import { clearLegacyProcessStorage, clearUiPreferences } from './uiPreferences'

export {
  type ProcessDataFilePayload as WorkingStateFilePayload,
  parseProcessDataFile as parseWorkingStateFile,
  processDataToFilePayload as buildWorkingStateFilePayload,
  downloadProcessDataJson as downloadWorkingStatePayload,
} from './processDataIO'

/** legacy no-op — 업무 데이터 localStorage 저장 금지 */
export function saveWorkingState(): void {}
export function saveLocalDraft(): void {}
export function readLocalDraft(): null {
  return null
}

export function clearPersistedWorkingState(): void {
  clearLegacyProcessStorage()
  clearUiPreferences()
}
