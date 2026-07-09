# ADR-007 — Data-first Approval and Runtime Governance Layer

|Field|Value|
|---|---|
|Status|Proposed|
|Date|2026-07-09|
|Owner|혁신팀|
|Builds on|[ADR-005 Navigator Runtime Model](ADR-005-Navigator-Runtime-Model.md), [ADR-006 Change Set Architecture](ADR-006-Change-Set-Architecture.md)|
|Related|[ADR-002 Graph First](ADR-002-Graph-First.md), [Phase 5 WBS](../08_Implementation/Phase-5-Navigator-Runtime-ChangeSet-WBS.md), [Navigator IA](../05_Review/Codex/Navigator-Phase3-Concept.md)|

> ADR-005/006이 **Runtime을 어떻게 저장·변경할 것인가**를 확정했다. ADR-007은 그 Runtime 위에 **거버넌스·승인 계층**을 어떤 원칙으로 얹을지를 제안한다. **Architecture 제안 수준**이며, 타입은 draft로만 제시하고 구현·UI·런타임 동작 변경은 다루지 않는다(후속 WP의 몫). 본 ADR은 프로세스 흐름을 재설계하지 않는다.

---

## Context

- **Runtime Phase 1**은 [ADR-005 §D3] 기준의 **Runtime Persistence Baseline**으로 확정됐다(WP1, main `a5ae3a8`). 아래가 그 완료 경계다.
- Navigator는 **문서 우선(document-first) 결재 시스템이 아니다.** 기존 전결규정(위임전결) 문서는 **참조용 거버넌스 입력**이지, 워크플로의 정본(canonical source)이 아니다.
- TO-BE 목표는 **Data-first Approval**이다:
  1. 업무 데이터 / 마스터 데이터가 **먼저** 생성된다.
  2. ERP 코드와 구조화 레코드가 생성된다.
  3. 승인은 **구조화된 데이터 레코드에 대해** 수행된다.
  4. 문서는 그 **이후에 승인 산출물(artifact)로** 생성된다.
- 즉 "결재 문서를 만들고 그 문서를 승인"하는 AS-IS 흐름이 아니라, "데이터를 만들고 그 데이터를 승인하며 문서는 결과물"인 흐름을 1급으로 삼는다.

### Runtime Phase 1 완료 경계 (WP1)

| 영역 | 확정 내용 | 근거 |
|---|---|---|
| Runtime Persistence | `state.json` = persistence checkpoint, Runtime = 1급 변경 대상 | ADR-005 §D1 |
| Migration | `version:2` → `schemaVersion:2` 매핑, forward-only | ADR-005 §D3 / WP1 |
| IO | load/save가 `schemaVersion ?? version` 기반 분기 | WP1 |
| Versioned loading/saving | content `version` 도입(없으면 1), persist는 apply 하류 checkpoint | ADR-005 §D3 |
| Tests | legacy hydrate·roundtrip·dirty 제외·content version 보존 | WP1 test suite |

> Phase 1은 **"무엇을 어떻게 저장/버전관리하는가"** 를 고정했다. Phase 2는 그 위에 **"무엇을 검증하고 어떻게 승인하는가"** 를 얹는다. Phase 1의 계약(단일 writer·schemaVersion·additive·projection 미저장)은 Phase 2에서도 그대로 상속된다.

---

## Decision

> **Navigator에 Data-first Approval을 지원하는 Runtime Governance Layer를 additive하게 도입한다.**
> 거버넌스·승인·문서 산출물은 **기존 프로세스 흐름(Node/Edge/Lane)을 재설계하지 않고**, Runtime Entities에 optional 계층으로 얹힌다.
> 승인은 **구조화된 데이터 레코드**를 대상으로 하고, 문서(DocumentArtifact)는 승인 이후 생성되는 **산출물**이다.
> 전결규정 문서는 GovernanceRule/ApprovalPolicy를 **도출하는 참조 입력**이며, 그 자체가 워크플로 정본이 아니다.

### Runtime Phase 2 Target (범위)

| 대상 | 성격 |
|---|---|
| Runtime Validation | 레코드/엔티티 불변식 검증 (ADR-006 §D5 semantic 검증의 확장 지점) |
| Runtime State | 세션 운영 상태 (persist 대상 아님, ADR-005 §D3 dirty/version 계열) |
| Business Rule / Governance Rule | 선언적 거버넌스 규칙 (전결규정 등에서 도출) |
| Approval Policy | 승인 경로를 도출하는 정책 |
| Approval Route | 정책이 만들어낸 실제 승인 경로(step 집합) |
| Document Artifact | 승인 이후 생성되는 문서 산출물 |
| Future Execution Engine | 정책→경로→검증→상태 전이를 처리하는 실행 엔진 (후속 Phase) |

---

## Draft TypeScript Type Extensions (제안 · 미구현)

> 아래는 **draft**다. 실제 파일에 추가하지 않았고, 본 ADR은 코드를 구현하지 않는다.
> 모든 신규 필드는 **additive·optional**이며, 없으면 현행 Runtime이 그대로 동작한다(ADR-005 하위호환 원칙).
> ERP 특정 값(모듈명·전표코드 등)은 타입에 **하드코딩하지 않는다** — `string`/`metadata`로 표현하고 해석은 정책/데이터에 위임한다.

