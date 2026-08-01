import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { toBeNavigator } from '../../../../data/toBeNavigatorRegistry'
import { hydrateProcessData } from '../../../../data/processDataStore'
import { getProcessByScope, OVERVIEW_SCOPE, type ProcessData } from '../../../../types/processData'
import type { LayoutOptions } from '../../elkLayout'
import type { LayoutCase } from './layoutCases'

/**
 * 앱이 실제로 렌더하는 데이터로 만든 레이아웃 케이스.
 *
 * `layoutCases`는 번들된 registry(`src/data/processes/*.json`)를 본다. 그런데 앱은
 * `public/process-data/state.json`을 읽어 `hydrateProcessData`를 거친 결과를 렌더한다.
 * 두 데이터는 갈라져 있다 — state.json에는 편집기에서 만든 프로세스가 더 있고
 * 좌표·핸들도 저장된 값이 우선한다. registry만 검증하면 사용자가 보는 화면의
 * 회귀를 놓친다.
 *
 * 로드 경로는 앱과 동일하게 `hydrateProcessData`를 그대로 쓴다. 재구현하면
 * registry sync와 Execution Domain 정규화가 빠져 앱과 다른 것을 재게 된다.
 */

const STATE_PATH = resolve(process.cwd(), 'public/process-data/state.json')

function loadRuntimeProcessData(): ProcessData | null {
  let raw: string
  try {
    raw = readFileSync(STATE_PATH, 'utf-8')
  } catch {
    // state.json이 없는 환경(클린 체크아웃 직후 등)에서는 런타임 케이스를 건너뛴다.
    return null
  }
  return hydrateProcessData(JSON.parse(raw) as ProcessData, toBeNavigator.detailProcesses)
}

const runtimeData = loadRuntimeProcessData()

/**
 * state.json이 없으면 빈 배열 — 호출부가 `describe.skipIf`로 건너뛴다.
 *
 * 저장된 인스턴스는 lane을 `laneIds`로만 갖고 있고 실제 lane은 `commonMasters`에
 * 있다. 앱과 동일하게 `getProcessByScope`(내부에서 `resolveProcessWithMasters`
 * 호출)로 해석해야 레이아웃이 돈다.
 */
export const runtimeLayoutCases: LayoutCase[] = (runtimeData?.processes ?? [])
  .map((instance) => {
    const isOverview = instance.type === 'overview'
    const scope = isOverview ? OVERVIEW_SCOPE : instance.id
    const process = runtimeData ? getProcessByScope(runtimeData, scope) : undefined
    if (!process) return null
    return {
      name: instance.id,
      process,
      options: (isOverview
        ? { overviewVertical: true }
        : { detailHorizontal: true }) as LayoutOptions,
    }
  })
  .filter((entry): entry is LayoutCase => entry !== null)

export const runtimeStateAvailable = runtimeData !== null
