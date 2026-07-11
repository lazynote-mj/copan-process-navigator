import { describe, expect, it } from 'vitest'
import {
  buildNewDetailProcessGroupSelection,
  resolveCreationWorkflowId,
} from '../selectedElement'
import { saveDetailProcessGroup } from '../../../data/processDataMutations'
import {
  buildWorkflowSections,
  UNCLASSIFIED_WORKFLOW_KEY,
} from '../../sidebar/workflowSections'
import type { DetailProcessGroup } from '../../../types/toBeNavigator'
import type { Workflow } from '../../../types/workflow'
import type { Process } from '../../../types/process'
import type { ProcessData } from '../../../types/processData'

/**
 * ADR-009 Builder Integrity — Builder 전체 흐름(E2E 성격) 검증.
 * 새 그룹 생성 → Workflow 자동 선택 → 저장 → Sidebar에서 올바른 Workflow 아래 존재.
 */

const workflows: Workflow[] = [
  { workflowId: 'wf-sales', workflowName: '주문 → 출고 → 매출전표', category: 'sales', order: 1 },
  { workflowId: 'wf-purchase', workflowName: '구매요청 → 입고 → 매입전표', category: 'purchase-inbound', order: 2 },
]

const seedGroup: DetailProcessGroup = {
  id: 'sales-group',
  name: '판매 그룹',
  description: '',
  detailProcessId: 'sales-proc',
  workflowId: 'wf-sales',
}

const proc = (id: string, name = id): Process =>
  ({ id, name, description: '', nodes: [], edges: [], lanes: [] } as unknown as Process)

const makeData = (groups: DetailProcessGroup[]): ProcessData =>
  ({
    commonMasters: { lanes: [] },
    processes: [],
    workflows,
    detailProcessGroups: groups,
    overviewProcessGroups: [],
    version: 1,
    updatedAt: '',
    dataSource: 'project-json',
    dirty: false,
    baselineNodeCount: 0,
    baselineEdgeCount: 0,
  } as unknown as ProcessData)

describe('Builder flow — 컨텍스트 있는 생성', () => {
  it('컨텍스트 Workflow를 자동 승계해 저장하면 Sidebar의 올바른 Workflow 섹션에 나타난다', () => {
    // 1) 현재 sales-proc(=wf-sales)를 열어둔 상태에서 새 그룹 추가
    const inheritedWorkflowId = resolveCreationWorkflowId([seedGroup], 'sales-proc')
    expect(inheritedWorkflowId).toBe('wf-sales')

    // 2) 신규 그룹 생성(Workflow 자동 채움)
    const selection = buildNewDetailProcessGroupSelection(
      [seedGroup],
      [proc('new-proc', '신규 판매 변형')],
      inheritedWorkflowId,
    )
    const newGroup = selection.data as DetailProcessGroup
    expect(newGroup.workflowId).toBe('wf-sales')

    // 3) 저장 (실제 mutation)
    const saved = saveDetailProcessGroup(makeData([seedGroup]), newGroup)

    // 4) Sidebar 재구성
    const sections = buildWorkflowSections(saved.detailProcessGroups ?? [], workflows)

    // 5) 새 그룹은 wf-sales 섹션 아래에 존재하고, fallback에는 없다
    const salesSection = sections.find((s) => s.key === 'wf-sales')
    expect(salesSection).toBeDefined()
    expect(salesSection!.groups.some((g) => g.id === newGroup.id)).toBe(true)
    expect(sections.some((s) => s.key === UNCLASSIFIED_WORKFLOW_KEY)).toBe(false)
  })
})

describe('Builder flow — 컨텍스트 없는 생성', () => {
  it('컨텍스트가 없으면 자동 선택하지 않아, workflowId 없이 저장하면 미분류 fallback으로 감지된다', () => {
    // 컨텍스트 없음(매칭 그룹 없음) → 자동 선택 금지
    const inheritedWorkflowId = resolveCreationWorkflowId([seedGroup], 'unknown-proc')
    expect(inheritedWorkflowId).toBeUndefined()

    const selection = buildNewDetailProcessGroupSelection(
      [seedGroup],
      [proc('orphan-proc')],
      inheritedWorkflowId,
    )
    const newGroup = selection.data as DetailProcessGroup
    expect('workflowId' in newGroup).toBe(false)

    // UI는 이 상태 저장을 막지만(commitDetailProcessGroup 필수 검증),
    // 만약 workflowId 없이 저장되면 fallback이 예외 데이터로 감지한다.
    const saved = saveDetailProcessGroup(makeData([seedGroup]), newGroup)
    const sections = buildWorkflowSections(saved.detailProcessGroups ?? [], workflows)
    const fallback = sections.find((s) => s.key === UNCLASSIFIED_WORKFLOW_KEY)
    expect(fallback).toBeDefined()
    expect(fallback!.groups.some((g) => g.id === newGroup.id)).toBe(true)
  })
})
