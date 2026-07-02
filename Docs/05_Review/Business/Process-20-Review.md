# Process 20 Review Package

Title: 프로젝트 정산 : 서비스
Purpose: Process 20을 Internal Review Ready 상태로 검토하기 위한 Review Package
Status: Internal Review Ready
Owner: 혁신팀
Last Updated: 2026-06-29
Related Docs: Docs/06_Data/02_Mapping/ProcessMapping.md, Docs/06_Data/02_Mapping/DouzoneProcessCoverage.md

## 1. 변경 요약

Process 20은 서비스 프로젝트의 매출/비용 정산을 수익배분/로열티 정산 패턴에 맞춰 정리했다.

- 사업부 프로젝트 매출/비용 집계
- 재무관리팀 프로젝트 마감확정
- 예외사항처리
- MG 차감여부 판단
- MG상계입력/처리
- 정산마감등록/확정
- ERP 자동 전표생성(미결), 전표자동승인, 회계마감 반영

## 2. Douzone와 차이점

Douzone Source는 위탁 매출 정산 PROCESS와 판매 로열티 정산 PROCESS를 기준으로 한다. Copan Navigator에서는 서비스 프로젝트 정산 특성상 매출과 비용을 함께 집계하고, MG 차감과 정산마감 패턴을 적용했다.

## 3. Copan 운영 반영 내용

- 프로젝트 매출/비용 집계는 사업부 Owner로 표현한다.
- 프로젝트 마감확정, 예외사항처리, MG 판단, 정산마감은 재무관리팀 Owner로 표현한다.
- 전표생성(미결)과 전표자동승인은 ERP 자동 처리이며 직전 마감확정 Owner를 따라 재무관리팀 Lane에 둔다.
- 회계마감 반영은 SCM Process와의 연결 지점이며 회계 상세 업무는 Reference Only로 관리한다.

## 4. 혁신팀 검토 사항

- 서비스 프로젝트 정산 대상 범위와 계약 유형 확인
- 매출/비용 집계 기준과 증빙 기준 확인
- MG 차감 여부가 모든 프로젝트 정산에 적용되는지 확인
- 회계마감 반영 Node의 표현 수준이 적절한지 확인

## 5. 담당부서 확인 사항

- 사업부: 프로젝트 매출/비용 집계 기준 확인
- 재무관리팀: 프로젝트 마감확정, 예외처리, 정산마감, 자동승인 기준 확인

## 6. 결정 필요 사항

- 프로젝트 정산을 서비스 Capability에 둘지 정산관리 Capability에 통합 관리할지 결정해야 한다.
- MG 차감이 없는 프로젝트의 기본 경로를 확정해야 한다.
- 자동 전표 승인 제외 조건을 별도 표시할지 결정해야 한다.

## 7. Approval Checklist

□ Business Activity 확인
□ Execution System 확인
□ Owner 확인
□ Lane 확인
□ Auto Node 확인
□ ERP Menu 확인
□ Douzone 차이 확인
□ Copan 운영 반영 확인
□ 현업 승인 여부

## 8. Coverage 변경 사항

Coverage는 Approved 전까지 Complete로 변경하지 않는다.

- Douzone Process: 위탁 매출 정산 PROCESS / 판매 로열티 정산 PROCESS
- Navigator Process: 20 프로젝트 정산 : 서비스
- Current Coverage Status: Partial
- Review Status: Internal Review Ready
