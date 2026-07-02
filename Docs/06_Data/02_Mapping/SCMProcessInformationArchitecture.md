# SCM Process Information Architecture

|Field|Value|
|---|---|
|Title|SCM Process Information Architecture|
|Purpose|SCM Navigator 좌측 메뉴를 Copan SCM Lifecycle 기준으로 재구성하기 위한 Information Architecture 기준 문서|
|Status|Draft|
|Owner|혁신팀|
|Last Updated|2026-06-30|
|Related Docs|`ProcessMapping.md`, `SCMProcessNumbering.md`, `DouzoneProcessCoverage.md`, `SCMProcessOneToOneMatching.tsv`, `Navigator20ToDouzoneMatching.tsv`, `SCMProcessGapCandidates.tsv`|

## Purpose

Navigator는 ERP 메뉴 모음이 아니라 Copan SCM Process Asset Repository이다.

따라서 좌측 메뉴는 ERP 기능, 더존 모듈, 또는 화면 메뉴 구조를 그대로 노출하지 않는다. Builder와 Viewer가 Copan SCM 업무 흐름을 기준으로 Process를 찾고 검토할 수 있도록 SCM Lifecycle 기준으로 재구성한다.

이번 문서는 좌측 메뉴 구조를 설계하기 위한 기준이며, 코드, JSON, Navigator 데이터, Node, Edge, Layout, Router는 수정하지 않는다.

## Navigator Mission

Navigator는 Copan의 SCM 업무를 업무 흐름(Process), 책임 조직(Business Owner), 업무 수행 영역(Work Center), 실행 시스템(Execution System), ERP 메뉴(ERP Menu)까지 하나의 흐름으로 연결하여 설명하는 Process Asset Repository이다.

Navigator는 ERP 기능을 설명하는 시스템이 아니라, Copan의 업무가 어떻게 수행되는지를 표준화하고 공유하는 업무 매뉴얼이다.

## Core Principles

|Principle|Meaning|Information Architecture Impact|
|---|---|---|
|Process First|업무(Process)가 ERP보다 우선한다. ERP는 업무를 수행하기 위한 도구이다.|좌측 메뉴는 ERP 메뉴가 아니라 업무 흐름 기준으로 구성한다.|
|Douzone Is Master Source|Douzone TO-BE는 Master Source이다.|더존 SCM Process를 원천으로 대사하되 그대로 나열하지 않는다.|
|Copan Standard|더존 표준을 그대로 구현하는 것이 목적이 아니다.|Copan 실제 운영 기준으로 Process를 병합, 분리, 재명명할 수 있다.|
|Builder / Viewer|Builder는 구축/유지관리, Viewer는 조회/업무 이해를 담당한다.|Builder 메뉴는 Coverage와 Candidate를 포함할 수 있고, Viewer 메뉴는 승인된 업무 중심 Process를 우선한다.|
|Lifecycle First|SCM 업무 Lifecycle이 메뉴의 기준이다.|사업 시작, 기준정보, 구매/입고, 판매, 반품, 재고, 정산 순으로 구성한다.|
|ERP Menu Is Metadata|ERP 메뉴는 Node의 Metadata이다.|ERP 메뉴명은 Process Group 또는 좌측 메뉴의 기준이 아니다.|
|Enterprise Knowledge|Navigator는 Copan 업무 지식 저장소이다.|좌측 메뉴는 단기 편집 편의보다 장기 업무 자산 탐색성을 우선한다.|

## Design Principles

1. Douzone SCM TO-BE는 Master Source이다.
2. Navigator는 Copan SCM 운영 기준으로 재해석한 Process Asset이다.
3. 좌측 메뉴는 Business Capability 자체가 아니라 SCM Lifecycle 기준으로 구성한다.
4. Viewer는 Process 번호보다 업무명을 먼저 찾는다.
5. Builder는 Business Capability → Process Group → Process 순으로 구축한다.
6. ERP 메뉴명은 Process를 설명하는 보조 정보이며, 좌측 메뉴의 1차 기준이 아니다.
7. 현재 Navigator는 20개 Process 번호체계를 기준으로 관리한다.
8. 추가 Process 후보는 먼저 Gap으로 관리하고, 승인 후 좌측 메뉴와 Navigator 데이터에 반영한다.
9. Execution System은 Business Activity 기준으로 결정한다.
10. Business Owner와 Work Center는 구분한다.
11. ERP Menu는 Process를 설명하기 위한 Metadata로 관리한다.

