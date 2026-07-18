# Navigator Process Taxonomy v1 - Business Service Grouping

|Field|Value|
|---|---|
|Status|Architecture Analysis / Candidate|
|Baseline|Current runtime detail processes, 27 total|
|Generated At|2026-07-14|

## Grouping Principle

Business Service is the user-facing work unit that can represent multiple detailed processes. It is not the ERP menu, current TO-BE process title, Workflow name, or Execution Domain.

## Candidate Business Service Groups

| Candidate Business Service | Candidate Capability | Processes | Contexts | Evidence Summary | Confidence | Follow-up |
|---|---|---|---|---|---:|---|
| 사업기회/계약관리 | 사업관리 | `business-to-purchase-request` | 제/상품, 구매요청 선행 | Starts with opportunity, review, contract, project, then purchase request. | 0.90 | Decide whether purchase request belongs here or becomes linked service. |
| 구매입고관리 | 구매 | `purchase-to-ap-invoice` | 제/상품, 입고, 매입전표 | Purchase request to inbound and AP voucher flow. | 0.95 | Could split into 구매요청관리 and 입고관리 if menu depth requires. |
| 구매매입관리 | 구매 | `service-purchase-to-ap`, `구매-요청-매입-전표-생성-f-b`, `구매-요청-매입-전표-생성-it-s-w`, `구매-요청-매입전표-생성-인사총무` | 서비스, F&B, IT/S/W, 인사/총무 | Same workflow `wf-purchase-request-to-ap`; all end in expense/AP voucher style handling. | 0.78 | Local variants need formal source evidence and variantLabel cleanup. |
| 주문관리 | 판매 | `b2b-domestic-order-to-sales`, `b2b-export-order-to-sales`, `b2c-order-to-sales`, `preorder-to-sales`, `popup-concert-stock-sales-sync`, `event-sales`, `store-sales` | B2B, B2C, 예약판매, 공연장/팝업, 이벤트, 매장 | ProcessDefinition groups shipment-bearing sales under order-to-sales; ProcessMapping evidence shows order/sales/shipment variants. | 0.88 | Consider splitting 현장판매/이벤트 if users search by operation rather than order. |
| 서비스매출관리 | 판매 | `service-order-to-sales` | 서비스, 비재고, 플랫폼/콘텐츠 | ProcessDefinition explicitly separates no-shipment service sales from standard sales workflow. | 0.92 | Decide whether this stays under 판매 or service business capability. |
| 반품관리 | 반품 | `b2b-domestic-return`, `b2c-return` | B2B, B2C, 온라인 반품 | Both are sales return order to return receipt/voucher flows. | 0.95 | Purchase return is separate candidate service. |
| 구매반품관리 | 반품 | `purchase-return` | 구매반품, 구매송장 | Runtime nodes are purchase return request, purchase return registration, purchase invoice. | 0.88 | Decide whether to merge under 반품관리 or keep separate for buyer workflow. |
| 재고이동관리 | 재고 | `stock-transfer`, `stock-movement` | 매장간/창고간, 일반, POS, 위탁여부 | ProcessDefinition maps both as inventory movement variants. | 0.90 | Naming should avoid implying only store transfer. |
| 기타출고관리 | 재고 | `other-issue` | 무상증정, 기타출고 | Runtime and ProcessMapping focus on other issue/free goods outbound. | 0.93 | Could be generalized under 출고관리 later. |
| 기타입고관리 | 재고 | `other-receipt` | 기타입고, 재고+ | Runtime nodes include receipt request, receipt processing, ERP inventory increase. | 0.90 | Could be generalized under 입고관리 later. |
| 저장위치관리 | 기준정보 | `storage-location-master` | 기준정보, 저장위치 | Supporting master-data process in ProcessDefinition. | 0.90 | Confirm whether 기준정보 remains left-menu top-level service. |
| 로열티정산 | 정산 | `royalty-mg-settlement` | 기획사, 로열티, MG | Clear royalty/MG settlement flow. | 0.96 | High-confidence candidate. |
| 위탁정산 | 정산 | `consignment-settlement` | 위탁, 위탁매출 | Clear consignment settlement flow. | 0.96 | High-confidence candidate. |
| 수익배분정산 | 정산 | `revenue-share-settlement` | 수익배분, 매출/비용, MG | Derived settlement process combining revenue/cost and MG handling. | 0.88 | Confirm whether it belongs with royalty/consignment or separate. |
| 프로젝트정산 | 정산 | `service-project-settlement` | 서비스, 프로젝트, 매출/비용 | Service project settlement with revenue/cost and MG treatment. | 0.88 | Derived from multiple sources, needs business confirmation. |
| 서비스사업비용관리 | 사업관리 | `service-business-to-expense` | 서비스, 계약/프로젝트, 비용전표 | Service business from opportunity to expense voucher. | 0.82 | Could split into service contract/project and expense management. |

