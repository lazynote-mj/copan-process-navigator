# Navigator Information Architecture

|Field|Value|
|---|---|
|Title|Navigator 정보 구조 — Graph First + Multiple Views (Journey 도입)|
|Purpose|Navigator가 "최종적으로 무엇을 표현·탐색하는 도구인가"를 정의한다. 핵심 원칙은 **Graph First**: Process Graph가 기층이고, Category→Workflow→Variant 트리와 Journey는 그 위의 서로 다른 View다. Journey·Relation·Process Graph가 모델 안에서 어떤 관계로 존재하는지 확정한다.|
|Status|**Approved** (ratified by `06_Decisions/ADR-003-Navigator-IA-Ratification.md`, 2026-07-09) — 상태 전이 Draft → Review → Approved 완료|
|Owner|혁신팀|
|Last Updated|2026-07-08|
|Baseline|`v1.0-baseline` + Workflow/Variant 구현 완료 (PR #13~#17 merged)|
|Document Class|**최상위 설계 원칙 문서** — Navigator의 도메인/내비게이션 모델을 정의한다. "Phase 3"는 이 문서의 **최초 비준(ratification) 시점**을 가리키는 시간표식일 뿐, 문서의 위상은 특정 Phase 산출물이 아니다.|
|Related Docs|`Workflow-Variant-IA-Review.md`, `Workflow-Refactor-Phase0-Decision.md`, `Workflow-Phase2-Open-Issues-Decision.md`, `01_Architecture/DataModel.md`, `02_Master/ProcessDefinition.md`|

> Review·설계 문서다. 본 세션은 개념 설계만 하며 코드·데이터(`state.json`)·UI·Architecture 문서를 수정하지 않는다. 여기서 확정된 방향은 Phase 4 착수 전 혁신팀 승인 대상이다.
>
> **위상 주해:** 이 문서는 장기적으로 `01_Architecture/`로 승격되어 Navigator의 정본 IA/도메인 모델이 되는 것을 지향한다. 위치 이동·승격은 별도 승인 사항이며, 현재는 Review 단계로 `05_Review/Codex`에 둔다.

---

## 1. Architecture Principle — Graph First

Navigator의 최상위 설계 원칙을 먼저 못박는다.

> **Process Graph가 Navigator의 기층(substrate)이며, Category → Workflow → Variant 트리와 Journey는 모두 Graph 위의 서로 다른 projection/view다.**

### 1.1 Graph First + Multiple Views

Navigator의 진짜 모델은 트리가 아니라 **그래프**다. 트리로 보이는 것은 그래프를 탐색하기 위한 **하나의 뷰**일 뿐이다.

```text
                    ┌─────────────── Consumers ───────────────┐
                    │   UI (Sidebar/Explorer)     AI          │   ← Graph를 질의·탐색·설명
                    └──────────────────┬──────────────────────┘
                                       │
                    ┌────────────── Navigation Engine ─────────┐   ← 그래프 순회 → View/Search 생산
                    └──────────────────┬──────────────────────┘
                                       │
        ┌──────────────────────── Process Graph (기층) ────────────────────────┐
        │   노드 = Workflow (향후 Business Object)                              │
        │   엣지 = Relation (sequence·trigger·depends-on·part-of-journey)       │
        │   named path = Journey                                               │
        └──────────────────────────────────────────────────────────────────────┘
```

### 1.2 세 개의 View (같은 Graph, 다른 투영)

| View | 정의 | 질문 | 실체 |
|---|---|---|---|
| **Catalog View** | Category → Workflow → Variant **포함 트리** | "무엇이 있는가" | 카탈로그(현재 구현된 유일한 View) |
| **Journey View** | Graph 위의 **named path / narrative** | "어떻게 이어지는가" | 관통 흐름(신규) |
| **Operational View** | Lane 기준 **조직/책임** 투영 | "누가 하는가" | 스윔레인(기존, 직교) |

- **Sidebar Tree는 Graph 자체가 아니다.** 그것은 Catalog View를 탐색하기 위한 **하나의 UI Projection**이다. Journey View·Operational View는 같은 Graph의 다른 투영이다.
- Search·AI 등 모든 하위 기능은 트리가 아니라 **Graph 위에서** 동작한다(§7, §8).

이 원칙(Graph First + Multiple Views)이 문서 전반의 표현 기준이다. 이하 모든 절은 "트리는 View, Graph가 기층"이라는 정렬을 따른다.

---

## 2. Current Model

### 현재 구현된 것 = Catalog View 하나

현재 Navigator에 실재하는 것은 Graph의 **Catalog View(포함 트리)** 하나뿐이다. Journey View·Process Graph는 아직 없다.

| 계층 | 실체 | 데이터 근거 |
|---|---|---|
| **Category** (Lifecycle 7종) | 사업시작 / 기준정보 / 구매입고 / 판매 / 반품 / 재고 / 정산 | `appConfig.lifecycleGroups`, 그룹의 `lifecycleGroupId` |
| **Workflow** | 동일 단계 시퀀스를 공유하는 표준 흐름 (17개) | `state.json` 최상위 `workflows[]` (additive) |
| **Variant** | Workflow 안의 실행 유형 (채널·거래유형·예외) | `DetailProcessGroup.workflowId` + `variantLabel` + `variantOrder` |
| **Process** | 화면에 렌더되는 개별 인스턴스 | `ProcessInstance` (nodes/edges/zones) |

현재 Catalog View의 구조 = 3계층 포함 트리:

```text
Category  ⊃  Workflow  ⊃  Variant   ( = Process 1개)
```

PR #13(스키마) → #14(27개 매핑) → #15(Sidebar IA) → #16(Explorer UX) → #17(전표명 정규화)로 구현·안정화되었고, `laneIds`/`workflows[]`와 동일한 **additive·하위호환** 원칙 위에 서 있다. **단, 이 트리는 Graph의 한 View일 뿐이다**(§1).

---

## 3. Problem

현재 Catalog View(포함 트리)는 **여러 Workflow를 관통하는 업무 흐름(end-to-end)** 을 담을 수 없다. Graph도, Journey View도 없기 때문이다.

### 증상 — `wf-business-to-project`

현행 17 Workflow 중 `wf-business-to-project`(status=draft)는 성격이 다르다. 실측 노드 흐름(21노드):

```text
사업기회확보 → 사업참여검토 → 계약등록 → 사업계약품의 → 프로젝트등록
 → 사업실행품의 → 구매요청 → 품목/거래처 등록 → 발주품의 → 계약/발주등록
 → 입고확인 → 입고확정 → 재고인식 → 매입마감확정 → 매입전표 반영
```

이 흐름은 **사업시작 + 구매/입고 + (정산)** 이라는 여러 Category를 관통한다. 즉 하나의 Workflow가 아니라 **여러 Workflow를 순서대로 잇는 상위 흐름**이다. Catalog View엔 담을 자리가 없어 편의상 `business-start` 카테고리에 draft로 끼워 넣은 상태다.

### 근본 원인

> `business-to-project`는 결핍의 **증상**일 뿐이다. 근본 원인은 Navigator에 **Graph(관계 기층)와 그 위의 Journey View가 없어**, "여러 Workflow를 잇는 end-to-end 업무 스토리"를 담을 수 없다는 것이다.

이 문서는 그 사례 하나를 푸는 것이 아니라, **관통 흐름 일반을 담을 Graph First 모델**을 정의한다.

---

## 4. Domain Concepts

Graph 위에 얹히는 새 개념 **Journey**를 정의하고 용어를 검증한다.

### 4.1 Journey — 정의 (named path = business narrative = end-to-end)

> **Journey는 Graph 위의 named path이며, 동시에 현업이 이해하는 business narrative이고, end-to-end 업무 흐름이다.**
> 이 셋은 충돌하는 별개가 아니라 **같은 개념의 다른 표현**이다.

| 표현 | 관점 | 의미 |
|---|---|---|
| **Named Path** | Graph(기술) | Relation 엣지를 따라가는, 이름 붙은 Workflow 순서 경로 (§6.2) |
| **Business Narrative** | 현업(업무) | "사업 수주부터 정산까지" 같은 이해 가능한 업무 스토리 |
| **End-to-End 흐름** | ERP | 여러 Category·모듈을 관통하는 E2E 프로세스(O2C·P2P·R2R) |

성질:

- 한 Journey는 **여러 Category를 관통**한다 (사업시작 → 구매 → 정산).
- 한 Workflow는 **여러 Journey에 재사용**된다 (구매요청→입고→매입전표는 사업 수주 Journey와 단순 구매 Journey 양쪽에 등장).
- 따라서 Journey ↔ Workflow 는 **다대다(N:M) 순서 관계**다 → 트리가 아니라 Graph 위의 path여야 한다.

### 4.2 축(Axis) 정리 — 포함 vs 직교

개념들은 **같은 축 안의 포함 관계**와 **서로 직교하는 축**을 구분해야 한다(정밀 정의는 §9 불변식).

| 축 | 구성 | 관계 |
|---|---|---|
| **Catalog Axis** | Category ⊃ Workflow ⊃ Variant | **포함**(트리). Category와 Workflow는 직교가 아니라 포함 |
| **Operational Axis** | Lane | 조직/책임 관점, Catalog에 **직교** |
| **Relationship Axis** | Journey · Relation | Workflow들을 관통, Catalog에 **직교** |

> 즉 직교하는 것은 **[Catalog 트리] ⊥ [Operational/Lane] ⊥ [Relationship/Journey]** 세 축이다. Category·Workflow·Variant는 한 축(Catalog) 안의 포함 계층이다.

### 4.3 Journey ≠ Overview (기존 개념과의 구분)

Navigator에는 이미 **Overview**(하이레벨로 손수 그린 프로세스 다이어그램, `overviewProcessGroups`)가 있다. Journey는 이것과 다르다.

| | Overview | Journey |
|---|---|---|
| 실체 | 노드/엣지로 **그린 다이어그램** | Graph 위의 **named path**(Workflow 참조 순서) |
| 목적 | 큰 그림을 시각적으로 보여줌 | 흐름을 **탐색·연결**하고 딥링크로 이동 |
| 데이터 | nodes/edges | Workflow 참조의 순서 목록 |
| 관계 | Detail과 1:N 링크 | Workflow와 N:M |

Journey는 원한다면 Overview 스타일로 시각화될 수 있으나, 1차적으로는 그림이 아니라 **Graph 위의 관계 경로**다.

### 4.4 용어 검증 — "Journey"가 최선인가

ERP 적합성 / AI 적합성 / 현업 이해도 3축으로 6개 후보를 비교한다.

| 후보 | ERP 적합성 | AI 적합성 | 현업 이해도 | 판정 |
|---|---|---|---|---|
| **Business Journey** | 중 (채택 증가, 단 CX '고객여정' 오버로드) | 상 (서사 단위 명확) | **상** | **UI 용어 1순위** |
| End-to-End Process (E2E) | **상** (O2C·P2P·R2R 정본) | 상 | 중 | **문서 정합 앵커 / 강력 2순위** — 단 기존 `Process` 엔티티와 명칭 충돌 |
| Value Stream | 상 (EA 정밀) | 중 | 하 (Lean 뉘앙스, "가치흐름" 어색) | 3순위 |
| Process Chain | 하 (**SAP BW 기술용어 충돌**) | 중 | 하 | 기각 |
| Business Scenario | 중 (TOGAF 정식 아티팩트지만 "요구 도출 기법" 의미) | 중 | 중 | 기각 — 사이드바에서 이미 Variant를 'scenario'로 지칭 → **Variant와 충돌** |
| Navigation Scenario | 하 (ERP 계보 없음) | 하 | 하 (도구 내부 자기지칭) | 기각 |

**결정 (Phase 4.0 비준 항목):** UI 용어 **"Journey"(업무 여정)** + **중립 스키마 키** 채택, 문서에서는 **"Business Journey = 여러 Workflow를 관통하는 End-to-End(E2E) 업무 스토리"** 로 정의하여 ERP의 E2E 어휘(O2C·P2P·R2R)와 명시 정렬한다.

- 근거: E2E가 개념상 가장 정확하나 기존 **`Process` 엔티티와 명칭 충돌**("Process vs E2E Process")이 실질 결격사유다. 중립 스키마 키를 쓰면 향후 순수 ERP 레지스터(예: Value Stream)로 바꾸더라도 **라벨만 교체**하면 되므로 Journey로 시작하는 리스크가 낮다.
- Business Flow(Workflow 충돌)·Process Chain(SAP BW 충돌)·Business/Navigation Scenario(Variant 충돌·계보 없음)는 어느 경우에도 채택하지 않는다.

---

## 5. Navigation Model Options

§4에서 정의한 Journey를 **어디에 둘지** 4개 모델을 8개 축으로 비교한다. (Graph First 관점에서, B·C는 Journey를 트리 계층으로 강제하는 안이다.)

### Model A — Category → Workflow → Variant (현행 Catalog View만)

| 축 | 평가 |
|---|---|
| 장점 | 변경 0, 리스크 0. 이미 안정화 |
| 단점 | 관통 흐름 표현 불가. `business-to-project` 억지 귀속 지속 |
| UX | 낱개 Workflow 조회엔 충분, "수주부터 정산까지" 스토리 탐색 불가 |
| ERP 적합성 | 낮음 — ERP 핵심인 E2E(O2C·P2P) 표현 못함 |
| AI 적합성 | 중 — end-to-end 서사 컨텍스트 부재 |
| 확장성 | 낮음 — 관통 흐름 요구마다 카테고리에 끼워넣는 안티패턴 |
| 구현 난이도 | 없음 |
| **추천** | **비추천** (문제 미해결) |

### Model B — Category → Journey → Workflow → Variant

| 축 | 평가 |
|---|---|
| 장점 | 트리에 한 계층만 추가하는 듯 보임 |
| 단점 | **치명적 모순** — Journey는 Category를 *관통*하는데 이 모델은 Journey를 한 Category *아래*에 가둔다. `business-to-project`(사업시작+구매+정산)를 단일 Category 밑에 둘 수 없음 |
| UX | Journey가 카테고리에 종속되어 "부서 횡단" 본질 상실 |
| ERP 적합성 | 낮음 — E2E는 부서/모듈 횡단이 정의인데 부정 |
| AI 적합성 | 중 — 단일 부모라 관통 관계 학습 불가 |
| 확장성 | 낮음 — 한 Workflow가 여러 Journey에 속할 수 없음(트리 한계) |
| 구현 난이도 | 중 |
| **추천** | **비추천** (Journey 정의와 정면 충돌) |

### Model C — Journey → Category → Workflow → Variant

| 축 | 평가 |
|---|---|
| 장점 | Journey가 최상위 그릇으로 보임 |
| 단점 | ① 대부분 Workflow(재고이동·저장위치 등록 등)는 어느 단일 Journey에도 안 속하는 **재사용 부품** → 인위적 Journey 강제. ② 트리 단일부모라 재사용 Workflow 표현 불가. ③ Phase 0이 지킨 **Lifecycle 생애주기 서사** 강등 |
| UX | Journey 없는 다수 프로세스의 진입 경로 왜곡 |
| ERP 적합성 | 중 — E2E는 표현하나 재사용 표준 흐름을 억지 종속 |
| AI 적합성 | 중~상 — 서사는 좋으나 다대다를 트리로 눌러 손실 |
| 확장성 | 낮음 — 전체 IA 재루팅 |
| 구현 난이도 | **높음** — 카테고리 데이터 이관 + 사이드바 완전 재구축. Phase 0 "카테고리 대개편 금지" 위반 |
| **추천** | **비추천** (다대다를 트리로 강제, 대규모 회귀) |

### Model D — Journey를 Graph 위의 별도 축(관계)으로 (추천)

Journey를 계층 트리에 끼우지 않는다. Catalog View(Category → Workflow → Variant)는 **그대로 두고**, Journey를 **Graph 위의 named path(별도 Relationship Axis)** 로 추가한다.

```text
Catalog View(불변)                 Journey View(신규 · Graph 위 named path)
 Category                          Journey: 사업 수주 → 정산
  └ Workflow                        ├ [사업기회→계약→구매요청]   ┐
      └ Variant                     ├ [구매요청→입고→매입전표]   ├ 기존 Workflow를
                                    └ [프로젝트 정산]            ┘ 순서대로 참조
```

| 축 | 평가 |
|---|---|
| 장점 | Journey의 **다대다·Category 관통**을 그대로 표현(Graph 경로이므로 트리 단일부모 한계 없음). 기존 Catalog View 완전 보존(additive, 마이그레이션 0). `business-to-project`가 Journey로 자연 승격 → O5 미결이 카테고리 개편 없이 해소 |
| 단점 | Journey↔Workflow 참조 무결성 관리 필요. View가 늘어 초기 학습 부담 소폭 |
| UX | 목적별 진입: "특정 업무 찾기"=Catalog, "업무 전체 흐름 이해"=Journey. Journey 단계 클릭 시 Catalog로 딥링크 |
| ERP 적합성 | **높음** — ERP의 E2E(O2C·P2P·R2R)와 1:1 대응 |
| AI 적합성 | **높음** — Variant(구체)·Workflow(표준)·Journey(서사) 다층 질의 확보 |
| 확장성 | **높음** — Graph 위 관계축 additive. Search/AI로 자연 확장 |
| 구현 난이도 | 중 — 데이터(Graph 관계)는 경량 additive, 비용은 UI. 독립 PR 분할 가능 |
| **추천** | **추천** |

### 비교 매트릭스

| 축 | A(현행) | B(중간삽입) | C(최상위) | **D(Graph 관계축)** |
|---|---|---|---|---|
| 관통 흐름 표현 | ✗ | △(가둠) | ○(왜곡) | **◎** |
| 다대다(Workflow 재사용) | ✗ | ✗ | ✗ | **◎** |
| Catalog View 보존 | ◎ | ✗ | ✗ | **◎** |
| Category 서사 유지 | ◎ | △ | ✗ | **◎** |
| ERP E2E 적합성 | ✗ | ✗ | ○ | **◎** |
| AI 다층 탐색 | △ | △ | ○ | **◎** |
| 마이그레이션 리스크 | 없음 | 중 | 높음 | **없음(additive)** |
| Phase 0 원칙 정합 | ○ | ✗ | ✗ | **◎** |

**결론: Model D.** Journey는 본질적으로 **Category 관통 + Workflow 재사용의 다대다 관계**다. 다대다는 트리(B·C)로 표현 불가 — 반드시 **Graph 위의 관계축(D)** 이어야 한다.

---

## 6. Process Graph

Graph First 원칙(§1)의 상세 정의. Navigator의 관계 전체를 **Process Graph** 로 통합한다.

> **Process Graph = Navigator 관계의 기층(substrate).**
> 노드 = Workflow (향후 Business Object) · 엣지 = Relation · **Journey = 그래프 위의 이름 붙은 경로(named path)**.

### 6.1 Relation — 엣지(관계 타입)

Workflow(향후 Business Object 포함) 사이의 방향성 있는 연결. **Relation Edge는 Workflow/Journey/(향후 Business Object) 간 연결에 집중한다.**

| 타입 | 연결 | 의미 | 예 |
|---|---|---|---|
| `sequence` | Workflow → Workflow | 다음 단계로 이어짐 | 주문 → 출고 → 매출 |
| `trigger` | Workflow → Workflow | 한 흐름이 다른 흐름을 유발 | 매출 ⇒ 반품, 반품 ⇒ 환불 |
| `depends-on` | Workflow → Workflow | 선행 완료가 필요(의존) | 매입전표 depends-on 입고확정 |
| `part-of-journey` | Workflow → Journey | 어떤 Journey를 구성(멤버십) | 구매요청→입고→매입전표 ∈ 사업 수주 Journey |

> **`variant-of`는 Graph Edge가 아니다.** Variant는 Workflow↔Workflow(또는 Business Object) 연결이 아니라 **Catalog View 내부의 Workflow 하위 구조**(§2)다. 따라서 Relation Edge 타입에서 제외한다.
> `Dependency`는 별도 개념이 아니라 `depends-on` **Relation 타입**으로 흡수한다.
> **열린 이슈:** `환불(refund)`이 반품과 별개 Workflow인지(현 데이터에 명시 없음)는 Phase 4.2 매핑에서 확정.

### 6.2 Journey — 그래프 위의 named path

Journey는 Relation 그래프 위를 지나는 **큐레이션된, 순서 있는 경로에 이름을 붙인 것**이다(§4.1과 동일 개념).

```text
Journey "사업 수주 → 정산" =
  [사업기회→계약→구매요청] → [구매요청→입고→매입전표] → [프로젝트 정산]
```

> 개념 계층: **Relation(엣지) → Journey(엣지 위의 이름 붙은 경로)**. 관계는 여러 개여도 Journey는 그중 업무적으로 의미 있는 경로만 선별해 이름을 준다.

### 6.3 관계 표현 UX

- Workflow 상세에서 선행·후행 Workflow(엣지)를 표시.
- 판매↔반품처럼 **Category를 넘는 관계**도 엣지로 자연 표현.
- Journey는 그 엣지들 중 하나의 완결 경로를 이름과 함께 보여주는 상위 View.

---

## 7. Search Model

Graph First에서 검색은 단순 목록 검색이 아니라 **Graph Search**로 일반화된다. Navigator 철학("정산을 검색하면 관련 Workflow·Journey·프로세스를 모두 탐색")이 이를 요구한다.

### 7.1 현재 수준 — 통합 목록 검색 (구현 목표 1단계)

한 검색창이 5개 엔티티를 동시 질의하고 타입별로 그룹핑한다.

```text
검색: "정산"
├ Category   : 정산
├ Journey    : 사업 수주 → 정산  (정산으로 종결되는 스토리)
├ Workflow   : 로열티 정산 · 위탁 매출 정산 · 수익배분 정산 · 프로젝트 정산
├ Variant    : (해당 Workflow의 실행 유형들)
└ Process    : 위탁 매출 정산, 프로젝트 정산 …
```

- 매칭은 이름 + 키워드/태그(확장 슬롯). 아직은 엔티티 목록을 타입별로 그룹핑하는 **federated 목록 검색** 수준이다.

### 7.2 향후 — Graph Search (확장)

> 검색은 매칭된 **노드에서 시작해 Relation Edge를 따라** 관련 Workflow·Journey·(향후 Business Object: 계약·프로젝트)·인접 프로세스·**경로(path)** 를 반환하는 **Graph Search**로 확장된다.

- 목록 검색과의 차이: 결과가 "엔티티 목록"이 아니라 "매칭 노드의 **연결 이웃·경로**". 예) "정산" → 정산 Workflow 노드 → 역방향 `part-of-journey`로 그 정산으로 종결되는 Journey, `sequence`/`trigger` 이웃으로 선행 흐름까지 반환.
- **Business Object 검색(계약·프로젝트)은 §11 상한선의 범위 확장** 결정을 요한다. Graph Search는 그 확장의 자연스러운 그릇이다(노드에 Business Object 추가 시 동일 탐색으로 편입).
- 단계 구분: **현재 = 목록 검색 / 향후 = Graph Search + Business Object 노드**. 본 문서는 구조가 Graph Search로 확장 가능함을 명시하되, 구현은 Phase 4.4 이후.

