type ElkPoint = { x: number; y: number }

export type ElkEdgeSection = {
  startPoint: ElkPoint
  endPoint: ElkPoint
  bendPoints?: ElkPoint[]
}

export type ElkRoutedEdge = {
  id: string
  sections?: ElkEdgeSection[]
}

/** ELK orthogonal section → SVG path */
export function buildOrthogonalPath(section: ElkEdgeSection): string {
  const points = [section.startPoint, ...(section.bendPoints ?? []), section.endPoint]

  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ')
}

export function buildPathFromElkEdge(sections: ElkEdgeSection[]): string {
  return sections.map(buildOrthogonalPath).join(' ')
}

/** 라벨을 수평 구간 중앙에 배치 (노드와 겹침 최소화) */
export function getEdgeLabelPoint(
  sections: ElkEdgeSection[],
  offsetY = -14,
): { x: number; y: number } | undefined {
  if (sections.length === 0) return undefined

  const points = sections.flatMap((section) => [
    section.startPoint,
    ...(section.bendPoints ?? []),
    section.endPoint,
  ])

  let bestSegment: { x: number; y: number; length: number } | null = null

  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]
    const b = points[i + 1]
    const dx = Math.abs(a.x - b.x)
    const dy = Math.abs(a.y - b.y)
    const length = dx + dy

    if (length < 36) continue

    const isHorizontal = dy < 2
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 + (isHorizontal ? offsetY : 0) }

    if (!bestSegment || length > bestSegment.length) {
      bestSegment = { ...mid, length }
    }
  }

  if (bestSegment) {
    return { x: bestSegment.x, y: bestSegment.y }
  }

  const midIndex = Math.floor(points.length / 2)
  const a = points[Math.max(0, midIndex - 1)]
  const b = points[midIndex]
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 + offsetY }
}
