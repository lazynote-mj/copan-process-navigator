import { describe, expect, it } from 'vitest'

/**
 * 모듈 초기화 순서 회귀 테스트.
 *
 * layout 모듈에는 순환 import가 남아 있어, 진입 순서에 따라 모듈 상수가
 * 초기화 전에 역참조되면 크래시할 수 있다 (과거: processDataIO를
 * elkLayout보다 먼저 import하면 DECISION_NODE_LAYOUT undefined).
 * decisionNodeSpec leaf 분리 이후에도 이 순서가 계속 동작함을 보장한다.
 */

describe('layout module import order', () => {
  it('processDataIO를 먼저 import해도 layout 엔진이 동작한다', async () => {
    // 순서가 핵심: registry(안전한 순서)보다 processDataIO를 먼저 로드한다.
    const io = await import('../../../data/processDataIO')
    expect(io.validateImportPayload).toBeTypeOf('function')

    const { getLayoutedElements } = await import('../elkLayout')
    const { toBeNavigator } = await import('../../../data/toBeNavigatorRegistry')

    const result = getLayoutedElements(toBeNavigator.overview, { overviewVertical: true })
    expect(result.nodes.length).toBeGreaterThan(0)
    expect(result.edges.length).toBeGreaterThan(0)
  })

  it('decisionNodeSpec은 layout 순환에 참여하지 않는 leaf 모듈이다', async () => {
    const spec = await import('../decisionNodeSpec')
    expect(spec.DECISION_NODE_LAYOUT.exclusionPadding).toBeGreaterThan(0)
    expect(spec.DETAIL_DECISION_NODE_LAYOUT.width).toBeGreaterThan(0)
  })
})
