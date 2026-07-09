# Phase 5 — Navigator Runtime / Change Set Implementation WBS (초안)

|Field|Value|
|---|---|
|Status|Draft|
|Date|2026-07-09|
|Owner|혁신팀|
|Implements|[ADR-005 Navigator Runtime Model](../06_Decisions/ADR-005-Navigator-Runtime-Model.md), [ADR-006 Change Set Architecture](../06_Decisions/ADR-006-Change-Set-Architecture.md)|
|Layer|Implementation (WBS) — ADR 결정선을 실행 단위·순서·검증 시나리오로 분해|
|Related|[Navigator IA](../05_Review/Codex/Navigator-Phase3-Concept.md), [ADR-004 Process Graph Schema First](../06_Decisions/ADR-004-Process-Graph-Schema-First.md)|

> ADR-005/006은 **구조 결정**(무엇을 1급으로, 어떻게 변경할 것인가)을 끝냈다. 본 문서는 그 결정을 **실행 가능한 Work Package(WP)** 로 분해한다. 결정을 재논의하지 않고, 각 WP의 산출물·작업·완료 기준·의존성·검증만 정의한다. 새 아키텍처 결정이 필요하면 ADR-007로 분리한다(본 WBS의 몫이 아님).

---

## 0. 목적 · 범위 · 비범위

### 0.1 목적
- ADR-005(Runtime Model) + ADR-006(Change Set)을 **코드 착수 이전의 실행계획**으로 확정한다.
- 착수 순서(dependency-ordered)와 각 단계의 **완료 기준(DoD)** 및 **검증 시나리오**를 고정한다.

### 0.2 범위 (In-Scope)
- Runtime persistence migration, Navigation Engine 경계, Runtime Entities additive schema, Graph materialization, Change Set MVP, Undo/Redo 최소 모델, AI proposal 경계, 테스트 시나리오.

### 0.3 비범위 (Out-of-Scope, 후속 Phase)
- Review UI 상세 디자인·구현 (Change Set Diff를 소비하는 UI는 별도 트랙; 본 WBS는 dry-run Diff **산출까지**).
- process 내부 node/edge 레벨 Change Set (ADR-005 §D7 — 초기 workflow-level만).
- `businessObjects` 실질 기능 (schema additive 자리만 확보, 동작은 향후).
- Node-level Journey (ADR-005 §D7 — 초기 workflow-level path만).
- 멀티유저 서버 동시성/락 (현 구조는 단일 세션 Runtime + 낙관적 content version).

### 0.4 상속 계약 (재확인, ADR 출처)
| 계약 | 출처 |
|---|---|
| Runtime = 1급 변경 대상, `state.json` = persistence checkpoint | ADR-005 §D1 |
| Graph 미저장 / Relation·Journey 저장 / Projection 미저장 | ADR-005 §D2·§D6·§D7·§D8 |
| Single Writer = Navigation Engine | ADR-005 §D4 / ADR-006 §D3 |
| Entity ID 불변, 참조는 ID 기준 | ADR-005 §D5 / ADR-006 §D1 |
| `baseVersion` 필수, CONFLICT 시 last-write-wins 금지 | ADR-006 §D2 |
| atomic apply, Change Set 단위 version++ 1회 | ADR-006 §D3·§D4 |
| static + semantic validation | ADR-006 §D5 |
| dry-run / preview Diff | ADR-006 §D6 |
| undo/redo = inverse Change Set | ADR-006 §D7 |
| AI proposal ≠ apply (user confirm 분리) | ADR-006 §D8 |
| persist = apply 이후 checkpoint | ADR-005 §D3 / ADR-006 §D9 |

---

## 1. Work Package 개요 · 의존 순서

```text
WP1 Persistence Migration  ─┐
                            ├─▶ WP3 Runtime Entities Schema ─▶ WP4 Graph Materialization
WP2 Navigation Engine 경계 ─┘                                         │
        │                                                             ▼
        └──────────────▶ WP5 Change Set MVP ◀── (WP3 엔티티, WP4 semantic 검증 활용)
                               │
                               ├─▶ WP6 Undo/Redo
                               └─▶ WP7 AI Proposal 경계
                               
WP8 Test Scenarios — WP1~WP7 각 단계에 게이트로 병렬 부착 (마지막에 통합 회귀)
```

