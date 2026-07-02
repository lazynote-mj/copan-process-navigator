# Clipboard Undo Stability Audit

|Field|Value|
|---|---|
|Title|Clipboard Undo Stability Audit|
|Purpose|Clipboard 1차 구현 이후 Duplicate / Undo / Redo 안정화 결과를 기록한다.|
|Status|Draft|
|Owner|Project Team|
|Last Updated|2026-06-28|
|Related Docs|`Docs/04_Audit/Diagnostics/README.md`, `Docs/04_Audit/Diagnostics/runtime-stability-audit.md`|

## 1. 목적

이번 Audit은 Clipboard 1차 기능 중 Node Duplicate 이후 Undo / Redo가 정상 동작하는지 검증하고, 발견된 Undo 실패 원인과 조치 내용을 기록한다.

검증 대상은 다음 흐름이다.

- `Ctrl+D` / `Cmd+D` Duplicate
- `Ctrl+Z` / `Cmd+Z` Undo
- `Ctrl+Y` / `Ctrl+Shift+Z` / `Cmd+Shift+Z` Redo
- Property Panel 입력창 포커스 상태의 텍스트 Undo 보호

이번 작업은 Clipboard 기능 확장이 아니라, Clipboard 1차 결과를 안정화하고 다음 편집 기능 Phase로 넘어가기 위한 진단 기록이다.

## 2. 구현/수정 파일 요약

|file|role|summary|
|---|---|---|
|`src/clipboard/*`|Clipboard Engine|Node copy / paste / duplicate payload와 serializer 구조 추가|
|`src/components/layout/AppLayout.tsx`|Shortcut Dispatch / Clipboard Action|Copy / Paste / Duplicate / Undo / Redo 단축키를 앱 편집 흐름에 연결|
|`src/components/layout/Toolbar.tsx`|Toolbar Action|Duplicate 등 편집 명령 노출|
|`src/components/process-map/ProcessMapCanvas.tsx`|Canvas Selection / Context Action|선택 노드 기준 Clipboard 명령 전달|
|`src/lib/editor/shortcutManager.ts`|Cross Platform Shortcut|OS별 shortcut 정의와 editable target 차단 로직 제공|
|`src/data/processDataStore.tsx`|Undo / Redo Store|Undo / Redo stack 관리와 snapshot 적용 안정화|

## 3. Duplicate / Undo / Redo 검증 결과

|case|expected|result|
|---|---|---|
|초기 로딩|`Dirty: No`, node / edge count 유지|통과|
|일반 노드 선택 후 `Ctrl+D`|복제 노드 1개 생성, edge 미복사, `Dirty: Yes`|통과|
|Duplicate 후 `Ctrl+Z`|복제 노드 제거, node count 원복, edge count 유지|통과|
|Undo 후 `Ctrl+Y`|복제 노드 복원, edge count 유지, `Dirty: Yes`|통과|
|Property Panel input 포커스 상태 `Ctrl+Z`|앱 node undo 미실행, 입력 필드 우선|통과|

최종 수동 검증 기준:

|state|nodes|edges|dirty|
|---|---:|---:|---|
|초기|358|361|No|
|`Ctrl+D` 이후|359|361|Yes|
|`Ctrl+Z` 이후|358|361|No|
|`Ctrl+Y` 이후|359|361|Yes|

## 4. Undo 실패 원인

원인은 shortcut dispatch가 아니라 `store.undo()` / `store.redo()`의 데이터 적용 방식이었다.

기존 구현은 React `setState` functional updater 내부에서 다음 작업을 처리하는 방식이었다.

1. undo stack pop
2. redo stack push
3. `processDataRef.current` 갱신
4. `applied` flag 갱신
5. 이전 snapshot 반환

이 구조는 updater 내부 동기 실행에 의존한다. React 상태 업데이트가 배치되거나 실행 타이밍이 달라지는 경우, `store.undo()` 호출 결과와 실제 데이터 적용 시점이 어긋날 수 있다.

따라서 Duplicate 자체와 undo stack 적재는 정상이어도, `Ctrl+Z` 이후 복제 노드가 화면에서 제거되지 않는 현상이 발생했다.

## 5. 수정 방식

`undo` / `redo` 적용 방식을 React updater 내부 처리에서 벗어나게 했다.

변경 원칙:

- `processDataRef.current`를 현재 canonical data로 사용
- `undoStackRef` / `redoStackRef`를 먼저 확인
- 이전 또는 다음 snapshot을 즉시 계산
- `processDataRef.current = next`로 먼저 반영
- `setProcessData(next)`로 React 상태 갱신
- stack 변경과 node count 변화는 dev-only diagnostics로 추적 가능하게 유지

핵심 변화:

```text
Before
setProcessData((current) => {
  stack 변경
  ref 갱신
  return previousSnapshot
})

After
current = processDataRef.current
next = cloneProcessData(previousSnapshot)
processDataRef.current = next
setProcessData(next)
```

이로써 `store.undo()` / `store.redo()`가 호출되면 snapshot 계산과 stack 이동이 즉시 결정되고, React 렌더는 그 결과를 따라가게 된다.

## 6. 최종 검증 결과

|check|result|
|---|---|
|Build|`npm run build` 통과|
|Duplicate|`Ctrl+D` 후 node count `358 -> 359`|
|Undo|`Ctrl+Z` 후 node count `359 -> 358`|
|Redo|`Ctrl+Y` 후 node count `358 -> 359`|
|Edge count|전체 흐름에서 `361` 유지|
|Property Panel input focus|앱 undo 미실행|
|저장 여부|저장 버튼 클릭하지 않음|
|JSON 변경|이번 검증에서 `state.json` 저장/수정하지 않음|

최종 판단:

Clipboard 1차의 Node Duplicate / Undo / Redo 안정성은 통과로 본다.

## 7. 남은 리스크

|risk|status|note|
|---|---|---|
|dev-only diagnostics 잔존|허용|`import.meta.env.DEV` 조건으로만 동작하며 UI에는 표시하지 않는다.|
|Dirty 정책|관찰 필요|Undo 후 초기 snapshot과 같아지면 `Dirty: No`로 내려가는 현재 동작은 사용자 관점에서는 자연스럽다. 저장 상태 정책과 완전히 일치하는지는 별도 검토 가능하다.|
|Multi-node duplicate undo|추가 수동 검증 필요|단일 노드 기준은 통과했다. 다중 선택 복제는 다음 Clipboard 회귀 검증에서 확인한다.|
|Toolbar Duplicate undo|추가 수동 검증 필요|동일 store 경로를 사용하므로 위험은 낮지만 별도 UI 경로 검증이 필요하다.|
|기존 작업 트리 변경|존재|이번 Audit과 무관한 기존 코드 / 데이터 / 문서 변경이 작업 트리에 남아 있다.|

## 8. 다음 Phase 권장사항

다음 개발 Phase는 기능 확장보다 기본 편집 안정화가 우선이다.

권장 순서:

1. Phase 9-2: Delete / Backspace 안정화
   - node 삭제
   - edge 삭제
   - keyboard delete
   - editable target 차단
   - undo / redo 연동

2. Clipboard 회귀 검증
   - toolbar Duplicate
   - context menu Duplicate
   - multi-node Duplicate
   - Paste 후 Undo / Redo

3. Clipboard 확장 검토
   - edge clipboard
   - zone clipboard
   - group clipboard
   - internal edge 포함 복사 옵션

현재 기준에서는 Delete / Backspace 안정화로 넘어가는 것이 적절하다.
