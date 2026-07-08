# Workflow / Variant IA 개선 검토

|Field|Value|
|---|---|
|Title|Process Menu IA 개선 및 Workflow 모델 설계 검토|
|Purpose|좌측 프로세스 메뉴를 Workflow(공통 흐름) × Variant(업무 유형) 구조로 개선하기 위한 현행 분석·설계안·영향도·권장안을 정리한다.|
|Status|Review|
|Owner|혁신팀|
|Last Updated|2026-07-07|
|Related Docs|`00_Project/Roadmap.md`, `01_Architecture/DataModel.md`, `02_Master/ProcessDefinition.md`, `Docs/README.md(Methodology v1.0)`|

> Review 문서다. Architecture로 승격되기 전까지는 의견으로 취급하며, 코드 변경을 수반하지 않는다.

---

## 1. 현재 구조 분석

### 1.1 Sidebar 구조

| 항목 | 현재 구현 |
|---|---|
| Component | `src/components/layout/ProcessGroupMenu.tsx` 단일 파일. `variant: 'overview' \| 'detail'` 두 렌더 갈래 |
| Tree 생성 | `buildDetailLifecycleSections()` — 정적 카테고리 배열 `PROCESS_LIFECYCLE_GROUPS`(appConfig, 7종 하드코딩)를 순회하며 `detailProcessGroups`를 카테고리별로 필터. 카테고리 해석: 그룹 데이터 `lifecycleGroupId` → appConfig 시드맵 → 첫 카테고리 fallback |
| 계층 | **2단 고정** (카테고리 → 프로세스 그룹). Workflow 중간 계층 없음 |
| Expand/Collapse | **없음** — 모든 섹션 항상 펼침. 상태는 그룹별 ⋯ 액션 메뉴 열림 여부(`actionMenuGroupId`)뿐 |
| Selected 관리 | `AppLayout`의 `selectedGroupId` + `detailProcessId` state. `uiPreferences`(localStorage)로 복원 |
| 항목 표기 | `01` 순번(섹션 내 배열 인덱스) + 그룹 이름 전체 문자열 |

### 1.2 Process Data Model

| 항목 | 현재 구현 |
|---|---|
| Process Definition | `ProcessInstance { id, type: 'overview'\|'detail', name, nodes[], edges[], zones[], laneIds?, autoHideEmptyLanes?, overviewNodeId?, source? }` — lanes/phases는 `commonMasters`에서 주입 |
| Group | `DetailProcessGroup { id, name, description, detailProcessId(1:1), lifecycleGroupId?, linkedOverviewGroupId? }` — 메뉴 항목 단위. `OverviewProcessGroup`은 Overview 강조용으로 별도 |
| Category | `appConfig.lifecycleGroups` 7종(사업시작/기준정보/구매입고/판매/반품/재고/정산) **코드 하드코딩** + `detailProcessLifecycleGroupIds` 시드맵. 순서 = 배열 순서 |
| Workflow 개념 | **부재.** 이름 문자열의 `"흐름경로 : 유형"` 관례로만 암묵 표현 |
| Node | `Node { id, name, type, laneId, phaseId, system, owner, ... }`. ID 패턴: `{processId}-step-NN`(registry) 또는 `node-{rand}`(앱 생성) |
| JSON 저장 | `state.json` v2 payload: `{ kind, version:2, exportedAt, commonMasters, processes[], overviewProcessGroups[], detailProcessGroups[] }` |
| Process ID | 슬러그 문자열. 복제/신규 시 이름 슬러그 + 유니크 suffix |

**Variant의 현재 실태 (데이터 증거):**

- `주문 등록 ~ 출고 ~ 매출 전표 : B2B 국내 / B2B 해외 / B2C` — 동일 흐름 3벌
- `구매 요청 ~ 매입 전표 생성 : 서비스 / IT, S/W / 연구개발비·F&B·물류센터소모품` — 동일 흐름 3벌
- 반면 `구매반품`, `기타입고`, `일반 재고이동`, `저장위치 등록` 등 **콜론 없는 이름 11개** 존재 → 이름 파싱만으로는 Workflow 도출 불가

### 1.3 Runtime 구조

