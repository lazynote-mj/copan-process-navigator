# Process 09 Review Package

Title: 공연장/팝업 판매 ~ 출고 ~ 매출전표 : 제/상품
Purpose: Process 09을 Internal Review Ready 상태로 검토하기 위한 Review Package
Status: Internal Review Ready
Owner: 혁신팀
Last Updated: 2026-06-29
Related Docs: Docs/06_Data/02_Mapping/ProcessMapping.md, Docs/06_Data/02_Mapping/DouzoneProcessCoverage.md

## 1. 변경 요약

Process 09은 공연장/팝업 출고, 현장판매, 잔여재고 복귀, 매출마감, 전표 승인 흐름을 하나의 운영 프로세스로 정리했다.

- 공연장 출고 재고이동요청/확정
- EasyAdmin WMS 물류센터 출고와 이동수량 입력
- 현장판매 주문입력
- 위탁여부 확인, 위탁재고 현황 확인
- ERP 주문등록, 주문확정, 출고요청, 출고확정
- 잔여재고 이동요청/확정 및 입/출고정보 저장
- 매출마감확정, 전표생성(미결), 전표조회승인, 매출전기처리

## 2. Douzone와 차이점

Douzone 공연장/팝업 PROCESS는 공연장 출고, 판매분 매출처리, 현장 잔여 재고 정리를 표현한다. Copan Navigator에서는 EasyAdmin WMS 출고와 현장판매/POS 운영, 잔여재고 복귀를 Owner 기준으로 나누고, 재무 승인 단계를 추가했다.

## 3. Copan 운영 반영 내용

- 공연장 출고와 잔여재고 복귀는 사업부 책임의 ERP 재고이동 흐름으로 표현한다.
- 물류센터 출고와 이동수량 입력은 EasyAdmin WMS 기준으로 물류센터 Owner가 담당한다.
- 현장판매 주문입력과 현장 출고정보는 판매현장 Owner로 분리한다.
- 매출마감확정 후 전표생성(미결)은 ERP 자동 처리이며 Owner는 사업부로 유지한다.
- 재무관리팀은 전표조회승인과 매출전기처리부터 담당한다.

## 4. 혁신팀 검토 사항

- 공연장/팝업 현장판매가 EasyChain/POS 기준으로 충분히 표현되었는지 확인
- 잔여재고 이동요청/확정의 실제 Owner가 사업부인지 현장인지 확인
- 공연장 출고와 현장판매 출고가 동일 재고 흐름인지 분리 흐름인지 확인
- 입/출고정보 저장 Node의 시스템 표현이 DATABASE로 충분한지 확인

## 5. 담당부서 확인 사항

- 사업부: 공연장 출고 요청, 잔여재고 복귀, 매출마감확정 책임 확인
- 물류센터: 물류센터 출고, 이동수량 입력, 출고확정 절차 확인
- 판매현장: 현장판매 주문입력과 현장 출고정보 기준 확인
- 재무관리팀: 전표조회승인과 전기처리 기준 확인

## 6. 결정 필요 사항

- 공연장/팝업 현장판매를 POS/EasyChain 기준으로 고정할지 결정해야 한다.
- 잔여재고 복귀 시 출고창고/입고창고 재고(+/-) 라벨 기준을 확정해야 한다.
- 공연장/팝업 매출마감 기준과 재고이동 완료 기준의 선후 관계를 확정해야 한다.

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

- Douzone Process: 공연장(행사장) 팝업 PROCESS
- Navigator Process: 10 공연장/팝업 판매 ~ 출고 ~ 매출전표 : 제/상품
- Current Coverage Status: Partial
- Review Status: Internal Review Ready
