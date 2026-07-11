# ADR-009 — Builder Integrity — Workflow Assignment (신규 Detail Process의 Workflow 필수 소속)

> 이 ADR은 Workflow 모델이 아니라 **Builder의 데이터 생성 규칙(Builder Integrity)** 을 정의한다. 핵심 전환: **"Validation → 잘못된 데이터 발견"에서 "Builder → 잘못된 데이터 생성 방지"로.**

|Field|Value|
|---|---|
|Status|Accepted|
|Date|2026-07-10|
|Owner|혁신팀|
|Builds on|[ADR-008 Navigation Architecture (Workflow-first)](ADR-008-Navigation-Architecture-Workflow-First.md), [ADR-001 Workflow/Variant](ADR-001-Workflow-Variant.md)|
|Scope|생성·복제 경로의 workflowId 보존/승계. ProcessData 스키마·Detail Process ID·선택 정체성(`detailProcessId`) 무변경. Property Panel/생성 플로우에 Workflow picker 추가(ADR-008 §6가 예고한 Phase 1 동반 과제).|

> ADR-008이 §5·§6에서 명시적으로 남겨둔 후속 과제 — **"생성·복제 경로의 workflowId 보존/승계는 Phase 1과 함께 반드시 별도 검증"** — 를 구현 결정으로 확정한다. Phase 1(PR #33, `a9973c2`)이 Workflow-first Sidebar를 복원했지만, **빈(blank) Detail Process 생성 경로에는 Workflow 컨텍스트가 없어** 새 그룹이 렌더 전용 안전망인 "미분류 Workflow"로 떨어지는 문제가 남았다.

---

## 1. Context

ADR-008은 모든 Detail Process가 **하나의 Workflow에 소속**되어야 한다고 규정한다(§2.2). "미분류 Workflow"(`__unclassified-workflow__`) fallback은 workflowId가 없는 항목이 화면에서 사라지지 않게 하는 **호환용 안전망일 뿐, canonical 카테고리가 아니다**(§5, ADR-008 line 113).

그러나 Phase 1 이후 남은 구멍:

- 복제(clone)는 이미 원본의 `workflowId`를 승계한다([`processDataMutations.ts`](../../src/data/processDataMutations.ts) `cloneDetailProcess`) — Phase 1에서 처리됨.
- **빈 그룹 생성**(`buildNewDetailProcessGroupSelection` → `handleAddDetailProcessGroup`)은 `workflowId`를 채우지 않았고, Property Panel의 그룹 편집기에도 Workflow 필드가 없었다. 결과적으로 정상 생성 경로가 매번 fallback으로 떨어졌다 — fallback의 의미(예외 데이터 감지)가 훼손됨.

## 2. Decision

> **신규 Detail Process 그룹 생성은 반드시 Workflow에 소속되어야 한다.** "미분류 Workflow" fallback은 예외 데이터 감지기이며 정상 생성의 착지점이 아니다.

구현 원칙:

1. **컨텍스트 자동 승계** — 현재 열린 Detail Process가 속한 Workflow가 **있으면** 새 그룹의 `workflowId`를 그 값으로 미리 채운다(`resolveCreationWorkflowId` → `handleAddDetailProcessGroup`).
2. **컨텍스트 없으면 자동 선택 금지** — 생성 컨텍스트가 없거나(매칭 그룹 없음) 그 컨텍스트가 미분류(workflowId 결측)이면 `resolveCreationWorkflowId`는 `undefined`를 반환한다. **이때는 절대 임의로 자동 선택하지 않고** picker를 빈 상태로 두어 사용자가 명시 선택하게 한다. (Overview "+ 그룹"은 `OverviewProcessGroup`를 만드는 별개 경로라 이 규칙과 무관하다.)
3. **명시 선택 강제** — Property Panel의 그룹 편집기에 **소속 Workflow picker**를 추가하고, **신규 생성 커밋 시 workflowId를 필수**로 검증한다(`commitDetailProcessGroup`). 정의된 Workflow가 하나도 없는 데이터에서는 예외적으로 허용한다(강제할 대상이 없으므로).
4. **fallback 역할 고정** — "미분류 Workflow"는 렌더 전용 안전망으로 유지하되(로직 무변경), 정상 운영에서는 비어 있는 것이 정상 상태다.
5. **복제 승계 유지** — 기존 복제 승계 로직은 그대로 둔다.

### 2.1 생성 경로 분리 (Overview는 이 규칙과 무관)

Detail Process 그룹 생성 경로는 **오직 하나** — detail 사이드바(`viewMode==='detail'`)의 `handleAddDetailProcessGroup`뿐이다. Overview 사이드바의 "+ 그룹"은 `handleAddOverviewProcessGroup` → `OverviewProcessGroup`(별개 엔티티)을 만드는 경로이며 `workflowId`와 무관하다. 따라서 **"Overview에서 Workflow 없이 Detail 그룹을 생성"하는 시나리오는 구조적으로 존재하지 않는다.** 본 ADR의 Workflow 필수 규칙은 Detail 생성 경로에만 적용되고, 그 경로는 항상 명시적 컨텍스트(현재 열린 Detail Process) 위에서 동작한다.

**변경 금지(제약 준수):** ProcessData 스키마, Detail Process ID, 선택 정체성(`detailProcessId`), Workflow 정의 값, Governance 타입, Header. `workflowId` 필드는 ADR-001에서 이미 존재하는 additive optional 필드로, 스키마 변경이 아니다.

## 3. 구현 대상

| 파일 | 변경 |
|---|---|
| [`src/lib/editor/selectedElement.ts`](../../src/lib/editor/selectedElement.ts) | `buildNewDetailProcessGroupSelection`에 optional `workflowId` 인자 추가 — 있으면 신규 그룹 데이터에 채움. 승계 결정 규칙을 `resolveCreationWorkflowId`로 분리(테스트 가능) — 컨텍스트 없으면 `undefined` |
| [`src/components/layout/AppLayout.tsx`](../../src/components/layout/AppLayout.tsx) | `handleAddDetailProcessGroup`이 `resolveCreationWorkflowId`로 현재 열린 Detail Process의 Workflow를 기본값 승계. `processData.workflows`를 Property Panel에 전달 |
| [`src/components/editor/PropertyPanel.tsx`](../../src/components/editor/PropertyPanel.tsx) | 그룹 편집기에 **소속 Workflow** select 추가(Lifecycle Group보다 상위 배치). 신규 커밋 시 workflowId 필수 검증 |
| [`src/lib/sidebar/workflowSections.ts`](../../src/lib/sidebar/workflowSections.ts) | 무변경 — fallback은 예외 감지용으로 그대로 유지 |

## 4. Consequences

- (+) **fallback 정합성 회복** — "미분류 Workflow"가 예외 데이터 감지기로 되돌아가며, 정상 운영에서 비게 된다.
- (+) **Navigation 일관성** — 모든 신규 Detail Process가 Workflow-first 트리에 즉시 매핑된다(ADR-008 §2.2 준수).
- (+) **저위험·additive** — 스키마·선택 타깃·라우트 불변. 기존 데이터/복제 경로 영향 없음.
- (−) **레거시 그룹은 강제 대상 아님** — 이미 존재하는 workflowId 결측 그룹은 편집 저장 시 강제하지 않는다(편집 플로우 비파괴 유지). picker로 언제든 지정 가능하며, 남은 결측은 fallback이 계속 노출해 감지 가능하다.
- (−) **Workflow 미정의 데이터** — 정의된 Workflow가 0개면 강제하지 않는다(강제할 대상 부재). 이 경우에만 신규 항목이 fallback에 남는다.

## Related
- [ADR-008 Navigation Architecture (Workflow-first)](ADR-008-Navigation-Architecture-Workflow-First.md) (§5·§6 후속 과제 출처)
- [ADR-001 Workflow/Variant](ADR-001-Workflow-Variant.md) (`workflowId` 필드 출처)
- 코드: `src/lib/editor/selectedElement.ts`, `src/components/layout/AppLayout.tsx`, `src/components/editor/PropertyPanel.tsx`, `src/lib/sidebar/workflowSections.ts`
