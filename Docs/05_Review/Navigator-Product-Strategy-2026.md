# Navigator Product Strategy — 2026

|Field|Value|
|---|---|
|Role|Chief Product Architect — Strategy Declaration|
|Status|**Current Strategy** (canonical). 이 문서 = **WHY**(전략·원칙). **WHEN/WHAT**(언제·무엇)은 [Navigator Roadmap v1.0](../00_Vision/Navigator-Roadmap-v1.0.md) 참조|
|Date|2026-07-10|
|Baseline|main `1decb2d` (green: tsc 0 · build 0 · vitest 174 · eslint src 0 errors · open PRs 0)|
|Supersedes intent|"계속 개발" 단일 모드 → **Demo Track / Platform Track 분리 운영**|

> 이 문서는 코딩 작업이 아니다. **지금부터 Navigator를 어떻게 개발할지**를 선언한다. 핵심 전환: Navigator는 더 이상 단순 React 앱이 아니라 **Enterprise Process Operating Platform으로 성장 중**이다. 그러나 중간검토는 **연구 프로토타입이 아니라 안정된 제품**을 요구한다. 두 목표를 동시에 최적화하기 위해 **트랙을 분리**한다.

---

## 0. Official Version Scheme (선언)

이제부터 **모든 기능은 "어느 버전에 속하는가?"로 판단**한다.

```text
Navigator v0.9  — Mid-term Demo          (안정 데모 · feature freeze 대상)
      ↓
Navigator v1.0  — Internal Beta          (Working Copy · Change Set · Publish · Validation Gate · Builder Validation)
      ↓
Navigator v2.0  — Process Operating Platform (Execution Runtime · Approval Runtime · Simulation · enterprise integration · monitoring · operational governance)
      ↓
Navigator v3.0  — Enterprise AI Platform (AI process generation · Knowledge Graph · Agent Runtime)
```

> **교정(중요):** Working Copy · Change Set · Publish는 **v1.0 Internal Beta** 능력이다(이전 초안의 v2.0 배치를 바로잡음). 다중 편집자·운영 런타임은 v2.0으로 남는다.

### Version · Milestone · Definition of Done

| Version | Milestone | Definition of Done (이 버전이 "끝났다"의 기준) |
|---|---|---|
| **v0.9** | **Demo Ready** | Workflow Assignment 완료 · Builder 완료 · Save 완료 · Demo 가능 |
| **v1.0** | **Internal Modeling Ready** | Working Copy · Publish · Validation Gate · Builder Validation |
| **v2.0** | **Operating Ready** | Execution Runtime · Approval · Simulation |
| **v3.0** | **AI Ready** | AI process generation · Knowledge Graph · Agent Runtime |

이 기준선(버전 + Milestone + DoD)이 향후 우선순위를 흔들리지 않게 한다. 각 기능은 **"어느 버전인가?"** 로 판단하고, 각 버전은 **DoD 충족 시 종료**한다.

---

## 1. Current Capability Assessment (근거: [Development Baseline Review 2026-07](Development-Baseline-Review-2026-07.md))

> 주의: 현재 저장(dev-only vite plugin·인증/서버 없음)이라 **엄밀한 의미의 "production-quality"는 아직 없다.** 아래 "안정(데모 신뢰 가능)"은 데모에서 믿고 쓸 수 있는 성숙도를 뜻한다.

| 등급 | 능력 |
|---|---|
| **안정 (Demo-신뢰 가능)** | Process modeling · Workflow-first Navigation · Header IA · Runtime Persistence(WP1) · dev-local 격리 + Save Guard(**단일 편집자**) · Builder 편집(대부분) |
| **Demo-quality (경미 보완 필요)** | Builder **생성 시 workflowId 무결성**(현재 "미분류" fallback으로 감) · 데모 시나리오/버그/UI polish |
| **실험적/미배선** | Governance Runtime Validation(구현됐으나 **미배선**) · Governance 타입(inert) · RuntimeState(dangling 타입) |
| **Architecture-only / 미구현** | Change Set(ADR-006) · Working Copy · Publish · Execution/Approval/AI Runtime · multi-view · URL/bookmark · Lifecycle filter |
| **진짜 Production** | **없음** (서버/인증/published runtime 부재) |

---

## 2. Recommended Product Split

```text
                    Navigator (main = 통합선)
              ┌───────────────┴───────────────┐
         Demo Track                       Platform Track
    (Navigator v0.9)                  (Navigator v1.0 → v3.0)
    목표: 안정·명료·신뢰            목표: 아키텍처·확장성·엔터프라이즈
    ─ 편집 안정성                   ─ Working Copy / Publish
    ─ Workflow 모델링·탐색          ─ Change Set / Execution Runtime
    ─ Runtime Persistence           ─ Approval Runtime
    ─ Governance "정합성 점검"(읽기) ─ AI Runtime / Knowledge Graph
    ─ Usability / UI polish         ─ Simulation / Enterprise Integration
    ─ Demo 시나리오 / Bug fix
    금지: 대형 아키텍처 변경·실험 런타임·실행엔진·publish·AI
```

