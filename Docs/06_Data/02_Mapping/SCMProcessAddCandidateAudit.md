# SCM Process Add Candidate Audit

|Field|Value|
|---|---|
|Title|SCM Process Add Candidate Audit|
|Purpose|Navigator 20개 프로세스와 Douzone SCM TO-BE를 대사하여 추가 생성 후보를 확정하기 위한 기준 문서|
|Status|Draft|
|Owner|혁신팀|
|Last Updated|2026-06-30|
|Related Docs|`SCMProcessInformationArchitecture.md`, `SCMProcessOneToOneMatching.tsv`, `DouzoneProcessCoverage.md`, `ProcessMapping.md`|

## 기준

Navigator는 기존 20개 프로세스 그룹을 유지한다.

신규 프로세스는 기존 번호 사이에 끼워 넣지 않고, `Lifecycle Group` 기준으로 배치한다.

판정 기준은 다음과 같다.

|Classification|Meaning|Action|
|---|---|---|
|Add Required|Douzone SCM에 있고 Copan SCM 업무 매뉴얼로 별도 관리 필요성이 높음|다음 Phase에서 신규 Process Group 생성|
|Split Needed|기존 Process에 일부 포함되어 있으나 독립 Process로 분리 검토 필요|업무 범위 확인 후 생성|
|Review|Copan 운영 범위 확인 필요|현업/혁신팀 확인 후 결정|
|Absorbed|기존 Navigator Process 안에 흡수되어 있음|신규 생성하지 않음|
|Reference Only|ERP 설정/교육 성격이 강함|Navigator Process 생성 제외|

## Add Required 후보

|Candidate|Douzone Source|Lifecycle Group|Recommended Process ID|Reason|Initial Status|
|---|---|---|---|---|---|
|구매반품|D-SCM-008 구매 반품 PROCESS|반품|`purchase-return`|구매/입고의 역방향 흐름이며 현재 20개에 별도 Process가 없다.|Candidate|
|기타입고|D-SCM-024 기타 입고 PROCESS|재고|`other-receipt`|기타출고는 존재하지만 기타입고가 없어 재고 증감 기준이 한쪽으로만 표현된다.|Candidate|
|일반 재고이동|D-SCM-025 재고이동 PROCESS|재고|`stock-movement`|현재 `stock-transfer`는 매장 간 재고이동 성격이 강해 일반 창고/저장위치 이동과 분리 필요성이 있다.|Candidate|
|저장위치 등록|D-SCM-005 저장위치 등록 PROCESS|기준정보|`storage-location-master`|입고, 출고, 재고이동의 기준정보이며 기준정보 Lifecycle Group이 현재 비어 있다.|Candidate|

## Review 후보

|Candidate|Douzone Source|Lifecycle Group|Recommended Process ID|Reason|Decision Needed|
|---|---|---|---|---|---|
|매장 등록|D-SCM-004 매장 등록 PROCESS|기준정보|`store-master`|매장판매와 매장 재고이동의 선행 기준정보이다.|매장/POS 기준정보를 Navigator Process Asset으로 관리할지 결정|
|수입관리|D-SCM-011 수입 관리 PROCESS|구매/입고|`import-management`|해외 B2B 판매/수출과 다른 해외 구매/수입 흐름이다.|Copan SCM 운영 범위에 수입 구매가 포함되는지 확인|
|원/부자재 구매입고|D-SCM-009 원/부자재 구매 입고 PROCESS|구매/입고|`raw-material-purchase-receipt`|제조/원부자재 운영 여부에 따라 필요성이 달라진다.|Copan이 원/부자재 구매입고를 SCM 범위로 관리하는지 확인|
|원/부자재 구매반품|D-SCM-010 원/부자재 구매 반품 PROCESS|반품|`raw-material-purchase-return`|원/부자재 구매입고가 포함될 경우 함께 필요하다.|원/부자재 구매입고 포함 여부와 함께 결정|
|지사 구매입고|D-SCM-029 지사 구매 입고 PROCESS|구매/입고|`branch-purchase-receipt`|일본/미국지사 구매 운영이 있으면 별도 흐름이 필요하다.|해외지사 운영 범위 확인|
|지사 구매반품|D-SCM-030 지사 구매 반품 PROCESS|반품|`branch-purchase-return`|지사 구매입고가 대상이면 구매반품도 함께 필요하다.|해외지사 운영 범위 확인|
|지사 판매|D-SCM-031 지사 판매 PROCESS|판매|`branch-sales`|B2B 해외 수출과 별도 지사 판매 운영인지 확인 필요하다.|해외지사 판매 운영 여부 확인|
|지사 판매반품|D-SCM-032 지사 판매 반품 PROCESS|반품|`branch-sales-return`|지사 판매가 포함되면 반품도 함께 필요하다.|해외지사 판매 운영 여부 확인|
|지사 기타출고|D-SCM-033 지사 기타 출고 PROCESS|재고|`branch-other-issue`|해외지사 재고 운영 범위에 따라 필요성이 달라진다.|해외지사 재고 운영 여부 확인|