| 항목 | 현재 구현 | Workflow 도입 시 변경 영향도 |
|---|---|---|
| Canvas | `scope(processId)` → `getProcessByScope` → 레이아웃 엔진. 프로세스 단위 렌더 | **없음** (B안 기준 — 프로세스 데이터 불변) |
| Property Panel | `selectedElement` 타입별 폼. 상세 그룹 폼에서 카테고리·표시 레인 편집 | **소** — Variant/Workflow 필드 편집 UI 추가(Phase 3) |
| Router | 저장 시 `validateRouterData` 프로세스 단위 검증 | **없음** |
| Search | **UI 미구현** (Role 권한에 `search`만 정의됨) | 영향 아님 — 신규 구현 기회(Phase 5) |
| Import | `validateImportPayload` — `kind`·`processes` 배열만 필수 검증, 나머지 필드 관용 통과 | **없음** — optional 필드 추가는 기존 파일 그대로 수용 |
| Export | 인스턴스/그룹을 그대로 직렬화(스프레드) | **소** — `workflows[]` 배열 1개 추가 |
| Sidebar | 1.1 참조 | **대** — 본 작업의 대상 |

**하위호환 선례:** `lifecycleGroupId`, `laneIds`, `autoHideEmptyLanes` 모두 "optional 필드 additive + 미지정 시 기존 동작" 패턴으로 도입되어 마이그레이션 없이 안착했다. Workflow도 같은 패턴이 성립한다.

---

## 2. IA 개선안

### 2.1 메뉴 구조 (3단 계층)

```text
구매/입고 (4)                        ← Lifecycle 카테고리 (기존)
  ▼ 구매요청 → 입고 → 매입전표        ← Workflow 헤더 (신규, 접기/펼치기)
      01 제/상품                     ← Variant (기존 프로세스 그룹)
  ▼ 구매요청 → 매입전표
      01 서비스
      02 연구개발비/F&B/소모품
      03 IT, S/W
```

- **Workflow 헤더**: 단계 요약(`steps[]` → `A → B → C` 인라인 표기) + Variant 수 뱃지. 클릭 시 접기/펼치기(신규 도입 — 현재 접기 자체가 없음). 상태는 `uiPreferences`에 저장
- **Variant 행**: `variantOrder` 순번 + `variantLabel`만 표기(중복되는 흐름 경로 문자열 제거) → 메뉴 길이 대폭 축소
- **Workflow 미지정 프로세스**: 기존처럼 카테고리 직속으로 전체 이름 표시 (fallback — 점진 전환 가능)
- Variant가 1개뿐인 Workflow는 헤더 없이 단일 행으로 접어 표기(과계층화 방지)

### 2.2 기준정보 재배치

- `lifecycleGroups`에 `supporting?: true` 플래그 추가, 메뉴 하단 "Supporting Process" 구획으로 분리 렌더
- 순서 변경은 appConfig 배열 순서 조정으로 충분 (데이터 무변경)

> **열린 질문 ①(결정 필요):** 요청안의 순서 `사업시작/구매/판매/정산/재무/기준정보`에는 현행 카테고리 중 **반품·재고가 없고 재무가 신규**다. (a) 반품→판매 하위 Workflow로 흡수? (b) 재고→구매 또는 Supporting? (c) "재무"는 현재 구축 제외범위(회계관리)와의 경계 정의 필요. 카테고리 개편은 데이터(`lifecycleGroupId`) 이관을 수반하므로 Workflow 도입과 별도 결정으로 분리할 것을 권장.

---

## 3. Data Model 검토 — 3안 비교

### A안: 변경 없음 (이름 파싱)

이름의 `" : "` 앞뒤를 파싱해 UI에서만 그룹핑.

- 장점: 즉시 구현(0.5일), 데이터 무변경
- 단점: **콜론 없는 11개 프로세스 처리 불가**, 이름 수정 시 그룹 와해, Workflow 단계(`↓` 표기)·순서·메타데이터를 둘 곳이 없음 → **AI 확장(Phase 6) 불가**, 표기 규칙이 사실상 스키마가 되는 안티패턴

### B안: 최소 Workflow 개념 추가 (권장)

