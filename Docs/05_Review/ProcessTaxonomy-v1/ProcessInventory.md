# Navigator Process Taxonomy v1 - Process Inventory

|Field|Value|
|---|---|
|Status|Architecture Analysis / Candidate|
|Scope|Current Navigator runtime detail processes|
|Runtime Baseline|`public/process-data/state.local.json`, schemaVersion 3|
|Generated At|2026-07-14|
|Important Constraint|No code, menu, runtime data, workflow, capability, migration, or state change is implied by this inventory.|

## Principles

- Business Service is proposed from the work a user is trying to perform, not from ERP menu names.
- Current TO-BE process titles are evidence, not target menu names.
- Capability, Business Service, and Business Context are candidates only.
- Evidence is based on repository documents and current runtime process metadata.

## Inventory

| Process ID | Current Process Name | Source Document | Candidate Capability | Candidate Business Service | Candidate Business Context | Evidence | Confidence | Notes |
|---|---|---|---|---|---|---|---:|---|
| `business-to-purchase-request` | 사업 기회 확보 ~ 구매 요청 : 제/상품 | SCM TO-BE / ProcessMapping / Runtime | 사업관리 | 사업기회/계약관리 | 제/상품, 구매요청 선행 | ProcessMapping No.01 maps opportunity, contract, project, item/vendor reference, and purchase request into SCM lifecycle start; runtime nodes start with 사업기회확보 and 계약등록. | 0.90 | 구매요청까지 포함하므로 구매와의 경계는 후속 Canonical Mapping 필요. |
| `purchase-to-ap-invoice` | 구매 요청 ~ 입고 ~ 매입전표 : 제/상품 | SCM TO-BE / ProcessMapping / Runtime | 구매 | 구매입고관리 | 제/상품, 입고, 매입전표 | ProcessMapping No.02 and node order show 구매요청, 발주, 입고, 매입마감, 전표생성. | 0.95 | 구매요청관리와 입고관리로 분리할지 검토 가능. |
| `b2b-domestic-order-to-sales` | 주문 등록 ~ 출고 ~ 매출전표 : B2B 국내 | SCM TO-BE / Douzone Matching / Runtime | 판매 | 주문관리 | B2B 국내, 출고, 매출전표 | Navigator20ToDouzone maps to 국내 B2B 판매 PROCESS; runtime nodes start with 주문등록 and include 출고요청/매출마감. | 0.95 | B2B 거래를 POS/매장 판매와 분리하는 context 필요. |
| `b2b-domestic-return` | 주문 반품 ~ 입고 ~ 반품전표 : B2B 국내 | SCM TO-BE / Douzone Matching / Runtime | 반품 | 반품관리 | B2B 국내, 반품입고, 반품전표 | Douzone matching maps to B2B 판매 반품 PROCESS; runtime nodes include 반품주문등록, 출고반품요청, 반품확정. | 0.95 | 판매반품과 구매반품은 같은 capability 아래 sibling 후보. |
| `b2b-export-order-to-sales` | 주문 등록 ~ 수출 출고 ~ 매출전표 : B2B 해외 | SCM TO-BE / Douzone Matching / Runtime | 판매 | 주문관리 | B2B 해외, 수출출고, 자사/위탁 가능 | ProcessMapping No.05 combines overseas B2B sources; node order includes 수출이동지시, B/L 기준 출고, 매출전기처리. | 0.92 | 수출업무를 별도 Business Service로 분리할지는 후속 판단. |
| `b2c-order-to-sales` | 주문 등록 ~ 출고 ~ 매출전표 : B2C | SCM TO-BE / Douzone Matching / Runtime | 판매 | 주문관리 | B2C, 온라인, Cafe24/EasyAdmin | ProcessMapping No.06 cites Cafe24 online order, OMS collection, WMS shipment, ERP sales closing. | 0.95 | 온라인 주문 채널 context가 명확함. |
| `preorder-to-sales` | 예약 판매 ~ 출고 ~ 매출전표 : B2C | SCM TO-BE / ProcessMapping / Runtime | 판매 | 주문관리 | B2C, 예약판매, PG/선수금 | ProcessMapping No.07 states reservation sale, PG settlement, prepayment handling/reversal, shipment, sales closing. | 0.92 | 예약판매는 주문관리의 특수 case 후보. |
| `b2c-return` | 주문 반품 ~ 입고 ~ 반품전표 : B2C | SCM TO-BE / Douzone Matching / Runtime | 반품 | 반품관리 | B2C, 온라인 반품, EasyAdmin | ProcessMapping No.08 and node order show online return request, OMS return collection, WMS return receipt, 반품마감. | 0.95 | B2B/B2C return variants can share Business Service. |
| `popup-concert-stock-sales-sync` | 공연장/팝업 판매 ~ 출고 ~ 매출전표 : 제/상품 | SCM TO-BE / Douzone Matching / Runtime | 판매 | 주문관리 | 공연장/팝업, 현장판매, 재고이동 | ProcessMapping No.09 maps to 행사장 팝업 PROCESS; node order includes 공연장 출고, POS 주문입력, 잔여재고 재고이동. | 0.86 | 주문관리와 현장재고운영이 함께 있어 service split 여지. |
| `event-sales` | 이벤트 : 제/상품 | SCM TO-BE / Douzone Matching / Runtime | 판매 | 주문관리 | 이벤트, 당첨자, 현장수령/택배발송 | Node order includes Cafe24 이벤트 주문 접수, 이벤트 정보 확인, 당첨자 여부, 수령방식 구분. | 0.88 | 이벤트운영관리 별도 서비스 후보도 가능. |
| `store-sales` | 매장 판매 ~ 출고 ~ 매출전표 : 제/상품 | SCM TO-BE / Douzone Matching / Runtime | 판매 | 주문관리 | 매장, POS/EasyChain, 매출마감 | ProcessMapping No.11 cites POS/EasyChain sales sync, ERP order/shipment, sales closing. | 0.88 | 매장/POS 실행 도메인과 판매 capability를 혼동하지 않아야 함. |
| `stock-transfer` | 매장 간 재고이동 : 제/상품 | SCM TO-BE / Douzone Matching / Runtime | 재고 | 재고이동관리 | 매장간/창고간, POS, 위탁재고 | Douzone matching combines 재고이동 and 매장 재고이동; runtime nodes include 재고이동요청, 재고이동확정, 매장재고이동현황. | 0.90 | 일반 재고이동과 같은 Business Service 후보. |
| `other-issue` | 기타 출고 : 제/상품 | SCM TO-BE / Douzone Matching / Runtime | 재고 | 기타출고관리 | 무상증정, 기타출고, 위탁여부 | ProcessMapping No.13 maps 기타 출고; runtime nodes include 출고요청, 무상 증정품 사용품의, 기타출고확정. | 0.93 | 출고관리로 통합할지 기타출고로 둘지 후속 판단. |
| `royalty-mg-settlement` | 기획사 로열티 정산 : 제/상품 | SCM TO-BE / Douzone Matching / Runtime | 정산 | 로열티정산 | 기획사, 로열티, MG 차감 | ProcessMapping No.14 maps 판매 로열티 정산 and runtime nodes include 로열티 매출 집계, MG 차감여부, 정산마감. | 0.96 | Business Service 후보가 매우 명확함. |
| `consignment-settlement` | 위탁 매출 정산 | SCM TO-BE / Douzone Matching / Runtime | 정산 | 위탁정산 | 위탁, 위탁매출, 예외처리 | ProcessMapping No.15 maps 위탁 매출 정산; runtime nodes include 위탁 매출 집계, 위탁 정산여부 판단, 정산마감. | 0.96 | Business Service 후보가 매우 명확함. |
| `revenue-share-settlement` | 수익배분 매출 정산 | SCM TO-BE / Douzone Matching / Runtime | 정산 | 수익배분정산 | 수익배분, 매출/비용, MG | Douzone matching marks derived from 위탁/로열티 정산; runtime nodes include 매출/비용 집계 and MG상계. | 0.88 | 더존 1:1 source가 아니므로 confidence medium-high. |
| `service-business-to-expense` | 사업기회 ~ 비용전표 생성 : 서비스 | SCM TO-BE / ProcessMapping / Runtime | 사업관리 | 서비스사업비용관리 | 서비스, 계약/프로젝트, 비용전표 | ProcessMapping No.17 states service business operates around contract, project, expense approval, and cost voucher. | 0.82 | 사업기회/계약관리와 비용관리 중 어느 축을 우선할지 판단 필요. |
| `service-purchase-to-ap` | 구매 요청 ~ 매입전표 생성 : 서비스 | SCM TO-BE / ProcessMapping / Runtime | 구매 | 구매매입관리 | 서비스, 검수/입고확정, 매입전표 | ProcessMapping No.18 treats purchase-inbound as service purchase/inspection/AP voucher variant. | 0.88 | 제/상품 구매입고와 달리 물류 입고가 약함. |
| `service-order-to-sales` | 주문 등록 ~ 매출전표 생성 : 서비스 | SCM TO-BE / ProcessMapping / Runtime | 판매 | 서비스매출관리 | 서비스, 비재고, 플랫폼/콘텐츠 | ProcessMapping No.19 combines platform/content non-inventory sales; ProcessDefinition separates it from shipment sales because no shipment stage. | 0.92 | 주문관리와 서비스매출관리 중 service naming 확정 필요. |
| `service-project-settlement` | 프로젝트 정산 : 서비스 | SCM TO-BE / ProcessMapping / Runtime | 정산 | 프로젝트정산 | 서비스, 프로젝트, 매출/비용, MG | ProcessMapping No.20 derives service project settlement from content non-inventory, consignment, and royalty settlement sources. | 0.88 | 더존 1:1 source 아님. |
| `storage-location-master` | 저장위치 등록 | Runtime / ProcessDefinition | 기준정보 | 저장위치관리 | 기준정보, 저장위치 | ProcessDefinition maps storage-location-master to 기준정보(Supporting) / 저장위치 등록; runtime nodes are storage location master data tasks. | 0.90 | Supporting master data; SCM lifecycle와 별도 노출 가능성. |
| `purchase-return` | 구매반품 | Runtime / ProcessDefinition / Douzone gap | 반품 | 구매반품관리 | 구매반품, 구매송장 | ProcessDefinition maps to 반품 / 구매반품; runtime nodes include 구매반품 요청, 구매반품 등록, 구매송장 입력. | 0.88 | 판매반품과 별도 service로 둘 가능성 높음. |
| `other-receipt` | 기타입고 | Runtime / ProcessDefinition / Douzone gap | 재고 | 기타입고관리 | 기타입고, 위탁여부, 재고+ | ProcessDefinition maps to 재고 / 기타입고; runtime nodes include 입고요청, 위탁 여부, ERP 재고(+), 입고처리. | 0.90 | 입고관리와 기타입고관리 간 경계 검토. |
| `stock-movement` | 일반 재고이동 | Runtime / ProcessDefinition / Douzone gap | 재고 | 재고이동관리 | 일반, 입/출고, 위탁여부 | ProcessDefinition maps stock-movement and stock-transfer to 재고이동 variants; runtime nodes include 출고요청, 입/출고정보, 입/출고 처리. | 0.90 | stock-transfer와 통합 가능. |
| `구매-요청-매입-전표-생성-f-b` | 구매 요청 ~ 매입전표 생성 : 연구개발비/F&B/물류센터소모품 | Runtime local / User-created detail group | 구매 | 구매매입관리 | F&B, 연구개발비, 물류센터 소모품 | Runtime group is assigned to `wf-purchase-request-to-ap` with variantLabel F&B; nodes are 구매진행, 지출결의, 전표조회승인, 정기자금집행. | 0.70 | Source document outside seed not yet identified; local development item. |
| `구매-요청-매입-전표-생성-it-s-w` | 구매 요청 ~ 매입전표 생성 : IT, S/W | Runtime local / User-created detail group | 구매 | 구매매입관리 | IT, S/W | Runtime group is assigned to `wf-purchase-request-to-ap` with variantLabel IT·S/W; nodes follow 구매요청, 구매발주 품의, 지출결의, 전표생성. | 0.74 | Local development item; source evidence should be formalized later. |
| `구매-요청-매입전표-생성-인사총무` | 구매 요청 ~ 매입전표 생성 : 인사/총무 | Runtime local / User-created detail group | 구매 | 구매매입관리 | 인사/총무 | Runtime group is assigned to `wf-purchase-request-to-ap`; nodes include 구매요청, 구매요청확인, 구매발주 품의, 지출결의, 전표생성. | 0.68 | Variant label is blank in runtime; context inferred from process title only. |

## Low Confidence Items

| Process ID | Reason |
|---|---|
| `구매-요청-매입-전표-생성-f-b` | Local runtime item; source document not formalized in repository mapping. |
| `구매-요청-매입-전표-생성-it-s-w` | Local runtime item; source document not formalized in repository mapping. |
| `구매-요청-매입전표-생성-인사총무` | Local runtime item; blank variantLabel; context comes from process title. |
| `service-business-to-expense` | Mixes business opportunity, project, and expense voucher work. |
| `popup-concert-stock-sales-sync` | Mixes field sales, stock movement, shipment, and sales closing. |
