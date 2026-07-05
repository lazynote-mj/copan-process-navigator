# Legacy Phase Mapping Table

processId + legacy phaseId + nodeName 기준 mapping 후보입니다. Phase 5.5에서는 high confidence 항목만 phaseId를 migration했고, phaseOrder는 layout 보존을 위해 변경하지 않았습니다.

|processId|legacyPhaseId|nodeId|nodeName|phaseOrder|recommendedStageId|recommendedStageLabel|confidence|issueType|decision|
|---|---|---|---|---|---|---|---|---|---|
|business-to-project|p1|opportunity|사업기회확보|1|business-to-project::p1|사업기회|high|legacyPhase|migratedPhaseIdOnly|
|business-to-project|p2|business-review|사업참여검토|2|business-to-project::p2|사업검토|high|legacyPhase|migratedPhaseIdOnly|
|business-to-project|p3|contract-register|계약등록|3|business-to-project::p3|계약등록|high|legacyPhase|migratedPhaseIdOnly|
|business-to-project|p4|contract-approval|사업계약품의|4|business-to-project::p4|계약품의|high|legacyPhase|migratedPhaseIdOnly|
|business-to-project|p5|project-register|프로젝트등록|5|business-to-project::p5|프로젝트등록|high|legacyPhase|migratedPhaseIdOnly|
|business-to-project|p6|project-approval|사업실행품의|6|business-to-project::p6|실행품의|high|legacyPhase|migratedPhaseIdOnly|
|business-to-project|p7|purchase-request|구매요청|7|procure-to-pay::p1|구매요청|high|legacyPhase|migratedPhaseIdOnly|
|business-to-project|p8|product-check|품목확인|8|procure-to-pay::p2|품목확인|high|legacyPhase|migratedPhaseIdOnly|
|business-to-project|p8|vendor-check|거래처확인|8|procure-to-pay::p2b|거래처확인|high|legacyPhase|migratedPhaseIdOnly|
|business-to-project|p8|product-register-request|품목등록요청|8|procure-to-pay::p3|품목등록요청|high|legacyPhase|migratedPhaseIdOnly|
|business-to-project|p8|product-register-approval|품목등록승인|8|procure-to-pay::p3a|품목등록승인|high|legacyPhase|migratedPhaseIdOnly|
|business-to-project|p8|vendor-register|거래처등록요청|8|procure-to-pay::p3b|거래처등록요청|high|legacyPhase|migratedPhaseIdOnly|
|business-to-project|p8|vendor-register-approval|거래처등록승인|8|procure-to-pay::p3c|거래처등록승인|high|legacyPhase|migratedPhaseIdOnly|
|business-to-project|p8|po-approval|발주품의|8|procure-to-pay::p4|발주품의|high|legacyPhase|migratedPhaseIdOnly|
|business-to-project|p8|purchase-order|계약/발주등록|8|procure-to-pay::p5|발주등록|high|legacyPhase|migratedPhaseIdOnly|
|business-to-project|p9|inbound-info|입고정보전달|9|(review)|(review)|low|legacyPhase|review|
|business-to-project|p9|inbound-check|입고확인|9|procure-to-pay::p7|입고확인|medium|legacyPhase|review|
|business-to-project|p9|inbound-confirm|입고확정|9|procure-to-pay::p8|입고확정|medium|legacyPhase|review|
|business-to-project|p9|stock-plus|재고인식(+)|9|procure-to-pay::p9|재고인식|medium|legacyPhase|review|
|business-to-project|p10|ap-close|매입마감확정|10|procure-to-pay::p10|매입마감|high|legacyPhase|migratedPhaseIdOnly|
|business-to-project|p10|fi-posting|매입전표 반영|10|procure-to-pay::p11|매입전표|high|legacyPhase|migratedPhaseIdOnly|
|consignment-purchase-receipt|p1|consignment-purchase-receipt-step-01|구매요청|1|procure-to-pay::p1|구매요청|high|legacyPhase|migratedPhaseIdOnly|
|consignment-purchase-receipt|p2|consignment-purchase-receipt-step-02|구매요청확정|2|procure-to-pay::p1|구매요청|high|legacyPhase|migratedPhaseIdOnly|
|consignment-purchase-receipt|p3|consignment-purchase-receipt-step-03|발주등록|3|procure-to-pay::p5|발주등록|high|legacyPhase|migratedPhaseIdOnly|
|consignment-purchase-receipt|p4|consignment-purchase-receipt-step-04|발주확정|4|(review)|(review)|low|legacyPhase|review|
|consignment-purchase-receipt|p5|consignment-purchase-receipt-step-05|입고요청|5|procure-to-pay::p6|입고정보|medium|legacyPhase|review|
|consignment-purchase-receipt|p6|consignment-purchase-receipt-step-06|이지어드민 입고 정보|6|(review)|(review)|low|legacyPhase|review|
|consignment-purchase-receipt|p7|consignment-purchase-receipt-step-07|입고 처리|7|procure-to-pay::p7|입고확인|medium|legacyPhase|review|
|consignment-purchase-receipt|p8|consignment-purchase-receipt-step-08|입고 요청 확인|8|procure-to-pay::p6|입고정보|medium|legacyPhase|review|
|consignment-purchase-receipt|p9|consignment-purchase-receipt-step-09|입고 수량 입력|9|procure-to-pay::p7|입고확인|medium|legacyPhase|review|
|consignment-purchase-receipt|p10|consignment-purchase-receipt-step-10|위탁재고 현황|10|procure-to-pay::p9|재고인식|medium|legacyPhase|review|
|b2b-domestic-order-to-sales|p1|b2b-domestic-order-to-sales-step-01|주문등록|1|overview::order-register|주문등록|medium|legacyPhase|review|
|b2b-domestic-order-to-sales|p2|b2b-domestic-order-to-sales-step-02|주문확정|2|order-to-cash::p2a|주문확정|medium|legacyPhase|review|
|b2b-domestic-order-to-sales|p3|b2b-domestic-order-to-sales-step-03|출고요청|3|order-to-cash::p3|출고요청|medium|legacyPhase|review|
|b2b-domestic-order-to-sales|p4|b2b-domestic-order-to-sales-step-04|위탁 여부 확인|4|cross-process::consignment-check|위탁여부 확인|low|legacyPhase|review|
|b2b-domestic-order-to-sales|p5|b2b-domestic-order-to-sales-step-05|위탁재고 현황|5|procure-to-pay::p9|재고인식|medium|legacyPhase|review|
|b2b-domestic-order-to-sales|p6|b2b-domestic-order-to-sales-step-06|출고정보|6|order-to-cash::p3i|출고정보|low|legacyPhase|review|
|b2b-domestic-order-to-sales|p7|b2b-domestic-order-to-sales-step-07|출고 요청 확인|7|order-to-cash::p3|출고요청|medium|legacyPhase|review|
|b2b-domestic-order-to-sales|p8|b2b-domestic-order-to-sales-step-08|B2B 출고 처리|8|order-to-cash::p4|출고확인|medium|legacyPhase|review|
|b2b-domestic-order-to-sales|p9|b2b-domestic-order-to-sales-step-09|출고 수량 입력|9|order-to-cash::p4|출고확인|medium|legacyPhase|review|
|b2b-domestic-order-to-sales|p10|b2b-domestic-order-to-sales-step-10|출고확정|10|order-to-cash::p5|출고확정|medium|legacyPhase|review|
|b2b-domestic-order-to-sales|p11|b2b-domestic-order-to-sales-step-11|일괄매출마감등록|11|order-to-cash::p7|매출마감|high|legacyPhase|migratedPhaseIdOnly|
|b2b-domestic-order-to-sales|p12|b2b-domestic-order-to-sales-step-12|매출마감확정|12|order-to-cash::p7|매출마감|high|legacyPhase|migratedPhaseIdOnly|
|b2b-domestic-order-to-sales|p13|b2b-domestic-order-to-sales-step-13|전표생성(미결)|13|finance::pending-voucher|전표생성(미결)|low|legacyPhase|review|
|b2b-domestic-return|p1|b2b-domestic-return-step-01|반품주문등록|1|overview::return|반품|medium|legacyPhase|review|
|b2b-domestic-return|p2|b2b-domestic-return-step-02|반품주문확정|2|overview::return|반품|medium|legacyPhase|review|
|b2b-domestic-return|p3|b2b-domestic-return-step-03|출고반품요청|3|overview::return|반품|medium|legacyPhase|review|
|b2b-domestic-return|p4|b2b-domestic-return-step-04|위탁 여부 확인|4|overview::return|반품|medium|legacyPhase|review|
|b2b-domestic-return|p5|b2b-domestic-return-step-05|위탁재고 현황|5|procure-to-pay::p9|재고인식|medium|legacyPhase|review|
|b2b-domestic-return|p6|b2b-domestic-return-step-06|입고정보|6|overview::return|반품|medium|legacyPhase|review|
|b2b-domestic-return|p7|b2b-domestic-return-step-07|입고 요청 확인|7|procure-to-pay::p6|입고정보|medium|legacyPhase|review|
|b2b-domestic-return|p8|b2b-domestic-return-step-08|B2B반품입고 처리|8|procure-to-pay::p7|입고확인|medium|legacyPhase|review|
|b2b-domestic-return|p9|b2b-domestic-return-step-09|입고 수량 입력|9|procure-to-pay::p7|입고확인|medium|legacyPhase|review|
|b2b-domestic-return|p10|b2b-domestic-return-step-10|반품확정|10|procure-to-pay::p8|입고확정|medium|legacyPhase|review|
|b2b-domestic-return|p11|b2b-domestic-return-step-11|일괄매출마감등록|11|overview::return|반품|medium|legacyPhase|review|
|b2b-domestic-return|p12|b2b-domestic-return-step-12|매출마감확정|12|overview::return|반품|medium|legacyPhase|review|
|b2b-domestic-return|p13|b2b-domestic-return-step-13|전표생성(미결)|13|overview::return|반품|medium|legacyPhase|review|
|b2b-export-order-to-sales|p1|b2b-export-order-to-sales-step-01|주문입력|1|order-to-cash::p1|온라인주문|medium|legacyPhase|review|
|b2b-export-order-to-sales|p2|b2b-export-order-to-sales-step-02|출고정보|2|order-to-cash::p3i|출고정보|low|legacyPhase|review|
|b2b-export-order-to-sales|p3|b2b-export-order-to-sales-step-03|주문처리|3|(review)|(review)|low|legacyPhase|review|
|b2b-export-order-to-sales|p4|b2b-export-order-to-sales-step-04|수출이동지시|4|order-to-cash::p3|출고요청|medium|legacyPhase|review|
|b2b-export-order-to-sales|p5|b2b-export-order-to-sales-step-05|출고 요청 확인|5|order-to-cash::p3|출고요청|medium|legacyPhase|review|
|b2b-export-order-to-sales|p6|b2b-export-order-to-sales-step-06|B2B 출고 처리|6|order-to-cash::p4|출고확인|medium|legacyPhase|review|
|b2b-export-order-to-sales|p7|b2b-export-order-to-sales-step-07|출고 수량 입력|7|order-to-cash::p4|출고확인|medium|legacyPhase|review|
|b2b-export-order-to-sales|p8|b2b-export-order-to-sales-step-08|출고처리(창고이동)|8|overview::warehouse-transfer|창고이동|medium|legacyPhase|review|
|b2b-export-order-to-sales|p9|b2b-export-order-to-sales-step-09|자동 입/출고정보|9|order-to-cash::p3i|출고정보|low|legacyPhase|review|
|b2b-export-order-to-sales|p10|b2b-export-order-to-sales-step-10|수출출고지시|10|order-to-cash::p3|출고요청|medium|legacyPhase|review|
|b2b-export-order-to-sales|p11|b2b-export-order-to-sales-step-11|B/L 기준 출고|11|(review)|(review)|low|legacyPhase|review|
|b2b-export-order-to-sales|p12|b2b-export-order-to-sales-step-12|일괄매출등록|12|(review)|(review)|low|legacyPhase|review|
|b2b-export-order-to-sales|p13|b2b-export-order-to-sales-step-13|매출전기처리|13|order-to-cash::p7|매출마감|high|legacyPhase|migratedPhaseIdOnly|
|b2b-export-order-to-sales|p14|b2b-export-order-to-sales-step-14|전표조회승인|14|order-to-cash::p8|매출전표|medium|legacyPhase|review|
|b2c-order-to-sales|p1|b2c-order-to-sales-step-01|B2C(온라인커머스) 주문|1|order-to-cash::p1|온라인주문|medium|legacyPhase|review|
|b2c-order-to-sales|p2|b2c-order-to-sales-step-02|이지어드민 주문수집|2|order-to-cash::p2|주문연동|high|legacyPhase|migratedPhaseIdOnly|
|b2c-order-to-sales|p3|b2c-order-to-sales-step-03|B2C 출고 확인|3|order-to-cash::p4|출고확인|medium|legacyPhase|review|
|b2c-order-to-sales|p4|b2c-order-to-sales-step-04|출고 수량 입력|4|order-to-cash::p4|출고확인|medium|legacyPhase|review|
|b2c-order-to-sales|p5|b2c-order-to-sales-step-05|위탁 여부 확인|5|cross-process::consignment-check|위탁여부 확인|low|legacyPhase|review|
|b2c-order-to-sales|p6|b2c-order-to-sales-step-06|위탁재고 현황|6|procure-to-pay::p9|재고인식|medium|legacyPhase|review|
|b2c-order-to-sales|p7|b2c-order-to-sales-step-07|주문등록|7|overview::order-register|주문등록|medium|legacyPhase|review|
|b2c-order-to-sales|p8|b2c-order-to-sales-step-08|주문확정|8|order-to-cash::p2a|주문확정|medium|legacyPhase|review|
|b2c-order-to-sales|p9|b2c-order-to-sales-step-09|출고요청|9|order-to-cash::p3|출고요청|medium|legacyPhase|review|
|b2c-order-to-sales|p10|b2c-order-to-sales-step-10|출고확정|10|order-to-cash::p5|출고확정|medium|legacyPhase|review|
|b2c-order-to-sales|p11|b2c-order-to-sales-step-11|출고정보|11|order-to-cash::p3i|출고정보|low|legacyPhase|review|
|b2c-order-to-sales|p12|b2c-order-to-sales-step-12|일괄매출마감등록|12|order-to-cash::p7|매출마감|high|legacyPhase|migratedPhaseIdOnly|
|b2c-order-to-sales|p13|b2c-order-to-sales-step-13|매출마감확정|13|order-to-cash::p7|매출마감|high|legacyPhase|migratedPhaseIdOnly|
|b2c-order-to-sales|p14|b2c-order-to-sales-step-14|전표생성(미결)|14|finance::pending-voucher|전표생성(미결)|low|legacyPhase|review|
|preorder-to-sales|p1|preorder-to-sales-step-01|B2C(온라인커머스) 예약 판매|1|order-to-cash::p1|온라인주문|medium|legacyPhase|review|
|preorder-to-sales|p2|preorder-to-sales-step-02|PG사 정산|2|(review)|(review)|low|legacyPhase|review|
|preorder-to-sales|p3|preorder-to-sales-step-03|이지어드민 주문수집|3|order-to-cash::p2|주문연동|high|legacyPhase|migratedPhaseIdOnly|
|preorder-to-sales|p4|preorder-to-sales-step-04|B2C 출고 확인|4|order-to-cash::p4|출고확인|medium|legacyPhase|review|
|preorder-to-sales|p5|preorder-to-sales-step-05|출고 수량 입력|5|order-to-cash::p4|출고확인|medium|legacyPhase|review|
|preorder-to-sales|p6|preorder-to-sales-step-06|위탁 여부 확인|6|cross-process::consignment-check|위탁여부 확인|low|legacyPhase|review|
|preorder-to-sales|p7|preorder-to-sales-step-07|위탁재고 현황|7|procure-to-pay::p9|재고인식|medium|legacyPhase|review|
|preorder-to-sales|p8|preorder-to-sales-step-08|주문등록|8|overview::order-register|주문등록|medium|legacyPhase|review|
|preorder-to-sales|p9|preorder-to-sales-step-09|주문확정|9|order-to-cash::p2a|주문확정|medium|legacyPhase|review|
|preorder-to-sales|p10|preorder-to-sales-step-10|출고요청|10|order-to-cash::p3|출고요청|medium|legacyPhase|review|
|preorder-to-sales|p11|preorder-to-sales-step-11|출고확정|11|order-to-cash::p5|출고확정|medium|legacyPhase|review|
|preorder-to-sales|p12|preorder-to-sales-step-12|출고정보|12|order-to-cash::p3i|출고정보|low|legacyPhase|review|
|preorder-to-sales|p13|preorder-to-sales-step-13|일괄매출마감등록|13|order-to-cash::p7|매출마감|high|legacyPhase|migratedPhaseIdOnly|
|preorder-to-sales|p14|preorder-to-sales-step-14|매출마감확정|14|order-to-cash::p7|매출마감|high|legacyPhase|migratedPhaseIdOnly|
|preorder-to-sales|p15|preorder-to-sales-step-15|전표생성(미결)|15|finance::pending-voucher|전표생성(미결)|low|legacyPhase|review|
|preorder-to-sales|p16|preorder-to-sales-step-16|선수금 처리|16|overview::fund|자금|medium|legacyPhase|review|
|preorder-to-sales|p17|preorder-to-sales-step-17|선수금 반제처리|17|overview::fund|자금|medium|legacyPhase|review|
|stock-transfer|p1|stock-transfer-step-01|재고이동요청|1|overview::warehouse-transfer|창고이동|medium|legacyPhase|review|
|stock-transfer|p2|stock-transfer-step-02|매장 재고이동 처리|2|overview::warehouse-transfer|창고이동|medium|legacyPhase|review|
|stock-transfer|p3|stock-transfer-step-03|재고이동확정|3|overview::warehouse-transfer|창고이동|medium|legacyPhase|review|
|stock-transfer|p4|stock-transfer-step-04|위탁 여부 확인|4|overview::warehouse-transfer|창고이동|medium|legacyPhase|review|
|stock-transfer|p5|stock-transfer-step-05|위탁재고 현황|5|procure-to-pay::p9|재고인식|medium|legacyPhase|review|
|stock-transfer|p6|stock-transfer-step-06|입/출고정보|6|overview::warehouse-transfer|창고이동|medium|legacyPhase|review|
|stock-transfer|p7|stock-transfer-step-07|매장재고이동입력|7|overview::warehouse-transfer|창고이동|medium|legacyPhase|review|
|stock-transfer|p8|stock-transfer-step-08|매장재고이동현황|8|overview::warehouse-transfer|창고이동|medium|legacyPhase|review|
|other-issue|p1|other-issue-step-01|출고요청|1|overview::other-outbound|기타출고|medium|legacyPhase|review|
|other-issue|p2|other-issue-step-02|무상 증정품 사용품의|2|overview::other-outbound|기타출고|medium|legacyPhase|review|
|other-issue|p3|other-issue-step-03|출고확정|3|overview::other-outbound|기타출고|medium|legacyPhase|review|
|other-issue|p4|other-issue-step-04|위탁 여부 확인|4|overview::other-outbound|기타출고|medium|legacyPhase|review|
|other-issue|p5|other-issue-step-05|출고 요청 확인|5|overview::other-outbound|기타출고|medium|legacyPhase|review|
|other-issue|p6|other-issue-step-06|출고 처리|6|overview::other-outbound|기타출고|medium|legacyPhase|review|
|other-issue|p7|other-issue-step-07|출고 수량 입력|7|overview::other-outbound|기타출고|medium|legacyPhase|review|
|other-issue|p8|other-issue-step-08|이지어드민 연동현황|8|overview::other-outbound|기타출고|medium|legacyPhase|review|
|other-issue|p9|other-issue-step-09|기타출고확정|9|overview::other-outbound|기타출고|medium|legacyPhase|review|
|other-issue|p10|other-issue-step-10|출고정보|10|overview::other-outbound|기타출고|medium|legacyPhase|review|
|consignment-settlement|p1|consignment-settlement-step-01|위탁매출마감집계|1|overview::consignment|위탁정산|medium|legacyPhase|review|
|consignment-settlement|p2|consignment-settlement-step-02|위탁매출마감확정|2|overview::consignment|위탁정산|medium|legacyPhase|review|
|consignment-settlement|p3|consignment-settlement-step-03|예외사항처리|3|overview::consignment|위탁정산|medium|legacyPhase|review|
|consignment-settlement|p4|consignment-settlement-step-04|정산마감등록|4|overview::consignment|위탁정산|medium|legacyPhase|review|
|consignment-settlement|p5|consignment-settlement-step-05|정산마감확정|5|overview::consignment|위탁정산|medium|legacyPhase|review|
|consignment-settlement|p6|consignment-settlement-step-06|전표생성(미결)|6|overview::consignment|위탁정산|medium|legacyPhase|review|
|royalty-mg-settlement|p1|royalty-mg-settlement-step-01|로열티매출마감집계|1|overview::royalty-mg|로열티/MG정산|medium|legacyPhase|review|
|royalty-mg-settlement|p2|royalty-mg-settlement-step-02|로열티매출마감확정|2|overview::royalty-mg|로열티/MG정산|medium|legacyPhase|review|
|royalty-mg-settlement|p3|royalty-mg-settlement-step-03|예외사항처리|3|overview::royalty-mg|로열티/MG정산|medium|legacyPhase|review|
|royalty-mg-settlement|p4|royalty-mg-settlement-step-04|MG차감 여부|4|overview::royalty-mg|로열티/MG정산|medium|legacyPhase|review|
|royalty-mg-settlement|p5|royalty-mg-settlement-step-05|MG상계입력|5|overview::royalty-mg|로열티/MG정산|medium|legacyPhase|review|
|royalty-mg-settlement|p6|royalty-mg-settlement-step-06|MG상계처리|6|overview::royalty-mg|로열티/MG정산|medium|legacyPhase|review|
|royalty-mg-settlement|p7|royalty-mg-settlement-step-07|정산마감등록|7|overview::royalty-mg|로열티/MG정산|medium|legacyPhase|review|
|royalty-mg-settlement|p8|royalty-mg-settlement-step-08|정산마감확정|8|overview::royalty-mg|로열티/MG정산|medium|legacyPhase|review|
|royalty-mg-settlement|p9|royalty-mg-settlement-step-09|전표생성(미결)|9|overview::royalty-mg|로열티/MG정산|medium|legacyPhase|review|
|popup-concert-stock-sales-sync|p1|popup-concert-stock-sales-sync-step-01|공연장 출고 재고이동요청|1|overview::warehouse-transfer|창고이동|medium|legacyPhase|review|
|popup-concert-stock-sales-sync|p2|popup-concert-stock-sales-sync-step-02|공연장 출고 재고이동요청확정|2|overview::warehouse-transfer|창고이동|medium|legacyPhase|review|
|popup-concert-stock-sales-sync|p3|popup-concert-stock-sales-sync-step-03|출고정보|3|order-to-cash::p3i|출고정보|low|legacyPhase|review|
|popup-concert-stock-sales-sync|p4|popup-concert-stock-sales-sync-step-04|재고이동확정|4|overview::warehouse-transfer|창고이동|medium|legacyPhase|review|
|popup-concert-stock-sales-sync|p5|popup-concert-stock-sales-sync-step-05|위탁 여부|5|cross-process::consignment-check|위탁여부 확인|low|legacyPhase|review|
|popup-concert-stock-sales-sync|p6|popup-concert-stock-sales-sync-step-06|위탁재고 현황|6|procure-to-pay::p9|재고인식|medium|legacyPhase|review|
|popup-concert-stock-sales-sync|p7|popup-concert-stock-sales-sync-step-07|이동 수량 입력|7|order-to-cash::p4|출고확인|medium|legacyPhase|review|
|popup-concert-stock-sales-sync|p8|popup-concert-stock-sales-sync-step-08|물류센터 출고|8|order-to-cash::p4|출고확인|medium|legacyPhase|review|
|popup-concert-stock-sales-sync|p9|popup-concert-stock-sales-sync-step-09|주문 입력(이지체인/POS)|9|order-to-cash::p1|온라인주문|medium|legacyPhase|review|
|popup-concert-stock-sales-sync|p10|popup-concert-stock-sales-sync-step-10|위탁 여부|10|cross-process::consignment-check|위탁여부 확인|low|legacyPhase|review|
|popup-concert-stock-sales-sync|p11|popup-concert-stock-sales-sync-step-11|주문확정|11|order-to-cash::p2a|주문확정|medium|legacyPhase|review|
|popup-concert-stock-sales-sync|p12|popup-concert-stock-sales-sync-step-12|출고요청|12|order-to-cash::p3|출고요청|medium|legacyPhase|review|
|popup-concert-stock-sales-sync|p13|popup-concert-stock-sales-sync-step-13|출고확정|13|order-to-cash::p5|출고확정|medium|legacyPhase|review|
|popup-concert-stock-sales-sync|p14|popup-concert-stock-sales-sync-step-14|일괄매출마감등록|14|order-to-cash::p7|매출마감|high|legacyPhase|migratedPhaseIdOnly|
|popup-concert-stock-sales-sync|p15|popup-concert-stock-sales-sync-step-15|매출마감확정|15|order-to-cash::p7|매출마감|high|legacyPhase|migratedPhaseIdOnly|
|popup-concert-stock-sales-sync|p16|popup-concert-stock-sales-sync-step-16|잔여재고 이동요청|16|overview::warehouse-transfer|창고이동|medium|legacyPhase|review|
|popup-concert-stock-sales-sync|p17|popup-concert-stock-sales-sync-step-17|잔여재고 이동요청확정|17|overview::warehouse-transfer|창고이동|medium|legacyPhase|review|
|popup-concert-stock-sales-sync|p18|popup-concert-stock-sales-sync-step-18|잔여재고 입/출고정보|18|order-to-cash::p3i|출고정보|low|legacyPhase|review|
|popup-concert-stock-sales-sync|p19|popup-concert-stock-sales-sync-step-19|잔여재고 이동확정|19|overview::warehouse-transfer|창고이동|medium|legacyPhase|review|
|popup-concert-stock-sales-sync|p20|popup-concert-stock-sales-sync-step-20|위탁 여부|20|cross-process::consignment-check|위탁여부 확인|low|legacyPhase|review|
|popup-concert-stock-sales-sync|p21|popup-concert-stock-sales-sync-step-21|잔여 재고 위탁재고 현황|21|procure-to-pay::p9|재고인식|medium|legacyPhase|review|
|popup-concert-stock-sales-sync|p22|popup-concert-stock-sales-sync-step-22|출고 수량 입력|22|order-to-cash::p4|출고확인|medium|legacyPhase|review|
|popup-concert-stock-sales-sync|p23|popup-concert-stock-sales-sync-step-23|현장 출고|23|order-to-cash::p4|출고확인|medium|legacyPhase|review|
|business-to-purchase-request|p1|business-to-purchase-request-step-01|사업기회확보|1|business-to-project::p1|사업기회|high|legacyPhase|migratedPhaseIdOnly|
|business-to-purchase-request|p2|business-to-purchase-request-step-02|사업참여검토|2|business-to-project::p2|사업검토|high|legacyPhase|migratedPhaseIdOnly|
|business-to-purchase-request|p3|business-to-purchase-request-step-03|계약등록|3|business-to-project::p3|계약등록|high|legacyPhase|migratedPhaseIdOnly|
|business-to-purchase-request|p4|business-to-purchase-request-step-04|사업계약품의|4|business-to-project::p4|계약품의|high|legacyPhase|migratedPhaseIdOnly|
|business-to-purchase-request|p5|business-to-purchase-request-step-05|프로젝트실행품의입력|5|business-to-project::p6|실행품의|high|legacyPhase|migratedPhaseIdOnly|
|business-to-purchase-request|p6|business-to-purchase-request-step-06|프로젝트 실행품의|6|business-to-project::p6|실행품의|high|legacyPhase|migratedPhaseIdOnly|
|business-to-purchase-request|p7|business-to-purchase-request-step-07|프로젝트등록|7|business-to-project::p5|프로젝트등록|high|legacyPhase|migratedPhaseIdOnly|
|business-to-purchase-request|p8|business-to-purchase-request-step-08|WBS코드등록|8|business-to-project::p5|프로젝트등록|high|legacyPhase|migratedPhaseIdOnly|
|business-to-purchase-request|p9|business-to-purchase-request-step-09|상품 등록 PROCESS|9|(review)|(review)|low|legacyPhase|review|
|business-to-purchase-request|p10|business-to-purchase-request-step-10|구매요청|10|procure-to-pay::p1|구매요청|high|legacyPhase|migratedPhaseIdOnly|
|business-to-purchase-request|p11|business-to-purchase-request-step-11|거래처 등록 PROCESS|11|(review)|(review)|low|legacyPhase|review|
|purchase-to-ap-invoice|p1|purchase-to-ap-invoice-step-01|구매요청|1|procure-to-pay::p1|구매요청|high|legacyPhase|migratedPhaseIdOnly|
|purchase-to-ap-invoice|p2|purchase-to-ap-invoice-step-02|구매요청확정|2|procure-to-pay::p1|구매요청|high|legacyPhase|migratedPhaseIdOnly|
|purchase-to-ap-invoice|p3|purchase-to-ap-invoice-step-03|발주등록|3|procure-to-pay::p5|발주등록|high|legacyPhase|migratedPhaseIdOnly|
|purchase-to-ap-invoice|p4|purchase-to-ap-invoice-step-04|구매발주 품의|4|procure-to-pay::p4|발주품의|high|legacyPhase|migratedPhaseIdOnly|
|purchase-to-ap-invoice|p5|purchase-to-ap-invoice-step-05|발주확정|5|(review)|(review)|low|legacyPhase|review|
|purchase-to-ap-invoice|p6|purchase-to-ap-invoice-step-06|입고요청|6|procure-to-pay::p6|입고정보|medium|legacyPhase|review|
|purchase-to-ap-invoice|p7|purchase-to-ap-invoice-step-07|이지어드민 입고 정보|7|(review)|(review)|low|legacyPhase|review|
|purchase-to-ap-invoice|p8|purchase-to-ap-invoice-step-08|입고 처리|8|procure-to-pay::p7|입고확인|medium|legacyPhase|review|
|purchase-to-ap-invoice|p9|purchase-to-ap-invoice-step-09|입고 요청 확인|9|procure-to-pay::p6|입고정보|medium|legacyPhase|review|
|purchase-to-ap-invoice|p10|purchase-to-ap-invoice-step-10|입고 수량 입력|10|procure-to-pay::p7|입고확인|medium|legacyPhase|review|
|purchase-to-ap-invoice|p11|purchase-to-ap-invoice-step-11|입고확정|11|procure-to-pay::p8|입고확정|medium|legacyPhase|review|
|purchase-to-ap-invoice|p12|purchase-to-ap-invoice-step-12|ERP 재고|12|procure-to-pay::p9|재고인식|medium|legacyPhase|review|
|purchase-to-ap-invoice|p13|purchase-to-ap-invoice-step-13|매입마감조회|13|procure-to-pay::p10|매입마감|high|legacyPhase|migratedPhaseIdOnly|
|purchase-to-ap-invoice|p14|purchase-to-ap-invoice-step-14|매입마감확확정|14|procure-to-pay::p10|매입마감|high|legacyPhase|migratedPhaseIdOnly|
|purchase-to-ap-invoice|p15|purchase-to-ap-invoice-step-15|전표생성(미결)|15|procure-to-pay::p11|매입전표|high|legacyPhase|review|
|purchase-to-ap-invoice|p16|purchase-to-ap-invoice-step-16|위탁여부 확인|16|cross-process::consignment-check|위탁여부 확인|low|legacyPhase|review|
|purchase-to-ap-invoice|p17|purchase-to-ap-invoice-step-17|위탁재고 현황|17|procure-to-pay::p9|재고인식|medium|legacyPhase|review|
|b2c-return|p1|b2c-return-step-01|B2C(온라인커머스) 반품요청|1|overview::return|반품|medium|legacyPhase|review|
|b2c-return|p2|b2c-return-step-02|이지어드민 주문수집|2|overview::return|반품|medium|legacyPhase|review|
|b2c-return|p3|b2c-return-step-03|B2C 반품 입고확인|3|procure-to-pay::p7|입고확인|medium|legacyPhase|review|
|b2c-return|p4|b2c-return-step-04|반품입고 수량 입력|4|procure-to-pay::p7|입고확인|medium|legacyPhase|review|
|b2c-return|p5|b2c-return-step-05|위탁 여부 확인|5|overview::return|반품|medium|legacyPhase|review|
|b2c-return|p6|b2c-return-step-06|위탁재고 현황|6|procure-to-pay::p9|재고인식|medium|legacyPhase|review|
|b2c-return|p7|b2c-return-step-07|반품주문등록|7|overview::return|반품|medium|legacyPhase|review|
|b2c-return|p8|b2c-return-step-08|반품주문확정|8|overview::return|반품|medium|legacyPhase|review|
|b2c-return|p9|b2c-return-step-09|출고반품요청|9|overview::return|반품|medium|legacyPhase|review|
|b2c-return|p10|b2c-return-step-10|반품확정|10|procure-to-pay::p8|입고확정|medium|legacyPhase|review|
|b2c-return|p11|b2c-return-step-11|입고정보|11|overview::return|반품|medium|legacyPhase|review|
|b2c-return|p12|b2c-return-step-12|일괄매출마감등록|12|overview::return|반품|medium|legacyPhase|review|
|b2c-return|p13|b2c-return-step-13|매출마감확정|13|overview::return|반품|medium|legacyPhase|review|
|b2c-return|p14|b2c-return-step-14|전표생성(미결)|14|overview::return|반품|medium|legacyPhase|review|
|event-sales|p1|event-sales-step-01|B2C(온라인커머스) 주문 |1|order-to-cash::p1|온라인주문|medium|legacyPhase|review|
|event-sales|p2|event-sales-step-02|이지어드민 주문수집|2|order-to-cash::p2|주문연동|high|legacyPhase|migratedPhaseIdOnly|
|event-sales|p4|event-sales-step-04|이벤트/당첨자 주문 집계|4|(review)|(review)|low|legacyPhase|review|
|event-sales|p5|event-sales-step-05|수령방식 구분|5|(review)|(review)|low|legacyPhase|review|
|event-sales|p6|event-sales-step-06|현장수령 주문 분리|6|(review)|(review)|low|legacyPhase|review|
|event-sales|p8|event-sales-step-08|현장출고/수령 수량 입력|8|order-to-cash::p4|출고확인|medium|legacyPhase|review|
|event-sales|p9|event-sales-step-09|재고이동 요청 확인|9|overview::warehouse-transfer|창고이동|medium|legacyPhase|review|
|event-sales|p10|event-sales-step-10|현장 수령 확인|10|(review)|(review)|low|legacyPhase|review|
|event-sales|p11|event-sales-step-11|이동 수량 입력|11|order-to-cash::p4|출고확인|medium|legacyPhase|review|
|event-sales|p12|event-sales-step-12|택배발송 주문 분리|12|(review)|(review)|low|legacyPhase|review|
|event-sales|p14|event-sales-step-14|B2C 출고 확인|14|order-to-cash::p4|출고확인|medium|legacyPhase|review|
|event-sales|p15|event-sales-step-15|출고 수량 입력|15|order-to-cash::p4|출고확인|medium|legacyPhase|review|
|event-sales|p16|event-sales-step-16|매출마감 대상 집계|16|order-to-cash::p7|매출마감|high|legacyPhase|migratedPhaseIdOnly|
|event-sales|p17|event-sales-step-17|매출마감확정|17|order-to-cash::p7|매출마감|high|legacyPhase|migratedPhaseIdOnly|
|event-sales|p18|event-sales-step-18|매출전표 생성(미결)|18|order-to-cash::p8|매출전표|medium|legacyPhase|review|
|store-sales|p1|store-sales-step-01|매장 판매|1|order-to-cash::p1|온라인주문|medium|legacyPhase|review|
|store-sales|p2|store-sales-step-02|매장 매출마감등록|2|order-to-cash::p7|매출마감|high|legacyPhase|migratedPhaseIdOnly|
|store-sales|p3|store-sales-step-03|주문등록|3|overview::order-register|주문등록|medium|legacyPhase|review|
|store-sales|p4|store-sales-step-04|주문확정|4|order-to-cash::p2a|주문확정|medium|legacyPhase|review|
|store-sales|p5|store-sales-step-05|이지어드민 연동현황|5|(review)|(review)|low|legacyPhase|review|
|store-sales|p6|store-sales-step-06|출고요청|6|order-to-cash::p3|출고요청|medium|legacyPhase|review|
|store-sales|p7|store-sales-step-07|출고확정|7|order-to-cash::p5|출고확정|medium|legacyPhase|review|
|store-sales|p8|store-sales-step-08|위탁 여부 확인|8|cross-process::consignment-check|위탁여부 확인|low|legacyPhase|review|
|store-sales|p9|store-sales-step-09|출고정보|9|order-to-cash::p3i|출고정보|low|legacyPhase|review|
|store-sales|p10|store-sales-step-10|일괄매출마감등록|10|order-to-cash::p7|매출마감|high|legacyPhase|migratedPhaseIdOnly|
|store-sales|p11|store-sales-step-11|매출마감확정|11|order-to-cash::p7|매출마감|high|legacyPhase|migratedPhaseIdOnly|
|store-sales|p12|store-sales-step-12|전표생성(미결)|12|finance::pending-voucher|전표생성(미결)|low|legacyPhase|review|
|revenue-share-settlement|p1|revenue-share-settlement-step-01|매출/비용 집계|1|overview::royalty-mg|로열티/MG정산|low|legacyPhase|review|
|revenue-share-settlement|p2|revenue-share-settlement-step-02|매출/비용 확정|2|overview::royalty-mg|로열티/MG정산|low|legacyPhase|review|
|revenue-share-settlement|p3|revenue-share-settlement-step-03|예외사항처리|3|cross-process::exception-handling|예외사항처리|low|legacyPhase|review|
|revenue-share-settlement|p4|revenue-share-settlement-step-04|MG차감여부|4|overview::royalty-mg|로열티/MG정산|medium|legacyPhase|review|
|revenue-share-settlement|p5|revenue-share-settlement-step-05|MG상계입력|5|overview::royalty-mg|로열티/MG정산|medium|legacyPhase|review|
|revenue-share-settlement|p6|revenue-share-settlement-step-06|MG상계처리|6|overview::royalty-mg|로열티/MG정산|medium|legacyPhase|review|
|revenue-share-settlement|p7|revenue-share-settlement-step-07|정산마감등록|7|overview::royalty-mg|로열티/MG정산|low|legacyPhase|review|
|revenue-share-settlement|p8|revenue-share-settlement-step-08|정산마감확정|8|overview::royalty-mg|로열티/MG정산|low|legacyPhase|review|
|revenue-share-settlement|p9|revenue-share-settlement-step-09|전표생성(미결)|9|finance::pending-voucher|전표생성(미결)|low|legacyPhase|review|
|service-business-to-expense|p1|service-business-to-expense-step-01|사업기회확보|1|business-to-project::p1|사업기회|high|legacyPhase|migratedPhaseIdOnly|
|service-business-to-expense|p2|service-business-to-expense-step-02|사업참여검토|2|business-to-project::p2|사업검토|high|legacyPhase|migratedPhaseIdOnly|
|service-business-to-expense|p3|service-business-to-expense-step-03|계약등록|3|business-to-project::p3|계약등록|high|legacyPhase|migratedPhaseIdOnly|
|service-business-to-expense|p4|service-business-to-expense-step-04|사업계약품의|4|business-to-project::p4|계약품의|high|legacyPhase|migratedPhaseIdOnly|
|service-business-to-expense|p5|service-business-to-expense-step-05|프로젝트실행품의입력|5|business-to-project::p6|실행품의|high|legacyPhase|migratedPhaseIdOnly|
|service-business-to-expense|p6|service-business-to-expense-step-06|프로젝트 실행품의|6|business-to-project::p6|실행품의|high|legacyPhase|migratedPhaseIdOnly|
|service-business-to-expense|p7|service-business-to-expense-step-07|프로젝트등록|7|business-to-project::p5|프로젝트등록|high|legacyPhase|migratedPhaseIdOnly|
|service-business-to-expense|p8|service-business-to-expense-step-08|WBS코드등록|8|business-to-project::p5|프로젝트등록|high|legacyPhase|migratedPhaseIdOnly|
|service-business-to-expense|p9|service-business-to-expense-step-09|프로젝트 지출결의|9|(review)|(review)|low|legacyPhase|review|
|service-business-to-expense|p10|service-business-to-expense-step-10|전표생성(미결)|10|finance::pending-voucher|전표생성(미결)|low|legacyPhase|review|
|service-purchase-to-ap|p1|service-purchase-to-ap-step-01|구매요청|1|procure-to-pay::p1|구매요청|high|legacyPhase|migratedPhaseIdOnly|
|service-purchase-to-ap|p2|service-purchase-to-ap-step-02|구매요청확정|2|procure-to-pay::p1|구매요청|high|legacyPhase|migratedPhaseIdOnly|
|service-purchase-to-ap|p3|service-purchase-to-ap-step-03|구매발주 품의|3|procure-to-pay::p4|발주품의|high|legacyPhase|migratedPhaseIdOnly|
|service-purchase-to-ap|p4|service-purchase-to-ap-step-04|발주등록|4|procure-to-pay::p5|발주등록|high|legacyPhase|migratedPhaseIdOnly|
|service-purchase-to-ap|p5|service-purchase-to-ap-step-05|발주확정|5|(review)|(review)|low|legacyPhase|review|
|service-purchase-to-ap|p6|service-purchase-to-ap-step-06|입고요청|6|procure-to-pay::p6|입고정보|medium|legacyPhase|review|
|service-purchase-to-ap|p7|service-purchase-to-ap-step-07|입고확정|7|procure-to-pay::p8|입고확정|medium|legacyPhase|review|
|service-purchase-to-ap|p8|service-purchase-to-ap-step-08|매입마감조회|8|procure-to-pay::p10|매입마감|high|legacyPhase|migratedPhaseIdOnly|
|service-purchase-to-ap|p9|service-purchase-to-ap-step-09|매입마감확정|9|procure-to-pay::p10|매입마감|high|legacyPhase|migratedPhaseIdOnly|
|service-purchase-to-ap|p10|service-purchase-to-ap-step-10|전표생성(미결)|10|procure-to-pay::p11|매입전표|high|legacyPhase|review|
|service-order-to-sales|p1|service-order-to-sales-step-01|주문일괄등록|1|order-to-cash::p1|온라인주문|medium|legacyPhase|review|
|service-order-to-sales|p2|service-order-to-sales-step-02|주문확정|2|order-to-cash::p2a|주문확정|medium|legacyPhase|review|
|service-order-to-sales|p3|service-order-to-sales-step-03|출고요청|3|order-to-cash::p3|출고요청|medium|legacyPhase|review|
|service-order-to-sales|p4|service-order-to-sales-step-04|출고확정|4|order-to-cash::p5|출고확정|medium|legacyPhase|review|
|service-order-to-sales|p5|service-order-to-sales-step-05|일괄매출마감등록|5|order-to-cash::p7|매출마감|high|legacyPhase|migratedPhaseIdOnly|
|service-order-to-sales|p6|service-order-to-sales-step-06|매출마감확정|6|order-to-cash::p7|매출마감|high|legacyPhase|migratedPhaseIdOnly|
|service-project-settlement|p1|service-project-settlement-step-01|매출/비용 마감집계|1|overview::royalty-mg|로열티/MG정산|low|legacyPhase|review|
|service-project-settlement|p2|service-project-settlement-step-02|매출/비용 마감확정|2|overview::royalty-mg|로열티/MG정산|low|legacyPhase|review|
|service-project-settlement|p3|service-project-settlement-step-03|예외사항처리|3|cross-process::exception-handling|예외사항처리|low|legacyPhase|review|
|service-project-settlement|p4|service-project-settlement-step-04|MG차감여부|4|overview::royalty-mg|로열티/MG정산|medium|legacyPhase|review|
|service-project-settlement|p5|service-project-settlement-step-05|MG상계입력|5|overview::royalty-mg|로열티/MG정산|medium|legacyPhase|review|
|service-project-settlement|p6|service-project-settlement-step-06|MG상계처리|6|overview::royalty-mg|로열티/MG정산|medium|legacyPhase|review|
|service-project-settlement|p7|service-project-settlement-step-07|정산마감등록|7|overview::royalty-mg|로열티/MG정산|low|legacyPhase|review|
|service-project-settlement|p8|service-project-settlement-step-08|정산마감확정|8|overview::royalty-mg|로열티/MG정산|low|legacyPhase|review|
|service-project-settlement|p9|service-project-settlement-step-09|전표생성(미결)|9|finance::pending-voucher|전표생성(미결)|low|legacyPhase|review|

