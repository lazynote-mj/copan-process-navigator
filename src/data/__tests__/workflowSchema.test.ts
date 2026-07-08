import { describe, expect, it } from 'vitest'
import { toBeNavigator } from '../toBeNavigatorRegistry'
import {
  createInitialProcessData,
  buildProcessDataFromPayload,
  processDataToFilePayload,
} from '../processDataMigration'
import { mergeMissingDetailProcesses } from '../activeProcessData'
import { saveDetailProcessGroup, saveProcessLaneDisplay } from '../processDataMutations'
import type { ProcessDataFilePayload } from '../processDataIO'
import type { ProcessData } from '../../types/processData'
import type { Workflow } from '../../types/workflow'
import type { DetailProcessGroup } from '../../types/toBeNavigator'

const baseData = () =>
  createInitialProcessData(toBeNavigator.overview, toBeNavigator.detailProcesses)

const registry = toBeNavigator.detailProcesses
const DETAIL_ID = 'purchase-to-ap-invoice'

const SAMPLE_WORKFLOW: Workflow = {
  workflowId: 'wf-purchase-to-ap',
  workflowName: '구매요청 → 입고 → 매입전표',
  category: 'purchase-inbound',
  status: 'active',
  steps: ['구매요청', '입고', '매입전표'],
  order: 1,
}

/** payload → ProcessData → payload 라운드트립 (export/import 재현) */
const roundtrip = (data: ReturnType<typeof baseData>) =>
  buildProcessDataFromPayload(
    processDataToFilePayload(data) as ProcessDataFilePayload,
    'server-json',
  )

describe('Workflow 스키마 — payload 하위호환 & 유실 방지', () => {
  it('1. workflows[]가 저장 → 로드 → export/import 라운드트립에서 유지된다', () => {
    const data = { ...baseData(), workflows: [SAMPLE_WORKFLOW] }
    const payload = processDataToFilePayload(data)
    // 최상위 배열이며 commonMasters에 없음 (O3)
    expect(payload.workflows).toEqual([SAMPLE_WORKFLOW])
    expect((payload.commonMasters as Record<string, unknown>).workflows).toBeUndefined()

    const reloaded = roundtrip(data)
    expect(reloaded.workflows).toEqual([SAMPLE_WORKFLOW])
  })

  it('2. workflowId / variantLabel / variantId가 그룹 저장 후 reload에서 유지된다', () => {
    let data = baseData()
    const group = data.detailProcessGroups?.find((g) => g.detailProcessId === DETAIL_ID)
    expect(group).toBeDefined()
    const updated: DetailProcessGroup = {
      ...group!,
      workflowId: 'wf-purchase-to-ap',
      variantLabel: '제/상품',
      variantId: 'var-goods',
      variantOrder: 1,
    }
    data = saveDetailProcessGroup(data, updated)

    const reloaded = roundtrip(data)
    const after = reloaded.detailProcessGroups?.find((g) => g.id === updated.id)
    expect(after?.workflowId).toBe('wf-purchase-to-ap')
    expect(after?.variantLabel).toBe('제/상품')
    expect(after?.variantId).toBe('var-goods')
    expect(after?.variantOrder).toBe(1)
  })

  it('3. mergeMissingDetailProcesses 과정에서 workflows[]와 그룹 필드가 유실되지 않는다', () => {
    let data: ProcessData = { ...baseData(), workflows: [SAMPLE_WORKFLOW] }
    const group = data.detailProcessGroups!.find((g) => g.detailProcessId === DETAIL_ID)!
    data = saveDetailProcessGroup(data, {
      ...group,
      workflowId: 'wf-purchase-to-ap',
      variantLabel: '제/상품',
    })
    // registry와 노드가 다르도록 divergence 유발 (재구성 경로 진입)
    data = {
      ...data,
      processes: data.processes.map((p) =>
        p.id === DETAIL_ID
          ? { ...p, nodes: [...p.nodes, { ...p.nodes[0], id: `${p.nodes[0].id}-extra` }] }
          : p,
      ),
    }

    const merged = mergeMissingDetailProcesses(data, registry)
    expect(merged.workflows).toEqual([SAMPLE_WORKFLOW])
    const g = merged.detailProcessGroups?.find((x) => x.id === group.id)
    expect(g?.workflowId).toBe('wf-purchase-to-ap')
    expect(g?.variantLabel).toBe('제/상품')
  })

  it('4. workflows[]가 없는 기존 payload도 정상 로드된다 (하위호환)', () => {
    const payload = processDataToFilePayload(baseData())
    // 기존 파일 재현 — workflows 필드 제거
    delete (payload as { workflows?: unknown }).workflows
    expect('workflows' in payload).toBe(false)

    const loaded = buildProcessDataFromPayload(payload as ProcessDataFilePayload, 'server-json')
    expect(loaded.workflows).toBeUndefined()
    expect(loaded.processes.length).toBeGreaterThan(0)
    expect(loaded.detailProcessGroups?.length).toBeGreaterThan(0)
  })

  it('5. 기존 laneIds 보존이 workflows 추가 후에도 유지된다 (회귀)', () => {
    let data: ProcessData = { ...baseData(), workflows: [SAMPLE_WORKFLOW] }
    data = saveProcessLaneDisplay(data, DETAIL_ID, { laneIds: ['business', 'finance'] })
    const before = data.processes.find((p) => p.id === DETAIL_ID)
    expect(before?.laneIds).toBeDefined()

    // divergence 유발 후 registry 병합 — laneIds + workflows 동시 보존 확인
    data = {
      ...data,
      processes: data.processes.map((p) =>
        p.id === DETAIL_ID
          ? { ...p, nodes: [...p.nodes, { ...p.nodes[0], id: `${p.nodes[0].id}-x` }] }
          : p,
      ),
    }
    const merged = mergeMissingDetailProcesses(data, registry)
    const after = merged.processes.find((p) => p.id === DETAIL_ID)
    expect(after?.laneIds).toEqual(before?.laneIds)
    expect(merged.workflows).toEqual([SAMPLE_WORKFLOW])
  })
})