**Critical path:** WP1 → WP2 → WP3 → WP5 → (WP6, WP7). WP4는 WP3 이후, WP5의 semantic 검증(참조 무결성)에 투입. WP8은 독립 트랙이 아니라 각 WP의 **완료 게이트**.

| WP | 이름 | 선행 | 산출물 요지 |
|---|---|---|---|
| WP1 | Runtime Persistence Migration | — | `schemaVersion`/`version` 정합, dirty 제외, 로드 호환 |
| WP2 | Navigation Engine Boundary | WP1 | hydrate / query / applyChangeSet / persist 4-메서드 경계 |
| WP3 | Runtime Entities Additive Schema | WP1 | `relations?`/`journeys?`/`businessObjects?` + content `version` |
| WP4 | Graph Materialization | WP3 | relations[] → adjacency/reverse index (in-memory, 미저장) |
| WP5 | Change Set MVP | WP2·WP3(·WP4) | baseVersion·static·semantic·dry-run·atomic·version++·persist |
| WP6 | Undo/Redo 최소 모델 | WP5 | inverse Change Set + Runtime history stack |
| WP7 | AI Proposal Boundary | WP5 | AI=proposed Change Set까지, confirm 후 apply |
| WP8 | Test Scenarios | 각 WP | conflict·invalid·rollback·preview·undo/redo·roundtrip |

---

## 2. WP1 — Runtime Persistence Migration

**ADR 근거:** ADR-005 §D3(정합 노트)·§D8.

### 산출물
- `state.json` 로더/세이버가 신구 형태를 모두 안전하게 처리하는 migration 계층.

### 작업 항목
1. 기존 최상위 `version: 2` 를 **`schemaVersion: 2`** 로 매핑(현재 `version:2`는 사실상 스키마 버전).
2. **신규 content `version`** 도입: 기존 파일 로드 시 미존재 → 초기값(예: `0` 또는 `1`) 부여 후 hydrate.
3. `dirty` persistence 제외: 저장하지 않음. legacy 파일에 있으면 **읽되 hydrate 시 무시/재계산**.
4. `NavigatorRuntimePersistence` 타입(ADR-005 §D3)으로 직렬화 형태 고정.
5. 마이그레이션 방향은 **forward-only**: 구 형태 로드 → 신 형태 저장. 역변환은 비범위.

### 완료 기준 (DoD)
- 구 `state.json`(version:2, content version 없음) 로드 → 정상 hydrate, content `version` 초기값 부여.
- 저장 결과에 `schemaVersion`·`version`·`updatedAt` 존재, `dirty` 부재.
- 한 번 저장 후 재로드해도 엔티티 손실/변형 없음(roundtrip 무결 — WP8과 연동).

### 리스크
- 초기 content `version` 값 선택이 이후 conflict 판정 baseline이 됨 → 팀 합의 필요(제안: 기존 파일=`0`, 신규 생성=`0`).

---

## 3. WP2 — Navigation Engine Boundary

**ADR 근거:** ADR-005 §D4(Single Writer) / ADR-006 §D3.

### 산출물
- Runtime 변경·저장의 **유일 경계**인 Navigation Engine 모듈(현 `activeProcessData` registry를 승격).

### 4개 공개 경계 (그 외 mutate 경로 금지)
| 메서드 | 책임 | 비고 |
|---|---|---|
| `hydrate(persisted)` | `state.json` → Runtime 로드, content `version`을 baseVersion으로 | WP1 로더 사용 |
| `query(...)` | 읽기 전용 탐색/질의 (Projection·Graph 소비) | 변경 없음 |
| `applyChangeSet(cs)` | **유일한 mutation 진입점** (WP5에서 구현) | atomic |
| `persist()` | 현재 content version을 `state.json`에 checkpoint | apply와 분리 |

