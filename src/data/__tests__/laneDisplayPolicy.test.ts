import { describe, expect, it } from 'vitest'
import { toBeNavigator } from '../toBeNavigatorRegistry'
import { createInitialProcessData } from '../processDataMigration'
import { saveLane, saveProcessLaneDisplay } from '../processDataMutations'
import { getProcessByScope } from '../../types/processData'
import { resolveDetailLayoutLanes } from '../../lib/layout/detailVerticalLayout'
import type { Lane } from '../../types/process'

const baseData = () =>
  createInitialProcessData(toBeNavigator.overview, toBeNavigator.detailProcesses)

// 노드가 전부 사업부(business)에만 있는 단일 레인 프로세스
const SINGLE_LANE_ID = 'service-business-to-expense'
const MULTI_LANE_ID = 'purchase-to-ap-invoice'

describe('Workshop Swimlane 정책 — Detail 기본 lane projection', () => {
  it('laneIds 미설정 단일 레인 프로세스도 기본 5개 lane을 표시한다', () => {
    const data = baseData()
    const process = getProcessByScope(data, SINGLE_LANE_ID)!
    const lanes = resolveDetailLayoutLanes(process, process.nodes)
    expect(lanes.map((lane) => lane.id)).toEqual([
      'business',
      'procurement',
      'logistics',
      'sales',
      'finance',
    ])
  })

  it('명시 laneIds가 일부 lane만 포함해도 일반 Detail Process는 기본 5개 lane을 표시한다', () => {
    // 사업부(노드 있음) + 재무팀(노드 없음) 설정
    const data = saveProcessLaneDisplay(baseData(), SINGLE_LANE_ID, {
      laneIds: ['business', 'finance'],
    })
    const process = getProcessByScope(data, SINGLE_LANE_ID)!
    expect(process.laneIds).toEqual(['business', 'finance'])
    const lanes = resolveDetailLayoutLanes(process, process.nodes)
    expect(lanes.map((lane) => lane.id)).toEqual([
      'business',
      'procurement',
      'logistics',
      'sales',
      'finance',
    ])
  })

  it('설정이 노드 있는 레인만이어도 projection은 기본 5개 lane을 유지한다', () => {
    const data = saveProcessLaneDisplay(baseData(), SINGLE_LANE_ID, { laneIds: ['business'] })
    const process = getProcessByScope(data, SINGLE_LANE_ID)!
    const lanes = resolveDetailLayoutLanes(process, process.nodes)
    expect(lanes.map((lane) => lane.id)).toEqual([
      'business',
      'procurement',
      'logistics',
      'sales',
      'finance',
    ])
  })
})

describe('이슈2 — 신규 레인은 기존 프로세스에 자동 노출되지 않는다', () => {
  const NEW_LANE: Lane = { id: 'lane-new', name: '경영혁신팀', order: 50, ownerDepartment: '경영혁신팀' }

  it('신규 레인 추가 시 detail 프로세스는 현재 표시 레인으로 고정된다', () => {
    const data = baseData()
    const next = saveLane(data, 'overview', NEW_LANE, true)
    for (const inst of next.processes) {
      if (inst.type !== 'detail') continue
      expect(inst.laneIds, `${inst.id} 고정됨`).toBeDefined()
      expect(inst.laneIds, `${inst.id}에 새 레인 미포함`).not.toContain(NEW_LANE.id)
    }
    const resolvedNew = getProcessByScope(next, MULTI_LANE_ID)!
    expect(resolvedNew.lanes.map((l) => l.id)).not.toContain(NEW_LANE.id)
  })

  it('단일 레인 프로세스는 collapse 상태(사용 레인 1개)로 고정된다', () => {
    const next = saveLane(baseData(), 'overview', NEW_LANE, true)
    const single = next.processes.find((p) => p.id === SINGLE_LANE_ID)!
    expect(single.laneIds).toEqual(['business'])
  })

  it('Overview는 마스터 맵이므로 고정하지 않는다 (새 레인 반영)', () => {
    const next = saveLane(baseData(), 'overview', NEW_LANE, true)
    const overview = next.processes.find((p) => p.type === 'overview')!
    expect(overview.laneIds).toBeUndefined()
    const overviewProcess = getProcessByScope(next, 'overview')!
    expect(overviewProcess.lanes.map((l) => l.id)).toContain(NEW_LANE.id)
  })

  it('이미 laneIds가 있는 프로세스는 변경하지 않는다', () => {
    const data = saveProcessLaneDisplay(baseData(), MULTI_LANE_ID, { laneIds: ['business', 'finance'] })
    const before = data.processes.find((p) => p.id === MULTI_LANE_ID)!.laneIds
    const next = saveLane(data, 'overview', NEW_LANE, true)
    const after = next.processes.find((p) => p.id === MULTI_LANE_ID)!.laneIds
    expect(after).toEqual(before)
    expect(after).not.toContain(NEW_LANE.id)
  })

  it('기존 레인 수정(isNew=false)은 프로세스를 고정하지 않는다', () => {
    const data = baseData()
    const renamed: Lane = { ...data.commonMasters.lanes[0], name: '사업부 수정' }
    const next = saveLane(data, 'overview', renamed, false)
    const detail = next.processes.find((p) => p.id === MULTI_LANE_ID)!
    expect(detail.laneIds).toBeUndefined()
  })
})
