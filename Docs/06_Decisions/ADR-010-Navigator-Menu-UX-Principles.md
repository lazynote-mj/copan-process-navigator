# ADR-010 — Navigator 메뉴 트리 UX 설계 원칙 (Workflow-중심 탐색 · 클릭 최소화)

> 이 ADR은 데이터 모델이 아니라 **메뉴 트리의 UI 표현·상호작용 원칙**을 정의한다. 핵심 명제: **"Navigator는 프로세스를 설명하는 트리가 아니라, 프로세스를 빠르게 찾아 실행하는 내비게이션이다."** 데이터 구조(Category → Workflow → Variant)는 유지하고, **UI만 Workflow 중심으로 단순화하여 클릭 수를 최소화**한다.

|Field|Value|
|---|---|
|Status|Proposed (§4 Single-Variant 정책은 비준 대기 — [§6 결정 필요](#6-결정-필요open-decision) 참조)|
|Date|2026-07-11|
|Owner|혁신팀|
|Builds on|[ADR-008 Navigation Architecture (Workflow-first)](ADR-008-Navigation-Architecture-Workflow-First.md), [ADR-001 Workflow/Variant](ADR-001-Workflow-Variant.md), [ADR-009 Builder Integrity](ADR-009-Workflow-Assignment-Integrity.md)|
|Scope|Sidebar detail 메뉴(`viewMode==='detail'`)의 렌더·전개·선택·성능 원칙. **ProcessData 스키마·Detail Process ID·선택 정체성(`detailProcessId`)·Workflow 정의값 무변경.** 표현 계층(`ProcessGroupMenu.tsx`, `src/lib/sidebar/*`)에만 적용.|

---

## 1. Context

정보 구조(IA)로서 `Category → Workflow → Variant` 3계층은 [ADR-008](ADR-008-Navigation-Architecture-Workflow-First.md)에서 확정됐고 적절하다. 그러나 실사용에서 **동일 프로세스에 도달하기까지 Expand/Collapse가 여러 번 반복**되어 탐색 비용이 높다는 문제가 관찰됐다.

이 ADR은 그 문제를 **데이터 모델 불변 · UI 표현만 개선**이라는 제약 아래 해소하기 위한 UX 원칙을 규범으로 고정한다. 목적은 "정보 구조의 정확성"이 아니라 **"최소 클릭으로 원하는 Workflow에 도달"**이다. 향후 프로세스가 추가되거나 다른 에이전트(Claude Code / Codex)가 이 트리를 수정할 때도 아래 원칙이 일관되게 유지되어야 한다.

## 2. Decision — 설계 원칙 (규범)

### P1. 데이터 모델과 UI 표현의 분리
`Category → Workflow → Variant` 데이터 계층은 유지한다. 아래 모든 원칙은 **렌더 판단**이며 ProcessData/스키마/샘플데이터를 바꾸지 않는다. 표시 라벨은 데이터가 아니라 UI 라벨이다([`navigationDisplay.ts`](../../src/lib/sidebar/navigationDisplay.ts)).

### P2. Workflow 중심
Workflow는 사용자가 가장 많이 선택하는 단위이므로 메뉴의 중심이다. **Workflow는 가능한 한 즉시 선택 가능**해야 한다. Category는 Workflow를 묶는 역할만 한다.

### P3. Variant는 복수일 때만 노출
Variant는 동일 Workflow에 **실행 시나리오가 둘 이상일 때만** 트리에 펼쳐 보인다.

### P4. Single-Variant Rule
Workflow 아래 Variant가 **하나뿐이면 Variant 행을 표시하지 않고**, Workflow 행 자체를 선택 가능한 Leaf로 렌더한다. 선택 즉시 그 유일한 Variant(Detail Process)를 연다. 사용자는 Variant의 존재를 인식할 필요가 없다. Variant는 데이터상 존재하되 UI에서는 숨긴다. (**현재 구현은 이 원칙을 부분적으로만 적용 — [§6 결정 필요](#6-결정-필요open-decision).**)

### P5. Progressive Disclosure
트리는 필요한 만큼만 펼친다.
- 기본 상태는 **모두 접힘**(최소 노출).
- **현재 선택된 경로(Category → Workflow → Variant)만 자동 Expand**한다.
- 사용자가 **직접 펼친 상태는 유지**한다(자동 로직이 지우지 않는다).
- 다른 Category를 선택해도 기존 Expand 상태를 **초기화하지 않는다**.

### P6. Expand는 실제 선택지가 있을 때만
Expand(caret) 버튼은 **하위 선택지가 둘 이상 있는 노드에만** 존재한다. 단일 Variant Workflow(=Leaf)에는 caret을 표시하지 않는다.

### P7. 선택 상태 표시
현재 선택된 **Workflow**를 명확히 Highlight하고, 현재 선택된 **Variant**도 구분한다. 선택 경로는 항상 자동으로 열린 상태를 유지한다.

### P8. Depth 최대 3
`Category → Workflow → Variant` 3단계를 초과하는 구조는 허용하지 않는다.

### P9. 검색과의 관계 (향후)
Search가 추가되어도 트리 구조·IA는 유지한다. 검색 결과는 **해당 Workflow가 있는 위치만 자동 Expand**하여 보여준다. 검색 때문에 IA를 바꾸지 않는다.

### P10. 성능 — 부분 렌더
Expand/Collapse가 **전체 Tree를 다시 렌더링하지 않는다**. 파생 트리(`buildCapabilitySections`) 계산과 렌더는 변경된 Branch로 국한한다.

### 불변 원칙 (프로세스가 추가돼도 유지)
- Category = 업무 분류 · Workflow = 대표 프로세스 · Variant = 실행 시나리오
- Variant가 하나면 UI에서 숨김 · Expand는 실제 선택지가 있을 때만
- 사용자가 가장 적은 클릭으로 Workflow에 접근하도록 설계
- 데이터 모델과 UI 표현은 분리하여 관리

## 3. 구현 매핑

| 원칙 | 구현 위치 |
|---|---|
| P1 데이터/표현 분리 | [`navigationDisplay.ts`](../../src/lib/sidebar/navigationDisplay.ts) (표시 라벨), [`workflowSections.ts`](../../src/lib/sidebar/workflowSections.ts) (파생 트리) |
| P2 Workflow 중심 | `renderWorkflowSection` — Workflow가 1차 섹션, 단일 Variant는 Leaf |
| P3/P4 Variant/Single-Variant | `isMeaninglessSoleVariant` → Leaf 렌더 ([`ProcessGroupMenu.tsx:267`](../../src/components/layout/ProcessGroupMenu.tsx)) |
| P5 Progressive Disclosure | `expandedCapabilityKeys`/`expandedWorkflowKeys`(기본 빈 집합) + 선택 경로 자동 add ([`ProcessGroupMenu.tsx:90-121`](../../src/components/layout/ProcessGroupMenu.tsx)) |
| P6 조건부 Expand | Leaf는 `renderGroupItem`(caret 없음), 다중 Variant는 `Caret` 렌더 |
| P7 선택 표시 | `process-group-menu__item--active` |
| P8 Depth 3 | `buildCapabilitySections` → capability/workflow/variant 3계층 |
| P10 성능 | (미충족 — §5 참조) |

## 4. Conformance Audit (2026-07-11, main `250746b` 기준)

PR #35(ADR-009) + PR #36(Navigation Display Layer) 머지 직후 코드·실행 화면 대조.

**충족(Conforms):**
- **P1 / P8** — 3계층 유지, 데이터 불변. 표시 라벨은 UI 전용. ✓
- **P5** — 기본 전접힘, 선택 경로만 자동 Expand, 수동 전개 유지, Category 전환 시 미초기화. 코드·실측 모두 확인. ✓
- **P7(Variant)** — 선택 Variant는 `--active`로 Highlight. ✓
- **P6(Leaf)** — placeholder 단일 Variant는 caret 없는 Leaf로 렌더(`기타입고`·`기타출고`). ✓

**부분 충족/미충족(Gaps):**

| # | 원칙 | 현상 | 근거 |
|---|---|---|---|
| G1 | **P4** | Single-Variant Rule이 **placeholder 라벨('단일'·빈값·Workflow명 동일)에만** 적용됨. 의미 있는 단일 Variant(`서비스판매→서비스`, `상품사업→제/상품`)는 별도 전개 계층으로 남아 **클릭 1회가 더 필요**. 스펙의 "Variant가 하나면 UI에서 숨김"과 상충. | [`workflowSections.ts:129`](../../src/lib/sidebar/workflowSections.ts) `isMeaninglessSoleVariant` |
| G2 | **P6** | G1의 결과로, 단일 Variant를 가진 "의미 있는" Workflow에도 caret이 표시됨(선택지는 하나뿐). | `renderWorkflowSection` 다중 분기 |
| G3 | **P7(Workflow)** | 하위 Variant 선택 시 **Workflow 헤더는 Highlight되지 않음**(Leaf만 `--active`). 선택된 Workflow 식별성 부족. | `renderWorkflowSection`/`renderGroupItem` |
| G4 | **P10** | `buildCapabilitySections`가 매 렌더 재계산되고 Expand/Collapse가 **전체 nav를 재렌더**. `useMemo`/branch 국한 없음. 현재 데이터 규모에선 영향 미미하나 원칙 미준수. | [`ProcessGroupMenu.tsx:96`](../../src/components/layout/ProcessGroupMenu.tsx) |

## 5. Consequences

- (+) **일관된 규범** — 이후 프로세스 추가·다른 에이전트의 트리 수정 시 P1–P10을 기준으로 판단·리뷰할 수 있다.
- (+) **데이터 안전** — 모든 원칙이 표현 계층 한정이라 스키마/선택 정체성/Governance/Runtime에 무영향.
- (−) **G1 미해결 시** — 의미 있는 단일 Variant Workflow는 여전히 클릭 1회가 더 든다("클릭 최소화" 목표와 부분 상충). §6에서 정책 확정 필요.
- (−) **G4** — 성능 원칙은 현재 규모에선 실질 문제 없으나, 데이터가 커지면 `useMemo`/`React.memo` 도입이 필요하다(후속 과제).

## 6. 결정 필요(Open Decision)

**Single-Variant Rule(P4)의 적용 범위** — 스펙과 현행 구현이 상충한다. 하나를 비준해야 한다.

- **Option A (스펙 문자 그대로 · 권장):** Variant가 **하나면 라벨 의미와 무관하게 항상** Workflow를 Leaf로 평탄화한다. `isMeaninglessSoleVariant` → `isSoleVariant`(`groups.length === 1`)로 단순화. G1·G2 동시 해소, 클릭 최소화 극대화.
  - 대가: 단일 Variant의 고유 라벨(예: 미래에 `일반구매`가 단일 `긴급` Variant만 가질 때)이 UI에서 사라진다. 스펙은 이를 수용한다("사용자는 Variant의 존재를 인식할 필요가 없다").
- **Option B (현행 유지):** placeholder 단일 Variant만 평탄화하고, **의미 있는** 단일 Variant는 라벨 보존을 위해 전개 계층으로 남긴다. G1·G2를 "의도된 예외"로 인정하고 P4 문구를 그에 맞게 완화한다.

이 ADR의 Status는 이 결정 전까지 **Proposed**다. 결정 후 Accepted로 승격하고, 선택된 Option에 맞춰 G3(Workflow Highlight)·G4(성능)는 별도 후속 구현 과제로 처리한다. **본 ADR은 문서·감사만 포함하며 코드는 변경하지 않는다.**

## Related
- [ADR-008 Navigation Architecture (Workflow-first)](ADR-008-Navigation-Architecture-Workflow-First.md) (IA 3계층·Workflow-first 출처)
- [ADR-009 Builder Integrity](ADR-009-Workflow-Assignment-Integrity.md) (Workflow 필수 소속 — 이 트리에 매핑되는 데이터 규칙)
- [ADR-001 Workflow/Variant](ADR-001-Workflow-Variant.md) (Variant 모델 출처)
- 코드: `src/components/layout/ProcessGroupMenu.tsx`, `src/lib/sidebar/workflowSections.ts`, `src/lib/sidebar/navigationDisplay.ts`