- **Demo Track = 우선순위 1 (중간검토).** 새 아키텍처 도입 금지, 안정화·연마만.
- **Platform Track = 장기.** ADR 기반 아키텍처 진화. Demo freeze 이후 본격화.

---

## 3. Feature Classification (Demo / Platform / Deferred / Remove)

| 기능 | 분류 | 근거 |
|---|---|---|
| Process modeling (node/edge/lane/zone) | **Demo** | 안정, 데모 핵심 |
| Builder editing (add/edit/clone/save) | **Demo** | 단, 생성 workflowId 무결성 보완 후 |
| Workflow-first Navigation (ADR-008 Phase1) | **Demo** | 확립됨 |
| Header IA | **Demo** | 완료 |
| Runtime Persistence (WP1) | **Demo** | 안정 |
| dev-local 격리 + Save Guard (단일) | **Demo** | 데모=단일 편집자 |
| Governance Runtime Validation | **Platform** | 미배선. 데모엔 **읽기전용 "정합성 점검" 표면**으로만 선택 노출(연마), 강제 차단 금지 |
| Governance Type Model | **Platform** | additive 유지, 데모 비핵심 |
| Lifecycle **badge** | **Demo** | 이미 존재 |
| Lifecycle **filter/facet** | **Deferred** | ADR-008 Phase2 |
| URL/bookmark navigation | **Platform** | v1.0 |
| Working Copy / Publish | **Platform** | **v1.0** |
| Change Set (ADR-006) | **Platform** | **v1.0 기반** |
| Builder Validation / Validation Gate | **Platform** | **v1.0** |
| Execution / Approval Runtime | **Platform** | **v2.0** |
| AI Runtime | **Platform** | **v3.0** |
| "미분류 Workflow" fallback | **Demo (유지)** | 예외 탐지 안전망. Remove 아님 |
| 임시 제목 파싱(`~→→`/variant) | **Demo (유지) · Platform 이전** | 데모 동작. 데이터모델(workflow.name/variant/start/end)로 이전은 Platform |
| `buildDetailWorkflowSections` (미사용 legacy) | **Deferred** | Phase2 facet 재사용 예정 — 그때까지 보류, 근시일 미사용 시 **Remove 후보** |

> **Remove 즉시 대상**: 현재 없음(치명적 dead code 없음). 미사용 legacy builder만 조건부 Remove 후보.

---

## 4. Recommended Freeze Point — Navigator Demo v0.9

**v0.9 최소 기능 집합 (이 집합 달성 = feature freeze):**
1. Workflow-first Navigation (안정) — ✅ 이미 충족
2. Process modeling + Builder editing — ✅, 단 **생성 시 workflowId 할당**(WP-A) 완료 필요
3. Runtime Persistence + dev-local 격리 + Save Guard (단일 편집자) — ✅
4. (선택) Governance **읽기전용 정합성 점검** 표면 — 강제 차단 없이
5. Usability / UI polish + **데모 시나리오** + **버그 픽스** 통과
6. CI 위생 그린(eslint `.claude` 갭 해소)

**freeze 이후 Demo Track 허용 = 버그픽스·문구·UI polish뿐.** 아키텍처·런타임·publish·AI는 **금지**.

**Freeze 게이트 = WP-A(workflowId 무결성) + WP-B(안정화/위생/시나리오) 완료 시점.**

---

## 5. Platform Roadmap

| 버전 | Milestone | 목적 | 대표 능력 |
|---|---|---|---|
| **v0.9 Mid-term Demo** | **Demo Ready** | 중간검토용 **안정 데모** | Workflow-first 탐색 · 모델링 · dev-local 저장 · Save Guard(충돌감지) · 정합성 점검(읽기) |
| **v1.0 Internal Beta** | **Internal Modeling Ready** | **통제된 내부 모델링** + 플랫폼 기반 | **Working Copy · Change Set · Publish · Validation Gate · Builder Validation** · URL/bookmark 정체성 · 데이터모델 정리 (ADR-005/006 이행, Safe-Concurrent-Editing C1~C7) |
| **v2.0 Process Operating Platform** | **Operating Ready** | **다중 편집자·운영 플랫폼** | **Execution Runtime · Approval Runtime · Simulation** · 서버 runtime · enterprise integration · monitoring · operational governance (ADR-007 이행) |
| **v3.0 Enterprise AI Platform** | **AI Ready** | **엔터프라이즈 AI** | **AI process generation · Knowledge Graph · Agent Runtime** · 인증/멀티테넌시 |

> 상세 일정·WP 매핑(WHEN/WHAT)은 [Navigator Roadmap v1.0](../00_Vision/Navigator-Roadmap-v1.0.md). 본 표는 전략적 개요(WHY)다.

