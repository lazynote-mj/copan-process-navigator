import { describe, expect, it } from 'vitest'
import type { Lane, Node, Process } from '../../../types/process'
import {
  buildVisibleDetailLanes,
  canonicalizeDetailLaneId,
  projectDetailSwimlanes,
} from '../detailSwimlaneProjection'

const lanes: Lane[] = [
  { id: 'business', name: '사업', order: 1, ownerDepartment: '' },
  { id: 'procurement', name: '구매', order: 2, ownerDepartment: '' },
  { id: 'logistics', name: '물류', order: 3, ownerDepartment: '' },
  { id: 'sales', name: '판매', order: 4, ownerDepartment: '' },
  { id: 'finance', name: '재무', order: 5, ownerDepartment: '' },
]

const node = (id: string, laneId: string): Node => ({
  id,
  laneId,
  name: id,
  type: 'manual',
  phaseId: 'p1',
  system: '',
  owner: '',
  description: '',
  inputs: [],
  outputs: [],
  controls: [],
})

const process = (id: string, nodes: Node[], overrides: Partial<Process> = {}): Process => ({
  id,
  name: id,
  description: '',
  version: '',
  status: 'draft',
  lastModified: '',
  owner: '',
  phases: [{ id: 'p1', label: 'P1', order: 1 }],
  lanes,
  nodes,
  edges: [],
  ...overrides,
})

describe('detail swimlane projection', () => {
  it('일반 Detail Process는 기본 5개 lane을 canonical 순서로 표시한다', () => {
    const visible = buildVisibleDetailLanes(process('b2c-order-to-sales', [node('n1', 'business')]))

    expect(visible.map((lane) => lane.id)).toEqual([
      'business',
      'procurement',
      'logistics',
      'sales',
      'finance',
    ])
    expect(visible.map((lane) => lane.name)).toEqual(['사업', '구매', '물류센터', '매장/POS', '재무'])
  })

  it('일반구매 예외 2개는 기본적으로 사업/구매/재무 3개 lane만 표시한다', () => {
    const visible = buildVisibleDetailLanes(process(
      '구매-요청-매입전표-생성-인사총무',
      [node('n1', 'business'), node('n2', 'procurement'), node('n3', 'finance')],
    ))

    expect(visible.map((lane) => lane.id)).toEqual(['business', 'procurement', 'finance'])
  })

  it('일반구매라도 node가 다른 canonical lane을 참조하면 숨기지 않고 추가 표시한다', () => {
    const visible = buildVisibleDetailLanes(process(
      '구매-요청-매입-전표-생성-it-s-w',
      [node('n1', 'business'), node('n2', 'logistics'), node('n3', 'finance')],
    ))

    expect(visible.map((lane) => lane.id)).toEqual(['business', 'procurement', 'logistics', 'finance'])
  })

  it('legacy lane alias는 canonical lane id로 해석한다', () => {
    expect(canonicalizeDetailLaneId('partnership')).toBe('procurement')
    expect(canonicalizeDetailLaneId('warehouse-easyadmin')).toBe('logistics')
    expect(canonicalizeDetailLaneId('retail-easychain')).toBe('sales')
  })

  it('legacy laneIds가 남아 있어도 node가 참조하는 canonical lane은 visible lane에 포함한다', () => {
    const source = process(
      'purchase-return',
      [node('n1', 'business'), node('n2', 'procurement'), node('n3', 'logistics'), node('n4', 'finance')],
      { laneIds: ['business', 'partnership', 'warehouse-easyadmin', 'retail-easychain', 'finance'] },
    )
    const projected = projectDetailSwimlanes(source)

    expect(projected.lanes.map((lane) => lane.id)).toEqual([
      'business',
      'procurement',
      'logistics',
      'sales',
      'finance',
    ])
    expect(source.laneIds).toEqual(['business', 'partnership', 'warehouse-easyadmin', 'retail-easychain', 'finance'])
  })

  it('business-to-project는 제외하지 않고 기본 5개 lane 정책을 적용한다', () => {
    const visible = buildVisibleDetailLanes(process('business-to-project', [node('n1', 'business')]))

    expect(visible.map((lane) => lane.id)).toEqual([
      'business',
      'procurement',
      'logistics',
      'sales',
      'finance',
    ])
  })

  it('OMS/WMS 같은 별도 lane id를 생성하지 않는다', () => {
    const visible = buildVisibleDetailLanes(process('b2c-order-to-sales', [node('n1', 'logistics')]))

    expect(visible.map((lane) => lane.id)).not.toContain('oms')
    expect(visible.map((lane) => lane.id)).not.toContain('wms')
  })
})
