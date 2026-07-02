# Process 15 Review Package

Title: 위탁 매출 정산
Purpose: Process 15을 Internal Review Ready 상태로 검토하기 위한 Review Package
Status: Internal Review Ready
Owner: 혁신팀
Last Updated: 2026-06-29
Related Docs: Docs/06_Data/02_Mapping/ProcessMapping.md, Docs/06_Data/02_Mapping/DouzoneProcessCoverage.md

## 1. 변경 요약

Process 15은 위탁 매출 정산 PROCESS를 기준으로 위탁 매출 집계부터 정산마감 및 ERP 자동 전표 처리까지 정리했다.

- 사업부 위탁 매출 집계
- 재무관리팀 위탁 매출 마감확정
- 예외사항처리
- 정산마감등록/확정
- ERP 자동 전표생성(미결)
- 전표자동승인
- 회계마감 반영

## 2. Douzone와 차이점

Douzone 위탁 매출 정산 PROCESS는 위탁 매출과 수수료 산출, 정산마감 중심이다. Copan Navigator에서는 사업부 집계와 재무 마감확정을 분리하고, 예외사항처리와 자동 전표 처리 단계를 명확히 표시했다.

## 3. Copan 운영 반영 내용

- 위탁 매출 집계는 사업부 Owner로 표현한다.
- 위탁 매출 마감확정과 정산마감은 재무관리팀 Owner로 표현한다.
- 전표생성(미결)과 전표자동승인은 ERP 자동 처리지만 직전 마감확정 Owner를 따라 재무관리팀 Lane에 둔다.
- 회계관리 자체는 SCM Navigator 구축 대상이 아니므로 회계마감 반영은 Reference Only 성격으로 표시한다.

## 4. 혁신팀 검토 사항

- 위탁 매출 집계 기준과 수수료 산출 기준 확인
- 예외사항처리의 실제 주체와 승인 경로 확인
- 정산마감등록과 정산마감확정의 ERP 메뉴명 확인
- 전표자동승인 예외 케이스 존재 여부 확인

## 5. 담당부서 확인 사항

- 사업부: 위탁 매출 집계와 위탁정산 대상 기준 확인
- 재무관리팀: 위탁 매출 마감확정, 예외처리, 정산마감, 전표 자동승인 기준 확인

## 6. 결정 필요 사항

- 예외사항처리 후 다시 사업부 확인이 필요한지 결정해야 한다.
- 위탁 매출 정산과 수익배분 정산을 별도 Process로 유지할지 확정해야 한다.
- 자동승인 제외 건을 별도 분기로 둘지 결정해야 한다.

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

- Douzone Process: 위탁 매출 정산 PROCESS
- Navigator Process: 16 위탁 매출 정산
- Current Coverage Status: Partial
- Review Status: Internal Review Ready
