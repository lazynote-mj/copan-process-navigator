# copan-process-navigator

Universal Process Modeling Platform 위에서 동작하는 Copan ERP Process Navigator.
아키텍처 계층과 결정 기록은 `Docs/`를 참조한다.

## Platform / Template 경계

이 저장소는 범용 Process Modeling Platform과 Copan ERP Template이 한 트리에 있다.
장기 목표는 분리지만 지금은 착수하지 않는다(Roadmap 5순위, 두 번째 고객 부재).
**대신 결합을 더 늘리지 않는다.** 아래 4개는 실측으로 도출된 규칙이다 —
근거는 `Docs/04_Audit/Architecture/core-platform-copan-template-separation-audit.md` §10.

### 1. Core 타입에 업무 분류를 union으로 넣지 않는다

`src/types/process.ts`의 `ProcessZoneId`가 Copan 업무 6종을 union으로 고정한 탓에
두 번째 템플릿은 자기 zone을 **타입 수준에서 표현할 수 없다**. 값이 아니라 타입이라
config로 뺄 수도 없다. 새 분류 축이 필요하면 `string` + template config로 둔다.
같은 이유로 Core 타입에 조직·업무 개념을 **필수 필드**로 넣지 않는다
(`Lane.ownerDepartment`가 이미 그렇게 돼 있다).

### 2. 새 Copan 값은 `src/config/`가 아니라 `src/data/`에 둔다

`src/config/appConfig.ts`는 Platform 위치인데 이미 앱 이름, `'SCM Process'`,
lifecycle group 7개, detail process→group 매핑 24개를 들고 있다. 더 늘리지 않는다.
`src/data/`는 이미 Copan 자산 구역이다(`ArchitectureClassification.md` 참조).

### 3. nodeId 기반 Platform 매핑을 새로 만들지 않는다

`OVERVIEW_NODE_ZONES`(nodeId→zone 51개) 같은 매핑은 다른 템플릿에서 **조용히
무력화된다** — 에러도 경고도 없이 기능만 사라진다. 판정이 필요하면 nodeId가 아니라
node의 속성(type, processZone 등)으로 한다.

### 4. Platform 테스트에 Copan 데이터를 새로 끌어들이지 않는다

24개 테스트 파일 중 15개가 이미 Copan 데이터에 의존한다. Platform 동작을 검증하는
테스트는 인라인 fixture를 쓴다. 템플릿 데이터를 도는 테스트(`layoutEngine`,
`routerInvariants` 등)는 그 자체가 목적이므로 예외다.

## Agent skills

### Issue tracker

이슈는 GitHub Issues(`lazynote-mj/copan-process-navigator`)에 `gh` CLI로 관리한다.
See `Docs/agents/issue-tracker.md`.

### Triage labels

정규 5개 역할을 이름 그대로 사용한다 — `needs-triage` / `needs-info` /
`ready-for-agent` / `ready-for-human` / `wontfix`. See `Docs/agents/triage-labels.md`.

### Domain docs

Single-context. ADR은 `Docs/06_Decisions/`에 `ADR-NNN-Title.md` 형식으로 둔다.
See `Docs/agents/domain.md`.
