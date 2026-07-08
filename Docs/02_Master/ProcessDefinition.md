# Process Definition

|Field|Value|
|---|---|
|Title|Process Definition|
|Purpose|업무 흐름만 담는 중립 모델의 기준을 정의한다.|
|Status|Draft|
|Owner|Project Team|
|Last Updated|2026-07-08|
|Related Docs|`../01_Architecture/DataModel.md`, `../01_Architecture/Generator.md`, `../05_Review/Codex/Workflow-Phase1-Specification.md`, `../05_Review/Codex/Workflow-Phase2-Open-Issues-Decision.md`|

Process Definition에는 업무 흐름만 둔다.

포함:
- sequence
- branch
- loop
- condition
- business activity reference

제외:
- color
- size
- lane
- phase
- cellSlot
- route points
- ReactFlow rendering data

## Workflow / Variant / Process 3계층

> 설계 근거는 `../05_Review/Codex/Workflow-Phase1-Specification.md`와 `../05_Review/Codex/Workflow-Phase2-Open-Issues-Decision.md`. 본 절은 그 결정(O1·O2·O5)을 Master 기준으로 정본화한다.

### 계층 정의

```text
Category (기존 lifecycleGroups, 유지)
  └── Workflow (상위 업무 흐름)
        └── Variant (실행 유형)
              └── Process (화면 표시 인스턴스, ID 불변)
```

- **Workflow** — 동일한 단계 시퀀스를 공유하는 표준 업무 흐름. 여러 Variant가 하나의 Workflow를 공유한다.
- **Variant** — 동일 Workflow 안에서 채널·거래유형·실행방식·예외조건에 따라 달라지는 실행 유형.
- **Process** — 사용자가 선택·조회하는 개별 인스턴스. 개념적으로 `Process ≈ Workflow + Variant` 조합.
- 관계: `1 Workflow ── N Variant ── (각 Variant가) 1 Process`. Variant가 1개인 흐름도 동일 구조로 수용한다.
- 매핑은 Process **ID 기준**으로 관리한다(이름 파싱 금지).

### Workflow 경계 규칙 — 판매 계열 (O1)

판매 Workflow의 경계는 **출고 단계(출고·재고이동·발송 포함) 유무**로 정의한다.

- 출고 단계를 가진 주문→매출 흐름은 **표준 판매 Workflow**(`주문 → 출고 → 매출전표`)의 Variant로 통합한다.
- **수출출고(B2B 해외)** 와 **예약판매** 는 출고의 변형·선단계 추가일 뿐 골격이 같으므로 표준 판매 Workflow의 Variant로 흡수한다.
- 출고 단계가 없는 **서비스형 주문→매출전표** 흐름(`service-order-to-sales`)은 **별도 Workflow**(`주문 → 매출전표(서비스)`)로 분리한다.

### 명명 규칙 (O2)

| 대상 | 규칙 | 예 |
|---|---|---|
| Workflow명 | `<단계> → <단계> → <단계>` (화살표 `→`, 앞뒤 공백 1칸) | `주문 → 출고 → 매출전표` |
| Variant명 | 채널·유형 단문 | `B2B 국내`, `서비스`, `IT·S/W` |
| Process명(표시) | `<Workflow명> : <Variant명>` (콜론 앞뒤 공백 1칸) | `주문 → 출고 → 매출전표 : B2B 국내` |

- 전표류는 **붙임 표기**로 표준화한다: `매출전표`, `반품전표`, `매입전표`, `비용전표`.
- 콜론(`:`)은 Workflow와 Variant의 구분자로만 사용하며, Variant가 단일이면 생략한다(`구매반품`, `저장위치 등록`).
- 이름 정규화는 Workflow 스키마 구현과 분리하여 **별도 데이터 정리 PR**로 수행한다(매핑은 ID 기준이므로 정규화는 선행 조건이 아니다).

### business-to-project 취급 (O5)

`business-to-project`(사업기회 → 계약 → 프로젝트 → 구매요청 → 입고 → 매입전표, end-to-end 광의 흐름)는 **현행 구조를 유지**한다. 다른 Variant와 억지로 묶지 않고 **별도 Workflow 후보**로 관리하며, 정식 Workflow 승격 여부는 Phase 2 이후 재평가한다.

### Process → Workflow / Variant 매핑 (정본)

| Category | Workflow | Process ID | Variant |
|---|---|---|---|
| 사업시작 | 사업기회 → 계약 → 구매요청 | business-to-purchase-request | 제/상품 |
| 사업시작 | 사업기회 → 비용전표 | service-business-to-expense | 서비스 |
| 사업시작 | 사업시작 → 구매 → 매입전표(광의, 별도 후보) | business-to-project | 통합 |
| 구매/입고 | 구매요청 → 입고 → 매입전표 | purchase-to-ap-invoice | 제/상품 |
| 구매/입고 | 구매요청 → 매입전표 | service-purchase-to-ap | 서비스 |
| 구매/입고 | 구매요청 → 매입전표 | 구매-요청-매입-전표-생성-f-b | F&B |
| 구매/입고 | 구매요청 → 매입전표 | 구매-요청-매입-전표-생성-it-s-w | IT·S/W |
| 판매 | 주문 → 출고 → 매출전표 | b2b-domestic-order-to-sales | B2B 국내 |
| 판매 | 주문 → 출고 → 매출전표 | b2b-export-order-to-sales | B2B 해외 |
| 판매 | 주문 → 출고 → 매출전표 | b2c-order-to-sales | B2C |
| 판매 | 주문 → 출고 → 매출전표 | store-sales | 매장 |
| 판매 | 주문 → 출고 → 매출전표 | popup-concert-stock-sales-sync | 공연장/팝업 |
| 판매 | 주문 → 출고 → 매출전표 | event-sales | 이벤트 |
| 판매 | 주문 → 출고 → 매출전표 | preorder-to-sales | 예약판매 |
| 판매 | 주문 → 매출전표(서비스, 별도 Workflow) | service-order-to-sales | 서비스 |
| 반품 | 주문반품 → 입고 → 반품전표 | b2b-domestic-return | B2B 국내 |
| 반품 | 주문반품 → 입고 → 반품전표 | b2c-return | B2C |
| 반품 | 구매반품 | purchase-return | 단일 |
| 재고 | 재고이동 | stock-movement | 일반 |
| 재고 | 재고이동 | stock-transfer | 창고간 |
| 재고 | 기타입고 | other-receipt | 단일 |
| 재고 | 기타출고 | other-issue | 단일 |
| 정산 | 로열티 정산 | royalty-mg-settlement | 기획사 |
| 정산 | 위탁 매출 정산 | consignment-settlement | 위탁 |
| 정산 | 수익배분 매출 정산 | revenue-share-settlement | 수익배분 |
| 정산 | 프로젝트 정산 | service-project-settlement | 서비스 |
| 기준정보(Supporting) | 저장위치 등록 | storage-location-master | 단일 |

> 매핑은 현행 27개 상세 프로세스를 기준으로 한다. 저장 스키마·하위호환은 `../01_Architecture/DataModel.md`의 "Workflow Grouping Metadata" 절을 따른다.

