# Process 08 Review Package

Title: 주문 반품 ~ 입고 ~ 반품전표 : B2C
Purpose: Process 08를 Internal Review Ready 상태로 검토하기 위한 Review Package
Status: Internal Review Ready
Owner: 혁신팀
Last Updated: 2026-06-29
Related Docs: Docs/06_Data/02_Mapping/ProcessMapping.md, Docs/06_Data/02_Mapping/DouzoneProcessCoverage.md

## 1. 변경 요약

Process 08는 B2C 판매 반품 PROCESS를 기반으로 Copan 온라인 반품 운영을 반영했다.

- 온라인몰 반품요청
- EasyAdmin OMS 반품주문수집
- EasyAdmin WMS 반품입고확인, 반품입고 수량입력
- 위탁여부 확인, 위탁재고 현황 확인
- OmniEsol ERP 반품주문등록, 반품주문확정, 반품입고요청, 반품확정
- ERP 재고(+) 반영
- 반품마감확정, 전표생성(미결), 전표조회승인, 매출전기처리

## 2. Douzone와 차이점

Douzone B2C 판매 반품 PROCESS는 표준 반품입고와 반품마감 흐름을 중심으로 한다. Copan Navigator에서는 온라인몰 반품요청과 EasyAdmin OMS/WMS 반품입고 흐름을 명확히 분리했다.

## 3. Copan 운영 반영 내용

- 반품 요청은 온라인몰에서 발생하고 EasyAdmin OMS로 수집된다.
- 실제 반품 입고 확인과 수량 입력은 EasyAdmin WMS에서 물류센터 Owner로 처리한다.
- 반품주문등록/확정과 반품마감은 사업부 Owner로 ERP에서 처리한다.
- 전표생성(미결)은 반품마감확정의 자동 후속 처리이므로 Owner/Lane은 사업부로 유지한다.
- 재무관리팀은 전표조회승인과 매출전기처리부터 담당한다.

## 4. 혁신팀 검토 사항

- B2C 반품 요청과 반품입고 요청의 실제 명칭 확인
- 반품입고 수량 입력이 EasyAdmin WMS에서 처리되는지 확인
- ERP 재고(+) 반영 시점이 반품확정인지 반품입고확정인지 확인
- 반품마감확정 후 전표생성(미결) 자동 처리 여부 확인

## 5. 담당부서 확인 사항

- 사업부: 반품주문등록, 반품주문확정, 반품마감확정 책임 확인
- 물류센터: 반품입고확인, 수량입력, 반품확정 처리 범위 확인
- 재무관리팀: 반품전표 승인과 전기처리 기준 확인

## 6. 결정 필요 사항

- 반품확정과 반품마감확정 사이의 ERP 메뉴명을 확정해야 한다.
- 재고(+) 반영 Node를 ERP 재고현황으로 유지할지 입고정보로 표시할지 결정해야 한다.
- 반품전표 승인 이후 매출전기처리까지 Process 08 범위에 포함할지 확정해야 한다.

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

- Douzone Process: B2C 판매 반품 PROCESS
- Navigator Process: 09 주문 반품 ~ 입고 ~ 반품전표 : B2C
- Current Coverage Status: Partial
- Review Status: Internal Review Ready
