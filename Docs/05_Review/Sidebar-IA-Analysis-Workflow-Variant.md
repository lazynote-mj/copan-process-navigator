# Sidebar IA 분석 — Workflow / Variant 그룹핑 (분석 전용, 코드 미수정)

> **🗄️ HISTORICAL — 분석 근거(정본 아님).** Workflow-first 결정의 **정본은 [ADR-008](../06_Decisions/ADR-008-Navigation-Architecture-Workflow-First.md)** 이며 Navigation Phase 1(`a9973c2`)로 구현 완료됐다. 이 문서는 **"왜 Workflow-first였나"의 분석 입력 기록**으로 보존한다 — ADR은 결론만, 이 문서는 그 근거. ADR-008과 경쟁하는 canonical source가 아니다.

|Field|Value|
|---|---|
|Role|Chief Architect · Analysis only|
|Status|Analysis (코드 미수정)|
|Date|2026-07-10|
|Owner|혁신팀|
|Related|[ADR-001 Workflow/Variant](../06_Decisions/ADR-001-Workflow-Variant.md), [ADR-005 Runtime Model](../06_Decisions/ADR-005-Navigator-Runtime-Model.md), [ADR-007 Governance](../06_Decisions/ADR-007-Data-first-Approval-and-Runtime-Governance-Layer.md)|
|Scope|분석·설계 문서만 — 소스/데이터/런타임 무변경, PR 없음|

> 요청: 좌측 프로세스 메뉴의 IA(공통 Workflow + Variant 분리)를 재설계한다. **코드는 수정하지 않고 먼저 분석만** 한다. 특히 신규 "구매요청 ~ 매입전표 생성 : 인사/총무"가 기존 "서비스 / F&B / IT·S/W"와 **같은 Workflow 하위로 묶이지 않는 원인**을 규명한다.

---

## 0. 핵심 원인 규명 (Root Cause) — "인사/총무"가 그룹핑 안 되는 이유

### 0.1 결론 한 줄
**Sidebar는 `DetailProcessGroup.workflowId`가 존재하고 그 값이 최상위 `workflows[]`에 정의돼 있을 때에만 Variant를 Workflow 하위로 묶는다. 신규 "인사/총무" 그룹은 `workflowId`가 비어 있어(`null`) Workflow에 묶이지 못하고 카테고리 직속(ungrouped)으로 평탄하게 나열된다.**

### 0.2 그룹핑을 결정하는 코드 (Workflow ↔ Variant 구분 기준)
[`src/lib/sidebar/workflowSections.ts:62-71`](../../src/lib/sidebar/workflowSections.ts) `buildDetailWorkflowSections()`:

```ts
for (const group of inCategory) {
  const wfId = group.workflowId
  if (wfId && workflowById.has(wfId)) {      // ← 이 조건이 Workflow vs Variant를 가른다
    byWorkflow.get(wfId).push(group)          //   → Workflow 하위 Variant
  } else {
    ungrouped.push(group)                     //   → 카테고리 직속(플랫)
  }
}
```

- **판별 필드 = `DetailProcessGroup.workflowId`** (+ `workflows[]`에 동일 id 정의 존재).
- `workflowId`가 없거나 `workflows[]`에 없으면 → `ungrouped`.
- 추가 규칙: 단일 Variant Workflow는 `flattened`(헤더 없이 평탄), Variant 정렬은 `variantOrder`.
- 3계층은 **Category(`lifecycleGroupId`) → Workflow(`workflowId`) → Variant(그룹 자신, `variantLabel`/`variantOrder`)**.

### 0.3 4개 그룹 JSON 비교 (실데이터)

> 주의: 서비스/F&B/IT·S/W는 커밋된 `public/process-data/state.json`에 있고, **"인사/총무"는 `public/process-data/state.local.json`(dev-local, Phase 2A.1 이후 앱 저장 대상)에만** 존재한다. 이것이 원본 시드와 신규 항목이 다른 위치에 있는 1차 관찰이다.

