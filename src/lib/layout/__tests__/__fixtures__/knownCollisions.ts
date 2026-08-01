/**
 * 노드 관통 부채 baseline.
 *
 * 아래 edge들은 라우팅 결과 경로가 source/target이 아닌 다른 노드의 bbox를
 * (라우터가 쓰는 마진 기준으로) 실제로 통과한다. 그런데 엔진은 이들을 전부
 * `validationStatus: 'ok'`로 보고한다 — `edgeRouteValidation.ts`에
 * `node_collision → error` 규칙이 있는데도 그렇다.
 *
 * 추정 원인: 라우팅 시점에 충돌 판정이 받는 `placed` 집합이 최종 배치 전체와
 * 다르다. 라우터는 자기가 본 범위에서만 충돌을 계산하므로, 최종 레이아웃에서
 * 생긴 관통을 놓친다. 확정된 진단은 아니며 별도 조사 대상이다.
 *
 * 이 목록의 규칙:
 * - **줄어드는 방향으로만 갱신한다.** 항목을 추가하려면 라우터 회귀를 허용하는
 *   것이므로, 추가 대신 원인을 고친다.
 * - 항목을 지울 때는 해당 edge가 실제로 관통하지 않게 됐는지 확인한다.
 * - 키 형식은 `<layout case name>/<edge id>`.
 */
export const KNOWN_NODE_COLLISIONS: ReadonlySet<string> = new Set([
  'overview/main:e2e:22',
  'overview/main:e2e:25',
  'overview/sub:consignment:08',
  'business-to-project/e07b',
  'business-to-project/e08',
  'business-to-project/e08a',
  'business-to-project/e08d',
  'business-to-project/e09',
  'b2b-domestic-order-to-sales/b2b-domestic-order-to-sales-e10',
  'b2b-export-order-to-sales/b2b-export-order-to-sales-e02',
  'preorder-to-sales/preorder-to-sales-e01',
  'preorder-to-sales/preorder-to-sales-e10',
  'popup-concert-stock-sales-sync/edge-mqubp1r7-3d20i',
  'popup-concert-stock-sales-sync/popup-concert-stock-sales-sync-e14',
  'popup-concert-stock-sales-sync/popup-concert-stock-sales-sync-e25-fin',
  'event-sales/event-sales-e20',
  'store-sales/edge-mqt0fhrn-ujvd0',
  'store-sales/store-sales-e13',
])
