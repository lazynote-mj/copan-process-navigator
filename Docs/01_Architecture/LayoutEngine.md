# Layout Engine

|Field|Value|
|---|---|
|Title|Layout Engine|
|Purpose|노드, Swimlane, Zone, Cell 배치 기준을 정의한다.|
|Status|Draft|
|Owner|Project Team|
|Last Updated|2026-06-27|
|Related Docs|`Architecture.md`, `RoutingEngine.md`|

## Principle

같은 Master와 같은 Process Definition을 입력하면 항상 같은 좌표가 나와야 한다.

Layout Engine은 다음 값을 기준으로 배치한다.
- swimlane
- zone
- cellOrder
- cellSlot
- detailLayout row/column
- layout rule

Zone은 background layer이며 node 배치 계산을 변경하지 않는다.