## Migrated Nodes

|processId|nodeId|nodeName|beforePhaseId|afterPhaseId|preservedPhaseOrder|
|---|---|---|---|---|---|
|to-be-overview|sales-inquiry|매출마감조회|overview::sales-inquiry|order-to-cash::p7|27|
|to-be-overview|node-mqlvuvcc-s53dp|매입마감조회|business-to-project::p1|procure-to-pay::p10|1|
|business-to-project|opportunity|사업기회확보|p1|business-to-project::p1|1|
|business-to-project|business-review|사업참여검토|p2|business-to-project::p2|2|
|business-to-project|contract-register|계약등록|p3|business-to-project::p3|3|
|business-to-project|contract-approval|사업계약품의|p4|business-to-project::p4|4|
|business-to-project|project-register|프로젝트등록|p5|business-to-project::p5|5|
|business-to-project|project-approval|사업실행품의|p6|business-to-project::p6|6|
|business-to-project|purchase-request|구매요청|p7|procure-to-pay::p1|7|
|business-to-project|product-check|품목확인|p8|procure-to-pay::p2|8|
|business-to-project|vendor-check|거래처확인|p8|procure-to-pay::p2b|8|
|business-to-project|product-register-request|품목등록요청|p8|procure-to-pay::p3|8|
|business-to-project|product-register-approval|품목등록승인|p8|procure-to-pay::p3a|8|
|business-to-project|vendor-register|거래처등록요청|p8|procure-to-pay::p3b|8|
|business-to-project|vendor-register-approval|거래처등록승인|p8|procure-to-pay::p3c|8|
|business-to-project|po-approval|발주품의|p8|procure-to-pay::p4|8|
|business-to-project|purchase-order|계약/발주등록|p8|procure-to-pay::p5|8|
|business-to-project|ap-close|매입마감확정|p10|procure-to-pay::p10|10|
|business-to-project|fi-posting|매입전표 반영|p10|procure-to-pay::p11|10|
|consignment-purchase-receipt|consignment-purchase-receipt-step-01|구매요청|p1|procure-to-pay::p1|1|
|consignment-purchase-receipt|consignment-purchase-receipt-step-02|구매요청확정|p2|procure-to-pay::p1|2|
|consignment-purchase-receipt|consignment-purchase-receipt-step-03|발주등록|p3|procure-to-pay::p5|3|
|b2b-domestic-order-to-sales|b2b-domestic-order-to-sales-step-11|일괄매출마감등록|p11|order-to-cash::p7|11|
|b2b-domestic-order-to-sales|b2b-domestic-order-to-sales-step-12|매출마감확정|p12|order-to-cash::p7|12|
|b2b-export-order-to-sales|b2b-export-order-to-sales-step-13|매출전기처리|p13|order-to-cash::p7|13|
|b2c-order-to-sales|b2c-order-to-sales-step-02|이지어드민 주문수집|p2|order-to-cash::p2|2|
|b2c-order-to-sales|b2c-order-to-sales-step-12|일괄매출마감등록|p12|order-to-cash::p7|12|
|b2c-order-to-sales|b2c-order-to-sales-step-13|매출마감확정|p13|order-to-cash::p7|13|
|preorder-to-sales|preorder-to-sales-step-03|이지어드민 주문수집|p3|order-to-cash::p2|3|
|preorder-to-sales|preorder-to-sales-step-13|일괄매출마감등록|p13|order-to-cash::p7|13|
|preorder-to-sales|preorder-to-sales-step-14|매출마감확정|p14|order-to-cash::p7|14|
|popup-concert-stock-sales-sync|popup-concert-stock-sales-sync-step-14|일괄매출마감등록|p14|order-to-cash::p7|14|
|popup-concert-stock-sales-sync|popup-concert-stock-sales-sync-step-15|매출마감확정|p15|order-to-cash::p7|15|
|business-to-purchase-request|business-to-purchase-request-step-01|사업기회확보|p1|business-to-project::p1|1|
|business-to-purchase-request|business-to-purchase-request-step-02|사업참여검토|p2|business-to-project::p2|2|
|business-to-purchase-request|business-to-purchase-request-step-03|계약등록|p3|business-to-project::p3|3|
|business-to-purchase-request|business-to-purchase-request-step-04|사업계약품의|p4|business-to-project::p4|4|
|business-to-purchase-request|business-to-purchase-request-step-05|프로젝트실행품의입력|p5|business-to-project::p6|5|
|business-to-purchase-request|business-to-purchase-request-step-06|프로젝트 실행품의|p6|business-to-project::p6|6|
|business-to-purchase-request|business-to-purchase-request-step-07|프로젝트등록|p7|business-to-project::p5|7|
|business-to-purchase-request|business-to-purchase-request-step-08|WBS코드등록|p8|business-to-project::p5|8|
|business-to-purchase-request|business-to-purchase-request-step-10|구매요청|p10|procure-to-pay::p1|10|
|business-to-purchase-request|node-mqq2hit5-4qlv8|프로젝트등록(미결)|business-to-project::p1|business-to-project::p5|1|
|purchase-to-ap-invoice|purchase-to-ap-invoice-step-01|구매요청|p1|procure-to-pay::p1|1|
|purchase-to-ap-invoice|purchase-to-ap-invoice-step-02|구매요청확정|p2|procure-to-pay::p1|2|
|purchase-to-ap-invoice|purchase-to-ap-invoice-step-03|발주등록|p3|procure-to-pay::p5|3|
|purchase-to-ap-invoice|purchase-to-ap-invoice-step-04|구매발주 품의|p4|procure-to-pay::p4|4|
|purchase-to-ap-invoice|purchase-to-ap-invoice-step-13|매입마감조회|p13|procure-to-pay::p10|13|
|purchase-to-ap-invoice|purchase-to-ap-invoice-step-14|매입마감확확정|p14|procure-to-pay::p10|14|
|event-sales|event-sales-step-02|이지어드민 주문수집|p2|order-to-cash::p2|2|
|event-sales|event-sales-step-16|매출마감 대상 집계|p16|order-to-cash::p7|16|
|event-sales|event-sales-step-17|매출마감확정|p17|order-to-cash::p7|17|
|store-sales|store-sales-step-02|매장 매출마감등록|p2|order-to-cash::p7|2|
|store-sales|store-sales-step-10|일괄매출마감등록|p10|order-to-cash::p7|10|
|store-sales|store-sales-step-11|매출마감확정|p11|order-to-cash::p7|11|
|service-business-to-expense|service-business-to-expense-step-01|사업기회확보|p1|business-to-project::p1|1|
|service-business-to-expense|service-business-to-expense-step-02|사업참여검토|p2|business-to-project::p2|2|
|service-business-to-expense|service-business-to-expense-step-03|계약등록|p3|business-to-project::p3|3|
|service-business-to-expense|service-business-to-expense-step-04|사업계약품의|p4|business-to-project::p4|4|
|service-business-to-expense|service-business-to-expense-step-05|프로젝트실행품의입력|p5|business-to-project::p6|5|
|service-business-to-expense|service-business-to-expense-step-06|프로젝트 실행품의|p6|business-to-project::p6|6|
|service-business-to-expense|service-business-to-expense-step-07|프로젝트등록|p7|business-to-project::p5|7|
|service-business-to-expense|service-business-to-expense-step-08|WBS코드등록|p8|business-to-project::p5|8|
|service-business-to-expense|node-mqq7rl59-5y9jn|프로젝트등록(미결)|business-to-project::p1|business-to-project::p5|1|
|service-purchase-to-ap|service-purchase-to-ap-step-01|구매요청|p1|procure-to-pay::p1|1|
|service-purchase-to-ap|service-purchase-to-ap-step-02|구매요청확정|p2|procure-to-pay::p1|2|
|service-purchase-to-ap|service-purchase-to-ap-step-03|구매발주 품의|p3|procure-to-pay::p4|3|
|service-purchase-to-ap|service-purchase-to-ap-step-04|발주등록|p4|procure-to-pay::p5|4|
|service-purchase-to-ap|service-purchase-to-ap-step-08|매입마감조회|p8|procure-to-pay::p10|8|
|service-purchase-to-ap|service-purchase-to-ap-step-09|매입마감확정|p9|procure-to-pay::p10|9|
|service-order-to-sales|service-order-to-sales-step-05|일괄매출마감등록|p5|order-to-cash::p7|5|
|service-order-to-sales|service-order-to-sales-step-06|매출마감확정|p6|order-to-cash::p7|6|
