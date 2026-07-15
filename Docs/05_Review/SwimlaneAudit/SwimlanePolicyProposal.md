# Swimlane Policy Proposal

이 문서는 Workshop용 Process의 기본 Swimlane 정책과 구현 방향 제안이다.

## Proposed Canonical Policies

### Default Five Lane Policy

| Order | Canonical ID | Label |
| ---: | --- | --- |
| 1 | business | 사업 |
| 2 | procurement | 구매 |
| 3 | logistics | 물류센터 |
| 4 | sales | 매장/POS |
| 5 | finance | 재무 |

적용 대상:

- 일반구매 3 lane 예외를 제외한 대부분의 Workshop Process
- lane 정의가 없거나 깨진 process
- 신규 process 기본값

정책:

- 5개 lane을 모두 표시한다.
- node가 없는 lane도 표시한다.
- node가 없는 기본 lane은 숨기지 않고 약하게 표시한다.
- 기존 node의 `laneId`는 임의 변경하지 않는다.

### General Purchase Three Lane Policy

| Order | Canonical ID | Label |
| ---: | --- | --- |
| 1 | business | 요청부서 |
| 2 | procurement | 구매 |
| 3 | finance | 재무 |

현재 적용 후보:

- `구매-요청-매입전표-생성-인사총무`
- `구매-요청-매입-전표-생성-it-s-w`

보류:

- `구매-요청-매입-전표-생성-f-b`

F&B는 Workshop Menu v1에서 프로젝트 구매 위치에 1회 노출되었고, 프로젝트 구매인지 일반구매인지 확정되지 않았다. 따라서 3 lane 일반구매 정책으로 임의 분류하지 않는다.

## Policy Resolver Priority

제목 문자열 기반 판정을 최소화하고 다음 순서로 판정한다.

1. `DetailProcessGroup.workflowId`
2. `DetailProcessGroup` 또는 future process family metadata
3. Workshop navigation metadata
4. legacy title fallback

현재 즉시 사용할 수 있는 안정적 신호:

| Signal | Use |
| --- | --- |
| `detailProcessGroups[].workflowId` | 구매/판매/정산/재고 계열 구분 |
| `detailProcessGroups[].detailProcessId` | HR/GA, IT/SW 일반구매처럼 현재 명확한 예외 판정 |
| `workshopMenuConfig` | Workshop live menu의 label/context 보조 신호 |

## Recommended Implementation Strategy

### Phase 1: Presentation Layer Fix

Runtime/state migration 없이 다음을 구현한다.

1. canonical lane definitions를 코드 상수로 둔다.
2. lane policy resolver를 추가한다.
3. visible lane builder에서 다음을 결합한다.
   - explicit process lanes
   - policy default lanes
   - node가 참조하는 canonical lanes
   - unresolved legacy lane warnings
4. 기본 5 lane policy process에서는 single-lane collapse를 적용하지 않는다.
5. 일반구매 policy process에서는 3 lane만 표시한다.
6. node가 참조하는 lane은 반드시 visible lane에 포함한다.
7. legacy `laneIds` 때문에 빠진 canonical lane은 validation warning으로 남긴다.

이 방식은 기존 state를 변경하지 않으면서 "node가 존재하는데 lane이 안 보이는" 문제를 해결한다.

### Phase 2: Data Normalization Decision

별도 승인 후 다음을 검토한다.

- process별 `laneIds` legacy ID를 canonical ID로 정규화
- `autoHideEmptyLanes`가 Workshop 기본 정책과 충돌하는 process 재검토
- `business-to-project` legacy detail process 유지/삭제/병합
- 일반구매 lane label을 `business: 요청부서`처럼 policy-specific label override로 처리할지 결정

## Default Five Lane Targets

현재 local detail process 28개 중 일반구매 3 lane 후보 2개를 제외한 26개가 default-five 정책 후보이다.

`business-to-project`는 E2E 개념의 유효 Detail Process로 유지하며 default-five 정책을 적용한다. Workshop Menu v1 live menu 노출 여부는 이번 작업 범위에서 변경하지 않는다.

## General Purchase Three Lane Targets

