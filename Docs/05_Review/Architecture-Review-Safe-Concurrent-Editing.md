# Architecture Review — Safe Concurrent Development & Application Editing

> **📌 CURRENT reference — Phase 2A는 구현 완료.** 본 리뷰의 Phase 2A(2A.1 저장소 격리·2A.2 Save Guard)는 **머지 완료**(#27 `ba1479a`, #30 `46e7bce`). "Concurrent Editing Ready" **C1~C7** 모델은 여전히 canonical 참조이며 **v1.0 목표**로 유효하다. 아래 phase 서술 중 2A는 "완료"로 읽을 것(2B~2E는 미구현).

|Field|Value|
|---|---|
|Role|Chief Architect Review|
|Status|Review · Baseline candidate (구현 착수 전 게이트)|
|Date|2026-07-09|
|Owner|혁신팀|
|Reviews|Runtime Phase 1(WP1), [ADR-005](../06_Decisions/ADR-005-Navigator-Runtime-Model.md), [ADR-006](../06_Decisions/ADR-006-Change-Set-Architecture.md), [ADR-007](../06_Decisions/ADR-007-Data-first-Approval-and-Runtime-Governance-Layer.md), WP2.1|
|Related|[Phase 5 WBS](../08_Implementation/Phase-5-Navigator-Runtime-ChangeSet-WBS.md), [Navigator IA](Codex/Navigator-Phase3-Concept.md)|
|Scope|리뷰 문서 전용 — 코드·런타임·샘플데이터 변경 없음, PR 없음|

> 목표: **개발자가 코드를 구현하는 동안, 업무 사용자가 실행 중인 애플리케이션에서 프로세스를 편집해도 서로를 훼손하지 않는다.** 최종 지향점은 Figma/Miro/Notion/BPMN Modeler처럼 **편집과 개발이 물리적으로 격리된** 구조다. 본 문서는 Runtime Phase 2 구현을 재개하기 전의 **아키텍처 기준선**이다.

---

## 0. Executive Summary (판정)

**Runtime Phase 1 + WP2.1은 안전한 동시 편집에 충분하지 않다.**

- Phase 1(WP1)은 **persistence 어휘**(schemaVersion↔content version, dirty 미저장, forward-only)를, WP2.1은 **거버넌스 타입 어휘**를 확보했다. 둘 다 **기반(baseline)**이지 **격리 메커니즘**이 아니다.
- 동시 편집 안전성의 핵심 메커니즘(단일 writer·Change Set·baseVersion 충돌 감지·atomic apply·undo)은 **ADR-005/006에서 이미 "결정"되었으나 아직 "구현되지 않았다"**(Phase 5 WBS의 WP2~WP6 미착수).
- 그 결과 **현재 실제 write 경로는 여전히 위험**하다: 임의 클라이언트가 전체 문서를 POST → dev 플러그인이 **추적 대상 샘플 파일**(`public/process-data/state.json`)에 **raw body를 통째로 덮어쓴다**. version/baseVersion 검사도 없다. 이는 ADR-005가 기록한 2026-07-09 실증 사고의 **구조가 그대로 살아있음**을 뜻한다.
- 추가로, ADR-005/006이 **다루지 않은 두 결정**이 필요하다: (a) `state.json`의 **3중 역할 분리**(repo seed / runtime canonical / editing target), (b) **Working Copy·Edit Session 격리 + 명시적 Publish 경계**.

→ 결론: 결정을 **재구현 순서로 내리고**(Phase 5 WBS와 정합), 여기에 **저장소 역할 분리 + Working Copy 모델**을 추가 비준한 뒤에야 "동시 작업 가능"이라 말할 수 있다.

---

## 1. Current Maturity Assessment (성숙도)

| 능력 | 상태 | 근거 |
|---|---|---|
| Runtime Persistence Baseline | ✅ 구현 | WP1 — schemaVersion/content version, dirty 미저장, roundtrip |
| Versioned load/save 어휘 | ✅ 구현 (어휘만) | content `version` 모델 존재 |
| Governance/Approval 타입 | ✅ 구현 (구조만) | WP2.1 — additive optional |
| Runtime = 1급, state.json = checkpoint | 🟡 결정됨·부분 | ADR-005 §D1 — 원칙은 결정, 코드 경계 미분리 |
| **Single Writer (Navigation Engine)** | 🟥 결정됨·미구현 | ADR-005 §D4 / ADR-006 §D3 — 현재 다중 writer 생존 |
| **Change Set = 유일 변경 경로** | 🟥 결정됨·미구현 | ADR-006 — WP5 미착수 |
| **baseVersion 충돌 감지** | 🟥 결정됨·미구현 | ADR-006 §D2 — write 경계에서 version 미검사 |
| **atomic apply / version++1회** | 🟥 결정됨·미구현 | ADR-006 §D3·§D4 |
| **Undo/Redo (inverse Change Set)** | 🟥 결정됨·미구현 | ADR-006 §D7 |
| Working Copy / Edit Session 격리 | 🟥 미결정 | 본 리뷰가 제안 |
| Publish/Commit 경계 | 🟥 미결정 | 본 리뷰가 제안 |
| Snapshot / Backup / Recovery | 🟥 미결정 | 본 리뷰가 제안 |
| Merge / Conflict UX | 🟥 미결정 | ADR-006 rebase/re-propose 원칙만 |
| Dev ↔ Runtime 저장소 분리 | 🟥 미결정 | 본 리뷰가 제안 (핵심) |

**요약**: 초록(persistence·타입)은 견고하다. 빨강(격리·write 경계)이 정확히 "동시 편집"을 막는 부분이며, 대부분 **결정은 있으나 구현이 없다** + **두 개의 신규 결정이 빠졌다**.

---

## 2. 남은 리스크 (Remaining Risks)

현재 코드 기준의 **실재하는** 위험:

1. **전체 파일 last-write-wins 덮어쓰기.** 저장은 `saveRemoteProcessData` → `POST /api/process-data` → dev 플러그인 `fs.writeFileSync(state.json, body)`. body 전체를 통째로 기록하며 **version/baseVersion 검사가 없다**. 두 번째 writer(다른 탭·AI·다른 개발자)가 오래된 base 위에서 저장하면 앞선 변경이 **소멸**한다(ADR-005 실증 사고 구조).
2. **`state.json` 3중 역할 충돌.** 같은 파일이 동시에 (a) repo에 커밋된 **샘플/시드 데이터**, (b) **런타임 canonical**, (c) **라이브 편집 대상**이다. dev 서버를 켠 채 편집하면 **커밋된 샘플 데이터가 즉시 덮어써진다**(git 오염·정규화 롤백).
3. **Builder ↔ Runtime 무격리.** 편집이 in-memory `ProcessData`를 직접 바꾸고 곧바로 canonical로 직렬화된다. Draft/Working Copy가 없어 **모든 편집이 즉시 정본**이 된다.
4. **write 경계에서 충돌 감지 부재.** content `version`은 모델에 있으나(WP1) 저장 경로가 이를 **사용하지 않는다**(WP5 미착수). 낙관적 동시성의 재료는 있는데 게이트가 없다.
5. **Snapshot/Backup/Recovery 부재.** 잘못된 저장은 git 없이는 되돌릴 수 없다. 자동 저장을 켜면 위험 증가, 끄면 크래시 시 작업 유실.
6. **Edit Session 정체성 부재.** 누가/무엇이(사람·AI·dev) 편집 중인지 구분이 없어 충돌을 표면화할 수 없다.
7. **Merge 전략 부재.** 동시 편집을 조정할 방법이 없다(rebase/re-propose 원칙만 문서에 존재).
8. **Undo/Redo 미지속.** 세션 밖으로 보존되지 않아 복구 불가.

> 위 1·2·3이 **동시 편집을 원천 차단**하는 3대 위험이다.

---

## 3. 빠진 아키텍처 계층 (Missing Layers)

제시된 예시 계층을 현재 상태에 매핑한다.

| 계층 | 현재 | 판정 |
|---|---|---|
| Edit Session | 없음 | **필요** — 편집 주체·격리 단위 |
| Workspace / Working Copy / Draft | 없음 | **필요** — canonical과 분리된 편집 사본 |
| Commit / Snapshot | 없음 | **필요** — 명시적 publish + 복구점 |
| Runtime Projection | ADR-005 L3/L4로 결정(미저장) | 재사용 — 별도 **published** 산출물로 승격 |
| Save Guard | `validatePreExport`만(정합) | **확장** — version guard 추가 |
| Version Conflict Detection | ADR-006 §D2 결정·미구현 | **구현** (핵심) |
| Dirty State | WP1 세션 전용 | 충분 (유지) |
| Locking | 없음 | **불채택 권장** — 낙관적 동시성이 이 도메인에 적합 |
| Merge Strategy | 원칙만 | **필요(단계적)** — 우선 conflict-reject, 후 rebase |
| Undo/Redo persistence | ADR-006 §D7 결정·미구현 | **구현(후순위)** |
| Recovery / Backup | 없음 | **필요** — publish 시 snapshot |

---

## 4. `state.json`은 계속 canonical editing target이어야 하는가?

**아니다.** `state.json`을 라이브 편집 대상으로 두는 것이 모든 위험의 뿌리다. 3중 역할을 **물리적으로 분리**한다.

| 역할 | 현재 | 목표 |
|---|---|---|
| repo seed/fixture | `public/process-data/state.json` (추적) | **불변 시드** — 실행 중 앱이 절대 기록하지 않음 |
| runtime canonical | 동일 파일 | **Published Runtime store** (시드와 분리, 앱-writable) |
| editing target | 동일 파일 | **Working Copy** (Edit Session 별 격리 draft) |

> 미래상: `state.json`(또는 후속 store)은 **Published Runtime의 checkpoint**이지, 라이브 편집 표면이 아니다. 편집은 **Working Copy**에서 일어나고, 검증·컴파일을 거쳐 **Publish**로만 canonical에 반영된다(ADR-005 §D1·§D8, ADR-006 apply 경계와 정합). **dev 서버는 추적 시드 파일에 절대 write하지 않는다.**

---

## 5. Builder와 Runtime을 물리적으로 분리해야 하는가?

**그렇다.** 아래 파이프라인을 권장한다(제안된 형태 채택).

```text
Builder (Edit Session)
   ↓            편집은 Change Set으로만 (ADR-006)
Working Copy (Draft · 격리 · baseVersion 보유)
   ↓            static + semantic + governance 검증 (ADR-006 §D5, WP2.2)
Validation
   ↓            Entities → Graph/Projection materialize (ADR-005 L3/L4)
Compile / Runtime Projection
   ↓            명시적 Publish = version++ 1회 + Snapshot (ADR-006 §D4)
Published Runtime  ── checkpoint ─▶ persistence store
```

**대체 대상(현재):** `Builder → state.json` (편집=즉시 정본, 무검증, 무격리). 위 분리는 ADR-005(Runtime=materialized, Graph/Projection=derived)와 ADR-006(단일 apply 경계)의 **자연스러운 물리화**다.

---

## 6. 권장 아키텍처 — dev · 앱 편집 · 런타임 실행 · 미래 AI 편집 동시 지원

```text
                 ┌────────────────────────── Navigation Engine (Single Writer, ADR-005 §D4) ──────────────────────────┐
 Human Builder ──▶ Edit Session A ─▶ Working Copy A ─┐                                                                 │
 Business User ──▶ Edit Session B ─▶ Working Copy B ─┤   propose Change Set (baseVersion)                              │
 AI Assistant  ──▶ Edit Session C ─▶ (proposed CS)  ─┤─▶ validate(static+semantic+governance) ─▶ dry-run/preview Diff │
 Developer     ──▶ dev server ─▶ dev-local runtime  ─┘                                                                 │
                                                        ─▶ baseVersion 검사 ─(conflict→rebase/re-propose)              │
                                                        ─▶ atomic apply ─▶ version++1회 ─▶ inverse(undo) ─▶ Snapshot   │
                                                        ─▶ Publish ─▶ Published Runtime ─▶ persistence checkpoint      │
                 └──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

핵심 규칙:
- **저장소 3분리**: repo seed(불변) · Published Runtime store(앱-writable, 시드와 별개) · Working Copy(세션 격리). **dev 서버는 dev-local store에만 write** → 커밋 시드 오염 종식.
- **단일 write 경계**: 모든 변이·publish는 Navigation Engine만(ADR-005 §D4).
- **Change Set = 유일 채널** + **baseVersion 낙관적 동시성**(ADR-006 §D2·§D3). last-write-wins 금지.
- **AI = Proposer**: `status:"proposed"` Change Set을 Working Copy baseVersion에 대해 생성, 사람 확인 후 apply(ADR-006 §D8).
- **Publish에서만 canonical 전이** + **Snapshot**(복구점).
- **Locking 대신 낙관적 동시성**: 편집을 막지 않고 충돌을 감지·표면화(Figma/Notion 모델).

---

## 7. 최소 아키텍처 마일스톤 (Minimal Milestone)

"개발자와 업무 사용자가 동시에 작업 가능"이라 말하려면 **아래 3개면 충분**하다(그 이상은 후속).

1. **저장소 역할 분리** — 실행 중 앱이 추적 시드(`public/process-data/state.json`)를 **절대 덮어쓰지 않도록** Published Runtime store를 분리하고, **dev 서버는 dev-local store에만 write**. → 리스크 2 제거(사고 클래스 종식).
2. **단일 write 경계 + Save Guard(baseVersion)** — 전체-파일 무조건 덮어쓰기를 **거부**하고, `baseVersion !== runtime.version`이면 **CONFLICT 반환**. (완전한 Change Set 세분화 이전이라도 write 게이트부터.) → 리스크 1·4 제거.
3. **Working Copy 격리 + 명시적 Publish** — Builder 편집은 격리 draft에서 일어나고, 검증된 Publish로만 canonical 전이. → 리스크 3 제거.

> Locking·실시간 merge·지속 undo·다중 사용자 실시간 협업은 **최소 바 밖**(후속 단계). 최소 바의 본질은 "**격리 + 충돌 거부 + 명시적 publish**"다.

---

## 8. Phased Roadmap

| 단계 | 목표 | 산출물 | ADR/WBS 정합 |
|---|---|---|---|
| **Phase 2A — Isolation & Save Guard** | 사고 클래스 종식 | 저장소 3분리, dev-local store, baseVersion save guard(전체-파일 거부) | ADR-005 §D1·§D4, ADR-006 §D2 |
| **Phase 2B — Working Copy & Change Set** | 편집 격리 + 변경 채널 | Edit Session/Working Copy, Change Set apply 경계(Phase 5 WBS WP5), Publish+Snapshot | ADR-006 §D1·§D3·§D4 |
| **Phase 2C — Conflict & Recovery** | 충돌 UX + 복구 | rebase/re-propose 흐름, persisted undo/redo, backup/recovery | ADR-006 §D2·§D7 |
| **Phase 2D — AI Concurrent Editing** | AI 동시 편집 | AI=proposed Change Set(세션별 Working Copy), 사람 confirm | ADR-006 §D8 |
| **Phase 2E — Realtime Multi-user (Later)** | Figma급 실시간 병합 | CRDT/OT 등 merge, presence | **명시적 연기** |

> Phase 2A가 **가장 급한 방어선**이며 단독으로도 "실행 중 앱이 커밋 데이터를 훼손"하는 최악 사고를 막는다. Phase 2B가 "동시 편집 가능"의 실질을 연다.

---

## 9. Definition of "Concurrent Editing Ready"

아래 **전부** 참일 때에만 "개발자와 업무 사용자가 동시에 작업 가능"이라 선언한다.

- [ ] **C1. 시드 불가침** — 실행 중 애플리케이션이 repo에 커밋된 샘플/시드 데이터를 어떤 경로로도 덮어쓰지 못한다.
- [ ] **C2. 단일 write 경계** — 모든 런타임 변이·publish가 Navigation Engine 하나를 통과한다(다중 writer 소스 제거).
- [ ] **C3. 충돌 거부** — 저장/apply가 `baseVersion`을 검사하고, stale이면 last-write-wins가 아니라 **CONFLICT로 거부**한다.
- [ ] **C4. 편집 격리** — Builder 편집은 Working Copy에서 일어나고, canonical Runtime은 검증된 **명시적 Publish로만** 바뀐다.
- [ ] **C5. dev ↔ user 분리** — dev 서버를 켠 개발자와 앱에서 편집하는 업무 사용자가 **서로 다른 store**에서 동작하며 상호 clobber가 불가능하다.
- [ ] **C6. 복구 가능** — 모든 publish가 복구 가능한 Snapshot을 남긴다.
- [ ] **C7. AI 격리** — AI 편집은 baseVersion에 대한 **제안(proposal)**이며 동일 경계로만 적용된다.

**현재 충족: 0 / 7.** (C3의 재료인 content version만 존재.) 최소선인 **C1·C3·C4**가 Phase 2A+2B의 게이트다.

---

## 10. 기존 ADR과의 관계 · 다음에 비준할 것

- ADR-005/006은 **C2·C3·C4의 원칙을 이미 결정**했다. 본 리뷰는 그 위에 **두 개의 신규 결정**을 요청한다:
  1. **저장소 역할 분리(seed / published runtime / working copy)** — ADR-008 후보.
  2. **Working Copy · Edit Session · Publish 경계** — ADR-009 후보(또는 ADR-006 확장).
- 이후 구현은 Phase 5 WBS(WP5 Change Set)와 본 로드맵(Phase 2A~2D)을 **정렬**해 진행한다.

## 11. Guardrails / Non-goals (본 리뷰)

- 코드·런타임·샘플데이터 **무변경**, PR **없음** — 문서만.
- 실시간 다중 사용자 병합(CRDT/OT)은 **본 단계 범위 밖**(Phase 2E).
- Pessimistic locking을 canonical 동시성 모델로 채택하지 않는다(낙관적 동시성 우선).
- 프로세스 흐름·ERP 화면 모델을 재설계하지 않는다(ADR-007 guardrail 상속).

## Related
- [ADR-005 Navigator Runtime Model](../06_Decisions/ADR-005-Navigator-Runtime-Model.md) §D1·§D4·§D8
- [ADR-006 Change Set Architecture](../06_Decisions/ADR-006-Change-Set-Architecture.md) §D2·§D3·§D7·§D8
- [ADR-007 Data-first Approval & Governance](../06_Decisions/ADR-007-Data-first-Approval-and-Runtime-Governance-Layer.md)
- [Phase 5 WBS](../08_Implementation/Phase-5-Navigator-Runtime-ChangeSet-WBS.md) — WP5 Change Set MVP
