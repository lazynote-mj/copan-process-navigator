# Process 02 Review Package

Title: 구매 요청 ~ 입고 ~ 매입 전표 : 제/상품
Purpose: Process 02를 Internal Review Ready 상태로 검토하기 위한 Review Package
Status: Internal Review Ready
Owner: 혁신팀
Last Updated: 2026-06-29
Related Docs: Docs/06_Data/02_Mapping/ProcessMapping.md, Docs/06_Data/02_Mapping/DouzoneProcessCoverage.md

## 1. 변경 요약

Process 02는 계약/프로젝트 기반 구매요청 이후 제/상품 구매발주, EasyAdmin WMS 입고, ERP 재고(+), 매입마감, 전표 승인까지 정리했다.

- 사업부 구매요청/구매요청확정
- 상생협력팀 발주등록, 구매발주 품의, 발주확정, 입고요청
- EasyAdmin WMS 입고요청 확인, 입고처리, 입고수량 입력, 입고확정
- ERP 재고(+) 반영
- 위탁여부 확인 및 위탁재고 현황
- 매입마감조회/매입마감확정
- ERP 자동 전표생성(미결)
- 재무관리팀 전표조회승인, 매입전기처리

## 2. Douzone와 차이점

Douzone 구매 입고 PROCESS는 ERP 기준 구매입고와 매입마감 흐름을 중심으로 한다. Copan Navigator에서는 EasyAdmin WMS 입고 확인/수량 입력/입고확정과 위탁재고 분기를 추가해 실제 운영 흐름을 반영했다.

## 3. Copan 운영 반영 내용

- 구매요청은 Process 01의 계약/프로젝트/WBS 이후 생성되는 것으로 연결한다.
- 발주와 입고요청은 상생협력팀 Owner로 표현한다.
- 실제 물류 입고는 EasyAdmin WMS에서 물류센터 Owner로 표현한다.
- ERP 재고(+)는 입고확정의 자동 후속 결과이며 Owner는 물류센터로 유지한다.
- 매입마감확정 후 전표생성(미결)은 ERP 자동 처리지만 Owner는 직전 마감확정 Owner인 상생협력팀으로 유지한다.
- 재무관리팀은 전표조회승인과 매입전기처리부터 담당한다.

## 4. 혁신팀 검토 사항

- 구매발주 품의 Owner를 상생협력팀으로 두는 것이 실제 R&R과 맞는지 확인
- 가입고를 별도 Node로 표현해야 하는지 확인
- 구매송장 입력이 현재 매입마감조회/확정 사이에 별도 Node로 필요한지 확인
- 위탁재고/자사재고 분기 이후 매입마감 경로 차이 확인

## 5. 담당부서 확인 사항

- 사업부: 구매요청 생성 시점과 프로젝트/WBS 연결 조건 확인
- 상생협력팀: 발주등록, 발주확정, 입고요청, 매입마감 책임 확인
- 물류센터: EasyAdmin WMS 입고확정과 ERP 재고(+) 반영 기준 확인
- 재무관리팀: 매입전표 승인과 전기처리 기준 확인

## 6. 결정 필요 사항

- 가입고 사용 여부와 표현 방식을 결정해야 한다.
- 구매송장 입력을 별도 Business Activity로 추가할지 결정해야 한다.
- 위탁재고 입고와 자사재고 입고의 매입마감/전표 처리 차이를 확정해야 한다.

## 7. Approval Checklist

□ Business Activity 확인
□ Execution System 확인
□ Owner 확인
□ Lane 확인
□ Auto Node 확인
□ ERP Menu 확인
□ Douzone 차이 확인
□ Copan 운영 반영 확인
□ 계약/프로젝트 연결 확인
□ 재고(+) 반영 확인
□ 현업 승인 여부

## 8. Coverage 변경 사항

Coverage는 Approved 전까지 Complete로 변경하지 않는다.

- Douzone Process: 구매 입고 PROCESS
- Navigator Process: 02 구매 요청 ~ 입고 ~ 매입 전표 : 제/상품
- Current Coverage Status: Partial
- Review Status: Internal Review Ready
