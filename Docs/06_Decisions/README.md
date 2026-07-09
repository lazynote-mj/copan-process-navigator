# Architecture Decision Records (ADR)

|Field|Value|
|---|---|
|Purpose|Navigator의 아키텍처 결정을 기록·추적하는 ADR(Architecture Decision Record) 체계의 인덱스와 규약을 정의한다.|
|Owner|혁신팀|
|Last Updated|2026-07-09|

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

## ADR 인덱스

| ADR | 제목 | 상태 | 날짜 | 요약 |
|---|---|---|---|---|
| [ADR-001](ADR-001-Workflow-Variant.md) | Workflow / Variant 모델 도입 | Accepted | 2026-07-08 | 이름 문자열에 암묵 존재하던 Workflow/Variant를 additive 스키마로 명시화 (Model B) |
| [ADR-002](ADR-002-Graph-First.md) | Graph First Architecture | Accepted (Ratified by ADR-003) | 2026-07-09 | Process Graph를 기층으로, Category→Workflow→Variant 트리와 Journey를 그 위의 View로 |
| [ADR-003](ADR-003-Navigator-IA-Ratification.md) | Navigator Architecture Ratification | Accepted | 2026-07-09 | Navigator Information Architecture를 Canonical Architecture로 공식 비준(Phase 4.0 게이트) |

## 작성 규약

- 파일명: `ADR-NNN-<kebab-title>.md` (NNN = 3자리 일련번호).
- 각 ADR 최소 구성: **Context / Decision / Status / Consequences / Related**.
- 상위 원칙 문서(Navigator IA)와 상호 링크한다.