## Integration Candidates

| Candidate Integration | Processes | Reason |
|---|---|---|
| 주문관리 | B2B/B2C/export/preorder/event/store/popup sales processes | Same user intent: receive/confirm order, fulfill or record sale, close revenue; context separates channel/type. |
| 구매매입관리 | service/F&B/IT/SW/HR-GA purchase-to-AP processes | Same runtime workflow `wf-purchase-request-to-ap`; contexts differ by spend category. |
| 반품관리 | B2B return, B2C return | Same return order to inbound/voucher pattern; channel is context. |
| 재고이동관리 | stock-transfer, stock-movement | Same inventory movement service; transfer type is context. |
| 정산 family | royalty, consignment, revenue-share, project settlement | Same settlement lifecycle but business rules differ enough to keep separate Business Service candidates for now. |

## Candidate Lists

### Capability Candidates

- 사업관리
- 기준정보
- 구매
- 판매
- 반품
- 재고
- 정산

### Recommended Business Service Candidates

- 사업기회/계약관리
- 서비스사업비용관리
- 구매입고관리
- 구매매입관리
- 주문관리
- 서비스매출관리
- 반품관리
- 구매반품관리
- 재고이동관리
- 기타출고관리
- 기타입고관리
- 저장위치관리
- 로열티정산
- 위탁정산
- 수익배분정산
- 프로젝트정산

### Context Candidates

- Product/service type: 제/상품, 서비스, F&B, IT/S/W, 인사/총무, 연구개발비, 물류센터 소모품
- Sales channel: B2B 국내, B2B 해외, B2C, 온라인, 공연장/팝업, 이벤트, 매장, POS/EasyChain
- Transaction type: 일반, 예약판매, 위탁, 수익배분, 로열티, 구매반품, 기타입고, 기타출고
- Operational condition: 수출출고, 현장수령, 택배발송, PG/선수금, MG 차감, 위탁재고

## Items Needing Decision

| Topic | Current Observation | Recommended Follow-up |
|---|---|---|
| `popup-concert-stock-sales-sync` | Mixes stock movement, field sale, shipment, and revenue close. | Decide whether primary service is 주문관리 or 현장판매/재고운영. |
| `event-sales` | Event operations include winner selection and delivery split. | Decide whether event operations should be a separate Business Service. |
| `service-business-to-expense` | Combines service opportunity/contract/project and expense voucher. | Decide whether to split service business management from expense management. |
| Local purchase variants | F&B, IT/S/W, HR-GA are runtime-local and not yet mapped to formal source documents. | Add source mapping and fill missing `variantLabel` for HR-GA in a later data task. |
| Purchase service naming | `purchase-to-ap-invoice` and service/F&B/IT/SW purchases share purchase-to-voucher semantics but differ on inbound/logistics. | Decide final Business Service names: 구매입고관리 vs 구매매입관리 vs 구매요청관리. |
