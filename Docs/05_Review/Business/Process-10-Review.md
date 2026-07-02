# Process 10 Review Package

Title: 이벤트 : 제/상품
Purpose: Process 10을 Internal Review Ready 상태로 검토하기 위한 Review Package
Status: Internal Review Ready
Owner: 혁신팀
Last Updated: 2026-06-29
Related Docs: Docs/06_Data/02_Mapping/ProcessMapping.md, Docs/06_Data/02_Mapping/DouzoneProcessCoverage.md

## 1. 변경 요약

Process 10은 이벤트 주문, 당첨자 여부, 현장수령/택배발송 분리, 출고확정, 매출마감, 전표 승인 흐름을 정리했다.

- Cafe24 이벤트 주문접수
- EasyAdmin OMS 주문수집
- 택배발송 주문 분리와 현장수령 주문 분리
- EasyAdmin CS/현장수령 수량/재고 확정
- EasyAdmin WMS 재고이동 요청 확인, 출고확정, 택배출고 수량입력
- ERP 주문등록, 주문확정, 출고요청, 매출마감확정
- 전표생성(미결), 전표조회승인, 매출전기처리

## 2. Douzone와 차이점

Douzone 이벤트 PROCESS는 현장 분출, 현장 판매분 정리, 현장 잔여 재고 정리를 중심으로 한다. Copan Navigator에서는 이벤트 주문이 Cafe24/EasyAdmin을 통해 수집되고, 당첨자 여부에 따라 현장수령과 택배발송으로 분기되는 운영 특성을 추가했다.

## 3. Copan 운영 반영 내용

- 이벤트 주문은 Cafe24에서 접수되고 EasyAdmin OMS로 수집된다.
- 당첨자/현장수령 대상은 EasyAdmin CS/현장수령 기능을 활용하는 것으로 표현한다.
- 현장수령 물량과 택배발송 물량은 분리해 관리한다.
- 출고확정은 EasyAdmin WMS에서 물류센터 Owner로 처리한다.
- 매출마감확정 후 전표생성(미결)은 ERP 자동 처리이며 Owner는 사업부로 유지한다.
- 재무관리팀은 전표조회승인과 매출전기처리부터 담당한다.

## 4. 혁신팀 검토 사항

- 이벤트 주문정보에 이벤트 여부와 당첨자 여부가 함께 넘어오는지 확인
- EasyAdmin CS 현장수령 기능으로 현장수령분을 별도 관리할 수 있는지 확인
- 현장수령과 택배발송의 재고/출고 기준이 분리되어 있는지 확인
- 당첨자 아닌 주문 또는 미수령분 처리 기준 확인

## 5. 담당부서 확인 사항

- 사업부: 이벤트 주문관리, 매출마감확정 책임 확인
- 물류센터: 택배출고와 현장수령 출고확정 처리 기준 확인
- 판매현장: 현장수령 수량/재고 확정 및 수령 확인 기준 확인
- 재무관리팀: 이벤트 매출전표 승인 기준 확인

## 6. 결정 필요 사항

- 이벤트 주문정보에 이벤트 코드와 당첨자 여부를 필수값으로 받을지 결정해야 한다.
- 현장수령분과 택배발송분의 재고 차감 시점을 확정해야 한다.
- 현장 미수령분을 재고 복귀 또는 택배 전환 중 어떤 흐름으로 처리할지 결정해야 한다.

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

- Douzone Process: 이벤트 PROCESS
- Navigator Process: 11 이벤트 : 제/상품
- Current Coverage Status: Partial
- Review Status: Internal Review Ready
