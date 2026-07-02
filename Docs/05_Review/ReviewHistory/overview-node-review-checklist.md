# TO-BE Overview 노드 검토 Checklist

> **기준 문서:** `Docs/06. TO-BE overview.pdf`  
> **대상 데이터:** `to-be-overview` (62 nodes · 56 edges · 14 detail processes)  
> **생성일:** 2026-06-19 · `public/process-data/state.json` 기준

---

## 사용 방법

1. PDF(`06. TO-BE overview.pdf`)와 앱 캔버스를 **나란히** 놓습니다.
2. **Zone(업무 영역) 순서**대로 아래 표를 채웁니다.
3. 각 노드 행에서 PDF 명칭·위치·lane과 앱 데이터를 대조합니다.
4. 수정이 필요하면 **앱 Property Panel** 또는 JSON 편집 → **전체 저장**.
5. Edge·Detail 매핑은 노드 검토 후 2·3단계에서 진행합니다.

### 노드 1행 검토 항목 (체크리스트)

| 항목 | 확인 내용 |
|------|-----------|
| **명칭** | PDF 표기와 `name` 일치 |
| **Lane** | 담당 부서/시스템 lane (`laneId`) |
| **Phase** | 가로 단계(`phaseId` / `phaseOrder`) |
| **Zone** | 업무 zone (`processZone`) |
| **Type** | erp / decision / interface / system / manual 등 |
| **Slot** | 같은 phase·lane 내 좌우 배치(`cellSlot`) |
| **연결** | in/out edge 수가 PDF 흐름과 맞는지 |
| **Detail** | 상세 프로세스 허브 노드인지 (`overviewNodeId`) |

### 코드 영향 (참고)

| 변경 유형 | 코드 수정 |
|-----------|-----------|
| 이름·lane·phase·edge·zone 수정 | **불필요** (JSON만) |
| 신규 node type / lane 구조 / zone ID | **필요할 수 있음** |
| PDF와 다른 레이아웃(자유 배치 등) | layout engine 확장 |

---

## 0. 사전 점검 (마스터 데이터)

### Lane (5 + 재무)

| ☐ | lane id | 앱 명칭 | PDF 일치 | 메모 |
|---|---------|---------|----------|------|
| ☐ | `business` | 사업부 / ERP | | |
| ☐ | `partnership` | 상생협력팀 / ERP | | |
| ☐ | `warehouse-easyadmin` | 물류센터 / 이지어드민 | | |
| ☐ | `retail-easychain` | 판매현장 / 이지체인 | | |
| ☐ | `finance` | 재무팀 / ERP | | |

### Process Zone (6개)

| ☐ | zone id | 앱 라벨 | PDF 영역 | 메모 |
|---|---------|---------|----------|------|
| ☐ | `business-contract` | 사업·계약 | | |
| ☐ | `purchase-order` | 구매·발주 | | |
| ☐ | `inbound-inventory` | 입고·재고 | | |
| ☐ | `sales-shipment` | 판매·출고 | | |
| ☐ | `return-movement` | 반품·이동 | | |
| ☐ | `settlement-close` | 정산·마감 | | |

---

## 1. 노드 검토 (62개)


### 1. 사업·계약 (6노드)

| ☐ | PDF p. | node id | PDF 명칭 | 앱 명칭 | type | lane | phase | slot | in/out | detail | 검토 메모 |
|---|--------|---------|----------|---------|------|------|-------|------|--------|--------|-----------|
| ☐ | | `opportunity` | | 사업기회확보 | manual | 사업부 | 사업기회 | 1 | 1/1 | — | |
| ☐ | | `business-review` | | 사업참여검토 | decision | 사업부 | 사업검토 | — | 1/2 | — | |
| ☐ | | `contract-approval` | | 사업계약품의 | decision | 사업부 | 계약품의 | 7 | 1/2 | — | |
| ☐ | | `contract-register` | | 계약등록 | erp | 사업부 | 계약등록 | 6 | 2/1 | — | |
| ☐ | | `project-register` | | 프로젝트등록 | erp | 사업부 | 프로젝트등록 | 8 | 2/1 | — | |
| ☐ | | `project-approval` | | 사업실행품의 | decision | 사업부 | 실행품의 | 9 | 1/3 | — | |

### 2. 구매·발주 (9노드)