## Process Group Standard

현재 Process Group은 ERP 모듈명이 아니라 SCM Lifecycle 기준으로 재구성한다.

|Order|Process Group|Primary Question For Viewer|
|---|---|---|
|1|사업 시작|사업은 어디서 시작되고 구매요청까지 어떻게 이어지는가?|
|2|기준정보|업무를 시작하기 전에 어떤 기준정보가 필요한가?|
|3|구매/입고|구매요청, 발주, 입고, 매입은 어떻게 진행되는가?|
|4|판매|채널별 주문, 출고, 매출은 어떻게 진행되는가?|
|5|반품|반품 요청, 입고, 전표는 어떻게 처리되는가?|
|6|재고|재고 이동, 기타 입출고, 실사는 어떻게 관리되는가?|
|7|정산|로열티, 위탁, 수익배분, 프로젝트 정산은 어떻게 마감되는가?|

## Target Left Menu

```text
SCM Process
1. 사업 시작
2. 기준정보
3. 구매/입고
4. 판매
5. 반품
6. 재고
7. 정산
```

## Lifecycle Group Definition

|Lifecycle Group|Meaning|Viewer Label Principle|Builder Usage|
|---|---|---|---|
|사업 시작|사업기회, 계약, 프로젝트, WBS, 구매요청으로 이어지는 SCM 시작 흐름|사업이 어떻게 시작되는지 찾기 쉽게 표현|계약/프로젝트관리, 기준정보관리, 구매관리 연결점으로 사용|
|기준정보|품목, 거래처, 저장위치, 매장 등 Process 실행 전에 필요한 Master Data 흐름|ERP 메뉴명보다 기준정보 대상을 표시|기준정보관리 Capability의 전용 Process 후보 관리|
|구매/입고|구매요청, 발주, 입고, 매입마감, 서비스 구매 흐름|구매와 입고를 한 흐름으로 표현|구매관리, 매입/입고관리, 재고관리 연결|
|판매|B2B, B2C, 예약판매, 공연장/팝업, 이벤트, 매장, 서비스 매출 흐름|판매 채널/사업유형 기준으로 표시|영업/주문관리, 출고관리, 플랫폼, 이벤트, 매장/POS 연결|
|반품|B2B/B2C 판매 반품, 구매반품 등 반대 방향의 물류/전표 흐름|반품 유형 기준으로 표시|반품관리와 재고/전표 연결|
|재고|창고이동, 매장 간 이동, 기타출고/입고, 재고조정, 실사 등 재고 상태 변경 흐름|재고가 어떻게 움직이는지 기준으로 표시|재고관리 Capability의 Process 배치|
|정산|로열티, 위탁, 수익배분, 프로젝트 정산 흐름|정산 유형 기준으로 표시|정산관리와 전표/승인 연결|

## Builder Menu Structure

Builder는 혁신팀이 Process Asset을 작성하고 검토하는 구조를 사용한다.

```text
SCM Process
├─ 사업 시작
│  ├─ 사업기회 확보 ~ 구매요청
│  └─ 서비스 프로젝트 / 비용 흐름
├─ 기준정보
│  ├─ 품목 등록
│  ├─ 거래처 등록
│  ├─ 저장위치 등록
│  └─ 매장 등록
├─ 구매/입고
│  ├─ 구매입고
│  ├─ 서비스 구매
│  ├─ 구매반품
│  └─ 수입관리
├─ 판매
│  ├─ B2B 국내
│  ├─ B2B 해외
│  ├─ 온라인(B2C)
│  ├─ 예약판매
│  ├─ 공연장/팝업
│  ├─ 이벤트
│  ├─ 매장판매
│  └─ 서비스 매출
├─ 반품
│  ├─ B2B 반품
│  └─ B2C 반품
├─ 재고
│  ├─ 매장 간 재고이동
│  ├─ 일반 재고이동
│  ├─ 기타 출고
│  ├─ 기타 입고
│  ├─ 재고조정
│  └─ 재고실사
└─ 정산
   ├─ 로열티 정산
   ├─ 위탁 매출 정산
   ├─ 수익배분 정산
   └─ 프로젝트 정산
```

