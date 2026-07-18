import { describe, expect, it } from 'vitest'
import { WORKSHOP_MENU_CONFIG } from '../../../config/workshopMenuConfig'
import type { DetailProcessGroup } from '../../../types/toBeNavigator'
import {
  buildWorkshopMenuSections,
  resolveSelectedWorkshopMenuPath,
} from '../buildWorkshopMenu'

const group = (detailProcessId: string, id = `pg-${detailProcessId}`): DetailProcessGroup => ({
  id,
  name: detailProcessId,
  description: '',
  detailProcessId,
})

const groups = WORKSHOP_MENU_CONFIG
  .filter((entry) => entry.processId)
  .map((entry) => group(entry.processId!))

describe('buildWorkshopMenuSections', () => {
  it('implemented entries만 live Workshop menu로 만든다', () => {
    const sections = buildWorkshopMenuSections(groups)

    expect(sections.map((section) => section.label)).toEqual([
      '사업관리',
      '구매',
      '판매',
      '반품',
      '재고',
      '정산',
    ])
    expect(sections.some((section) => section.label === '기준정보')).toBe(false)
  })

  it('Level3가 없는 항목은 Level2 leaf로 렌더링할 수 있게 평탄화한다', () => {
    const sections = buildWorkshopMenuSections(groups)
    const sales = sections.find((section) => section.label === '판매')!
    const b2b = sales.items.find((item) => item.kind === 'leaf' && item.label === 'B2B')

    expect(b2b?.kind).toBe('leaf')
  })

  it('Level3가 있는 항목은 Level2 branch 아래 leaf로 묶는다', () => {
    const sections = buildWorkshopMenuSections(groups)
    const sales = sections.find((section) => section.label === '판매')!
    const fieldSales = sales.items.find((item) => item.kind === 'branch' && item.label === '현장판매')

    expect(fieldSales?.kind).toBe('branch')
    if (fieldSales?.kind === 'branch') {
      expect(fieldSales.leaves.map((leaf) => leaf.label)).toEqual(['공연/팝업', '매장'])
    }
  })

  it('동일 Process가 여러 navigation entry에 있어도 preferred navigationId를 우선한다', () => {
    const sections = buildWorkshopMenuSections(groups)
    const path = resolveSelectedWorkshopMenuPath(sections, 'pg-purchase-return', 'return-purchase')

    expect(path.navigationId).toBe('return-purchase')
    expect(path.level1Key).toBe('workshop-level1:반품')
  })

  it('preferred navigationId가 없으면 config 순서상 첫 entry를 active path로 사용한다', () => {
    const sections = buildWorkshopMenuSections(groups)
    const path = resolveSelectedWorkshopMenuPath(sections, 'pg-purchase-return')

    expect(path.navigationId).toBe('purchase-project-return')
    expect(path.level1Key).toBe('workshop-level1:구매')
  })
})
