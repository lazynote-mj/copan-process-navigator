# Process 16 Review Package

Title: 수익배분 매출 정산
Purpose: Process 16을 Internal Review Ready 상태로 검토하기 위한 Review Package
Status: Internal Review Ready
Owner: 혁신팀
Last Updated: 2026-06-29
Related Docs: Docs/06_Data/02_Mapping/ProcessMapping.md, Docs/06_Data/02_Mapping/DouzoneProcessCoverage.md

## 1. 변경 요약

Process 16은 수익배분 계약 기준 매출/비용 정산을 Copan 운영 기준으로 정리했다.

- 사업부 매출/비용 집계
- 재무관리팀 매출/비용 마감확정
- 예외사항처리
- MG 차감여부 판단
- MG상계입력/처리
- 정산마감등록/확정
- ERP 자동 전표생성(미결), 전표자동승인, 회계마감 반영

## 2. Douzone와 차이점

Douzone에는 수익배분 매출 정산이 단일 독립 프로세스로만 정의되어 있지 않고, 위탁 매출 정산 PROCESS와 판매 로열티 정산 PROCESS의 패턴을 조합해야 한다. Copan Navigator에서는 수익배분 계약 구조에 맞춰 매출/비용 집계와 MG 차감 판단을 함께 표현했다.

## 3. Copan 운영 반영 내용

- 매출/비용 집계는 사업부 Owner로 표현한다.
- 매출/비용 마감확정과 정산마감은 재무관리팀 Owner로 표현한다.
- 비용 조정 영역이 많다는 전제를 예외사항처리로 반영한다.
- 전표생성(미결)과 전표자동승인은 ERP 자동 처리이며 Owner는 재무관리팀으로 유지한다.

## 4. 혁신팀 검토 사항

- 수익배분 대상 계약 유형과 MG 차감 조건 확인
- 비용 조정 영역이 어떤 기준으로 예외사항처리되는지 확인
- 정산마감확정 후 자동 전표 처리의 적용 범위 확인
- 위탁 매출 정산과 수익배분 정산의 차이를 현업이 이해할 수 있는지 확인

## 5. 담당부서 확인 사항

- 사업부: 수익배분 매출/비용 집계 기준 확인
- 재무관리팀: 수익배분 Rule 검증, MG 상계, 정산마감, 자동승인 기준 확인

## 6. 결정 필요 사항

- 수익배분 정산을 위탁 정산의 하위 유형으로 볼지 별도 Process로 유지할지 결정해야 한다.
- 비용 조정 예외사항의 승인 책임을 결정해야 한다.
- MG 차감 판단 결과에 따른 정산마감 경로를 확정해야 한다.

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
- Navigator Process: 17 수익배분 매출 정산
- Current Coverage Status: Partial
- Review Status: Internal Review Ready
