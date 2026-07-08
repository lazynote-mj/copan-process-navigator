# Navigator Information Architecture

|Field|Value|
|---|---|
|Title|Navigator 정보 구조 — Domain Model · Navigation Model (Journey 도입)|
|Purpose|Workflow/Variant 안정화 이후 Navigator가 "최종적으로 무엇을 표현·탐색하는 도구인가"를 정의하고, Journey(여러 Workflow를 관통하는 업무 흐름)·Relation·Process Graph가 그 모델 안에서 어떤 관계로 존재하는지 확정한다.|
|Status|Review (Draft)|
|Owner|혁신팀|
|Last Updated|2026-07-08|
|Baseline|`v1.0-baseline` + Workflow/Variant 구현 완료 (PR #13~#17 merged)|
|Document Class|**최상위 설계 원칙 문서** — Navigator의 도메인/내비게이션 모델을 정의한다. "Phase 3"는 이 문서의 **최초 비준(ratification) 시점**을 가리키는 시간표식일 뿐, 문서의 위상은 특정 Phase 산출물이 아니다.|
|Related Docs|`Workflow-Variant-IA-Review.md`, `Workflow-Refactor-Phase0-Decision.md`, `Workflow-Phase2-Open-Issues-Decision.md`, `01_Architecture/DataModel.md`, `02_Master/ProcessDefinition.md`|

> Review·설계 문서다. 본 세션은 개념 설계만 하며 코드·데이터(`state.json`)·UI·Architecture 문서를 수정하지 않는다. 여기서 확정된 방향은 Phase 4 착수 전 혁신팀 승인 대상이다.
>
> **위상 주해:** 이 문서는 장기적으로 `01_Architecture/`로 승격되어 Navigator의 정본 IA/도메인 모델이 되는 것을 지향한다. 위치 이동·승격은 별도 승인 사항이며, 현재는 Review 단계로 `05_Review/Codex`에 둔다.

---

## 1. Current Model

### 구현·안정화된 범위

| 계층 | 실체 | 데이터 근거 |
|---|---|---|
| **Category** (Lifecycle 7종) | 사업시작 / 기준정보 / 구매입고 / 판매 / 반품 / 재고 / 정산 | `appConfig.lifecycleGroups`, 그룹의 `lifecycleGroupId` |
| **Workflow** | 동일 단계 시퀀스를 공유하는 표준 흐름 (17개) | `state.json` 최상위 `workflows[]` (additive) |
| **Variant** | Workflow 안의 실행 유형 (채널·거래유형·예외) | `DetailProcessGroup.workflowId` + `variantLabel` + `variantOrder` |
| **Process** | 화면에 렌더되는 개별 인스턴스 | `ProcessInstance` (nodes/edges/zones) |

현재 구조는 다음 3계층 트리다.

```text
Category
  └ Workflow
      └ Variant   ( = Process 1개)
```

PR #13(스키마) → #14(27개 매핑) → #15(Sidebar IA) → #16(Explorer UX) → #17(전표명 정규화)로 구현·안정화되었고, `laneIds`/`workflows[]`와 동일한 **additive·하위호환·직교축** 원칙 위에 서 있다.

---

## 2. Problem

현재 3계층 트리는 **여러 Workflow를 관통하는 업무 흐름(end-to-end)** 을 담을 계층·관계가 없다.

### 증상 — `wf-business-to-project`

현행 17 Workflow 중 `wf-business-to-project`(status=draft)는 성격이 다르다. 실측 노드 흐름(21노드):

```text
사업기회확보 → 사업참여검토 → 계약등록 → 사업계약품의 → 프로젝트등록
 → 사업실행품의 → 구매요청 → 품목/거래처 등록 → 발주품의 → 계약/발주등록
 → 입고확인 → 입고확정 → 재고인식 → 매입마감확정 → 매입전표 반영
```

이 흐름은 **사업시작 + 구매/입고 + (정산)** 이라는 여러 Category를 관통한다. 즉 하나의 Workflow가 아니라 **여러 Workflow를 순서대로 잇는 상위 흐름**이다. 담을 자리가 없어 편의상 `business-start` 카테고리에 draft로 끼워 넣은 상태다.

### 근본 원인

> `business-to-project`는 결핍의 **증상**일 뿐이다. 근본 원인은 Navigator가 "낱개 Workflow의 카탈로그"는 표현하지만 **"여러 Workflow를 잇는 end-to-end 업무 스토리"를 담을 개념·관계가 모델에 없다**는 것이다.

이 문서는 그 사례 하나를 푸는 것이 아니라, **관통 흐름 일반을 담을 Navigator의 최종 도메인·내비게이션 모델**을 정의한다.

---

## 3. Domain Concepts

모델 배치(§4)를 논하기 전에, 새 개념 **Journey**를 먼저 정의하고 용어를 검증한다.

### 3.1 Journey — 정의

**Journey = 여러 Workflow를 순서대로 잇는, 이름이 부여된 end-to-end 업무 스토리.**

- 한 Journey는 **여러 Category를 관통**한다 (사업시작 → 구매 → 정산).
- 한 Workflow는 **여러 Journey에 재사용**된다 (구매요청→입고→매입전표는 사업 수주 Journey와 단순 구매 Journey 양쪽에 등장).
- 따라서 Journey ↔ Workflow 는 **다대다(N:M) 순서 관계**다.

### 3.2 4개념의 축 정리

| 개념 | 성격 | 예 | 카디널리티 |
|---|---|---|---|
| **Category** | 업무 생애주기 버킷 (축 1) | 판매, 구매/입고 | Workflow를 담음 |
| **Workflow** | 재사용 표준 흐름 (축 2) | 주문→출고→매출전표 | N Variant 보유 |
| **Variant** | 실행 유형 | B2B국내, B2C | 1 Process |
| **Journey** | Workflow들을 잇는 업무 스토리 (**신규 축**) | 사업 수주→정산 | **N Workflow 참조(순서)** |

> Category·Workflow·Lane이 이미 **직교축**으로 공존하듯(Phase 0), Journey는 그 위에 얹히는 **또 하나의 직교축(업무 스토리 축)** 이다. 트리의 한 계층이 아니다.

### 3.3 Journey ≠ Overview (기존 개념과의 구분)

Navigator에는 이미 **Overview**(하이레벨로 손수 그린 프로세스 다이어그램, `overviewProcessGroups`)가 있다. Journey는 이것과 다르다.

| | Overview | Journey |
|---|---|---|
| 실체 | 노드/엣지로 **그린 다이어그램** | Workflow들을 참조하는 **구조화된 링크 집합** |
| 목적 | 큰 그림을 시각적으로 보여줌 | 흐름을 **탐색·연결**하고 딥링크로 이동 |
| 데이터 | nodes/edges | Workflow 참조의 순서 목록 |
| 관계 | Detail과 1:N 링크 | Workflow와 N:M |

Journey는 원한다면 Overview 스타일로 시각화될 수 있으나, 1차적으로는 그림이 아니라 **탐색을 구동하는 관계 모델**이다. (Journey를 Overview로 렌더링하는 선택지는 열어두되, 본질은 관계다.)

### 3.4 용어 검증 — "Journey"가 최선인가

ERP 적합성 / AI 적합성 / 현업 이해도 3축으로 6개 후보를 비교한다.

| 후보 | ERP 적합성 | AI 적합성 | 현업 이해도 | 판정 |
|---|---|---|---|---|
| **Business Journey** | 중 (채택 증가, 단 CX '고객여정' 오버로드) | 상 (서사 단위 명확) | **상** | **UI 용어 1순위** |
| End-to-End Process (E2E) | **상** (O2C·P2P·R2R 정본) | 상 | 중 | **문서 정합 앵커 / 강력 2순위** — 단 기존 `Process` 엔티티와 명칭 충돌 |
| Value Stream | 상 (EA 정밀) | 중 | 하 (Lean 뉘앙스, "가치흐름" 어색) | 3순위 |
| Process Chain | 하 (**SAP BW 기술용어 충돌**) | 중 | 하 | 기각 |
| Business Scenario | 중 (TOGAF 정식 아티팩트지만 "요구 도출 기법" 의미) | 중 | 중 | 기각 — 사이드바에서 이미 Variant를 'scenario'로 지칭 → **Variant와 충돌** |
| Navigation Scenario | 하 (ERP 계보 없음) | 하 | 하 (도구 내부 자기지칭) | 기각 |

**결정 (Phase 4.0 최우선 승인 항목):** UI 용어 **"Journey"(업무 여정)** + **중립 스키마 키** 채택, 문서에서는 **"Business Journey = 여러 Workflow를 관통하는 End-to-End(E2E) 업무 스토리"** 로 정의하여 ERP의 E2E 어휘(O2C·P2P·R2R)와 명시 정렬한다.

- 근거: E2E가 개념상 가장 정확하나 기존 **`Process` 엔티티와 명칭 충돌**("Process vs E2E Process")이 실질 결격사유다. 중립 스키마 키를 쓰면 향후 순수 ERP 레지스터(예: Value Stream)로 바꾸더라도 **라벨만 교체**하면 되므로 Journey로 시작하는 리스크가 낮다.
- Business Flow(Workflow 충돌)·Process Chain(SAP BW 충돌)·Business/Navigation Scenario(Variant 충돌·계보 없음)는 어느 경우에도 채택하지 않는다.

---

## 4. Navigation Model Options

§3에서 정의한 Journey를 어디에 둘지 4개 모델을 8개 축으로 비교한다.

### Model A — Category → Workflow → Variant (현행)

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

### Model D — Journey를 별도 축(관계)으로 (추천)

Journey를 계층 트리에 끼우지 않는다. Category → Workflow → Variant(카탈로그)는 **그대로 두고**, Journey를 **여러 Workflow를 순서대로 참조하는 별도 관계축**으로 추가한다.

```text
카탈로그(불변)                     Journey 축(신규 · 관계)
 Category                          Journey: 사업 수주 → 정산
  └ Workflow                        ├ [사업기회→계약→구매요청]   ┐
      └ Variant                     ├ [구매요청→입고→매입전표]   ├ 기존 Workflow를
                                    └ [프로젝트 정산]            ┘ 순서대로 참조
```

| 축 | 평가 |
|---|---|
| 장점 | Journey의 **다대다·Category 관통**을 그대로 표현(관계이므로 트리 단일부모 한계 없음). 기존 IA 완전 보존(additive, 마이그레이션 0). `business-to-project`가 Journey로 자연 승격 → O5 미결이 카테고리 개편 없이 해소 |
| 단점 | Journey↔Workflow 참조 무결성 관리 필요. 탐색 진입점이 늘어 초기 학습 부담 소폭 |
| UX | 목적별 진입: "특정 업무 찾기"=카탈로그, "업무 전체 흐름 이해"=Journey. Journey 단계 클릭 시 카탈로그로 딥링크 |
| ERP 적합성 | **높음** — ERP의 E2E(O2C·P2P·R2R)와 1:1 대응 |
| AI 적합성 | **높음** — Variant(구체)·Workflow(표준)·Journey(서사) 다층 질의 확보 |
| 확장성 | **높음** — 관계축 additive. Graph/Search/AI로 자연 확장 |
| 구현 난이도 | 중 — 데이터(관계축)는 경량 additive, 비용은 UI. 독립 PR 분할 가능 |
| **추천** | **추천** |

### 비교 매트릭스

| 축 | A(현행) | B(중간삽입) | C(최상위) | **D(관계축)** |
|---|---|---|---|---|
| 관통 흐름 표현 | ✗ | △(가둠) | ○(왜곡) | **◎** |
| 다대다(Workflow 재사용) | ✗ | ✗ | ✗ | **◎** |
| 기존 IA 보존 | ◎ | ✗ | ✗ | **◎** |
| Category 서사 유지 | ◎ | △ | ✗ | **◎** |
| ERP E2E 적합성 | ✗ | ✗ | ○ | **◎** |
| AI 다층 탐색 | △ | △ | ○ | **◎** |
| 마이그레이션 리스크 | 없음 | 중 | 높음 | **없음(additive)** |
| Phase 0 원칙 정합 | ○ | ✗ | ✗ | **◎** |

**결론: Model D.** Journey는 본질적으로 **Category 관통 + Workflow 재사용의 다대다 관계**다. 다대다는 트리(B·C)로 표현 불가 — 반드시 **관계축(D)** 이어야 한다.

---

## 5. Process Graph

Journey를 담으려면 그 하부에 **Workflow 간 관계**를 표현할 수 있어야 한다. Navigator의 관계 전체를 **Process Graph** 로 통합 정의한다.

> **Process Graph = Navigator 관계의 기층(substrate).**
> 노드 = Workflow · 엣지 = Relation · **Journey = 그래프 위의 이름 붙은 경로(path)**.

### 5.1 Relation — 엣지(관계 타입)

Workflow 사이의 방향성 있는 쌍(pair) 관계. 관계 타입을 명시한다.

| 타입 | 의미 | 예 |
|---|---|---|
| `sequence` | 다음 단계로 이어짐 | 주문 → 출고 → 매출 |
| `trigger` | 한 흐름이 다른 흐름을 유발 | 매출 ⇒ 반품, 반품 ⇒ 환불 |
| `depends-on` | 선행 완료가 필요(의존) | 매입전표 depends-on 입고확정 |
| `variant-of` | 같은 Workflow의 실행 유형 | (Workflow↔Variant 내부 관계) |
| `part-of-journey` | 어떤 Journey를 구성 | 구매요청→입고→매입전표 ∈ 사업 수주 Journey |

> `Dependency`는 별도 개념이 아니라 `depends-on` **Relation 타입**으로 흡수한다.
> **열린 이슈:** `환불(refund)`이 반품과 별개 Workflow인지(현 데이터에 명시 없음)는 Phase 4.2 매핑에서 확정.

### 5.2 Journey — 그래프 위의 이름 붙은 경로

Journey는 Relation 그래프 위를 지나는 **큐레이션된, 순서 있는 경로에 이름을 붙인 것**이다.

```text
Journey "사업 수주 → 정산" =
  [사업기회→계약→구매요청] → [구매요청→입고→매입전표] → [프로젝트 정산]
```

> 개념 계층: **Relation(엣지) → Journey(엣지 위의 이름 붙은 경로)**. 관계는 여러 개여도 Journey는 그중 업무적으로 의미 있는 경로만 선별해 이름을 준다.

### 5.3 관계 표현 UX

- Workflow 상세에서 선행·후행 Workflow(엣지)를 표시.
- 판매↔반품처럼 **Category를 넘는 관계**도 엣지로 자연 표현.
- Journey는 그 엣지들 중 하나의 완결 경로를 이름과 함께 보여주는 상위 뷰.

---

## 6. Search Model

Navigator 철학("정산을 검색하면 관련 Workflow·Journey·프로세스를 모두 탐색")을 만족시키려면 검색은 **단일 질의 → 다중 엔티티 결과**여야 한다.

### 6.1 통합 검색 (프로세스 엔티티)

한 검색창이 5개 엔티티를 동시 질의하고 타입별로 그룹핑한다.

```text
검색: "정산"
├ Category   : 정산
├ Journey    : 사업 수주 → 정산  (정산으로 종결되는 스토리)
├ Workflow   : 로열티 정산 · 위탁 매출 정산 · 수익배분 정산 · 프로젝트 정산
├ Variant    : (해당 Workflow의 실행 유형들)
└ Process    : 위탁 매출 정산, 프로젝트 정산 …
```

- 매칭은 이름 + 키워드/태그(확장 슬롯)로, **ID 기준 관계**를 타고 상하로 확장(역참조 포함).
- 이 통합 검색은 D 모델에서만 자연스럽다 — Journey가 별도 축이어야 "Workflow 결과"와 "Journey 결과"를 **동시에** 낼 수 있다.

### 6.2 비즈니스 객체 검색 (향후 범위 확장 — 결정 필요)

> 사용자 시나리오의 "정산 검색 → 관련 **계약·프로젝트**"는 프로세스 정의를 넘어 **비즈니스 객체(Contract·Project·Master record)** 까지 검색이 닿아야 함을 뜻한다.

- 이는 단순 기능 추가가 아니라 **정체성 확장 신호**다: "Process Navigator → **Business Navigator**"(프로세스 정의 색인 → 업무 객체 색인).
- 본 문서는 이를 **인지·플래그만** 한다. 실제 도입은 별도 범위 확대 결정(§10 철학의 상한선 재조정)을 요한다. 현 Phase 4 범위에는 포함하지 않는다.

---

## 7. AI Navigation

### 7.1 AI의 native substrate = Process Graph

AI가 "무엇이 무엇과 연결되는가"를 추론하려면 계층이 아니라 **그래프**가 필요하다. 따라서 AI의 기층은 §5의 **Process Graph** 이며, Variant·Workflow·Journey는 그래프의 **질의 진입점**이다.

| 진입점 | 질의 예 | 해석 대상 | 응답 컨텍스트 |
|---|---|---|---|
| **Variant** | "응원봉 구매 프로세스" | variantLabel/키워드 | 특정 Process 1개 |
| **Workflow** | "매입전표까지 구매 흐름" | Workflow steps/키워드 | 표준 흐름 + Variant 목록 |
| **Journey** | "신규 사업 수주부터 정산까지 전체 흐름" | Journey(=Workflow 참조 순서) | **end-to-end 서사** + 각 단계 Workflow |

### 7.2 그래프가 가능케 하는 것

- **서사 내레이션**: Journey 경로를 단계별로 설명하고, 각 단계에서 실제 Workflow/Variant로 딥링크.
- **드릴다운**: "이 Journey에서 구매 단계만 자세히".
- **AI Recommendation**(그래프 파생 역량): 엣지·경로 근접성으로 "이 흐름과 연결된 다음/관련 흐름"을 제안. 별도 구조 개념이 아니라 **Process Graph가 가능케 하는 AI 역량**으로 다룬다.

---

## 8. Responsibilities & Invariants

각 개념의 책임 경계를 불변식으로 고정한다. (관통 흐름을 Workflow에 다시 끼워넣는 안티패턴 재발 방지.)

- **불변식 1 — Workflow 책임 한계:** Workflow는 [단일 흐름의 표준화 + 그 Variant들]을 책임진다. **Workflow는 여러 Workflow 간 순서·연결을 책임지지 않는다** — 그것은 Journey의 책임이다.
- **불변식 2 — Journey 책임:** Journey는 [여러 Workflow의 순서 있는 연결 + 그 end-to-end 서사]를 책임진다. Journey는 Workflow의 내부 단계나 노드를 소유하지 않는다(참조만 한다).
- **불변식 3 — 직교성:** Category(생애주기)·Lane(조직)·Workflow(흐름)·Journey(스토리)는 서로 직교한다. 어느 하나가 다른 하나의 부모 트리 계층이 되지 않는다.
- **불변식 4 — 참조 무결성:** Journey는 존재하는 `workflowId`만 참조한다. 참조 대상이 없으면 그 단계는 무시(graceful)하되 경고 대상이다.

---

## 9. Recommended Architecture

### 9.1 최종 모델: Model D (Journey = Process Graph 위의 관계축)

두 결정을 **분리**한다.

- **데이터 결정 (확정):** Journey를 **관계축**으로 도입한다. `workflows[]`와 동일한 additive·v2 유지·Import 관용 파싱 패턴(선례 O3/C1)으로, 최상위 optional 배열에 Journey(= Workflow 참조의 순서 목록 + 메타)를 둔다. 이것이 하중을 받는 결정이다.
- **UI 결정 (표현 옵션 — Phase 4 재량):** Journey를 사용자에게 어떻게 노출할지는 **여러 선택지**가 있다 — (a) 별도 Journey 렌즈/탭, (b) Workflow 상세 안의 "이 흐름이 속한 Journey" 인라인 컨텍스트, (c) Overview 스타일 시각화. 개념 문서는 UI 형태를 확정하지 않는다.

### 9.2 개념 수준 형태 (상세 스키마는 Phase 4.1)

Journey는 개념적으로 다음을 담는다(정규 필드 정의는 Phase 4.1 명세로 이관):

- **식별/표시:** id, 이름, 순서
- **경로:** 참조하는 Workflow들의 **순서 목록** (각 단계 = workflowId + order + 선택 주석)
- **메타(선택):** 설명, 트리거, 진입/종료 조건, 검색·AI 키워드, 태그

> `categorySpan`(관통 카테고리)은 참조 Workflow들의 category에서 **파생 계산**되므로 저장하지 않는다(derived).

### 9.3 왜 D인가 (요약)

- **다대다·Category 관통** → 트리(B·C) 불가, 관계축(D)만 가능.
- **additive·무마이그레이션** → v1.0-baseline·Phase 0~2 원칙 계승(카테고리 개편 금지 준수).
- **아무것도 버리지 않음** → Lifecycle 서사(Phase 0 가치) + Workflow 카탈로그(Phase 2 산출물) 보존.
- **`business-to-project` 자연 해소** → Workflow 억지 귀속을 그만두고 Journey로 승격, 그 경로는 기존 좁은 Workflow들을 참조. **카테고리 이관 0으로 O5 종결.**
- **독립 PR 분할** → 데이터·렌즈·검색·AI를 단계 게이트로. 실패 시 Journey 축 무시하면 현행 복귀.

---

## 10. Navigator Philosophy & Scope Boundary

> **Navigator는 Business Navigator다** — 업무의 표준 흐름(Workflow)을 분류·조회하고, 그 흐름들을 잇는 end-to-end 스토리(Journey)와 그 연결(Process Graph)을 **탐색·연결**하는 도구. 프로세스를 나열하는 뷰어가 아니다.

**상한선(명시):** Navigator는 **Navigation 플랫폼**이며, **Process Intelligence(측정·분석·마이닝)는 범위 밖**이다.

- Workflow Explorer(낱개 조회)보다 넓고 — Journey·Graph·통합 검색으로 "연결"을 다룬다.
- Process Intelligence(KPI·Process Health·Analytics·Event log 기반 성과 측정)보다 좁다 — Navigator는 "무엇이 어떻게 연결되는가"를 다루지 "얼마나 잘 수행되는가"를 측정하지 않는다.

이 상한선 덕분에 §11의 미도입 개념들은 **누락이 아니라 의도적 유보**로 읽힌다. (단, §6.2의 비즈니스 객체 검색이 도입되면 이 상한선의 "탐색 대상" 경계가 확장된다 — 그 시점의 별도 결정 사항.)

---

## 11. Out of Scope (Deferred)

Navigator 장기 발전 후보 개념들의 처리 방침. 지금 도입하지 않되, **검토했음을 명시**하여 문서를 완결한다.

| 개념 | 판정 | 처리 |
|---|---|---|
| **Process Graph** | **채택** | §5 — Relation+Journey의 통합 기층으로 정식 도입 |
| Dependency | 흡수 | 별도 개념 아님 → `depends-on` Relation 타입(§5.1) |
| Event | 유보 | 기존 `trigger` 슬롯과 연결. 이벤트 기반 자동화는 향후 |
| Decision | 유보 | 이미 노드 레벨 `decisionNodeSpec` 존재. 내비게이션 개념 확장은 범위 밖 |
| AI Recommendation | 역량으로 편입 | 구조 개념 아님 → Process Graph가 가능케 하는 AI 역량(§7.2) |
| KPI / Process Health / Process Analytics | **범위 밖** | Process Intelligence 클러스터. §10 상한선에 의해 의도적 유보 |

---

## 12. Roadmap (Phase 4 Proposal)

Phase 4는 "Journey를 Navigator 모델에 도입"하는 단계다. Phase 0~3의 **문서 우선 → 승인 게이트 → additive 구현 → 독립 PR** 규율을 따른다.

| Phase | 범위 | 산출물 | 코드/데이터/UI |
|---|---|---|---|
| **4.0** | 본 문서 승인 — Model D + **용어 확정(Journey/중립 키)** + Process Graph 채택 | 승인 기록(DecisionLog) | 불변 |
| **4.1** | Journey/Relation 최소 스키마 명세 | 정규 필드 정의 + `DataModel.md`/`ProcessDefinition.md` 개정(별도 세션) | 문서만 |
| **4.2** | 초기 Journey·Relation 매핑 | `business-to-project` 최우선. 환불 경계 확정. O2C/P2P 후보 | 데이터 명세만 |
| **4.3** | Journey 노출 UI(렌즈/인라인 중 택) | 읽기 전용 탐색 우선 | 코드+UI (additive) |
| **4.4** | 통합 검색 | Category/Workflow/Variant/Journey/Process 동시 검색 | 코드+UI |
| **4.5** | Relation·Graph 표현 | 관계 타입 표면화 + Journey=경로 시각화 | 코드+UI |
| **4.6** | AI Navigation | Graph 기층 서사·드릴다운·Recommendation | 코드+데이터 |

- 각 Phase는 **독립 PR**, additive, 승인 게이트. 4.3부터 사용자 체감 시작.
- 4.1의 Architecture 문서 개정은 **본 세션 범위 밖**(별도 승인). 본 문서는 제안만.
- 저장-리로드 필드 보존 회귀 테스트 필수(laneIds 유실 선례, PR #6).

---

## 확정 대상 요약 (Phase 4 착수 전)

- **도메인/내비게이션 모델 = Model D** — Journey를 **Process Graph 위의 관계축**으로. 데이터 결정(관계축)과 UI 결정(노출 방식)을 분리.
- **Journey = 여러 Workflow를 관통하는 end-to-end 업무 스토리**, N:M 순서 관계, 직교축(트리 계층 아님).
- **용어 = "Journey"(UI) + 중립 스키마 키**, E2E와 정렬. Business Flow·Process Chain·Business/Navigation Scenario 기각.
- **Process Graph = 관계 기층** (노드=Workflow·엣지=Relation·Journey=경로). Relation 타입 5종. AI의 native substrate.
- **불변식**: Workflow는 관통을 책임지지 않는다(그것은 Journey). 4축 직교.
- **철학 = Business Navigator**, Process Intelligence(KPI·Health·Analytics)는 **범위 밖**. 비즈니스 객체 검색은 향후 정체성 확장 신호로 유보.
- **`business-to-project`는 Workflow가 아니라 Journey** — 카테고리 개편 없이 O5 해소.
- 본 세션은 문서만. 코드/데이터/UI/Architecture 불변.