### 작업 항목
1. UI/AI가 Runtime을 직접 mutate하던 경로를 **차단**하고 Engine 경유로 리다이렉트.
2. 기존 `saveRemoteProcessData` 전체 직렬화 POST + vite 전체 `writeFileSync` 경로를 **`persist()` 하나로 수렴**(두-writer race 제거).
3. `query`는 부작용 없음을 타입/구조로 보장(읽기 전용 반환).

### 완료 기준 (DoD)
- Runtime을 바꾸는 코드 경로가 `applyChangeSet` **하나뿐**임을 grep/구조로 확인.
- persist 호출부가 단일화되어 앱·AI 이중 writer 경로가 소스에서 사라짐.

### 리스크
- 기존 직접 편집 UI가 많으면 리다이렉트 범위가 큼 → WP5(command) 없이는 편집이 잠깐 막힐 수 있어 WP2↔WP5 인터리브 필요.

---

## 4. WP3 — Runtime Entities Additive Schema

**ADR 근거:** ADR-005 §D3·§D5·§D6·§D7.

### 산출물
- `relations?` / `journeys?` / `businessObjects?` + content `version`을 포함한 **additive** 엔티티 스키마. (없으면 현행 Catalog View 동작 = v1 복귀 가능.)

### 작업 항목
1. `Relation` 타입(ADR-005 §D6): `{id, fromWorkflowId, toWorkflowId, type, label?, metadata?}` — **workflow 간** edge만. `ProcessInstance.edges`(process 내부)와 혼동 금지.
2. `Journey` 타입(ADR-005 §D7): `{id, name, workflowIds[], description?, relationIds?}` — workflow-level path.
3. `businessObjects?`: 타입 자리만 additive 확보(동작 비범위).
4. 모든 참조는 **ID 기준**(display name 금지, ADR-005 §D5).
5. 엔티티 ID 발급/불변 보장 유틸(rename이 ID를 바꾸지 않음).

### 완료 기준 (DoD)
- 세 필드 모두 optional — 미존재 파일이 그대로 로드/저장(하위호환).
- Relation/Journey가 존재하지 않는 workflowId를 참조하지 못하도록 하는 검증 훅(WP5 semantic에서 사용)이 붙을 자리 확보.
- rename 후에도 ID 동일(단위 테스트).

### 리스크
- `businessObjects` 자리만 두고 방치하면 stale 스키마화 → "동작 비범위" 주석 명시.

---

## 5. WP4 — Graph Materialization

**ADR 근거:** ADR-005 §D2(L3 Graph, 미저장).

### 산출물
- `relations[]` 로부터 **in-memory**로 build하는 adjacency / reverse index. **저장 금지**(projection).

### 작업 항목
1. `relations[]` → forward adjacency(`fromWorkflowId → [toWorkflowId]`) + reverse index(`toWorkflowId → [fromWorkflowId]`).
2. **workflow-level graph만**(process 내부 node-edge 제외, ADR-005 §D7 정합).
3. Graph는 hydrate/applyChangeSet 이후 **재빌드**(materialize), persist 대상 아님(ADR-005 §D8).
4. WP5 semantic 검증이 참조 무결성·순환/중복 판정에 이 index를 활용.

### 완료 기준 (DoD)
- `state.json` 어디에도 graph/adjacency가 직렬화되지 않음(WP8 roundtrip으로 확인).
- Relation 추가/삭제(Change Set) 후 index가 재빌드되어 일관.

### 리스크
- 매 apply마다 전체 재빌드 vs 증분 갱신 — 초기엔 **전체 재빌드**(단순·정확), 성능은 후속 최적화.

---

## 6. WP5 — Change Set MVP (핵심)

**ADR 근거:** ADR-006 §D1~§D6·§D9, 생애주기 다이어그램.

### 산출물
- Navigation Engine의 `applyChangeSet` 전체 파이프라인.

