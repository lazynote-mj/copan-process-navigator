# ADR-012 — Execution Domain Source of Truth & Assignment Layer

|Field|Value|
|---|---|
|Status|Accepted|
|Date|2026-07-12|
|Owner|혁신팀|
|Builds on|[ADR-011 Canonical Process Model](ADR-011-Canonical-Process-Model-Layer-Separation.md)|

## Context
로드 시 `syncDetailProcessesFromRegistry`가 `data.processes`의 nodes/edges를 registry(`src/data/processes`) canonical로 덮어쓴다. registry는 state.json과 다른 legacy lane 스킴(`lane-purchasing` 등)을 쓴다. Execution Domain 데이터의 소유자를 확정하지 않으면 마이그레이션이 registry sync로 되돌려질 수 있다.

## Decision — Layered canonical (⑤)

| 데이터 | Canonical Source |
|---|---|
| Node → executionDomainId(=`laneId`) | **registry** (런타임 참조 carrier; Business 도메인 id로 정규화/변환) |
| Execution Domain 마스터 / Organization 마스터 | **commonMasters** (Business Layer, sync 안전) |
| Domain → Organization assignment | **state · DetailProcessGroup** (sync 안전) |

**Assignment 계층 = Hybrid**: `DetailProcessGroup`(Variant) 기본 assignment + Process fallback(group 없는 process) + `Node.organizationId` override. 근거: DetailProcessGroup은 `data.detailProcessGroups`에 별도 저장되어 registry sync 영향 밖(=배정 유실 없음)이고, workflowId로 상위 정책 확장 가능. (Variant:Process=1:1이라 "중복 감소"가 아니라 **registry 안전성·정책/구조 분리·확장성**이 근거.)

**조직 해석 우선순위:** `node.organizationId ?? group.domainAssignments[laneId] ?? process.domainAssignments[laneId] ?? (미래 workflow) ?? undefined`

**필드명:** `laneId` 유지, 의미만 Execution Domain ID로 전환. 전면 rename은 후속 ADR.

## Migration 원칙 (WP1)
- idempotent(이미 canonical/synthetic 도메인이면 identity), schemaVersion 게이트로 lossy assignment 추출 1회.
- unknown lane → synthetic 도메인 + warning(무손실). `lane-requester`/`lane-erp`는 하드코딩 금지 → ambiguous + `LEGACY_MAPPING_AMBIGUOUS` + confidence.
- 매핑은 config/module 소유, 렌더러 하드코딩 금지.
- **결정 필요(후속)**: registry 24파일 domain-native 변환 vs load-time normalization 영구 유지.

## Consequences
- (+) registry-sync가 배정·마스터를 훼손하지 않음(최대 리스크 해소).
- (−) registry의 legacy lane id를 Business 도메인에 conform시키는 정규화/변환 필요.

## Related
- ADR-011 (Layer Separation), ADR-008 (Navigation), ADR-001 (Workflow/Variant).
- 구현: `src/data/executionDomainMigration.ts`, `src/types/{process,commonMasters,toBeNavigator}.ts`.
