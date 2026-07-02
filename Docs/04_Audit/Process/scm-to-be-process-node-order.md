# SCM TO-BE Process Group Node Order

Source: `Docs/06_Data/Samples/scm to-be process.pdf`

Related mapping: `Docs/06_Data/02_Mapping/ProcessMapping.md`

PDF page 1 is the cover. Pages 2-22 define the 21 selectable detail process groups.

Node type policy:
- Detail nodes follow the PDF legend types: ERP activity, WMS/OMS activity, POS activity, manual activity, decision/approval, linked process, database/document/system style nodes.
- PDF connection/API points are not represented as standalone nodes. They are represented as `api` edges with the visible label `API`.

## 01. 사업 기회 확보 ~ 구매 요청 : 제/상품
- detailProcessId: `business-to-purchase-request`
- node order:
  1. 사업기회확보
  2. 사업참여검토
  3. 계약등록
  4. 사업계약품의
  5. 프로젝트실행품의입력
  6. 프로젝트 실행품의(G/W)
  7. 프로젝트등록
  8. WBS코드등록
  9. 상품 등록 PROCESS
  10. 구매요청
  11. 거래처 등록 PROCESS

## 02. 구매 요청 ~ 입고 ~ 매입 전표 : 제/상품
- detailProcessId: `purchase-to-ap-invoice`
- node order:
  1. 구매요청
  2. 구매요청확정
  3. 발주등록
  4. 발주확정
  5. 입고요청
  6. 입고 요청 확인
  7. 입고 처리
  8. 입고 수량 입력
  9. 입고확정
  10. 매입마감조회
  11. 매입마감확정
  12. 전표생성(미결)
  13. 위탁재고 현황

## 03. 구매 요청 ~ 입고 : 판매 대행
- detailProcessId: `consignment-purchase-receipt`
- node order:
  1. 구매요청
  2. 구매요청확정
  3. 발주등록
  4. 발주확정
  5. 입고요청
  6. 입고 요청 확인
  7. 입고 처리
  8. 입고 수량 입력
  9. 위탁재고 현황

## 04. 주문 등록 ~ 출고 ~ 매출 전표 : B2B 국내
- detailProcessId: `b2b-domestic-order-to-sales`
- node order:
  1. 주문등록
  2. 주문확정
  3. 출고요청
  4. 위탁 여부
  5. 위탁재고 현황
  6. 출고 요청 확인
  7. B2B 출고 처리
  8. 출고 수량 입력
  9. 출고확정
  10. 일괄매출마감등록
  11. 매출마감확정
  12. 전표생성(미결)

## 05. 주문 반품 ~ 입고 ~ 반품 전표 : B2B 국내
- detailProcessId: `b2b-domestic-return`
- node order:
  1. 반품주문등록
  2. 반품주문확정
  3. 출고반품요청
  4. 위탁 여부
  5. 위탁재고 현황
  6. 입고 요청 확인
  7. B2B반품입고 처리
  8. 입고 수량 입력
  9. 반품확정
  10. 일괄매출마감등록
  11. 매출마감확정
  12. 전표생성(미결)

## 06. 주문 등록 ~ 수출 출고 ~ 매출 전표 : B2B 해외
- detailProcessId: `b2b-export-order-to-sales`
- node order:
  1. 주문입력
  2. 주문처리
  3. 수출이동지시
  4. 출고 요청 확인
  5. B2B 출고 처리
  6. 출고 수량 입력
  7. 출고처리(창고이동)
  8. 수출 출고지시
  9. B/L 기준 출고
  10. 일괄매출등록
  11. 매출전기처리
  12. 전표조회승인

## 07. 주문 등록 ~ 출고 ~ 매출 전표 : B2C
- detailProcessId: `b2c-order-to-sales`
- node order:
  1. B2C(온라인커머스) 주문
  2. 출고 수량 입력
  3. 위탁재고 현황
  4. 주문등록
  5. 주문확정
  6. 출고요청
  7. 출고확정
  8. 일괄매출마감등록
  9. 매출마감확정
  10. 전표생성(미결)

## 08. 예약 판매 ~ 출고 ~ 매출전표 : B2C
- detailProcessId: `preorder-to-sales`
- node order:
  1. B2C(온라인커머스) 예약 판매
  2. 출고 수량 입력
  3. 위탁재고 현황
  4. 주문등록
  5. 주문확정
  6. 출고요청
  7. 출고확정
  8. 일괄매출마감등록
  9. 매출마감확정
  10. 전표생성(미결)
  11. 선수금 반제처리

## 09. 주문 반품 ~ 입고 ~ 반품전표 : B2C
- detailProcessId: `b2c-return`
- node order:
  1. B2C(온라인커머스) 반품요청
  2. 반품입고 수량 입력
  3. 위탁재고 현황
  4. 반품주문등록
  5. 반품주문확정
  6. 출고반품요청
  7. 반품확정
  8. 일괄매출마감등록
  9. 매출마감확정
  10. 전표생성(미결)

