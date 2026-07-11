import { describe, expect, it } from 'vitest'
import {
  buildNewDetailProcessGroupSelection,
  resolveCreationWorkflowId,
} from '../selectedElement'
import type { DetailProcessGroup } from '../../../types/toBeNavigator'
import type { Process } from '../../../types/process'

const proc = (id: string, name = id): Process =>
  ({ id, name, description: `${name} 설명`, nodes: [], edges: [], lanes: [] } as unknown as Process)

const group = (id: string, overrides: Partial<DetailProcessGroup> = {}): DetailProcessGroup => ({
  id,
  name: id,
  description: '',
  detailProcessId: id,
  ...overrides,
})

describe('buildNewDetailProcessGroupSelection — Workflow Assignment Integrity (ADR-008)', () => {
  it('workflowId를 넘기면 신규 그룹 데이터에 소속 Workflow가 채워진다', () => {
    const selection = buildNewDetailProcessGroupSelection([], [proc('p1')], 'wf-sales')
    expect(selection.type).toBe('new-detail-process-group')
    const data = selection.data as DetailProcessGroup
    expect(data.workflowId).toBe('wf-sales')
    expect(data.detailProcessId).toBe('p1')
  })

  it('workflowId가 없으면 workflowId 필드를 아예 두지 않는다(미분류 fallback은 Panel 필수선택으로 유도)', () => {
    const selection = buildNewDetailProcessGroupSelection([], [proc('p1')])
    const data = selection.data as DetailProcessGroup
    expect('workflowId' in data).toBe(false)
  })

  it('기존 그룹 id와 충돌하지 않는 고유 그룹 id를 만든다', () => {
    const existing = [group('p1-group')]
    const selection = buildNewDetailProcessGroupSelection(existing, [proc('p1')], 'wf-sales')
    expect(selection.id).not.toBe('p1-group')
    expect(selection.id.startsWith('p1-group')).toBe(true)
  })
})

describe('resolveCreationWorkflowId — 컨텍스트 승계 규칙 (ADR-009)', () => {
  const groups = [
    group('sales-group', { detailProcessId: 'sales-proc', workflowId: 'wf-sales' }),
    group('legacy-group', { detailProcessId: 'legacy-proc' }), // workflowId 결측(미분류)
  ]

  it('현재 열린 Detail Process가 Workflow에 속하면 그 workflowId를 승계한다', () => {
    expect(resolveCreationWorkflowId(groups, 'sales-proc')).toBe('wf-sales')
  })

  it('컨텍스트가 미분류(workflowId 결측)이면 자동 선택하지 않는다(undefined)', () => {
    expect(resolveCreationWorkflowId(groups, 'legacy-proc')).toBeUndefined()
  })

  it('매칭되는 그룹이 없으면 자동 선택하지 않는다(undefined)', () => {
    expect(resolveCreationWorkflowId(groups, 'unknown-proc')).toBeUndefined()
  })

  it('활성 Detail Process가 없으면 자동 선택하지 않는다(undefined)', () => {
    expect(resolveCreationWorkflowId(groups, undefined)).toBeUndefined()
  })
})
