# Process 03 Review Package

Title: 구매 요청 ~ 입고 : 판매대행
Purpose: Process 03을 Internal Review Ready 상태로 검토하기 위한 Review Package
Status: Internal Review Ready
Owner: 혁신팀
Last Updated: 2026-06-29
Related Docs: Docs/06_Data/02_Mapping/ProcessMapping.md, Docs/06_Data/02_Mapping/DouzoneProcessCoverage.md

## 1. 변경 요약

Process 03은 판매대행/위탁 입고를 위한 구매요청, 발주, EasyAdmin WMS 입고, 위탁재고 현황 반영까지 정리했다.

- 사업부 구매요청/구매요청확정
- 상생협력팀 발주등록/발주확정/입고요청
- EasyAdmin WMS 입고요청 확인, 입고처리, 입고수량 입력
- 입고정보 저장
- 위탁재고 현황 반영

## 2. Douzone와 차이점

Douzone 구매 입고 PROCESS는 일반 구매입고와 매입마감까지 연결된다. Copan Navigator의 Process 03은 판매대행/위탁 입고 특성상 매입전표까지 가지 않고, 위탁재고 입고와 재고 현황 중심으로 단순화했다.

## 3. Copan 운영 반영 내용

- 기존 위탁재고를 사입하는 경우 신규 품목코드 생성 후 진행한다는 운영 메모를 유지했다.
- 구매요청은 사업부 Owner로 표현한다.
- 발주와 입고요청은 상생협력팀 Owner로 표현한다.
- 실제 입고 처리는 EasyAdmin WMS에서 물류센터 Owner로 표현한다.
- 위탁재고 현황은 상생협력팀이 확인하는 ERP/DATABASE 성격의 정보 Node로 정리했다.

## 4. 혁신팀 검토 사항

- 현재 Navigator 번호 03은 “구매 요청 ~ 입고 : 판매대행”이다. 요청 문구의 “구매반품”과 동일한 의미인지 확인 필요
- 판매대행 입고에서 매입전표를 생성하지 않는 기준 확인
- 신규 품목코드 생성 조건 확인
- 위탁재고 현황 확인 Owner가 상생협력팀으로 맞는지 확인

## 5. 담당부서 확인 사항

- 사업부: 판매대행/위탁 입고 구매요청 생성 기준 확인
- 상생협력팀: 발주등록, 발주확정, 입고요청, 위탁재고 확인 책임 확인
- 물류센터: EasyAdmin WMS 입고 처리와 수량 입력 기준 확인

## 6. 결정 필요 사항

- Process 03을 구매반품으로 재정의해야 하는지, 판매대행 입고로 유지할지 결정해야 한다.
- 판매대행 입고 후 매입마감/전표가 발생하는 예외 케이스가 있는지 결정해야 한다.
- 위탁재고 현황 Node를 재고관리 Capability와 어떻게 연결할지 결정해야 한다.

## 7. Approval Checklist

□ Business Activity 확인
□ Execution System 확인
□ Owner 확인
□ Lane 확인
□ Auto Node 확인
□ ERP Menu 확인
□ Douzone 차이 확인
□ Copan 운영 반영 확인
□ 판매대행/구매반품 명칭 확인
□ 현업 승인 여부

## 8. Coverage 변경 사항

Coverage는 Approved 전까지 Complete로 변경하지 않는다.

- Douzone Process: 구매 입고 PROCESS
- Navigator Process: 03 구매 요청 ~ 입고 : 판매대행
- Current Coverage Status: Partial
- Review Status: Internal Review Ready
