# Process Mapping

|Field|Value|
|---|---|
|Title|Process Mapping|
|Purpose|Navigator Process와 Douzone Master Source, Copan Interpretation의 대응 관계를 관리한다.|
|Status|Draft|
|Owner|Project Team|
|Last Updated|2026-06-28|
|Related Docs|`ProcessMapping.md`, `DouzoneProcessCoverage.md`, `ProcessAuthoringStandard.md`, `../01_Source/README.md`|

이 폴더는 ERP 구축 공식 산출물 관점에서 Process mapping을 관리한다.

기존 `Docs/06_Data/Mapping` 폴더는 legacy phase/stage mapping 등 기술적 migration mapping을 보관한다. 업무 프로세스 기준 mapping은 `02_Mapping`을 사용한다.

`DouzoneProcessCoverage.md`는 Douzone TO-BE Master Source 전체가 Navigator에 얼마나 반영되었는지 관리한다.

## Authoring Standard

Detail Process 작성 및 Audit은 `ProcessAuthoringStandard.md`를 우선 적용한다.

Node는 단순히 Lane 또는 업무명만으로 판단하지 않고, Business Activity, Execution System, Owner, ERP Menu, Processing Type을 함께 검토한다.
