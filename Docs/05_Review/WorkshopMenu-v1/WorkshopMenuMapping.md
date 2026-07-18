# Workshop Menu v1 Mapping

이 문서는 Workshop Menu v1 구현 기준 매핑을 기록한다.

Workshop Menu는 Runtime Process, Workflow, Graph, Node, Edge를 변경하지 않는 별도 Navigation Projection이다. `implemented`와 `implemented-alias`만 live menu에 표시하고, `excluded-backlog`와 `unresolved`는 문서와 config에만 남긴다.

## Final Status

| Status | Meaning |
| --- | --- |
| implemented | 현재 Process를 live menu에 직접 연결했다. |
| implemented-alias | 현재 Process title은 유지하고 Workshop Navigation Alias로 live menu에 연결했다. |
| excluded-backlog | 연결 Process가 없거나 1차 live menu 범위가 아니므로 화면에서는 제외했다. |
| unresolved | 연결 후보는 있으나 메뉴 위치 또는 업무 범위가 확정되지 않아 화면에서는 제외했다. |

## Live Menu Mapping

| Level1 | Level2 | Level3 | Navigation Label | 연결 Process ID | 현재 Process명 | 현재 Workflow | 최종 상태 | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 사업관리 | 프로젝트 | - | 프로젝트 | business-to-purchase-request | 사업 기회 확보 ~ 구매 요청 : 제/상품 | 사업기회 -> 계약 -> 구매요청 | implemented-alias | 실제 title과 Graph는 유지한다. |
| 구매 | 프로젝트 | MD/응원봉/앨범 | MD/응원봉/앨범 | purchase-to-ap-invoice | 구매 요청 ~ 입고 ~ 매입전표 : 제/상품 | 구매요청 -> 입고 -> 매입전표 | implemented-alias | 상품유형별 Process를 복제하지 않는다. |
| 구매 | 프로젝트 | 공연/콘텐츠/플랫폼 | 공연/콘텐츠/플랫폼 | service-purchase-to-ap | 구매 요청 ~ 매입전표 생성 : 서비스 | 구매요청 -> 매입전표 생성 | implemented-alias | 서비스 구매 Process를 Workshop Alias로 노출한다. |
| 구매 | 프로젝트 | F&B | F&B | 구매-요청-매입-전표-생성-f-b | 구매 요청 ~ 매입 전표 생성 : F&B | 구매요청 -> 매입전표 생성 | implemented | 프로젝트 구매 위치에 1회만 노출한다. |
| 구매 | 프로젝트 | 구매반품 | 구매반품 | purchase-return | 구매 반품 | 구매반품 | implemented | 반품 메뉴에서도 동일 Process ID를 참조한다. |
| 구매 | 일반 | 인사총무 | 인사총무 | 구매-요청-매입전표-생성-인사총무 | 구매 요청 ~ 매입전표 생성 : 인사총무 | 구매요청 -> 매입전표 생성 | implemented | 일반구매 인사총무로 노출한다. |
| 구매 | 일반 | IT/SW | IT/SW | 구매-요청-매입-전표-생성-it-s-w | 구매 요청 ~ 매입 전표 생성 : IT·S/W | 구매요청 -> 매입전표 생성 | implemented | 일반구매 IT/SW로 노출한다. |
| 판매 | B2B | - | B2B | b2b-domestic-order-to-sales | 주문등록 ~ 출고 ~ 매출전표 : B2B 국내 | 주문 -> 출고 -> 매출전표 | implemented | B2B 국내 판매로 노출한다. |
| 판매 | B2B 수출 | - | B2B 수출 | b2b-export-order-to-sales | 주문등록 ~ 출고 ~ 매출전표 : B2B 해외 | 주문 -> 출고 -> 매출전표 | implemented | B2B 해외/수출 판매로 노출한다. |
| 판매 | 온라인몰 | - | 온라인몰 | b2c-order-to-sales | 주문등록 ~ 출고 ~ 매출전표 : B2C | 주문 -> 출고 -> 매출전표 | implemented-alias | B2C를 Workshop 용어 온라인몰로 노출한다. |
| 판매 | 예약판매 | - | 예약판매 | preorder-to-sales | 예약판매 ~ 출고 ~ 매출전표 : 예약판매 | 주문 -> 출고 -> 매출전표 | implemented | Runtime에 존재하므로 live menu에 포함했다. |
| 판매 | 사인회 | - | 사인회 | event-sales | 이벤트 매출 | 주문 -> 출고 -> 매출전표 | implemented-alias | 사인회 Alias로 노출하되 이벤트 범위 ambiguity는 backlog에 유지한다. |
| 판매 | 현장판매 | 공연/팝업 | 공연/팝업 | popup-concert-stock-sales-sync | 공연/팝업 재고 판매 동기화 | 주문 -> 출고 -> 매출전표 | implemented-alias | 현장판매 하위로 노출한다. |
| 판매 | 현장판매 | 매장 | 매장 | store-sales | 매장 판매 | 주문 -> 출고 -> 매출전표 | implemented-alias | 매장/POS 판매로 노출한다. |
| 반품 | 판매반품 | B2B | B2B | b2b-domestic-return | 판매 반품 : B2B 국내 | 판매반품 | implemented | 판매 메뉴가 아니라 반품 메뉴로 노출한다. |
| 반품 | 판매반품 | 온라인몰 | 온라인몰 | b2c-return | 판매 반품 : B2C | 판매반품 | implemented-alias | B2C 반품을 온라인몰 반품으로 노출한다. |
| 반품 | 구매반품 | - | 구매반품 | purchase-return | 구매 반품 | 구매반품 | implemented | 구매 > 프로젝트 > 구매반품과 동일 Process ID를 참조한다. |
| 재고 | 재고이동 | - | 재고이동 | stock-movement | 재고 이동 | 재고 이동 | implemented | 일반 재고이동으로 노출한다. |
| 재고 | 매장간 이동 | - | 매장간 이동 | stock-transfer | 재고 이동 : 창고간 | 재고 이동 | implemented-alias | Runtime title/variant는 창고간이나 Workshop Label은 매장간 이동으로 표시한다. |
| 재고 | 기타입고 | - | 기타입고 | other-receipt | 기타 입고 | 기타 입고 | implemented | Runtime에 존재하므로 live menu에 포함했다. |
| 재고 | 기타출고 | - | 기타출고 | other-issue | 기타 출고 | 기타 출고 | implemented | 기타출고로 노출한다. |
| 정산 | 로열티정산 | 기획사 | 기획사 | royalty-mg-settlement | 로열티/MG 정산 : 기획사 | 로열티/MG 정산 | implemented | 기획사 로열티/MG 정산으로 노출한다. |
| 정산 | 판매대행 정산 | 판매대행 | 판매대행 | consignment-settlement | 위탁 매출 정산 : 위탁 | 위탁 매출 정산 | implemented-alias | 판매대행 정산 Alias로 노출하되 용어 ambiguity는 backlog에 유지한다. |
| 정산 | 수익배분정산 | 매출·비용 | 매출·비용 | revenue-share-settlement | 수익배분 정산 : 수익배분 | 수익배분 정산 | implemented | Runtime에 존재하므로 live menu에 포함했다. |
| 정산 | 프로젝트정산 | 매출·비용 | 매출·비용 | service-project-settlement | 프로젝트 정산 : 서비스 | 프로젝트 정산 | implemented | 프로젝트 정산으로 노출한다. |