Builder 메뉴는 Coverage, Review Status, Gap 후보를 함께 관리하기 위한 구조이다. 실제 좌측 메뉴에는 승인된 Process만 단계적으로 반영할 수 있다.

## Viewer Menu Structure

Viewer는 ERP 메뉴명이 아니라 자신의 업무를 찾는다. 따라서 Viewer 메뉴는 더 짧고 업무 중심이어야 한다.

```text
SCM Process
├─ 사업 시작
├─ 기준정보
├─ 구매/입고
├─ 판매
├─ 반품
├─ 재고
└─ 정산
```

Viewer 모드에서 각 Process는 다음 우선순위로 표시한다.

1. 업무명
2. 사업유형 또는 채널
3. 진행 상태
4. 승인 여부

예시:

|Bad Label|Good Label|
|---|---|
|영업관리|판매|
|B2C 판매 PROCESS|온라인(B2C) 판매|
|구매 입고 PROCESS|구매입고|
|판매 로열티 정산 PROCESS|로열티 정산|

## Current Navigator 20 Process Placement

|No|Navigator Process|detailProcessId|Lifecycle Group|Business Capability|Douzone Source|Navigator Status|Review Status|Coverage|Remark|
|---|---|---|---|---|---|---|---|---|---|
|01|사업 기회 확보 ~ 구매 요청 : 제/상품|`business-to-purchase-request`|사업 시작|계약/프로젝트관리 / 기준정보관리 / 구매관리|품목 등록 / 거래처 등록 / 계약 등록 / 구매 입고|Active|Internal Review Ready|Partial|SCM Lifecycle 시작점으로 유지|
|02|구매 요청 ~ 입고 ~ 매입 전표 : 제/상품|`purchase-to-ap-invoice`|구매/입고|구매관리 / 매입·입고관리 / 재고관리|구매 입고 PROCESS|Active|Internal Review Ready|Partial|표준 제/상품 구매입고|
|03|주문 등록 ~ 출고 ~ 매출 전표 : B2B 국내|`b2b-domestic-order-to-sales`|판매|영업/주문관리 / 출고관리 / 재고관리|국내 B2B 판매 PROCESS|Active|Draft|Partial|B2B 국내 판매|
|04|주문 반품 ~ 입고 ~ 반품 전표 : B2B 국내|`b2b-domestic-return`|반품|반품관리 / 재고관리|B2B 판매 반품 PROCESS|Active|Draft|Partial|B2B 국내 반품|
|05|주문 등록 ~ 수출 출고 ~ 매출 전표 : B2B 해외|`b2b-export-order-to-sales`|판매|해외업무 / 영업·주문관리 / 출고관리|자사 재고 해외 B2B / 위탁 재고 해외 B2B|Active|Internal Review Ready|Partial|해외 B2B 통합|
|06|주문 등록 ~ 출고 ~ 매출 전표 : B2C|`b2c-order-to-sales`|판매|영업/주문관리 / 출고관리 / 재고관리|B2C 판매 PROCESS|Active|Internal Review Ready|Partial|온라인 B2C 표준|
|07|예약 판매 ~ 출고 ~ 매출전표 : B2C|`preorder-to-sales`|판매|영업/주문관리 / 출고관리 / 정산관리|B2C 판매 PROCESS|Active|Internal Review Ready|Partial|B2C 예약판매 파생|
|08|주문 반품 ~ 입고 ~ 반품전표 : B2C|`b2c-return`|반품|반품관리 / 재고관리|B2C 판매 반품 PROCESS|Active|Internal Review Ready|Partial|B2C 반품|
|09|공연장/팝업 판매 ~ 출고 ~ 매출전표 : 제/상품|`popup-concert-stock-sales-sync`|판매|공연장/팝업 / 영업·주문관리 / 출고관리|공연장(행사장) 팝업 PROCESS|Active|Internal Review Ready|Partial|현장 판매|
|10|이벤트 : 제/상품|`event-sales`|판매|이벤트 / 영업·주문관리 / 출고관리|이벤트 PROCESS|Active|Internal Review Ready|Partial|이벤트/당첨자/현장수령 분기|
|11|매장 판매 ~ 출고 ~ 매출전표 : 제/상품|`store-sales`|판매|매장/POS / 영업·주문관리 / 출고관리|매장 출고 PROCESS|Active|Internal Review Ready|Partial|매장/POS 판매|
|12|매장 간 재고이동 : 제/상품|`stock-transfer`|재고|재고관리 / 매장/POS|재고이동 PROCESS / 매장 재고이동 PROCESS|Active|Draft|Partial|일반 재고이동 분리 검토|
|13|기타 출고 : 제/상품|`other-issue`|재고|출고관리 / 재고관리|기타 출고 PROCESS|Active|Draft|Partial|기타 입고 별도 후보|
|14|기획사 로열티 정산 : 제/상품|`royalty-mg-settlement`|정산|정산관리|판매 로열티 정산 PROCESS|Active|Internal Review Ready|Partial|로열티/MG 정산|
|15|위탁 매출 정산|`consignment-settlement`|정산|정산관리|위탁 매출 정산 PROCESS|Active|Internal Review Ready|Partial|위탁 정산|
|16|수익배분 매출 정산|`revenue-share-settlement`|정산|정산관리|위탁 매출 정산 / 판매 로열티 정산|Active|Internal Review Ready|Partial|Copan 계약 유형 파생|
|17|사업기회 ~ 비용 전표 생성 : 서비스|`service-business-to-expense`|사업 시작|계약/프로젝트관리 / 콘텐츠·서비스|계약 등록 PROCESS / 비용청구관리|Active|Draft|Partial|서비스 프로젝트/비용 흐름|
|18|구매 요청 ~ 매입 전표 생성 : 서비스|`service-purchase-to-ap`|구매/입고|구매관리 / 매입·입고관리 / 콘텐츠·서비스|구매 입고 PROCESS|Active|Internal Review Ready|Partial|서비스 구매|
|19|주문 등록 ~ 매출 전표 생성 : 서비스|`service-order-to-sales`|판매|콘텐츠·서비스 / 영업·주문관리|플랫폼 비재고 매출 / 콘텐츠 비재고 매출|Active|In Review|Partial|서비스 매출|
|20|프로젝트 정산 : 서비스|`service-project-settlement`|정산|정산관리 / 콘텐츠·서비스|콘텐츠 비재고 매출 / 위탁 매출 정산 / 판매 로열티 정산|Active|Internal Review Ready|Partial|서비스 프로젝트 정산|

