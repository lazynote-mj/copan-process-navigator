# SCM Process Numbering Governance

|Field|Value|
|---|---|
|Title|SCM Process Numbering Governance|
|Purpose|SCM Detail Process 01~21의 번호, 정의, Douzone Source, Copan 업무 해석을 고정하기 위한 기준 문서|
|Status|Approved|
|Owner|혁신팀|
|Last Updated|2026-06-29|
|Related Docs|`ProcessMapping.md`, `DouzoneProcessCoverage.md`, `Docs/05_Review/Business/Process-03-Review.md`, `Docs/04_Audit/Process/scm-to-be-process-node-order.md`|

> Methodology v1.0 Frozen. 변경은 Methodology Revision 결정이 있을 때만 수행한다.

## Purpose

이 문서는 Navigator의 SCM Process 번호체계를 확정하기 위한 Governance 문서이다.

현재 Navigator는 Copan ERP Process Asset Repository이며, Detail Process 번호는 Review Package, Coverage, 현업 협의, 향후 Viewer 공개 기준으로 사용된다. 따라서 Process 번호는 단순 화면 순서가 아니라 Process Asset의 식별 기준으로 관리한다.

이번 Phase에서는 Navigator 데이터, JSON, 코드, Layout, Router를 수정하지 않는다. 번호와 정의의 판단 기준만 문서화한다.

## Scope

대상은 SCM 영역 Detail Process 01~21이다.

구축 대상 Capability는 다음 SCM 범위로 한정한다.

- 계약/프로젝트관리
- 구매관리
- 매입/입고관리
- 영업/주문관리
- 출고관리
- 재고관리
- 반품관리
- 정산관리
- 해외업무
- 플랫폼
- 콘텐츠/서비스
- 이벤트
- 공연장/팝업
- 매장/POS

공통관리, 조직관리, 인사관리, 회계관리, 세무관리는 Navigator 구축 대상이 아니라 Reference Only로 관리한다.

## Governance Principles

1. Process No는 Review Package와 Coverage의 기준 식별자이다.
2. Process No 변경은 Navigator 데이터 수정 전에 먼저 이 문서에서 `Change Required`로 표시하고, 혁신팀 Review를 거친다.
3. Process Name 보정은 번호 변경 없이 가능하지만, 업무 정의가 바뀌면 `Review` 상태로 둔다.
4. Douzone Process와 Navigator Process는 1:1이 아닐 수 있다. Copan 운영 방식에 따라 1:N 또는 N:1로 재해석할 수 있다.
5. Lane은 Execution System이 아니라 Owner 기준으로 판단한다.
6. Auto Node는 Execution System이 아니라 직전 Business Activity의 Owner를 따른다.
7. Coverage는 Approved 이후에만 Complete로 변경한다.

## Status Definition

|Status|Meaning|
|---|---|
|Confirmed|현재 번호와 업무 정의를 유지할 수 있음|
|Review|번호는 유지하되 업무 정의, 명칭, 또는 Source 해석에 검토가 필요함|
|Change Required|번호 또는 Process 정의 변경이 필요하다고 판단됨|

## Numbering Matrix