| ☐ | PDF p. | node id | PDF 명칭 | 앱 명칭 | type | lane | phase | slot | in/out | detail | 검토 메모 |
|---|--------|---------|----------|---------|------|------|-------|------|--------|--------|-----------|
| ☐ | | `node-mqhltm4t-el6dq` | | 거래처 등록승인 | erp | 재무팀 | 사업기회 | 4 | 1/0 | — | |
| ☐ | | `node-mqhm27ka-y41py` | | 품목등록요청 | erp | 사업부 | 사업기회 | 3 | 1/1 | — | |
| ☐ | | `node-mqhm3415-s0x6r` | | 품목 등록승인 | erp | 상생협력팀 | 사업기회 | 3 | 1/0 | — | |
| ☐ | | `node-mqk4l3ai-882sn` | | 위탁여부체크 | decision | 사업부 | 사업기회 | 7 | 2/2 | — | |
| ☐ | | `purchase-request` | | 구매요청 | erp | 사업부 | 구매요청 | 6 | 1/1 | business-to-purchase-request, purchase-to-ap-invoice, consignment-purchase-receipt | |
| ☐ | | `vendor-check` | | 거래처/품목 확인 | decision | 사업부 | 거래처확인 | 2 | 0/3 | — | |
| ☐ | | `vendor-register` | | 거래처 등록요청 | erp | 사업부 | 거래처등록 | 4 | 1/1 | — | |
| ☐ | | `po-approval` | | 발주품의 | decision | 상생협력팀 | 발주품의 | 7 | 1/2 | — | |
| ☐ | | `purchase-order` | | 계약/발주등록 | erp | 상생협력팀 | 발주등록 | 6 | 2/1 | — | |

### 3. 입고·재고 (8노드)

| ☐ | PDF p. | node id | PDF 명칭 | 앱 명칭 | type | lane | phase | slot | in/out | detail | 검토 메모 |
|---|--------|---------|----------|---------|------|------|-------|------|--------|--------|-----------|
| ☐ | | `node-mqhkso0a-7ceuz` | | 매입마감조회 | erp | 상생협력팀 | 사업기회 | 6 | 1/1 | — | |
| ☐ | | `node-mqhkwa5x-sihxe` | | 전표생성(미결) | erp | 상생협력팀 | 사업기회 | 8 | 1/1 | — | |
| ☐ | | `inbound-info` | | 입고정보전달 | interface | 상생협력팀 | 입고정보 | 1 | 2/1 | — | |
| ☐ | | `inbound-check` | | 입고확인 | erp | 물류센터 | 입고확인 | 2 | 1/0 | — | |
| ☐ | | `inbound-confirm` | | 입고확정 | interface | 물류센터 | 입고확정 | 3 | 1/1 | — | |
| ☐ | | `stock-plus` | | 재고인식(+) | system | 물류센터 | 재고인식 | 3 | 1/1 | — | |
| ☐ | | `ap-close` | | 매입마감확정 | erp | 상생협력팀 | 매입마감 | 7 | 1/1 | — | |
| ☐ | | `fi-posting` | | 회계전표 반영 | system | 재무팀 | 회계전표 | 4 | 1/0 | — | |

### 4. 판매·출고 (16노드)

