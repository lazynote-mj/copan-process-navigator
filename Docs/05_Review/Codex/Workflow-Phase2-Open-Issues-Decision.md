# Workflow Phase 2 Open Issues Decision

|Field|Value|
|---|---|
|Title|Phase 2 진입 전 Open Issues 의사결정 (O1·O2·O3·O5)|
|Purpose|Phase 1 명세의 미결 이슈를 근거·대안·리스크와 함께 정리하여 Phase 2 착수 전 확정 대상을 명확히 한다.|
|Status|Review (Draft)|
|Owner|혁신팀|
|Last Updated|2026-07-08|
|Baseline|`v1.0-baseline` (main @ 9a8c01e)|
|Precedent|`Workflow-Phase1-Specification.md` (PR #9, merged)|
|Related Docs|`Workflow-Refactor-Phase0-Decision.md`, `01_Architecture/DataModel.md`, `Docs/README.md(Methodology v1.0)`|

> Review·Decision 문서다. 본 세션은 **의사결정 정리만** 하며 코드·데이터(`state.json`)·UI를 수정하지 않는다. 각 항목의 "최종 결정 필요사항"은 혁신팀 승인 대상이다.

---

## O1. Workflow 경계

### 쟁점
판매 계열에서 `주문 → 출고 → 매출전표`를 하나의 Workflow로 묶을지, 중간 단계가 다른 경우(수출출고·출고없음·예약)를 별도 Workflow로 나눌지.

### 근거 (데이터 실측)

| Process | 노드 수 | 출고 단계 | 판정 |
|---|---|---|---|
| b2b-domestic-order-to-sales | 14 | 있음 | 표준 판매 |
| b2b-export-order-to-sales | 20 | 수출출고(변형) | 표준 판매(Variant) |
| b2c-order-to-sales | 17 | 있음 | 표준 판매 |
| store-sales | 14 | 있음 | 표준 판매 |
| popup-concert-stock-sales-sync | 34 | 있음(재고이동) | 표준 판매 |
| event-sales | 31 | 있음 | 표준 판매 |
| preorder-to-sales | 20 | 있음(+예약 선단계) | 판매 or 별도 후보 |
| **service-order-to-sales** | **7** | **없음** (주문→매출마감→전표) | **별도 Workflow 후보** |

### 대안
- **A1**: 흐름 골격이 같으면(주문으로 시작, 매출전표로 종결) 중간 단계 차이는 Variant로 흡수 → 판매 전체를 1 Workflow.
- **A2**: 단계 시퀀스가 다르면 별도 Workflow. 출고 유무·수출출고·예약을 각각 분리.
- **A3 (추천)**: 상위 흐름이 같으면 동일 Workflow의 Variant로 본다. **단, 출고 단계가 아예 없는 서비스형(`service-order-to-sales`)은 별도 Workflow 후보로 표시**한다. 수출출고·예약은 표준 판매 Workflow의 Variant로 흡수.

### 장점 (A3)
- 메뉴 축약 효과 유지(판매 6~7개 → 1 Workflow + Variant 목록).
- 서비스형은 흐름이 실제로 달라(7노드, 출고 없음) 별도로 두는 것이 정확.
- Variant 라벨(B2B국내/해외/B2C/매장/공연장/이벤트)로 자연 표현.

### 단점 (A3)
- "같은 흐름"의 판단 기준이 다소 주관적(수출출고를 Variant로 볼지 논쟁 여지).
- 예약판매(preorder)의 선행 예약 단계를 Variant로 볼지 별도로 볼지 경계 흐릿.

### 리스크
- 경계를 느슨하게 잡으면 후속 AI/검색에서 "출고 있는 판매"와 "출고 없는 판매"가 뭉뚱그려질 수 있음 → 서비스형 분리로 완화.
- Variant 흡수 후 실제 노드 차이(수출/예약)를 놓치면 표준화 관점의 diff 정확도 저하(Phase 3 노드-단계 링크 시 재검토 필요).

### 추천안
**A3.** 표준 판매 Workflow(`주문 → 출고 → 매출전표`) + Variant(B2B국내·B2B해외·B2C·매장·공연장/팝업·이벤트·예약). 서비스형(`service-order-to-sales`)은 별도 Workflow 후보 `주문 → 매출전표(서비스)`로 표시.

### 최종 결정 필요사항
1. 수출출고(B2B해외)를 표준 판매 Variant로 흡수할지, 별도 Workflow로 둘지.
2. 예약판매(preorder)를 표준 판매 Variant로 흡수할지, 별도 Workflow로 둘지.
3. 서비스형 별도 Workflow 분리 승인.

---

## O2. 전표류 띄어쓰기 표준

### 쟁점
현행 데이터에 `매출전표`/`매출 전표`, `반품전표`/`반품 전표`, `매입전표`/`매입 전표`가 혼재하여 이름 기반 그룹핑을 방해.

### 대안
- **B1 (추천)**: 전표류는 **붙임 표기로 통일** — `매출전표`, `반품전표`, `매입전표`, `비용전표`.
- **B2**: 띄어쓰기 표기(`매출 전표`)로 통일.
- **B3**: 정규화하지 않고 ID 기준 매핑으로만 회피(이름은 방치).

### 장점 (B1)
- 회계 실무 관용(전표는 합성어)에 부합.
- 표기 통일로 표시 일관성 향상, 신규 작성 혼란 감소.

### 단점 (B1)
- 기존 Process `name` 정정 시 데이터 편집 발생(단, Phase 2 정규화 작업 범위 내, ID 불변).

### 리스크
- **낮음.** 이름은 표시용이고 매핑은 ID 기준이므로(Phase 1 P5), 정규화 실패해도 기능 영향 없음. 미적용 시 표시 불일치만 잔존.

### 추천안
**B1.** 전표류 붙임 통일. 단, **이름 정규화는 매핑·기능과 분리된 선택적 후처리**로 다루고, 매핑 자체는 ID 기준으로 진행(이름 파싱 금지).

### 최종 결정 필요사항
1. 붙임 표기 표준 승인.
2. 이름 정규화를 Phase 2에서 함께 수행할지, 별도 데이터 작업으로 분리할지.

---

## O3. `workflows[]` 저장 위치

### 쟁점
Workflow 엔티티를 payload 어디에 둘지. Methodology v1.0의 "새로운 Master를 만들지 않는다"와의 정합.

### 대안
- **C1 (추천)**: payload **최상위 별도 배열** `workflows[]`. `commonMasters` 밖.
- **C2**: `commonMasters.workflows`로 편입.
- **C3**: Workflow를 별도 저장 없이 `DetailProcessGroup.workflowId` + 파생 계산으로만 표현(Workflow 메타는 코드 상수).

### 장점 / 단점

| 안 | 장점 | 단점 |
|---|---|---|
| C1 | Master 신설 논쟁 회피(별도 배열=비-Master 데이터). additive, Import/Export 관용 파싱. 확장 슬롯(키워드 등) 수용 | 최상위 스키마에 배열 1개 추가 |
| C2 | commonMasters 일관성 | **"새 Master 신설"에 정면 해당** → Methodology 개정 필요. 리스크 높음 |
| C3 | 데이터 추가 0 | Workflow 메타(설명·키워드·순서)를 데이터로 못 담음 → AI 확장 불가. 코드-데이터 결합 |

### 리스크
- C2는 Methodology Frozen 원칙과 충돌 → 개정 절차 필요, R&R 일정 리스크.
- C1은 최상위 필드 추가라 구버전 로더 호환 필요 → v2 유지 + 미지 필드 무시로 해소(Phase 1 §8 검증됨).

### 추천안
**C1.** `workflows[]`를 payload 최상위 별도 배열로 둔다. `commonMasters`에 넣지 않음으로써 "새 Master 신설" 해석을 회피하고, 필요 시 DataModel.md 개정으로 근거를 명문화.

### 최종 결정 필요사항
1. 별도 배열(C1) 승인.
2. Methodology 정합 판단 — 별도 배열이 "Master 신설"에 해당하지 않는다는 혁신팀 확인 (해당 시 개정 사유 3호 경로).
3. `schemaVersion` 유지(v2) 확인.

---

## O5. `business-to-project` Workflow 귀속

### 쟁점
`business-to-project`(21노드)는 사업기회 → 계약 → 프로젝트 → 구매요청 → 입고 → 매입전표까지 **여러 카테고리를 관통하는 광의 흐름**. 좁은 `business-to-purchase-request`(사업기회~구매요청)와 다름.

### 근거 (데이터 실측)
`business-to-project` 노드 흐름: 사업기회확보 > 사업참여검토 > 계약등록 > 사업계약품의 > 프로젝트등록 > 사업실행품의 > 구매요청 > 품목/거래처 등록 > 발주품의 > 계약/발주등록 > 입고확인 > 입고확정 > 재고인식 > 매입마감확정 > 매입전표 반영. → **사업시작 + 구매/입고를 합친 end-to-end**.

### 대안
- **D1 (추천)**: 당장 기존 구조 유지(사업시작 카테고리 소속 유지), Phase 2에서 **별도 Workflow 후보**(`사업시작 → 구매 → 매입전표`, end-to-end)로 관리.
- **D2**: 즉시 별도 Workflow로 분리하고 카테고리도 재조정.
- **D3**: 좁은 프로세스들로 분해(사업시작 / 구매입고 2개로 쪼갬).

### 장점 / 단점
- D1: 변경 최소, 안정성 유지. Phase 2에서 별도 후보로 표기만 → 리스크 낮음.
- D2: 개념 정합 좋으나 카테고리 재조정 수반(scope creep 위험).
- D3: 데이터 분해는 사용자 편집 이력 훼손·ID 변경 위험 → 지양.

### 리스크
- D2·D3는 Category 개편/데이터 분해로 번져 Phase 0 결정(카테고리 대개편 금지)과 충돌.
- D1은 "광의 흐름을 어느 Workflow 하나에 강제 귀속하지 않고 후보로 유보" → 안전.

### 추천안
**D1.** `business-to-project`는 현행 유지. Phase 2에서 별도 Workflow 후보(end-to-end 통합 흐름)로 관리하고, 다른 Variant와 억지로 묶지 않는다.

### 최종 결정 필요사항
1. 현행 유지 + 별도 Workflow 후보 표기 승인.
2. end-to-end 통합 흐름을 정식 Workflow로 승격할지 여부는 Phase 2 이후 재평가.

---

## 결정 요약 (Phase 2 착수 전 확정 대상)

| 이슈 | 추천안 | 핵심 승인 포인트 |
|---|---|---|
| **O1** 경계 | A3 — 상위 흐름 같으면 Variant, 출고 없는 서비스형은 별도 Workflow | 수출출고·예약의 Variant 흡수 여부, 서비스형 분리 |
| **O2** 전표 표기 | B1 — 붙임 통일(`매출전표`) | 표준 승인, 정규화 시점(Phase 2 vs 분리) |
| **O3** 저장 위치 | C1 — payload 최상위 `workflows[]` 별도 배열 | Methodology 정합 확인, schemaVersion v2 유지 |
| **O5** business-to-project | D1 — 현행 유지 + 별도 Workflow 후보 | 별도 후보 표기 승인 |

**공통 원칙 유지**: 코드/데이터/UI 무변경(본 세션), additive·ID 기준 매핑(P2·P5), Category 대개편 금지(Phase 0 결정), 저장-리로드 필드 보존 회귀 테스트 필수(laneIds 유실 선례).

4개 이슈 확정 시 Phase 1 §10 Entry Criteria의 ①②③④가 충족되며, 남은 ⑤(DataModel.md/ProcessDefinition.md 개정)를 거쳐 Phase 2 Go/No-Go를 판단한다.