---

## 8. AI Navigation

### 8.1 AI는 Consumer다 (아키텍처 계층이 아니다)

> **AI는 아키텍처 계층이 아니라 Process Graph와 Navigation Engine의 Consumer다.** AI는 Graph를 **질의·탐색·설명**하는 사용자/인터페이스 역할을 하며, 모델의 구성요소(노드·엣지·View)가 아니다.

- §1 레이어 스택에서 AI는 UI와 **나란한 Consumer**다. Graph(기층)·Navigation Engine(순회/질의)이 제공하는 것을 소비할 뿐, 그 아래로 내려가지 않는다.
- 따라서 AI 관련 기능(추천·서사·드릴다운)은 모두 "Graph가 가능케 하는 소비 역량"으로 다루며, 별도의 구조 개념으로 신설하지 않는다.

### 8.2 AI의 질의 진입점 (Graph 위)

AI가 "무엇이 무엇과 연결되는가"를 추론하는 native substrate는 **Process Graph**이며, Variant·Workflow·Journey는 그래프로 들어가는 **질의 진입점**이다.

| 진입점 | 질의 예 | 해석 대상 | 응답 컨텍스트 |
|---|---|---|---|
| **Variant** | "응원봉 구매 프로세스" | variantLabel/키워드 | 특정 Process 1개 |
| **Workflow** | "매입전표까지 구매 흐름" | Workflow steps/키워드 | 표준 흐름 + Variant 목록 |
| **Journey** | "신규 사업 수주부터 정산까지 전체 흐름" | Journey(=Graph 위 named path) | **end-to-end 서사** + 각 단계 Workflow |

