# Navigator Workshop Navigation Index

|Field|Value|
|---|---|
|Status|Workshop Navigation Index Review v2|
|Purpose|워크숍에서 사용자가 원하는 TO-BE Process를 빠르게 찾기 위한 Navigation Index|
|Baseline|Current runtime detail processes, 27 total|
|Generated At|2026-07-14|
|Not In Scope|Code, Sidebar, menu implementation, runtime/state JSON, workflow creation, migration|

## Navigation Principles

- This is not Business Taxonomy, ERP module structure, or Business Context modeling.
- The menu candidate answers: "Which process does the workshop participant want to see?"
- Navigation prioritizes the first words a workshop participant is likely to say when asking "이 프로세스를 보여주세요." Fast retrieval beats a logically perfect hierarchy.
- Product type alone does not split the menu. MD, 응원봉, 앨범 are treated as the same stock-handled product family unless the process actually changes.
- 제상품, 상품, 위탁상품 do not by themselves split sales processes. They are evidence/context only unless the process actually changes.
- Process separation is justified only when the process changes. Service type, stock movement 여부, sales channel, project nature, transaction type, and organization characteristics are stronger separators.
- Each row includes the single biggest condition that changes the process. The allowed values are `서비스유형`, `수불 여부`, `판매채널`, `프로젝트`, `거래유형`, `상품유형`, `조직 특성`, `기타`.

## Index