### 파이프라인 (순서 고정 — ADR-006 생애주기)
```text
propose → validate(static) → dry-run → preview Diff → (user confirm)
        → apply(baseVersion 검사, atomic) → version++ (1회) → inverse 기록 → [별도] persist
```

### 작업 항목
1. **`baseVersion` 검사**: `cs.baseVersion === Runtime.version` 아니면 **CONFLICT**로 거부(rebase/re-propose 표면화). last-write-wins 금지(ADR-006 §D2).
2. **static validation**: command 형태·타입·필수 필드·참조 ID 존재(ADR-006 §D5). 실패 → 전체 거부.
3. **semantic validation**: ID 안정성, Relation/Journey 참조 무결성(존재 workflowId만), orphan edge 금지, 순환/중복 규칙(WP4 index 활용). 실패 → 전체 거부.
4. **dry-run / preview Diff**: Runtime **사본**에 적용해 추가/삭제/수정/이동 엔티티 Diff 산출, 실제 Runtime 불변(ADR-006 §D6). — Diff 산출까지가 본 WBS 범위(Review UI는 별도 트랙).
5. **atomic apply**: 모든 command 성공 or 전부 롤백, 부분 적용 없음(ADR-006 §D3).
6. **version++ 1회**: command 개수 무관, Change Set 단위(ADR-006 §D4).
7. **persist checkpoint**: apply 하류에서 분리 호출(ADR-006 §D9). 매 apply vs 명시 save 전략은 구현 결정으로 열어둠.
8. 초기 `RuntimeCommand` 카탈로그(ADR-006 §D1 예시 기준): `addWorkflow`, `updateWorkflow`, `removeWorkflow`, `addRelation`, `removeRelation`, `addJourney`, `updateJourney`, `renameEntity`. process 내부 node/edge 명령 제외.

### 완료 기준 (DoD)
- stale `baseVersion` Change Set이 **거부**되고 Runtime 불변(WP8 §conflict).
- 잘못된 relation 참조가 **semantic에서 차단**(WP8 §invalid).
- command 중 하나 실패 시 **전량 롤백**(WP8 §partial rollback).
- dry-run이 실제 Runtime을 바꾸지 않고 Diff만 반환(WP8 §preview).
- apply 성공 시 `version`이 정확히 **+1**.

### 리스크
- semantic 규칙 범위(순환 허용 여부 등)가 도메인 결정 필요 → 초기엔 "참조 무결성 + 중복 금지"만, 순환 정책은 명시적 TODO.

---

## 7. WP6 — Undo / Redo 최소 모델

**ADR 근거:** ADR-006 §D7.

### 산출물
- Runtime-level history stack + inverse Change Set 기반 undo/redo.

### 작업 항목
1. apply 성공 시 각 command의 before/after로 **inverse Change Set** 생성·기록.
2. **Undo = inverse 적용**, **Redo = 재적용** — 둘 다 Engine의 apply를 통과(동일하게 version 전이).
3. Runtime history stack(선형; redo는 새 apply 발생 시 폐기하는 표준 모델).
4. persist는 undo/redo 이후의 checkpoint.

### 완료 기준 (DoD)
- apply → undo → redo 후 Runtime이 각 단계 기대 상태와 일치(WP8 §undo/redo).
- undo/redo도 version을 전이(별도 apply로 취급).

### 리스크
- inverse 생성이 어려운 command(예: 삭제 시 원본 보존) → command 설계 시 before 스냅샷 확보 필요(§D7 "before/after 기반").

---

## 8. WP7 — AI Proposal Boundary

**ADR 근거:** ADR-006 §D8 / ADR-005 §D4.

### 산출물
- AI가 `status:"proposed"`, `actor:"ai"` Change Set**까지만** 생성하고, 사람 확인 후에만 apply되는 경계.

### 작업 항목
1. AI 출력 = **proposed Change Set**(자동 apply 금지). `intent`에 유발 프롬프트/설명 기록(추적성).
2. 사람 확인 게이트: 전체 승인 / 부분 승인 / 거부 → 승인분만 Engine.apply.
3. AI는 `state.json`·Runtime을 직접 건드리지 않음(구조적으로 propose 경로만 노출).

