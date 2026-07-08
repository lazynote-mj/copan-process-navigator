# Workflow Refactor Phase 0 Decision

|Field|Value|
|---|---|
|Title|Workflow / Variant 구조 개선 Phase 0 의사결정|
|Purpose|Navigator에 최소 Workflow 개념을 도입하기 위한 데이터 모델·UI·마이그레이션 작업의 기준이 될 의사결정을 확정한다.|
|Status|Review|
|Owner|혁신팀|
|Last Updated|2026-07-08|
|Baseline|`v1.0-baseline` (commit 4b3fcca)|
|Related Docs|`Workflow-Variant-IA-Review.md`, `01_Architecture/DataModel.md`, `02_Master/ProcessDefinition.md`, `Docs/README.md(Methodology v1.0)`|

> Review 문서다. Architecture로 승격되기 전까지는 의견으로 취급하며, 본 Phase 0에서는 코드·데이터·UI를 수정하지 않는다.

---

## 1. Purpose

이번 Phase 0의 목적은 **구현이 아니라 의사결정**이다. `v1.0-baseline`으로 안정화된 현재 구조 위에, 향후 Workflow/Variant 개선(Phase 1 이후)의 기준이 될 다음 두 결정을 확정한다.

- **결정 A — Category 개편 범위**: 기존 카테고리를 어떻게 다룰 것인가.
- **결정 B — Methodology 정합성**: Navigator를 무엇으로 정의할 것인가(뷰어 / 방법론 도구 / 하이브리드).

이 문서가 확정되면 Phase 1은 "최소 변경으로 데이터 모델 확장 가능성만 검토"하는 범위로 진입한다.

---

## 2. Current Structure

### 2.1 데이터 엔티티 (v1.0-baseline 기준)

| 엔티티 | 정의 | Workflow/Variant 관점 |
|---|---|---|
| **Process** (`ProcessInstance`) | 화면에 렌더되는 개별 프로세스. `{ id, type:'overview'\|'detail', name, nodes[], edges[], zones[], laneIds?, autoHideEmptyLanes? }` | **현재 유일한 실체 단위.** Workflow와 Variant가 이 하나에 뭉쳐 있다 |
| **Process Category** (`lifecycleGroups`) | appConfig 하드코딩 7종(사업시작/기준정보/구매입고/판매/반품/재고/정산). 그룹의 `lifecycleGroupId`로 귀속 | 메뉴 1단 그룹. Workflow보다 상위 개념 |
| **DetailProcessGroup** | 메뉴 항목 단위. `{ id, name, description, detailProcessId(1:1), lifecycleGroupId?, linkedOverviewGroupId? }` | Process와 1:1. **Variant 구분이 `name` 문자열에만 존재** |
| **Lane** | `commonMasters.lanes` 전역 마스터. 담당 조직 영역 | Workflow/Variant와 독립 (직교 축) |
| **Node** | `{ id, name, type, laneId, phaseId, system, owner, ... }` | Workflow의 "단계(step)"에 해당하나 명시 연결 없음 |
| **Edge** | 노드 간 흐름 연결 | Workflow 흐름의 실제 표현이나 Workflow 엔티티로 집계되지 않음 |

### 2.2 Variant로 해석될 수 있는 현재 명명 규칙

현행 26개 상세 프로세스는 `"<흐름 경로> : <유형>"` 관례를 부분적으로 따른다. 실제 데이터 집계:

- **콜론 있음(Variant 명시): 20개** — 예: `주문 등록 ~ 출고 ~ 매출 전표 : B2B 국내`
- **콜론 없음: 6개** — `위탁 매출 정산`, `수익배분 매출 정산`, `저장위치 등록`, `구매반품`, `기타입고`, `일반 재고이동`

같은 Workflow가 여러 Variant로 갈라진 실사례:

| 흐름(추정 Workflow) | Variant |
|---|---|
| 구매 요청 ~ 매입 전표 생성 | 서비스 / 연구개발비·F&B·소모품 / IT·S/W |
| 주문 등록 ~ 출고 ~ 매출 전표 | B2B 국내 / B2C |