### 8.3 Graph가 가능케 하는 소비 역량

- **서사 내레이션**: Journey 경로를 단계별로 설명하고, 각 단계에서 실제 Workflow/Variant로 딥링크.
- **드릴다운**: "이 Journey에서 구매 단계만 자세히".
- **AI Recommendation**: 엣지·경로 근접성으로 "이 흐름과 연결된 다음/관련 흐름"을 제안 — Graph Search(§7.2)와 동일 기층 위의 소비 역량.

---

## 9. Responsibilities & Invariants

각 개념의 책임 경계와 축 구분을 불변식으로 고정한다. (관통 흐름을 Workflow에 다시 끼워넣는 안티패턴 재발 방지.)

- **불변식 1 — Workflow 책임 한계:** Workflow는 [단일 흐름의 표준화 + 그 Variant들]을 책임진다. **Workflow는 여러 Workflow 간 순서·연결을 책임지지 않는다** — 그것은 Journey/Relation의 책임이다.
- **불변식 2 — Journey 책임:** Journey는 [여러 Workflow의 순서 있는 연결 + 그 end-to-end 서사]를 책임진다. Journey는 Workflow의 내부 단계나 노드를 소유하지 않는다(참조만 한다).
- **불변식 3 — 축 구분 (포함 vs 직교, 정밀):**
  - **Catalog Axis** — `Category ⊃ Workflow ⊃ Variant`는 **포함 관계**다. Workflow는 Category에 **귀속**되고, Variant는 Workflow **하위**다. → **Category와 Workflow는 직교가 아니다.**
  - **Operational Axis** — Lane은 조직/책임 관점의 축으로, Catalog Axis에 **직교**한다.
  - **Relationship Axis** — Journey·Relation은 여러 Workflow를 관통하는 축으로, Catalog Axis에 **직교**한다.
  - 즉 서로 직교하는 것은 **[Catalog 트리] ⊥ [Operational/Lane] ⊥ [Relationship/Journey]** 세 축이며, 세 축 모두 하나의 Process Graph 위의 서로 다른 View다(§1).