| No | Process | Capability | Douzone | Copan | Status | Remark |
|---|---|---|---|---|---|---|
|01|사업 기회 확보 ~ 구매 요청 : 제/상품|계약/프로젝트관리 / 기준정보관리 / 구매관리|품목 등록 PROCESS / 거래처 등록 PROCESS / 계약 등록 PROCESS / 구매 입고 PROCESS|사업기회, 사업참여검토, 계약, 프로젝트, WBS, 품목/거래처 기준정보, 구매요청을 SCM Lifecycle 시작점으로 구성|Confirmed|현재 정의 유지. 계약/프로젝트관리와 구매관리의 연결 Process로 관리한다.|
|02|구매 요청 ~ 입고 ~ 매입 전표 : 제/상품|구매관리 / 매입·입고관리 / 재고관리|구매 입고 PROCESS|구매요청, 발주, EasyAdmin WMS 입고, ERP 재고(+), 매입마감, 전표생성(미결), 전표조회승인|Confirmed|현재 정의 유지. 구매/매입관리의 표준 제/상품 구매입고 Process이다.|
|03|주문 등록 ~ 출고 ~ 매출 전표 : B2B 국내|영업/주문관리 / 출고관리 / 재고관리|국내 B2B 판매 PROCESS|B2B 국내 주문등록, 출고요청/확정, 위탁 여부, 재고(-), 매출마감, 전표생성(미결), 전표조회승인|Confirmed|현재 정의 유지. B2B 국내 표준 판매 Process이다.|
|04|주문 반품 ~ 입고 ~ 반품 전표 : B2B 국내|반품관리 / 재고관리|B2B 판매 반품 PROCESS|B2B 국내 반품요청, 반품입고, 재고(+), 반품마감, 전표 처리|Confirmed|현재 정의 유지. 반품관리 Batch에서 상세 보정 대상이다.|
|05|주문 등록 ~ 수출 출고 ~ 매출 전표 : B2B 해외|해외업무 / 영업·주문관리 / 출고관리 / 재고관리|자사 재고 해외 B2B PROCESS / 위탁 재고 해외 B2B PROCESS|해외 B2B 수주, 수출 이동지시, 송장입력, 통관, B/L, 해외 가상창고, 매출마감, 전표 처리|Confirmed|현재 정의 유지. Internal Review Ready 상태로 유지한다.|
|06|주문 등록 ~ 출고 ~ 매출 전표 : B2C|영업/주문관리 / 출고관리 / 재고관리|B2C 판매 PROCESS|Cafe24/온라인몰, EasyAdmin OMS, EasyAdmin WMS, OmniEsol ERP, 매출마감, 전표조회승인|Confirmed|현재 정의 유지. B2C 온라인 표준 판매 Process이다.|
|07|예약 판매 ~ 출고 ~ 매출전표 : B2C|영업/주문관리 / 출고관리 / 정산관리|B2C 판매 PROCESS|예약판매, PG 정산, 선수금 처리/반제, EasyAdmin 출고, 매출마감, 전표조회승인|Confirmed|현재 정의 유지. B2C 예약판매는 07의 변형 Process로 관리한다.|
|08|주문 반품 ~ 입고 ~ 반품전표 : B2C|반품관리 / 재고관리|B2C 판매 반품 PROCESS|온라인몰 반품요청, EasyAdmin OMS 반품수집, EasyAdmin WMS 반품입고, ERP 재고(+), 반품마감, 전표 처리|Confirmed|현재 정의 유지. B2C 반품 표준 Process이다.|
|09|공연장/팝업 판매 ~ 출고 ~ 매출전표 : 제/상품|공연장/팝업 / 영업·주문관리 / 출고관리 / 재고관리|공연장(행사장) 팝업 PROCESS|공연장/팝업 출고, 현장 판매, 잔여재고 복귀, 매출마감, 전표 처리|Confirmed|현재 정의 유지. 판매현장 운영을 별도 Process로 관리한다.|
|10|이벤트 : 제/상품|이벤트 / 영업·주문관리 / 출고관리 / 재고관리|이벤트 PROCESS|Cafe24 이벤트 주문, 당첨자 여부, 현장수령/택배발송 분리, EasyAdmin 출고, 전표 처리|Confirmed|현재 정의 유지. 이벤트 운영 특성상 현장수령과 택배발송 분기를 포함한다.|
|11|매장 판매 ~ 출고 ~ 매출전표 : 제/상품|매장/POS / 영업·주문관리 / 출고관리 / 재고관리|매장 출고 PROCESS|POS/EasyChain 매출연동, ERP 주문/출고, 재고(-), 매출마감, 전표 처리|Confirmed|현재 정의 유지. 매장 판매는 온라인 B2C와 분리한다.|
|12|매장 간 재고이동 : 제/상품|재고관리 / 매장/POS|매장 재고이동 PROCESS / 재고이동 PROCESS|매장 간 재고이동, POS/EasyChain 확정, ERP 입/출고정보 반영|Confirmed|현재 정의 유지. 재고관리 Batch의 우선 후보이다.|
|13|기타 출고 : 제/상품|출고관리 / 재고관리|기타 출고 PROCESS|무상 증정품, 사용품의, 위탁 여부, EasyAdmin 출고확정|Confirmed|현재 정의 유지. 기타 출고는 판매 출고와 분리한다.|
|14|기획사 로열티 정산 : 제/상품|정산관리|판매 로열티 정산 PROCESS|사업부 로열티 매출 집계, 재무 마감확정, MG 차감 여부, 정산마감, ERP 자동 전표생성/자동승인|Confirmed|현재 정의 유지. 정산관리 Capability Review 대상이다.|
|15|위탁 매출 정산|정산관리|위탁 매출 정산 PROCESS|사업부 위탁 매출 집계, 재무 마감확정, 예외처리, 정산마감, ERP 자동 전표생성/자동승인|Confirmed|현재 정의 유지.|
|16|수익배분 매출 정산|정산관리|위탁 매출 정산 PROCESS / 판매 로열티 정산 PROCESS|수익배분 계약 기준 매출/비용 집계, 재무 마감확정, MG 차감, 정산마감, ERP 자동 전표생성/자동승인|Confirmed|현재 정의 유지. Douzone 단일 Source가 아니라 정산 Process 조합으로 해석한다.|
|17|사업기회 ~ 비용 전표 생성 : 서비스|계약/프로젝트관리 / 콘텐츠·서비스|계약 등록 PROCESS / 비용청구관리|서비스 사업기회, 계약/프로젝트, 지출결의, 비용전표 중심 운영|Review|서비스 비용 Process는 01 계약/프로젝트 Lifecycle과 일부 중복된다. 번호 변경은 필요하지 않지만 서비스 비용 범위와 명칭은 Review가 필요하다.|
|18|구매 요청 ~ 매입 전표 생성 : 서비스|구매관리 / 매입·입고관리 / 콘텐츠·서비스|구매 입고 PROCESS|서비스 구매요청, 검수/부분권한 기준 입고확정, 매입마감, 전표생성(미결), 전표조회승인|Confirmed|현재 정의 유지. 재고 입고가 아닌 서비스 매입 Process로 관리한다.|
|19|주문 등록 ~ 매출 전표 생성 : 서비스|콘텐츠·서비스 / 영업·주문관리|플랫폼 비재고 매출 PROCESS / 콘텐츠 비재고 매출 PROCESS|서비스 제공 확인, 매출마감확정, 전표생성(미결), 전표조회승인|Confirmed|현재 정의 유지. 비재고 서비스 매출 Process이다.|
|20|프로젝트 정산 : 서비스|정산관리 / 콘텐츠·서비스|위탁 매출 정산 PROCESS / 판매 로열티 정산 PROCESS|서비스 프로젝트 매출/비용 집계, 재무 마감확정, MG 차감, 정산마감, ERP 자동 전표생성/자동승인|Confirmed|현재 정의 유지. 서비스 정산 Process로 관리한다.|

