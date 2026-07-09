# ADR-006 — Change Set Architecture

|Field|Value|
|---|---|
|Status|Accepted|
|Date|2026-07-09|
|Owner|혁신팀|
|Inherits|[ADR-005 Navigator Runtime Model](ADR-005-Navigator-Runtime-Model.md) §D9 (Change Set 선행 계약)|
|Related|[ADR-002 Graph First](ADR-002-Graph-First.md), [ADR-003 Ratification](ADR-003-Navigator-IA-Ratification.md), [ADR-004 Process Graph Schema First](ADR-004-Process-Graph-Schema-First.md), [Navigator IA](../05_Review/Codex/Navigator-Phase3-Concept.md)|

> ADR-005가 Runtime을 1급으로, `state.json`을 persistence로 확정했다. ADR-006은 그 Runtime을 **어떻게 변경할 것인가**를 정의한다. **Architecture Decision 수준**을 유지하며, command 타입 예시는 넣되 구현 함수·파일 패치는 다루지 않는다(그것은 Phase 5 명세·구현의 몫).

---

## Context

- **ADR-005 §D9**가 Change Set의 선행 계약을 남겼다: Change Set은 Runtime Entities를 대상으로 하고, `baseVersion`을 선언하며, Navigation Engine이 atomic하게 적용하고, 성공 시 version을 1회 올리며, persist는 그 이후의 checkpoint다.
- **실증 사고(2026-07-09)**: 두 writer(앱·AI)가 `state.json`을 전체 덮어써 병합된 작업이 소멸됐다. 이를 구조적으로 없애려면 **모든 변경이 통제·검토 가능한 단일 메커니즘**을 통과해야 한다.
- 동시에 Navigator를 **AI와 사람이 함께 설계하는 플랫폼**으로 만들려면, AI의 변경은 **제안(proposal)** 이어야 하고 적용은 **사람의 확인 + Engine의 검증**을 거쳐야 한다.

## Decision

> **Runtime의 모든 변경은 Change Set을 통해서만 이루어진다.**
> Change Set은 Runtime Entities를 변경하는 **명령 집합**이며, Navigation Engine이 **baseVersion 검사 → 검증 → atomic apply → version++ → undo 기록**의 순서로 처리한다. `state.json`은 apply 이후의 checkpoint이며, UI·AI는 이를 직접 수정하지 않는다.

### D1. Change Set = Runtime 변경 명령 집합 (`state.json` 직접 수정 금지)

- Change Set은 **Runtime Entities**를 대상으로 한다. `state.json`을 직접 수정하지 않는다(ADR-005 §D9 재확인).

```ts
type ChangeSet = {
  id: string;
  baseVersion: number;              // 적용 대상 Runtime content version
  commands: RuntimeCommand[];
  createdAt: string;
  actor: "user" | "ai" | "system";
  status: "proposed" | "applied" | "rejected" | "superseded";
  intent?: string;                  // 유발 프롬프트/설명 (AI 제안 추적)
};
```

`RuntimeCommand`는 **엔티티 단위·타입드**다 (예시 — 구현 카탈로그는 Phase 5):

```ts
type RuntimeCommand =
  | { op: "addWorkflow";    workflow: Workflow }
  | { op: "updateWorkflow"; id: string; patch: Partial<Workflow> }
  | { op: "removeWorkflow"; id: string }
  | { op: "addRelation";    relation: Relation }
  | { op: "removeRelation"; id: string }
  | { op: "addJourney";     journey: Journey }
  | { op: "updateJourney";  id: string; patch: Partial<Journey> }
  | { op: "renameEntity";   entity: "workflow" | "variant" | "journey" | "businessObject"; id: string; name: string }
  // process-내부 node/edge 명령은 초기 범위 밖 (ADR-005 §D7 원칙과 정합)
```

> 모든 command는 **ID 기준**이다(ADR-005 §D5). `renameEntity`는 이름만 바꾸고 **ID를 유지**한다. Relation/Journey는 display name이 아니라 **ID를 참조**한다.

### D2. `baseVersion` 필수 + Conflict Detection

- 모든 Change Set은 `baseVersion`을 선언한다.
- Engine은 `baseVersion === Runtime.version` 일 때만 적용한다. 불일치 시 **CONFLICT** — 적용을 **거부**하고 재검토(rebase/re-propose) 대상으로 표면화한다.
- **last-write-wins 금지.** 오래된 base 위의 변경은 덮어쓰지 않고 감지·차단한다(실증 사고의 구조적 해결).

### D3. Navigation Engine = 단일 apply 경계 (atomic)

