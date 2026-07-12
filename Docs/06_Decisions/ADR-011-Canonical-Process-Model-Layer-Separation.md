# ADR-011 — Canonical Process Model & Layer Separation

|Field|Value|
|---|---|
|Status|Accepted|
|Date|2026-07-12|
|Owner|혁신팀|

## Context
Navigator가 프로세스 드로잉 툴에서 Enterprise Process Intelligence Platform으로 진화한다. Swimlane이 조직과 레이아웃을 결합해 조직 변경이 레이아웃을 바꾸는 구조적 문제가 있었다.

## Decision
Navigator 데이터를 3계층으로 분리한다.

- **Business Policy Layer (canonical)** — Execution Domain, Organization, Domain→Org assignment, (향후) Role·RACI·System·KPI. 조직 독립·안정.
- **Runtime Layer** — Process 그래프(nodes/edges/위치), ProcessData, state.json, registry. 노드는 Business 개념에 대한 **참조 id만** 보유.
- **Presentation Layer** — swimlane 레이아웃, Overview/Detail 렌더, Property Panel. Business+Runtime을 project.

**Execution Domain은 Runtime이 아니라 Business Layer에 속한다.** 향후 Role/RACI/Organization/System/KPI는 `{마스터 + 프로세스요소→개념 매핑 + (선택) 노드 override}` 동일 shape로 같은 Canonical Process Model 위에서 확장한다.

## Consequences
- (+) 조직·정책 변경이 레이아웃/구조를 훼손하지 않음.
- (+) RACI·AI Knowledge Graph 확장 기반.
- commonMasters의 Business(도메인·조직) vs Presentation(layout/router/style rules) 개념 분리를 점진 적용.

## Related
- ADR-012 (Execution Domain Source of Truth) — 본 ADR의 인스턴스.
- ADR-008/009/010 (Navigation·Builder·Menu UX).
