import { describe, expect, it } from 'vitest'
import type { Edge as FlowEdge } from '@xyflow/react'
import { getLayoutedElements, type ProcessEdgeData } from '../elkLayout'
import {
  countOrthogonalBends,
  getCollidedNodes,
  isOrthogonalSegment,
  PRIORITY_ROUTE_NODE_PADDING,
  type Point,
} from '../orthogonalEdgeRouter'
import { OVERVIEW_VERTICAL_METRICS } from '../overviewVerticalMetrics'
import { EXCESSIVE_BEND_WARNING } from '../edgeRouteValidation'
import { resolveEdgeType } from '../../../types/edgeTypes'
import { layoutCases, toPlacedNodes, type LayoutCase } from './__fixtures__/layoutCases'
import { runtimeLayoutCases, runtimeStateAvailable } from './__fixtures__/runtimeLayoutCases'
import {
  KNOWN_NODE_COLLISIONS,
  KNOWN_RUNTIME_COLLISIONS,
} from './__fixtures__/knownCollisions'

/**
 * 라우팅 엔진 기하 불변식.
 *
 * 스냅샷(`layoutEngine.test.ts`)은 "좌표가 바뀌었는가"를 잡고, 이 파일은
 * "경로가 여전히 올바른가"를 잡는다. 스냅샷은 갱신하면 통과하지만 불변식은
 * 갱신으로 통과시킬 수 없다 — 위반은 엔진을 고쳐야 사라진다.
 *
 * **두 데이터 소스에 각각 돌린다.**
 * - registry: 번들된 `src/data/processes/*.json`
 * - runtime state: `public/process-data/state.json` + hydrate — 사용자가 보는 것
 *
 * 두 데이터는 갈라져 있으므로 registry만 검증하면 화면의 회귀를 놓친다.
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
  /** `resolveEdgeRouteValidation`이 붙인 사유. 관통 오보만 좁혀 보기 위해 필요하다. */
  routeIssue?: string
}

type CaseLayout = {
  name: string
  edges: EdgeRef[]
  placed: ReturnType<typeof toPlacedNodes>
  process: LayoutCase['process']
  /** 라우터가 이 case에 쓰는 충돌 마진 (edge type에 따라 달라진다) */
  marginFor: (edgeId: string) => number
}

function buildLayouts(cases: LayoutCase[]): CaseLayout[] {
  return cases.map(({ name, process, options }) => {
    const result = getLayoutedElements(process, options)
    const overview = !!options.overviewVertical

    return {
      name,
      process,
      placed: toPlacedNodes(result.nodes),
      // `resolveRouteNodeMargin`과 동일: overview는 edge type별, detail은 priority padding.
      marginFor: (edgeId: string) => {
        if (!overview) return PRIORITY_ROUTE_NODE_PADDING
        const edge = process.edges.find((e) => e.id === edgeId)
        return edge && resolveEdgeType(edge) === 'return'
          ? OVERVIEW_VERTICAL_METRICS.edgeNodeMarginReturn
          : OVERVIEW_VERTICAL_METRICS.edgeNodeMargin
      },
      edges: (result.edges as FlowEdge[]).map((edge) => {
        const data = (edge.data ?? {}) as ProcessEdgeData
        return {
          key: `${name}/${edge.id}`,
          source: edge.source,
          target: edge.target,
          points: (data.pathPoints ?? []) as Point[],
          reportedStatus: data.validationStatus ?? 'ok',
          routeIssue: data.routeIssue,
        }
      }),
    }
  })
}

type Collision = { key: string; hit: string[]; reportedStatus: string }

function collectCollisions(layouts: CaseLayout[]): Collision[] {
  const found: Collision[] = []
  for (const layout of layouts) {
    for (const edge of layout.edges) {
      if (edge.points.length < 2) continue
      const edgeId = edge.key.slice(layout.name.length + 1)
      const hit = getCollidedNodes(
        edge.points,
        layout.placed,
        new Set([edge.source, edge.target]),
        layout.marginFor(edgeId),
        layout.process,
      ).map((node) => node.id)
      if (hit.length > 0) found.push({ key: edge.key, hit, reportedStatus: edge.reportedStatus })
    }
  }
  return found
}

/** 한 데이터 소스에 대한 불변식 묶음. 두 소스가 같은 규칙을 받는다. */
function describeInvariantsFor(
  label: string,
  cases: LayoutCase[],
  baseline: ReadonlySet<string>,
) {
  const layouts = buildLayouts(cases)
  const allEdges = layouts.flatMap((layout) => layout.edges)

  describe(`${label} — 경로 기하`, () => {
    it(`모든 edge 경로는 점이 2개 이상이다 (case ${cases.length} / edge ${allEdges.length})`, () => {
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
            violations.push(`${edge.key} segment#${i}: (${a.x},${a.y})→(${b.x},${b.y})`)
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

  describe(`${label} — 노드 관통 baseline`, () => {
    it('알려진 목록에 없는 새 관통이 없다', () => {
      const unexpected = collectCollisions(layouts)
        .filter(({ key }) => !baseline.has(key))
        .map(({ key, hit }) => `${key} → [${hit.join(', ')}]`)
      expect(unexpected).toEqual([])
    })

    it(`관통 총량이 baseline(${baseline.size}건)을 넘지 않는다`, () => {
      expect(collectCollisions(layouts).length).toBeLessThanOrEqual(baseline.size)
    })

    it('baseline 항목이 이미 해소됐다면 목록에서 지우라고 알린다', () => {
      const actual = new Set(collectCollisions(layouts).map(({ key }) => key))
      const resolved = [...baseline].filter((key) => !actual.has(key))
      // 해소는 좋은 일이다. 실패시켜서 목록을 줄이게 만든다.
      expect(resolved, 'knownCollisions.ts에서 아래 항목을 지우세요').toEqual([])
    })
  })

  describe(`${label} — 엔진 자기보고 정합성`, () => {
    it('기하상 관통인 edge는 하나도 빠짐없이 ok가 아닌 상태로 보고된다', () => {
      // 관통이 남아 있어도 엔진이 그것을 ok라고 말해서는 안 된다.
      // error 또는 warning(manual route)으로 보고되어야 한다.
      const silent = collectCollisions(layouts)
        .filter(({ reportedStatus }) => reportedStatus === 'ok')
        .map(({ key, hit }) => `${key} [보고=ok] → [${hit.join(', ')}]`)
      expect(silent).toEqual([])
    })

    it('관통이 없는 edge를 관통이라고 보고하지 않는다', () => {
      // error는 관통 외 사유(endpoint 누락, handle 누락 등)로도 난다 —
      // runtime state에는 그런 edge가 실제로 있다. 그러니 `routeIssue`로
      // 관통 보고만 좁혀서 본다.
      const collidedKeys = new Set(collectCollisions(layouts).map(({ key }) => key))
      const falseAlarms = allEdges
        .filter((edge) => edge.routeIssue === 'node_collision' && !collidedKeys.has(edge.key))
        .map((edge) => edge.key)
      expect(falseAlarms).toEqual([])
    })
  })
}

describeInvariantsFor('registry', layoutCases, KNOWN_NODE_COLLISIONS)

// state.json이 없는 환경(클린 체크아웃 직후 등)에서는 건너뛴다.
describe.skipIf(!runtimeStateAvailable)('runtime state', () => {
  describeInvariantsFor('runtime state', runtimeLayoutCases, KNOWN_RUNTIME_COLLISIONS)
})
