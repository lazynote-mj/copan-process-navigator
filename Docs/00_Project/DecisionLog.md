# Decision Log

|Field|Value|
|---|---|
|Title|Decision Log|
|Purpose|확정된 설계 의사결정과 변경 이유를 기록한다.|
|Status|Approved|
|Owner|Project Team|
|Last Updated|2026-06-29|
|Related Docs|`Roadmap.md`, `../01_Architecture/Architecture.md`|

## Decision Format

|Date|Decision|Reason|Impact|Related Docs|
|---|---|---|---|---|
|2026-06-27|Docs를 Documentation Hub 구조로 재편한다.|ChatGPT, Codex, Cursor, 개발자가 같은 설계 기준을 참조하기 위해서.|문서 신뢰도 계층이 생기며 Architecture 우선 원칙을 따른다.|`../README.md`|
|2026-06-29|SCM Process 구축 Methodology를 v1.0으로 고정한다.|Methodology가 충분히 정의되었고, 이후 우선순위는 규칙 추가가 아니라 SCM Process Asset 구축이다.|BusinessCapabilityMaster, BusinessActivityMaster, NodeDefinitionStandard, ProcessAuthoringStandard, ProcessMapping, DouzoneProcessCoverage, SCMProcessNumbering을 공식 Methodology v1.0으로 사용한다. Methodology 변경은 Douzone Master Source 충돌, Copan 실제 운영 충돌, 혁신팀 Review 결정이 있을 때만 별도 Revision으로 관리한다.|`../README.md`, `../02_Master/BusinessCapabilityMaster.md`, `../02_Master/BusinessActivityMaster.md`, `../02_Master/NodeDefinitionStandard.md`, `../06_Data/02_Mapping/ProcessAuthoringStandard.md`, `../06_Data/02_Mapping/ProcessMapping.md`, `../06_Data/02_Mapping/DouzoneProcessCoverage.md`, `../06_Data/02_Mapping/SCMProcessNumbering.md`|