## Douzone SCM 33 Process Placement

|Douzone No|Douzone Process|Page|Lifecycle Group|Navigator Mapping|Mapping Decision|Recommended Action|
|---|---|---|---|---|---|---|
|D-SCM-001|품목 등록 PROCESS|46|기준정보|01|Absorbed|기준정보 전용 Process 분리 검토|
|D-SCM-002|메뉴 등록 PROCESS|47|기준정보|없음|Reference Only 후보|SCM Process Asset 대상 여부 검토|
|D-SCM-003|거래처 등록 PROCESS|48|기준정보|01|Absorbed|기준정보 전용 Process 분리 검토|
|D-SCM-004|매장 등록 PROCESS|49|기준정보|없음|Missing / Review|매장/POS 기준정보 추가 후보|
|D-SCM-005|저장위치 등록 PROCESS|50|기준정보|없음|Missing / Review|창고/저장위치 기준정보 추가 후보|
|D-SCM-006|계약 등록 PROCESS|51-52|사업 시작|01 / 18|Absorbed / Split|현재 구조 유지, 서비스 범위 보완|
|D-SCM-007|구매 입고 PROCESS|53|구매/입고|02 / 03 / 19|Split|현재 구조 유지|
|D-SCM-008|구매 반품 PROCESS|54|반품|없음|Missing|신규 Process 후보|
|D-SCM-009|원/부자재 구매 입고 PROCESS|55|구매/입고|없음|Missing / Review|Copan 적용 대상 확인|
|D-SCM-010|원/부자재 구매 반품 PROCESS|56|반품|없음|Missing / Review|Copan 적용 대상 확인|
|D-SCM-011|수입 관리 PROCESS|59|구매/입고|없음|Missing / Review|수입관리 추가 여부 검토|
|D-SCM-012|B2C 판매 PROCESS|60|판매|07 / 08|Split|현재 구조 유지|
|D-SCM-013|B2C 판매 반품 PROCESS|61|반품|09|1:1 Title Changed|현재 구조 유지|
|D-SCM-014|국내 B2B 판매 PROCESS|62|판매|04|1:1 Title Changed|현재 구조 유지|
|D-SCM-015|B2B 판매 반품 PROCESS|63|반품|05|1:1 Title Changed|현재 구조 유지|
|D-SCM-016|자사 재고 해외 B2B PROCESS|64|판매|06|Combined|현재 구조 유지|
|D-SCM-017|위탁 재고 해외 B2B PROCESS|65|판매|06|Combined|현재 구조 유지|
|D-SCM-018|플랫폼 비재고 매출 PROCESS|66|판매|20|1:1 / Combined|현재 구조 유지|
|D-SCM-019|콘텐츠 비재고 매출 PROCESS|67|판매 / 정산|20 / 21|Split / Partial|콘텐츠 특화 분리 여부 검토|
|D-SCM-020|공연장(행사장) 팝업 PROCESS|68|판매|10|1:1 Title Changed|현재 구조 유지|
|D-SCM-021|이벤트 PROCESS|69|판매|11|1:1 Title Changed|현재 구조 유지|
|D-SCM-022|매장 출고 PROCESS|70|판매|12|1:1 Title Changed|현재 구조 유지|
|D-SCM-023|기타 출고 PROCESS|71,75|재고|14|1:1 Title Changed|현재 구조 유지|
|D-SCM-024|기타 입고 PROCESS|72|재고|없음|Missing|신규 Process 후보|
|D-SCM-025|재고이동 PROCESS|73|재고|13|Partial / Combined|일반 재고이동 분리 검토|
|D-SCM-026|매장 재고이동 PROCESS|74|재고|13|1:1 Title Changed|현재 구조 유지|
|D-SCM-027|위탁 매출 정산 PROCESS|76|정산|16 / 17 / 21|Split / Derived|현재 구조 유지|
|D-SCM-028|판매 로열티 정산 PROCESS|77|정산|15 / 17 / 21|Split / Derived|현재 구조 유지|
|D-SCM-029|지사 구매 입고 PROCESS|78|구매/입고|없음|Missing / Review|해외지사 운영 범위 확인|
|D-SCM-030|지사 구매 반품 PROCESS|79|반품|없음|Missing / Review|해외지사 운영 범위 확인|
|D-SCM-031|지사 판매 PROCESS|80|판매|없음|Missing / Review|해외지사 운영 범위 확인|
|D-SCM-032|지사 판매 반품 PROCESS|81|반품|없음|Missing / Review|해외지사 운영 범위 확인|
|D-SCM-033|지사 기타 출고 PROCESS|82|재고|없음|Missing / Review|해외지사 운영 범위 확인|

