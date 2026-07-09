# ADR-005 — Navigator Runtime Model

|Field|Value|
|---|---|
|Status|Accepted|
|Date|2026-07-09|
|Owner|혁신팀|
|Amends|—|
|Feeds|[ADR-006 Change Set Architecture](ADR-006-Change-Set-Architecture.md) (예정)|
|Related|[ADR-002 Graph First](ADR-002-Graph-First.md), [ADR-003 Ratification](ADR-003-Navigator-IA-Ratification.md), [ADR-004 Process Graph Schema First](ADR-004-Process-Graph-Schema-First.md), [Navigator IA](../05_Review/Codex/Navigator-Phase3-Concept.md)|

> Graph First(ADR-002) 이후의 **구조적 의사결정**이다. Navigator가 메모리 상에서 무엇을 1급 모델로 삼고, `state.json`이 그 안에서 어떤 역할인지 확정한다. Change Set(ADR-006)은 이 Runtime 위에서 정의된다.

---

## Context

- **ADR-002/003**이 Graph First를 승인하고, **ADR-004**가 Phase 4.1을 Process Graph Schema 우선으로 정렬했다.
- 현재 in-memory 모델 `ProcessData`(`src/types/processData.ts`)는 이미 **proto-Runtime**이다: `commonMasters`(Masters) + `processes[]`/`workflows[]`/`detailProcessGroups[]`(Entities) + `resolveProcessWithMasters()`(Projection) + `dirty` 플래그.
- 그러나 저장은 `saveRemoteProcessData`(전체 직렬화 POST) + vite 플러그인(전체 `writeFileSync`)로 **전체 파일 last-write-wins**이며, **두 개의 무조율 Writer(앱·AI)** 가 같은 파일을 덮어쓴다.
- **실증 사고(2026-07-09)**: dev 서버 실행 중 앱이 정규화 이전의 전체 문서를 `state.json`에 덮어써 병합된 PR #17을 롤백(`매출전표`→`매출 전표` 5곳)하고 유령 레인을 추가했다. 커밋 직전 발견해 복원했다.
- 근본 원인은 **"state.json을 변경 대상으로 취급"** 한 범주 오류다. 변경 대상은 메모리의 Runtime이어야 하고, `state.json`은 그 직렬화 스냅샷이어야 한다.

## Decision

> **We will promote the current `ProcessData` model into a first-class Navigator Runtime.**
> The Navigator Runtime is the in-memory operational source of truth for navigation, querying, mutation, and AI-assisted proposal application during a session.
> `state.json` is not the operational model. It is a persistence checkpoint that serializes authoritative Runtime Masters and Entities.
> Graph and Projections are rebuilt from persisted Entities and are not saved as authoritative state.

한국어:
> 현재 `ProcessData`를 1급 **Navigator Runtime**으로 격상한다. Navigator Runtime은 세션 중 탐색·질의·변경·AI 제안 적용의 운영상 Source of Truth이다. `state.json`은 운영 모델이 아니라 Runtime의 권위 엔티티·마스터를 직렬화한 **persistence checkpoint**다. Graph와 Projection은 저장하지 않으며 hydrate 시 Entities로부터 재구성한다.

### D1. Runtime과 Persistence의 책임 경계

- **Runtime = 편집·질의·AI 제안 적용의 1급 대상.** `state.json`은 **변경 대상이 아니다**(persistence/checkpoint일 뿐).

### D2. Runtime 4계층 (메모리 관리 구조)

```text
L4  Projections  — 파생·재생성·미저장 : Catalog/Journey View · Search index · resolved Process
       ▲ 재빌드
L3  Graph        — Entities로부터 materialize한 in-memory index (미저장)
                   Nodes: Workflow(향후 BusinessObject) · Edges: Relation · Paths: Journey · Indices
       ▲ 빌드
L2  Entities     — 권위·저장 : Workflow(+Variant+Process/instance) · Relation[] · Journey[] · BusinessObject[]
L1  Masters      — 권위·저장 : lanes · phases
```

