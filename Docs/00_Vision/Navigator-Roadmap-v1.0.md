# Navigator Roadmap — v1.0 track

|Field|Value|
|---|---|
|Role|Product Roadmap (WHEN / WHAT)|
|Status|**Current Roadmap**|
|Date|2026-07-10|
|Baseline|main `1decb2d` (green · open PRs 0)|
|Pairs with|[Navigator Product Strategy 2026](../05_Review/Navigator-Product-Strategy-2026.md) (**WHY**)|

> **Strategy = WHY**(왜 이렇게 만드나), **Roadmap = WHEN / WHAT**(언제 무엇을 만드나). 이 문서는 실행 기준이다. 각 버전은 **Definition of Done 충족 시 종료**한다.

---

## 0. Document Relationship (Why → What → How)

문서 체계는 아래 한 줄로 이해한다. 상위는 **왜**, 하위는 **어떻게**다.

```text
Vision            왜 존재하는가            (Navigator = Enterprise Process Operating Platform)
   │
   ▼
Product Strategy  무엇을 어떤 원칙으로      (Docs/05_Review/Navigator-Product-Strategy-2026.md · WHY)
   │
   ▼
Roadmap           언제 무엇을 (이 문서)     (버전 · Phase · Milestone · DoD · WP 순서 · WHEN/WHAT)
   │
   ▼
ADR               왜 그렇게 설계했나        (Docs/06_Decisions · 결정의 정답 · 읽는 순서=README 관계도)
   │
   ▼
Implementation    실제 코드/WBS            (Docs/08_Implementation · 코드 · HOW)
```

> 신규 개발자는 위→아래로 읽는다: Vision/Strategy로 방향을 잡고 → Roadmap으로 순서를 알고 → ADR로 설계 근거를 이해하고 → Implementation으로 코드를 본다.

### Navigator 진화 방향 (Capability Evolution)

```text
Architecture → Modeling → Builder → Runtime → Governance → Execution → AI
 (기반 설계)   (프로세스)  (편집)    (저장/동시성) (승인/규칙)  (실행)      (에이전트)
```

이 축이 버전(v0.9→v3.0)과 Phase(Modeling→Builder→Runtime→AI)를 관통한다.

---

## 1. Version · Phase · Milestone · Definition of Done

| Version | Phase | Milestone | Definition of Done (종료 기준) | Track |
|---|---|---|---|---|
| **v0.9** | **Modeling** | **Demo Ready** | Workflow Assignment 완료 · Builder 완료 · Save 완료 · Demo 가능 | Demo |
| **v1.0** | **Builder** | **Internal Modeling Ready** | Working Copy · Publish · Validation Gate · Builder Validation | Platform |
| **v2.0** | **Runtime** | **Operating Ready** | Execution Runtime · Approval · Simulation | Platform |
| **v3.0** | **AI** | **AI Ready** | AI process generation · Knowledge Graph · Agent Runtime | Platform |

> **공통 언어**: 앞으로 **Phase · Version · WP**는 같은 축을 쓴다 (예: "Builder Phase = v1.0 = WP-C/WP-D").

> **버전 배치 정정(중요):** Working Copy · Change Set · Publish는 **v1.0**이다. 다중 편집자·운영 런타임은 v2.0.

---

## 2. Now → Next Sequence (실행 순서)

```text
1. Product Strategy 정정            ✅ (버전 재배치 + Milestone + DoD)
2. Docs Curation                    ✅ (Historical/Current/Snapshot 배너 + ADR 관계도)
3. Documentation PR                 ▶ (전략 + 리뷰 + Historical + Roadmap 등재)
4. WP-A  Workflow Assignment Integrity   (진행 중 · task_089df70c)
5. WP-B  Demo Stabilization
6. ▶ release/navigator-v0.9  (Feature Freeze)
7. Platform Roadmap 착수 (v1.0)
```

---

## 3. v0.9 — Demo Ready (근거리 · 최우선)

**목표**: 중간검토용 안정 데모. 단일 편집자, dev-local.

| WP | 내용 | DoD 기여 |
|---|---|---|
| **WP-A · Workflow Assignment Integrity** *(진행 중)* | 신규 생성/복제 시 `workflowId` 할당, "미분류 Workflow"=예외 탐지 전용 | Workflow Assignment 완료 |
| **WP-B · Demo Stabilization** | eslint `globalIgnores`에 `.claude` 추가(CI 위생) · 데모 시나리오 · 버그 픽스 · UI polish · 리뷰 문서 등재 | Demo 가능 |

- 이미 충족: Workflow-first Navigation · Runtime Persistence · dev-local 격리 · **Save Guard(충돌 감지)**.
- **Freeze 게이트**: WP-A + WP-B 완료 → green main에서 `release/navigator-v0.9` 컷 → 이후 **버그픽스만**.

## 4. v1.0 — Internal Modeling Ready (Demo freeze 이후)

**목표**: 통제된 내부 모델링 + 플랫폼 기반. 이것이 [Safe-Concurrent-Editing](../05_Review/Architecture-Review-Safe-Concurrent-Editing.md) **C1~C7** 충족선.

| WP | 내용 | ADR |
|---|---|---|
| **WP-C · Change Set / Working Copy MVP** | Navigation Engine apply 경계 + Working Copy(draft) + `baseVersion` 충돌 + **Publish** | ADR-005 · ADR-006 |
| **WP-D · Validation Gate + Builder Validation** | governance validation을 편집/저장에 **배선**(게이트), 생성 전 검증 | ADR-007 · WP2.2 |
| **WP-E · Navigation Identity** | URL/bookmark 정체성 도입(현재 state 기반) | ADR-008 Phase3 일부 |
| **WP-F · Data-model 정리** | content `version` vs `revision` 정리, 제목 파싱→`workflow.name/variant/start/end` | 부채 정리 |

## 5. v2.0 — Operating Ready

Execution Runtime · Approval Runtime · Simulation · 서버 runtime · enterprise integration · monitoring · operational governance. (ADR-007 실행 계층 이행, 다중 편집자·운영.)

## 6. v3.0 — AI Ready

AI process generation · Knowledge Graph · Agent Runtime · 인증/멀티테넌시. (ADR-006 §D8 propose/apply 실현.)

---

## 7. Track & Branch Rules (운영)
- **Demo Track(v0.9)**: 버그픽스·UI polish만. 아키텍처/런타임/publish/AI **금지**. `release/navigator-v0.9`는 freeze 후 버그픽스만.
- **Platform Track(v1.0+)**: `feat/*` → PR → main(green + ADR 근거). 실험은 브랜치/worktree/flag로 격리. Demo freeze 이후 본격화.
- **모든 PR**: "어느 버전(v0.9~v3.0)" + "Demo/Platform" 명시.

## Related
- [Navigator Product Strategy 2026](../05_Review/Navigator-Product-Strategy-2026.md) (WHY)
- [Development Baseline Review 2026-07](../05_Review/Development-Baseline-Review-2026-07.md) (현재 스냅샷)
- [Architecture Review — Safe Concurrent Editing](../05_Review/Architecture-Review-Safe-Concurrent-Editing.md) (v1.0 C1~C7)
- ADR [005](../06_Decisions/ADR-005-Navigator-Runtime-Model.md) · [006](../06_Decisions/ADR-006-Change-Set-Architecture.md) · [007](../06_Decisions/ADR-007-Data-first-Approval-and-Runtime-Governance-Layer.md) · [008](../06_Decisions/ADR-008-Navigation-Architecture-Workflow-First.md)
