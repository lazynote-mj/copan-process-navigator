# ADR-002 — Graph First Architecture

|Field|Value|
|---|---|
|Status|Accepted (Ratified by ADR-003)|
|Date|2026-07-09|
|Owner|혁신팀|
|Supersedes|—|
|Related|`05_Review/Codex/Navigator-Phase3-Concept.md` (Navigator IA)|

## Context

ADR-001로 Workflow/Variant는 명시화됐으나, `wf-business-to-project`(21노드: 사업기회 → 계약 → 프로젝트 → 구매 → 입고 → 매입전표)처럼 **여러 Workflow를 관통하는 end-to-end 흐름**은 `Category → Workflow → Variant` 3계층 트리에 담을 자리가 없었다. 편의상 `business-start` 카테고리에 draft로 끼워 넣은 상태였다.

근본 원인은 개별 사례가 아니라 **모델**이다: 관통 흐름은 (a) 여러 Category를 관통하고 (b) 한 Workflow가 여러 관통 흐름에 재사용되는 **다대다(N:M)** 관계인데, 트리(단일 부모)로는 다대다를 표현할 수 없다.

## Decision

**Graph First**를 Navigator의 최상위 아키텍처 원칙으로 채택한다.

> Process Graph가 Navigator의 기층이며, Category → Workflow → Variant 트리와 Journey는 모두 Graph 위의 서로 다른 projection/view다.

- **Process Graph = 기층**: 노드 = Workflow(향후 Business Object) · 엣지 = Relation · **Journey = 그래프 위의 named path**.
- **Multiple Views**: Catalog View(Category⊃Workflow⊃Variant 포함 트리) · Journey View(named path/narrative) · Operational View(Lane). Sidebar Tree는 Graph 자체가 아니라 **하나의 UI Projection**.
- **Journey**: named path = business narrative = end-to-end 흐름(같은 개념의 세 표현). Category에 직교하는 Relationship Axis.
- **Relation Edge 4종**: `sequence` · `trigger` · `depends-on` · `part-of-journey`. (`variant-of`는 Catalog 내부 구조로 엣지 제외.)
- **AI = Consumer**: AI는 아키텍처 계층이 아니라 Graph/Navigation Engine의 소비자.
- **Navigation Model = Model D**: Journey를 트리 계층이 아니라 Graph 위 별도 관계축으로 additive 도입.

## Status

**Accepted (Ratified by ADR-003).** 데이터 결정(관계축 additive)은 확정, UI 노출 방식은 Phase 4 재량. 구현은 Phase 4.1 이후.

## Consequences

- (+) 다대다·Category 관통을 왜곡 없이 표현. 기존 Catalog View·Lifecycle 서사 완전 보존(마이그레이션 0).
- (+) `business-to-project`를 Workflow 억지 귀속에서 Journey로 승격 → 카테고리 개편 없이 해소.
- (+) Search(Graph Search)·AI가 동일 Graph 기층 위에서 자연 확장.
- (−) Journey↔Workflow 참조 무결성 관리 필요. View가 늘어 초기 학습 부담 소폭.
- 미결: `part-of-journey`의 저장 엣지 vs 파생 여부, Navigation Engine 상세 정의 → Phase 4.1.

## Related

- 원칙 상세: [Navigator Information Architecture](../05_Review/Codex/Navigator-Phase3-Concept.md) §1·§6
- 선행: [ADR-001 Workflow/Variant](ADR-001-Workflow-Variant.md) · 비준: [ADR-003 Ratification](ADR-003-Navigator-IA-Ratification.md)
