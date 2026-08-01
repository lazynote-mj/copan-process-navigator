# copan-process-navigator

Universal Process Modeling Platform 위에서 동작하는 Copan ERP Process Navigator.
아키텍처 계층과 결정 기록은 `Docs/`를 참조한다.

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
