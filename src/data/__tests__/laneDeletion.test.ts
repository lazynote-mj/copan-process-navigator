import { describe, expect, it } from 'vitest'
import { toBeNavigator } from '../toBeNavigatorRegistry'
import { createInitialProcessData } from '../processDataMigration'
import { deleteLane, saveLane, saveProcessLaneIds } from '../processDataMutations'
import { canDeleteLaneAcrossProcesses } from '../../lib/editor/processEditor'
import type { Lane } from '../../types/process'

const baseData = () =>
  createInitialProcessData(toBeNavigator.overview, toBeNavigator.detailProcesses)

const NEW_LANE: Lane = {
  id: 'test-empty-lane',
  name: '테스트 빈 레인',
  order: 99,
  ownerDepartment: '테스트',
}

describe('스윔레인 삭제 — 전역 참조 가드', () => {
  it('다른 프로세스에 노드가 있는 레인은 canDeleteLaneAcrossProcesses가 차단한다', () => {
    const data = baseData()
    // finance 레인은 여러 프로세스에서 사용 중
    const result = canDeleteLaneAcrossProcesses(data.processes, 'finance')
    expect(result.ok).toBe(false)
    expect(result.ok === false && result.message).toContain('삭제할 수 없습니다')
  })

  it('어떤 프로세스도 쓰지 않는 레인은 삭제 가능 판정을 받는다', () => {
    const data = saveLane(baseData(), 'overview', NEW_LANE, true)
    expect(canDeleteLaneAcrossProcesses(data.processes, NEW_LANE.id).ok).toBe(true)
  })

  it('deleteLane mutation은 참조 중인 레인 삭제를 거부한다 (최종 방어)', () => {
    const data = baseData()
    const next = deleteLane(data, 'overview', 'finance')
    expect(next.commonMasters.lanes.some((lane) => lane.id === 'finance')).toBe(true)
  })

  it('빈 레인은 삭제되고, 프로세스 laneIds에 남은 참조도 정리된다', () => {
    let data = saveLane(baseData(), 'overview', NEW_LANE, true)
    // 한 프로세스의 표시 레인에 새 레인만 지정 — 노드 레인은 자동 포함되고
    // 미사용 레인(예: 판매현장)이 빠져 서브셋으로 저장된다
    const target = 'purchase-to-ap-invoice'
    data = saveProcessLaneIds(data, target, [NEW_LANE.id])
    const before = data.processes.find((entry) => entry.id === target)!
    expect(before.laneIds).toContain(NEW_LANE.id)

    const next = deleteLane(data, 'overview', NEW_LANE.id)
    expect(next.commonMasters.lanes.some((lane) => lane.id === NEW_LANE.id)).toBe(false)
    const after = next.processes.find((entry) => entry.id === target)!
    expect(after.laneIds ?? []).not.toContain(NEW_LANE.id)
  })
})
