# Runtime Stability Audit

|Field|Value|
|---|---|
|Title|Runtime Stability Audit|
|Purpose|Runtime 연결 이후 Dirty 상태와 NaN style 경고 안정화 결과를 기록한다.|
|Status|Draft|
|Owner|Project Team|
|Last Updated|2026-06-27|
|Related Docs|`Docs/01_Architecture/Architecture.md`, `Docs/01_Architecture/LocalStorage.md`, `Docs/01_Architecture/TemplatePackage.md`, `Docs/04_Audit/Diagnostics/README.md`|

## 1. 목적

이번 Audit은 Application Bootstrap / Workspace Runtime / Template Runtime / Storage Adapter 연결 이후 확인된 안정성 이슈의 조치 결과를 기록한다.

대상 이슈는 다음 두 가지다.

- 화면 전환 또는 런타임 동기화만으로 `Dirty: Yes`가 발생하는 문제
- 판단 노드 계열의 handle 위치 계산 중 `left: NaN` style 경고가 발생하는 문제

이번 안정화는 기능 추가가 아니라 기존 화면 동작을 유지하면서 불필요한 변경 상태와 렌더 경고를 줄이는 작업이다.

## 2. 변경 파일 요약

|file|role|summary|
|---|---|---|
|`src/data/processDataStore.tsx`|Data Store|`mutate` / `mutateAndGet`에서 no-op 결과를 Dirty와 undo stack에 반영하지 않도록 처리|
|`src/data/processDataMutations.ts`|Data Mutation|정규화 후 실제 데이터가 동일한 mutation은 원본 reference를 반환하도록 처리|
|`src/components/layout/AppLayout.tsx`|App Layout|자동 routed handle 동기화가 clean 상태를 Dirty로 바꾸지 않도록 제한|
|`src/components/process-map/nodes/DecisionNodeCard.tsx`|Node Rendering|판단 노드 handle 위치 style 계산에 finite fallback 적용|
|`src/components/process-map/nodes/InterfaceRuleNodeCard.tsx`|Node Rendering|Interface Rule 노드 handle 위치 style 계산에 finite fallback 적용|
|`src/lib/layout/decisionAnchors.ts`|Anchor Calculation|판단 노드 anchor 계산에서 width / height / x / y / offset 값에 finite guard 적용|

## 3. Dirty: Yes 원인 및 조치

### 원인

Runtime 연결 이후 `ProcessDataProvider`는 storage adapter를 통해 기존 local JSON 데이터를 읽는다.

로드된 데이터 자체는 `dirty: false`로 생성되지만, 화면 렌더 이후 다음 동기화 흐름이 Dirty 상태를 만들 수 있었다.

1. Detail process 보장 호출
2. Layout / routing 결과 기반 routed handle 동기화
3. `updateNode` / `updateEdge` 계열 mutation이 실제 값이 같아도 새 객체를 만들고 `dirty: true`로 포장

특히 화면을 보기만 했는데도 router가 선택한 handle 값을 process data에 다시 반영하는 경로가 실행되면, 사용자 편집 없이도 `Dirty: Yes`가 표시될 수 있었다.

### 조치

|area|action|
|---|---|
|Store no-op guard|`mutate` / `mutateAndGet`에서 updater 결과가 기존 data와 동일 reference이면 `saveStatus`를 변경하지 않고 undo stack도 추가하지 않음|
|Mutation no-op guard|process instance를 정규화한 뒤 기존 instance와 구조적으로 동일하면 원본 data를 그대로 반환|
|Detail ensure|이미 존재하거나 단순 보장 성격의 detail process 호출이 Dirty를 만들지 않도록 처리|
|Routed handle sync|clean 상태에서는 자동 routed handle 동기화를 저장 모델에 반영하지 않도록 제한|

결과적으로 화면 로드, Overview 전환, Detail 전환만으로는 Dirty 상태가 올라가지 않도록 안정화되었다.

## 4. left: NaN 원인 및 조치

### 원인

판단 노드와 Interface Rule 노드는 마름모형 꼭짓점 기준으로 handle 위치를 계산한다.

