# ADR-008 — Navigation Architecture (Workflow-first Navigation)

|Field|Value|
|---|---|
|Status|Proposed (구현 전 승인 대기)|
|Date|2026-07-10|
|Owner|혁신팀|
|Builds on|[ADR-001 Workflow/Variant](ADR-001-Workflow-Variant.md), [ADR-002 Graph First](ADR-002-Graph-First.md), [ADR-005 Runtime Model](ADR-005-Navigator-Runtime-Model.md)|
|Related|[Sidebar IA Analysis](../05_Review/Sidebar-IA-Analysis-Workflow-Variant.md), [ADR-007 Governance](ADR-007-Data-first-Approval-and-Runtime-Governance-Layer.md)|
|Scope|아키텍처 결정 문서 — 코드/ProcessData/Workflow정의/Detail Process ID/Governance/Property Panel/Header 무변경. **승인 전 미구현.**|

> 이 작업은 UI 재설계가 아니라 **Information Architecture 복원**이다. 핵심 명제: **Navigator의 Navigation 기준은 Lifecycle이 아니라 Workflow다.** Lifecycle은 분류(View)이고 Workflow는 탐색(Navigation)이다. 최근 Sidebar 작업에서 이 기준이 흔들려(Lifecycle이 1차 트리가 됨) 다시 고정한다.

---

## 1. Context — IA 드리프트

최근 Sidebar가 **Lifecycle Group 중심**으로 흘렀다. Detail Process가 Lifecycle 카테고리 아래 긴 리스트로 나열되어 탐색성이 떨어지고 원래 내비게이션 개념이 약화됐다. 이는 의도된 Navigator 아키텍처가 아니다. Navigator는 **Workflow-first**여야 한다.

### Canonical Navigation Model
```text
Overview → Workflow → Detail Process → Node        (정본)
NOT
Overview → Lifecycle Group → Detail Process        (드리프트)
```
Lifecycle Group은 **1차 내비게이션 계층이 아니다.**

---

## 2. Decision

> **Navigator는 Workflow-first navigation을 정본으로 한다.** Workflow가 1차 탐색 객체이고, Detail Process는 그 하위의 실행 객체다. Lifecycle은 **View 계층의 facet/filter/section**일 뿐 canonical tree가 되어서는 안 된다.

### 2.1 역할별 계층 정의 (Layered Architecture)
```text
Navigation Layer      Workflow → Detail Process         ← 탐색·AI검색·북마크·URL 정체성의 기준
View Layer            Lifecycle · ERP Module · Organization · Journey   ← 분류/필터/facet (다중 뷰)
Execution Layer       Node · Edge · Runtime             ← 실행 데이터 (ADR-005 L1~L4)
Governance Layer      Approval · Rules · Documents      ← ADR-007
Persistence Layer     Runtime · Revision · Save Guard   ← WP1 · Phase 2A.1/2A.2
```
> 이 분리로 Sidebar뿐 아니라 **AI 검색·Navigator URL·북마크·검색**이 전부 동일한 **Navigation Layer(Workflow→Detail Process)** 를 기준으로 동작한다. Lifecycle은 여러 View 중 하나로 강등된다.

### 2.2 객체별 원칙
| 객체 | 역할 |
|---|---|
| **Workflow** | 1차 내비게이션 객체 · 비즈니스 역량 · AI 탐색 타깃 · 북마크/URL 정체성 |
| **Detail Process** | 실행 프로세스 · 선택 객체 · **하나의 Workflow에 소속** · (향후) 여러 Lifecycle에 다중 소속 가능 |
| **Lifecycle Group** | 표현용 grouping · 분류 · filter/facet · 시각 조직화 **전용** · **절대 canonical tree가 되지 않음** |

---

## 3. Architecture Review — 현재 구조 진단 (요청 5개 항목)