## Gap Process

Gap Process는 현재 Navigator 20개에 명시적으로 없거나, 기존 Process에 일부 흡수되어 있어 좌측 메뉴 재구성 시 별도 노출 여부를 결정해야 하는 Process이다.

|Gap|Douzone Source|Lifecycle Group|Priority|Recommended Classification|Decision Needed|
|---|---|---|---|---|---|
|구매반품|구매 반품 PROCESS|반품|High|Add Required 후보|별도 Process Group으로 추가할지 결정|
|기타입고|기타 입고 PROCESS|재고|High|Add Required 후보|재고실사/기타입고 운영 필요성 확인|
|일반 재고이동|재고이동 PROCESS|재고|High|Split Review|13 매장 간 재고이동과 분리할지 결정|
|저장위치 등록|저장위치 등록 PROCESS|기준정보|High|Add or Reference Review|창고/저장위치 기준정보를 Process Asset으로 관리할지 결정|
|매장 등록|매장 등록 PROCESS|기준정보|Medium|Add or Reference Review|매장/POS 기준정보를 Process Asset으로 관리할지 결정|
|수입관리|수입 관리 PROCESS|구매/입고|Medium|Add or Reference Review|해외 구매/수입 업무가 Copan SCM 범위인지 확인|
|원/부자재 구매입고|원/부자재 구매 입고 PROCESS|구매/입고|Medium|Business Scope Review|원/부자재/제조성 구매 운영 여부 확인|
|원/부자재 구매반품|원/부자재 구매 반품 PROCESS|반품|Medium|Business Scope Review|원/부자재 구매입고와 함께 판단|
|지사 구매입고|지사 구매 입고 PROCESS|구매/입고|Medium|Business Scope Review|일본/미국지사 운영 범위 확인|
|지사 구매반품|지사 구매 반품 PROCESS|반품|Medium|Business Scope Review|일본/미국지사 운영 범위 확인|
|지사 판매|지사 판매 PROCESS|판매|Medium|Business Scope Review|해외 B2B 수출과 별도 운영 여부 확인|
|지사 판매반품|지사 판매 반품 PROCESS|반품|Medium|Business Scope Review|지사 판매 포함 시 함께 검토|
|지사 기타출고|지사 기타 출고 PROCESS|재고|Medium|Business Scope Review|해외지사 재고 운영 범위 확인|
|메뉴 등록|메뉴 등록 PROCESS|기준정보|Low|Reference Only 후보|ERP 교육/권한/공통 설정으로 둘지 결정|

