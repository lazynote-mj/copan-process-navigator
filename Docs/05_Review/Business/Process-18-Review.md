# Process 18 Review Package

Title: 구매 요청 ~ 매입 전표 생성 : 서비스
Purpose: Process 18를 Internal Review Ready 상태로 검토하기 위한 Review Package
Status: Internal Review Ready
Owner: 혁신팀
Last Updated: 2026-06-29
Related Docs: Docs/06_Data/02_Mapping/ProcessMapping.md, Docs/06_Data/02_Mapping/DouzoneProcessCoverage.md

## 1. 변경 요약

Process 18는 서비스 구매의 특성을 반영해 물류 입고 대신 부분권한/검수 기준 입고확정과 매입마감/전표 흐름으로 정리했다.

- 사업부 서비스 구매요청/구매요청확정
- 사업부 구매발주 품의
- 상생협력팀 발주등록/발주확정
- 사업부 입고요청/입고확정
- 상생협력팀 매입마감조회/매입마감확정
- ERP 자동 전표생성(미결)
- 재무관리팀 전표조회승인, 매입전기처리

## 2. Douzone와 차이점

Douzone 구매 입고 PROCESS는 제/상품 입고와 재고 흐름이 포함된다. Copan Navigator의 서비스 구매는 물류 재고 입고가 아니라 서비스 제공/검수 완료를 기준으로 입고확정하고 매입마감으로 연결한다.

## 3. Copan 운영 반영 내용

- 서비스 구매요청과 입고확정은 사업부 Owner로 표현한다.
- 서비스 발주등록/발주확정과 매입마감은 상생협력팀 Owner로 표현한다.
- 전표생성(미결)은 ERP 자동 처리지만 Owner는 매입마감확정 Owner인 상생협력팀으로 유지한다.
- 재무관리팀은 전표조회승인과 매입전기처리부터 담당한다.
- 재고(+) Node는 서비스 구매 프로세스에는 포함하지 않는다.

## 4. 혁신팀 검토 사항

- 서비스 구매에서 입고요청/입고확정이라는 용어가 현업에 적절한지 확인
- 부분권한 입고요청의 실제 ERP 메뉴명 확인
- 서비스 매입마감 Owner가 상생협력팀으로 맞는지 확인
- 서비스 구매에서 구매송장 입력이 별도 단계로 필요한지 확인

## 5. 담당부서 확인 사항

- 사업부: 서비스 제공/검수 완료 기준과 입고확정 책임 확인
- 상생협력팀: 발주등록, 발주확정, 매입마감 책임 확인
- 재무관리팀: 서비스 매입전표 승인과 전기처리 기준 확인

## 6. 결정 필요 사항

- 서비스 구매의 “입고” 용어를 유지할지 “검수확정” 등으로 변경할지 결정해야 한다.
- 구매송장 입력을 별도 Node로 추가할지 결정해야 한다.
- 서비스 비용전표(Process 18)와 서비스 매입전표(Process 18)의 경계를 확정해야 한다.

## 7. Approval Checklist

□ Business Activity 확인
□ Execution System 확인
□ Owner 확인
□ Lane 확인
□ Auto Node 확인
□ ERP Menu 확인
□ Douzone 차이 확인
□ Copan 운영 반영 확인
□ 서비스 구매/검수 기준 확인
□ 현업 승인 여부

## 8. Coverage 변경 사항

Coverage는 Approved 전까지 Complete로 변경하지 않는다.

- Douzone Process: 구매 입고 PROCESS
- Navigator Process: 18 구매 요청 ~ 매입 전표 생성 : 서비스
- Current Coverage Status: Partial
- Review Status: Internal Review Ready
