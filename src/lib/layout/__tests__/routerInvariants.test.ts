import { describe, expect, it } from 'vitest'
import type { Edge as FlowEdge } from '@xyflow/react'
import { getLayoutedElements, type ProcessEdgeData } from '../elkLayout'
import {
  countOrthogonalBends,
  getCollidedNodes,
  isOrthogonalSegment,
  type Point,
} from '../orthogonalEdgeRouter'
import { EXCESSIVE_BEND_WARNING } from '../edgeRouteValidation'
import {
  ROUTING_EDGE_NODE_MARGIN,
  ROUTING_OVERVIEW_EDGE_NODE_MARGIN,
} from '../routingMetrics'
import { layoutCases, toPlacedNodes } from './__fixtures__/layoutCases'
import { KNOWN_NODE_COLLISIONS } from './__fixtures__/knownCollisions'

/**
 * 라우팅 엔진 기하 불변식.
 *
 * 스냅샷(`layoutEngine.test.ts`)은 "좌표가 바뀌었는가"를 잡고, 이 파일은
 * "경로가 여전히 올바른가"를 잡는다. 스냅샷은 갱신하면 통과하지만 불변식은
 * 갱신으로 통과시킬 수 없다 — 위반은 엔진을 고쳐야 사라진다.
 *
 * 판정에 쓰는 함수와 임계값은 전부 엔진이 실제로 쓰는 것을 그대로 import한다.
 * 테스트가 별도 기준을 재구현하면 엔진과 어긋나 위양성을 만든다.
 */

type EdgeRef = {
  /** `<case name>/<edge id>` — allowlist 키와 동일한 형식 */
  key: string
  source: string
  target: string
  points: Point[]
  reportedStatus: string
}

type CaseLayout = {
  name: string
  edges: EdgeRef[]
  /** 해당 case의 충돌 판정에 쓰는 인자 */
  collisionArgs: {
    placed: ReturnType<typeof toPlacedNodes>
    margin: number
    process: (typeof layoutCases)[number]['process']
  }
}

/** 레이아웃은 case당 한 번만 계산하고 모든 불변식이 공유한다. */
const layouts: CaseLayout[] = layoutCases.map(({ name, process, options }) => {
  const result = getLayoutedElements(process, options)
  const placed = toPlacedNodes(result.nodes)
  const edges: EdgeRef[] = (result.edges as FlowEdge[]).map((edge) => {
    const data = (edge.data ?? {}) as ProcessEdgeData
    return {
      key: `${name}/${edge.id}`,
      source: edge.source,
      target: edge.target,
      points: (data.pathPoints ?? []) as Point[],
      reportedStatus: data.validationStatus ?? 'ok',
    }
  })

  return {
    name,
    edges,
    collisionArgs: {
      placed,
      // 라우터와 동일하게 overview는 14, detail은 24를 쓴다.
      margin: options.overviewVertical
        ? ROUTING_OVERVIEW_EDGE_NODE_MARGIN
        : ROUTING_EDGE_NODE_MARGIN,
      process,
    },
  }
})

const allEdges = layouts.flatMap((layout) => layout.edges)

/** 경로가 실제로 관통하는 노드를 라우터와 같은 기준으로 구한다. */
function collidedNodeIds(layout: CaseLayout, edge: EdgeRef): string[] {
  const { placed, margin, process } = layout.collisionArgs
  return getCollidedNodes(
    edge.points,
    placed,
    new Set([edge.source, edge.target]),
    margin,
    process,
  ).map((node) => node.id)
}

function collectCollisions(): Array<{ key: string; hit: string[]; reportedStatus: string }> {
  const found: Array<{ key: string; hit: string[]; reportedStatus: string }> = []
  for (const layout of layouts) {
    for (const edge of layout.edges) {
      if (edge.points.length < 2) continue
      const hit = collidedNodeIds(layout, edge)
      if (hit.length > 0) found.push({ key: edge.key, hit, reportedStatus: edge.reportedStatus })
    }
  }
  return found
}

