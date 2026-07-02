# Process 11 Review Package

Title: 매장 판매 ~ 출고 ~ 매출전표 : 제/상품
Purpose: Process 11를 Internal Review Ready 상태로 검토하기 위한 Review Package
Status: Internal Review Ready
Owner: 혁신팀
Last Updated: 2026-06-29
Related Docs: Docs/06_Data/02_Mapping/ProcessMapping.md, Docs/06_Data/02_Mapping/DouzoneProcessCoverage.md

## 1. 변경 요약

Process 11는 매장/POS 판매, EasyChain 연동, ERP 주문/출고, 재고(-), 매출마감, 전표 승인 흐름을 정리했다.

- 매장판매
- POS/EasyChain 판매정보 연동
- ERP 주문등록, 주문확정, 출고요청, 출고확정
- 출고확정 확인과 ERP 재고(-)
- 매출마감대상 집계, 매출마감확정
- 전표생성(미결), 전표조회승인, 매출전기처리

## 2. Douzone와 차이점

Douzone 매장 출고 PROCESS는 POS매출연동과 ERP 수주/출고/매출 처리를 중심으로 한다. Copan Navigator에서는 매장/POS 운영 Owner를 판매현장으로 명확히 두고, 전표생성(미결) 이후 재무 승인 단계를 추가했다.

## 3. Copan 운영 반영 내용

- 매장판매와 POS/EasyChain 연동은 판매현장 Owner로 표현한다.
- ERP 주문/출고 처리는 매장 판매의 후속 처리이므로 Owner를 판매현장으로 유지한다.
- ERP 재고(-) 반영은 출고확정 후 자동/연동 결과로 표현한다.
- 전표생성(미결)은 매출마감확정의 자동 후속 처리이며 Owner는 판매현장으로 유지한다.
- 재무관리팀은 전표조회승인과 매출전기처리부터 담당한다.

## 4. 혁신팀 검토 사항

- 매장판매 Owner를 판매현장으로 유지하는 것이 R&R 기준에 맞는지 확인
- POS/EasyChain 연동 후 ERP 주문등록이 자동인지 수동인지 확인
- 매장 매출마감등록과 매출마감확정의 실제 차이를 확인
- 전표생성(미결)(AUTO) 중복 Node를 유지할지 통합할지 검토

## 5. 담당부서 확인 사항

- 판매현장: POS/EasyChain 판매정보 연동과 매출마감 책임 확인
- 사업부: 매장판매 프로세스 관여 여부 확인
- 물류센터: 매장 출고확정 확인 범위 확인
- 재무관리팀: 매장 매출전표 승인과 전기처리 기준 확인

## 6. 결정 필요 사항

- POS/EasyChain과 OmniEsol ERP 간 주문등록/출고확정 자동화 수준을 결정해야 한다.
- 매장 매출마감등록과 매출마감확정을 별도 Activity로 유지할지 결정해야 한다.
- 매장판매 관련 전표생성(미결) Node를 하나로 통합할지 결정해야 한다.

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

- Douzone Process: 매장 출고 PROCESS
- Navigator Process: 12 매장 판매 ~ 출고 ~ 매출전표 : 제/상품
- Current Coverage Status: Partial
- Review Status: Internal Review Ready