> **Graph is not persisted. Relations are persisted. The in-memory graph is materialized from authoritative entities.**
> "Graph First"는 탐색·경험의 기층이라는 뜻이지, `state.json`에 별도 Graph 자료구조를 저장한다는 뜻이 아니다. Graph를 저장하면 정합성 이중관리·저장 중복·migration 복잡도·stale index·AI 변경 blast radius 증가가 즉시 발생한다.

### D3. Persistence 형태 + version 의미

```ts
type NavigatorRuntimePersistence = {
  schemaVersion: number;   // persistence 구조 버전 (migration 판단용)
  version: number;         // Runtime Entities content version (Change Set 동시성 판단용)
  updatedAt: string;       // 사람이 보는 마지막 변경 시각
  commonMasters: CommonMasters;
  processes: ProcessInstance[];
  workflows: Workflow[];
  detailProcessGroups: DetailProcessGroup[];
  overviewProcessGroups: OverviewProcessGroup[];
  relations?: Relation[];        // 신규·optional
  journeys?: Journey[];          // 신규·optional
  businessObjects?: BusinessObject[]; // 신규·optional·향후
};
```

- **`version`은 파일 저장 횟수가 아니라 Runtime Entities의 논리 버전이다.**
  - `applyChangeSet` 성공 → **version++** (Change Set 단위 1회).
  - `persist` → 현재 version을 `state.json`에 checkpoint.
  - `hydrate` → `state.json`의 version을 Runtime baseVersion으로 로드.
  - 즉 **버전 증가의 기준은 persist가 아니라 applyChangeSet이다.**
- **`schemaVersion` ≠ `version`.** schemaVersion=persistence 구조 버전(migration), version=엔티티 변경 버전(동시성).
- **`dirty`는 세션 메타데이터**이며 원칙적으로 저장하지 않는다. 마지막 persist 이후 변경 여부를 나타내는 계산값. legacy 호환을 위해 읽을 수는 있으나 hydrate 시 재계산하거나 무시한다.

> **마이그레이션 정합(중요):** 현재 `state.json` 최상위 `version: 2`는 실제로 **스키마 버전**이다. 이를 `schemaVersion: 2`로 매핑하고, 콘텐츠 `version`은 **신규 필드**로 도입한다(기존 파일 로드 시 version 미존재 → 초기값 부여 후 hydrate). 실제 필드 명칭·마이그레이션 코드는 Phase 4.1에서 확정.

### D4. Single Writer 원칙

> **Only the Navigation Engine can mutate Runtime Entities. Only the Navigation Engine can persist Runtime Entities to `state.json`. UI and AI are consumers/proposers, not writers.**

- **UI may request. AI may propose. Navigation Engine decides, validates, applies, indexes, and persists.**
- 이 원칙이 두-writer race를 **구조적으로 제거**한다(위 실증 사고의 재발 차단).

### D5. Entity ID 불변성

> **Entity IDs are stable.** Renaming a workflow, variant, journey, or business object must not change its ID. Relations and journeys must reference **IDs, not display names.**

- 이 원칙이 없으면 AI 제안·rename·search·journey path·undo가 전부 불안정해진다.

### D6. Relation의 권위성 (ProcessInstance.edges와 구분)

- **Relation = authoritative persisted edge entity.** Graph Edge = Relation의 in-memory materialization.

```ts
type Relation = {
  id: string;
  fromWorkflowId: string;
  toWorkflowId: string;
  type: "sequence" | "trigger" | "dependsOn" | "partOfJourney";
  label?: string;
  metadata?: Record<string, unknown>;
};
```

> **계층 구분(혼동 금지):**
> - `ProcessInstance.edges` = **process 내부** 렌더링/흐름 edge (기존).
> - `Relation[]` = **Navigator Runtime의 workflow 간** semantic edge (신규).
>
> 초기 버전은 **Workflow 간 Relation만** 다루고, process 내부 node-edge와 섞지 않는다.

