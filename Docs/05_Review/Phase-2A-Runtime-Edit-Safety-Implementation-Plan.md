# Phase 2A — Runtime Edit Safety Guardrails · Implementation Plan

> **🗄️ HISTORICAL — 구현 완료(실행 계획 아님).** 이 계획은 **Phase 2A.1**(#27 `ba1479a`)·**Phase 2A.2**(#30 `46e7bce`)로 **머지 완료**됐다. 본 문서는 당시 구현 계획의 **이력 기록**으로 보존하며, 현재의 실행 계획이나 정본이 아니다. 실제 동작은 병합된 코드/PR을 따른다.

|Field|Value|
|---|---|
|Role|Chief Architect · Minimal Safety Implementation Planning|
|Status|Plan (구현 착수 전 · 승인 대기)|
|Date|2026-07-09|
|Owner|혁신팀|
|Implements (baseline)|[Architecture Review — Safe Concurrent Editing](Architecture-Review-Safe-Concurrent-Editing.md) §7 Minimal Milestone, Phase 2A|
|Related|[ADR-005](../06_Decisions/ADR-005-Navigator-Runtime-Model.md) §D1·§D4, [ADR-006](../06_Decisions/ADR-006-Change-Set-Architecture.md) §D2, [Phase 5 WBS](../08_Implementation/Phase-5-Navigator-Runtime-ChangeSet-WBS.md)|
|Scope|계획 문서 전용 — 코드·vite plugin·`state.json`·샘플데이터·UI·governance 타입 무변경, PR 없음|

> **Phase 2A 목표:** 개발자가 작업하는 동안 **실행 중인 앱이 커밋된 샘플/canonical 데이터(`public/process-data/state.json`)를 실수로 덮어쓰지 못하게** 한다. 런타임/UI 동작은 write 대상만 안전해질 뿐 현행과 최대한 동일하게 유지한다.

---

## 1. 현재 Write/Load 경로 조사 (Findings)

### 1.1 런타임 write 경로 — **단 하나** (그리고 dev 전용)

```text
UI 저장
  → saveRemoteProcessData(data)                     src/data/processDataRemote.ts:24
      · validatePreExport(data)  (node/edge 정합만)  ← version/baseVersion 검사 없음
      · POST /api/process-data   body = 전체 문서    src/data/processDataRemote.ts:41
  → vite-plugin-process-data.ts (configureServer)
      · fs.writeFileSync('public/process-data/state.json', body)   vite-plugin-process-data.ts:44
```

- 이 플러그인은 **`configureServer`(dev 서버 전용)** 이다. `vite build`/`vite preview`에는 `/api/process-data` 핸들러가 **없다** → 프로덕션엔 write 엔드포인트가 아예 없다.
- ⇒ **위험 창(window)은 정확히 `npm run dev` 실행 중**이다. 이는 "개발자가 작업하는 동안"이라는 Phase 2A 문제와 정확히 일치한다.

### 1.2 Load 경로

```text
localJsonProcessStorage.load()                       src/data/processStorageAdapter.ts:20
  → loadRemoteProcessData()                           src/data/processDataRemote.ts:13
      · GET /process-data/state.json?t=<ts>  (Vite가 public/ 정적 서빙)
      · 404 → null,  200 → filePayloadToProcessData(...)
```

- 로드 대상 = **커밋된 시드 파일**과 동일. 저장 대상과 로드 대상이 같은 파일 → 편집이 곧 시드 덮어쓰기.

### 1.3 `public/process-data/state.json`에 write할 수 있는 모든 지점

| # | 지점 | 성격 | Phase 2A 범위 |
|---|---|---|---|
| W1 | `vite-plugin-process-data.ts:44` (POST `/api/process-data`) | **실행 중 앱**의 유일 런타임 writer (dev 전용) | **주 대상** |
| W2 | `scripts/*.mjs` 다수 (`sync-*`, `migrate-*`, `audit-*`, `generate-*`) `fs.writeFileSync(statePath, ...)` | 개발자가 **수동 실행**하는 CLI 마이그레이션 도구 | 범위 밖(의도적) — §참고 |
| W3 | `dist/process-data/state.json` | `vite build`가 `public/` 복사한 산출물(gitignored) | 무관 |

> **W2 주의:** 스크립트들은 의도적으로 시드를 재작성하는 도구다(앱 사고가 아님). Phase 2A는 W2를 막지 않는다. 다만 이 존재가 "`state.json`이 다중 mutation 대상"임을 재확인한다. W2는 개발자가 명시적으로 돌리는 것이므로 "실수 덮어쓰기"가 아니다.

### 1.4 dev-local writable copy 가능 여부 — **가능**

- Vite dev는 `public/`을 **요청 시 디스크에서** 정적 서빙한다 → dev 중 `public/process-data/`에 새로 쓴 파일도 **서버 재시작 없이** 즉시 서빙된다.
- 따라서 런타임 writer가 시드 대신 **untracked local 파일**(예: `public/process-data/state.local.json`)에 쓰고, 로더가 그 파일을 **우선** 읽으면, 시드는 앱이 절대 건드리지 않는 상태로 유지된다.
- `.gitignore`에 이미 `*.local`(13행)이 있으나 이는 `.local`로 끝나는 파일만 매칭한다. `state.local.json`은 `.json`으로 끝나 **매칭되지 않으므로 전용 ignore 라인이 필요**하다.

---

## 2. 리스크 평가 (현재)

| ID | 리스크 | 현재 노출 | Phase 2A 후 |
|---|---|---|---|
| R1 | 실행 중 앱이 **커밋 시드**를 통째 덮어씀(정규화 롤백·git 오염) | **높음** (dev 중 상시) | 제거(2A.1) |
| R2 | 저장 시 **version/baseVersion 무검사** → 동시 writer last-write-wins | 높음 | 완화(2A.2) |
| R3 | seed = editing target = runtime persistence **3중 역할** | 높음 | 부분 해소(seed 분리) |
| R4 | 잘못된 저장의 **복구 수단**이 git뿐 | 중간 | 개선 여지(2A.2 backup) |

> Phase 2A의 1차 목표는 **R1 제거**다. R1은 저장소 분리만으로 완전히 사라진다(version guard 불필요). R2는 2A.2에서 다룬다.

---

## 3. 제안: 최소 저장소 분리 (Phase 2A.1)

### 3.1 아키텍처 (최소)

```text
public/process-data/state.json        ← repo seed / published sample ONLY (앱이 절대 write 안 함, 불변)
public/process-data/state.local.json  ← dev-local RUNTIME (untracked, 앱 write 대상)      [신규·gitignored]

Load  : state.local.json 우선 → 404면 state.json(seed)로 fallback
Save  : 항상 state.local.json 에만 write
```

### 3.2 동작 규칙

- **로드 우선순위:** local(runtime) → seed(fallback). 신규 체크아웃(=local 없음)은 seed를 그대로 로드 → **현행 동작과 동일**.
- **최초 저장 시** local 파일이 생성되고, 이후 로드는 local을 사용. 시드는 그대로.
- **UI/런타임 동작 불변:** 사용자 관점에서 로드/저장 흐름은 동일하고, 물리 write 대상만 안전한 파일로 바뀐다.
- **프로덕션 영향 없음:** write 엔드포인트가 dev 전용이므로 build/preview엔 변화 없음.

### 3.3 seed 재생성(선택, 옵트인)

- 개발자가 "현재 편집을 시드로 승격"하려면 **명시적 CLI/명령**으로만 하도록 남긴다(Phase 2A 범위 밖, 기존 `scripts/*` 계열과 정합). 앱 저장은 절대 시드를 건드리지 않는다.

---

## 4. 제안: Save Guard 동작 (Phase 2A.2)

> R1(시드 보호)과 분리한다. 2A.2는 **runtime 파일에 대한 낙관적 동시성**으로, 규모가 커서 별도 단계로 split 한다(요청된 분할).

### 4.1 최소 Save Guard 계약

- 저장 요청 payload에 **버전 메타데이터**(`schemaVersion` + content `version`/`baseVersion`)가 **없으면 거부**(400).
- 플러그인이 **현재 local 파일의 content `version`을 읽어** 요청의 `baseVersion`과 비교:
  - 일치 → write 허용, (선택) 저장 후 version 처리.
  - 불일치 → **409 CONFLICT** 반환(덮어쓰기 금지). last-write-wins 금지(ADR-006 §D2 정합).
- **backup:** write 직전 기존 local 파일을 `state.local.bak.json`(untracked)로 복사 → R4 완화.

### 4.2 왜 split 하는가

- 2A.2는 (a) 클라이언트가 `baseVersion`을 보내도록 `saveRemoteProcessData` 수정, (b) 플러그인이 read-compare-write 하도록 수정, (c) UI가 409를 처리(재로드/재시도)해야 한다 → **UI·client·plugin 3면 변경**. Phase 2A.1(시드 보호)만으로 **최악 사고(R1)는 이미 제거**되므로, 2A.2는 후속으로 안전하게 분리 가능하다.

---

## 5. 변경 예상 파일 / 변경 금지 파일

### 5.1 변경 예상 (Phase 2A.1)

| 파일 | 변경 |
|---|---|
| `vite-plugin-process-data.ts` | write 대상 `state.json` → `state.local.json` (STATE_FILE 상수). (GET 핸들러 불필요 — Vite 정적 서빙) |
| `src/data/processDataRemote.ts` | `loadRemoteProcessData`에 local-우선 + seed-fallback. `REMOTE_LOCAL_STATE_URL` 상수 추가. save는 동일 API(플러그인이 대상 결정) |
| `.gitignore` | `public/process-data/state.local.json`(및 `*.bak.json`) ignore 라인 추가 |

### 5.2 변경 예상 (Phase 2A.2, 후속)

| 파일 | 변경 |
|---|---|
| `vite-plugin-process-data.ts` | read-compare-write + 409 + backup |
| `src/data/processDataRemote.ts` | 저장 payload에 `baseVersion` 포함, 409 처리 반환 |
| UI 저장 호출부 | 409 CONFLICT UX(재로드/재시도) — 최소 |

### 5.3 변경 금지 (must NOT change)

- `public/process-data/state.json` (seed) — **불변**.
- 샘플/프로세스 데이터 전체.
- UI 컴포넌트(2A.1 한정 — 저장 흐름 시각적 변화 없음).
- `src/types/governance.ts` 및 WP2.1 타입.
- `scripts/*.mjs` (개발자 CLI, 별개 벡터).

---

## 6. Test Plan

### 6.1 Phase 2A.1

- **T-A1-1 시드 불가침(수동/통합):** dev 서버 기동 → 앱에서 편집·저장 → `git status`에 `public/process-data/state.json` **변화 없음**, `state.local.json` 생성. (핵심 회귀)
- **T-A1-2 fresh 로드:** local 파일 없는 상태에서 로드 → seed가 로드됨(현행 동일).
- **T-A1-3 local 우선 로드:** local 존재 시 로드 → local이 사용됨(seed 아님).
- **T-A1-4 순수함수 회귀:** 기존 vitest 144 그대로 green (load/save 순수 로직 불변 — URL 상수만 변경). `filePayloadToProcessData` roundtrip 유지.
- **T-A1-5 프로덕션 무영향:** `vite build` 성공, dist에 write 엔드포인트 없음 확인.

### 6.2 Phase 2A.2

- **T-A2-1 메타 누락 거부:** baseVersion 없는 저장 → 400.
- **T-A2-2 stale 거부:** baseVersion < 현재 → 409 CONFLICT, local 파일 **불변**.
- **T-A2-3 정상 저장:** baseVersion 일치 → write 성공, backup 생성.

> 도구: 순수 로직은 vitest. dev-서버 I/O(플러그인 write 대상)는 수동 통합 체크 또는 경량 노드 스크립트로 확인(무거운 e2e는 지양).

---

## 7. Rollback Plan

- **2A.1 롤백:** `vite-plugin-process-data.ts`의 STATE_FILE을 `state.json`으로 되돌리고 `loadRemoteProcessData` fallback 제거 → 즉시 원복(1커밋 revert). `state.local.json`은 untracked라 repo 영향 없음.
- **데이터 안전:** 롤백해도 시드는 한 번도 앱에 의해 변경되지 않았으므로 손실 없음.
- **2A.2 롤백:** guard 도입 커밋만 revert → 2A.1 상태(시드 보호는 유지)로 복귀.
- 각 단계는 **독립 커밋/PR**로 진행해 부분 롤백 가능.

---

## 8. Definition of Done

### Phase 2A.1 (DoD)
- [ ] 실행 중 앱이 `public/process-data/state.json`을 **어떤 저장 경로로도 write 하지 않는다**(T-A1-1).
- [ ] 앱 저장은 untracked `state.local.json`으로만 간다(gitignored, `git status` 무오염).
- [ ] fresh 체크아웃은 seed를 그대로 로드(현행 동작 보존, T-A1-2).
- [ ] local 존재 시 local 우선 로드(T-A1-3).
- [ ] vitest 144 green, `vite build` 성공.
- [ ] `state.json`·샘플데이터·UI·governance 타입 **무변경**.

### Phase 2A.2 (DoD)
- [ ] baseVersion 누락/불일치 저장이 **거부**(400/409), local 파일 불변.
- [ ] write 직전 backup 생성.
- [ ] 정상 저장 경로 회귀 green.

> **"Concurrent Editing Ready" 대비:** 2A.1은 리뷰 문서의 **C1(시드 불가침)·C5(dev↔user 분리)** 를, 2A.2는 **C3(충돌 거부)** 를 부분 충족한다. C4(Working Copy)·C2(단일 writer)는 Phase 2B(Change Set) 몫.

---

## 9. 구현 순서 권고 & WP2.1과의 관계

### 9.1 Phase 내부 순서
1. **Phase 2A.1 (저장소 분리)** — 최우선. 단독으로 **R1(최악 사고) 제거**. 규모 최소(3파일).
2. **Phase 2A.2 (Save Guard)** — 후속. runtime 파일 낙관적 동시성 + backup.

### 9.2 WP2.1(#26)은 기다려야 하는가? → **아니오 (독립)**

- WP2.1은 **`src/types/*` additive 타입 전용**이고, Phase 2A는 **`vite-plugin` + `processDataRemote` + `.gitignore`**를 만진다 → **파일 중첩 0, 충돌 0**.
- 따라서 **순서 무관**하게 병행 가능하다. WP2.1은 런타임 write 경로와 무관하므로 Phase 2A를 기다릴 이유가 없고, Phase 2A도 WP2.1을 기다릴 이유가 없다.
- 권고: **WP2.1(#26)은 그대로 리뷰/머지 진행**(단, 별도로 추적 중인 pre-existing `tsc -b`(node 타입) 이슈는 그 전에 별건으로 처리 권장). **Phase 2A.1은 승인 즉시 착수**해도 된다. 둘은 서로를 블록하지 않는다.

---

## 10. Guardrails (본 계획 준수)
- 본 문서는 **계획만**이다. src·vite plugin·`state.json`·샘플데이터·UI·governance 타입 **무변경**, PR·머지 없음.
- PR #26을 닫거나 머지하지 않는다.
- Locking 미채택(낙관적 동시성). 실시간 병합은 Phase 2E(범위 밖).

## Related
- 상위 기준선: [Architecture Review — Safe Concurrent Editing](Architecture-Review-Safe-Concurrent-Editing.md)
- 정합: [ADR-005 §D1·§D4](../06_Decisions/ADR-005-Navigator-Runtime-Model.md), [ADR-006 §D2](../06_Decisions/ADR-006-Change-Set-Architecture.md), [Phase 5 WBS](../08_Implementation/Phase-5-Navigator-Runtime-ChangeSet-WBS.md)