| 필드 | 서비스 | F&B | IT·S/W | **인사/총무 (신규)** |
|---|---|---|---|---|
| `id` | `pg-service-purchase-to-ap` | `구매-요청-매입-전표-생성-f-b-group` | `구매-요청-매입-전표-생성-it-s-w-group` | `구매-요청-매입전표-생성-인사총무-group` |
| `name` | `… : 서비스` | `… : 연구개발비/F&B/…` | `… : IT, S/W` | `… : 인사/총무` |
| **`workflowId`** | **`wf-purchase-request-to-ap`** | **`wf-purchase-request-to-ap`** | **`wf-purchase-request-to-ap`** | **`null` (누락)** ⬅ 원인 |
| `variantLabel` | `서비스` | `F&B` | `IT·S/W` | **`null` (누락)** |
| `variantOrder` | `1` | `2` | `3` | **`null` (누락)** |
| `lifecycleGroupId` | (기본맵) | `purchase-inbound` | `purchase-inbound` | `purchase-inbound` |
| `detailProcessId` | `service-purchase-to-ap` | `구매-요청-매입-전표-생성-f-b` | `구매-요청-매입-전표-생성-it-s-w` | `구매-요청-매입전표-생성-인사총무` |

> `lifecycleGroupId`는 셋 다 `purchase-inbound`(카테고리 "구매/입고")로 **동일** → 신규 항목도 같은 카테고리에는 들어간다. 그러나 `workflowId`만 비어 있어 그 카테고리 안에서 **Workflow 하위가 아니라 직속 항목**으로 뜬다.

> 사용자가 비교 요청한 `parentId / category / order / displayName / path / hierarchy` 필드는 **모델에 존재하지 않는다**(§1.3). 계층은 저장되지 않고 `lifecycleGroupId + workflowId + variantOrder`로 **런타임에 파생**된다.

### 0.4 왜 workflowId가 비었나 — 생성 경로의 기본값 누락
신규/복제 생성 시 그룹에 `workflowId`를 **설정하지 않는다**:

- [`src/lib/editor/selectedElement.ts:169`](../../src/lib/editor/selectedElement.ts) `buildNewDetailProcessGroupSelection()` — 신규 그룹은 `{ id, name, description, detailProcessId }` 만 만든다. `workflowId/variantLabel/variantOrder` **없음**.
- [`src/data/processDataMutations.ts:554`](../../src/data/processDataMutations.ts) `cloneDetailProcess()`의 `clonedGroup` — `lifecycleGroupId`(카테고리)는 명시 승계하지만 **`workflowId`는 승계하지 않는다**(주석도 "분류 승계"만 언급).
- **편집 UI 부재**: `src/components/editor/`·PropertyPanel 어디에도 `workflowId/variantLabel/variantOrder`를 입력·수정하는 폼이 없다(grep 결과 0건). 즉 사용자는 앱에서 Workflow 소속을 지정할 수단이 없다.

**정리**: `workflowId/variantLabel/variantOrder`는 현재 **JSON/스크립트에서만 수기로 author**되는 메타데이터다. 앱의 생성·복제·편집 플로우는 이를 만들지도 노출하지도 않으므로, **앱에서 만든 모든 신규 프로세스는 자동으로 ungrouped(플랫)** 가 된다. "인사/총무"는 그 첫 사례일 뿐이다.

---

## 1. 현재 구조 분석

### 1.1 항목별 요약