## Excluded And Unresolved Entries

| Level1 | Level2 | Level3 | Navigation Label | 연결 Process ID | 최종 상태 | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 기준정보 | 기준정보 | 거래처 | 거래처 | - | excluded-backlog | 독립 Detail Process가 없어 live menu에서 제외한다. |
| 기준정보 | 기준정보 | 품목 | 품목 | - | excluded-backlog | 독립 Detail Process가 없어 live menu에서 제외한다. |
| 사업관리 | 일반운영 | - | 일반운영 | - | excluded-backlog | 일반 품의/발의 Process가 없어 live menu에서 제외한다. |
| 구매 | 프로젝트 | 수입 | 수입 | - | excluded-backlog | 수입 구매 전용 Process가 없어 live menu에서 제외한다. |
| 구매 | 일반 | 연구개발 | 연구개발 | - | excluded-backlog | 독립 연구개발 구매 Process가 없어 live menu에서 제외한다. |
| 판매 | 서비스매출 | - | 서비스매출 | service-order-to-sales | unresolved | v1 live menu에는 포함하지 않고 위치를 검토한다. |
| 사업관리 | 서비스 비용정산 | - | 서비스 비용정산 | service-business-to-expense | unresolved | 사업관리 > 프로젝트 또는 일반운영 중 위치를 확정해야 한다. |
| 기준정보 | 기준정보 | 저장위치 | 저장위치 | storage-location-master | unresolved | 기준정보 노출 후보이나 현재 승인 메뉴에는 포함하지 않는다. |

## Duplicate Process References

| Process ID | Navigation Entries | Handling |
| --- | --- | --- |
| purchase-return | 구매 > 프로젝트 > 구매반품 / 반품 > 구매반품 | 동일 Process를 복제하지 않고 두 Navigation Entry가 같은 Process ID를 참조한다. UI active 상태는 navigationId를 우선한다. |