### 2.3 명시적 분리 부재 — 핵심 문제

> **현재 구조에서 Workflow와 Variant는 어떤 명시적 필드로도 분리되어 있지 않다.** 둘의 구분은 오직 `DetailProcessGroup.name` 문자열의 표기 관례에만 존재하며, 이는 다음 실측 한계를 낳는다.

1. **파싱 불가능한 케이스**: 콜론 없는 6개는 흐름/유형을 문자열로 도출할 수 없다.
2. **표기 불일치가 Workflow를 분열시킴**: `주문 반품 ~ 입고 ~ 반품 전표`(B2B) vs `주문 반품 ~ 입고 ~ 반품전표`(B2C) — 띄어쓰기 차이로 같은 Workflow가 다른 흐름으로 인식된다. `매출 전표` vs `매출전표`도 동일.
3. **단계(step)-노드 미연결**: 흐름 경로 문자열은 노드/엣지 구조와 데이터적으로 연결되지 않는다.
4. **AI/검색 귀속처 없음**: 키워드·태그·트리거 등 메타데이터를 담을 필드가 없다.

즉 Workflow/Variant는 **개념적으로는 이미 존재하나 데이터적으로는 미분리** 상태다.

---

## 3. Definitions

Navigator 기준의 3개념 정의:

### Workflow — 업무 흐름의 상위 단위
동일한 단계 시퀀스를 공유하는 업무의 표준 흐름.
- 예: `주문 → 출고 → 매출전표`, `구매요청 → 입고 → 매입전표`, `계약 → 프로젝트 → 정산`
- 성격: 재사용 가능한 "골격". 여러 Variant가 이 하나를 공유한다.

### Variant — 실행 유형
동일 Workflow 안에서 **채널·거래유형·실행방식·예외조건**에 따라 달라지는 실행 유형.
- 예: B2B 국내, B2B 해외, B2C 자사몰, 팝업/행사장, 위탁, 사입, 서비스, IT·S/W
- 성격: Workflow의 파라미터화. 노드 일부·시스템·담당조직이 달라질 수 있으나 흐름 골격은 공유.

### Process — 화면에 표시되는 개별 인스턴스
사용자가 실제로 선택·조회하는 개별 프로세스.
- 개념적으로 **Process ≈ Workflow + Variant 조합**.
- 현재는 이 조합이 하나의 `ProcessInstance`로 물리적으로 존재한다(분리 안 됨).

> 관계 요약: **1 Workflow ── N Variant ── (각 Variant가) 1 Process**. 콜론 없는 6개는 "Variant 1개짜리 Workflow"로 자연 수용된다.

---

## 4. Recommended Direction: Option B

`Workflow-Variant-IA-Review.md`가 권장한 **B안(최소 Workflow 개념 추가)** 을 Phase 0의 기준 방향으로 확정한다. 원칙:

1. **기존 데이터 구조를 대규모로 깨지 않는다** — Process/Node ID, JSON v2 포맷, Canvas/Router 불변.
2. **기존 Process 중심 화면을 유지한다** — 선택·렌더 단위는 여전히 Process.
3. **Workflow를 상위 그룹으로 추가한다** — 카테고리와 Process 사이의 중간 계층(선택적).
4. **Variant는 명명 규칙 또는 보조 메타데이터로 우선 관리한다** — 즉시 정규 필드화하지 않고 점진 전환.
5. **UI는 초기에 그룹핑/필터 수준으로만 개선한다** — 접기/펼치기, Workflow 헤더, Variant 목록.
6. **실제 데이터 모델 변경은 Phase 1에서 별도 검토한다** — 본 Phase 0은 확장 "가능성"만 확정.

이 방향은 `v1.0-baseline`까지 검증된 additive 하위호환 패턴(`lifecycleGroupId`, `laneIds`, `autoHideEmptyLanes`)과 동일한 진화 경로를 따른다.

---

## 5. Open Question A: Category Scope

**질문:** 기존 Process Category(7종 Lifecycle)를 Workflow 도입 시 어떻게 다룰 것인가.

