# ADR-003 — Navigator Architecture Ratification

|Field|Value|
|---|---|
|Status|Accepted (Ratification)|
|Date|2026-07-09|
|Owner|혁신팀|
|Ratifies|`05_Review/Codex/Navigator-Phase3-Concept.md` (Navigator Information Architecture) — Draft → **Approved**|
|Supersedes|— (기존 Workflow Phase 문서들은 이력으로 유지, ADR-001 근거)|
|Related|[ADR-001 Workflow/Variant](ADR-001-Workflow-Variant.md), [ADR-002 Graph First](ADR-002-Graph-First.md), Navigator IA §13 비준 체크리스트 ①~⑧|

> 이 문서는 **Phase 4.0 게이트**다. Navigator Information Architecture를 Navigator의 **Canonical Architecture 초안**으로 공식 승인(Ratification)하는 이벤트를 기록한다. 단순 의사결정 목록(DecisionLog)이 아니라 아키텍처 baseline 승인이므로 독립 문서로 남긴다.

---

## Purpose

Navigator IA(`Navigator-Phase3-Concept.md`)가 정의한 아키텍처 원칙·결정을 한 시점에 **Approved/Deferred 상태로 확정**한다. 이 비준 이후에만 Phase 4.1(스키마 명세) 이하 **구현**이 착수된다.

승인 범위:

```text
Navigator Architecture
   ↓ Graph First
   ↓ Workflow (Responsibility)
   ↓ Journey (Named Path)
   ↓ Navigation Engine
   ↓ Search Model
   ↓ AI Consumer
   ↓ Scope Boundary
```

Navigator IA §13의 비준 체크리스트 **①~⑧**을 아래 Approved Principles / Approved Decisions / Deferred Decisions로 분해해 기록한다.

---

## Approved Principles

원칙(무엇을 기준으로 삼는가). 각 항목 **Approved**.

| # | 원칙 | 상태 | 근거 요약 |
|---|---|---|---|
| P1 | **Graph First** (체크리스트 ③) | ✅ Approved | Process Graph가 기층, Category→Workflow→Variant 트리와 Journey는 그 위의 View. 다대다·관통을 트리로 표현 불가 → Graph 필수 (ADR-002) |
| P2 | **Workflow Responsibility** (체크리스트 ⑤) | ✅ Approved | Workflow는 [단일 흐름 표준화 + Variant]만 책임. **여러 Workflow 간 순서·연결은 책임지지 않음**(그것은 Journey). 축 구분: Catalog(포함) ⊥ Operational/Lane ⊥ Relationship/Journey |
| P3 | **Journey = Named Path** | ✅ Approved | Journey는 Graph 위 named path = business narrative = end-to-end 흐름(같은 개념의 세 표현). Category 관통, N:M 순서 관계 |
| P4 | **Navigation Engine** | ✅ Approved (개념) | Graph를 순회해 View/Search를 생산하는 계층. 상세 정의는 Phase 4.1로 위임 |
| P5 | **Search Model → Graph Search 확장** | ✅ Approved (구조) | 현재는 통합 목록 검색, 구조상 노드→엣지 경로 반환의 Graph Search로 확장 가능 |
| P6 | **AI = Consumer** | ✅ Approved | AI는 아키텍처 계층이 아니라 Graph/Navigation Engine의 소비자(질의·탐색·설명) |
| P7 | **Scope Boundary** (체크리스트 ⑥) | ✅ Approved | Navigator = Business Navigator(탐색·연결). Process Intelligence(측정·분석)는 범위 밖 |

---

## Approved Decisions

구체 결정(무엇으로 정했는가 + 이유). 각 항목 **Approved**.

| # | 결정 | 상태 | Reason |
|---|---|---|---|
| D1 | **Navigation Model = Model D** (체크리스트 ①) | ✅ Approved | Journey를 트리 계층(B·C)이 아니라 **Graph 위 별도 관계축**으로. 다대다·관통을 왜곡 없이 표현, additive·무마이그레이션, Catalog View 보존 |
| D2 | **Terminology = "Journey"(UI) + 중립 스키마 키** (체크리스트 ②) | ✅ Approved | E2E가 개념상 정확하나 기존 `Process` 엔티티와 명칭 충돌. 중립 키로 라벨 교체 비용 0. 문서에서 E2E(O2C·P2P·R2R)와 정렬. Business Flow·Process Chain·Business/Navigation Scenario 기각 |
| D3 | **Relation Type 4종** (체크리스트 ④) | ✅ Approved | `sequence`·`trigger`·`depends-on`·`part-of-journey`. `variant-of`는 Graph Edge가 아니라 Catalog 내부 구조로 제외. `Dependency`는 `depends-on`으로 흡수 |
| D4 | **`business-to-project` → Journey 승격** (체크리스트 ⑦) | ✅ Approved | Workflow 억지 귀속 종료. 기존 좁은 Workflow들을 참조하는 Journey로 승격 → 카테고리 개편 0으로 Phase 2 O5 해소 |

