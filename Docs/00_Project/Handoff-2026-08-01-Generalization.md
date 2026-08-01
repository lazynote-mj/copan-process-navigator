# Handoff — 범용화 + 자연어 플로우 생성

|Field|Value|
|---|---|
|Title|Generalization & NL-to-Flow Handoff|
|Purpose|범용 프로세스 모델링 툴 전환과 자연어→플로우 생성을 하나의 `/wayfinder` 지도에 올리기 위한 인수인계.|
|Status|Active|
|Owner|Project Team|
|Last Updated|2026-08-01|
|Related Docs|`Roadmap.md`, `Vision.md`, `../04_Audit/Architecture/core-platform-copan-template-separation-audit.md`, `../06_Decisions/ADR-011-Canonical-Process-Model-Layer-Separation.md`, `../06_Decisions/ADR-012-Execution-Domain-Source-of-Truth.md`|

2026-08-01 세션 산출. 코드 리뷰로 시작해 안전망 구축과 결함 수정 7건(PR #46~#52)으로 이어졌고,
그 과정에서 범용화의 임계 경로와 레인 표시 정책 문제를 측정했다.

이 문서는 다음 세션이 소비하면 역할이 끝난다. `/wayfinder` 지도가 만들어지면
미결 항목은 결정 티켓으로 옮겨가고, 이 문서는 `07_Archive`로 이동한다.

## 다음 세션의 목적

**`/wayfinder`로 두 목표를 하나의 지도에 올린다.**

1. Copan 전용 도구를 **범용 프로세스 모델링 툴**로 정리
2. **자연어 입력(텍스트·인터뷰 녹취 정리본) → 프로세스 플로우 자동 생성**

사용자 판단: 이 둘은 별개 과제가 아니다. 생성기는 *무엇을 향해* 그릴지(도메인·노드 타입·레인 축) 알아야 하고 그게 곧 템플릿 모델이다. 인터뷰 질문지는 사실상 "템플릿을 어떻게 채우는가"의 다른 이름이다.

이를 뒷받침하는 측정 결과: `ProcessZoneId`가 업무 6종을 union으로 고정하고 있어 **생성기는 템플릿이 표현할 수 없는 zone을 만들 수 없다.** 범용화 없이 생성기를 만들면 Copan 전용 생성기가 된다.

## 현재 상태

- `main` = `4037911`, 테스트 281개 통과, CI(`.github/workflows/ci.yml`) 그린, 작업트리 깨끗
- 열린 PR 없음 (#46~#52 전부 머지)
- dev 서버가 5173에 떠 있을 수 있음

## 읽어야 할 것 (중복 서술하지 않음 — 경로로 참조)

| 무엇 | 어디 |
|---|---|
| 분리 비용 실측 — P1~P5 현황, 타입 임계 경로, 번들 26%, 테스트 62% | `Docs/04_Audit/Architecture/core-platform-copan-template-separation-audit.md` **§10** |
| Platform/Template 경계 규칙 4개 | `CLAUDE.md` → "Platform / Template 경계" |
| 계층 분리 결정 (Business/Runtime/Presentation) | `Docs/06_Decisions/ADR-011` |
| Execution Domain 소유권·assignment | `Docs/06_Decisions/ADR-012` |
| 파일별 Platform/Copan/Shared 분류 | `Docs/04_Audit/Architecture/ArchitectureClassification.md` |
| 계층 책임 정의 | `Docs/01_Architecture/Layer.md` |
| 로드맵 (Platform 확장은 5순위) | `Docs/00_Project/Roadmap.md` |
| 이번 세션 변경 7건 | PR #46~#52 (`gh pr view <n>`) — 각 본문에 근거·측정치 있음 |

## 확정된 도메인 모델 (사용자 확인)

**스윔레인 축 = Execution Domain.** 조직(Organization)은 도메인에 **사후 매핑**한다 — 같은 도메인을 실행하는 조직이 회사마다 다르기 때문. 도메인은 회사 무관(범용), 조직은 회사별.

`node.laneId`는 필드명만 유지하고 의미는 Execution Domain ID다(ADR-012). 마스터는 `commonMasters.lanes`(도메인) + `commonMasters.organizations`, 배정은 `DetailProcessGroup.domainAssignments`.

## 미결 결정 — wayfinder 지도의 후보

### 범용화

| # | 결정 | 근거 |
|---|---|---|
| G1 | `ProcessZoneId` union → 템플릿 제공 방식으로 일반화 | **임계 경로.** 감사 §10.3 |
| G2 | `Lane.ownerDepartment` 필수 필드 해제 | 조직 없는 템플릿 불가. §10.3 |
| G3 | 템플릿 데이터를 런타임 경로로 (`TemplateDefinition.package` 채우기) | §10.1 P1 "형식만 완료" |
| G4 | registry 24파일 domain-native 변환 vs load-time normalization 영구 유지 | ADR-012가 명시적으로 미결로 남김 |
| G5 | `commonMasters.lanes` → `executionDomains` rename | ADR-012 "후속 ADR" |
| G6 | 테스트 재분류 (24개 중 15개가 Copan 데이터 의존) | §10.5 |

### 레인 표시 정책 (이번 세션 조사, 문서화 안 됨)

28개 프로세스 전수 조사 결과 — **빈 레인 밴드 66개**(프로세스당 평균 2.4). `sales` 24/28, `procurement` 23/28, `logistics` 12/28, `finance` 7/28에서 비어 있음. 최악은 `business-to-purchase-request`·`service-business-to-expense`로 5개 중 4개가 빈 밴드.

원인: `process.laneIds`가 프로세스별로 큐레이션된 적이 없다. 조직 5개 전체가 기본값으로 굳었고 remap 후 도메인 5개로 그대로 넘어왔다. `laneDisplayPolicy`의 전제("명시 설정 = 의도적 선택")가 입력에서 깨져 있다.

| # | 결정 |
|---|---|
| L1 | 빈 레인 밴드 — 자동 접기 / 프로세스별 큐레이션 / 현행 유지(비교 일관성) |
| L2 | `sales` 도메인 이름이 `매장/POS` — canonical seed는 `판매`. 채널명으로 도메인을 부르는 게 맞는가 |

### 생성기 (전부 미탐색)

- 인터뷰 질문지 구조 — 무엇을 물어야 도메인·노드·엣지가 결정되는가
- 자연어 추출 스키마 — 무엇을 뽑을 것인가
- 추출 결과 → 모델 매핑 (G1~G3와 직결)
- 재생성 시 수작업 배치 보존 문제
- 사람이 그린 것과 생성된 것의 화해

## 이 세션에서 얻은 안전망 (건드릴 때 참고)

- **라우터 불변식** `src/lib/layout/__tests__/routerInvariants.test.ts` — 직교성·경로점·중복점·bend·관통 baseline·엔진 자기보고 정합성을 **두 데이터 소스**(registry / runtime state)에 각각 적용
- **관통 baseline** `__fixtures__/knownCollisions.ts` — registry 18건 / runtime 8건. **줄어드는 방향으로만 갱신**
- **로드 경로 고정 테스트** — runtime fixture가 앱과 같은 2단계(`buildProcessDataFromPayload` → `hydrateProcessData`)를 거치는지 검증
- **렌더 탈락 0 테스트** — 노드가 조용히 사라지는 현상 방지

## 함정 (이번 세션에서 실제로 빠진 것들)

1. **`lanes`라는 이름에 속지 말 것.** 내용은 Execution Domain이다. 이 이름 때문에 두 번 오독했다.
2. **앱 로드 경로는 2단계다.** `buildProcessDataFromPayload`(schemaVersion 게이트, WP3 마이그레이션) → `hydrateProcessData`(registry sync + 정규화). 하나라도 빼면 앱과 다른 상태를 재게 된다.
3. **schemaVersion 3 파일은 마이그레이션 게이트를 건너뛴다.** 이미 저장된 파일을 고치려면 게이트 밖의 `normalizeExecutionDomains`에도 손대야 한다.
4. **`state.json`(시드)과 `state.local.json`(개발 런타임, gitignore)은 다르다.** 앱은 local 우선.
5. **grep으로 import를 찾을 때 상대경로 깊이를 놓치기 쉽다.** `from '../../commands'`를 놓쳐 "미배선 2,506줄"이라는 틀린 리뷰를 냈다. 실제로는 전부 배선돼 있었다.
6. **`MAX_ORTHOGONAL_BENDS = 2`는 전역 상한이 아니다.** 주석대로 local/decision routing 전용. 실제 계약은 `EXCESSIVE_BEND_WARNING = 5`.

## 남은 기술 부채 (범용화와 별개)

- 관통 registry 18 / runtime 8건 — 보고는 되지만 미해소
- 거대 컴포넌트: `AppLayout.tsx` 1,530줄/훅 85개, `ProcessMapCanvas.tsx` 1,577줄, `PropertyPanel.tsx` 2,391줄. react-hooks 경고 9건이 전부 여기
- 번들 1,041KB 단일 청크 (elkjs 지연 로딩 후보)
- `README.md`가 Vite 템플릿 원본 그대로
- `@deprecated` 타입 필드 20개 이상

## Suggested skills

1. **`/wayfinder`** — 주 경로. 결정 티켓 지도를 만들고 위 미결 항목을 하나씩 해소한다. 이슈 트래커는 GitHub Issues로 설정돼 있다(`Docs/agents/issue-tracker.md`, PR #48).
2. **`/research`** (병행 가능) — "자연어 → 프로세스 모델 추출" 선행 사례를 백그라운드로 조사. 산출 문서를 wayfinder 입력으로.
3. 지도가 걷히면 → **`/to-spec`** → **`/to-tickets`** → **`/implement`**
4. 특정 모듈의 형태를 설계할 때 → **`/codebase-design`**
5. 용어가 흔들릴 때 → **`/domain-modeling`** (`CONTEXT.md`는 아직 없다. 이 스킬이 필요할 때 만든다)

**주의**: wayfinder는 이 스킬 세트에서 인지적으로 가장 무거운 흐름이다. smart zone(~120k)을 넘기 전에 지도를 완성하지 못하면 밀어붙이지 말고 다시 `/handoff` 할 것.