| 항목 | 현재 구현 | 변경 영향도 |
|---|---|---|
| ① Sidebar 메뉴 생성 | `ProcessGroupMenu.tsx`가 `buildDetailWorkflowSections(groups, workflows)`로 Category→Workflow→Variant 렌더. Category 아코디언 + Workflow 토글 | 중 — 렌더 로직은 이미 3계층 지원. 데이터만 채우면 재사용 가능 |
| ② Process Group 데이터 | `DetailProcessGroup { id, name, description, detailProcessId, lifecycleGroupId?, linkedOverviewGroupId?, workflowId?, variantLabel?, variantId?, variantOrder? }` (`src/types/toBeNavigator.ts:18`) | 낮음 — Workflow/Variant 필드가 **이미 optional로 존재**(ADR-001) |
| ③ Process Definition 모델 | `ProcessInstance`(nodes/edges/lanes 등 실행 데이터) — 그룹 메타와 **분리**. `processes[]`에 저장 | 낮음 — 실행 데이터는 건드릴 필요 없음 |
| ④ Process ID 체계 | `slugifyProcessId(name)` = 소문자+`[a-z0-9가-힣]` 슬러그(한글 허용). 그룹 id = `<slug>-group`, 중복 시 `-2` 접미사 (`processDataMutations.ts:116`) | 낮음 — id는 name 파생, 안정적. 유지 |
| ⑤ Process Tree 생성 | `PROCESS_LIFECYCLE_GROUPS`(7 카테고리) 순회 → 카테고리별 `workflowId` 묶음 + ungrouped. 단일 Variant는 flattened | 중 — 트리 규칙 명확. Workflow 없는 항목 처리(ungrouped)가 현 이슈의 표면 |
| ⑥ 메뉴 정렬 | Workflow: `workflow.order → workflowName`. Variant: `variantOrder → name.localeCompare`. Category: `PROCESS_LIFECYCLE_GROUPS` 배열 순서 | 낮음 — 정렬 키 존재. 카테고리 순서는 상수 배열(§기준정보 이동 대상) |
| ⑦ JSON 저장 구조 | `state.json`(schemaVersion 2) 최상위: `commonMasters, processes[], detailProcessGroups[], overviewProcessGroups[], workflows[]`. Workflow는 별도 최상위 배열 | 낮음 — additive. `workflows[]`·그룹 필드 확장으로 흡수 |
| ⑧ 선택 상태 | `AppLayout`의 `selectedGroupId`(useState) + `detailProcessId` + `selectedElement`. 그룹 선택 시 `setSelectedGroupId` (`AppLayout.tsx:210`) | 낮음 — id 기반, 계층 변경과 무관 |

### 1.2 Component Tree (sidebar)
```text
AppLayout
  └─ Drawer(left)
       └─ ProcessGroupMenu               // src/components/layout/ProcessGroupMenu.tsx
            ├─ buildDetailWorkflowSections(groups, workflows)   // src/lib/sidebar/workflowSections.ts
            │     → Category[] → { workflows: WorkflowVariantNode[], ungrouped[] }
            ├─ Category 아코디언 (PROCESS_LIFECYCLE_GROUPS 순서)
            │     ├─ Workflow 토글 헤더 (flattened가 아니면)
            │     │     └─ Variant 항목 (variantLabel ?? name)
            │     └─ ungrouped 항목 (직속 · 플랫)   ← 현재 신규 프로세스가 떨어지는 곳
            └─ (Builder) + 그룹 추가
```

### 1.3 계층은 "저장"이 아니라 "파생"이다 (중요)
`DetailProcessGroup`에는 `parentId / path / hierarchy / category / order / displayName` 필드가 **없다**. 트리는 다음 세 값으로 **런타임 계산**된다:
- Category ← `resolveLifecycleGroupForDetailGroup(group)` (그룹의 `lifecycleGroupId` 또는 `detailProcessId` 기본 분류맵)
- Workflow ← `group.workflowId` → 최상위 `workflows[]` 조회
- Variant ← 그룹 자신 + `variantLabel`/`variantOrder`

→ 계층 정합성은 **이 3개 필드의 값 일치**에 달려 있고, 하나(workflowId)만 비어도 계층이 깨진다(현 이슈).

---

## 2. 변경 설계 (목표 IA)