```ts
// ── Governance ────────────────────────────────────────────────
type GovernanceRuleId = string

interface GovernanceRule {
  id: GovernanceRuleId
  name: string
  description?: string
  /** 규칙이 적용되는 대상 계층 */
  scope: 'global' | 'workflow' | 'process' | 'record'
  /** 대상 엔티티 ID (workflowId 등, ID 기준 — ADR-005 §D5). 미지정=scope 전체 */
  targetRef?: string
  /** 규칙 종류 */
  kind: 'validation' | 'approval' | 'constraint'
  /** 엔진-무관 선언적 술어. 평가는 Future Execution Engine의 몫 */
  expression?: string
  severity?: 'block' | 'warn' | 'info'
  /** 규칙의 출처. 전결규정 문서는 정본이 아니라 참조 입력이다 */
  source?: 'delegation-of-authority' | 'policy' | 'manual'
  metadata?: Record<string, unknown>
}

// ── Approval ──────────────────────────────────────────────────
type ApprovalStatus =
  | 'draft'
  | 'pending'
  | 'in_review'
  | 'approved'
  | 'rejected'
  | 'withdrawn'
  | 'delegated'

type ApprovalPolicyId = string
type ApprovalRouteId = string

interface ApprovalStep {
  id: string
  /** 경로 내 순서 (1-based) */
  order: number
  /** 승인 주체는 역할 기준 — 특정 ERP 사용자/사번 하드코딩 금지 */
  approverRole: string
  /** 런타임에 해소된 실제 actor id (optional) */
  approverRef?: string
  /** 이 step을 지배하는 정책 */
  policyRef?: ApprovalPolicyId
  status: ApprovalStatus
  /** step 진입 가드 술어 (엔진-무관) */
  condition?: string
  decidedAt?: string
  comment?: string
}

interface ApprovalRoute {
  id: ApprovalRouteId
  name: string
  steps: ApprovalStep[]
  /** 승인 대상 = 구조화된 데이터 레코드 (Data-first). 문서가 아니다 */
  targetRecordRef?: string
  /** 경로 집계 상태 */
  status: ApprovalStatus
  createdAt: string
}

interface ApprovalPolicy {
  id: ApprovalPolicyId
  name: string
  description?: string
  /** 정책 적용 대상 */
  appliesTo: { entity: 'workflow' | 'record' | 'businessObject'; ref?: string }
  /** 정책이 조합하는 거버넌스 규칙들 */
  governanceRuleRefs?: GovernanceRuleId[]
  /** 경로 도출 템플릿 (정책 → 경로 생성 규칙) */
  routeTemplate?: Pick<ApprovalRoute, 'name' | 'steps'>
  /** 금액 구간 등 임계값 — 엔진-무관 표현, ERP 하드코딩 금지 */
  thresholds?: Record<string, unknown>
  source?: 'delegation-of-authority' | 'manual'
}

// ── Document Artifact (승인 이후 생성물) ───────────────────────
interface DocumentArtifact {
  id: string
  kind: 'approval' | 'record' | 'report' | 'export'
  /** 어떤 레코드/승인경로에서 파생됐는가 (Data-first: 데이터가 원천) */
  generatedFrom: { recordRef?: string; approvalRouteRef?: ApprovalRouteId }
  format?: 'pdf' | 'hwp' | 'json' | 'html'
  createdAt: string
  uri?: string
  metadata?: Record<string, unknown>
}

// ── Runtime State (세션 상태 · 미저장) ─────────────────────────
interface RuntimeState {
  /** 로드된 Runtime의 content 버전 미러 (ADR-005 §D3) */
  contentVersion: number
  loadedAt: string
  /** 세션 메타 — persistence 제외 (ADR-005 §D3) */
  dirty: boolean
  /** 진행 중 승인 경로 (projection · 미저장 — ADR-005 §D8) */
  activeApprovalRoutes?: ApprovalRouteId[]
  validationStatus?: 'unknown' | 'valid' | 'invalid'
}
```

---

## 기존 모델과의 관계