### D7. Journey 초기 granularity (workflow-level path)

```ts
type Journey = {
  id: string;
  name: string;
  workflowIds: string[];   // 초기: workflow-level path
  description?: string;
  relationIds?: string[];
};
```

> **Initial Journey paths are workflow-level paths.** Node-level journeys may be introduced later as an extension. process 내부 node까지 Journey에 넣으면 복잡도가 급증하므로 초기엔 제한한다.

### D8. Projection 저장 금지

> **Resolved processes, catalog trees, search results, journey views, graph adjacency maps, and recommendation contexts are projections. They must not be persisted as authoritative state.**

- 이 원칙이 `state.json`의 재비대화를 막는다.

### D9. Change Set 선행 계약 (ADR-006으로 위임)

ADR-005는 command 상세에 들어가지 않고 **계약과 원칙만** 둔다.

```ts
type ChangeSet = {
  id: string;
  baseVersion: number;
  commands: RuntimeCommand[];   // 상세는 ADR-006
  createdAt: string;
  actor: "user" | "ai" | "system";
};
```

원칙:
- **A Change Set targets Runtime Entities, not `state.json`.**
- **A Change Set must declare `baseVersion`.**
- **A Change Set is applied atomically by the Navigation Engine.**
- **A successful apply increments Runtime `version` once** (command마다가 아니라 Change Set 단위 1회).
- **Persistence is a checkpoint after Runtime mutation.**

## Consequences

- (+) **두-writer race 구조적 제거** — Single Writer(D4).
- (+) **AI 협업 모델 개방** — AI는 Runtime에 Change Set을 제안(propose)하고 Engine이 적용(apply). state.json 직접 편집 종료.
- (+) **state.json 경량 유지** — Projection/Graph 미저장(D2·D8).
- (+) **낙관적 동시성** — content `version`으로 충돌 감지(덮어쓰기 대신).
- (+) **안정적 참조** — Entity ID 불변(D5)으로 rename/search/undo 견고.
- (−) **리팩터링 필요**: `ProcessData` → Runtime 격상, `activeProcessData` registry → Navigation Engine 승격, Graph(L3)/Projection(L4) 모듈 신설.
- (−) **마이그레이션**: `schemaVersion` 도입 + 기존 `version:2` 의미 정정 + content `version` 신규(D3 정합 노트).
- **하위호환(additive)**: `relations`/`journeys`/`businessObjects` optional. 없으면 현행 동작(Catalog View만) → v1 복귀 가능.

## 최종 결정 요약

| 결정 항목 | 확정 |
|---|---|
| Runtime Model 문서 형식 | **ADR-005** |
| 후속 Change Set 문서 | ADR-006 |
| Graph 저장 여부 | **미저장**, in-memory derived index |
| Relation 저장 여부 | **저장**, 권위 edge entity |
| Journey 저장 여부 | **저장**, named path entity (초기 workflow-level) |
| Projection 저장 여부 | **미저장** |
| version 도입 | 도입 |
| version 의미 | Runtime Entities content version (applyChangeSet 기준) |
| dirty 의미 | 세션 메타, 원칙적으로 persistence 제외 |
| AI의 변경 대상 | `state.json` 아님, **Runtime Change Set** |
| Writer | **Navigation Engine 단일 writer** |

## Related

- 선행 원칙: [ADR-002 Graph First](ADR-002-Graph-First.md), [Navigator IA](../05_Review/Codex/Navigator-Phase3-Concept.md) §1·§6
- 비준 문맥: [ADR-003](ADR-003-Navigator-IA-Ratification.md) · 로드맵: [ADR-004](ADR-004-Process-Graph-Schema-First.md)
- 후속: **ADR-006 Change Set Architecture** — 본 Runtime 위의 변경 명령 집합을 정의(§D9 계약 상속)