- **apply는 Navigation Engine만 수행한다**(ADR-005 §D4 Single Writer 재확인).
- **apply는 atomic**하다: Change Set의 모든 command가 성공하거나, 하나라도 실패하면 **전부 롤백**되어 Runtime은 불변으로 남는다(부분 적용 없음).

### D4. Change Set 단위 `version++` 1회

- apply 성공 시 Runtime content version을 **딱 1회** 증가시킨다(command 개수와 무관). ADR-005 §D3·§D9 재확인.

### D5. Command Validation (2단계)

- **정적 검증(static)**: command 형태·타입·필수 필드, 참조 ID 존재 여부 — apply 이전.
- **의미 검증(semantic)**: Runtime 불변식 — ID 안정성, Relation/Journey의 참조 무결성(존재하는 workflowId만), orphan edge 금지, 순환/중복 규칙 등.
- 어느 하나라도 실패하면 **Change Set 전체 거부**(atomic, D3).

### D6. Dry-run / Preview (Diff)

- Change Set은 **Runtime 사본에 dry-run**으로 적용해 **Diff(추가/삭제/수정/이동 엔티티)** 를 산출할 수 있다 — 실제 Runtime은 불변.
- 이 Diff가 **Review UI**(Navigator IA / Architecture Review의 Review UI)를 구동한다. Preview = dry-run 결과.

### D7. Undo / Redo

- apply 성공 시 Engine은 **역(inverse) Change Set**을 기록한다(각 command의 before/after 기반).
- **Undo = 역 Change Set 적용**, **Redo = 재적용**. Undo/redo도 Engine을 통과하는 apply이며 동일하게 version을 전이시킨다(Runtime 레벨 undo 스택).
- Undo/redo는 Runtime 대상이며, persist는 그 이후의 checkpoint다.

### D8. AI Proposal vs User Confirmation (분리)

- **AI는 `status: "proposed"` Change Set을 생성**한다(`actor: "ai"`). **자동 적용하지 않는다.**
- **사람이 확인**(Review → 전체 승인 / 부분 승인 / 거부)한 뒤에야 Navigation Engine이 적용한다.
- 협업 모델: **propose(AI) ≠ apply(Engine, 사람 확인 시)**. 이 분리가 "AI와 사람이 함께 설계하는 플랫폼"의 핵심이다.

### D9. Persist = apply 이후 checkpoint

- Persistence는 Runtime 변이 **이후의 checkpoint**로, command 의미와 분리된다(ADR-005 §D8·§D9).
- persist는 현재 content version을 `state.json`에 기록한다. persist 시점 전략(매 apply마다 vs 명시적 save)은 Phase 5 구현 결정이며, 본 ADR은 "persist는 apply의 하류(downstream) checkpoint"라는 원칙만 고정한다.

### Change Set 생애주기

```text
propose(AI/user)
   → validate(static)                                  실패 → reject(전체)
   → dry-run → preview Diff                            (Review UI)
   → user confirm (전체/부분/거부)
   → Engine.apply(baseVersion 검사, atomic)            base 불일치 → CONFLICT → rebase/re-propose
   → version++ (1회) → inverse 기록(undo)
   → [별도] persist(checkpoint)
```

## Consequences

- (+) **두-writer race / last-write-wins 구조적 제거** — 단일 apply 경계 + baseVersion(D2·D3).
- (+) **AI 협업 개방** — propose → review → apply(D8). AI는 Committer가 아니라 Proposer(Navigator IA §8 AI=Consumer의 실행형).
- (+) **감사성(auditability)** — 모든 변경이 actor·baseVersion·intent를 가진 타입드 집합.
- (+) **Undo/Redo 무료 확보** — inverse Change Set(D7).
- (+) **안전한 미리보기** — dry-run Diff(D6)로 적용 전 검토.
- (−) **인프라 필요** — Engine의 apply/validate/diff/undo/conflict 처리(Phase 5 구축).
- (−) **Conflict UX 필요** — baseVersion이 stale일 때 rebase/re-propose 흐름.
- **범위 한계**: 본 ADR은 Architecture 수준이다. RuntimeCommand 전체 카탈로그, Engine 구현, Review UI 상세는 **Phase 5 명세/구현**에서 다룬다.

## Related

- 상속: [ADR-005 §D9](ADR-005-Navigator-Runtime-Model.md)
- 원칙: [ADR-002 Graph First](ADR-002-Graph-First.md), [Navigator IA](../05_Review/Codex/Navigator-Phase3-Concept.md) §7(Search)·§8(AI Consumer)
- 후속: **Phase 5** — Change Set 기반구조(모델·apply·undo·conflict) + **Review UI**