- **불변식 4 — 참조 무결성:** Journey는 존재하는 `workflowId`만 참조한다. 참조 대상이 없으면 그 단계는 무시(graceful)하되 경고 대상이다.

---

## 10. Recommended Architecture

### 10.1 최종 모델: Model D (Journey = Process Graph 위의 named path)

두 결정을 **분리**한다.

- **데이터 결정 (확정):** Journey를 **Graph 위의 관계축**으로 도입한다. `workflows[]`와 동일한 additive·v2 유지·Import 관용 파싱 패턴(선례 O3/C1)으로, 최상위 optional 배열에 Journey(= Workflow 참조의 순서 목록 + 메타)를 둔다. 이것이 하중을 받는 결정이다.
- **UI 결정 (표현 옵션 — Phase 4 재량):** Journey를 사용자에게 어떻게 노출할지는 **여러 선택지**가 있다 — (a) 별도 Journey View 렌즈/탭, (b) Workflow 상세 안의 "이 흐름이 속한 Journey" 인라인 컨텍스트, (c) Overview 스타일 시각화. 개념 문서는 UI 형태를 확정하지 않는다(Sidebar Tree도 View 하나일 뿐, §1).

### 10.2 개념 수준 형태 (상세 스키마는 Phase 4.1)

Journey는 개념적으로 다음을 담는다(정규 필드 정의는 Phase 4.1 명세로 이관):

