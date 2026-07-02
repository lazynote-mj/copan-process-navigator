# Delete / Backspace Selection Stability Audit

Title: Delete / Backspace Selection Stability Audit
Purpose: SelectionManager 기준 Node / Edge 삭제 안정화 결과를 기록한다.
Status: Review
Owner: Codex
Last Updated: 2026-06-28
Related Docs: Docs/04_Audit/Diagnostics/clipboard-undo-stability-audit.md

## 1. 목적

Phase 9-2의 목적은 ReactFlow 내부 selected 상태나 단일 selectedElement가 아니라, Platform SelectionManager를 기준으로 Delete / Backspace 삭제 동작을 안정화하는 것이다.

이번 Phase는 Delete / Backspace만 대상으로 하며 Align, Group, Drag Selection, Template, Layout, Router는 변경하지 않는다.

## 2. 변경 파일

|파일|역할|
|---|---|
|src/data/processDataMutations.ts|Node / Edge batch 삭제를 위한 deleteElements 추가|
|src/data/processDataStore.tsx|deleteElements를 store mutation으로 노출|
|src/components/layout/AppLayout.tsx|SelectionManager snapshot 기준 삭제 dispatch|
|src/components/process-map/ProcessMapCanvas.tsx|Edge selection을 SelectionManager와 동기화|
|src/lib/editor/shortcutManager.ts|Delete / Backspace shortcut 정의 보강|

## 3. 삭제 알고리즘

삭제 입력이 들어오면 AppLayout은 SelectionManager의 현재 snapshot을 조회한다.

처리 순서:

1. 선택된 nodeIds와 edgeIds를 분리한다.
2. 유효한 Node / Edge만 남긴다.
3. 보호 대상 Node는 삭제 대상에서 제외한다.
4. store.deleteElements(scope, { nodeIds, edgeIds })를 한 번 호출한다.
5. 삭제 후 SelectionManager selection을 clear한다.

삭제 대상이 없거나 보호 대상만 선택된 경우 no-op으로 처리되며 Dirty 상태를 만들지 않는다.

## 4. SelectionManager 사용 방식

Node 선택과 Edge 선택 모두 SelectionManager snapshot에 반영된다.

|대상|선택 소스|
|---|---|
|Node|selectedNodeIds / nodeSelectionItems|
|Edge|selectedEdgeIds / edgeSelectionItems|

ProcessMapCanvas는 selectedNodeIds와 selectedEdgeIds를 받아 ReactFlow node / edge의 selected 표시만 렌더링한다. 선택의 기준값은 SelectionManager이며 ReactFlow internal selected는 source of truth로 사용하지 않는다.

## 5. Node 삭제 시 연결 Edge 제거 기준

deleteElements는 삭제 대상 Node와 연결된 Edge를 함께 제거한다.

제거 기준:

- edge.id가 명시적으로 삭제 대상 edgeIds에 포함된 경우
- edge.source가 삭제 대상 nodeIds에 포함된 경우
- edge.target이 삭제 대상 nodeIds에 포함된 경우

따라서 Node 삭제 후 orphan edge 또는 broken edge가 남지 않도록 처리한다.

## 6. 보조 노드 삭제 방지 기준

아래 Node type은 기본 삭제 대상에서 제외한다.

|type|이유|
|---|---|
|phase-connector|흐름 보조/legacy connector 성격|
|merge|legacy merge 또는 보조 연결 노드 성격|

보호 대상만 선택된 상태에서 Delete / Backspace를 눌러도 데이터 변경은 발생하지 않는다.

## 7. 검증 결과

검증은 저장 버튼을 누르지 않고 브라우저 메모리 상태에서 진행했다.

|case|result|note|
|---|---|---|
|단일 Node Delete|통과|Node -1, 연결 Edge 제거, Dirty: Yes|
|다중 Node Delete|통과|2개 Node 선택 후 Delete 시 Nodes -2, 연결 Edge 제거|
|Edge Delete|통과|Edge -1, Node 수 유지|
|입력창 Backspace 보호|통과|Property Panel input focus 상태에서 Node / Edge 삭제 없음|
|brokenEdges 0 유지|통과|삭제 후 화면상 오류 표시 없음, 연결 Edge 제거 기준상 orphan edge 방지|
|Ctrl+Z / Ctrl+Y 자동화 재검증|제한|브라우저 자동화 API에서 조합키 전달이 안정적으로 재현되지 않음|

## 8. Undo / Redo 검증 결과

삭제 mutation은 store.mutate 경로를 사용하므로 undo stack에 snapshot이 쌓이는 구조다.

구조 검증:

- deleteElements는 ProcessDataStore.mutate를 통해 실행된다.
- mutate는 변경 전 ProcessData를 undoStackRef에 저장한다.
- undo는 이전 snapshot을 processDataRef.current와 React state에 즉시 반영한다.
- redo는 redoStackRef snapshot을 동일 방식으로 재적용한다.

브라우저 자동화에서 Delete 단일키는 정상 전달되었으나, Ctrl+Z / Ctrl+Y 또는 Meta+Z / Shift+Meta+Z 조합키는 자동화 API에서 앱까지 안정적으로 전달되지 않았다. 따라서 이번 문서의 Undo / Redo는 코드 경로 검증 기준이며, 실제 수동 브라우저 단축키 재확인은 별도 체크가 필요하다.

## 9. 남은 리스크

|risk|impact|recommendation|
|---|---|---|
|브라우저 자동화의 조합키 전달 한계|Ctrl+Z / Ctrl+Y 최종 수동 확인 필요|실제 키보드로 수동 재검증|
|Edge 선택 hit area가 좁음|Edge Delete 검증 시 좌표 클릭 필요|Edge selection hit area 개선은 별도 Phase에서 검토|
|보조 노드 기준이 type 문자열 기반|향후 보조 노드 타입이 늘면 누락 가능|Node Master 또는 diagnostics flag 기반 protectedDelete 도입 검토|

## 10. 다음 Phase 권장사항

1. Copy / Paste 수동 검증 보완
2. Multi Copy / Duplicate 고도화
3. Align / Distribute

