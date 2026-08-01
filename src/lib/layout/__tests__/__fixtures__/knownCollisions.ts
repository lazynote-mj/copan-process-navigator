/**
 * 노드 관통 부채 baseline.
 *
 * 아래 edge들은 라우팅 결과 경로가 source/target이 아닌 다른 노드의 bbox를
 * (라우터가 쓰는 마진 기준으로) 실제로 통과한다. **관통은 아직 남아 있다.**
 * 다만 엔진이 이를 `validationStatus: 'error'`로 정직하게 보고하므로 화면에서
 * 빨간 점선과 '오류: 노드 관통' 라벨로 드러난다.
 *
 * 왜 한때 `ok`로 보고됐는가(계측으로 확인): `routeOrthogonalEdge`에는
 * `finishOrthogonalRoute`를 거치지 않고 반환하는 경로가 6개 있었다.
 * `applyCollisionValidation`은 오직 `finishOrthogonalRoute`에서만 호출되고
 * 그것이 orthogonal 경로의 `validationStatus`를 세우는 유일한 지점이므로,
 * 우회 경로로 반환된 edge는 충돌 검사를 아예 받지 못했다. 지금은 6개 우회
 * 지점 전부가 `reportCollisionValidation`을 거친다 — 기하는 건드리지 않고
 * 보고만 한다. 관통 자체를 없애는 것은 별도 작업이다.
 *
 * 기각된 가설: "라우팅 시점 `placed` 집합이 최종 배치와 다르다" — 아니다.
 * 계측 결과 `placed`는 최종 배치와 동일하다.
 *
 * 두 목록의 공통 규칙:
 * - **줄어드는 방향으로만 갱신한다.** 항목을 추가하려면 라우터 회귀를 허용하는
 *   것이므로, 추가 대신 원인을 고친다.
 * - 항목을 지울 때는 해당 edge가 실제로 관통하지 않게 됐는지 확인한다.
 * - 키 형식은 `<layout case name>/<edge id>`.
 */

/**
 * 번들된 registry(`src/data/processes/*.json`) 기준.
 *
 * 나가던 우회 경로: `routeDownwardBottomTopEdge` 16건,
 * `routeAdjacentHorizontalStraightEdge` 2건.
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

/**
 * 앱이 실제로 렌더하는 데이터 기준 — `state.json` → `buildProcessDataFromPayload`
 * (WP3 Execution Domain 마이그레이션) → `hydrateProcessData`.
 *
 * registry 목록과 겹치지만 같지 않다 — state.json에는 편집기에서 만든 프로세스가
 * 더 있고 좌표·핸들도 저장된 값이 우선하므로 관통하는 edge 집합이 다르다.
 * **사용자가 화면에서 보는 것은 이쪽이다.**
 *
 * 주의: 이 목록은 레인 표시 설정 버그의 영향을 받는다. `migrateExecutionDomains`가
 * `process.laneIds`를 도메인으로 remap하지 않아 도메인 3종(procurement/logistics/
 * sales)의 레인 밴드가 만들어지지 않고, 그 도메인 노드 108개가 `validateNodes`에서
 * 탈락한다. 탈락 노드를 잇던 edge는 endpoint를 잃으므로 관통 판정 대상에서도
 * 빠진다. **그 버그를 고치면 이 목록은 늘어날 수 있다** — 사라졌던 노드와 경로가
 * 돌아오기 때문이다. 그때는 baseline을 다시 측정한다.
 */
export const KNOWN_RUNTIME_COLLISIONS: ReadonlySet<string> = new Set([
  'to-be-overview/main:e2e:02',
  'business-to-project/e07b',
  'business-to-project/e08',
  'business-to-project/e08a',
  'business-to-project/e09',
  'b2b-export-order-to-sales/edge-mqq58dx1-emfiy',
  'other-issue/edge-mr2ueu2f-9c3p5',
  'popup-concert-stock-sales-sync/popup-concert-stock-sales-sync-e03',
  'popup-concert-stock-sales-sync/popup-concert-stock-sales-sync-e10',
  'event-sales/event-sales-e20',
  'store-sales/store-sales-e13',
])