## Process 03 Deletion Decision Note

Process 03, previously “구매 요청 ~ 입고 : 판매 대행”, has been removed from the active Navigator process list.

Reason: 판매대행/위탁 입고는 별도 Detail Process로 유지하지 않고, 구매/입고 또는 재고/위탁 관련 프로세스에서 필요한 경우 재해석한다.

Numbering impact: former Process 04-21 are renumbered to Process 03-20.

## Change Impact Summary

|Category|Process No|Assessment|
|---|---|---|
|번호 변경 필요|03 삭제 반영|기존 Process 03 삭제에 따라 기존 04-21을 03-20으로 당긴다.|
|정의 검토 필요|17|기존 18 서비스 비용 Process는 서비스 계약/프로젝트 Lifecycle과 일부 중복 범위 검토가 필요하다.|
|현재 번호 유지 가능|01-20|03 삭제 후 재부여된 번호체계를 기준으로 유지한다.|

## Inventory Batch Readiness

재고관리 Batch는 시작 가능하다.

다만 아래 전제를 둔다.

1. 삭제된 판매대행/위탁 입고 Process는 재고관리 Batch에서 별도 Detail Process로 참조하지 않는다.
2. 구매반품이 별도 SCM 필수 Process라면 신규 Process 후보로 관리한다.
3. 재고관리 Batch의 우선 대상은 12 매장 간 재고이동, 13 기타 출고, 02/06/08/11의 재고(+/-) 연결 검토로 둔다.

## Next Actions

1. 서비스 비용 Process 17의 범위를 서비스 계약/프로젝트 Process와 분리할지 확인한다.
2. 구매반품 별도 Process 필요 여부를 반품/재고 Batch에서 검토한다.
3. 추가 번호 변경이 필요하다고 결정되면 이 문서에서 먼저 `Change Required`로 상태를 변경한 뒤 Navigator 데이터를 수정한다.