```ts
// payload에 optional 배열 추가
Workflow {
  id: string                 // 'wf-purchase-to-ap'
  name: string               // '구매요청 → 입고 → 매입전표'
  steps: string[]            // ['구매요청', '입고', '매입전표'] — 표시용, 노드와 미연결
  lifecycleGroupId: ProcessLifecycleGroupId
  order: number
  description?: string
  // ── Phase 6 확장 슬롯 (모두 optional) ──
  searchKeywords?: string[]
  aiKeywords?: string[]
  tags?: string[]
  relatedErpModules?: string[]
  requiredMasterData?: string[]
  requiredRoles?: string[]
  relatedWorkflowIds?: string[]
  trigger?: string
  entryCondition?: string
  exitCondition?: string
}

// DetailProcessGroup에 optional 필드 추가
DetailProcessGroup {
  ...기존 필드,
  workflowId?: string
  variantLabel?: string      // '제/상품', 'B2B 해외'
  variantOrder?: number
}
```

- 장점: Process/Node ID·JSON·Canvas·Router **완전 불변**. 검증된 additive 패턴. `steps`는 표시용 문자열이라 노드 구조와 결합하지 않음(향후 C안으로 승격 가능한 진화 경로). AI 메타데이터의 자연스러운 귀속처 확보. 복제 흐름과 결합: "복사해서 새로 만들기" 시 동일 `workflowId` + 새 `variantLabel` 입력 → **Variant 추가가 곧 복제**라는 직관적 UX
- 단점: Workflow 엔티티 등록·편집 UI 필요(1~2일). Workflow-단계와 실제 노드가 미연결이므로 단계 표기는 수동 관리

> **열린 질문 ②(방법론 정합):** Methodology v1.0은 Frozen이며 "새로운 Master를 만들지 않는다"고 명시한다. Workflow 엔티티가 Master 신설에 해당하는지 해석이 필요하다. 단, Methodology 개정 허용 사유 3호("혁신팀 내부 Review에서 변경 필요 결정")가 있으므로, 본 Review 승인 → `DataModel.md`/`ProcessDefinition.md` 개정 → 구현 순서를 밟으면 원칙과 충돌하지 않는다.

### C안: Workflow 중심 재설계

Workflow를 1급 엔티티로, Process를 Workflow의 Variant 인스턴스로 종속시키고 단계-노드를 링크, 카테고리도 데이터로 이관.

- 장점: 개념 정합성 최상. 단계-노드 링크로 "이 Variant는 표준 흐름에서 어디가 다른가" 자동 diff 가능 — ERP 표준화 관점의 최종형
- 단점: 전 데이터 마이그레이션(ID 체계 포함), Canvas/Router/Import·Export 전면 회귀 검증, Methodology 대개정. **현재 최우선인 R&R Process 구축을 수 주 블로킹.** "Platform 개선은 실제 불편 발생 시에만"(Docs/README) 원칙과도 긴장

---

## 4. 영향도 분석 (안별)

| 영역 | A안 | B안 | C안 |
|---|---|---|---|
| Runtime(Store/mutation) | 없음 | 소 (workflows CRUD 추가) | 대 |
| Canvas | 없음 | **없음** | 중~대 |
| Property Panel | 없음 | 소 (그룹 폼에 Workflow/Variant 필드) | 대 |
| Router | 없음 | 없음 | 중 |
| Search(신규) | 이름 검색만 | Workflow 메타 기반 검색 가능 | 최적 |
| Import/Export | 없음 | 소 (optional 배열 1개, v2 유지) | 대 (v3 필요) |
| 저장 포맷 | 없음 | additive — 구버전 파일 그대로 열림 | 파괴적 |
| 기존 21+ 프로세스 데이터 | 무변경 | 무변경 (workflowId 매핑만 점진 부여) | 전체 이관 |
| AI 확장성 | 불가 | 충분 (질의→keywords/variantLabel 매칭) | 최적 |

**AI Navigator 시나리오 검증 (B안 기준):**
"응원봉 구매 프로세스 알려줘" → `aiKeywords/variantLabel`에서 '응원봉' 매칭 → Workflow `구매요청→입고→매입전표` + Variant `응원봉` 반환. Workflow의 `steps`·`relatedErpModules`·`requiredRoles`가 응답 컨텍스트를 구성. **B안 스키마로 요구 시나리오 3종 모두 충족** — C안 없이 가능.

---

## 5. 구현 계획 (WBS, B안 기준)