describe('router invariants — 경로 기하', () => {
  it(`모든 edge 경로는 점이 2개 이상이다 (${allEdges.length}개 검사)`, () => {
    const violations = allEdges
      .filter((edge) => edge.points.length < 2)
      .map((edge) => `${edge.key}: ${edge.points.length}점`)
    expect(violations).toEqual([])
  })

  it('모든 segment는 수평 또는 수직이다 (사선 없음)', () => {
    const violations: string[] = []
    for (const edge of allEdges) {
      for (let i = 1; i < edge.points.length; i++) {
        const a = edge.points[i - 1]!
        const b = edge.points[i]!
        if (!isOrthogonalSegment(a, b)) {
          violations.push(
            `${edge.key} segment#${i}: (${a.x},${a.y})→(${b.x},${b.y})`,
          )
          break
        }
      }
    }
    expect(violations).toEqual([])
  })

  it('경로에 연속 중복 점이 없다', () => {
    const violations: string[] = []
    for (const edge of allEdges) {
      for (let i = 1; i < edge.points.length; i++) {
        const a = edge.points[i - 1]!
        const b = edge.points[i]!
        if (a.x === b.x && a.y === b.y) {
          violations.push(`${edge.key} @${i}: (${a.x},${a.y})`)
          break
        }
      }
    }
    expect(violations).toEqual([])
  })

  it(`bend는 ${EXCESSIVE_BEND_WARNING}회 미만이다 (엔진의 과다 bend 경고 임계값)`, () => {
    const violations = allEdges
      .filter((edge) => countOrthogonalBends(edge.points) >= EXCESSIVE_BEND_WARNING)
      .map((edge) => `${edge.key}: bend ${countOrthogonalBends(edge.points)}`)
    expect(violations).toEqual([])
  })
})

describe('router invariants — 노드 관통 baseline', () => {
  it('알려진 목록에 없는 새 관통이 없다', () => {
    const unexpected = collectCollisions()
      .filter(({ key }) => !KNOWN_NODE_COLLISIONS.has(key))
      .map(({ key, hit }) => `${key} → [${hit.join(', ')}]`)
    expect(unexpected).toEqual([])
  })

  it(`관통 총량이 baseline(${KNOWN_NODE_COLLISIONS.size}건)을 넘지 않는다`, () => {
    expect(collectCollisions().length).toBeLessThanOrEqual(KNOWN_NODE_COLLISIONS.size)
  })

  it('baseline 항목이 이미 해소됐다면 목록에서 지우라고 알린다', () => {
    const actual = new Set(collectCollisions().map(({ key }) => key))
    const resolved = [...KNOWN_NODE_COLLISIONS].filter((key) => !actual.has(key))
    // 해소는 좋은 일이다. 실패시켜서 목록을 줄이게 만든다.
    expect(resolved, 'knownCollisions.ts에서 아래 항목을 지우세요').toEqual([])
  })
})

describe('router invariants — 엔진 자기보고 정합성', () => {
  it('기하상 관통인데 ok로 보고하는 edge는 baseline에만 존재한다', () => {
    const silent = collectCollisions()
      .filter(({ reportedStatus }) => reportedStatus === 'ok')
      .filter(({ key }) => !KNOWN_NODE_COLLISIONS.has(key))
      .map(({ key, hit }) => `${key} [보고=ok] → [${hit.join(', ')}]`)
    expect(silent).toEqual([])
  })

  it('관통이 없는 edge를 관통이라고 보고하지 않는다', () => {
    const collidedKeys = new Set(collectCollisions().map(({ key }) => key))
    const falseAlarms = allEdges
      .filter((edge) => edge.reportedStatus === 'error' && !collidedKeys.has(edge.key))
      .map((edge) => edge.key)
    // error는 관통 외 사유(endpoint 누락 등)로도 나므로, 관통 보고만 좁혀 볼 수 없다.
    // 현재 데이터에는 error가 하나도 없어 이 단언이 그 사실을 고정한다.
    expect(falseAlarms).toEqual([])
  })
})