## Absorbed / 신규 생성 제외

|Douzone Source|Current Navigator Coverage|Reason|
|---|---|---|
|D-SCM-001 품목 등록 PROCESS|01 사업 기회 확보 ~ 구매 요청 : 제/상품|현재는 구매요청 전 기준정보 연결 흐름으로 흡수되어 있다. 기준정보 전용 Process 분리는 별도 결정 필요|
|D-SCM-003 거래처 등록 PROCESS|01 사업 기회 확보 ~ 구매 요청 : 제/상품|현재는 구매요청 전 기준정보 연결 흐름으로 흡수되어 있다. 기준정보 전용 Process 분리는 별도 결정 필요|
|D-SCM-006 계약 등록 PROCESS|01 / 17|제/상품과 서비스 Lifecycle 시작점으로 재해석되어 있다.|
|D-SCM-007 구매 입고 PROCESS|02 / 18|제/상품 구매입고와 서비스 구매로 분기되어 있다.|
|D-SCM-012 B2C 판매 PROCESS|06 / 07|일반 B2C와 예약판매로 분기되어 있다.|
|D-SCM-013 B2C 판매 반품 PROCESS|08|B2C 반품으로 반영되어 있다.|
|D-SCM-014 국내 B2B 판매 PROCESS|03|B2B 국내 판매로 반영되어 있다.|
|D-SCM-015 B2B 판매 반품 PROCESS|04|B2B 국내 반품으로 반영되어 있다.|
|D-SCM-016 자사 재고 해외 B2B PROCESS|05|B2B 해외에 통합되어 있다.|
|D-SCM-017 위탁 재고 해외 B2B PROCESS|05|B2B 해외에 통합되어 있다.|
|D-SCM-018 플랫폼 비재고 매출 PROCESS|19|서비스 매출로 반영되어 있다.|
|D-SCM-019 콘텐츠 비재고 매출 PROCESS|19 / 20|서비스 매출과 프로젝트 정산에 일부 반영되어 있다.|
|D-SCM-020 공연장 팝업 PROCESS|09|공연장/팝업 판매로 반영되어 있다.|
|D-SCM-021 이벤트 PROCESS|10|이벤트 Process로 반영되어 있다.|
|D-SCM-022 매장 출고 PROCESS|11|매장 판매로 반영되어 있다.|
|D-SCM-023 기타 출고 PROCESS|13|기타 출고로 반영되어 있다.|
|D-SCM-026 매장 재고이동 PROCESS|12|매장 간 재고이동으로 반영되어 있다.|
|D-SCM-027 위탁 매출 정산 PROCESS|15 / 16 / 20|위탁, 수익배분, 프로젝트 정산으로 재해석되어 있다.|
|D-SCM-028 판매 로열티 정산 PROCESS|14 / 16 / 20|로열티, 수익배분, 프로젝트 정산으로 재해석되어 있다.|

## Reference Only 후보

|Candidate|Douzone Source|Reason|
|---|---|---|
|메뉴 등록|D-SCM-002 메뉴 등록 PROCESS|ERP 교육, 권한, 공통 설정 성격이 강하다. SCM 업무 Process Asset으로 만들지는 않는다.|

## 권장 생성 순서

1. `purchase-return` 구매반품
2. `other-receipt` 기타입고
3. `stock-movement` 일반 재고이동
4. `storage-location-master` 저장위치 등록

위 4개를 먼저 Candidate Process Group으로 생성한 뒤, Review 후보는 운영 범위 확인 후 추가한다.

## 염려 사항

|Concern|Impact|Mitigation|
|---|---|---|
|기존 20개 번호 흔들림|Review Package와 Coverage 문서 혼선|신규 프로세스는 번호가 아니라 `processId`와 Lifecycle Group으로 관리|
|기준정보 Process 과분화|Viewer 메뉴가 복잡해질 수 있음|저장위치 등록은 우선 추가하고 품목/거래처/매장은 별도 Review|
|재고이동 중복|매장 간 재고이동과 일반 재고이동이 겹칠 수 있음|`stock-transfer`는 매장 간 이동, `stock-movement`는 일반 창고/저장위치 이동으로 정의|
|해외지사 범위 불명확|지사 관련 Process를 만들었다가 사용하지 않을 수 있음|지사 관련 Process는 Review 후보로 유지|
