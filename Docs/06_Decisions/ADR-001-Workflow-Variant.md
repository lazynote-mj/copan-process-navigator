# ADR-001 — Workflow / Variant 모델 도입

|Field|Value|
|---|---|
|Status|Accepted|
|Date|2026-07-08|
|Owner|혁신팀|
|Supersedes|—|
|Related|`05_Review/Codex/Workflow-Variant-IA-Review.md`, `Workflow-Refactor-Phase0-Decision.md`, `Workflow-Phase1-Specification.md`, `Workflow-Phase2-Open-Issues-Decision.md`, `01_Architecture/DataModel.md`|

> 이 ADR은 Phase 0~2에서 이미 검토·구현·안정화된 결정을 ADR 체계로 소급 기록한 것이다. 상세 근거는 Related 문서에 있으며, 여기서는 결정과 그 이유를 요약한다.

## Context

`v1.0-baseline`까지 Navigator의 프로세스는 `DetailProcessGroup.name` 문자열의 `"<흐름> : <유형>"` 표기 관례로만 Workflow(공통 흐름)와 Variant(실행 유형)를 암묵 표현했다. 이 방식은:

- 콜론 없는 6개 프로세스의 흐름/유형을 파싱 불가.
- 띄어쓰기 불일치(`매출 전표` vs `매출전표`)로 같은 Workflow가 분열.
- 단계·순서·키워드 등 메타데이터를 담을 귀속처 부재 → AI/검색 확장 불가.

## Decision

**Model B(최소 Workflow 개념 추가)** 를 채택한다.

- payload 최상위에 optional 배열 **`workflows[]`** 추가(Master 신설이 아닌 별도 배열, O3/C1).
- `DetailProcessGroup`에 optional 필드 **`workflowId` · `variantLabel` · `variantOrder`** 추가.
- **additive·하위호환**: Process/Node ID·JSON v2·Canvas·Router 불변. 미지정 시 기존 동작(fallback).
- 매핑은 **ID 기준**(이름 파싱 금지). 카테고리(Lifecycle 7종)는 대개편하지 않음(Phase 0 결정).

## Status

**Accepted** — PR #13(스키마) → #14(27개 매핑) → #15(3계층 Sidebar IA) → #16(Explorer UX) → #17(전표명 정규화)로 구현·안정화. 17 Workflow 등록.

## Consequences

- (+) 메뉴 축약, 이름 규칙에서 명시 스키마로 이행, AI/검색 메타데이터 귀속처 확보.
- (+) additive라 실패 시 필드 무시로 v1.0 동작 복귀.
- (−) Workflow는 여러 Category를 관통하는 **end-to-end 흐름을 표현하지 못함** → ADR-002에서 Graph First로 해소.
- Workflow와 노드-단계 링크는 미결(향후 필요 시 증분 도입).

## Related

- 원칙: [Navigator Information Architecture](../05_Review/Codex/Navigator-Phase3-Concept.md) §2
- 후속: [ADR-002 Graph First](ADR-002-Graph-First.md), [ADR-003 Ratification](ADR-003-Navigator-IA-Ratification.md)