### 대안 1 — 기존 Category 유지 (Workflow 미도입)
- **장점**: 변경 0. 리스크 0.
- **단점**: Workflow/Variant 문제(중복 표시, 메뉴 길이, AI 불가)가 그대로 남는다.
- **리스크**: 없음(현상 유지) / 단, 개선 목표 미달.

### 대안 2 — Workflow 중심 Category로 재편
- **장점**: 개념 정합성 최상. 카테고리=Workflow 축으로 일원화.
- **단점**: 기존 `lifecycleGroupId` 데이터 전면 이관 필요. Lifecycle(사업시작→정산) 순서가 주는 "업무 생애주기" 내러티브를 상실. Overview 메뉴와의 정합 재설계.
- **리스크**: **높음** — 카테고리 개편은 데이터 마이그레이션 + Overview 회귀를 수반. R&R 구축 중단 위험.

### 대안 3 — 기존 Category 유지 + Workflow를 별도 상위 그룹으로 추가 (권장)
- **장점**: 카테고리(생애주기 축)와 Workflow(흐름 축)를 **직교 유지**. 기존 데이터 무이관. Workflow는 카테고리 내부의 중간 그룹으로만 추가 → 점진 전환. 미지정 Process는 기존처럼 카테고리 직속 표시(fallback).
- **단점**: 두 그룹 축이 공존하므로 초기엔 개념이 다소 중첩되어 보일 수 있음. Workflow 매핑을 수동 부여해야 함.
- **리스크**: **낮음** — additive. 실패 시 Workflow 필드 무시하면 v1.0 동작으로 복귀.

**추천안: 대안 3.** 카테고리는 지금 대개편하지 않는다. Workflow를 별도 상위 그룹으로 additive 추가한다. (카테고리 순서 조정·Supporting 분류 같은 경량 변경은 Workflow와 분리해 별도 결정.)

---

## 6. Open Question B: Methodology Alignment

**질문:** Navigator를 무엇으로 정의하는가에 따라 목표 구조가 달라진다.

### 대안 1 — 업무 프로세스 뷰어 중심
- **장점**: 범위 명확·가벼움. 현재 구현과 가장 가까움. 유지보수 부담 최소.
- **단점**: 흐름 "표시"에 머물러 실행·표준화·산출물 관리로 확장 불가. 메타데이터(트리거·조건·역할) 축적 동기 약함.
- **리스크**: 낮음 / 단, 장기 비전(ERP 업무 표준화 플랫폼, AI 네비게이터)과 괴리.

### 대안 2 — ERP 구축 방법론 중심
- **장점**: 방법론(Methodology v1.0) 정합 최상. Workflow=표준, Variant=적용의 개념이 ERP 구축 산출물로 직결.
- **단점**: 무거움. 뷰어로서의 단순 조회 경험이 방법론 절차에 눌릴 위험. 현 사용자(현업 조회)에 과함.
- **리스크**: 중간 / 방법론 대개정 시 Frozen 원칙과 충돌 가능.

### 대안 3 — 프로세스 뷰어 + ERP 실행관리 하이브리드 (권장)
- **장점**: 현재의 뷰어 경험을 유지하면서, Workflow 메타데이터(ERP 모듈·마스터·역할·키워드)를 **선택적으로 축적**해 실행관리·AI로 확장할 여지를 연다. B안의 확장 슬롯이 정확히 이 구조.
- **단점**: 두 성격의 균형을 지속 관리해야 함(뷰어 단순성 vs 메타데이터 풍부함).
- **리스크**: 낮음~중간 — 메타데이터는 optional이라 미사용 시 뷰어로 동작, 필요 시 실행관리로 성장.

**추천안: 대안 3.** Navigator를 단순 뷰어로 못박지 않는다. 뷰어 경험을 기본으로 유지하되 ERP 실행관리·AI로 확장할 가능성을 열어둔다.

---

## 7. Recommendation

Phase 0 확정 권장 결론:

