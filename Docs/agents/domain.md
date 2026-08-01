# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Before exploring, read these

- **`CONTEXT.md`** at the repo root
- **`Docs/06_Decisions/`** — read ADRs that touch the area you're about to work in.
  파일명은 `ADR-NNN-Title.md` 형식이다 (예: `ADR-012-Execution-Domain-Source-of-Truth.md`).

If any of these files don't exist, **proceed silently**. Don't flag their absence; don't suggest creating them upfront. The `/domain-modeling` skill (reached via `/grill-with-docs` and `/improve-codebase-architecture`) creates them lazily when terms or decisions actually get resolved.

## File structure

Single-context repo.

```
/
├── CONTEXT.md                  ← 아직 없음. /domain-modeling 이 필요할 때 생성한다
├── Docs/06_Decisions/
│   ├── ADR-001-Workflow-Variant.md
│   └── ADR-012-Execution-Domain-Source-of-Truth.md
└── src/
```

`Docs/`의 나머지 하위 트리(`01_Architecture/`, `02_Master/`, `04_Audit/` 등)도 도메인 지식의 일부다. 작업 영역과 겹치면 함께 읽는다.

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in `CONTEXT.md`. Don't drift to synonyms the glossary explicitly avoids.

If the concept you need isn't in the glossary yet, that's a signal — either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/domain-modeling`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-007 (Data-first Approval and Runtime Governance Layer) — but worth reopening because…_