| 현재 TO-BE Process | Process를 변경시키는 핵심 조건 | 메뉴 Level1 | 메뉴 Level2 | 메뉴 Level3 | Process Family | Evidence | Notes |
|---|---|---|---|---|---|---|---|
| 사업 기회 확보 ~ 구매 요청 : 제/상품 | 수불 여부 | 사업관리 | 계약/프로젝트 | 수불상품 | 수불상품 사업착수 | ProcessMapping No.01 maps opportunity, contract, project, item/vendor references, and purchase request into SCM lifecycle start. | 워크숍에서는 "사업", "계약", "프로젝트", "구매요청"이 주요 탐색어. 구매요청까지 포함되어 구매와의 경계 확인 필요. |
| 구매 요청 ~ 입고 ~ 매입전표 : 제/상품 | 수불 여부 | 구매 | 구매요청 | 수불상품 | 수불상품 구매 | ProcessMapping No.02 and node order show purchase request, order, inbound, purchase closing, AP voucher. | 사용자는 "구매요청" 또는 "입고"로 찾을 가능성이 높음. |
| 주문 등록 ~ 출고 ~ 매출전표 : B2B 국내 | 판매채널 | 판매 | 주문관리 | B2B 국내 | 수불상품 판매 | Matched to domestic B2B sales; runtime starts with 주문등록 and includes 출고요청 and 매출마감. | 제상품/상품/위탁상품 여부가 아니라 B2B 채널이 구분 기준. |
| 주문 반품 ~ 입고 ~ 반품전표 : B2B 국내 | 판매채널 | 반품 | 반품관리 | B2B 국내 | 판매반품 | Matched to B2B sales return; runtime has 반품주문등록, 출고반품요청, 반품확정. | B2C 반품과 같은 family, 채널만 다름. |
| 주문 등록 ~ 수출 출고 ~ 매출전표 : B2B 해외 | 판매채널 | 판매 | 주문관리 | B2B 해외/수출 | 수불상품 판매 | ProcessMapping No.05 combines overseas B2B sources and node order includes 수출이동지시 and B/L 기준 출고. | "수출"을 Level2로 올릴지 워크숍 확인 필요. |
| 주문 등록 ~ 출고 ~ 매출전표 : B2C | 판매채널 | 판매 | 주문관리 | B2C 온라인 | 수불상품 판매 | ProcessMapping No.06 cites Cafe24, EasyAdmin OMS/WMS, ERP order and sales closing. | "온라인판매", "B2C", "Cafe24"가 주요 탐색어. |
| 예약 판매 ~ 출고 ~ 매출전표 : B2C | 거래유형 | 판매 | 주문관리 | 예약판매 | 수불상품 판매 | ProcessMapping No.07 adds reservation sale, PG settlement, prepayment handling and reversal. | 예약판매는 상품유형이 아니라 거래유형 때문에 별도 탐색 대상. |
| 주문 반품 ~ 입고 ~ 반품전표 : B2C | 판매채널 | 반품 | 반품관리 | B2C 온라인 | 판매반품 | ProcessMapping No.08 shows online return request, OMS return collection, WMS return receipt. | B2B/B2C 반품은 같은 Level2 아래 채널로 구분. |
| 공연장/팝업 판매 ~ 출고 ~ 매출전표 : 제/상품 | 프로젝트 | 판매 | 현장판매 | 공연/팝업 | 공연/팝업 판매 | ProcessMapping No.09 maps 행사장/팝업 flow; node order includes 공연장 출고, POS 주문입력, 잔여재고 이동. | 사용자는 "공연 판매" 또는 "팝업 판매"로 찾을 가능성이 높음. 판매채널이기도 하지만 행사/프로젝트성 운영이 더 큰 차이인지 워크숍 확인 필요. |
| 이벤트 : 제/상품 | 거래유형 | 판매 | 이벤트판매 | 현장수령/택배 | 이벤트 판매 | Node order includes 이벤트 주문 접수, 이벤트 정보 확인, 당첨자 여부, 수령방식 구분. | "이벤트", "당첨자", "현장수령"으로 찾을 가능성이 높음. 이벤트운영 vs 이벤트판매 명칭 확인 필요. |
| 매장 판매 ~ 출고 ~ 매출전표 : 제/상품 | 판매채널 | 판매 | 현장판매 | 매장/POS | 매장 판매 | ProcessMapping No.11 cites POS/EasyChain sales sync and ERP order/shipment/sales closing. | "매장", "POS", "이지체인" 탐색어가 핵심. |
| 매장 간 재고이동 : 제/상품 | 거래유형 | 재고 | 재고이동 | 매장간 | 수불상품 재고이동 | Runtime nodes include 재고이동요청, 매장 재고이동 처리, 재고이동확정, 매장재고이동현황. | "창고간" variantLabel과 process title의 "매장 간" 불일치 확인 필요. |
| 기타 출고 : 제/상품 | 거래유형 | 재고 | 기타출고 | 무상/기타 | 수불상품 기타출고 | ProcessMapping No.13 and runtime nodes include 무상 증정품 사용품의 and 기타출고확정. | "기타출고", "무상증정"으로 찾는 것이 직관적. |
| 기획사 로열티 정산 : 제/상품 | 거래유형 | 정산 | 로열티정산 | 기획사/MG | 로열티정산 | ProcessMapping No.14 maps to royalty/MG settlement and runtime has MG 차감/상계. | High-confidence workshop label. |
| 위탁 매출 정산 | 거래유형 | 정산 | 위탁정산 | 위탁매출 | 위탁정산 | ProcessMapping No.15 maps to consignment sales settlement. | 위탁상품 자체가 판매 Process를 나누지는 않지만, 위탁정산은 정산 거래유형으로 별도 탐색 대상. |
| 수익배분 매출 정산 | 거래유형 | 정산 | 수익배분정산 | 매출/비용 | 수익배분정산 | Derived from consignment/royalty settlement sources; runtime has 매출/비용 집계 and MG handling. | 더존 1:1 source는 아님. |
| 사업기회 ~ 비용전표 생성 : 서비스 | 서비스유형 | 사업관리 | 서비스사업 | 비용전표 | 비수불 서비스 사업 | ProcessMapping No.17 states service business is contract/project/expense-voucher centric. | 사용자는 "서비스사업", "비용전표", "프로젝트"로 찾을 가능성. |
| 구매 요청 ~ 매입전표 생성 : 서비스 | 수불 여부 | 구매 | 구매요청 | 서비스/비수불 | 비수불 서비스 구매 | ProcessMapping No.18 treats service purchase as purchase-to-AP without logistics-heavy stock inbound. | 서비스유형이기도 하지만 수불/비수불 차이가 워크플로우 차이를 가장 잘 설명. |
| 주문 등록 ~ 매출전표 생성 : 서비스 | 수불 여부 | 판매 | 서비스매출 | 비수불 | 비수불 서비스 판매 | ProcessDefinition separates no-shipment service sales from standard shipment sales. | "서비스매출", "비수불", "플랫폼", "콘텐츠"가 주요 탐색어. |
| 프로젝트 정산 : 서비스 | 프로젝트 | 정산 | 프로젝트정산 | 서비스 | 서비스 프로젝트 정산 | Runtime nodes are project revenue/cost aggregation, closing, MG and settlement. | 정산 family에 넣되 "프로젝트" 검색어가 핵심. |
| 저장위치 등록 | 기타 | 기준정보 | 저장위치 | 기준정보 | 기준정보 등록 | ProcessDefinition maps to supporting master data / storage location registration. | 워크숍에서 기준정보 섹션이 필요한지 확인. |
| 구매반품 | 거래유형 | 반품 | 구매반품 | 구매 | 구매반품 | Runtime nodes include purchase return request, purchase return registration, purchase invoice. | 판매반품과 분리 권장. |
| 기타입고 | 거래유형 | 재고 | 기타입고 | 일반 | 수불상품 기타입고 | Runtime nodes include 입고요청, 위탁 여부, ERP 재고(+), 입고처리. | 구매입고와 혼동되지 않도록 "기타입고" 유지. |
| 일반 재고이동 | 거래유형 | 재고 | 재고이동 | 일반 | 수불상품 재고이동 | ProcessDefinition maps stock-movement and stock-transfer to 재고이동 variants. | stock-transfer와 통합 가능한 family. |
| 구매 요청 ~ 매입전표 생성 : 연구개발비/F&B/물류센터소모품 | 서비스유형 | 구매 | 구매요청 | F&B/소모품 | 비수불/소모품 구매 | Runtime local group is assigned to `wf-purchase-request-to-ap`; nodes are 구매진행, 지출결의, 전표조회승인. | F&B가 상품유형인지 비용/서비스 유형인지 워크숍 확인 필요. 현재는 상품유형이 아니라 지출/서비스 유형으로 분류. |
| 구매 요청 ~ 매입전표 생성 : IT, S/W | 서비스유형 | 구매 | 구매요청 | IT/S/W | 비수불 IT/SW 구매 | Runtime local group is assigned to `wf-purchase-request-to-ap`; nodes include 구매요청, 품의, 지출결의, 전표생성. | 공식 source mapping 필요. |
| 구매 요청 ~ 매입전표 생성 : 인사/총무 | 조직 특성 | 구매 | 구매요청 | 인사/총무 | 비수불 일반관리 구매 | Runtime local group is assigned to `wf-purchase-request-to-ap`; nodes include 구매요청, 구매발주 품의, 지출결의, 전표생성. | 인사/총무는 서비스유형이라기보다 요청 조직/관리부서 특성이 강함. Runtime variantLabel blank; metadata cleanup 필요. |
