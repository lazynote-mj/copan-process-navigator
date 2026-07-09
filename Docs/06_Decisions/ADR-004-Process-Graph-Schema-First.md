# ADR-004 — Process Graph Schema First (Phase 4.1 우선순위 재정렬)

|Field|Value|
|---|---|
|Status|Accepted|
|Date|2026-07-09|
|Owner|혁신팀|
|Amends|[ADR-003](ADR-003-Navigator-IA-Ratification.md) — Phase 4.1 로드맵 표현을 보완(폐기하지 않음)|
|Supersedes|—|
|Related|[ADR-002 Graph First](ADR-002-Graph-First.md), [Navigator IA](../05_Review/Codex/Navigator-Phase3-Concept.md) §1·§6·§13|

> ADR-003(Navigator IA Ratification) 이후 **첫 거버넌스 적용 사례**다. 새 설계를 제안하는 것이 아니라, 이미 승인된 원칙(Graph First)에 맞게 Phase 4.1의 착수 순서를 공식 재정렬한다.

---

## Context

- **ADR-003에서 Graph First가 승인**되었다(P1): Process Graph가 Navigator의 기층이며, Category→Workflow→Variant 트리와 Journey는 모두 Graph 위의 서로 다른 View다.
- **Journey는 Graph 위의 Named Path로 정의**되었다(P3): Journey = named path = business narrative = end-to-end 흐름. 즉 Journey는 **Graph(노드·엣지) 위에 얹히는 경로**다.
- 그런데 ADR-003/IA §13의 Phase 4.1 로드맵은 **"Journey/Relation 스키마 명세"** 로 표기되어, 상위 개념(Journey)을 하위 기층(Graph)보다 먼저 정의하는 것처럼 읽힌다.
- 논리적 선후: **Graph(노드·엣지)가 있어야 그 위의 Path(Journey)를 정의할 수 있다.** 따라서 Journey Schema보다 **Process Graph Schema가 먼저** 정의되어야 Graph First 원칙과 일관된다.

## Decision

**Phase 4.1은 `Process Graph Schema` 우선으로 진행한다.** 명세 순서를 다음과 같이 공식 재정렬한다.

| 순서 | 영역 | 명세 내용 |
|---|---|---|
| **1** | **Process Graph Schema** | Node · Edge · Metadata |
| **2** | **Journey Schema** | Journey · Steps · Narrative |
| **3** | **Relation Type** | sequence · trigger · depends-on · related-object · part-of-journey (**저장 vs 파생** 확정) |
| **4** | **Navigation Engine** | Graph Traversal · Related Workflow · Search · Context · Recommendation |
| **5** | **Business Object Link** | Contract · Project · Product · Cost Center (Graph 확장) |

- 기존 표현: `Journey / Relation Schema`
- 변경 표현: `Process Graph Schema → Journey Schema → Relation Type → Navigation Engine → Business Object Link`

## Consequences

- **Journey Schema는 Graph Schema 이후 정의**된다 — Journey는 Graph 위의 Named Path이므로 노드·엣지 모델이 선행 확정돼야 한다.
- **Relation Type은 Graph Edge 모델과 함께 정리**된다 — 관계 타입은 Graph의 엣지 정의의 일부다. `part-of-journey`의 저장 엣지 vs 파생(Open Issue O-2)은 이 단계에서 확정한다.
- **Navigation Engine은 Graph Traversal 기반으로 정의**된다 — Related Workflow·Search·Context·Recommendation 모두 Graph 순회의 소비 형태다(O-3 Navigation Engine 범위도 여기서 확정).
- **Business Object 연결은 Graph 확장으로 다룬다** — Contract·Project·Product·Cost Center를 Graph의 신규 노드 종류로 편입하는 형태(O-4). 범위 확장 결정(DF2)은 별도 유보로 남되, 스키마상 확장 지점을 이 순서의 마지막에 배치한다.
- Phase 4.1은 여전히 **문서/명세만**이며, 구현(코드/데이터/UI)은 명세 확정·승인 이후 Phase 4.3부터 착수한다(ADR-003 유지).

## Supersedes / Amends

- **Amends ADR-003**: ADR-003 및 Navigator IA §13의 "Phase 4.1 = Journey/Relation 스키마 명세" **표현을 보완**하여, Phase 4.1의 착수 순서를 Process Graph Schema 우선으로 명확화한다.
- **ADR-003을 폐기(Supersede)하지 않는다.** ADR-003의 Approved Principles(P1~P7)·Decisions(D1~D4)·Deferred(DF1~DF5)는 그대로 유효하다. 본 ADR은 **승인된 원칙(Graph First)의 자연스러운 귀결로서 로드맵 순서만 정렬**한다.
- 새로운 원칙·결정을 추가하지 않으므로 별도 Ratification 이벤트는 필요하지 않다(경량 ADR).

## Related

- 원칙 근거: [ADR-002 Graph First](ADR-002-Graph-First.md), [Navigator IA](../05_Review/Codex/Navigator-Phase3-Concept.md) §1(Graph First)·§6(Process Graph)
- 비준 문맥: [ADR-003 Navigator IA Ratification](ADR-003-Navigator-IA-Ratification.md) (Phase 4.1/4.2 Scope, Open Issues O-1~O-5)