### 완료 기준 (DoD)
- AI 경로가 Runtime을 직접 mutate할 수 없음(소스/구조 확인).
- proposed → confirm → apply 경로에서만 version 증가.
- 부분 승인 시 승인된 command만 반영(원자성은 "확정된 Change Set" 단위로 유지).

### 리스크
- "부분 승인"의 원자성 정의 — 부분 승인은 **새 Change Set 재구성 후 atomic apply**로 처리(부분 적용 아님)로 고정 권장.

---

## 9. WP8 — Test Scenarios (게이트)

각 시나리오는 대응 WP의 완료 게이트다. 통합 회귀는 마지막에 일괄.

| # | 시나리오 | 대상 WP | 기대 결과 |
|---|---|---|---|
| T1 | **version conflict** — stale baseVersion으로 apply | WP5 | CONFLICT 거부, Runtime 불변, version 불변 |
| T2 | **invalid relation** — 없는 workflowId 참조 relation 추가 | WP3·WP5 | semantic 거부, 전체 무효 |
| T3 | **partial failure rollback** — 다중 command 중 1개 실패 | WP5 | 전량 롤백, 부분 적용 없음 |
| T4 | **dry-run preview** — dry-run 후 실제 Runtime 검사 | WP5 | Diff 산출, 실제 Runtime·version 불변 |
| T5 | **undo/redo** — apply→undo→redo 상태 전이 | WP6 | 각 단계 기대 상태·version 정합 |
| T6 | **persistence roundtrip** — 저장→로드 무결성 | WP1·WP4 | 엔티티 무손실, graph/projection 미저장 확인 |
| T7 | **AI proposal 비적용** — AI가 만든 proposed CS는 confirm 전 미적용 | WP7 | confirm 전 Runtime·version 불변 |
| T8 | **legacy 호환** — relations/journeys 없는 구 파일 로드/저장 | WP1·WP3 | 정상 동작(Catalog View), additive 필드 부재 유지 |

---

## 10. Phase 5 Definition of Done (전체)

- [ ] Runtime을 바꾸는 유일 경로가 `Navigation Engine.applyChangeSet` 하나 (두-writer race 소스 제거).
- [ ] `state.json`에 Graph/Projection 미저장, `schemaVersion`+content `version` 정합, `dirty` 미저장.
- [ ] baseVersion·static·semantic·atomic·version++1회·dry-run Diff 동작(T1~T4).
- [ ] undo/redo(T5), roundtrip(T6), AI proposal 분리(T7), legacy 호환(T8) 통과.
- [ ] additive 스키마로 v1 복귀 가능(relations/journeys 제거 시 현행 동작).

---

## 11. Open Questions (Phase 5 착수 전 합의 필요)

1. content `version` 초기값 정책(기존/신규 파일). — WP1 리스크.
2. persist 시점 전략: 매 apply vs 명시 save. — ADR-006 §D9가 구현 결정으로 위임.
3. semantic 순환(cycle) 정책: 허용/금지/경고. — WP5 리스크(초기 명시 TODO).
4. "부분 승인"의 원자성 처리 모델(재구성 후 atomic apply 권장). — WP7 리스크.
5. Review UI 트랙 분리 시점(본 WBS는 Diff 산출까지). — 비범위 경계.

> 위 5건은 **아키텍처 재결정이 아니라 구현 파라미터**다. 필요 시 개별 결정 노트로 처리하고, 구조 변경이 필요할 때만 ADR-007로 승격한다.

## Related
- 상속: [ADR-005](../06_Decisions/ADR-005-Navigator-Runtime-Model.md) §D1~§D9 · [ADR-006](../06_Decisions/ADR-006-Change-Set-Architecture.md) §D1~§D9
- 원칙: [Navigator IA](../05_Review/Codex/Navigator-Phase3-Concept.md) §7(Search)·§8(AI Consumer)
