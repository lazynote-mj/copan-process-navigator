import { describe, expect, it } from 'vitest'
import type { Edge as FlowEdge, Node as FlowNode } from '@xyflow/react'
import { toBeNavigator } from '../../../data/toBeNavigatorRegistry'
import {
  getLayoutedElements,
  type LayoutOptions,
  type LayoutResult,
  type ProcessEdgeData,
  type ProcessNodeData,
} from '../elkLayout'
import type { Process } from '../../../types/process'

/**
 * 레이아웃/라우팅 엔진 회귀 스냅샷.
 *
 * 번들된 registry 데이터(overview + detail process 전체)를 앱과 동일한
 * 옵션으로 배치하고, 노드 좌표와 edge 경로 요약을 스냅샷으로 고정한다.
 * 엔진 수정 시 의도한 변화라면 `npx vitest -u`로 스냅샷을 갱신한다.
 */

const round = (value: number) => Math.round(value * 10) / 10

type LayoutCase = { name: string; process: Process; options: LayoutOptions }

const cases: LayoutCase[] = [
  { name: 'overview', process: toBeNavigator.overview, options: { overviewVertical: true } },
  ...toBeNavigator.detailProcesses.map((process) => ({
    name: process.id,
    process,
    options: { detailHorizontal: true } as LayoutOptions,
  })),
]

function summarizeNode(node: FlowNode<ProcessNodeData>) {
  return {
    id: node.id,
    x: round(node.position.x),
    y: round(node.position.y),
    w: round(node.data.layoutWidth ?? node.width ?? 0),
    h: round(node.data.layoutHeight ?? node.height ?? 0),
    lane: node.data.laneId,
  }
}

function summarizeEdge(edge: FlowEdge) {
  const data = (edge.data ?? {}) as ProcessEdgeData
  const points = (data.pathPoints ?? []).map((p) => [round(p.x), round(p.y)])
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    handles: `${data.sourceHandle ?? '-'}→${data.targetHandle ?? '-'}`,
    routing: data.routingKind,
    status: data.validationStatus ?? 'ok',
    broken: data.broken ?? false,
    bends: data.bendPoints?.length ?? 0,
    points,
  }
}

function summarizeLayout(result: LayoutResult) {
  return {
    canvasBounds: {
      width: round(result.canvasBounds.width),
      height: round(result.canvasBounds.height),
    },
    orientation: result.layoutOrientation,
    lanes: result.laneBands.map((band) => band.laneId),
    nodes: [...result.nodes].sort((a, b) => a.id.localeCompare(b.id)).map(summarizeNode),
    edges: [...result.edges].sort((a, b) => a.id.localeCompare(b.id)).map(summarizeEdge),
  }
}

describe('layout engine snapshots', () => {
  it.each(cases)('$name', ({ process, options }) => {
    const result = getLayoutedElements(process, options)
    expect(summarizeLayout(result)).toMatchSnapshot()
  })
})

describe('layout engine invariants', () => {
  it.each(cases)('$name — 좌표는 모두 유한한 숫자다', ({ process, options }) => {
    const result = getLayoutedElements(process, options)
    for (const node of result.nodes) {
      expect(Number.isFinite(node.position.x), `${node.id}.x`).toBe(true)
      expect(Number.isFinite(node.position.y), `${node.id}.y`).toBe(true)
    }
    for (const edge of result.edges) {
      const data = (edge.data ?? {}) as ProcessEdgeData
      for (const p of data.pathPoints ?? []) {
        expect(Number.isFinite(p.x) && Number.isFinite(p.y), `${edge.id} path point`).toBe(true)
      }
    }
  })

  it.each(cases)('$name — 동일 입력은 동일 결과를 낸다', ({ process, options }) => {
    const first = summarizeLayout(getLayoutedElements(process, options))
    const second = summarizeLayout(getLayoutedElements(process, options))
    expect(second).toEqual(first)
  })

  it('모든 detail process의 edge 끝점은 실재하는 노드를 가리킨다', () => {
    for (const process of toBeNavigator.detailProcesses) {
      const nodeIds = new Set(process.nodes.map((n) => n.id))
      for (const edge of process.edges) {
        expect(nodeIds.has(edge.source), `${process.id}: ${edge.id} source`).toBe(true)
        expect(nodeIds.has(edge.target), `${process.id}: ${edge.id} target`).toBe(true)
      }
    }
  })
})