---

## Deferred Decisions

지금 승인하지 않고 유보. 각 항목 **Deferred**(범위 확장·별도 승인 필요).

| # | 항목 | 상태 | 처리 |
|---|---|---|---|
| DF1 | **01_Architecture 승격** (체크리스트 ⑧) | ⏸ Deferred | 본 비준으로 IA 문서 Status Draft→Approved. **파일의 `01_Architecture/` 이동·정본화는 별도 승인** 시점에 결정(현재는 `05_Review/Codex` 유지) |
| DF2 | **Business Object Search** (계약·프로젝트) | ⏸ Deferred | "Process Navigator → Business Navigator" 정체성 확장 신호. Graph에 Business Object 노드 추가 결정 필요 |
| DF3 | **Process Intelligence** (KPI·Health·Analytics·Event log) | ⏸ Deferred / Out-of-Scope | Scope Boundary(P7)에 의해 범위 밖. 도입 시 상한선 재조정 별도 결정 |
| DF4 | **Event / Decision 네비게이션 개념** | ⏸ Deferred | Event=기존 `trigger` 슬롯 연결(향후). Decision=노드 레벨 `decisionNodeSpec` 존재, 네비게이션 확장은 향후 |
| DF5 | **`part-of-journey` 저장 방식** | ⏸ Deferred | 멤버십이 `Journey.steps`에서 파생 가능 → 저장 엣지 vs 파생 확정은 Phase 4.1 스키마 |

---

## Phase 4.1 Scope

비준 이후 **첫 구현 전 단계**(문서/명세만).

- Journey/Relation **정규 스키마 명세** (id·name·order·steps[{workflowId, order, note}]·메타 슬롯).
- `01_Architecture/DataModel.md`·`02_Master/ProcessDefinition.md` 개정(별도 세션·승인).
- 미결 확정: `part-of-journey` 저장 vs 파생(DF5), **Navigation Engine 상세 정의**(P4).
- 하위호환·Import/Export 영향 명세(v2 유지, additive).

## Phase 4.2 Scope

- 초기 **Journey·Relation 매핑** 데이터 명세.
- **`business-to-project` 최우선** Journey 정의(참조 Workflow 순서).
- `환불(refund)`이 반품과 별개 Workflow인지 **경계 확정**.
- O2C(주문→정산)·P2P(구매→정산) Journey 후보 검토.

> Phase 4.3(Journey View UI) 이후부터 코드/UI 변경. 각 Phase 독립 PR·additive·승인 게이트.

---

## Open Issues

| # | 이슈 | 처리 예정 |
|---|---|---|
| O-1 | `환불`이 반품과 별개 Workflow인가 | Phase 4.2 매핑 |
| O-2 | `part-of-journey` 저장 엣지 vs 파생 | Phase 4.1 스키마 |
| O-3 | Navigation Engine의 책임 범위 정밀화 | Phase 4.1 |
| O-4 | Business Object를 Graph 노드로 편입할지 | 범위 확장 별도 결정(DF2) |
| O-5 | IA 문서의 `01_Architecture/` 승격 시점·파일명 | 별도 승인(DF1) |

---

## Ratification Record

|Field|Value|
|---|---|
|**Date**|2026-07-09|
|**Decision**|Navigator Information Architecture를 Navigator의 **Canonical Architecture 초안**으로 공식 비준. Approved Principles P1~P7, Approved Decisions D1~D4 확정. Deferred DF1~DF5. IA 문서 Status **Draft → Approved**. |
|**Supersedes**|없음. 기존 Workflow Phase 문서(`Workflow-*`)는 이력으로 유지되며 ADR-001의 근거로 참조됨. |
|**Related Documents**|[Navigator IA](../05_Review/Codex/Navigator-Phase3-Concept.md), [ADR-001](ADR-001-Workflow-Variant.md), [ADR-002](ADR-002-Graph-First.md), `06_Decisions/README.md` |
|**Gate**|Phase 4.0 — 본 비준 완료 시 Phase 4.1(스키마 명세) 착수 가능. **구현은 비준 이후에만.** |

> 상태 전이 공식 기록: **Draft → Review → Approved**. Navigator IA는 본 ADR-003으로 **Approved** 상태에 진입한다.