## Additional Process Candidates

우선 추가 검토 대상은 아래 8개이다.

|Candidate|Lifecycle Group|Priority|Reason|
|---|---|---|---|
|구매반품|반품|High|더존 SCM에는 있으나 Navigator 20개에 없음|
|기타입고|재고|High|기타출고는 있으나 기타입고가 없음|
|일반 재고이동|재고|High|현재 12는 매장 간 이동 중심이라 일반 창고이동이 모호함|
|재고조정|재고|Medium|재고실사/기타입고와 연결될 수 있음|
|재고실사|재고|Medium|기타입고 Source의 운영 해석 후보|
|저장위치 등록|기준정보|High|입고/출고/재고이동 전반의 기준정보|
|매장 등록|기준정보|Medium|매장판매/매장재고이동의 선행 기준정보|
|수입관리|구매/입고|Medium|수출판매와 다른 해외 구매/수입 흐름|

## Process Metadata For Menu Governance

각 Process는 좌측 메뉴 반영 전 다음 정보를 함께 관리한다.

|Metadata|Meaning|
|---|---|
|Process No|Navigator Process 식별 번호|
|Process Name|Viewer에게 표시할 업무 중심 Process 이름|
|Business Capability|Methodology v1.0의 Capability|
|Lifecycle Group|좌측 메뉴의 7개 Lifecycle Group 중 하나|
|Douzone Source|Master Source의 대응 Process|
|Copan Interpretation|Copan 운영 기준으로 바꾼 해석|
|Navigator Status|Active / Candidate / Reference Only / Deferred|
|Review Status|Draft / Internal Review Ready / Business Review / Approved|
|Coverage|Missing / Planned / Partial / Complete / Reference Only|

## Future Extension Principles

1. 새 Process는 먼저 Douzone Source와 Lifecycle Group을 지정한다.
2. 기존 21개와 중복되는 경우 신규 Process를 만들기 전에 Absorb 또는 Split 여부를 검토한다.
3. Viewer 메뉴에는 승인되지 않은 Candidate를 기본 노출하지 않는다.
4. Builder 메뉴에는 Candidate와 Gap을 표시할 수 있다.
5. Process 번호는 Review Package와 Coverage의 기준이므로 임의 변경하지 않는다.
6. 추가 Process가 승인되면 `SCMProcessNumbering.md`, `ProcessMapping.md`, `DouzoneProcessCoverage.md`를 함께 갱신한다.
7. JSON 반영은 이 문서 승인 후 별도 Phase에서 수행한다.

## Next Phase Checklist

좌측 메뉴 JSON 반영 전 아래 항목을 확인한다.

|Check|Status|
|---|---|
|7개 Lifecycle Group 승인|Pending|
|현재 21개 Process의 Lifecycle Group 승인|Pending|
|Gap Process 중 즉시 추가 대상 결정|Pending|
|Viewer 메뉴와 Builder 메뉴를 분리할지 결정|Pending|
|좌측 메뉴에서 번호 표시 방식 결정|Pending|
|Candidate Process를 메뉴에 숨김/표시할지 결정|Pending|
