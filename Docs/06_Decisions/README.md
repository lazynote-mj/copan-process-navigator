# Architecture Decision Records (ADR)

|Field|Value|
|---|---|
|Purpose|Navigator의 아키텍처 결정을 기록·추적하는 ADR(Architecture Decision Record) 체계의 인덱스와 규약을 정의한다.|
|Owner|혁신팀|
|Last Updated|2026-07-11|

## 이 폴더의 역할

Navigator는 단순 프로세스 뷰어를 넘어 Canonical Architecture를 갖는 프로젝트로 성장했다. 문서 체계를 소프트웨어 프로젝트 수준으로 계층화한다.

```text
Architecture Principles   ← 무엇을 원칙으로 삼는가        (05_Review/Codex/Navigator-Phase3-Concept.md = Navigator IA)
        ↓
Architecture Decision Records (ADR)  ← 왜 그렇게 설계했는가   (본 폴더)
        ↓
Ratification              ← 무엇을 공식 승인했는가          (ADR-003)
        ↓
Specifications            ← 어떻게 구현할 것인가            (Phase 4.1+ 스키마 명세)
        ↓
Implementation            ← 코드
```

- **ADR = "왜 그렇게 설계했는가"**의 기록. 하나의 결정 = 하나의 파일. 결정은 되돌리지 않고 **Superseded**로 대체한다(이력 보존).
- **Ratification = "무엇을 공식 승인했는가"**의 이벤트. 여러 원칙·결정을 한 시점에 Approved로 확정한다. 본 체계에서는 ADR-003이 이 역할을 한다.

## ADR 상태(Status) 생명주기

```text
Proposed → Accepted → (Superseded | Deprecated)
```

- **Proposed**: 제안됨(검토 중).
- **Accepted**: 채택됨. 공식 비준(Ratification)으로 승격된 경우 Ratified 표기 병기.
- **Superseded**: 후속 ADR로 대체됨(어느 ADR로 대체됐는지 명시).
- **Deprecated**: 더 이상 유효하지 않음.

## ADR 관계도 · 읽는 순서 (Core Lineage)

Navigator 아키텍처의 **핵심 4결정선**은 아래 순서로 읽는다 — 각 ADR은 앞 ADR 위에 세워진다.

```text
ADR-005  Navigator Runtime Model        (Runtime 1급 · state.json=checkpoint · content version)
   │  ↳ 그 Runtime을 "어떻게 변경하나"
ADR-006  Change Set Architecture         (모든 변이는 Change Set · baseVersion · atomic apply)
   │  ↳ 그 Runtime 위에 "무엇을 얹나"
ADR-007  Data-first Approval / Governance (거버넌스·승인 계층 · 승인 대상=레코드 · 문서=산출물)
   │  ↳ 그 Runtime을 "어떻게 탐색하나"
ADR-008  Navigation Architecture         (Workflow-first · Lifecycle=View facet)
```

- **기층(선행 원칙)**: ADR-002 Graph First → ADR-003 Ratification → ADR-004 Schema First.
- **결론 vs 근거**: ADR은 **결론**만 담는다. 배경 분석은 리뷰 문서에 있다 — 예: ADR-008의 근거 = [Sidebar IA Analysis](../05_Review/Sidebar-IA-Analysis-Workflow-Variant.md).
- **신규 개발자 권장 읽기 순서**: `002 → 005 → 006 → 007 → 008`.

## ADR 인덱스

