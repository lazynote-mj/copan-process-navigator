import type { ProcessData } from '../types/processData'
import { loadRemoteProcessData, saveRemoteProcessData } from './processDataRemote'

export type ProcessStorageLoadResult = {
  data: ProcessData | null
  source: ProcessData['dataSource']
}

export type ProcessStorageAdapter = {
  id: string
  label: string
  // TODO: TemplateRuntime 단계에서 manifest/capabilities 조회를 선택 기능으로 확장한다.
  load: () => Promise<ProcessStorageLoadResult>
  save: (data: ProcessData) => Promise<ProcessData>
}

export const localJsonProcessStorage: ProcessStorageAdapter = {
  id: 'local-json',
  label: 'Local JSON',
  async load() {
    const data = await loadRemoteProcessData()
    return {
      data,
      source: data?.dataSource ?? 'project-json',
    }
  },
  save: saveRemoteProcessData,
}
