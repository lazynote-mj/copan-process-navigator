# Navigator v0.9 — Release Checklist

|Field|Value|
|---|---|
|Role|Release Gate — Navigator v0.9 (Mid-term Demo)|
|Status|**Open** (freeze 대기)|
|Milestone|Demo Ready (Phase: Modeling)|
|Date|2026-07-10|
|Pairs with|[Navigator Roadmap v1.0](Navigator-Roadmap-v1.0.md) · [Product Strategy](../05_Review/Navigator-Product-Strategy-2026.md)|

> 이 문서는 **v0.9 Freeze/Release 게이트**다. 기준은 "새 기능"이 아니라 **"중간보고에서 신뢰감 있게 시연할 수 있는가?"** 이다. 아래 Release Criteria가 모두 ✅일 때 freeze한다.
>
> 개발 흐름(이 버전부터): `Roadmap → WP → ADR → Implementation → Release Checklist → Merge`.

---

## 0. Release Criteria (게이트)

| # | 기준 | 상태 |
|---|---|---|
| 1 | **Workflow Assignment Integrity** — 생성/복제 시 workflowId 할당, "미분류"=예외 탐지 전용 | ☐ |
| 2 | **Demo Scenario** — 시연 시나리오 통과 | ☐ |
| 3 | **Regression** — tsc/build/test/lint green + 기존 동작 무회귀 | ☐ |
| 4 | **Performance** — 대표 화면 로드/편집 체감 지연 없음 | ☐ |
| 5 | **Build Green** — `tsc -b` · `npm run build` · `vitest` · `eslint` 그린 | ☐ |
| 6 | **Manual QA** — 핵심 플로우 수동 확인 | ☐ |

> 6개 전부 ✅ → **Freeze**. 이후 Demo Track은 **버그픽스만**.

---

## 1. Feature Check (기능)

- ☐ Workflow-first Navigation — Workflow 최상위 트리, canonical `workflows[]` 순서 (ADR-008 Phase1)
- ☐ **Workflow Assignment Integrity** — 신규 생성 시 workflowId 할당 (WP-A, 진행 중 task_089df70c)
- ☐ Builder editing — node/edge/lane/zone 추가·편집·복제
- ☐ Save — dev-local 저장 + Save Guard(충돌 감지 409)
- ☐ Runtime Persistence — 로드/저장 roundtrip, seed 불가침
- ☐ Lifecycle badge (트리 아님) 정상 표시
- ☐ Header IA — 제목/탐색/Role/Save 상태 명료

## 2. Regression (회귀 테스트)

- ☐ `tsc -b --force` = 0
- ☐ `npm run build` = 0
- ☐ `vitest run` = 전체 pass
- ☐ `eslint src` = 0 errors (경고는 기록)
- ☐ 기존 프로세스 렌더/편집/저장 무회귀
- ☐ (CI 위생) eslint `.claude/worktrees` 오탐 해소 확인

## 3. Demo Scenarios (시연 시나리오)

> 중간보고에서 실제로 보여줄 순서. 각 시나리오는 "끊김 없이" 재현 가능해야 한다.

- ☐ S1 — Overview 진입 → Workflow-first Sidebar 탐색 → Detail Process 선택
- ☐ S2 — Builder 진입 → 노드/연결선 편집 → 전체 저장 → 재로드 유지
- ☐ S3 — 신규 Detail Process 생성 → **Workflow 소속 정상 배치**(미분류 아님)
- ☐ S4 — 복제 → 원본 Workflow 하위 유지
- ☐ S5 — (선택) 두 세션 저장 충돌 → 명확한 충돌 메시지(데이터 보존)
- ☐ S6 — (선택) Governance 읽기전용 정합성 점검 표면

## 4. Performance

- ☐ Overview/Detail 초기 로드 체감 지연 없음
- ☐ 대형 프로세스(28+) 편집 반응성 OK
- ☐ Sidebar 스크롤/펼침 부드러움

## 5. Manual QA

- ☐ 지원 데스크톱 폭에서 레이아웃 정상(툴바/본문/캔버스 이동 없음)
- ☐ 선택/hover/펼침/카운트 상태 명료
- ☐ 콘솔 에러 0

## 6. Known Issues (릴리스 시점 알려진 이슈)

| ID | 내용 | 영향 | 조치 |
|---|---|---|---|
| K1 | 신규 blank 생성 시 workflow 지정 UI 부재(현재 복제 승계만) | 낮음(WP-A로 해소 예정) | v0.9 게이트(기준1) |
| K2 | Governance validation 미배선(읽기전용 표면만) | 낮음(데모 비핵심) | v1.0 Validation Gate |
| K3 | 9 react-hooks warnings(기존) | 낮음 | Platform 상시 |
| K4 | 저장 dev-only(서버/prod write 없음) | 데모 범위 내 | v2.0 |

> 릴리스 전 최신화. Blocker(높음)는 0이어야 freeze 가능.

## 7. Freeze Date

- 목표 Freeze: **WP-A + WP-B 완료 시점** (날짜 확정 시 기입: `____-__-__`)
- Freeze 시 green main에서 **`release/navigator-v0.9`** 컷 → 이후 버그픽스만.

## 8. Release Decision

| 항목 | 값 |
|---|---|
| Release Criteria 6개 | ☐ 전부 충족 |
| Blocker Known Issue | ☐ 0건 |
| 결정 | ☐ **Go (Freeze)** / ☐ Hold |
| 승인 | (기입) |
| release 브랜치 | `release/navigator-v0.9` (컷 후 기입) |

---

## Next (참고 · 이 체크리스트 이후)
- WP-A(Workflow Assignment Integrity, 진행 중) → WP-B(Demo Stabilization) → **본 체크리스트 충족** → `release/navigator-v0.9` → 중간보고.
- 중간보고 이후 Platform Track(v1.0): Working Copy · Publish · Builder Validation.

## Related
- [Navigator Roadmap v1.0](Navigator-Roadmap-v1.0.md) · [Product Strategy](../05_Review/Navigator-Product-Strategy-2026.md) · [Baseline Review](../05_Review/Development-Baseline-Review-2026-07.md)