| ADR | 제목 | 상태 | 날짜 | 요약 |
|---|---|---|---|---|
| [ADR-001](ADR-001-Workflow-Variant.md) | Workflow / Variant 모델 도입 | Accepted | 2026-07-08 | 이름 문자열에 암묵 존재하던 Workflow/Variant를 additive 스키마로 명시화 (Model B) |
| [ADR-002](ADR-002-Graph-First.md) | Graph First Architecture | Accepted (Ratified by ADR-003) | 2026-07-09 | Process Graph를 기층으로, Category→Workflow→Variant 트리와 Journey를 그 위의 View로 |
| [ADR-003](ADR-003-Navigator-IA-Ratification.md) | Navigator Architecture Ratification | Accepted | 2026-07-09 | Navigator Information Architecture를 Canonical Architecture로 공식 비준(Phase 4.0 게이트) |
| [ADR-004](ADR-004-Process-Graph-Schema-First.md) | Process Graph Schema First (Phase 4.1 재정렬) | Accepted | 2026-07-09 | Phase 4.1을 Process Graph Schema 우선으로 재정렬. ADR-003 로드맵 표현 보완 |
| [ADR-005](ADR-005-Navigator-Runtime-Model.md) | Navigator Runtime Model | Accepted | 2026-07-09 | ProcessData를 1급 Runtime으로 격상. state.json=persistence checkpoint, Graph=미저장 index, Single Writer, version(콘텐츠) 도입 |
| [ADR-006](ADR-006-Change-Set-Architecture.md) | Change Set Architecture | Accepted | 2026-07-09 | Runtime 변경은 Change Set(명령 집합)으로만. baseVersion·atomic apply·version++1회·validation·conflict·undo/redo·dry-run·AI proposal/user confirm 분리 |
| [ADR-007](ADR-007-Data-first-Approval-and-Runtime-Governance-Layer.md) | Data-first Approval and Runtime Governance Layer | Proposed | 2026-07-09 | Runtime 위에 거버넌스·승인 계층을 additive로 제안. 승인 대상=구조화 레코드(Data-first), 문서=승인 산출물. draft 타입(Governance/Approval/Document/RuntimeState) + WP2.1~2.5 |
| [ADR-008](ADR-008-Navigation-Architecture-Workflow-First.md) | Navigation Architecture (Workflow-first Navigation) | Proposed | 2026-07-10 | Navigator 탐색 기준은 Lifecycle이 아니라 Workflow. Navigation(Workflow→Detail Process)/View(Lifecycle 등)/Execution/Governance/Persistence 계층 분리. Lifecycle을 facet으로 강등. Phase 1~3 |
| [ADR-009](ADR-009-Workflow-Assignment-Integrity.md) | Builder Integrity — Workflow Assignment | Accepted | 2026-07-10 | Builder 데이터 생성 규칙: 신규 Detail Process 그룹은 Workflow 필수 소속(컨텍스트 자동승계 + 컨텍스트 없으면 Property Panel Workflow picker 강제). "미분류 Workflow" fallback을 예외 데이터 감지기로 고정. Validation→발견에서 Builder→생성 방지로 전환. ADR-008 §5·§6 후속 |
| [ADR-010](ADR-010-Navigator-Menu-UX-Principles.md) | Navigator 메뉴 트리 UX 설계 원칙 | Accepted | 2026-07-11 | 메뉴 트리의 UI 표현·상호작용 규범(P1–P10): 데이터/표현 분리, Workflow 중심, Single-Variant 숨김(Option A 비준: 단일 Variant는 라벨 무관 Leaf 평탄화), Progressive Disclosure, 조건부 Expand, 클릭 최소화. 데이터 모델 무변경. G1·G2·G3 구현 해소, G4 성능 백로그 |
| [ADR-011](ADR-011-Canonical-Process-Model-Layer-Separation.md) | Canonical Process Model & Layer Separation | Accepted | 2026-07-12 | Business Policy / Runtime / Presentation 3계층 분리. Execution Domain은 Business Layer. Role·RACI·Org·System·KPI를 동일 Canonical Model 위에서 확장 |
| [ADR-012](ADR-012-Execution-Domain-Source-of-Truth.md) | Execution Domain Source of Truth & Assignment | Accepted | 2026-07-12 | Layered canonical(node=registry, 마스터=commonMasters, assignment=DetailProcessGroup). Hybrid assignment(Variant 기본 + Process fallback + Node override). laneId 유지·의미만 전환. Swimlane→Execution Domain 리팩터 WP2-A |

## 작성 규약

- 파일명: `ADR-NNN-<kebab-title>.md` (NNN = 3자리 일련번호).
- 각 ADR 최소 구성: **Context / Decision / Status / Consequences / Related**.
- 상위 원칙 문서(Navigator IA)와 상호 링크한다.