| # | 질문 | 결론 (코드 근거) |
|---|---|---|
| 1 | Sidebar 계층은 어디서 생성되나 | [`src/lib/sidebar/workflowSections.ts`](../../src/lib/sidebar/workflowSections.ts) `buildDetailWorkflowSections()` 가 계층을 만들고, [`src/components/layout/ProcessGroupMenu.tsx`](../../src/components/layout/ProcessGroupMenu.tsx) 가 렌더 |
| 2 | Workflow grouping이 아직 존재하나 | **존재한다.** `buildDetailWorkflowSections`가 `group.workflowId`로 묶고 `workflows[]`에서 이름/순서를 조회한다. 다만 **Lifecycle 하위에 중첩**되어 종속적이다 |
| 3 | Lifecycle이 1차 grouping이 되었나 | **그렇다.** `workflowSections.ts`는 `PROCESS_LIFECYCLE_GROUPS.map(...)`를 **외곽 루프**로 돌고, `ProcessGroupMenu.tsx:308`은 `<section key={lifecycleGroup.id}>`(Category Accordion)을 **최상위**로 렌더한다 → Lifecycle이 1차 트리 |
| 4 | workflowId grouping이 유실/우회되었나 | **유실 아님, 강등됨.** grouping 로직은 살아있으나 Lifecycle 하위 2차 계층으로 밀렸고, 단일 Variant는 `flattened`로 Workflow 헤더가 숨겨져 Workflow 가시성이 더 약화됨 |
| 5 | "인사/총무" 수정이 Sidebar 생성에 어떤 영향을 줬나 | **코드 수정은 머지된 적 없다**(직전 작업은 [분석 문서](../05_Review/Sidebar-IA-Analysis-Workflow-Variant.md)뿐). 해당 그룹은 `state.local.json`(dev-local)에만 있고 `workflowId`가 비어 `ungrouped`(Lifecycle 직속 플랫)로 표시된다 — **원인이 아니라 증상**. 커밋 시드(state.json)의 26개 detail group은 **전부 workflowId 보유**(누락 0) |

### 3.1 현재 계층 (As-Is)
```text
[Category Accordion = Lifecycle]        ← 1차 (드리프트)
   ├─ Workflow (toggle)                 ← 2차 (종속)
   │     └─ Variant (Detail Process)
   └─ ungrouped [Detail Process ...]    ← workflowId 없는 항목 = 긴 플랫 리스트 (예: 인사/총무)
```

### 3.2 제안 계층 (To-Be)
```text
[Workflow]                              ← 1차 (정본)
   └─ Detail Process (Variant)          ← 2차
   (Lifecycle = Workflow/Variant의 metadata·section 색·filter facet, 트리 아님)

예)
Purchasing Workflow
    Purchase Request → Goods Receipt → AP Invoice
    Purchase Request → AP Invoice (Service)
Sales Workflow
    Order → Shipment → Invoice (Domestic)
    Order → Shipment → Invoice (Export)
```

---

## 4. 수정 대상 파일 (Phase 1 기준)

| 파일 | 변경 성격 |
|---|---|
| `src/lib/sidebar/workflowSections.ts` | **핵심.** Workflow-first 빌더 신설(`buildWorkflowSections`): 1차 `workflowId` 묶음, Lifecycle은 metadata. 기존 lifecycle-first 빌더는 View facet용으로 보존 가능 |
| `src/components/layout/ProcessGroupMenu.tsx` | Workflow를 최상위 트리로 렌더, Lifecycle은 optional section/badge/filter로 강등 |
| `src/components/layout/process-group-menu.css` | 트리 위계 스타일 조정(무변경 최소화) |
| `src/lib/sidebar/workflowIcon.ts` | (선택) Workflow 아이콘 재사용 |

**변경 금지(제약 준수):** ProcessData, Workflow 정의(`workflows[]` 값), Detail Process ID, Governance 타입, Property Panel, Header, 기존 라우트/선택 타깃(`detailProcessId`).

> **선택 타깃 불변(중요):** 트리 구조만 바뀌고 **선택 객체는 여전히 Detail Process(`detailProcessId`)** 다. 내비게이션 정체성(현재 state 기반)은 그대로라 라우트/북마크 계약이 깨지지 않는다. (URL 기반 정체성은 향후 Phase 3.)

---

## 5. Migration Risk