일부 렌더 타이밍에서 React Flow가 전달하는 `width` / `height` 또는 layout 기반 값이 아직 유효한 숫자로 확정되지 않으면, handle style의 `left` 또는 `top`이 `NaN`으로 내려갈 수 있었다.

### 조치

|area|action|
|---|---|
|DecisionNodeCard|`width`, `height`, handle offset의 `left`, `top`에 `Number.isFinite` guard 적용|
|InterfaceRuleNodeCard|Decision node와 동일한 handle offset fallback 적용|
|decisionAnchors|node width / height / x / y, diamond vertex scale 계산에 finite fallback 적용|

fallback 기준은 기존 레이아웃 기본값 또는 노드 중앙점이며, layout / router 알고리즘 자체는 변경하지 않았다.

## 5. 검증 결과

|check|result|
|---|---|
|Build|`npm run build` 통과|
|앱 첫 로딩|정상 렌더링|
|새로고침 직후 Dirty|`Dirty: No`|
|Overview 전환 후 Dirty|`Dirty: No` 유지|
|Detail 전환 후 Dirty|`Dirty: No` 유지|
|실제 노드 편집 후 Dirty|`Dirty: Yes` 정상 발생|
|편집 검증 후 저장 여부|저장하지 않음. 새로고침으로 메모리 변경만 원복|
|복귀 후 노드 수|`Nodes: 358`|
|복귀 후 연결선 수|`Edges: 362`|
|broken edge|`0`|
|현재 DOM 내 NaN style|`0건`|

검증 중 실제 편집 여부 확인을 위해 노드 복제를 1회 수행했으나, 저장하지 않고 새로고침하여 메모리 변경만 폐기했다.

## 6. 남은 리스크

|risk|status|note|
|---|---|---|
|이전 콘솔 로그|남음|브라우저 콘솔에는 이전 시간대의 `left: NaN` 로그 2건이 남아 있었다. 새로고침 후 현재 DOM 기준 NaN style은 0건이었다.|
|자동 routed handle sync|제한됨|clean 상태에서는 저장 모델에 반영하지 않는다. Dirty 상태에서는 기존처럼 반영될 수 있다.|
|구조 비교 비용|관찰 필요|mutation no-op 판단에 구조 비교가 추가되었다. 현재 데이터 규모에서는 build와 화면 검증상 문제 없음.|
|저장 후 Dirty: No|미검증|이번 범위에서 `state.json` 변경 금지 조건이 있어 저장 버튼 검증은 수행하지 않았다.|
|기존 작업 트리 변경|존재|이번 Audit과 무관한 기존 코드 / 데이터 / 문서 변경이 작업 트리에 남아 있다.|

## 7. 다음 Phase 권장사항

1. Runtime 안정성 회귀 테스트 정리
   - 새로고침
   - Overview / Detail 전환
   - 노드 선택
   - 라벨 선택
   - 실제 편집
   - 저장 전 / 저장 후 상태

2. Routed handle sync 정책 명확화
   - runtime path 계산 결과와 저장 모델의 handle 값을 언제 동기화할지 기준 문서화
   - clean 상태 자동 동기화 금지 원칙 유지 여부 검토

3. Diagnostics Panel 또는 개발자용 로그에 no-op mutation 통계 추가 검토
   - Dirty를 만들지 않은 mutation 수
   - routed handle sync skip 수
   - NaN fallback 발생 수

4. Node rendering finite guard 확대 검토
   - Database node
   - Process node
   - Edge label overlay
   - Zone label overlay

5. 저장 검증은 별도 Phase로 분리
   - `state.json` 변경이 허용되는 Phase에서 저장 전 / 저장 후 Dirty 상태와 node / edge count 동일성을 검증한다.

6. Runtime 연결 안정화 완료 기준 정의
   - 첫 로딩 Dirty: No
   - 단순 화면 전환 Dirty: No
   - 실제 편집 Dirty: Yes
   - 저장 후 Dirty: No
   - DOM NaN style 0건
   - broken edge 0 유지
