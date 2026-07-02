# Clipboard Copy / Paste Stability Audit

Title: Clipboard Copy / Paste Stability Audit
Purpose: SelectionManager 기준 Node Copy / Paste 안정화 결과를 기록한다.
Status: Review
Owner: Codex
Last Updated: 2026-06-28
Related Docs: Docs/04_Audit/Diagnostics/clipboard-undo-stability-audit.md, Docs/04_Audit/Diagnostics/delete-selection-stability-audit.md

## 1. 목적

Phase 9-3의 목적은 Node Copy / Paste가 ReactFlow selected 상태가 아니라 Platform SelectionManager 기준으로 안정적으로 동작하는지 검증하고, 다중 Node 복사/붙여넣기 시 선택/배치/Undo 구조가 깨지지 않도록 정리하는 것이다.

이번 Phase 범위는 Node Copy / Paste이며, Edge / Zone / Group clipboard, Align, Group, Drag Selection은 구현하지 않는다.

## 2. 변경 파일

|파일|역할|
|---|---|
|src/clipboard/clipboardEngine.ts|Node clipboard payload 생성 및 paste placement 안정화|
|src/components/process-map/ProcessMapCanvas.tsx|우클릭 메뉴 Copy / Duplicate가 다중 선택을 보존하도록 보완|
|src/components/layout/AppLayout.tsx|SelectionManager 기준 Copy / Paste dispatch 사용|
|src/selection/*|SelectionManager 기반 선택 snapshot 제공|
|src/lib/editor/shortcutManager.ts|Copy / Paste shortcut 정의 및 editable guard 경로 제공|

## 3. Copy / Paste 알고리즘

Copy:

1. SelectionManager snapshot에서 selected nodeIds를 조회한다.
2. 명시 nodeIds가 있으면 해당 값을 우선 사용한다.
3. phase-connector, merge 등 clipboard 미지원 Node는 제외한다.
4. Node data를 clipboard payload로 serialize한다.
5. nodeId, selected, dragging, measured, runtime data, diagnostics 등 임시 상태는 제외한다.
6. Edge는 복사하지 않는다.

Paste:

1. clipboard payload가 없거나 node scope가 아니면 no-op 처리한다.
2. 각 Node에 새 nodeId를 생성한다.
3. offsetX / offsetY 기본값 +20 / +20을 적용한다.
4. 기존 process의 lane / zone / slot 점유 상태를 기준으로 새 위치를 계산한다.
5. 다중 paste 중에는 앞서 붙여넣은 Node를 임시 placementProcess에 누적해 slot 충돌을 줄인다.
6. store.addNodesAndEdges(scope, pasted.nodes, [])로 Node만 추가한다.
7. 붙여넣은 Node 전체를 새 selection으로 설정한다.
8. Dirty: Yes가 된다.

## 4. SelectionManager 사용 방식

Copy / Paste 대상은 SelectionManager의 node selection을 기준으로 한다.

|상황|선택 기준|
|---|---|
|일반 Copy|SelectionManager.getByType('node')|
|명시 Copy|context menu가 전달한 nodeIds|
|Paste 후 선택|붙여넣은 새 nodeIds 전체|
|입력창 focus|앱 shortcut 미실행, 브라우저 텍스트 동작 우선|

ReactFlow selected는 렌더링 표시로만 사용하고, Copy / Paste의 source of truth는 SelectionManager다.

## 5. 다중 Node Copy / Paste 처리

다중 Node 선택 후 Copy / Paste 시 선택 개수만큼 새 Node가 생성된다.

검증 결과:

|case|before|after|result|
|---|---|---|---|
|2개 Node 선택 후 Paste|Nodes: 362 / Edges: 370|Nodes: 364 / Edges: 370|통과|

새 Node:

- node-mqx5xaog-emkgo
- node-mqx5xaog-pq3ey

두 Node 모두 새 nodeId를 사용했고, 붙여넣기 후 새 Node 2개가 선택 상태로 유지되었다.

## 6. 우클릭 메뉴 Copy / Duplicate 보완

기존 우클릭 메뉴는 클릭한 Node 1개만 Copy / Duplicate 대상으로 삼을 수 있었다.

보완 후:

- 이미 다중 선택된 Node 위에서 우클릭하면 현재 다중 선택을 유지한다.
- Copy는 nodeContextMenu.nodeIds 전체를 대상으로 실행한다.
- Duplicate도 nodeContextMenu.nodeIds 전체를 대상으로 실행한다.
- 선택되지 않은 Node 위에서 우클릭하면 해당 Node 1개 선택으로 전환한다.

## 7. 검증 결과

검증은 저장 버튼을 누르지 않고 브라우저 메모리 상태에서 진행했다.

|case|result|note|
|---|---|---|
|단일 Node Copy / Paste|통과|Nodes +1, Edges 동일, 새 nodeId 생성, 새 Node 선택, Dirty: Yes|
|다중 Node Copy / Paste|통과|2개 선택 후 Nodes +2, Edges 동일, 새 Node 2개 선택|
|빈 Clipboard Paste|통과|Paste no-op, Dirty 변경 없음|
|입력창 Backspace 보호|통과|입력창 focus 상태에서 Node / Edge 변경 없음|
|입력창 Copy / Paste 보호|구조 확인|editable target guard가 앱 shortcut 실행을 차단하는 구조|
|실제 키보드 Ctrl/Cmd+C/V|제한|Codex 브라우저 자동화가 OS clipboard shortcut을 완전 재현하지 못함|

## 8. Undo / Redo 검증 결과

Paste는 store.addNodesAndEdges를 통해 실행되며, 해당 store mutation은 undo stack에 이전 ProcessData snapshot을 저장하는 구조다.

구조 검증:

- Paste 전 ProcessData가 undoStackRef에 저장된다.
- Paste 후 Dirty: Yes가 된다.
- undo는 이전 snapshot을 복원한다.
- redo는 redoStackRef의 snapshot을 다시 적용한다.

다만 Codex 브라우저 자동화 환경에서는 Ctrl/Cmd+Z, Ctrl/Cmd+Y, Shift+Ctrl/Cmd+Z 조합키가 실제 OS 키보드 입력과 동일하게 전달되지 않는 문제가 반복 확인되었다. 따라서 실제 물리 키보드 기준 Undo / Redo 최종 확인은 사용자의 로컬 브라우저에서 별도 수동 확인이 필요하다.

## 9. 남은 리스크

|risk|impact|recommendation|
|---|---|---|
|Codex 자동화의 OS clipboard shortcut 한계|실제 키보드 Copy / Paste / Undo / Redo는 별도 수동 확인 필요|로컬 브라우저에서 물리 키보드로 재검증|
|Toolbar Edit Menu Copy 버튼 검증 불안정|메뉴 UI 접근성/클릭 영역 점검 필요|다음 Phase에서 Toolbar Edit Menu 검증/정리|
|Edge / Zone / Group clipboard 미구현|복합 selection clipboard는 아직 불가|후속 Epic에서 별도 설계|
|slot 계산은 local placement 기준|복잡한 레이아웃에서 추가 충돌 가능|향후 Layout Engine과 Clipboard placement contract 정의|

## 10. 다음 Phase 권장사항

1. Toolbar Edit Menu 검증/정리
2. Keyboard Shortcut Help / Command List
3. Align / Distribute
4. Drag Selection

