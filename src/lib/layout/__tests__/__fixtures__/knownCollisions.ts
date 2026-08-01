/**
 * 노드 관통 부채 baseline.
 *
 * 아래 edge들은 라우팅 결과 경로가 source/target이 아닌 다른 노드의 bbox를
 * (라우터가 쓰는 마진 기준으로) 실제로 통과한다. 그런데 엔진은 이들을 전부
 * `validationStatus: 'ok'`로 보고한다 — `edgeRouteValidation.ts`에
 * `node_collision → error` 규칙이 있는데도 그렇다.
 *
 * 원인(계측으로 확인): `routeOrthogonalEdge`에는 `finishOrthogonalRoute`를
 * 거치지 않고 반환하는 경로가 6개 있다. `applyCollisionValidation`은 오직
 * `finishOrthogonalRoute`에서만 호출되고, 그것이 orthogonal 경로의
 * `validationStatus`를 세우는 유일한 지점이다. 따라서 우회 경로로 반환된
 * edge는 충돌 검사를 아예 받지 않고, status가 미설정으로 남아 `ok`가 된다.
 *
 * 아래 18건이 나가는 우회 경로:
 * - `routeDownwardBottomTopEdge` — 16건
 * - `routeAdjacentHorizontalStraightEdge` — 2건
 *
 * `business-to-project`의 4건은 라우터에 재진입하며 내부적으로
 * `finishOrthogonalRoute`를 호출해 `status: 'error'`까지 계산해내지만,
 * 바깥 호출이 우회 경로로 반환하면서 그 결과가 버려진다.
 *
 * 기각된 가설: "라우팅 시점 `placed` 집합이 최종 배치와 다르다" — 아니다.
 * 계측 결과 `placed`는 최종 배치와 동일하다(detail 21, overview 53).
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