### 2.1 목표 트리
```text
구매/입고 (카테고리)
  ▶ 구매요청 → 입고 → 매입전표         (Workflow, wf-purchase-to-ap)
        01 제품 …
  ▶ 구매요청 → 매입전표               (Workflow, wf-purchase-request-to-ap)   4 Types
        01 서비스
        02 F&B
        03 IT·S/W
        04 인사/총무   ← 신규가 여기에 붙어야 함
```
= 이미 렌더러가 지원하는 구조. **부족한 것은 데이터(workflowId/variantLabel/variantOrder) 채움 + 편집 수단**뿐이다.

### 2.2 Component 구조
- 렌더러(`ProcessGroupMenu` + `workflowSections`)는 **재사용**. 변경 최소.
- 추가: 그룹 편집 폼(PropertyPanel)에 **Workflow 선택 + Variant 라벨/순서** 입력 필드.
- 추가: 신규 생성 시 **Workflow 자동 추론/선택** 단계(§4 Phase 1).

### 2.3 Data Model 변경 여부 — 최소
- `DetailProcessGroup`의 `workflowId/variantLabel/variantOrder`는 **이미 존재**(ADR-001) → **스키마 변경 없이** 값만 채우면 된다.
- 최상위 `workflows[]`(`Workflow` 타입)도 이미 존재하며 확장 슬롯 보유(§5.3).
- 신규 필드 도입은 **불필요**. 기존 JSON과 100% 호환.

### 2.4 JSON 영향도
- 신규/변경 그룹에 `workflowId`(+`variantLabel`/`variantOrder`)가 채워질 뿐 — **additive**, 스키마 버전 불변, 기존 항목 무영향.
- `workflows[]`에 새 Workflow가 필요하면 한 줄 추가(예: 인사/총무는 `wf-purchase-request-to-ap`에 편입되므로 **신규 Workflow조차 불필요**, 그룹의 workflowId만 채우면 됨).

---

## 3. 영향도 분석

| 영역 | 영향 | 비고 |
|---|---|---|
| 저장(save) | 낮음 | additive 필드. persist 경로(Phase 2A.1 state.local.json) 그대로 |
| 불러오기(load) | 낮음 | optional 필드, 없으면 ungrouped(현행). 하위호환 |
| 검색(search) | (+) | Workflow/Variant 분리 시 "인사/총무 매입" 등 정확 매칭 기반 마련 (§5.3 AI 검색) |
| Canvas | 없음 | 실행 데이터(nodes/edges/lanes)·Node ID 무변경 |
| Property Panel | 중 | Workflow/Variant 입력 필드 **추가**(신규 UI) |
| Runtime | 낮음 | 그룹 메타는 projection 대상. ADR-005 Single Writer 경계 유지 |
| Import/Export | 낮음 | 필드 additive. 기존 payload 검증 로직 영향 없음 |

---

## 4. 구현 순서

- **Phase 1 — Workflow 소속 채움(자동화)**: 신규/복제 생성 시 `workflowId` 자동 추론(이름 접두 흐름 또는 명시 선택) + `clonedGroup`이 원본 `workflowId` 승계. 이 단계만으로 "인사/총무" 이슈 해소.
- **Phase 2 — Variant 편집 UI**: PropertyPanel에 Workflow 선택 + `variantLabel`/`variantOrder` 입력. 사용자가 직접 소속·순서 관리.
- **Phase 3 — 기준정보 이동**: `PROCESS_LIFECYCLE_GROUPS` 순서를 `사업시작 → 구매 → 판매 → 정산 → 재무 → 기준정보`로. 기준정보(master-data)를 **최하단**으로. (배열 상수 순서 변경, 단일 지점)
- **Phase 4 — 정렬 개선**: Workflow/Variant 정렬 키 정리(order 정규화), 단일 Variant flatten 정책 재검토.

---

## 5. 권장안 (A / B / C)