| Phase | 내용 | 규모 | 선행 조건 |
|---|---|---|---|
| 0 | 본 Review 승인 + `DataModel.md`·`ProcessDefinition.md` 개정 + Workflow 목록/매핑표 확정(부록 초안 참조) | 0.5일 | 열린 질문 ①② 결정 |
| 1 | Sidebar IA: workflows[]·그룹 필드 추가 + 3단 메뉴/접기 렌더 (미지정 프로세스 fallback 유지) | 1.5~2일 | Phase 0 |
| 2 | Workflow Group 관리: 등록/편집/삭제 UI + mutation | 1~1.5일 | Phase 1 |
| 3 | Variant UI: 그룹 폼 필드 편집 + 복제 시 workflowId 승계·variantLabel 입력 | 1일 | Phase 1 |
| 4 | 기준정보 재배치: supporting 구획 + 순서 변경 (카테고리 개편은 별도 결정) | 0.5일 | 열린 질문 ① |
| 5 | Search: 이름+variantLabel+searchKeywords 필터 검색 | 1~2일 | Phase 1 |
| 6 | AI Metadata: 확장 필드 편집 UI + 작성 가이드 문서 + 기존 Workflow에 키워드 부여(데이터 작업) | 설계 0.5일 + 데이터 별도 | Phase 2 |

각 Phase는 독립 PR로 진행 가능하며, Phase 1 완료 시점부터 사용자 체감 개선이 시작된다.

---

## 6. 권장안

**B안 (최소 Workflow 개념 추가)** 를 권장한다.

| 평가 기준 | A | **B** | C |
|---|---|---|---|
| 확장성 (AI/검색/표준화로의 진화) | ✗ | **◎** (C로 자연 승격 경로 보유) | ◎ |
| 유지보수성 | △ (이름 규칙이 숨은 스키마) | **◎** (명시 스키마, additive) | ○ (개념은 깔끔하나 코드량 급증) |
| AI 검색 활용성 | ✗ | **○~◎** (요구 시나리오 전부 충족) | ◎ |
| ERP 표준화 적합성 | △ | **○** (Workflow=표준, Variant=적용) | ◎ |
| 리스크/일정 (R&R 구축 병행) | ◎ | **○** (5~7일, 단계별 PR) | ✗ (수 주 블로킹) |
| Methodology v1.0 정합 | ◎ | **○** (Review 승인 경로로 해소) | ✗ (대개정 필요) |

**핵심 논거:** C안이 지향점으로서 옳더라도, B안은 C안의 부분집합이 되도록 설계되어 있다(steps 표시용 → 추후 노드 링크 승격, 카테고리 하드코딩 → 추후 데이터 이관). 지금 C안을 선택하면 얻는 것은 "단계-노드 자동 diff"뿐인데 그 대가가 R&R 구축 중단이다. **B안으로 IA·AI 기반을 먼저 확보하고, 단계-노드 링크가 실제로 필요해지는 시점(예: Variant 간 차이 자동 비교 요구)에 C안 요소를 증분 도입**하는 것이 이 프로젝트의 원칙(Architecture 우선, 실불편 기반 Platform 개선, additive 하위호환)과 가장 정합한다.

---

## 부록: Workflow 후보 매핑 초안 (승인 전 확정 필요)

| Workflow (steps) | Variants (현행 프로세스) | 카테고리 |
|---|---|---|
| 사업기회 → 계약 → 구매요청 | 제/상품 | 사업 시작 |
| 사업기회 → 비용전표 생성 | 서비스 | 사업 시작 |
| 구매요청 → 입고 → 매입전표 | 제/상품 | 구매/입고 |
| 구매요청 → 매입전표 | 서비스, IT·S/W, 연구개발비·F&B·소모품 | 구매/입고 |
| 주문 → 출고 → 매출전표 | B2B 국내, B2B 해외, B2C, 매장, 공연장/팝업 | 판매 |
| 예약판매 → 출고 → 매출전표 | B2C | 판매 (별도 Workflow) |
| 이벤트 판매 | 제/상품 | 판매 |
| 주문반품 → 입고 → 반품전표 | B2B 국내, B2C | 반품 |
| 구매반품 | 단일 | 반품 |
| 재고이동 | 일반, 매장 간 | 재고 |
| 기타입고 / 기타출고 | 각 단일 | 재고 |
| 정산 | 로열티, 위탁, 수익배분, 프로젝트 | 정산 (단계 상이 시 분리) |
| 저장위치 등록 | 단일 | 기준정보(Supporting) |

콜론 없는 프로세스들은 "Variant 1개짜리 Workflow"로 수용 가능하므로 A안의 파싱 한계가 B안에서는 문제되지 않는다.
