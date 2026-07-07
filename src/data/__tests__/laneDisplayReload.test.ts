import { describe, expect, it } from 'vitest'
import { toBeNavigator } from '../toBeNavigatorRegistry'
import { createInitialProcessData } from '../processDataMigration'
import { saveProcessLaneDisplay } from '../processDataMutations'
import { mergeMissingDetailProcesses, ensureDetailProcessInStore } from '../activeProcessData'

/**
 * 회귀 테스트 — 전체 저장 후 리로드(registry 병합)에서 프로세스별 표시
 * 레인 설정이 사라지던 버그. registry와 노드가 다른 프로세스는 병합 시
 * registry로 재구성되는데, laneIds/autoHideEmptyLanes(사용자 설정)를
 * zones처럼 보존해야 한다.
 */
describe('레인 표시 설정 리로드 보존', () => {
  const baseData = () =>
    createInitialProcessData(toBeNavigator.overview, toBeNavigator.detailProcesses)
  const registry = toBeNavigator.detailProcesses
  const DETAIL_ID = 'purchase-to-ap-invoice'

  it('노드가 registry와 다른 프로세스도 리로드 후 laneIds가 유지된다', () => {
    let data = saveProcessLaneDisplay(baseData(), DETAIL_ID, { laneIds: ['business', 'finance'] })
    // registry 대비 노드를 하나 추가해 divergence 유발 → 병합 시 재구성 대상이 됨
    data = {
      ...data,
      processes: data.processes.map((p) =>
        p.id === DETAIL_ID
          ? { ...p, nodes: [...p.nodes, { ...p.nodes[0], id: `${p.nodes[0].id}-extra` }] }
          : p,
      ),
    }
    const before = data.processes.find((p) => p.id === DETAIL_ID)
    // 노드 레인 자동 포함으로 서브셋이 저장됨 (전체보다 작음)
    expect(before?.laneIds).toBeDefined()
    expect(before!.laneIds!.length).toBeLessThan(data.commonMasters.lanes.length)

    const reloaded = mergeMissingDetailProcesses(data, registry)
    const after = reloaded.processes.find((p) => p.id === DETAIL_ID)
    // 리로드 후에도 저장된 laneIds가 그대로 보존
    expect(after?.laneIds).toEqual(before?.laneIds)
  })

  it('autoHideEmptyLanes도 리로드 후 유지된다', () => {
    const data = saveProcessLaneDisplay(baseData(), DETAIL_ID, { autoHideEmptyLanes: true })
    const reloaded = mergeMissingDetailProcesses(data, registry)
    const after = reloaded.processes.find((p) => p.id === DETAIL_ID)
    expect(after?.autoHideEmptyLanes).toBe(true)
  })

  it('ensureDetailProcessInStore 재구성 시에도 laneIds가 보존된다', () => {
    const data = saveProcessLaneDisplay(baseData(), DETAIL_ID, { laneIds: ['business'] })
    const current = data.processes.find((p) => p.id === DETAIL_ID)!
    expect(current.laneIds).toBeDefined()
    // 노드를 하나 빼 divergence 유발 → ensureDetailProcessInStore가 registry로 재구성
    const diverged = {
      ...data,
      processes: data.processes.map((p) =>
        p.id === DETAIL_ID ? { ...current, nodes: current.nodes.slice(0, -1) } : p,
      ),
    }
    const registryProcess = registry.find((p) => p.id === DETAIL_ID)!
    const synced = ensureDetailProcessInStore(diverged, DETAIL_ID, registryProcess)
    const after = synced.processes.find((p) => p.id === DETAIL_ID)
    // registry canonical에는 laneIds가 없지만 current 설정이 보존되어야 함
    expect(after?.laneIds).toEqual(current.laneIds)
  })
})