## 10. 공연장/팝업 판매 ~ 출고 ~ 매출전표 : 제/상품
- detailProcessId: `popup-concert-stock-sales-sync`
- node order:
  1. 공연장 출고 재고이동요청
  2. 재고이동요청확정
  3. 재고이동확정
  4. 위탁 여부
  5. 위탁재고 현황
  6. 이동 수량 입력
  7. 물류센터 출고
  8. 주문 입력(POS)
  9. 주문확정
  10. 출고요청
  11. 출고확정
  12. 일괄매출마감등록
  13. 매출마감확정
  14. 현장 잔여 재고 재고이동요청
  15. 재고이동요청확정
  16. 재고이동확정
  17. 출고 수량 입력
  18. 공연장 출고

## 11. 이벤트 : 제/상품
- detailProcessId: `event-sales`
- note: Cafe24 이벤트 주문 유입 시 이벤트 정보, 당첨자 여부, 수령방식을 기준으로 현장수령과 택배발송을 분기하도록 확장 반영. 이벤트 정보가 없는 주문은 일반 B2C 주문 프로세스로 이관.
- node order:
  1. Cafe24 이벤트 주문 접수
  2. 주문정보 이지어드민 연동
  3. 이벤트 정보 확인
  4. 당첨자 여부 확인
  5. 수령방식 구분
  6. 현장수령 주문 별도 분리
  7. 현장수령 대상자 목록 관리
  8. 현장수령 수량/재고 확정
  9. 행사장 재고이동 또는 현장출고 준비
  10. 현장 수령 확인
  11. 현장수령 출고확정
  12. 택배발송 주문 분리
  13. 택배 출고요청
  14. 물류센터 출고 처리
  15. 택배 출고확정
  16. 매출마감 대상 집계
  17. 매출마감확정
  18. 매출전표 생성

## 12. 매장 판매 ~ 출고 ~ 매출전표 : 제/상품
- detailProcessId: `store-sales`
- node order:
  1. 매장 매출마감등록
  2. 주문등록(POS 연동)
  3. 주문확정
  4. 이지어드민연동현황
  5. 출고요청
  6. 출고확정
  7. 위탁 여부
  8. 일괄매출마감등록
  9. 매출마감확정
  10. 전표생성(미결)

## 13. 매장 간 재고이동 : 제/상품
- detailProcessId: `stock-transfer`
- node order:
  1. 재고이동요청(POS)
  2. 매장 재고이동 처리
  3. 재고이동확정(POS)
  4. 위탁 여부
  5. 위탁재고 현황
  6. 매장재고이동입력
  7. 매장재고이동현황

## 14. 기타 출고 : 제/상품
- detailProcessId: `other-issue`
- node order:
  1. 출고요청
  2. 무상 증정품 사용품의(G/W)
  3. 출고 요청 확인
  4. 출고 처리
  5. 출고 수량 입력
  6. 이지어드민 연동현황
  7. 기타출고확정
  8. 출고확정
  9. 위탁 여부

## 15. 기획사 로열티 정산 : 제/상품
- detailProcessId: `royalty-mg-settlement`
- node order:
  1. 로열티매출마감집계
  2. 로열티매출마감확정
  3. 예외사항처리
  4. MG차감 여부
  5. MG상계입력
  6. MG상계처리
  7. 정산마감등록
  8. 정산마감확정
  9. 전표생성(미결)

## 16. 위탁 매출 정산
- detailProcessId: `consignment-settlement`
- node order:
  1. 위탁매출마감집계
  2. 위탁매출마감확정
  3. 예외사항처리
  4. 정산마감등록
  5. 정산마감확정
  6. 전표생성(미결)

## 17. 수익배분 매출 정산
- detailProcessId: `revenue-share-settlement`
- node order:
  1. 매출/비용 집계
  2. 매출/비용 확정
  3. 예외사항처리
  4. MG차감여부
  5. MG상계입력
  6. MG상계처리
  7. 정산마감등록
  8. 정산마감확정
  9. 전표생성(미결)

## 18. 사업기회 ~ 비용 전표 생성 : (서비스)
- detailProcessId: `service-business-to-expense`
- node order:
  1. 사업기회확보
  2. 사업참여검토
  3. 계약등록
  4. 사업계약품의(G/W)
  5. 프로젝트실행품의입력
  6. 프로젝트 실행품의(G/W)
  7. 프로젝트등록
  8. WBS코드등록
  9. 프로젝트 지출결의(G/W)
  10. 전표생성(미결)

## 19. 구매 요청 ~ 매입 전표 생성 : (서비스)
- detailProcessId: `service-purchase-to-ap`
- node order:
  1. 구매요청
  2. 구매요청확정
  3. 발주등록
  4. 발주확정
  5. 입고요청
  6. 입고확정
  7. 매입마감조회
  8. 매입마감확정
  9. 전표생성(미결)

## 20. 주문 등록 ~ 매출 전표 생성 : (서비스)
- detailProcessId: `service-order-to-sales`
- node order:
  1. 주문일괄등록
  2. 주문확정
  3. 출고요청
  4. 출고확정
  5. 일괄매출마감등록
  6. 매출마감확정

## 21. 프로젝트 정산 : (서비스)
- detailProcessId: `service-project-settlement`
- node order:
  1. 매출/비용 마감집계
  2. 매출/비용 마감확정
  3. 예외사항처리
  4. MG차감여부
  5. MG상계입력
  6. MG상계처리
  7. 정산마감등록
  8. 정산마감확정
  9. 전표생성(미결)
