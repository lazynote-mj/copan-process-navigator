# Swimlane Issues

이 문서는 Swimlane 표시 누락의 원인 분류와 코드 위치를 정리한다.

## Primary Issue

현재 master lane은 canonical 5개(`business`, `procurement`, `logistics`, `sales`, `finance`)로 정리되어 있다.

하지만 여러 detail process의 `laneIds`는 과거 lane ID를 포함한다.

| Legacy ID | 현재 master에 존재 여부 | 현재 canonical 후보 |
| --- | --- | --- |
| partnership | 없음 | procurement |
| warehouse-easyadmin | 없음 | logistics |
| retail-easychain | 없음 | sales |
| lane-mr8i71rk-rr7ki | 없음 | procurement 또는 별도 조직 메타 |

`resolveProcessWithMasters()`는 `laneIds`가 있으면 master lane 중 해당 ID만 필터링한다. legacy ID는 master에 없으므로 사라지고, 결과적으로 `business`, `finance`만 남는 process가 많다.

그 후 `Node.laneId`가 이미 canonical `logistics`, `sales`, `procurement`를 참조하더라도, process의 resolved lane 정의에 해당 lane이 없으면 렌더링/레이아웃에서 누락된다.

## Issue Classification

| Classification | Severity | Repro Process | Code Location | Finding |
| --- | --- | --- | --- | --- |
| legacy-canonical-mismatch | high | `popup-concert-stock-sales-sync`, `purchase-return`, `b2c-order-to-sales` 등 15개 | `src/types/processData.ts` `resolveLanesForInstance()` | `laneIds`에 legacy ID가 남아 있고 master는 canonical ID라 필터 결과에서 canonical lane이 빠진다. |
| missing-lane-definition | high | 동일 15개 | `src/lib/layout/laneLayout.ts` `validateNodes()` | resolved `process.lanes`에 없는 `Node.laneId`는 유효하지 않은 node로 판단되어 렌더링에서 제외될 수 있다. |
| empty-lane-filter | medium | `event-sales`, `구매-요청-매입-전표-생성-it-s-w` | `src/types/processData.ts` `resolveLanesForInstance()` | `autoHideEmptyLanes=true`이면 node가 없는 기본 lane은 제거된다. 목표 정책의 "빈 기본 Lane 표시"와 충돌한다. |
| layout-index-error | medium | `business-to-purchase-request` | `src/lib/layout/detailVerticalLayout.ts` `resolveDetailLayoutLanes()` | node가 한 lane에만 있으면 단일 lane collapse가 발생해 기본 5 lane이 표시되지 않는다. |
| clone-copy-loss | low | clone detail process | `src/data/processDataMutations.ts` `cloneDetailProcess()` | `structuredClone(source)`를 기반으로 clone하므로 laneIds/autoHideEmptyLanes 자체는 복제된다. 다만 source가 legacy laneIds를 가지면 문제도 그대로 복제된다. |
| persistence-loss | low | save/reload | `src/data/processDataMigration.ts`, `src/data/__tests__/laneDisplayReload.test.ts` | laneIds/autoHideEmptyLanes 보존 테스트가 이미 있다. 유실보다는 깨진 값 보존이 문제다. |
| duplicate-lane-label | none observed | - | audit | 현재 resolved lane 기준 중복 label은 발견되지 않았다. |

## Repro Process Groups

### Missing `logistics`

다음 process는 node가 `logistics`를 참조하지만 resolved lane 정의에는 `logistics`가 없다.

- `business-to-project`
- `b2b-domestic-order-to-sales`
- `b2b-domestic-return`
- `b2b-export-order-to-sales`
- `b2c-order-to-sales`
- `preorder-to-sales`
- `other-issue`
- `popup-concert-stock-sales-sync`
- `b2c-return`
- `purchase-return`
- `other-receipt`
- `stock-movement`
- `storage-location-master`

### Missing `sales`

다음 process는 node가 `sales`를 참조하지만 resolved lane 정의에는 `sales`가 없다.

- `stock-transfer`
- `popup-concert-stock-sales-sync`
- `store-sales`

### Missing `procurement`

다음 process는 node가 `procurement`를 참조하지만 resolved lane 정의에는 `procurement`가 없다.

- `business-to-project`
- `purchase-return`

## Why Nodes Can Exist But Lane Is Not Displayed

현재 flow는 다음 순서다.

```text
commonMasters.lanes
  -> ProcessInstance.laneIds filter
  -> Process.lanes
  -> validateNodes(process)
  -> layout/render
```

문제 process의 경우:

```text
laneIds = [business, partnership, warehouse-easyadmin, retail-easychain, finance]
commonMasters.lanes = [business, procurement, logistics, sales, finance]
resolved lanes = [business, finance]
node.laneId = logistics 또는 sales
```

따라서 node가 존재해도 해당 lane이 `Process.lanes`에 없고, 표시 lane에서도 빠진다.

## Existing Tests Relevant To This Area

| Test File | Coverage |
| --- | --- |
| `src/data/__tests__/processLaneIds.test.ts` | laneIds filter, node가 배치된 lane 자동 포함, autoHideEmptyLanes |
| `src/data/__tests__/laneDisplayReload.test.ts` | save/reload 후 laneIds/autoHideEmptyLanes 보존 |
| `src/data/__tests__/laneDisplayPolicy.test.ts` | single-lane collapse, 신규 lane 추가 시 기존 process 고정 |
| `src/data/__tests__/goldenScenario.executionDomain.test.ts` | legacy lane ID -> execution domain migration |

## Expected Change Files If Approved

| File | Expected Change |
| --- | --- |
| `src/data/laneRegistry.ts` or new `src/config/canonicalLanes.ts` | canonical default 5 lane and general-purchase 3 lane definition |
| new `src/lib/layout/lanePolicyResolver.ts` | workflowId/group metadata 기반 lane policy 결정 |
| new `src/lib/layout/nodeLaneValidator.ts` | orphan lane reference, duplicate label, hidden lane warning 산출 |
| `src/types/processData.ts` | resolved lane 계산 시 policy defaults 또는 normalized laneIds 보완 여부 검토 |
| `src/lib/layout/detailVerticalLayout.ts` | 기본 5 lane process의 single-lane collapse 제한 |
| `src/components/process-map/SwimlaneOverlay.tsx` | 빈 기본 lane 약화 표시 필요 시 스타일 hook 추가 |
| `src/data/processDataMutations.ts` | 저장/복제 시 canonical lane policy 유지 검증 필요 시 보강 |
| `src/data/__tests__/*` and `src/lib/layout/__tests__/*` | 요청된 lane policy/validator/save-reload/clone tests 추가 |

## Runtime/State Migration Need

즉시 migration을 구현하지 않는 것을 권장한다.

표현 계층에서 `laneIds` legacy ID를 canonical ID로 해석하거나, `resolveProcessWithMasters()` 단계에서 node가 참조하는 canonical lane을 visible lane에 추가하면 현재 문제는 상당 부분 해결 가능하다.

다만 다음을 영구 정리하려면 데이터 수정 또는 migration이 필요하다.

- process별 `laneIds`에 남은 legacy ID 제거
- `business-to-project` legacy detail process의 유지/삭제/병합 결정
- 일반구매 3 lane 정책을 데이터로 명시할지, view policy로만 둘지 결정