- **식별/표시:** id, 이름, 순서
- **경로(named path):** 참조하는 Workflow들의 **순서 목록** (각 단계 = workflowId + order + 선택 주석)
- **메타(선택):** 설명, 트리거, 진입/종료 조건, 검색·AI 키워드, 태그

> `categorySpan`(관통 카테고리)은 참조 Workflow들의 category에서 **파생 계산**되므로 저장하지 않는다(derived).

### 10.3 왜 D인가 (요약)

- **다대다·Category 관통** → 트리(B·C) 불가, Graph 위 관계축(D)만 가능.
- **additive·무마이그레이션** → v1.0-baseline·Phase 0~2 원칙 계승(카테고리 개편 금지 준수). Catalog View 불변.
- **아무것도 버리지 않음** → Lifecycle 서사(Phase 0 가치) + Catalog View(Phase 2 산출물) 보존.
- **`business-to-project` 자연 해소** → Workflow 억지 귀속을 그만두고 Journey로 승격, 그 경로는 기존 좁은 Workflow들을 참조. **카테고리 이관 0으로 O5 종결.**
- **독립 PR 분할** → 데이터·View·검색·AI를 단계 게이트로. 실패 시 Journey 축 무시하면 현행 복귀.

---

## 11. Navigator Philosophy & Scope Boundary

