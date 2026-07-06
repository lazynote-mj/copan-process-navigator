import { describe, expect, it } from 'vitest'
import { toBeNavigator } from '../toBeNavigatorRegistry'
import {
  PROCESS_LIFECYCLE_GROUPS,
  getLifecycleGroupForDetailProcess,
  resolveLifecycleGroupForDetailGroup,
} from '../processLifecycleGroups'
import { cloneDetailProcess } from '../processDataMutations'
import { createInitialProcessData } from '../processDataMigration'

describe('resolveLifecycleGroupForDetailGroup', () => {
  it('그룹 데이터의 lifecycleGroupId가 기본 분류보다 우선한다', () => {
    const resolved = resolveLifecycleGroupForDetailGroup({
      detailProcessId: 'purchase-to-ap-invoice', // 기본 분류: 구매/입고
      lifecycleGroupId: 'settlement',
    })
    expect(resolved.id).toBe('settlement')
  })

  it('lifecycleGroupId가 없으면 appConfig 기본 분류를 따른다', () => {
    const resolved = resolveLifecycleGroupForDetailGroup({
      detailProcessId: 'purchase-to-ap-invoice',
    })
    expect(resolved.id).toBe('purchase-inbound')
  })

  it('알 수 없는 lifecycleGroupId는 기본 분류로 fallback한다', () => {
    const resolved = resolveLifecycleGroupForDetailGroup({
      detailProcessId: 'purchase-to-ap-invoice',
      lifecycleGroupId: 'no-such-group' as never,
    })
    expect(resolved.id).toBe('purchase-inbound')
  })

  it('기본 분류에도 없는 신규 프로세스는 첫 카테고리로 fallback한다', () => {
    const resolved = resolveLifecycleGroupForDetailGroup({ detailProcessId: 'brand-new-process' })
    expect(resolved.id).toBe(PROCESS_LIFECYCLE_GROUPS[0].id)
    expect(getLifecycleGroupForDetailProcess('brand-new-process').id).toBe(
      PROCESS_LIFECYCLE_GROUPS[0].id,
    )
  })
})

describe('cloneDetailProcess — 카테고리 승계', () => {
  const baseData = () =>
    createInitialProcessData(toBeNavigator.overview, toBeNavigator.detailProcesses)

  it('복제본 그룹은 원본의 카테고리를 lifecycleGroupId로 명시 승계한다', () => {
    const result = cloneDetailProcess(baseData(), 'purchase-to-ap-invoice', '구매 복제 테스트')
    const group = result.data.detailProcessGroups?.find((entry) => entry.id === result.groupId)
    expect(group?.lifecycleGroupId).toBe('purchase-inbound')
    expect(resolveLifecycleGroupForDetailGroup(group!).id).toBe('purchase-inbound')
  })

  it('데이터 필드로 분류가 지정된 프로세스를 복제하면 그 값을 승계한다', () => {
    const first = cloneDetailProcess(baseData(), 'purchase-to-ap-invoice', '1차 복제')
    const firstGroup = first.data.detailProcessGroups?.find((entry) => entry.id === first.groupId)
    const moved = {
      ...first.data,
      detailProcessGroups: first.data.detailProcessGroups?.map((entry) =>
        entry.id === first.groupId ? { ...entry, lifecycleGroupId: 'settlement' as const } : entry,
      ),
    }
    const second = cloneDetailProcess(moved, firstGroup!.detailProcessId, '2차 복제')
    const secondGroup = second.data.detailProcessGroups?.find((entry) => entry.id === second.groupId)
    expect(secondGroup?.lifecycleGroupId).toBe('settlement')
  })
})
