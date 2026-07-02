# Business Activity

|Field|Value|
|---|---|
|Title|Business Activity|
|Purpose|업무 활동의 표준 명칭과 의미를 정의한다.|
|Status|Draft|
|Owner|Project Team|
|Last Updated|2026-06-27|
|Related Docs|`BusinessActivityMaster.md`, `NodeDefinitionStandard.md`, `NodeMaster.md`, `ProcessDefinition.md`|

Business Activity는 Node Name보다 상위 개념이다.

예:
- Purchase Request
- Purchase Approval
- Inbound Confirmation
- Sales Closing

Node는 Activity를 화면에 표현한 인스턴스다.

반복 사용되는 Activity의 표준 Master는 `BusinessActivityMaster.md`에서 관리한다.

Detail Process는 Node를 직접 나열하기 전에 Business Activity Master를 먼저 확인한다.