> **Navigator는 Business Navigator다** — 업무의 표준 흐름(Workflow)을 분류·조회하고, 그 흐름들을 잇는 end-to-end 스토리(Journey)와 그 연결(Process Graph)을 **탐색·연결**하는 도구. 프로세스를 나열하는 뷰어가 아니다.

**상한선(명시):** Navigator는 **Navigation 플랫폼**이며, **Process Intelligence(측정·분석·마이닝)는 범위 밖**이다.

- Workflow Explorer(낱개 조회)보다 넓고 — Journey·Graph·통합 검색으로 "연결"을 다룬다.
- Process Intelligence(KPI·Process Health·Analytics·Event log 기반 성과 측정)보다 좁다 — Navigator는 "무엇이 어떻게 연결되는가"를 다루지 "얼마나 잘 수행되는가"를 측정하지 않는다.

이 상한선 덕분에 §12의 미도입 개념들은 **누락이 아니라 의도적 유보**로 읽힌다. (단, §7.2의 Business Object 검색이 도입되면 이 상한선의 "탐색 대상" 경계가 확장된다 — 그 시점의 별도 결정 사항.)

---

## 12. Long-Term Concept Handling (Adopted / Absorbed / Deferred / Out-of-Scope)

Navigator 장기 발전 후보 개념들의 처리 방침. 지금 도입하지 않더라도 **검토했음을 명시**하고, **구분(채택/흡수/유보/범위밖)을 분명히** 하여 문서를 완결한다.

