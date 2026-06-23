/** Process Detail — Overview vertical과 동일 비중 */
export const DETAIL_NODE_SCALE = 1

export function scaleLayoutDimension(value: number, scale = DETAIL_NODE_SCALE): number {
  return Math.round(value * scale)
}
