# Swimlane Node Mapping Audit

Source: `public/process-data/state.local.json`

이번 문서는 구현 전 read-only audit 결과이다. Runtime/state/migration은 수정하지 않았다.

## Data Model Findings

| Item | Finding |
| --- | --- |
| Lane master | `ProcessData.commonMasters.lanes` |
| Process별 표시 lane 필터 | `ProcessInstance.laneIds` |
| 빈 lane 자동 숨김 | `ProcessInstance.autoHideEmptyLanes` |
| 렌더/레이아웃용 lane | `resolveProcessWithMasters(instance, commonMasters).lanes` |
| Node lane 참조 | `Node.laneId` |
| `swimlaneId` 필드 | 현재 없음 |
| `owner`, `department` | Node 담당/표시 메타이며 lane membership에는 사용되지 않음 |

현재 master lane은 다음 5개이다.

| ID | Label | Order |
| --- | --- | ---: |
| business | 사업 | 1 |
| procurement | 구매 | 2 |
| logistics | 물류센터 | 3 |
| sales | 매장/POS | 4 |
| finance | 재무 | 5 |

## Process Lane Mapping

| Process ID | Process명 | 정의된 Lane | Node가 참조하는 Lane | 누락 Lane | Orphan Node | 렌더링 결과 | 원인 | 수정 필요 |
| --- | --- | --- | --- | --- | ---: | --- | --- | --- |
| business-to-project | 사업 시작 ~ 구매요청 ~ 입고 ~ 매입전표 | business, finance | business, procurement, finance, logistics | procurement, logistics | 8 | 누락: procurement, logistics | legacy-canonical-mismatch / missing-lane-definition | Y |
| b2b-domestic-order-to-sales | 주문등록 ~ 출고 ~ 매출전표 : B2B 국내 | business, finance | business, logistics, finance | logistics | 4 | 누락: logistics | legacy-canonical-mismatch / missing-lane-definition | Y |
| b2b-domestic-return | 주문반품 ~ 입고 ~ 반품전표 : B2B 국내 | business, finance | business, logistics, finance | logistics | 4 | 누락: logistics | legacy-canonical-mismatch / missing-lane-definition | Y |
| b2b-export-order-to-sales | 주문 등록 ~ 수출 출고 ~ 매출 전표 : B2B 해외 | business, finance | business, logistics, finance | logistics | 4 | 누락: logistics | legacy-canonical-mismatch / missing-lane-definition | Y |
| b2c-order-to-sales | 주문 등록 ~ 출고 ~ 매출 전표 : B2C | business, finance | business, logistics, finance | logistics | 5 | 누락: logistics | legacy-canonical-mismatch / missing-lane-definition | Y |
| preorder-to-sales | 예약 판매 ~ 출고 ~ 매출전표 : B2C | business, finance | business, finance, logistics | logistics | 5 | 누락: logistics | legacy-canonical-mismatch / missing-lane-definition | Y |
| stock-transfer | 창고이동 / 재고이동 | business, finance | sales, business | sales | 3 | 누락: sales | legacy-canonical-mismatch / missing-lane-definition | Y |
| other-issue | 기타출고 | business, finance | business, logistics | logistics | 4 | 누락: logistics | legacy-canonical-mismatch / missing-lane-definition | Y |
| consignment-settlement | 위탁 매출 정산 | business, finance | business, finance | - | - | 표시 가능 | - | N |
| royalty-mg-settlement | 기획사 로열티 정산 : 제/상품 | business, finance | business, finance | - | - | 표시 가능 | - | N |
| popup-concert-stock-sales-sync | 공연장/팝업 판매 ~ 출고 ~ 매출전표 : 제/상품 | business, finance | business, logistics, sales, finance | logistics, sales | 14 | 누락: logistics, sales | legacy-canonical-mismatch / missing-lane-definition | Y |
| business-to-purchase-request | 사업 기회 확보 ~ 구매 요청 : 제/상품 | business, procurement, logistics, sales, finance | business | - | - | 단일 lane collapse | layout-index/display-policy | Y |
| purchase-to-ap-invoice | 구매 요청 ~ 입고 ~ 매입 전표 : 제/상품 | business, procurement, logistics, sales, finance | business, procurement, logistics, finance | - | - | 표시 가능 | - | N |
| b2c-return | 주문 반품 ~ 입고 ~ 반품전표 : B2C | business, finance | business, logistics, finance | logistics | 5 | 누락: logistics | legacy-canonical-mismatch / missing-lane-definition | Y |
| event-sales | 이벤트 : 제/상품 | business, logistics, finance | business, logistics, finance | - | - | 표시 가능 | - | N |
| store-sales | 매장 판매 ~ 출고 ~ 매출전표 : 제/상품 | business, finance | sales, business, finance | sales | 1 | 누락: sales | legacy-canonical-mismatch / missing-lane-definition | Y |
| revenue-share-settlement | 수익배분 매출 정산 | business, finance | business, finance | - | - | 표시 가능 | - | N |
| service-business-to-expense | 사업기회 ~ 비용전표 : (서비스) | business, finance | business | - | - | 표시 가능 | - | N |
| service-purchase-to-ap | 구매 요청 ~ 매입 전표 생성 : 서비스 | business, finance | business, finance | - | - | 표시 가능 | - | N |
| service-order-to-sales | 주문 등록 ~ 매출 전표 생성 : 서비스 | business, finance | business, finance | - | - | 표시 가능 | - | N |
| service-project-settlement | 프로젝트 정산 : 서비스 | business, finance | business, finance | - | - | 표시 가능 | - | N |
| purchase-return | 구매반품 | business, finance | business, procurement, finance, logistics | procurement, logistics | 13 | 누락: procurement, logistics | legacy-canonical-mismatch / missing-lane-definition | Y |
| other-receipt | 기타입고 | business, finance | business, logistics | logistics | 4 | 누락: logistics | legacy-canonical-mismatch / missing-lane-definition | Y |
| stock-movement | 일반 재고이동 | business, finance | business, logistics | logistics | 4 | 누락: logistics | legacy-canonical-mismatch / missing-lane-definition | Y |
| storage-location-master | 저장위치 등록 | business, finance | business, logistics | logistics | 1 | 누락: logistics | legacy-canonical-mismatch / missing-lane-definition | Y |
| 구매-요청-매입-전표-생성-f-b | 구매 요청 ~ 매입전표 생성 : F&B | business, finance | business, finance | - | - | 표시 가능 | - | N |
| 구매-요청-매입-전표-생성-it-s-w | 구매 요청 ~ 매입전표 생성 : IT, S/W | business, procurement, finance | business, procurement, finance | - | - | 표시 가능 | - | N |
| 구매-요청-매입전표-생성-인사총무 | 구매 요청 ~ 매입전표 생성 : 인사총무 | business, procurement, finance | business, procurement, finance | - | - | 표시 가능 | - | N |

## Count Summary

| Metric | Count |
| --- | ---: |
| Detail Process count in local state | 28 |
| Process with no resolved lane definition | 0 |
| Process with missing referenced lane IDs | 15 |
| Missing unique process-lane references | 18 |
| Nodes whose laneId is not visible in resolved lane definition | 79 |
| Duplicate lane label process count | 0 |

## Inventory Mismatch

이전 Workshop Navigation 문서에서는 detail process 27개를 기준으로 분석했으나, 현재 로컬 state에는 `business-to-project`가 추가로 있어 detail process가 28개이다.

확정 정책에 따라 `business-to-project`는 E2E 개념의 유효 Detail Process로 유지하며, Workshop Menu v1 live menu 연결 여부와 관계없이 기본 5 Lane 정책 적용 대상이다. 삭제나 메뉴 연결 변경은 이번 작업 범위가 아니다.

## Implementation Update

Projection/UI 계층 구현 후 visible lane 기준으로는 node가 참조하는 canonical lane이 화면에서 누락되지 않도록 보정한다. Runtime/state의 기존 `laneIds` 값은 변경하지 않는다.