| ☐ | PDF p. | node id | PDF 명칭 | 앱 명칭 | type | lane | phase | slot | in/out | detail | 검토 메모 |
|---|--------|---------|----------|---------|------|------|-------|------|--------|--------|-----------|
| ☐ | | `node-mqg215ai-glqwv` | | 반품주문등록 | erp | 사업부 | 사업기회 | 3 | 0/1 | — | |
| ☐ | | `node-mqg2200t-bzgvl` | | 출고반품요청 | system | 사업부 | 사업기회 | 8 | 1/1 | — | |
| ☐ | | `node-mqkfpf9l-jy7t5` | | 출고요청 | system | 사업부 | 사업기회 | 6 | 1/1 | — | |
| ☐ | | `online-order` | | 온라인몰판매 | external | 물류센터 | 온라인주문 | 1 | 0/1 | — | |
| ☐ | | `popup-sales` | | 팝업/콘서트 판매 | manual | 판매현장 | 온라인주문 | 1 | 0/1 | — | |
| ☐ | | `concert-sales` | | 매장판매 | manual | 판매현장 | 온라인주문 | 2 | 0/1 | — | |
| ☐ | | `order-sync` | | 주문정보연동 | interface | 물류센터 | 주문연동 | 2 | 0/1 | — | |
| ☐ | | `pos-easychain-sync` | | POS/이지체인 판매정보 연동 | interface | 판매현장 | 주문연동 | 6 | 2/1 | — | |
| ☐ | | `shipment-request` | | 출고요청 | interface | 사업부 | 출고요청 | 1 | 0/1 | — | |
| ☐ | | `shipment-check` | | 출고확인 | manual | 물류센터 | 출고확인 | 2 | 4/1 | — | |
| ☐ | | `shipment-confirm` | | 출고확정 | interface | 물류센터 | 출고확정 | — | 2/1 | — | |
| ☐ | | `stock-minus` | | 재고인식(-) | system | 물류센터 | 재고차감 | 8 | 1/0 | — | |
| ☐ | | `sales-close` | | 매출마감확정 | erp | 재무팀 | 매출마감 | — | 1/0 | — | |
| ☐ | | `sales-posting` | | 전표생성(미결) | system | 재무팀 | 회계전표 | — | 0/0 | — | |
| ☐ | | `order-register` | | 주문등록 | erp | 사업부 | 주문등록 | 1 | 1/1 | b2b-domestic-order-to-sales, b2b-export-order-to-sales, b2c-order-to-sales, preorder-to-sales | |
| ☐ | | `sales-inquiry` | | 매출마감조회 | erp | 재무팀 | 매출마감조회 | — | 1/1 | — | |

### 5. 반품·이동 (12노드)

| ☐ | PDF p. | node id | PDF 명칭 | 앱 명칭 | type | lane | phase | slot | in/out | detail | 검토 메모 |
|---|--------|---------|----------|---------|------|------|-------|------|--------|--------|-----------|
| ☐ | | `return-shipment-request` | | 출고반품요청 | system | 물류센터 | 반품 | — | 0/0 | — | |
| ☐ | | `return-inbound-check` | | 반품입고확인 | manual | 물류센터 | 반품 | — | 1/0 | — | |
| ☐ | | `return-inbound-register` | | 반품입고등록 | interface | 물류센터 | 반품 | — | 0/0 | — | |
| ☐ | | `return-confirm` | | 반품확정 | system | 물류센터 | 반품 | — | 0/0 | — | |
| ☐ | | `warehouse-transfer-request` | | 창고이동요청등록 | erp | 사업부 | 창고이동 | 4 | 0/0 | — | |
| ☐ | | `warehouse-transfer` | | 창고이동 | interface | 물류센터 | 창고이동 | — | 0/0 | — | |
| ☐ | | `warehouse-transfer-confirm` | | 창고이동확정 | erp | 물류센터 | 창고이동 | — | 1/0 | — | |
| ☐ | | `store-transfer-rt` | | 매장간재고이동(RT) | erp | 판매현장 | 창고이동 | 3 | 0/1 | — | |
| ☐ | | `store-transfer` | | 매장 간 이동 | manual | 판매현장 | 창고이동 | 4 | 1/1 | — | |
| ☐ | | `free-gift-approval` | | 무상증정품의 | decision | 사업부 | 기타출고 | 2 | 0/0 | — | |
| ☐ | | `other-outbound-request` | | 기타출고요청 | erp | 사업부 | 기타출고 | 1 | 0/0 | — | |
| ☐ | | `other-outbound-confirm` | | 기타출고확정 | erp | 물류센터 | 기타출고 | — | 0/0 | — | |

### 6. 정산·마감 (11노드)

