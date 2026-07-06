import { describe, expect, it } from 'vitest'
import { toBeNavigator } from '../toBeNavigatorRegistry'
import { createInitialProcessData } from '../processDataMigration'
import { saveProcessLaneIds } from '../processDataMutations'
import { getProcessByScope, resolveProcessWithMasters } from '../../types/processData'

const baseData = () =>
  createInitialProcessData(toBeNavigator.overview, toBeNavigator.detailProcesses)

const DETAIL_ID = 'purchase-to-ap-invoice'

describe('프로세스별 표시 레인 (laneIds)', () => {
  it('laneIds 미지정 시 마스터 전체 레인을 표시한다', () => {
    const data = baseData()
    const process = getProcessByScope(data, DETAIL_ID)
    expect(process?.lanes.map((lane) => lane.id)).toEqual(
      data.commonMasters.lanes.map((lane) => lane.id),
    )
  })

  it('laneIds 서브셋은 마스터 순서를 유지하며 필터링된다', () => {
    const data = baseData()
    const instance = data.processes.find((entry) => entry.id === DETAIL_ID)!
    const resolved = resolveProcessWithMasters(
      { ...instance, laneIds: ['finance', 'business'] },
      data.commonMasters,
    )
    // 마스터 order: business(1) → finance(5)
    expect(resolved.lanes.map((lane) => lane.id)).toEqual(['business', 'finance'])
    expect(resolved.laneIds).toEqual(['finance', 'business'])
  })

  it('무효한 laneIds만 있으면 전체 레인으로 안전 fallback한다', () => {
    const data = baseData()
    const instance = data.processes.find((entry) => entry.id === DETAIL_ID)!
    const resolved = resolveProcessWithMasters(
      { ...instance, laneIds: ['no-such-lane'] },
      data.commonMasters,
    )
    expect(resolved.lanes.length).toBe(data.commonMasters.lanes.length)
  })

  it('saveProcessLaneIds — 노드가 배치된 레인은 해제해도 자동 포함된다', () => {
    const data = baseData()
    const instance = data.processes.find((entry) => entry.id === DETAIL_ID)!
    const usedLaneIds = new Set(instance.nodes.map((node) => node.laneId))
    expect(usedLaneIds.size).toBeGreaterThan(0)

    const next = saveProcessLaneIds(data, DETAIL_ID, [])
    const saved = next.processes.find((entry) => entry.id === DETAIL_ID)!
    for (const laneId of usedLaneIds) {
      expect(saved.laneIds, `${laneId} 자동 포함`).toContain(laneId)
    }
  })

  it('saveProcessLaneIds — 전체 레인 선택이면 필드를 제거한다', () => {
    const data = baseData()
    const allLaneIds = data.commonMasters.lanes.map((lane) => lane.id)
    const next = saveProcessLaneIds(data, DETAIL_ID, allLaneIds)
    const saved = next.processes.find((entry) => entry.id === DETAIL_ID)!
    expect(saved.laneIds).toBeUndefined()
  })

  it('saveProcessLaneIds — undefined는 필드를 제거해 전체 표시로 되돌린다', () => {
    const data = baseData()
    const subset = saveProcessLaneIds(data, DETAIL_ID, ['business'])
    const restored = saveProcessLaneIds(subset, DETAIL_ID, undefined)
    const saved = restored.processes.find((entry) => entry.id === DETAIL_ID)!
    expect(saved.laneIds).toBeUndefined()
  })
})