| 리스크 | 수준 | 근거/완화 |
|---|---|---|
| 시드 데이터 orphan | **낮음** | seed의 26개 detail group **전부 workflowId 보유** → Workflow-first로 전부 매핑됨 |
| workflowId 없는 항목(dev-local·신규) | **중간** | 예: 인사/총무. **"미분류(Uncategorized) Workflow" fallback 버킷** 유지로 유실 방지. 근본 해소는 생성 시 workflowId 채움([Sidebar IA Analysis](../05_Review/Sidebar-IA-Analysis-Workflow-Variant.md) B안) |
| 정렬 기준 전환 | 낮음 | 1차 정렬이 `workflow.order`로 바뀜(기존 lifecycle 순서는 View facet에서 유지) |
| 단일 Variant flatten 정책 | 낮음 | Workflow-first에선 단일 Variant도 Workflow 이름을 노출(탐색 타깃) → `flattened` 정책 재검토 |
| 선택/런타임/Canvas | **없음** | 선택 타깃 `detailProcessId` 불변, Execution/Runtime 무변경 |

> **"미분류 Workflow"의 의미 한정(중요):** 이는 workflowId가 없는 항목이 화면에서 사라지지 않게 하는 **호환용 안전망(fallback)일 뿐, 신규 canonical 비즈니스 카테고리가 아니다.** 신규 생성/복제 시 workflowId가 빠져도 된다는 뜻으로 해석해서는 안 된다. 모든 Detail Process는 하나의 Workflow에 소속되어야 하며, **생성·복제 경로의 workflowId 보존/승계는 Phase 1과 함께 반드시 별도 검증**한다(근본 해소 = 생성 시 workflowId 채움).

---

## 6. Implementation Strategy (승인 후, 단계적)

- **Phase 1 — Workflow-first Sidebar 복원**: `buildWorkflowSections`(workflow 1차) + ProcessGroupMenu 렌더 전환. Lifecycle은 badge/section-color로 잔존. workflowId 없는 항목은 "미분류 Workflow" 버킷. 선택 타깃·라우트 불변. (리스크 낮음)
- **Phase 2 — Lifecycle as optional grouping/filter**: Lifecycle을 View 토글/필터/facet으로 전환(트리 아님). ERP Module·Organization 등 다른 facet의 자리 확보.
- **Phase 3 — Multi-view Navigation (향후)**: Workflow / Lifecycle / ERP Module / Journey 다중 뷰 + URL/bookmark 정체성 도입(현재 router 없음 → 신규). AI 검색이 Navigation Layer(Workflow→Detail Process) 기준으로 동작.

> 각 Phase는 별도 PR·검증(tsc/build/vitest/eslint)·머지 보류 절차를 따른다. **Phase 1은 본 ADR 승인 후 착수.**

---

## 7. Consequences
- (+) **탐색성 회복** — Workflow가 1차 타깃이 되어 긴 Lifecycle 리스트가 사라지고 발견성 향상.
- (+) **일관된 Navigation 기준** — Sidebar·AI검색·북마크·(향후)URL이 동일 Navigation Layer 사용.
- (+) **IA 재드리프트 방지** — Workflow-first를 ADR로 고정(ADR-005/007처럼 기준선 고정).
- (+) **저위험** — 시드 100% workflowId 매핑, 선택 타깃 불변.
- (−) **workflowId 결측 데이터 처리 필요** — fallback 버킷 + 생성 시 채움(별도 과제).
- (−) **렌더러 리팩터** — workflowSections/ProcessGroupMenu 구조 전환(Phase 1).
- **범위 한계**: 본 ADR은 결정·계획이다. 코드는 승인 후 Phase 1부터.

## 8. Constraints Honored (본 문서)
Runtime·ProcessData·Workflow 정의·Detail Process ID·Governance 타입·Property Panel·Header·기존 라우트 **전부 무변경**. 코드 변경 없음, PR/머지 없음(승인 대기).

## Related
- [ADR-001 Workflow/Variant](ADR-001-Workflow-Variant.md) (workflowId/variant 필드 출처)
- [ADR-002 Graph First](ADR-002-Graph-First.md) · [ADR-005 Runtime Model](ADR-005-Navigator-Runtime-Model.md)
- [Sidebar IA Analysis](../05_Review/Sidebar-IA-Analysis-Workflow-Variant.md) (근본 원인·B안)
- 코드: `src/lib/sidebar/workflowSections.ts`, `src/components/layout/ProcessGroupMenu.tsx`, `src/data/processLifecycleGroups.ts`
