# Workflow Phase 1 Specification

|Field|Value|
|---|---|
|Title|Workflow / Variant 구조 Phase 1 명세|
|Purpose|Workflow 구조를 구현하기 위한 스키마·매핑·명명·마이그레이션 기준을 설계 수준에서 확정한다. 구현은 시작하지 않는다.|
|Status|Review|
|Owner|혁신팀|
|Last Updated|2026-07-08|
|Baseline|`v1.0-baseline` (main @ 77a54b8)|
|Precedent|`Workflow-Refactor-Phase0-Decision.md` (PR #8, merged)|
|Related Docs|`01_Architecture/DataModel.md`, `02_Master/ProcessDefinition.md`, `Docs/README.md(Methodology v1.0)`|

> Review·Specification 문서다. 본 Phase 1에서는 코드·데이터(`state.json`)·UI를 수정하지 않는다. 스키마는 **설계 수준**이며 실제 타입/구현은 Phase 2에서 도입한다.

---

## 1. Purpose

Phase 0에서 확정된 결정(기존 Category 유지 + Workflow를 별도 상위 그룹/메타로 추가, additive B안)을 **구현 가능한 명세**로 구체화한다. 산출물은 Phase 2 구현의 계약(contract)이 된다.

이 문서가 확정·승인되면 Phase 2(데이터 모델 구현 + Sidebar IA + 마이그레이션 + UI)로 진입할 수 있다. 승인 전에는 어떤 코드/데이터 변경도 하지 않는다.

**대상 데이터(실측)**: 현재 상세 프로세스는 **27개**(Phase 0 문서의 "26개"는 `business-to-project` 포함 시 27개로 정정). 이 중 2개(F&B, IT/S/W)는 사용자 생성 슬러그 ID다.

---

## 2. Design Principles

| # | 원칙 | 근거 |
|---|---|---|
| P1 | **기존 JSON 구조를 변경하지 않는다** | v1.0-baseline 안정성. Import/Export 파일 호환 |
| P2 | **additive만 허용** | `lifecycleGroupId`·`laneIds`·`autoHideEmptyLanes` 선례 — optional 필드 추가, 미지정 시 기존 동작 |
| P3 | **Process ID / Node ID 불변** | URL·참조·Canvas 안정성 |
| P4 | **Workflow/Variant는 파생 계층** | Process가 여전히 1급 실체. Workflow는 그룹핑 메타 |
| P5 | **이름 파싱에 의존하지 않는다** | 명명 불일치(§6)로 파싱은 신뢰 불가 → ID 기준 매핑 |
| P6 | **Phase 경계 엄수** | Phase 1은 명세만. 구현은 Phase 2 Go 이후 |

---

## 3. Workflow Data Model

### 3.1 최소 스키마 (설계 수준)

```text
Workflow {
  workflowId        : string   (required, unique)   예: 'wf-order-to-sales'
  workflowName      : string   (required)           예: '주문 → 출고 → 매출전표'
  description       : string   (optional)
  category          : string   (optional)  기존 lifecycleGroupId 값 재사용 ('sales' 등)
  status            : string   (optional)  'active' | 'draft' | 'deprecated'
  steps             : string[] (optional)  표시용 단계 라벨 ['주문','출고','매출전표'] — 노드 미연결
  order             : number   (optional)  카테고리 내 표시 순서
}
```

### 3.2 확장 슬롯 (Phase 2+ 선택 도입, 지금은 예약만)

```text
  searchKeywords    : string[]   AI/검색용
  aiKeywords        : string[]
  tags              : string[]
  relatedErpModules : string[]   ['구매관리','회계'] 등
  requiredMasterData: string[]   ['품목','거래처']
  requiredRoles     : string[]   ['사업부','재무']
  trigger           : string
  entryCondition    : string
  exitCondition     : string
  relatedWorkflowIds: string[]
```

- **저장 위치(설계안)**: payload 최상위 `workflows[]` optional 배열. `commonMasters`가 아닌 별도 배열로 두어 Master 신설 논쟁(§9 O3)을 회피.
- `steps`는 **표시용 문자열**이며 노드/엣지와 데이터적으로 결합하지 않는다(P4). 노드 링크는 Phase 3 이후 별도 검토.

---

## 4. Variant Data Model

### 4.1 스키마 (설계 수준)

```text
Variant {
  variantId       : string  (required, unique)   예: 'var-b2b-domestic'
  workflowId      : string  (required)            소속 Workflow FK
  variantName     : string  (required)            예: 'B2B 국내'
  channel         : string  (optional)  'B2B' | 'B2C' | '내부' | ...
  businessType    : string  (optional)  '제/상품' | '서비스' | 'IT' | ...
  executionType   : string  (optional)  '정상' | '위탁' | '사입' | '예약' | ...
  order           : number  (optional)
}
```

### 4.2 Process 연결 (설계안)

Variant를 별도 배열로 두기보다, **`DetailProcessGroup`에 optional 필드를 additive 추가**하는 방식을 1순위로 검토한다(P2, 그룹이 이미 Process와 1:1이므로 마이그레이션 최소).

```text
DetailProcessGroup {
  ...기존 필드,
  workflowId    : string  (optional)   소속 Workflow
  variantId     : string  (optional)   또는 variantLabel(문자열)로 우선 관리
  variantLabel  : string  (optional)   예: 'B2B 국내' — Phase 1에서는 이 문자열이 Variant의 사실상 키
  variantOrder  : number  (optional)
}
```

> **Phase 1 우선순위**: `variantLabel`(문자열 보조 필드)로 먼저 관리하고, 정규 `Variant` 엔티티(4.1) 도입은 Phase 2 이후 필요성 재평가. 이는 Phase 0 결론 "Variant는 우선 명명 규칙과 보조 필드로 관리"에 정합.

---

## 5. Process Mapping Model

### 5.1 계층 구조

```text
Category (기존 lifecycleGroups, 유지)
  └── Workflow (신규, workflowId)
        └── Variant (variantLabel/variantId)
              └── Process (기존 ProcessInstance, ID 불변)
```

- 매핑은 **ID 기준**으로 관리한다(P5). 이름 파싱 금지.
- Variant 1개짜리 Workflow(콜론 없는 6개 등)도 동일 구조로 수용.

### 5.2 27개 Process → Workflow/Variant 매핑표 (초안 — Phase 1 승인 대상)

| Category | Workflow (workflowName 초안) | Process ID | Variant(변형) |
|---|---|---|---|
| 사업시작 | 사업기회 → 계약 → 구매요청 | business-to-purchase-request | 제/상품 |
| 사업시작 | 사업기회 → 비용전표 | service-business-to-expense | 서비스 |
| 사업시작 | 사업시작 → 구매 → 매입전표(광의) | business-to-project | 통합 |
| 구매/입고 | 구매요청 → 입고 → 매입전표 | purchase-to-ap-invoice | 제/상품 |
| 구매/입고 | 구매요청 → 매입전표 | service-purchase-to-ap | 서비스 |
| 구매/입고 | 구매요청 → 매입전표 | 구매-요청-매입-전표-생성-f-b | F&B |
| 구매/입고 | 구매요청 → 매입전표 | 구매-요청-매입-전표-생성-it-s-w | IT·S/W |
| 판매 | 주문 → 출고 → 매출전표 | b2b-domestic-order-to-sales | B2B 국내 |
| 판매 | 주문 → 수출출고 → 매출전표 | b2b-export-order-to-sales | B2B 해외 |
| 판매 | 주문 → 출고 → 매출전표 | b2c-order-to-sales | B2C |
| 판매 | 주문 → 출고 → 매출전표 | store-sales | 매장 |
| 판매 | 주문 → 출고 → 매출전표 | popup-concert-stock-sales-sync | 공연장/팝업 |
| 판매 | 주문 → 매출전표 | service-order-to-sales | 서비스 |
| 판매 | 이벤트 판매 | event-sales | 제/상품 |
| 판매 | 예약판매 → 출고 → 매출전표 | preorder-to-sales | B2C |
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

> **미확정(§9 O1)**: `주문 → 출고 → 매출전표` Workflow에 `수출출고`(B2B 해외)·`매출전표만`(서비스)·`예약판매`(preorder)를 같은 Workflow로 볼지, 단계가 다르므로 분리할지 승인 필요. `business-to-project`의 위치(사업시작 광의 vs 별도)도 확정 필요.

---

## 6. Naming Convention

### 6.1 표준 규칙 (Phase 2 데이터 정규화 시 적용, Phase 1은 규칙 확정만)

| 대상 | 규칙 | 예 |
|---|---|---|
| **Workflow명** | `<단계> → <단계> → <단계>` (화살표 `→`, 앞뒤 공백 1칸) | `주문 → 출고 → 매출전표` |
| **Variant명** | 채널/유형 단문, 수식어 없이 | `B2B 국내`, `서비스`, `IT·S/W` |
| **Process명(표시)** | `<Workflow명> : <Variant명>` (콜론 앞뒤 공백 1칸) | `주문 → 출고 → 매출전표 : B2B 국내` |

### 6.2 콜론(`:`) 사용 기준

- 콜론은 **Workflow와 Variant의 구분자**로만 사용한다.
- Variant가 단일(사실상 없음)인 경우 콜론을 생략한다 → `구매반품`, `저장위치 등록`.

### 6.3 띄어쓰기 표준 (현행 불일치 정규화 대상)

현재 데이터의 실측 불일치 — Phase 2에서 아래로 통일:

| 현행(혼재) | 표준 |
|---|---|
| `주문등록` / `주문 등록` | `주문` (Workflow 단계는 명사 단독) |
| `매출전표` / `매출 전표` | `매출전표` (붙임) |
| `반품전표` / `반품 전표` | `반품전표` (붙임) |
| `매입 전표` / `매입전표` | `매입전표` (붙임) |

> 전표류(매출전표·매입전표·반품전표·비용전표)는 **붙여 쓴다**를 표준으로 제안. 승인 필요(§9 O2).

### 6.4 Legacy 문자열 처리 기준

- 기존 Process **`name`은 표시용으로 보존**하고 변경하지 않아도 무방(P1). Workflow/Variant 매핑은 ID 기준(P5)이므로 이름 정규화는 **선택적 후처리**.
- 이름 정규화를 수행할 경우에도 Process ID·Node ID는 불변(P3).

### 6.5 신규 작성 규칙

- 신규 Process 생성 시 §6.1 표준을 따르고, 생성 UI에서 Workflow 선택 + Variant 입력을 유도(Phase 2 UI 과제).
- "복사해서 새로 만들기"는 동일 `workflowId` 승계 + 새 `variantLabel` 입력 → **복제 = Variant 추가**로 자연 결합.

---

## 7. Migration Strategy

| 항목 | 방침 |
|---|---|
| **기존 JSON 변경** | **금지.** `workflows[]`·그룹 optional 필드는 additive. 기존 필드/구조 불변 |
| **additive 방식** | 신규 필드는 전부 optional. 미지정 시 v1.0 동작(전체 Process가 카테고리 직속 fallback) |
| **매핑 데이터 주입** | Phase 2에서 `workflowId`/`variantLabel`을 그룹에 **점진 부여**. 일괄 마이그레이션 스크립트는 ID 기준 매핑표(§5.2) 기반, 1회성 |
| **Import/Export 영향** | v2 포맷 유지. Export에 `workflows[]` 추가 시에도 구버전 로더는 미지 필드 무시(관용 파싱). Import는 `workflows[]` 없으면 fallback |
| **Rollback 전략** | additive이므로 롤백 = 신규 필드 무시. 코드 롤백 시 데이터의 `workflowId`는 잔존하나 무해(미참조). 데이터 롤백 필요 시 매핑 부여 커밋 revert |
| **schemaVersion** | 현 payload `version: 2` 유지 권장. Workflow는 v2 내 additive라 **버전 승격 불필요**. 단, 파괴적 변경(Phase 3 노드-단계 링크 등) 시 `version: 3` 검토 — 이때 up-migration 필수 |

---

## 8. Backward Compatibility

| 대상 | 호환성 | 근거 |
|---|---|---|
| **기존 state.json** | ✅ 완전 호환 | additive만. 신규 필드 없어도 정상 로드 |
| **기존 URL** | ✅ 불변 | Process ID 기반 라우팅 유지(P3) |
| **기존 ID** | ✅ 불변 | Process/Node/Group ID 변경 없음 |
| **기존 Import 파일** | ✅ 호환 | `workflows[]` 없으면 fallback, 필수 검증(`kind`·`processes`)만 통과하면 로드 |
| **기존 Export 파일** | ✅ 호환 | 구버전 Export엔 workflows 없음 → 신버전 로더가 fallback 처리 |

> **필수 안전장치(선례)**: PR #6에서 `laneIds`가 저장-리로드 registry 병합 중 유실된 버그가 있었다. Workflow 필드도 `normalizeProcessInstance`·`mergeMissingDetailProcesses` 등 **재구성 경로에서 보존**되는지 Phase 2 구현 시 회귀 테스트 필수(§9 O4).

---

## 9. Open Issues

| ID | 이슈 | 결정 필요 시점 |
|---|---|---|
| O1 | Workflow 경계: `주문→출고→매출전표`에 수출출고(B2B해외)·매출전표만(서비스)·예약판매를 동일 Workflow로 볼지 분리할지 | Phase 1 승인 |
| O2 | 전표류 띄어쓰기 표준(`매출전표` 붙임 vs `매출 전표`) 확정 | Phase 1 승인 |
| O3 | `workflows[]` 저장 위치가 Methodology v1.0 "새 Master 신설 금지"에 해당하는지 — 별도 배열(비-Master)로 회피 가능한지 혁신팀 판단 | Phase 1 승인 |
| O4 | Workflow 필드의 저장-리로드 보존 회귀 테스트 범위 (laneIds 유실 선례) | Phase 2 착수 |
| O5 | `business-to-project`(광의 프로세스)의 Workflow 귀속 | Phase 1 승인 |
| O6 | Variant 정규 엔티티(4.1) 도입 여부 vs variantLabel 문자열 유지 | Phase 2 이후 |
| O7 | Category 순서/Supporting 분류 경량 변경을 Workflow와 함께 할지 분리할지 | Phase 2 |

---

## 10. Phase 2 Entry Criteria

Phase 2(구현) 진입은 **아래 전부 충족** 시에만 허용한다:

1. ✅ **Workflow Schema 승인** — §3 최소 스키마 + 저장 위치(O3) 확정
2. ✅ **Mapping 승인** — §5.2 27개 매핑표 + 경계 이슈(O1, O5) 확정
3. ✅ **Naming Rule 승인** — §6 표준 + 전표 띄어쓰기(O2) 확정
4. ✅ **Migration 승인** — §7 additive 방침 + schemaVersion 유지(O3) + 회귀 테스트 계획(O4) 확정
5. ✅ **DataModel.md / ProcessDefinition.md 개정** — 승인된 스키마를 Architecture 문서에 반영(Methodology 정합 경로)

5개 중 하나라도 미승인이면 Phase 2 착수 금지. Phase 2 첫 작업은 스키마 타입 정의 + additive 마이그레이션(무해·롤백 가능)이며, UI는 그 다음 단계다.
