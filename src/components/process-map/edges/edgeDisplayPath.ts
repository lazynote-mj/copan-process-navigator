import { pointsToPath, type Point } from '../../../lib/layout/orthogonalEdgeRouter'

/** Router pathPoints 그대로 표시 — endpoint 보정·marker gap 없음 */
export function buildEdgeDisplayPath(
  storedPath: string,
  pathPoints: Point[],
): string {
  if (pathPoints.length >= 2) {
    return pointsToPath(pathPoints)
  }
  return storedPath
}