| ☐ | PDF p. | node id | PDF 명칭 | 앱 명칭 | type | lane | phase | slot | in/out | detail | 검토 메모 |
|---|--------|---------|----------|---------|------|------|-------|------|--------|--------|-----------|
| ☐ | | `consignment-stock-status` | | 위탁재고현황 | system | 물류센터 | 위탁정산 | — | 0/1 | — | |
| ☐ | | `consignment-sales-register` | | 위탁매출마감등록 | erp | 재무팀 | 위탁정산 | — | 1/1 | — | |
| ☐ | | `consignment-sales-close` | | 위탁매출마감확정 | erp | 재무팀 | 위탁정산 | — | 1/1 | — | |
| ☐ | | `exception-handling` | | 예외사항처리 | exception | 상생협력팀 | 위탁정산 | — | 1/0 | — | |
| ☐ | | `royalty-sales-aggregate` | | 로열티매출집계 | system | 재무팀 | 로열티/MG정산 | — | 0/1 | — | |
| ☐ | | `royalty-sales-close` | | 로열티매출마감확정 | erp | 재무팀 | 로열티/MG정산 | — | 1/1 | — | |
| ☐ | | `mg-deduct-check` | | MG 차감여부 | decision | 재무팀 | 로열티/MG정산 | — | 1/2 | — | |
| ☐ | | `mg-offset-process` | | MG상계처리 | erp | 재무팀 | 로열티/MG정산 | — | 1/1 | — | |
| ☐ | | `settlement-posting` | | 정산전표처리 | system | 재무팀 | 로열티/MG정산 | — | 3/0 | consignment-settlement, royalty-mg-settlement | |
| ☐ | | `prepayment-process` | | 선수금처리 | erp | 재무팀 | 자금 | — | 1/1 | — | |
| ☐ | | `regular-fund-execution` | | 정기자금집행 | erp | 재무팀 | 자금 | — | 1/1 | — | |

---

## 2. Edge 검토 (56개)