| 개념 | 구분 | 처리 |
|---|---|---|
| **Process Graph** | **채택 (Adopted)** | §1·§6 — Navigator의 기층으로 정식 도입 |
| Dependency | **흡수 (Absorbed)** | 별도 개념 아님 → `depends-on` Relation 타입(§6.1) |
| AI Recommendation | **흡수 (Absorbed)** | 구조 개념 아님 → Graph가 가능케 하는 AI 소비 역량(§8.3) |
| Business Object Search | **유보 (Deferred)** | Graph Search + Business Object 노드(§7.2). 범위 확장 결정 필요 |
| Event | **유보 (Deferred)** | 기존 `trigger` 슬롯과 연결. 이벤트 기반 자동화는 향후 |
| Decision | **유보 (Deferred)** | 이미 노드 레벨 `decisionNodeSpec` 존재. 내비게이션 개념 확장은 향후 |
| KPI / Process Health / Process Analytics | **범위 밖 (Out-of-Scope)** | Process Intelligence 클러스터. §11 상한선에 의해 의도적 유보 |

---

## 13. Roadmap (Phase 4 Proposal)

Phase 4는 "Journey를 Graph First 모델로 도입"하는 단계다. Phase 0~3의 **문서 우선 → 승인 게이트 → additive 구현 → 독립 PR** 규율을 따른다.

