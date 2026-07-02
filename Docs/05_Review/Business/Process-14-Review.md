# Process 14 Review Package

Title: 기획사 로열티 정산 : 제/상품
Purpose: Process 14를 Internal Review Ready 상태로 검토하기 위한 Review Package
Status: Internal Review Ready
Owner: 혁신팀
Last Updated: 2026-06-29
Related Docs: Docs/06_Data/02_Mapping/ProcessMapping.md, Docs/06_Data/02_Mapping/DouzoneProcessCoverage.md

## 1. 변경 요약

Process 14는 판매 로열티 정산 PROCESS를 기준으로 Copan의 기획사/권리자 정산 운영을 반영했다.

- 사업부 로열티 매출 집계
- 재무관리팀 로열티 마감확정
- 예외사항처리
- MG 차감여부 판단
- MG 상계입력/처리
- 정산마감등록/확정
- ERP 자동 전표생성(미결), 전표자동승인, 회계마감 반영

## 2. Douzone와 차이점

Douzone 판매 로열티 정산 PROCESS는 로열티 산출과 정산마감을 중심으로 한다. Copan Navigator에서는 사업부의 매출 집계와 재무관리팀의 마감확정/검증을 분리하고, MG 차감 여부와 자동 전표 처리 흐름을 명시했다.

## 3. Copan 운영 반영 내용

- 매출 집계는 사업부 Owner로 표현한다.
- 로열티 마감확정, 예외사항처리, MG 판단, 정산마감은 재무관리팀 Owner로 표현한다.
- 전표생성(미결)은 ERP 자동 처리지만, 직전 정산마감확정 Owner가 재무관리팀이므로 Owner/Lane은 재무관리팀으로 유지한다.
- 회계 상세 업무는 Navigator 구축 대상이 아니며 Reference Only로 표시한다.

## 4. 혁신팀 검토 사항

- 로열티 매출 집계의 주체가 사업부로 맞는지 확인
- MG 차감여부 판단 주체가 재무관리팀으로 맞는지 확인
- MG상계입력과 MG상계처리의 실제 ERP 메뉴/단계 확인
- 전표자동승인이 모든 로열티 정산 건에 적용되는지 확인

## 5. 담당부서 확인 사항

- 사업부: 로열티 매출 집계 기준과 정산 대상 확인
- 재무관리팀: 로열티 마감확정, MG 상계, 정산마감, 전표 자동승인 기준 확인

## 6. 결정 필요 사항

- MG 차감 기준과 예외 처리 승인 기준을 확정해야 한다.
- 자동승인 제외 대상이 있으면 별도 분기 필요 여부를 결정해야 한다.
- 회계마감 반영을 Navigator Node로 유지할지 Reference Only 설명으로만 둘지 결정해야 한다.

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

- Douzone Process: 판매 로열티 정산 PROCESS
- Navigator Process: 15 기획사 로열티 정산 : 제/상품
- Current Coverage Status: Partial
- Review Status: Internal Review Ready