| ☐ | edge id | source | target | label | condition | routing | 검토 |
|---|---------|--------|--------|-------|-----------|---------|------|
| ☐ | `edge-mqhfky2k-4r7lq` | 사업실행품의 | 프로젝트등록 | N | — | auto | |
| ☐ | `edge-mqhfski5-twx7t` | 사업계약품의 | 프로젝트등록 | Y | — | auto | |
| ☐ | `edge-mqhfu68e-x0t2y` | 거래처/품목 확인 | 위탁여부체크 | 기존 | — | auto | |
| ☐ | `edge-mqhg3m23-pxsyl` | 반품주문등록 | 출고반품요청 | — | — | auto | |
| ☐ | `edge-mqhg4y29-x9814` | 출고반품요청 | 반품입고확인 | — | — | auto | |
| ☐ | `edge-mqhgrizt-z43iu` | POS/이지체인 판매정보 연동 | 매출마감조회 | — | — | auto | |
| ☐ | `edge-mqhgxhyc-1vxp6` | 팝업/콘서트 판매 | POS/이지체인 판매정보 연동 | — | — | auto | |
| ☐ | `edge-mqhgy7ly-9oyvv` | 매장판매 | POS/이지체인 판매정보 연동 | — | — | auto | |
| ☐ | `edge-mqhhbjkp-2ef2g` | 발주품의 | 입고정보전달 | Y | — | auto | |
| ☐ | `edge-mqhkjbyk-tcew8` | 사업참여검토 | 사업기회확보 | N | — | auto | |
| ☐ | `edge-mqhkxfpu-vau45` | 매입마감조회 | 매입마감확정 | — | — | auto | |
| ☐ | `edge-mqhmwsvf-rpeh2` | 품목등록요청 | 품목 등록승인 | — | — | auto | |
| ☐ | `edge-mqhna8aw-a13zi` | 전표생성(미결) | 회계전표 반영 | — | — | auto | |
| ☐ | `edge-mqj9t4c4-k6w4a` | 사업실행품의 | 주문등록 | — | — | auto | |
| ☐ | `edge-mqjb32xq-g0cr1` | 거래처 등록요청 | 거래처 등록승인 | — | — | auto | |
| ☐ | `edge-mqjb3v8p-e6iks` | 거래처/품목 확인 | 품목등록요청 | — | — | auto | |
| ☐ | `edge-mqjbpnt1-0yebq` | 매장간재고이동(RT) | 매장 간 이동 | — | — | auto | |
| ☐ | `edge-mqjbqp9g-fbpdu` | 매장 간 이동 | 창고이동확정 | — | — | auto | |
| ☐ | `edge-mqk4m6m4-6ljdt` | 위탁여부체크 | 계약/발주등록 | N | — | auto | |
| ☐ | `edge-mqk4mvwu-y2wje` | 위탁여부체크 | 입고정보전달 | Y | — | auto | |
| ☐ | `edge-mqkagn6z-vjvpt` | 사업참여검토 | 계약등록 | — | — | auto | |
| ☐ | `edge-mqkfdcp5-j1yo2` | 구매요청 | 위탁여부체크 | — | — | auto | |
| ☐ | `edge-mqkfvpka-jsq9g` | 출고요청 | 출고확인 | — | — | auto | |
| ☐ | `edge-mqkh23m7-9sts7` | 온라인몰판매 | 출고확인 | — | — | auto | |
| ☐ | `main:e2e:01` | 사업기회확보 | 사업참여검토 | Y | — | auto | |
| ☐ | `main:e2e:02` | 계약등록 | 사업계약품의 | — | — | auto | |
| ☐ | `main:e2e:03` | 사업계약품의 | 계약등록 | N | — | auto | |
| ☐ | `main:e2e:05` | 프로젝트등록 | 사업실행품의 | — | — | auto | |
| ☐ | `main:e2e:06` | 사업실행품의 | 구매요청 | Y | — | auto | |
| ☐ | `main:e2e:08` | 거래처/품목 확인 | 거래처 등록요청 | 신규 | — | auto | |
| ☐ | `main:e2e:09` | 계약/발주등록 | 발주품의 | — | existingVendor | auto | |
| ☐ | `main:e2e:12` | 발주품의 | 계약/발주등록 | N | — | auto | |
| ☐ | `main:e2e:14` | 입고정보전달 | 입고확인 | — | — | auto | |
| ☐ | `main:e2e:16` | ⚠ inbound-register | 입고확정 | — | — | auto | |
| ☐ | `main:e2e:17` | 입고확정 | 재고인식(+) | — | — | auto | |
| ☐ | `main:e2e:18` | 재고인식(+) | 매입마감조회 | — | — | auto | |
| ☐ | `main:e2e:20` | 매입마감확정 | 전표생성(미결) | — | — | auto | |
| ☐ | `main:e2e:23` | 주문정보연동 | 출고확인 | — | — | auto | |
| ☐ | `main:e2e:25` | 출고요청 | 출고확인 | — | — | auto | |
| ☐ | `main:e2e:26` | 출고확인 | 출고확정 | — | — | auto | |
| ☐ | `main:e2e:27` | ⚠ shipment-register | 출고확정 | — | — | auto | |
| ☐ | `main:e2e:28` | 출고확정 | 재고인식(-) | — | — | auto | |
| ☐ | `main:e2e:30` | 매출마감조회 | 매출마감확정 | — | — | auto | |
| ☐ | `order-register-to-order-register-split` | 주문등록 | 출고요청 | — | — | auto | |
| ☐ | `sub:consignment:01` | 위탁재고현황 | 위탁매출마감등록 | — | — | auto | |
| ☐ | `sub:consignment:02` | 위탁매출마감등록 | 위탁매출마감확정 | — | — | auto | |
| ☐ | `sub:consignment:03` | 위탁매출마감확정 | ⚠ settlement-anomaly-check | — | — | auto | |
| ☐ | `sub:consignment:04` | ⚠ settlement-anomaly-check | 예외사항처리 | Y | settlementAnomaly | auto | |
| ☐ | `sub:consignment:05` | ⚠ settlement-anomaly-check | 선수금처리 | N | noSettlementAnomaly | auto | |
| ☐ | `sub:consignment:06` | 선수금처리 | 정기자금집행 | — | — | auto | |
| ☐ | `sub:consignment:07` | 정기자금집행 | 정산전표처리 | — | — | auto | |
| ☐ | `sub:royalty:01` | 로열티매출집계 | 로열티매출마감확정 | — | — | auto | |
| ☐ | `sub:royalty:02` | 로열티매출마감확정 | MG 차감여부 | — | — | auto | |
| ☐ | `sub:royalty:03` | MG 차감여부 | MG상계처리 | Y | mgDeduct | auto | |
| ☐ | `sub:royalty:04` | MG 차감여부 | 정산전표처리 | N | noMgDeduct | auto | |
| ☐ | `sub:royalty:05` | MG상계처리 | 정산전표처리 | — | — | auto | |

---

## 3. Detail 프로세스 ↔ Overview 허브 매핑

