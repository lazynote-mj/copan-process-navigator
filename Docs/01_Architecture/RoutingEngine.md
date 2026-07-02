# Routing Engine

|Field|Value|
|---|---|
|Title|Routing Engine|
|Purpose|연결선 경로 계산과 저장 모델 기준을 정의한다.|
|Status|Draft|
|Owner|Project Team|
|Last Updated|2026-06-27|
|Related Docs|`LayoutEngine.md`, `DataModel.md`|

## Principle

Routing Engine은 저장된 edge endpoint와 canonical routing points를 기준으로 runtime path를 계산한다.

기준:
- sourceHandle / targetHandle 명시값 우선
- handleAuto=false이면 router가 handle을 바꾸지 않음
- node bbox 관통 금지
- bend count 최소화
- zone/swimlane/phase border는 obstacle로 보지 않음