---

## 6. Development Policy (운영 규칙)

**Demo Track**
- **허용**: 버그픽스, UI/문구 polish, 사용성 개선, 데모 시나리오, 소규모 안정화.
- **금지**: 대형 아키텍처 변경, 신규/실험 런타임, 실행엔진, publish, AI, 스키마 변경.
- **머지 조건**: green(tsc/build/test/lint) + **아키텍처 무변경** 확인.

**Platform Track**
- 아키텍처 실험은 **feature 브랜치 또는 worktree에 격리**(main 직접 금지). 필요 시 **feature flag** 뒤.
- main 머지 조건: green + **ADR 근거** + 리뷰. 각 변경은 v1.0/v2.0/v3.0 중 하나에 명시적으로 귀속.
- Platform 대형 작업은 **Demo freeze 이후** 본격 진행(데모 안정 우선).

**브랜치 관리**
- `main` = 통합선(green 유지).
- **Demo freeze 시 `release/navigator-0.9`** 를 green main에서 컷 → 이후 버그픽스만 cherry-pick/직접.
- Platform 작업 = `feat/*` → PR → main. 실험 = 격리 브랜치/worktree.
- 규칙: **모든 PR은 "어느 버전?"과 "Demo인가 Platform인가"를 명시.**

---

## 7. Technical Debt Triage

**Demo 이전 반드시 해결 (v0.9 게이트):**
- **T1. 생성 workflowId 무결성** — 신규 blank가 "미분류"로 감(fallback의 생성경로화). Builder 신뢰의 핵심. (WP-A, 진행 중 task_089df70c)
- **T2. CI 위생** — eslint가 `.claude/worktrees` 스캔해 429 false errors. `globalIgnores`에 `.claude` 추가(소규모).
- **T3. 지식 등재** — 리뷰 문서 4개(Architecture-Review, Phase-2A-Plan, Sidebar-IA-Analysis, Baseline-Review) 미커밋 → 데모 전 repo 이력화.
- **T4. 데모 시나리오·버그·UI polish** 패스.

**Platform까지 대기 가능:**
- content `version` vs `revision` 역할 정리 → **v1.0**(Change Set 도입 시).
- RuntimeState dangling 타입 처분 → governance runtime(v2.0).
- 임시 제목 파싱 → 데이터모델화(v1.0/v2.0).
- 미사용 legacy builder → Phase2 facet(v1.0+).
- 9 react-hooks warnings 재설계 → 상시(저우선).
- Governance validation 배선 → v1.0(비차단 피드백).

---

## 8. Next 3 Work Packages (비즈니스 가치 순 — 중간검토 기준)

1. **WP-A · Workflow Assignment Integrity** *(가치 최상 · 진행 중 task_089df70c)*
   - 생성/복제 시 workflowId 할당, "미분류"를 예외탐지 전용화. → **데모 신뢰의 전제**. 저위험.
2. **WP-B · Demo Stabilization & Freeze (v0.9)**
   - T2(eslint `.claude`) + T3(리뷰 문서 등재) + T4(데모 시나리오·버그·UI polish) → **v0.9 freeze**. 중간검토 직접 준비.
3. **WP-C · Change Set / Working Copy MVP** *(Platform **v1.0** 기반 · Demo freeze 이후)*
   - Navigation Engine apply 경계 + Working Copy + baseVersion + Publish. → ADR-005/006 이행, Internal Modeling Ready(v1.0)의 축.

> 순서: **WP-A → WP-B(→ v0.9 freeze) → (중간검토) → WP-C**. Governance 실행·AI·multi-view는 그 이후 버전.

---

## 9. Guiding Principle
- **Demo Track**: 안정성 · 명료성 · 신뢰성 우선. "무제한 기능 개발"을 하지 않는다.
- **Platform Track**: 아키텍처 · 확장성 · 미래 엔터프라이즈 역량 우선.
- Navigator는 Enterprise Process Operating Platform으로 진화하되, **중간검토는 안정 제품(v0.9)으로 대응**한다 — 두 목표를 트랙 분리로 동시 최적화.

## Related
- [Development Baseline Review 2026-07](Development-Baseline-Review-2026-07.md) (능력·리스크 근거)
- [Navigator Roadmap v1.0](../00_Vision/Navigator-Roadmap-v1.0.md) (WHEN/WHAT — 이 전략의 실행 로드맵)
- [Architecture Review — Safe Concurrent Editing](Architecture-Review-Safe-Concurrent-Editing.md) (**v1.0** C1~C7)
- ADR [005](../06_Decisions/ADR-005-Navigator-Runtime-Model.md) · [006](../06_Decisions/ADR-006-Change-Set-Architecture.md) · [007](../06_Decisions/ADR-007-Data-first-Approval-and-Runtime-Governance-Layer.md) · [008](../06_Decisions/ADR-008-Navigation-Architecture-Workflow-First.md)
