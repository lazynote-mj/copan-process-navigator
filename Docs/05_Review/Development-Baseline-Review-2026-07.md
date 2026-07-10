# Development Baseline Review — 2026-07

> **📸 CURRENT SNAPSHOT (2026-07 · main `1decb2d`).** 특정 시점의 개발 상태 스냅샷이다. 능력·리스크·부채 판정은 이 시점 기준이며, 상태 변화 시 새 스냅샷으로 갱신한다.

|Field|Value|
|---|---|
|Role|Chief Architect · Product Architecture Review|
|Status|Review (analysis only — no code/data/config/PR changes)|
|Date|2026-07-10|
|main HEAD|`1decb2d` (== origin/main)|
|Scope|다음 구현 페이즈 이전의 전체 개발 베이스라인 점검. 저장소 증거 기반, 추측 배제.|

> 모든 판정은 저장소 실측에 근거한다. "구현됨"은 코드+테스트 증거가 있을 때만 표기한다.

---

## 1. Verified Repository State (실측)

| 항목 | 값 (증거) |
|---|---|
| current branch | `main` |
| local vs origin | `main == origin/main` @ `1decb2d` (동기화됨) |
| working tree | clean except **3 untracked** review docs (`Docs/05_Review/{Architecture-Review-Safe-Concurrent-Editing, Phase-2A-Runtime-Edit-Safety-Implementation-Plan, Sidebar-IA-Analysis-Workflow-Variant}.md`) |
| worktrees | 2개 — 메인 + `.claude/worktrees/elated-driscoll-0c197e` @`a9973c2` (병렬 백그라운드 작업, **미개입**) |
| open PRs | **0** |
| tsc `-b --force` | **exit 0** |
| `npm run build` | **exit 0** |
| `vitest run` | **15 files / 174 tests pass** |
| `eslint src` | **0 errors, 9 warnings**(react-hooks; AppLayout×4·ProcessMapCanvas×2·DetailViewport·OverviewViewport·processDataStore) |
| `eslint .` | **429 errors** — **전부 `.claude/worktrees` 병렬 워크트리**(`multiple candidate TSConfigRootDirs` 파싱). `eslint . --ignore-pattern ".claude/**"` = 0 errors. **실코드와 무관**(§7 debt) |
| dev server | 5173 **running**(PID 14616, 병렬 작업 추정 — 미개입) |
| `state.json` | tracked, 마지막 실변경 `db95648` (#17). 최근 7개 페이즈에서 **무변경** |
| `state.local.json` | **549,363 bytes, untracked, gitignored** (dev-local runtime) |

최근 15 커밋: `1decb2d WP2.2` → `a9973c2 Nav Phase1` → `71aa8b0 ADR-008` → `46e7bce Phase2A.2` → `8c7415e WP2.1` → `3274663 header` → `948cf42 tsconfig fix` → `ba1479a Phase2A.1` → `ca3b2cf ADR-007` → `a5ae3a8 WP1` → (Phase5 WBS, ADR-006/005/004/003).

---

## 2. Capability Matrix

| 영역 | 상태 | 증거/비고 |
|---|---|---|
| Process modeling | **Implemented** | ProcessInstance(nodes/edges/lanes/zones), 28 processes seed |
| Builder editing | **Partially implemented** | 추가/편집/복제/저장 동작. 단, 신규 생성 시 `workflowId` 미할당(§5) |
| Persistence | **Implemented** | WP1 — schemaVersion/content version, forward-only migration, roundtrip(테스트) |
| Concurrent save safety | **Partially implemented** | Phase2A.1 저장소 격리 + 2A.2 optimistic Save Guard(server `revision`, 409). **단일 편집자만 안전**; 동일 `state.local.json` 다중 세션은 감지만(merge/Working Copy 없음) |
| Runtime validation | **Partially implemented** | router validation은 save에 **배선**(validatePreExport). governance validation(WP2.2)은 **standalone·미배선** |
| Governance model | **Architecture only + types** | ADR-007 Proposed, WP2.1 additive 타입, 실행 없음 |
| Approval execution | **Not implemented** | resolver/route 실행/상태전이 없음 |
| Workflow navigation | **Implemented** | ADR-008 Phase1 — Workflow-first Sidebar(canonical `workflows[]` 순서, badge, 미분류 fallback) |
| Lifecycle view | **Partially implemented** | badge/metadata로 강등됨. filter/facet 전환은 **미구현**(Phase2 defer) |
| URL/bookmark navigation | **Not implemented** | router 없음, 선택은 state 기반(`detailProcessId`) |
| Working Copy | **Architecture only** | ADR-005/006 개념만 |
| Publish | **Architecture only** | 명시적 publish 경계 없음 |
| Runtime execution | **Not implemented** | 실행 엔진 없음 |
| AI editing | **Not implemented** | ADR-006 §D8 propose 모델 = architecture only |
| AI agent runtime | **Not implemented** | — |

---

## 3. Architecture Alignment Matrix (ADR-005/006/007/008)

### ADR-005 — Navigator Runtime Model
- **핵심 결정**: Runtime 1급, `state.json`=persistence checkpoint, Single Writer(Navigation Engine), content `version` 도입.
- **구현**: content `version`(WP1), state.json=persistence, 앱이 시드 미기록(2A.1).
- **미구현**: Navigation Engine 단일 writer **경계**(현재 `saveRemoteProcessData`+plugin 단일 write 엔드포인트이나 Engine 추상은 없음), Graph(L3) materialize, Projection 계층 명시화.
- **편차/리스크**: content `version`은 **저장마다 증가하지 않는다**(version++는 WP5 몫) → concurrency 토큰으로 부적합 → Phase2A.2가 **별도 `revision`** 을 도입(§4 역할 중복 소지).

### ADR-006 — Change Set Architecture
- **핵심 결정**: 모든 변이는 Change Set으로만, `baseVersion` 충돌, atomic apply, undo/redo, AI propose≠apply.
- **구현**: **Change Set 자체는 미구현**(Phase5 WP5 미착수). `processData.ts`의 "applyChangeSet"은 **주석 참조**뿐.
- **미구현**: Change Set 모델·apply 경계·undo/redo·dry-run·conflict rebase UX.
- **편차/리스크**: 변이는 여전히 직접(`processDataMutations`), command 기반 아님. 2A.2 `revision` 가드는 **파일 경계**의 근사이지 Change Set apply 경계가 아님. undo/redo 없음.

### ADR-007 — Data-first Approval & Governance Layer
- **핵심 결정**: Runtime 위 거버넌스/승인 additive, 승인 대상=레코드, 문서=산출물, RuntimeState 미저장.
- **구현**: 타입(WP2.1) + 구조 검증(WP2.2).
- **미구현**: resolver(WP2.3), 승인 실행, 문서 생성, RuntimeState 런타임.
- **편차/리스크**: 타입·검증이 **실행과 분리·미배선** → WP2.3+ 전까지는 inert. Governance 데이터 인스턴스 시드에 없음.

### ADR-008 — Workflow-first Navigation
- **핵심 결정**: 탐색 기준=Workflow(Lifecycle=View facet), Navigation/View/Execution/Governance/Persistence 계층 분리.
- **구현**: Phase1 Sidebar(Workflow 최상위, 선택=`detailProcessId` 불변).
- **미구현**: Lifecycle filter(Phase2), multi-view+URL/bookmark(Phase3).
- **편차/리스크**: blank 생성이 `workflowId` 없이 "미분류 Workflow" fallback으로 감 → **fallback이 사실상 생성 경로화**될 위험(§5, 별도 WP 필요).

---

## 4. Data-role Review

| 대상 | 역할 (실측) |
|---|---|
| `public/process-data/state.json` | **repo seed / published sample**(커밋 baseline). 실행 중 앱이 **절대 기록 안 함**(2A.1). 마지막 실변경 `db95648`. |
| `state.local.json` | **dev-local runtime 편집 대상**(untracked/gitignored). 서버 소유 top-level `revision` 보유. dev당 **단일 라이브 편집 소스**. |
| `ProcessData` | in-memory Runtime 모델(Masters+Entities+Projections). content `version`, `dirty`(세션 메타, 미저장). |
| `RuntimeState` | 타입만 정의(WP2.1). **미저장·ProcessData 미부착·인스턴스 없음** → dangling 타입. |
| Governance 엔티티 | ProcessData의 additive optional 배열(rules/policies/routes/artifacts). **타입만**, 시드 데이터 인스턴스 없음. |
| validation output | `GovernanceValidationReport`(구조화, 비-mutating, 비-throw). **미배선**. |
| `revision` | Phase2A.2 서버 소유 concurrency 토큰(`state.local.json`). content `version`과 **별개**. |
| document artifacts | 타입만. 생성 없음. |

**역할 모호성 (발견):**
1. **`content version` vs `revision`** — 둘 다 "버전/동시성" 뉘앙스. content version(ADR-005/006 낙관적 동시성 의도)은 미증가, 실제 동시성 토큰은 revision(2A.2). 문서화는 됐으나 **잠재적 개념 중복** → 명시적 정리 필요.
2. **RuntimeState 미사용 dangling 타입** — 정의됐으나 어디서도 인스턴스화 안 됨.
- **긍정**: 라이브 편집의 **단일 source of truth**는 `state.local.json` 하나(중복 없음). seed와 명확 분리.

---

## 5. Builder Integrity Review

| 항목 | 평가 |
|---|---|
| Detail Process 생성 | 동작하나 **신규 blank는 `workflowId` 미할당** → "미분류 Workflow" fallback (`buildNewDetailProcessGroupSelection`은 id/name/description/detailProcessId만) |
| 복제 | `cloneDetailProcess`가 원본 `workflowId`·`lifecycleGroupId` **승계**(Nav Phase1) — 정상 |
| workflowId 할당 | **UI/picker 없음**. JSON/스크립트 또는 복제 승계로만 부여 → **갭** |
| ID 생성 | `slugifyProcessId`(name→slug, 한글 허용) + 유일성 접미사 — 안정적 |
| 참조 무결성 | governance validation이 참조 검사하나 **미배선**(편집/저장에서 미강제). router validation만 save에 배선 |
| 검증 타이밍 | save 시 router validatePreExport만. governance/pre-create 검증 없음 |
| invalid-data 방지 | 부분 — router pre-export 가드가 node/edge 이슈 차단. governance 불변식은 미강제 |
| fallback 동작 | "미분류 Workflow" = **render-only 안전망**(데이터 변형 없음). 단 workflowId 결측 상시화 위험 |

→ **Builder 무결성은 부분 완성.** 최우선 보완: 생성 시 workflowId 할당(진행 중 백그라운드 작업 task_089df70c).

---

## 6. Runtime Maturity (분리 평가 — "Runtime 완성" 단일 라벨 금지)

| 런타임 | 성숙도 |
|---|---|
| **persistence runtime** | **Implemented** (WP1: schemaVersion/version, migration, roundtrip) |
| **validation runtime** | **Partial** — router: 배선됨 / governance: 구현됐으나 **미배선** |
| **execution runtime** | **Not implemented** (Change Set apply·Node 실행 없음) |
| **approval runtime** | **Not implemented** (resolver·route 실행·상태전이 없음) |
| **AI runtime** | **Not implemented** (propose/apply 파이프라인 없음) |

> 결론: **persistence만 성숙**. 나머지 4개는 미배선~미구현. "Runtime complete"로 묶으면 안 됨.

---

## 7. Technical-Debt Register

| # | 항목 | 증거 | 심각도 |
|---|---|---|---|
| D1 | **eslint가 `.claude/worktrees` 스캔** → 429 false errors(`multiple TSConfigRootDirs`). `eslint.config.js`의 `globalIgnores(['dist'])`에 `.claude` 없음 | `eslint .` vs `eslint . --ignore-pattern ".claude/**"` | 중(개발 UX·CI 신뢰성) |
| D2 | **3개 리뷰 문서 미커밋**(Architecture-Review, Phase-2A-Plan, Sidebar-IA-Analysis) → repo 이력에 지식 부재 | `git status` | 중 |
| D3 | **미사용 legacy builder** `buildDetailWorkflowSections`(lifecycle-first) — 어떤 컴포넌트도 미사용(테스트만). Phase2 facet용 보류 | grep(렌더 미참조) | 낮(deferred) |
| D4 | **임시 표시 파싱** — Toolbar 제목 `~→→` + variant `:` 분리 (`Toolbar.tsx:89`) = 휴리스틱. 데이터 모델(workflow.name/variant/startLabel/endLabel)로 이전 필요(ADR-008 기록) | `Toolbar.tsx:89-95` | 중 |
| D5 | **content version vs revision 개념 중복** + **RuntimeState dangling** | §4 | 중 |
| D6 | **테스트 공백** — governance validation의 실데이터 통합 테스트 없음; 생성-fallback 경로 테스트 없음; Save Guard 클라 토큰 lifecycle은 단위만(브라우저 수동) | 코드 | 낮~중 |
| D7 | **9 react-hooks warnings**(기존, improvement-backlog 추적) | `eslint src` | 낮 |
| D8 | 병렬 worktree 위생 — `.claude/worktrees/elated-driscoll-0c197e` 존재(사용자 작업, 미개입) | `git worktree list` | 정보 |

---

## 8. Product Readiness

| 대상 | 준비도 | 기준/블로커 |
|---|---|---|
| **Internal demo** | ✅ **Ready** | Workflow-first 탐색·builder·persistence 동작(단일 편집자). 블로커 없음 |
| **Controlled internal use (단일 편집자)** | 🟡 **Ready with caveat** | dev-local + Save Guard로 데이터 안전. 경미 블로커: 생성 시 workflowId 갭(미분류로 감) |
| **Multiple editors** | 🟥 **Not ready** | 블로커: 동일 `state.local.json` last-write-wins(409는 감지만), Working Copy/merge 없음, 서버 published runtime 없음 |
| **Production use** | 🟥 **Not ready** | 블로커: 저장이 **dev 전용**(vite `configureServer`, prod write 경로 없음), 인증 없음, 서버 runtime/published store 없음, 실행/승인 없음 |
| **Enterprise deployment** | 🟥 **Not ready** | 위 전부 + governance/approval/AI 미구현, 다중 사용자·URL/routing·백엔드 없음 |

---

## 9. Recommended Next 3 Work Packages

1. **WP-A · Workflow Assignment Integrity** *(진행 중: 백그라운드 task_089df70c)*
   - 신규 생성 시 Workflow 선택/자동 할당, 복제 승계 유지, "미분류"를 **예외 탐지 전용**으로. → Builder 무결성(§5) 완성, ADR-008 fallback 리스크 해소. **저위험·고가치.**
2. **WP-B · Baseline Hygiene & Model Reconciliation** *(소규모)*
   - (a) eslint `globalIgnores`에 `.claude` 추가(D1), (b) 3개 리뷰 문서 repo 등재(D2), (c) `content version` vs `revision` 역할 문서 정리 + RuntimeState 처분 결정(D5). → CI/이력/데이터모델 신뢰성 확보.
3. **WP-C · Change Set / Working Copy MVP** *(Phase 5 WBS WP2·WP5)*
   - Navigation Engine 단일 apply 경계 + Working Copy(draft) + baseVersion 충돌 + 명시 Publish. → **ADR-005/006 이행**, 다중 편집자·안전 저장의 실제 기반. (규모 큼 — 다음 milestone 축.)

## 10. Deferred Work Packages
- WP2.3 Approval Policy Resolver / 승인 실행 / 문서 생성(WP2.4) — governance 실행 계층.
- AI editing / AI agent runtime(ADR-006 §D8).
- Lifecycle **filter/facet**(ADR-008 Phase2), **multi-view + URL/bookmark**(Phase3).
- Production/server runtime·인증·published runtime store.
- 9 react-hooks warnings 재설계(D7).

## 11. Next Milestone (권장)

**Milestone: "Trustworthy Single-Editor Baseline" (근거리) → 이후 "Concurrent-Editing-Ready" (원거리)**

- **근거리(권장 즉시)**: WP-A + WP-B 완료 시 정의 — *단일 편집자가 workflowId 무결성·검증 피드백·깨끗한 CI·명확한 데이터 역할 위에서 신뢰성 있게 편집·저장*. 달성 가능·저위험.
- **원거리(축)**: WP-C(Change Set/Working Copy/Publish)로 [Architecture Review — Safe Concurrent Editing]의 **C1~C7("Concurrent Editing Ready")** 충족 — 다중 편집자·publish·복구. ADR-005/006 완성이 이 milestone의 본질.

> 순서 권고: **WP-A(진행) → WP-B(위생) → WP-C(Change Set MVP)**. governance 실행·AI·multi-view는 그 이후.

## Related
- [ADR-005](../06_Decisions/ADR-005-Navigator-Runtime-Model.md) · [ADR-006](../06_Decisions/ADR-006-Change-Set-Architecture.md) · [ADR-007](../06_Decisions/ADR-007-Data-first-Approval-and-Runtime-Governance-Layer.md) · [ADR-008](../06_Decisions/ADR-008-Navigation-Architecture-Workflow-First.md)
- [Architecture Review — Safe Concurrent Editing](Architecture-Review-Safe-Concurrent-Editing.md) (C1~C7 정의) · [Phase 5 WBS](../08_Implementation/Phase-5-Navigator-Runtime-ChangeSet-WBS.md) · [Sidebar IA Analysis](Sidebar-IA-Analysis-Workflow-Variant.md)