| 안 | 내용 | 장점 | 한계 |
|---|---|---|---|
| **A. UI만** | sidebar가 `name`의 `… : variant` 접두를 **파싱**해 Workflow 묶음 유도(데이터 불변) | 데이터 무변경, 빠름 | 헤더 파싱과 같은 취약성(이름 규칙 의존). workflowId 있는 기존 데이터와 이중 기준 → 유지보수 악화 |
| **B. Data Model 일부** | **이미 존재하는** `workflowId/variantLabel/variantOrder`를 생성 시 채우고 편집 UI 노출 + 복제 승계 | 스키마 무변경, 렌더러 재사용, 이슈 근본 해소, 호환 | 편집 UI·추론 로직 신규 필요(중간 규모) |
| **C. Architecture** | Workflow를 **1급 Runtime 엔티티**로 승격(ADR-005 `workflows[]`/relations) + 메타모델(§5.3) 도입 | 장기 유지보수·AI 검색 최적, ADR-005/006/007 정합 | 범위 큼(Runtime/Change Set 경계 필요, Phase 5 WBS 연동) |

### 5.1 권장: **B를 즉시 적용하고 C로 수렴**
- 근거: 그룹핑에 필요한 **필드가 이미 스키마에 있다**(ADR-001) → B는 저위험·고효과. 렌더러도 이미 3계층을 지원하므로 "데이터 채움 + 편집 수단"만 추가하면 된다.
- C는 별도 트랙: Workflow를 `workflows[]` 1급 엔티티로 다루는 것은 ADR-005(Runtime)·ADR-006(Change Set)·Phase 5 WBS와 정렬해 단계적으로.

### 5.2 "인사/총무" 즉효 처방(분석 결론)
`state.local.json`의 해당 그룹에 `workflowId: "wf-purchase-request-to-ap"` + `variantLabel: "인사/총무"` + `variantOrder: 4`를 채우면 즉시 기존 Workflow 하위로 정렬된다. **근본 해소는 Phase 1(생성 시 자동 채움 + 복제 승계)**.

### 5.3 메타모델 정합 (장기 전략) — 이미 절반은 있다
`Workflow` 타입(`src/types/workflow.ts`)에는 **이미** 다음 확장 슬롯이 optional로 존재한다: `searchKeywords`, `aiKeywords`, `tags`, `relatedErpModules`, `requiredMasterData`, `requiredRoles`, `trigger`, `entryCondition`, `exitCondition`, `relatedWorkflowIds`. 요청한 메타모델(Trigger/End Condition/Related ERP/Required Master Data/AI Search Keywords)과 **거의 일치**한다.
- 즉 메타모델 도입은 "신규 설계"가 아니라 **기존 슬롯 채움 + 1급화**의 문제다. 이는 ADR-007(Data-first·AI Proposer)·AI 검색("응원봉 구매", "B2B 해외 판매")과 직접 연결된다.

---

## 6. 구현 원칙 준수 확인
- 기존 Runtime/Canvas/Node ID/Process ID **유지** — 본 변경은 그룹 메타(파생 계층)만 다룸.
- Import/Export·저장 포맷 **최대한 유지** — additive optional 필드.
- **UI Layer 우선 검토** 결과: 렌더러는 이미 준비됨. 남은 것은 데이터 채움 + 편집 UI(B안).

## Related
- [ADR-001 Workflow/Variant](../06_Decisions/ADR-001-Workflow-Variant.md) (이 필드들의 출처)
- [ADR-005 Runtime](../06_Decisions/ADR-005-Navigator-Runtime-Model.md) · [ADR-007 Governance](../06_Decisions/ADR-007-Data-first-Approval-and-Runtime-Governance-Layer.md)
- 코드: `src/lib/sidebar/workflowSections.ts`, `src/components/layout/ProcessGroupMenu.tsx`, `src/types/toBeNavigator.ts`, `src/lib/editor/selectedElement.ts`, `src/data/processDataMutations.ts`
