# Process 07 Review Package

Title: 예약 판매 ~ 출고 ~ 매출전표 : B2C
Purpose: Process 07을 Internal Review Ready 상태로 검토하기 위한 Review Package
Status: Internal Review Ready
Owner: 혁신팀
Last Updated: 2026-06-29
Related Docs: Docs/06_Data/02_Mapping/ProcessMapping.md, Docs/06_Data/02_Mapping/DouzoneProcessCoverage.md

## 1. 변경 요약

Process 07은 B2C 판매 PROCESS를 기반으로 예약판매 운영 특성을 반영했다.

- Cafe24/온라인몰 예약판매 주문접수
- EasyAdmin OMS 주문수집
- EasyAdmin WMS 출고확인/출고수량 입력/출고확정
- OmniEsol ERP 주문등록, 주문확정, 출고요청, 매출마감확정
- PG 정산, 선수금 처리, 선수금 반제처리
- 전표생성(미결) Auto Node Owner를 사업부로 유지
- 재무관리팀 전표조회승인, 매출전기처리 추가

## 2. Douzone와 차이점

Douzone B2C 판매 PROCESS는 표준 온라인 주문-출고-매출 흐름을 중심으로 한다. Copan Navigator에서는 예약판매 특성 때문에 PG 정산, 선수금 처리, 배송완료 출고리스트와 선수금 대상 리스트 대사를 별도 흐름으로 추가했다.

## 3. Copan 운영 반영 내용

- 예약판매 주문은 온라인몰에서 접수되고 EasyAdmin OMS로 수집된다.
- 실제 출고 확인과 수량 입력은 EasyAdmin WMS에서 물류센터 Owner로 처리한다.
- 사업부가 ERP 매출마감확정을 수행하면 ERP가 전표생성(미결)을 자동 수행한다.
- Auto Node Owner Rule에 따라 전표생성(미결)의 Owner/Lane은 사업부로 유지한다.
- 재무관리팀은 전표조회승인과 매출전기처리부터 담당한다.

## 4. 혁신팀 검토 사항

- 예약판매 주문수집 시 Cafe24 외 다른 온라인몰이 포함되는지 확인
- 선수금 처리와 반제처리의 실제 기준 문서 확인
- 배송완료 출고리스트와 선수금 대상 리스트 대사 주체 확인
- EasyAdmin OMS/WMS 역할 구분이 현행 운영과 맞는지 확인

## 5. 담당부서 확인 사항

- 사업부: 예약판매 주문확정, 출고요청, 매출마감확정 책임 확인
- 물류센터: 예약판매 출고확인, 출고수량 입력, 출고확정 절차 확인
- 재무관리팀: PG 정산, 선수금 처리/반제, 전표조회승인 기준 확인

## 6. 결정 필요 사항

- 선수금 처리와 반제처리를 매출마감 전/후 어느 시점에 고정할지 결정
- 예약판매 배송완료 기준과 매출마감 기준의 일치 여부 결정
- 전표조회승인 후 매출전기처리까지 Process 07에 포함할지 확정

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

- Douzone Process: B2C 판매 PROCESS
- Navigator Process: 08 예약 판매 ~ 출고 ~ 매출전표 : B2C
- Current Coverage Status: Partial
- Review Status: Internal Review Ready