| Phase | 범위 | 산출물 | 코드/데이터/UI |
|---|---|---|---|
| **4.0** | 본 문서 비준 (아래 체크리스트) | 승인 기록(DecisionLog) | 불변 |
| **4.1** | Journey/Relation 최소 스키마 명세 | 정규 필드 정의 + `DataModel.md`/`ProcessDefinition.md` 개정(별도 세션) | 문서만 |
| **4.2** | 초기 Journey·Relation 매핑 | `business-to-project` 최우선. 환불 경계 확정. O2C/P2P 후보 | 데이터 명세만 |
| **4.3** | Journey View 노출 UI(렌즈/인라인 중 택) | 읽기 전용 탐색 우선 | 코드+UI (additive) |
| **4.4** | 통합 검색 → Graph Search 확장 | 목록 검색 → 노드/엣지 경로 반환 | 코드+UI |
| **4.5** | Relation·Graph 표현 | 관계 타입 표면화 + Journey=경로 시각화 | 코드+UI |
| **4.6** | AI Navigation | Graph 기층 서사·드릴다운·Recommendation | 코드+데이터 |

### Phase 4.0 비준 체크리스트 (승인 게이트)

Phase 4.0은 다음을 **명시적으로 각각 승인**해야 성립한다. 하나라도 미비준이면 그 항목은 확정되지 않는다.

- [ ] **① Navigation Model** — Model D(Journey = Graph 위 관계축) 승인
- [ ] **② Terminology** — "Journey"(UI) + 중립 스키마 키, E2E 정렬 승인
- [ ] **③ Graph First Principle** — Process Graph 기층 + Multiple Views(Catalog/Journey/Operational) 승인
- [ ] **④ Relation Type** — `sequence`·`trigger`·`depends-on`·`part-of-journey` 4종 승인(`variant-of`는 Catalog 내부, 엣지 제외)
- [ ] **⑤ Workflow/Journey 책임 불변식** — §9 불변식 1~4(특히 축 구분) 승인
- [ ] **⑥ Scope Boundary** — Business Navigator + Process Intelligence 범위 밖 승인
- [ ] **⑦ `business-to-project` 승격** — Workflow 억지 귀속 → Journey 후보 승격 승인
- [ ] **⑧ 01_Architecture 승격 여부** — 본 문서를 Approved 후 `01_Architecture/`로 이동·정본화할지 승인

- 각 Phase는 **독립 PR**, additive, 승인 게이트. 4.3부터 사용자 체감 시작.
- 4.1의 Architecture 문서 개정은 **본 세션 범위 밖**(별도 승인). 본 문서는 제안만.
- 저장-리로드 필드 보존 회귀 테스트 필수(laneIds 유실 선례, PR #6).

---

## 확정 대상 요약 (Phase 4 착수 전)

- **Graph First** — Process Graph가 기층, Category→Workflow→Variant 트리와 Journey는 그 위의 서로 다른 View. Sidebar Tree는 Graph가 아니라 하나의 UI Projection.
- **도메인/내비게이션 모델 = Model D** — Journey를 **Graph 위의 named path(관계축)** 로. 데이터 결정(관계축)과 UI 결정(노출 방식)을 분리.
- **Journey = named path = business narrative = end-to-end 흐름** (같은 개념의 세 표현), N:M 순서 관계, Relationship Axis.
- **용어 = "Journey"(UI) + 중립 스키마 키**, E2E와 정렬. Business Flow·Process Chain·Business/Navigation Scenario 기각.
- **Process Graph = 관계 기층** (노드=Workflow·엣지=Relation·Journey=경로). Relation 타입 **4종**(`variant-of` 제외). AI의 native substrate.
- **축 구분(정밀)** — Catalog(포함) ⊥ Operational/Lane ⊥ Relationship/Journey. Category와 Workflow는 직교 아님(포함).
- **AI = Consumer** — 아키텍처 계층이 아니라 Graph/Navigation Engine의 소비자.
- **Search = Graph Search 확장 가능** — 현재 목록 검색 / 향후 노드·엣지 경로 반환 + Business Object 노드.
- **철학 = Business Navigator**, Process Intelligence(KPI·Health·Analytics)는 **범위 밖**.
- **`business-to-project`는 Workflow가 아니라 Journey** — 카테고리 개편 없이 O5 해소.
- 본 세션은 문서만. 코드/데이터/UI/Architecture 불변.
