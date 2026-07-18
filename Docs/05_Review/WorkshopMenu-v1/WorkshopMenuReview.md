# Workshop Menu v1 Review

이 문서는 Workshop Menu v1 구현 결과와 남은 확인 사항을 정리한다.

Workshop Menu는 Runtime Process, Workflow, Graph, Node, Edge를 변경하지 않는 별도 Navigation Projection이다. 목적은 워크숍 발표자가 원하는 TO-BE Process를 빠르게 찾는 것이다.

## Implementation Summary

| Item | Result |
| --- | --- |
| Runtime Detail Process 수 | 27 |
| Live navigation entry 수 | 25 |
| 연결된 고유 Runtime Process 수 | 24 |
| Alias mapping 수 | 10 |
| 중복 Process 참조 수 | 1 |
| Backlog 항목 수 | 5 |
| Unresolved 항목 수 | 3 |
| Runtime/state 변경 | 없음 |

## Mapping Status Counts

| Status | Count | Notes |
| --- | ---: | --- |
| implemented | 15 | 현재 Process를 live menu에 직접 연결 |
| implemented-alias | 10 | 현재 Process title은 유지하고 Workshop Alias로 live menu에 연결 |
| excluded-backlog | 5 | 연결 Process가 없거나 1차 live menu 범위가 아니어서 제외 |
| unresolved | 3 | 연결 후보는 있으나 위치 또는 업무 범위 미확정으로 제외 |

## Live Menu Tree

```text
사업관리
└─ 프로젝트

구매
├─ 프로젝트
│  ├─ MD/응원봉/앨범
│  ├─ 공연/콘텐츠/플랫폼
│  ├─ F&B
│  └─ 구매반품
└─ 일반
   ├─ 인사총무
   └─ IT/SW

판매
├─ B2B
├─ B2B 수출
├─ 온라인몰
├─ 예약판매
├─ 사인회
└─ 현장판매
   ├─ 공연/팝업
   └─ 매장

반품
├─ 판매반품
│  ├─ B2B
│  └─ 온라인몰
└─ 구매반품

재고
├─ 재고이동
├─ 매장간 이동
├─ 기타입고
└─ 기타출고

정산
├─ 로열티정산
│  └─ 기획사
├─ 판매대행 정산
│  └─ 판매대행
├─ 수익배분정산
│  └─ 매출·비용
└─ 프로젝트정산
   └─ 매출·비용
```

## Runtime Processes Outside Live Menu

| Process ID | 현재 Process명 | 처리 |
| --- | --- | --- |
| service-business-to-expense | 사업 기회 확보 ~ 비용 정산 : 서비스 | unresolved. 사업관리 > 프로젝트 또는 일반운영 중 위치 확인 필요 |
| service-order-to-sales | 주문등록 ~ 매출전표 생성 : 서비스 | unresolved. 판매 > 서비스매출 필요 여부 확인 |
| storage-location-master | 저장위치 마스터 : 단일 | unresolved. 기준정보 > 저장위치 노출 여부 확인 |

## Excluded Backlog

| Item | Reason |
| --- | --- |
| 기준정보 > 거래처 | 독립 Detail Process 없음 |
| 기준정보 > 품목 | 독립 Detail Process 없음 |
| 사업관리 > 일반운영 | 일반 품의/발의 Detail Process 없음 |
| 구매 > 프로젝트 > 수입 | 수입 구매 전용 Process 없음 |
| 구매 > 일반 > 연구개발 | 독립 연구개발 구매 Process 불명확 |

이 항목들은 live menu에서 제외했고, 빈 화면, 잘못된 Process 연결, 임시 Process 생성은 하지 않았다.

## Duplicate Process Reference

| Process ID | Navigation Entries | Handling |
| --- | --- | --- |
| purchase-return | 구매 > 프로젝트 > 구매반품 / 반품 > 구매반품 | 동일 Process를 복제하지 않고 두 Navigation Entry가 같은 Process ID를 참조한다. UI active 상태는 `navigationId`를 우선한다. |

## Alias Mappings

| Navigation Alias | Process ID | Notes |
| --- | --- | --- |
| 프로젝트 | business-to-purchase-request | 실제 title은 유지 |
| MD/응원봉/앨범 | purchase-to-ap-invoice | 상품유형별 복제 없음 |
| 공연/콘텐츠/플랫폼 | service-purchase-to-ap | 서비스 구매 Process alias |
| 온라인몰 | b2c-order-to-sales | B2C 판매 alias |
| 사인회 | event-sales | 사인회/이벤트 범위 확인 필요 |
| 공연/팝업 | popup-concert-stock-sales-sync | 현장판매 하위 alias |
| 매장 | store-sales | 매장/POS alias |
| 온라인몰 반품 | b2c-return | B2C 반품 alias |
| 매장간 이동 | stock-transfer | Runtime title/variant는 창고간 |
| 판매대행 정산 | consignment-settlement | 위탁 매출 정산과 용어 범위 확인 필요 |

## Implementation Notes

- `src/config/workshopMenuConfig.ts`에 Workshop Menu Config를 추가했다.
- `src/lib/sidebar/buildWorkshopMenu.ts`에서 Config와 Runtime Detail Process Group을 결합해 Sidebar View Model을 만든다.
- `ProcessGroupMenu`의 detail variant는 Workshop Menu Projection을 렌더링한다.
- Overview 메뉴는 수정하지 않았다.
- Runtime/state/migration/save API는 수정하지 않았다.

## Remaining Decisions

| Decision | Recommendation |
| --- | --- |
| 서비스매출 메뉴 | Workshop에서 비수불/서비스 매출을 자주 찾는다면 판매 > 서비스매출 추가 |
| 서비스 사업관리/비용정산 | 프로젝트성 서비스인지 일반운영성 비용정산인지 확인 후 위치 결정 |
| 저장위치 기준정보 | 기준정보 live menu가 필요해질 때 거래처/품목과 함께 재검토 |
| 사인회와 이벤트 매출 | `event-sales`가 사인회 전용인지 일반 이벤트까지 포함하는지 확인 |
| 판매대행 정산 용어 | 위탁 매출 정산과 완전히 동일한지 확인 |