| ☐ | detail process id | overviewNodeId (허브) | PDF 존재 | 노드명 일치 | 메모 |
|---|-------------------|----------------------|----------|-------------|------|
| ☐ | `business-to-project` | (E2E main — 별도 허브) | | | process-groups 참조 |
| ☐ | `business-to-purchase-request` | `purchase-request` | | | |
| ☐ | `purchase-to-ap-invoice` | `purchase-request` | | | |
| ☐ | `consignment-purchase-receipt` | `purchase-request` | | | |
| ☐ | `b2b-domestic-order-to-sales` | `order-register` | | | |
| ☐ | `b2b-export-order-to-sales` | `order-register` | | | |
| ☐ | `b2c-order-to-sales` | `order-register` | | | |
| ☐ | `preorder-to-sales` | `order-register` | | | |
| ☐ | `b2b-domestic-return` | `return-handling` ⚠ | | | **허브 노드 누락** |
| ☐ | `stock-transfer` | `stock-transfer-handling` ⚠ | | | **허브 노드 누락** |
| ☐ | `other-issue` | `other-issue-handling` ⚠ | | | **허브 노드 누락** |
| ☐ | `consignment-settlement` | `settlement-posting` | | | |
| ☐ | `royalty-mg-settlement` | `settlement-posting` | | | |
| ☐ | `popup-concert-stock-sales-sync` | `popup-concert-stock-sales-sync` ⚠ | | | **허브 노드 누락** |

---

## 4. PDF 대비 **현재 데이터 갭** (선검토)

아래는 PDF/process-groups 기준으로 **앱에 없거나 연결이 끊긴** 항목입니다. PDF 검토 시 우선 확인하세요.

### 누락 노드 (process-groups에만 존재)

| node id (예정) | 용도 | 관련 그룹 |
|----------------|------|-----------|
| `master-data-split` | 기준정보 분기 | e2e-main-flow |
| `product-check` | 품목 확인 | e2e-main-flow |
| `product-register-request` | 품목등록요청 (canonical id) | e2e-main-flow |
| `product-register-approval` | 품목등록승인 | e2e-main-flow |
| `vendor-register-approval` | 거래처등록승인 | e2e-main-flow |
| `master-data-complete` | 기준정보완료 | e2e-main-flow |
| `inbound-register` | 입고등록 | e2e-main-flow · **edge만 존재** |
| `ap-inquiry` | 매입마감조회 | e2e-main-flow |
| `ap-voucher-pending` | 전표생성(미결) | e2e-main-flow |
| `shipment-register` | 출고등록 | e2e-main-flow · **edge만 존재** |
| `return-handling` | 반품 허브 | sub-returns |
| `stock-transfer-handling` | 재고이동 허브 | sub-warehouse-transfer |
| `other-issue-handling` | 기타출고 허브 | sub-other-outbound |
| `settlement-anomaly-check` | 정산 이상검증 | sub-consignment · **edge만 존재** |
| `popup-concert-stock-sales-sync` | 팝업/콘서트 허브 | sub-popup-concert |

> **참고:** 일부 기능은 `node-mqhm27ka-y41py`(품목등록요청) 등 **다른 id**로 이미 존재할 수 있습니다. PDF 명칭 기준으로 **통합·rename**할지 결정하세요.

### 고아 노드 (edge 0/0 — PDF에 있으면 연결 추가)

- `sales-posting` 전표생성(미결)
- `return-shipment-request`, `return-inbound-register`, `return-confirm`
- `warehouse-transfer-request`, `warehouse-transfer`
- `free-gift-approval`, `other-outbound-request`, `other-outbound-confirm`

### phaseOrder 의심 (phase=「사업기회」인데 zone은 구매·판매)

PDF에서 위치가 다르면 `phaseId` / `phaseOrder` / `localOrder` 재조정:

- `node-mqhm27ka-y41py`, `node-mqk4l3ai-882sn`, `node-mqkfpf9l-jy7t5` 등

### Decision 분기 미완

- `free-gift-approval` (무상증정품의): outgoing edge **0개**

---

## 5. 검토 완료 체크

| ☐ | 항목 |
|---|------|
| ☐ | 62개 노드 Zone별 검토 완료 |
| ☐ | 56개 edge PDF 흐름과 일치 |
| ☐ | Detail 14개 허브 매핑 확인 |
| ☐ | 누락/고아 노드 처리方針 결정 (추가 vs 삭제 vs rename) |
| ☐ | 캔버스 collision(빨간 edge) 점검 |
| ☐ | **전체 저장** 및 JSON export |

---

## 6. 진행 기록

| 날짜 | 검토자 | Zone / 범위 | 변경 요약 |
|------|--------|-------------|-----------|
| | | | |