1. **Category는 당장 대개편하지 않는다.** (결정 A → 대안 3)
2. **기존 Category(Lifecycle 7종)는 유지한다.**
3. **Workflow를 별도 상위 그룹 또는 메타데이터로 추가한다** — 카테고리와 직교, additive.
4. **Variant는 당장은 Process 명명 규칙 + 보조 필드로 관리한다** — 정규 필드화는 점진.
5. **Navigator는 단순 뷰어가 아니라 ERP 실행관리 도구로 확장될 가능성을 열어둔다.** (결정 B → 대안 3)
6. **단, Phase 1에서는 최소 변경으로 데이터 모델 확장 가능성만 검토한다.** 실제 스키마 도입·마이그레이션은 Phase 1 승인 후.

이 결론은 `v1.0-baseline`의 안정성을 훼손하지 않으며, IA Review의 B안과 완전히 정합한다.

---

## 8. Phase 1 Scope Proposal

Phase 1은 **"최소 변경으로 데이터 모델 확장 가능성 검토"** 로 한정한다. 구현이 아니라 명세 확정까지.

| # | 범위 | 산출물 | 비고 |
|---|---|---|---|
| 1.1 | Workflow 최소 스키마 명세 | `workflows[]` optional 필드 정의(id, name, steps[], lifecycleGroupId, order + 확장 슬롯) | 코드 미구현, 스키마 문서만 |
| 1.2 | Process↔Workflow 매핑표 확정 | 26개 Process → Workflow/Variant 매핑 (IA Review 부록 초안 검증·확정) | 표기 불일치(§2.3-2) 정규화 규칙 포함 |
| 1.3 | 명명 규칙 정규화 기준 | `"<흐름> : <Variant>"` 표준 + 콜론 없는 6개 처리 규칙 | 데이터 수정은 Phase 2 |
| 1.4 | 하위호환·Import/Export 영향 명세 | v2 포맷에 additive 시 구버전 파일 호환 확인 문서 | 실제 코드 변경 없음 |
| 1.5 | Phase 2(구현) Go/No-Go 판단 자료 | 위 산출물 종합 결정 문서 | 승인 게이트 |

Phase 1 종료 시점에도 **코드·state.json·UI는 불변**이며, Phase 2(Sidebar IA 구현)부터 실제 변경이 시작된다.

---

## 9. Risks and Controls

| 리스크 | 영향 | 통제 |
|---|---|---|
| Workflow 매핑의 표기 불일치 (§2.3-2) | 같은 Workflow가 분열되어 그룹핑 오류 | Phase 1.3에서 정규화 기준 먼저 확정, 매핑은 ID 기준(이름 파싱 지양) |
| Category 개편 유혹 (scope creep) | R&R 구축 중단·Overview 회귀 | 결정 A 대안 3 고수 — 카테고리 데이터 이관 금지. Workflow는 additive만 |
| Methodology v1.0 Frozen 충돌 | "새 Master 신설 금지" 조항 | Workflow는 Master가 아닌 optional 그룹 메타로 도입. 필요 시 개정 사유 3호(혁신팀 Review) 경로로 DataModel.md 개정 후 진행 |
| additive 필드가 Import 시 유실 | 사용자 설정 손실 | v1.0에서 검증된 `...instance` spread 보존 패턴 재사용, 회귀 테스트 필수(선례: PR #6 laneIds 유실 버그) |
| 뷰어 단순성 vs 메타데이터 과잉 (결정 B) | UX 복잡화 | 모든 Workflow 메타 필드는 optional·숨김 기본. 실행관리 UI는 별도 Phase에서만 노출 |
| Phase 경계 붕괴 (Phase 0에서 구현 시작) | Baseline 안정성 훼손 | 본 문서 §Purpose·§8 제약 — Phase 0/1은 문서만, 코드/데이터/UI 불변 |

---

### 결정 요약 (Phase 1로 넘기는 확정 사항)

- **결정 A = 대안 3** (기존 Category 유지 + Workflow 별도 상위 그룹 추가)
- **결정 B = 대안 3** (뷰어 + ERP 실행관리 하이브리드)
- Phase 1은 **스키마 명세 + 매핑표 확정 + 명명 정규화 기준**까지. 코드/데이터/UI 불변.