| 기존 | 관계 |
|---|---|
| **`ProcessData`** ([src/types/processData.ts](../../src/types/processData.ts)) | Governance 엔티티(`governanceRules?`/`approvalPolicies?`/`approvalRoutes?`/`documentArtifacts?`)는 `relations?`/`journeys?`와 **동일한 additive·optional 최상위 배열** 패턴으로 얹힌다(ADR-005 §D3). 없으면 현행 동작. `RuntimeState`는 이미 존재하는 세션 메타(`version`·`dirty`)와 정합하며 **저장하지 않는다**. |
| **`ProcessNode`(`Node`)** ([src/types/process.ts](../../src/types/process.ts)) | Node는 **프로세스 흐름 단계**다. 승인/거버넌스는 **레코드·workflow 계층**에 붙으며 Node 흐름을 **재설계하지 않는다**. Node의 `inputs/outputs`(데이터 흐름)·`controls`는 향후 GovernanceRule의 참조 대상이 될 수 있으나, 본 ADR은 그 매핑을 강제하지 않는다. |
| **`Workflow`** ([src/types/workflow.ts](../../src/types/workflow.ts)) | `ApprovalPolicy.appliesTo.entity==='workflow'`가 `workflowId`를 참조(ID 기준, ADR-005 §D5). Workflow의 기존 확장 슬롯(`relatedErpModules`/`requiredMasterData`/`requiredRoles`)이 거버넌스 도출의 자연스러운 접점이다 — 스키마 재설계 불필요. |
| **Runtime Persistence (WP1)** | 신규 거버넌스 엔티티가 **저장될 때** WP1의 계약을 그대로 따른다: `schemaVersion` 게이트, forward-only, content `version`으로 변경 추적, **projection·index는 미저장**(ADR-005 §D8). 승인 상태 전이는 향후 Change Set(ADR-006)의 command로 표현 가능하다(단일 apply 경계·atomic·version++1회). |

> **Data-first 흐름 정합:** 마스터/업무 데이터 → 구조화 레코드 → (레코드에 대한) ApprovalRoute → 승인 → DocumentArtifact. 문서는 항상 **하류 산출물**이며 승인의 입력이 아니다.

---

## Implementation Guardrails

- **No UI changes** — 본 Phase는 타입/아키텍처 제안까지. 시각화는 WP2.5로 명시 연기.
- **No runtime behavior changes** — 로드/저장/변경 동작을 바꾸지 않는다.
- **No process redesign** — Node/Edge/Lane/기존 흐름을 재설계하지 않는다.
- **No ERP-specific hardcoding** — 모듈·전표·코드값을 타입에 박지 않는다(`string`/`metadata`/정책 위임).
- **No AS-IS document-first approval modeling** — "문서를 만들고 문서를 승인"하는 모델을 도입하지 않는다. 승인 대상은 레코드다.
- **Navigator = process operating layer, not an ERP screen clone** — ERP 화면을 복제하지 않고, 프로세스 운영 계층으로 유지한다.

---

## Recommended Next Work Packages

| WP | 이름 | 범위 | 산출물 성격 |
|---|---|---|---|
| **WP2.1** | Governance Type Model | 위 draft 타입을 additive·optional로 실제 도입(`GovernanceRule`/`ApprovalPolicy`/`ApprovalRoute`/`ApprovalStep`/`ApprovalStatus`/`DocumentArtifact`/`RuntimeState`) | 타입만, 런타임 동작 무변경 |
| **WP2.2** | Runtime Validation Baseline | ADR-006 §D5 semantic 검증을 거버넌스 규칙 훅까지 확장(참조 무결성·불변식) | 검증 계층, 순수 함수 |
| **WP2.3** | Approval Policy Resolver | ApprovalPolicy → ApprovalRoute 도출 로직(정책 해소기) | 순수 resolver, 미UI |
| **WP2.4** | Document Artifact Mapping | 승인 완료 → DocumentArtifact 생성 매핑(데이터→문서, 단방향) | 매핑 계층 |
| **WP2.5** | UI Visualization (Later) | 거버넌스/승인 경로 시각화 | **명시적 연기** |

> 착수 순서는 WP2.1 → WP2.2 → WP2.3 → WP2.4 (WP2.5는 이후). 각 WP는 Phase 5 WBS와 동일하게 "영향 범위 확인 → 최소 설계 → 구현 → 검증 → 별도 PR(머지 보류)"을 따른다.

---

## Consequences

- (+) **Data-first 승인 모델 확정** — 문서가 아니라 레코드가 승인 대상임을 아키텍처로 고정.
- (+) **Additive 하위호환** — 거버넌스 미도입 시 현행 Runtime 그대로(v1 복귀 가능).
- (+) **Phase 1 계약 상속** — schemaVersion·single writer·projection 미저장·Change Set apply 경계를 재사용, 별도 저장 메커니즘 불필요.
- (+) **거버넌스 입력 분리** — 전결규정(AS-IS)은 규칙 도출 참조로만 취급, 정본 오염 방지.
- (−) **실행 엔진 필요** — 규칙 평가·정책 해소·상태 전이는 Future Execution Engine(후속 Phase) 구축 전제.
- (−) **범위 규율 필요** — ERP 화면 복제/문서 우선 모델로의 표류를 guardrail로 지속 차단해야 함.
- **범위 한계**: 본 ADR은 제안(Proposed)이다. 타입 실도입·검증·resolver·문서 매핑은 WP2.1~2.4에서 다루며, UI는 WP2.5로 연기한다.

## Related

- 상속: [ADR-005](ADR-005-Navigator-Runtime-Model.md) §D3·§D5·§D8 · [ADR-006](ADR-006-Change-Set-Architecture.md) §D5
- 실행계획 접점: [Phase 5 WBS](../08_Implementation/Phase-5-Navigator-Runtime-ChangeSet-WBS.md) (Runtime/Change Set 기반)
- 원칙: [Navigator IA](../05_Review/Codex/Navigator-Phase3-Concept.md) §8(AI Consumer)