| Process ID | Process명 | Basis |
| --- | --- | --- |
| 구매-요청-매입전표-생성-인사총무 | 구매 요청 ~ 매입전표 생성 : 인사총무 | current runtime laneIds가 `business/procurement/finance`이며 일반구매로 승인됨 |
| 구매-요청-매입-전표-생성-it-s-w | 구매 요청 ~ 매입전표 생성 : IT, S/W | current runtime used lanes가 `business/procurement/finance`이며 일반구매로 승인됨 |

## Exclusions / Pending

| Process ID | Reason |
| --- | --- |
| 구매-요청-매입-전표-생성-f-b | F&B가 프로젝트 구매인지 일반구매인지 미확정 |
| service-purchase-to-ap | Workshop Menu v1에서 프로젝트 > 공연/콘텐츠/플랫폼으로 연결되어 일반구매로 보지 않음 |
| service-business-to-expense | Workshop Menu v1 unresolved. 사업관리 위치 확인 전 lane policy 확정 보류 |
| service-order-to-sales | Workshop Menu v1 unresolved. 판매 > 서비스매출 필요 여부 확인 전 lane policy 확정 보류 |
| storage-location-master | 기준정보 노출 여부 unresolved |

## Data Modification Need

| Question | Answer |
| --- | --- |
| 즉시 데이터 수정 필요? | 아니오 |
| 표현 계층만으로 해결 가능? | 예, 대부분 가능 |
| 영구 정규화에는 migration 필요? | 예, legacy `laneIds`를 제거/변환하려면 필요 |
| 저장 API 수정 필요? | Phase 1에서는 불필요 |
| Runtime state schema 변경 필요? | Phase 1에서는 불필요 |

## Risk And Rollback

| Risk | Mitigation | Rollback |
| --- | --- | --- |
| 기존 명시 lane 순서를 덮어쓸 위험 | policy builder는 render projection만 생성하고 state를 변경하지 않는다. | builder import 제거 후 기존 `resolveProcessWithMasters()` 경로로 복귀 |
| 일반구매 판정 오류 | workflowId + explicit process ID allowlist로 시작한다. | allowlist 제거 |
| single-lane collapse 기존 UX 변화 | default-five policy 대상에만 collapse를 제한한다. | collapse 조건을 기존 함수로 되돌림 |
| 빈 lane 증가로 화면 폭 증가 | 기본 lane은 5개 고정, 일반구매는 3개로 제한한다. | policy 적용 범위 축소 |
| legacy laneIds 보존으로 warning 지속 | validator warning으로 노출하고 별도 migration을 후속 결정한다. | validator 비활성화 |

## Tests To Add If Approved

1. 기본 policy process는 5개 lane을 항상 visible lane으로 만든다.
2. 일반구매 policy process는 요청부서/구매/재무 3개 lane만 visible lane으로 만든다.
3. node가 참조하는 canonical lane은 visible lane에 반드시 포함된다.
4. node가 없는 기본 lane도 visible lane에 남는다.
5. 기존 explicit lane 정의는 state에서 변경되지 않는다.
6. legacy `laneIds`로 인한 orphan lane reference를 감지한다.
7. 같은 label의 중복 lane을 감지한다.
8. process clone 후 laneIds와 node.laneId 참조가 유지된다.
9. save/reload 후 laneIds/autoHideEmptyLanes가 유지된다.
10. Workshop Menu 전환 후 동일 process graph가 유지된다.

## Implementation Gate

구현 전 승인 필요 항목:

1. Phase 1을 presentation-layer fix로 진행할지
2. 일반구매 3 lane 대상 allowlist를 HR/GA와 IT/SW 2개로 시작할지
3. F&B lane policy를 default-five로 유지할지
4. legacy `laneIds` 정규화 migration은 이번 작업에서 제외할지

## Implementation Update

확정 정책에 따라 `src/lib/layout/detailSwimlaneProjection.ts`에서 visible lane projection을 구현한다.

- 일반 Detail Process: `business -> procurement -> logistics -> sales -> finance`
- 일반구매 예외: `business -> procurement -> finance`
- 일반구매 예외라도 node가 다른 canonical lane을 참조하면 canonical order에 맞춰 추가 표시
- legacy alias는 projection에서만 해석하고 Runtime/state 값은 변경하지 않음
- `sales` ID는 유지하고 화면 표기만 `매장/POS`
- `logistics` 화면 표기는 `물류센터`
