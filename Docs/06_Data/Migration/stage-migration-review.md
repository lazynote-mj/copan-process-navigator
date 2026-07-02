# Process Stage Migration Review Queue

자동 migration에서 제외한 수동 검토 대상입니다.

|processId|nodeId|nodeName|currentPhaseId|recommendedStageId|issueType|reason|
|---|---|---|---|---|---|---|
|to-be-overview|inbound-info|입고정보전달|procure-to-pay::p6|(review)|ambiguous|low confidence|
|to-be-overview|ap-voucher-pending|전표생성(미결)|procure-to-pay::p10|finance::pending-voucher|wrongProcessPrefix|held by review-name policy|
|to-be-overview|sales-posting|전표 생성(미결)|order-to-cash::p8|finance::pending-voucher|wrongProcessPrefix|held by review-name policy|
|to-be-overview|interface-rule-consignment-inbound|위탁여부 확인|procure-to-pay::p9|cross-process::consignment-check|wrongProcessPrefix|held by review-name policy|
|to-be-overview|interface-rule-consignment-return|위탁여부 확인|overview::return|cross-process::consignment-check|wrongProcessPrefix|held by review-name policy|
|to-be-overview|consignment-stock-status|위탁재고현황|overview::consignment|procure-to-pay::p9|wrongProcessPrefix|wrongProcessPrefix|
|to-be-overview|exception-handling|예외사항처리|overview::consignment|cross-process::exception-handling|wrongProcessPrefix|held by review-name policy|
|to-be-overview|settlement-posting|정산전표처리|overview::royalty-mg|(review)|ambiguous|low confidence|
|to-be-overview|settlement-fi-posting|정산전표 반영|overview::royalty-mg|(review)|ambiguous|low confidence|
|to-be-overview|node-mqkytkqz-1iibf|예외사항처리|business-to-project::p1|cross-process::exception-handling|wrongProcessPrefix|held by review-name policy|
|to-be-overview|node-mqlps54s-pgz84|위탁여부 확인|business-to-project::p1|cross-process::consignment-check|wrongProcessPrefix|held by review-name policy|
|to-be-overview|node-mqlr0uuz-88fxj|출고등록|business-to-project::p1|order-to-cash::p4|wrongProcessPrefix|wrongProcessPrefix|
|to-be-overview|node-mqlvl7lo-870r5|입고등록|business-to-project::p1|procure-to-pay::p7|wrongProcessPrefix|wrongProcessPrefix|
|to-be-overview|node-mqm2ntsg-6sr8d|매장판매|business-to-project::p1|order-to-cash::p1|wrongProcessPrefix|wrongProcessPrefix|
|business-to-project|inbound-info|입고정보전달|p9|(review)|legacyPhase|low confidence|
|business-to-project|inbound-check|입고확인|p9|procure-to-pay::p7|legacyPhase|legacy phase but not high confidence|
|business-to-project|inbound-confirm|입고확정|p9|procure-to-pay::p8|legacyPhase|legacy phase but not high confidence|
|business-to-project|stock-plus|재고인식(+)|p9|procure-to-pay::p9|legacyPhase|legacy phase but not high confidence|
|consignment-purchase-receipt|consignment-purchase-receipt-step-04|발주확정|p4|(review)|legacyPhase|low confidence|
|consignment-purchase-receipt|consignment-purchase-receipt-step-05|입고요청|p5|procure-to-pay::p6|legacyPhase|legacy phase but not high confidence|
|consignment-purchase-receipt|consignment-purchase-receipt-step-06|이지어드민 입고 정보|p6|(review)|legacyPhase|low confidence|
|consignment-purchase-receipt|consignment-purchase-receipt-step-07|입고 처리|p7|procure-to-pay::p7|legacyPhase|legacy phase but not high confidence|
|consignment-purchase-receipt|consignment-purchase-receipt-step-08|입고 요청 확인|p8|procure-to-pay::p6|legacyPhase|legacy phase but not high confidence|
|consignment-purchase-receipt|consignment-purchase-receipt-step-09|입고 수량 입력|p9|procure-to-pay::p7|legacyPhase|legacy phase but not high confidence|
|consignment-purchase-receipt|consignment-purchase-receipt-step-10|위탁재고 현황|p10|procure-to-pay::p9|legacyPhase|legacy phase but not high confidence|
|b2b-domestic-order-to-sales|b2b-domestic-order-to-sales-step-01|주문등록|p1|overview::order-register|legacyPhase|legacy phase but not high confidence|
|b2b-domestic-order-to-sales|b2b-domestic-order-to-sales-step-02|주문확정|p2|order-to-cash::p2a|legacyPhase|legacy phase but not high confidence|
|b2b-domestic-order-to-sales|b2b-domestic-order-to-sales-step-03|출고요청|p3|order-to-cash::p3|legacyPhase|legacy phase but not high confidence|
|b2b-domestic-order-to-sales|b2b-domestic-order-to-sales-step-04|위탁 여부 확인|p4|cross-process::consignment-check|legacyPhase|held by review-name policy|
|b2b-domestic-order-to-sales|b2b-domestic-order-to-sales-step-05|위탁재고 현황|p5|procure-to-pay::p9|legacyPhase|legacy phase but not high confidence|
|b2b-domestic-order-to-sales|b2b-domestic-order-to-sales-step-06|출고정보|p6|order-to-cash::p3i|legacyPhase|held by review-name policy|
|b2b-domestic-order-to-sales|b2b-domestic-order-to-sales-step-07|출고 요청 확인|p7|order-to-cash::p3|legacyPhase|legacy phase but not high confidence|
|b2b-domestic-order-to-sales|b2b-domestic-order-to-sales-step-08|B2B 출고 처리|p8|order-to-cash::p4|legacyPhase|legacy phase but not high confidence|
|b2b-domestic-order-to-sales|b2b-domestic-order-to-sales-step-09|출고 수량 입력|p9|order-to-cash::p4|legacyPhase|legacy phase but not high confidence|
|b2b-domestic-order-to-sales|b2b-domestic-order-to-sales-step-10|출고확정|p10|order-to-cash::p5|legacyPhase|legacy phase but not high confidence|
|b2b-domestic-order-to-sales|b2b-domestic-order-to-sales-step-13|전표생성(미결)|p13|finance::pending-voucher|legacyPhase|held by review-name policy|
|b2b-domestic-order-to-sales|node-mqp1ud8l-m02lh|재고현황|business-to-project::p1|procure-to-pay::p9|wrongProcessPrefix|wrongProcessPrefix|
|b2b-domestic-return|b2b-domestic-return-step-01|반품주문등록|p1|overview::return|legacyPhase|legacy phase but not high confidence|
|b2b-domestic-return|b2b-domestic-return-step-02|반품주문확정|p2|overview::return|legacyPhase|legacy phase but not high confidence|
|b2b-domestic-return|b2b-domestic-return-step-03|출고반품요청|p3|overview::return|legacyPhase|legacy phase but not high confidence|
|b2b-domestic-return|b2b-domestic-return-step-04|위탁 여부 확인|p4|overview::return|legacyPhase|held by review-name policy|
|b2b-domestic-return|b2b-domestic-return-step-05|위탁재고 현황|p5|procure-to-pay::p9|legacyPhase|legacy phase but not high confidence|
|b2b-domestic-return|b2b-domestic-return-step-06|입고정보|p6|overview::return|legacyPhase|legacy phase but not high confidence|
|b2b-domestic-return|b2b-domestic-return-step-07|입고 요청 확인|p7|procure-to-pay::p6|legacyPhase|legacy phase but not high confidence|
|b2b-domestic-return|b2b-domestic-return-step-08|B2B반품입고 처리|p8|procure-to-pay::p7|legacyPhase|legacy phase but not high confidence|
|b2b-domestic-return|b2b-domestic-return-step-09|입고 수량 입력|p9|procure-to-pay::p7|legacyPhase|legacy phase but not high confidence|
|b2b-domestic-return|b2b-domestic-return-step-10|반품확정|p10|procure-to-pay::p8|legacyPhase|legacy phase but not high confidence|
|b2b-domestic-return|b2b-domestic-return-step-11|일괄매출마감등록|p11|overview::return|legacyPhase|legacy phase but not high confidence|
|b2b-domestic-return|b2b-domestic-return-step-12|매출마감확정|p12|overview::return|legacyPhase|legacy phase but not high confidence|
|b2b-domestic-return|b2b-domestic-return-step-13|전표생성(미결)|p13|overview::return|legacyPhase|held by review-name policy|
|b2b-domestic-return|node-mqpwkzwd-to6z3|입고정보|business-to-project::p1|overview::return|wrongProcessPrefix|wrongProcessPrefix|
|b2b-export-order-to-sales|b2b-export-order-to-sales-step-01|주문입력|p1|order-to-cash::p1|legacyPhase|legacy phase but not high confidence|
|b2b-export-order-to-sales|b2b-export-order-to-sales-step-02|출고정보|p2|order-to-cash::p3i|legacyPhase|held by review-name policy|
|b2b-export-order-to-sales|b2b-export-order-to-sales-step-03|주문처리|p3|(review)|legacyPhase|low confidence|
|b2b-export-order-to-sales|b2b-export-order-to-sales-step-04|수출이동지시|p4|order-to-cash::p3|legacyPhase|legacy phase but not high confidence|
|b2b-export-order-to-sales|b2b-export-order-to-sales-step-05|출고 요청 확인|p5|order-to-cash::p3|legacyPhase|legacy phase but not high confidence|
|b2b-export-order-to-sales|b2b-export-order-to-sales-step-06|B2B 출고 처리|p6|order-to-cash::p4|legacyPhase|legacy phase but not high confidence|
|b2b-export-order-to-sales|b2b-export-order-to-sales-step-07|출고 수량 입력|p7|order-to-cash::p4|legacyPhase|legacy phase but not high confidence|
|b2b-export-order-to-sales|b2b-export-order-to-sales-step-08|출고처리(창고이동)|p8|overview::warehouse-transfer|legacyPhase|legacy phase but not high confidence|
|b2b-export-order-to-sales|b2b-export-order-to-sales-step-09|자동 입/출고정보|p9|order-to-cash::p3i|legacyPhase|held by review-name policy|
|b2b-export-order-to-sales|b2b-export-order-to-sales-step-10|수출출고지시|p10|order-to-cash::p3|legacyPhase|legacy phase but not high confidence|
|b2b-export-order-to-sales|b2b-export-order-to-sales-step-11|B/L 기준 출고|p11|(review)|legacyPhase|low confidence|
|b2b-export-order-to-sales|b2b-export-order-to-sales-step-12|일괄매출등록|p12|(review)|legacyPhase|low confidence|
|b2b-export-order-to-sales|b2b-export-order-to-sales-step-14|전표조회승인|p14|order-to-cash::p8|legacyPhase|legacy phase but not high confidence|
|b2b-export-order-to-sales|node-mqq59t67-swyut|출고정보|business-to-project::p1|order-to-cash::p3i|wrongProcessPrefix|held by review-name policy|
|b2c-order-to-sales|b2c-order-to-sales-step-01|B2C(온라인커머스) 주문|p1|order-to-cash::p1|legacyPhase|legacy phase but not high confidence|
|b2c-order-to-sales|b2c-order-to-sales-step-03|B2C 출고 확인|p3|order-to-cash::p4|legacyPhase|legacy phase but not high confidence|
|b2c-order-to-sales|b2c-order-to-sales-step-04|출고 수량 입력|p4|order-to-cash::p4|legacyPhase|legacy phase but not high confidence|
|b2c-order-to-sales|b2c-order-to-sales-step-05|위탁 여부 확인|p5|cross-process::consignment-check|legacyPhase|held by review-name policy|
|b2c-order-to-sales|b2c-order-to-sales-step-06|위탁재고 현황|p6|procure-to-pay::p9|legacyPhase|legacy phase but not high confidence|
|b2c-order-to-sales|b2c-order-to-sales-step-07|주문등록|p7|overview::order-register|legacyPhase|legacy phase but not high confidence|
|b2c-order-to-sales|b2c-order-to-sales-step-08|주문확정|p8|order-to-cash::p2a|legacyPhase|legacy phase but not high confidence|
|b2c-order-to-sales|b2c-order-to-sales-step-09|출고요청|p9|order-to-cash::p3|legacyPhase|legacy phase but not high confidence|
|b2c-order-to-sales|b2c-order-to-sales-step-10|출고확정|p10|order-to-cash::p5|legacyPhase|legacy phase but not high confidence|
|b2c-order-to-sales|b2c-order-to-sales-step-11|출고정보|p11|order-to-cash::p3i|legacyPhase|held by review-name policy|
|b2c-order-to-sales|b2c-order-to-sales-step-14|전표생성(미결)|p14|finance::pending-voucher|legacyPhase|held by review-name policy|
|preorder-to-sales|preorder-to-sales-step-01|B2C(온라인커머스) 예약 판매|p1|order-to-cash::p1|legacyPhase|legacy phase but not high confidence|
|preorder-to-sales|preorder-to-sales-step-02|PG사 정산|p2|(review)|legacyPhase|low confidence|
|preorder-to-sales|preorder-to-sales-step-04|B2C 출고 확인|p4|order-to-cash::p4|legacyPhase|legacy phase but not high confidence|
|preorder-to-sales|preorder-to-sales-step-05|출고 수량 입력|p5|order-to-cash::p4|legacyPhase|legacy phase but not high confidence|
|preorder-to-sales|preorder-to-sales-step-06|위탁 여부 확인|p6|cross-process::consignment-check|legacyPhase|held by review-name policy|
|preorder-to-sales|preorder-to-sales-step-07|위탁재고 현황|p7|procure-to-pay::p9|legacyPhase|legacy phase but not high confidence|
|preorder-to-sales|preorder-to-sales-step-08|주문등록|p8|overview::order-register|legacyPhase|legacy phase but not high confidence|
|preorder-to-sales|preorder-to-sales-step-09|주문확정|p9|order-to-cash::p2a|legacyPhase|legacy phase but not high confidence|
|preorder-to-sales|preorder-to-sales-step-10|출고요청|p10|order-to-cash::p3|legacyPhase|legacy phase but not high confidence|
|preorder-to-sales|preorder-to-sales-step-11|출고확정|p11|order-to-cash::p5|legacyPhase|legacy phase but not high confidence|
|preorder-to-sales|preorder-to-sales-step-12|출고정보|p12|order-to-cash::p3i|legacyPhase|held by review-name policy|
|preorder-to-sales|preorder-to-sales-step-15|전표생성(미결)|p15|finance::pending-voucher|legacyPhase|held by review-name policy|
|preorder-to-sales|preorder-to-sales-step-16|선수금 처리|p16|overview::fund|legacyPhase|legacy phase but not high confidence|
|preorder-to-sales|preorder-to-sales-step-17|선수금 반제처리|p17|overview::fund|legacyPhase|legacy phase but not high confidence|
|stock-transfer|stock-transfer-step-01|재고이동요청|p1|overview::warehouse-transfer|legacyPhase|legacy phase but not high confidence|
|stock-transfer|stock-transfer-step-02|매장 재고이동 처리|p2|overview::warehouse-transfer|legacyPhase|legacy phase but not high confidence|
|stock-transfer|stock-transfer-step-03|재고이동확정|p3|overview::warehouse-transfer|legacyPhase|legacy phase but not high confidence|
|stock-transfer|stock-transfer-step-04|위탁 여부 확인|p4|overview::warehouse-transfer|legacyPhase|held by review-name policy|
|stock-transfer|stock-transfer-step-05|위탁재고 현황|p5|procure-to-pay::p9|legacyPhase|legacy phase but not high confidence|
|stock-transfer|stock-transfer-step-06|입/출고정보|p6|overview::warehouse-transfer|legacyPhase|held by review-name policy|
|stock-transfer|stock-transfer-step-07|매장재고이동입력|p7|overview::warehouse-transfer|legacyPhase|legacy phase but not high confidence|
|stock-transfer|stock-transfer-step-08|매장재고이동현황|p8|overview::warehouse-transfer|legacyPhase|legacy phase but not high confidence|
|other-issue|other-issue-step-01|출고요청|p1|overview::other-outbound|legacyPhase|legacy phase but not high confidence|
|other-issue|other-issue-step-02|무상 증정품 사용품의|p2|overview::other-outbound|legacyPhase|legacy phase but not high confidence|
|other-issue|other-issue-step-03|출고확정|p3|overview::other-outbound|legacyPhase|legacy phase but not high confidence|
|other-issue|other-issue-step-04|위탁 여부 확인|p4|overview::other-outbound|legacyPhase|held by review-name policy|
|other-issue|other-issue-step-05|출고 요청 확인|p5|overview::other-outbound|legacyPhase|legacy phase but not high confidence|
|other-issue|other-issue-step-06|출고 처리|p6|overview::other-outbound|legacyPhase|legacy phase but not high confidence|
|other-issue|other-issue-step-07|출고 수량 입력|p7|overview::other-outbound|legacyPhase|legacy phase but not high confidence|
|other-issue|other-issue-step-08|이지어드민 연동현황|p8|overview::other-outbound|legacyPhase|legacy phase but not high confidence|
|other-issue|other-issue-step-09|기타출고확정|p9|overview::other-outbound|legacyPhase|legacy phase but not high confidence|
|other-issue|other-issue-step-10|출고정보|p10|overview::other-outbound|legacyPhase|held by review-name policy|
|consignment-settlement|consignment-settlement-step-01|위탁매출마감집계|p1|overview::consignment|legacyPhase|legacy phase but not high confidence|
|consignment-settlement|consignment-settlement-step-02|위탁매출마감확정|p2|overview::consignment|legacyPhase|legacy phase but not high confidence|
|consignment-settlement|consignment-settlement-step-03|예외사항처리|p3|overview::consignment|legacyPhase|held by review-name policy|
|consignment-settlement|consignment-settlement-step-04|정산마감등록|p4|overview::consignment|legacyPhase|legacy phase but not high confidence|
|consignment-settlement|consignment-settlement-step-05|정산마감확정|p5|overview::consignment|legacyPhase|legacy phase but not high confidence|
|consignment-settlement|consignment-settlement-step-06|전표생성(미결)|p6|overview::consignment|legacyPhase|held by review-name policy|
|royalty-mg-settlement|royalty-mg-settlement-step-01|로열티매출마감집계|p1|overview::royalty-mg|legacyPhase|legacy phase but not high confidence|
|royalty-mg-settlement|royalty-mg-settlement-step-02|로열티매출마감확정|p2|overview::royalty-mg|legacyPhase|legacy phase but not high confidence|
|royalty-mg-settlement|royalty-mg-settlement-step-03|예외사항처리|p3|overview::royalty-mg|legacyPhase|held by review-name policy|
|royalty-mg-settlement|royalty-mg-settlement-step-04|MG차감 여부|p4|overview::royalty-mg|legacyPhase|legacy phase but not high confidence|
|royalty-mg-settlement|royalty-mg-settlement-step-05|MG상계입력|p5|overview::royalty-mg|legacyPhase|legacy phase but not high confidence|
|royalty-mg-settlement|royalty-mg-settlement-step-06|MG상계처리|p6|overview::royalty-mg|legacyPhase|legacy phase but not high confidence|
|royalty-mg-settlement|royalty-mg-settlement-step-07|정산마감등록|p7|overview::royalty-mg|legacyPhase|legacy phase but not high confidence|
|royalty-mg-settlement|royalty-mg-settlement-step-08|정산마감확정|p8|overview::royalty-mg|legacyPhase|legacy phase but not high confidence|
|royalty-mg-settlement|royalty-mg-settlement-step-09|전표생성(미결)|p9|overview::royalty-mg|legacyPhase|held by review-name policy|
|popup-concert-stock-sales-sync|popup-concert-stock-sales-sync-step-01|공연장 출고 재고이동요청|p1|overview::warehouse-transfer|legacyPhase|legacy phase but not high confidence|
|popup-concert-stock-sales-sync|popup-concert-stock-sales-sync-step-02|공연장 출고 재고이동요청확정|p2|overview::warehouse-transfer|legacyPhase|legacy phase but not high confidence|
|popup-concert-stock-sales-sync|popup-concert-stock-sales-sync-step-03|출고정보|p3|order-to-cash::p3i|legacyPhase|held by review-name policy|
|popup-concert-stock-sales-sync|popup-concert-stock-sales-sync-step-04|재고이동확정|p4|overview::warehouse-transfer|legacyPhase|legacy phase but not high confidence|
|popup-concert-stock-sales-sync|popup-concert-stock-sales-sync-step-05|위탁 여부|p5|cross-process::consignment-check|legacyPhase|held by review-name policy|
|popup-concert-stock-sales-sync|popup-concert-stock-sales-sync-step-06|위탁재고 현황|p6|procure-to-pay::p9|legacyPhase|legacy phase but not high confidence|
|popup-concert-stock-sales-sync|popup-concert-stock-sales-sync-step-07|이동 수량 입력|p7|order-to-cash::p4|legacyPhase|legacy phase but not high confidence|
|popup-concert-stock-sales-sync|popup-concert-stock-sales-sync-step-08|물류센터 출고|p8|order-to-cash::p4|legacyPhase|legacy phase but not high confidence|
|popup-concert-stock-sales-sync|popup-concert-stock-sales-sync-step-09|주문 입력(이지체인/POS)|p9|order-to-cash::p1|legacyPhase|legacy phase but not high confidence|
|popup-concert-stock-sales-sync|popup-concert-stock-sales-sync-step-10|위탁 여부|p10|cross-process::consignment-check|legacyPhase|held by review-name policy|
|popup-concert-stock-sales-sync|popup-concert-stock-sales-sync-step-11|주문확정|p11|order-to-cash::p2a|legacyPhase|legacy phase but not high confidence|
|popup-concert-stock-sales-sync|popup-concert-stock-sales-sync-step-12|출고요청|p12|order-to-cash::p3|legacyPhase|legacy phase but not high confidence|
|popup-concert-stock-sales-sync|popup-concert-stock-sales-sync-step-13|출고확정|p13|order-to-cash::p5|legacyPhase|legacy phase but not high confidence|
|popup-concert-stock-sales-sync|popup-concert-stock-sales-sync-step-16|잔여재고 이동요청|p16|overview::warehouse-transfer|legacyPhase|legacy phase but not high confidence|
|popup-concert-stock-sales-sync|popup-concert-stock-sales-sync-step-17|잔여재고 이동요청확정|p17|overview::warehouse-transfer|legacyPhase|legacy phase but not high confidence|
|popup-concert-stock-sales-sync|popup-concert-stock-sales-sync-step-18|잔여재고 입/출고정보|p18|order-to-cash::p3i|legacyPhase|held by review-name policy|
|popup-concert-stock-sales-sync|popup-concert-stock-sales-sync-step-19|잔여재고 이동확정|p19|overview::warehouse-transfer|legacyPhase|legacy phase but not high confidence|
|popup-concert-stock-sales-sync|popup-concert-stock-sales-sync-step-20|위탁 여부|p20|cross-process::consignment-check|legacyPhase|held by review-name policy|
|popup-concert-stock-sales-sync|popup-concert-stock-sales-sync-step-21|잔여 재고 위탁재고 현황|p21|procure-to-pay::p9|legacyPhase|legacy phase but not high confidence|
|popup-concert-stock-sales-sync|popup-concert-stock-sales-sync-step-22|출고 수량 입력|p22|order-to-cash::p4|legacyPhase|legacy phase but not high confidence|
|popup-concert-stock-sales-sync|popup-concert-stock-sales-sync-step-23|현장 출고|p23|order-to-cash::p4|legacyPhase|legacy phase but not high confidence|
|popup-concert-stock-sales-sync|node-mqu63xz3-eej0t|입/출고정보|business-to-project::p1|order-to-cash::p3i|wrongProcessPrefix|held by review-name policy|
|popup-concert-stock-sales-sync|node-mqu7tqrc-h4amm|출고정보|business-to-project::p1|order-to-cash::p3i|wrongProcessPrefix|held by review-name policy|
|business-to-purchase-request|business-to-purchase-request-step-09|상품 등록 PROCESS|p9|(review)|legacyPhase|low confidence|
|business-to-purchase-request|business-to-purchase-request-step-11|거래처 등록 PROCESS|p11|(review)|legacyPhase|low confidence|
|purchase-to-ap-invoice|purchase-to-ap-invoice-step-05|발주확정|p5|(review)|legacyPhase|low confidence|
|purchase-to-ap-invoice|purchase-to-ap-invoice-step-06|입고요청|p6|procure-to-pay::p6|legacyPhase|legacy phase but not high confidence|
|purchase-to-ap-invoice|purchase-to-ap-invoice-step-07|이지어드민 입고 정보|p7|(review)|legacyPhase|low confidence|
|purchase-to-ap-invoice|purchase-to-ap-invoice-step-08|입고 처리|p8|procure-to-pay::p7|legacyPhase|legacy phase but not high confidence|
|purchase-to-ap-invoice|purchase-to-ap-invoice-step-09|입고 요청 확인|p9|procure-to-pay::p6|legacyPhase|legacy phase but not high confidence|
|purchase-to-ap-invoice|purchase-to-ap-invoice-step-10|입고 수량 입력|p10|procure-to-pay::p7|legacyPhase|legacy phase but not high confidence|
|purchase-to-ap-invoice|purchase-to-ap-invoice-step-11|입고확정|p11|procure-to-pay::p8|legacyPhase|legacy phase but not high confidence|
|purchase-to-ap-invoice|purchase-to-ap-invoice-step-12|ERP 재고|p12|procure-to-pay::p9|legacyPhase|legacy phase but not high confidence|
|purchase-to-ap-invoice|purchase-to-ap-invoice-step-15|전표생성(미결)|p15|procure-to-pay::p11|legacyPhase|held by review-name policy|
|purchase-to-ap-invoice|purchase-to-ap-invoice-step-16|위탁여부 확인|p16|cross-process::consignment-check|legacyPhase|held by review-name policy|
|purchase-to-ap-invoice|purchase-to-ap-invoice-step-17|위탁재고 현황|p17|procure-to-pay::p9|legacyPhase|legacy phase but not high confidence|
|b2c-return|b2c-return-step-01|B2C(온라인커머스) 반품요청|p1|overview::return|legacyPhase|legacy phase but not high confidence|
|b2c-return|b2c-return-step-02|이지어드민 주문수집|p2|overview::return|legacyPhase|legacy phase but not high confidence|
|b2c-return|b2c-return-step-03|B2C 반품 입고확인|p3|procure-to-pay::p7|legacyPhase|legacy phase but not high confidence|
|b2c-return|b2c-return-step-04|반품입고 수량 입력|p4|procure-to-pay::p7|legacyPhase|legacy phase but not high confidence|
|b2c-return|b2c-return-step-05|위탁 여부 확인|p5|overview::return|legacyPhase|held by review-name policy|
|b2c-return|b2c-return-step-06|위탁재고 현황|p6|procure-to-pay::p9|legacyPhase|legacy phase but not high confidence|
|b2c-return|b2c-return-step-07|반품주문등록|p7|overview::return|legacyPhase|legacy phase but not high confidence|
|b2c-return|b2c-return-step-08|반품주문확정|p8|overview::return|legacyPhase|legacy phase but not high confidence|
|b2c-return|b2c-return-step-09|출고반품요청|p9|overview::return|legacyPhase|legacy phase but not high confidence|
|b2c-return|b2c-return-step-10|반품확정|p10|procure-to-pay::p8|legacyPhase|legacy phase but not high confidence|
|b2c-return|b2c-return-step-11|입고정보|p11|overview::return|legacyPhase|legacy phase but not high confidence|
|b2c-return|b2c-return-step-12|일괄매출마감등록|p12|overview::return|legacyPhase|legacy phase but not high confidence|
|b2c-return|b2c-return-step-13|매출마감확정|p13|overview::return|legacyPhase|legacy phase but not high confidence|
|b2c-return|b2c-return-step-14|전표생성(미결)|p14|overview::return|legacyPhase|held by review-name policy|
|event-sales|event-sales-step-01|B2C(온라인커머스) 주문 |p1|order-to-cash::p1|legacyPhase|legacy phase but not high confidence|
|event-sales|event-sales-step-04|이벤트/당첨자 주문 집계|p4|(review)|legacyPhase|low confidence|
|event-sales|event-sales-step-05|수령방식 구분|p5|(review)|legacyPhase|low confidence|
|event-sales|event-sales-step-06|현장수령 주문 분리|p6|(review)|legacyPhase|low confidence|
|event-sales|event-sales-step-08|현장출고/수령 수량 입력|p8|order-to-cash::p4|legacyPhase|legacy phase but not high confidence|
|event-sales|event-sales-step-09|재고이동 요청 확인|p9|overview::warehouse-transfer|legacyPhase|legacy phase but not high confidence|
|event-sales|event-sales-step-10|현장 수령 확인|p10|(review)|legacyPhase|low confidence|
|event-sales|event-sales-step-11|이동 수량 입력|p11|order-to-cash::p4|legacyPhase|legacy phase but not high confidence|
|event-sales|event-sales-step-12|택배발송 주문 분리|p12|(review)|legacyPhase|low confidence|
|event-sales|event-sales-step-14|B2C 출고 확인|p14|order-to-cash::p4|legacyPhase|legacy phase but not high confidence|
|event-sales|event-sales-step-15|출고 수량 입력|p15|order-to-cash::p4|legacyPhase|legacy phase but not high confidence|
|event-sales|event-sales-step-18|매출전표 생성(미결)|p18|order-to-cash::p8|legacyPhase|held by review-name policy|
|event-sales|node-mqt5setn-45qko|재고이동 요청|business-to-project::p1|overview::warehouse-transfer|wrongProcessPrefix|wrongProcessPrefix|
|event-sales|node-mqt61mig-33h91|재고이동 처리|business-to-project::p1|overview::warehouse-transfer|wrongProcessPrefix|wrongProcessPrefix|
|event-sales|node-mqt86zc3-pp7e2|재고이동요청확정|business-to-project::p1|overview::warehouse-transfer|wrongProcessPrefix|wrongProcessPrefix|
|event-sales|node-mqt8fajx-617ov|출고정보|business-to-project::p1|order-to-cash::p3i|wrongProcessPrefix|held by review-name policy|
|event-sales|node-mqt8il5o-7w3qs|위탁 여부 확인|business-to-project::p1|cross-process::consignment-check|wrongProcessPrefix|held by review-name policy|
|event-sales|node-mqt8tojd-tkhnh|주문등록|business-to-project::p1|overview::order-register|wrongProcessPrefix|wrongProcessPrefix|
|event-sales|node-mqt8tw20-bll6c|주문확정|business-to-project::p1|order-to-cash::p2a|wrongProcessPrefix|wrongProcessPrefix|
|event-sales|node-mqt8u2tm-t12zw|츌고요청|business-to-project::p1|(review)|ambiguous|low confidence|
|event-sales|node-mqt8uaja-coxvp|출고확정|business-to-project::p1|order-to-cash::p5|wrongProcessPrefix|wrongProcessPrefix|
|event-sales|node-mqt8xa6y-k1oim|위탁재고 현황|business-to-project::p1|procure-to-pay::p9|wrongProcessPrefix|wrongProcessPrefix|
|event-sales|node-mqt93pw2-ftuss|출고정보|business-to-project::p1|order-to-cash::p3i|wrongProcessPrefix|held by review-name policy|
|event-sales|node-mqt9snvb-mk26h|위탁 여부 확인|business-to-project::p1|cross-process::consignment-check|wrongProcessPrefix|held by review-name policy|
|event-sales|node-mqufvrbc-1fc8p|재고이동 확정|business-to-project::p1|overview::warehouse-transfer|wrongProcessPrefix|wrongProcessPrefix|
|event-sales|node-mqufwmtj-p7pr2|입/출고 정보|business-to-project::p1|order-to-cash::p3i|wrongProcessPrefix|held by review-name policy|
|event-sales|node-mqufxy6i-2vh9p|위탁재고 현황|business-to-project::p1|procure-to-pay::p9|wrongProcessPrefix|wrongProcessPrefix|
|store-sales|store-sales-step-01|매장 판매|p1|order-to-cash::p1|legacyPhase|legacy phase but not high confidence|
|store-sales|store-sales-step-03|주문등록|p3|overview::order-register|legacyPhase|legacy phase but not high confidence|
|store-sales|store-sales-step-04|주문확정|p4|order-to-cash::p2a|legacyPhase|legacy phase but not high confidence|
|store-sales|store-sales-step-05|이지어드민 연동현황|p5|(review)|legacyPhase|low confidence|
|store-sales|store-sales-step-06|출고요청|p6|order-to-cash::p3|legacyPhase|legacy phase but not high confidence|
|store-sales|store-sales-step-07|출고확정|p7|order-to-cash::p5|legacyPhase|legacy phase but not high confidence|
|store-sales|store-sales-step-08|위탁 여부 확인|p8|cross-process::consignment-check|legacyPhase|held by review-name policy|
|store-sales|store-sales-step-09|출고정보|p9|order-to-cash::p3i|legacyPhase|held by review-name policy|
|store-sales|store-sales-step-12|전표생성(미결)|p12|finance::pending-voucher|legacyPhase|held by review-name policy|
|store-sales|node-mqt0pojw-g74j0|전표생성(미결)|business-to-project::p1|finance::pending-voucher|wrongProcessPrefix|held by review-name policy|
|revenue-share-settlement|revenue-share-settlement-step-01|매출/비용 집계|p1|overview::royalty-mg|legacyPhase|low confidence|
|revenue-share-settlement|revenue-share-settlement-step-02|매출/비용 확정|p2|overview::royalty-mg|legacyPhase|low confidence|
|revenue-share-settlement|revenue-share-settlement-step-03|예외사항처리|p3|cross-process::exception-handling|legacyPhase|held by review-name policy|
|revenue-share-settlement|revenue-share-settlement-step-04|MG차감여부|p4|overview::royalty-mg|legacyPhase|legacy phase but not high confidence|
|revenue-share-settlement|revenue-share-settlement-step-05|MG상계입력|p5|overview::royalty-mg|legacyPhase|legacy phase but not high confidence|
|revenue-share-settlement|revenue-share-settlement-step-06|MG상계처리|p6|overview::royalty-mg|legacyPhase|legacy phase but not high confidence|
|revenue-share-settlement|revenue-share-settlement-step-07|정산마감등록|p7|overview::royalty-mg|legacyPhase|low confidence|
|revenue-share-settlement|revenue-share-settlement-step-08|정산마감확정|p8|overview::royalty-mg|legacyPhase|low confidence|
|revenue-share-settlement|revenue-share-settlement-step-09|전표생성(미결)|p9|finance::pending-voucher|legacyPhase|held by review-name policy|
|service-business-to-expense|service-business-to-expense-step-09|프로젝트 지출결의|p9|(review)|legacyPhase|low confidence|
|service-business-to-expense|service-business-to-expense-step-10|전표생성(미결)|p10|finance::pending-voucher|legacyPhase|held by review-name policy|
|service-business-to-expense|node-mqq820jo-8934n|상품등록 Process|business-to-project::p1|(review)|ambiguous|low confidence|
|service-business-to-expense|node-mqq83zuq-exc6t|품목등록 Process|business-to-project::p1|(review)|ambiguous|low confidence|
|service-purchase-to-ap|service-purchase-to-ap-step-05|발주확정|p5|(review)|legacyPhase|low confidence|
|service-purchase-to-ap|service-purchase-to-ap-step-06|입고요청|p6|procure-to-pay::p6|legacyPhase|legacy phase but not high confidence|
|service-purchase-to-ap|service-purchase-to-ap-step-07|입고확정|p7|procure-to-pay::p8|legacyPhase|legacy phase but not high confidence|
|service-purchase-to-ap|service-purchase-to-ap-step-10|전표생성(미결)|p10|procure-to-pay::p11|legacyPhase|held by review-name policy|
|service-order-to-sales|service-order-to-sales-step-01|주문일괄등록|p1|order-to-cash::p1|legacyPhase|legacy phase but not high confidence|
|service-order-to-sales|service-order-to-sales-step-02|주문확정|p2|order-to-cash::p2a|legacyPhase|legacy phase but not high confidence|
|service-order-to-sales|service-order-to-sales-step-03|출고요청|p3|order-to-cash::p3|legacyPhase|legacy phase but not high confidence|
|service-order-to-sales|service-order-to-sales-step-04|출고확정|p4|order-to-cash::p5|legacyPhase|legacy phase but not high confidence|
|service-project-settlement|service-project-settlement-step-01|매출/비용 마감집계|p1|overview::royalty-mg|legacyPhase|low confidence|
|service-project-settlement|service-project-settlement-step-02|매출/비용 마감확정|p2|overview::royalty-mg|legacyPhase|low confidence|
|service-project-settlement|service-project-settlement-step-03|예외사항처리|p3|cross-process::exception-handling|legacyPhase|held by review-name policy|
|service-project-settlement|service-project-settlement-step-04|MG차감여부|p4|overview::royalty-mg|legacyPhase|legacy phase but not high confidence|
|service-project-settlement|service-project-settlement-step-05|MG상계입력|p5|overview::royalty-mg|legacyPhase|legacy phase but not high confidence|
|service-project-settlement|service-project-settlement-step-06|MG상계처리|p6|overview::royalty-mg|legacyPhase|legacy phase but not high confidence|
|service-project-settlement|service-project-settlement-step-07|정산마감등록|p7|overview::royalty-mg|legacyPhase|low confidence|
|service-project-settlement|service-project-settlement-step-08|정산마감확정|p8|overview::royalty-mg|legacyPhase|low confidence|
|service-project-settlement|service-project-settlement-step-09|전표생성(미결)|p9|finance::pending-voucher|legacyPhase|held by review-name policy|
