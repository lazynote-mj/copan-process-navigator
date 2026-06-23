import type { Point } from '../../../lib/layout/orthogonalEdgeRouter'

/** pathPoints → SVG (재-simplify 금지 — endpoint가 노드 경계에서 벗어나는 것 방지) */
function pathPointsToSvg(pathPoints: Point[]): string {
  return pathPoints
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
    .join(' ')
}

/** Router pathPoints 그대로 표시 — endpoint 보정·marker gap 없음 */
export function buildEdgeDisplayPath(
  storedPath: string,
  pathPoints: Point[],
): string {
  if (pathPoints.length >= 2) {
    return pathPointsToSvg(pathPoints)
  }
  return storedPath
}
