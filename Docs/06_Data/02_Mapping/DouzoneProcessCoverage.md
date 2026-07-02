# Douzone Process Coverage

|Field|Value|
|---|---|
|Title|Douzone Process Coverage|
|Purpose|Douzone SCM Master Source가 Navigator에 얼마나 반영되었는지 Coverage Matrix로 관리한다.|
|Status|Approved|
|Owner|Project Team|
|Last Updated|2026-06-29|
|Related Docs|`ProcessMapping.md`, `../../02_Master/BusinessCapabilityMaster.md`, `../../02_Master/BusinessActivityMaster.md`, `../01_Source/Douzone/README.md`|

> Methodology v1.0 Frozen. 변경은 Methodology Revision 결정이 있을 때만 수행한다.

## Purpose

Douzone PDF는 이미 Master Source이다.

따라서 별도의 Douzone Process Master를 만들지 않는다.

대신 이 문서에서 Douzone SCM Process의 Navigator 반영 상태를 Coverage Matrix로 관리한다.

목표는 Navigator가 Douzone SCM 영역을 100% Coverage 하는 것이다.

공통관리, 조직관리, 인사관리, 회계관리, 세무관리는 Navigator 구축 대상이 아니다. 이 영역은 OmniEsol ERP 교육과 실제 사용으로 정착하며, Navigator에서는 SCM Process와 연결되는 ERP 메뉴/승인 지점만 Reference Only로 관리한다.

## Coverage Status

|Status|Meaning|
|---|---|
|Complete|Navigator에 Detail Process 또는 명확한 Activity/Node Definition으로 반영되어 있고 현업 검토가 가능한 상태|
|Partial|Navigator에 일부 반영되어 있으나 Copan 해석, Activity, Node Definition, 흐름 보강이 필요한 상태|
|Planned|아직 Navigator에는 없지만 반영 계획 또는 Capability가 정의된 상태|
|Missing|현재 Navigator와 Mapping에서 명시적으로 반영되지 않은 상태|
|Reference Only|SCM Navigator 구축 대상이 아니며 ERP 교육/실사용 또는 별도 운영 기준으로 관리하는 상태|

## Coverage Matrix

아래 Matrix는 현재 확인된 Douzone SCM Source Process와 Navigator 20개 Detail Process 기준의 초안이다.

|Douzone Process|Capability|Business Activity|Navigator Process|Status|Remark|
|---|---|---|---|---|---|
|비용청구관리|콘텐츠/서비스 / 회계/전표관리|비용전표 생성, 예외사항처리, 전표생성(미결), 전표조회승인|17 사업기회 ~ 비용 전표 생성 : 서비스|Partial|서비스 비용 흐름으로 일부 반영. Douzone 비용청구 기준 상세 Activity 보강 필요|
|품목 등록 PROCESS|기준정보관리|품목등록, 품목확인|01 사업 기회 확보 ~ 구매 요청 : 제/상품|Partial|Process 01에서 구매요청 전 기준정보 연결 프로세스로 반영. Approved 전까지 Coverage는 Partial 유지|
|거래처 등록 PROCESS|기준정보관리|거래처등록, 거래처확인|01 사업 기회 확보 ~ 구매 요청 : 제/상품|Partial|Process 01에서 구매요청 전 기준정보 연결 프로세스로 반영. Approved 전까지 Coverage는 Partial 유지|
|계약 등록 PROCESS|계약/프로젝트관리 / 기준정보관리|사업기회확보, 사업참여검토, 사업계약품의, 계약등록, 프로젝트등록, WBS코드등록, 프로젝트 상태관리, 구매요청 연결|01 사업 기회 확보 ~ 구매 요청 : 제/상품 / 17 서비스 비용 흐름|Partial|Process 01은 Internal Review Ready. Approved 전까지 Coverage는 Partial 유지|
|구매 입고 PROCESS|구매관리 / 매입/입고관리 / 재고관리 / Reference: 회계관리|구매요청, 구매발주, 입고요청, 입고처리, 입고확정, 재고인식(+), 매입마감확정, 전표생성(미결), 전표조회승인|02 구매 요청 ~ 입고 ~ 매입 전표 / 18 서비스 매입|Partial|Process 02, 18은 Internal Review Ready. Approved 전까지 Coverage는 Partial 유지|
|B2C 판매 PROCESS|영업/주문관리 / 출고관리 / 재고관리 / 회계/전표관리|온라인주문접수, 주문정보연동, 주문등록, 주문확정, 출고요청, 출고확정, 재고인식(-), 매출마감확정, 전표생성(미결), 전표조회승인|06 B2C / 07 예약판매 B2C|Partial|Process 06, 07은 Internal Review Ready. Approved 전까지 Coverage는 Partial 유지|
|B2C 판매 반품 PROCESS|반품관리 / 재고관리 / 회계/전표관리|반품등록, 반품입고확정, 재고인식(+), 반품마감확정, 전표생성(미결), 전표조회승인|08 B2C 반품|Partial|Process 08은 Internal Review Ready. Approved 전까지 Coverage는 Partial 유지|
|국내 B2B 판매 PROCESS|영업/주문관리 / 출고관리 / 재고관리 / 회계/전표관리|주문등록, 주문확정, 출고요청, 출고처리, 출고확정, 재고인식(-), 매출마감확정, 전표생성(미결)|03 B2B 국내|Partial|WMS/EasyAdmin 확장 반영. Node Definition 기준 재점검 필요|
|B2B 판매 반품 PROCESS|반품관리 / 재고관리 / 회계/전표관리|반품등록, 입고요청, 반품입고확정, 재고인식(+), 반품마감확정, 전표생성(미결)|04 B2B 국내 반품|Partial|기존 Batch 보정은 새 Owner 기준으로 재검토 필요|
|자사 재고 해외 B2B PROCESS|해외업무 / 영업/주문관리 / 출고관리 / 회계/전표관리|수출이동지시, 송장입력, 수출통관처리, B/L 입력, B/L 기준 출고확정, 포워딩, 매출마감확정, 전표생성(미결), 전표조회승인|05 B2B 해외|Complete|Process 06 보정에서 자사재고 수출, 송장/B/L/통관, 해외 가상창고 재고이동, 재무 승인 흐름까지 반영. 현업 검토 대기|
|위탁 재고 해외 B2B PROCESS|해외업무 / 재고관리 / 정산관리|위탁여부 확인, 위탁재고 현황 조회, 수출출고, 해외 가상창고 재고이동, 매출마감확정|05 B2B 해외|Complete|Process 06 안에서 자사/위탁 해외 흐름을 통합 표현. 위탁 정산 상세는 정산 Batch에서 별도 검토|
|플랫폼 비재고 매출 PROCESS|플랫폼 / 콘텐츠/서비스 / 회계/전표관리|서비스 주문등록, 서비스 제공 확인, 매출마감확정, 전표생성(미결)|19 서비스 주문 ~ 매출 전표 생성|Complete|Batch 1에서 비재고 서비스 흐름으로 재정의하고 전표생성(미결) Node 추가. 현업 검토 대기|
|콘텐츠 비재고 매출 PROCESS|콘텐츠/서비스 / 회계/전표관리|서비스 주문등록, 서비스 제공 확인, 매출마감확정, 전표생성(미결)|19 서비스 주문 ~ 매출 전표 생성 / 20 프로젝트 정산|Partial|19번은 Batch 1에서 정리 완료. 20 프로젝트 정산 상세는 별도 Batch 필요|
|공연장(행사장) 팝업 PROCESS|공연장/팝업 / 출고관리 / 재고관리 / 회계/전표관리|공연장 출고, 현장판매, 잔여재고 복귀, 매출마감확정, 전표생성(미결), 전표조회승인|09 공연장/팝업 판매 ~ 출고 ~ 매출전표|Partial|Process 09는 Internal Review Ready. Approved 전까지 Coverage는 Partial 유지|
|이벤트 PROCESS|이벤트 / 플랫폼 / 출고관리 / 재고관리 / 회계/전표관리|이벤트 주문접수, 당첨자 여부 확인, 현장수령 분리, 택배발송 분리, 출고확정, 전표생성(미결), 전표조회승인|10 이벤트 : 제/상품|Partial|Process 10은 Internal Review Ready. Approved 전까지 Coverage는 Partial 유지|
|매장 출고 PROCESS|매장/POS / 출고관리 / 재고관리 / 회계/전표관리|매장판매, 판매정보연동, 출고요청, 출고확정, 매출마감확정, 전표생성(미결), 전표조회승인|11 매장 판매 ~ 출고 ~ 매출전표|Partial|Process 11은 Internal Review Ready. Approved 전까지 Coverage는 Partial 유지|
|기타 출고 PROCESS|출고관리 / 재고관리|기타출고 요청, 출고요청, 출고확정, 재고인식(-)|13 기타 출고 : 제/상품|Partial|무상증정/샘플/기타출고 유형별 승인 및 전표 여부 확인 필요|
|매장 재고이동 PROCESS|매장/POS / 재고관리|창고이동 요청, 창고이동 확정, 입/출고정보 저장, 재고인식(+/-)|12 매장 간 재고이동 : 제/상품|Partial|매장/POS Owner 기준과 ERP 입/출고정보 Auto Owner 정리 필요|
|재고이동 PROCESS|재고관리|창고이동 요청, 창고이동 확정, 입/출고정보 저장, 재고인식(+/-)|12 매장 간 재고이동 : 제/상품|Partial|일반 창고이동과 매장 재고이동을 분리할지 검토 필요|
|위탁 매출 정산 PROCESS|정산관리 / Reference: 회계관리|위탁매출정산, 정산대상 집계, 정산마감, 전표생성(미결), 전표자동승인, 회계마감 반영|15 위탁 매출 정산 / 16 수익배분 매출 정산 / 20 프로젝트 정산|Partial|Process 15, 16, 20은 Internal Review Ready. Approved 전까지 Coverage는 Partial 유지|
|판매 로열티 정산 PROCESS|정산관리 / Reference: 회계관리|로열티정산, MG 차감여부 판단, 정산마감, 전표생성(미결), 전표자동승인, 회계마감 반영|14 기획사 로열티 정산 / 16 수익배분 매출 정산 / 20 프로젝트 정산|Partial|Process 14, 16, 20은 Internal Review Ready. Approved 전까지 Coverage는 Partial 유지|
|조직/권한/사용자 관리 영역|조직관리 / 공통관리|Owner 정의, 승인 책임, 권한 관리|Navigator Lane/Owner 참조|Reference Only|SCM Navigator 구축 대상이 아니며 OmniEsol ERP 교육/권한 운영 기준으로 관리|
|세무/부가세/세금계산서 영역|세무관리 / 회계/전표관리|세금계산서, 부가세 처리, 신고자료 생성|ERP 메뉴 참조만 관리|Reference Only|SCM Navigator 구축 대상이 아니며 OmniEsol ERP 교육과 실제 사용으로 정착|
|공통 코드/환경설정 영역|공통관리 / 기준정보관리|공통코드, 시스템 설정, 기준값 관리|ERP 메뉴 참조만 관리|Reference Only|SCM Navigator 구축 대상이 아니며 OmniEsol ERP 설정/교육 범위로 관리|

## Capability Coverage Summary

|Capability|Coverage|Navigator Status|Remark|
|---|---|---|---|
|기준정보관리|Partial|01에 일부 포함|품목/거래처 기준정보는 Process 01에서 연결 프로세스로 반영. 전용 Detail Process 필요 여부는 후속 검토|
|계약/프로젝트관리|Partial|01, 17, 20에 일부 포함|Process 01은 Internal Review Ready. 서비스 계약/프로젝트 흐름은 17에서 후속 보강 필요|
|구매관리|Partial|01, 02, 18에 반영|02, 18은 Internal Review Ready. Approved 전까지 Coverage는 Partial 유지|
|매입/입고관리|Partial|02, 18에 반영|제/상품, 서비스 매입으로 분기 정리. Approved 전까지 Coverage는 Partial 유지|
|영업/주문관리|Partial|03, 05, 06, 07, 11, 19에 반영|채널별 Activity/Node Definition 정리 필요|
|출고관리|Partial|03, 05, 06, 07, 09, 10, 11, 13에 반영|물류 Owner와 시스템 연동 구분 필요|
|재고관리|Partial|02-13에 폭넓게 반영|Auto 재고반영 Owner 기준 재검토 필요|
|반품관리|Partial|04, 08에 반영|B2B/B2C 반품은 있으나 회계/재고 Owner 정리 필요|
|정산관리|Partial|14, 15, 16, 20에 반영|14, 15, 16, 20은 Internal Review Ready. Approved 전까지 Coverage는 Partial 유지|
|회계관리|Reference Only|SCM Process의 전표생성/전표조회승인 연결 지점만 표시|회계 프로세스 자체는 Navigator 구축 대상이 아니며 OmniEsol ERP 교육과 실제 사용으로 정착|
|세무관리|Reference Only|ERP 메뉴 참조만 관리|부가세/세금계산서/신고는 Navigator 구축 대상에서 제외|
|조직관리|Reference Only|Lane/Owner 참조로만 표현|권한/조직 Process는 Navigator 구축 대상에서 제외|
|공통관리|Reference Only|예외/연결 패턴과 ERP 메뉴 참조만 관리|공통코드/환경설정은 Navigator 구축 대상에서 제외|
|해외업무|Complete|06에 반영|Process 06에서 수출 이동지시, 송장, 수출통관, B/L, 해외 가상창고 재고이동, 매출마감, 재무 승인까지 현업 검토 가능 수준으로 정리|
|플랫폼|Partial|07, 08, 09, 11, 20에 반영|Cafe24/플랫폼 비재고 범위 정리 필요|
|콘텐츠/서비스|Partial|18-21에 반영|서비스/콘텐츠 원천 프로세스 세분화 필요|
|이벤트|Partial|11에 반영|11은 Internal Review Ready. Approved 전까지 Coverage는 Partial 유지|
|공연장/팝업|Partial|10에 반영|10은 Internal Review Ready. Approved 전까지 Coverage는 Partial 유지|
|매장/POS|Partial|12, 13에 반영|12는 Internal Review Ready, 13 매장 간 재고이동은 후속 검토 필요. Approved 전까지 Coverage는 Partial 유지|

## Business Activity Coverage Summary

|Coverage|Business Activities|
|---|---|
|Currently represented|사업기회확보, 사업참여검토, 사업계약품의, 계약등록, 프로젝트등록, 거래처등록, 품목등록, 구매요청, 구매발주, 발주품의, 입고요청, 입고처리, 입고확정, 재고인식(+), 재고인식(-), 위탁여부 확인, 위탁재고 현황 조회, 온라인주문접수, 주문정보연동, 주문등록, 주문확정, 출고요청, 출고처리, 출고확정, 매출마감조회, 매출마감확정, 전표생성(미결), 전표조회승인, 매출전기처리, 반품등록, 반품입고확정, 반품마감확정, 선수금 처리, 선수금 반제, 매장판매, 판매정보연동, 창고이동 요청, 창고이동 확정, 기타출고 요청, 기타출고 확정, 정산대상 집계, 로열티정산, 위탁매출정산, 수익배분정산, MG 차감여부 판단, 정산마감, 예외사항처리|
|Needs normalization|전표생성(미결), ERP 자동 재고반영, ERP 자동 상태변경, 위탁여부 확인, Database/정보 저장 Node, Interface Rule Node|
|Reference only|세금계산서, 부가세 처리, 신고자료 생성, 조직/권한 관리, 공통코드 관리, 시스템 환경설정|

## Navigator Coverage Summary

|Navigator Scope|Coverage|
|---|---|
|20 Detail Process|SCM, 영업, 출고, 재고, 반품, 정산, 서비스 일부를 반영한다.|
|Overview|Copan ERP TO-BE 주요 End-to-End 흐름을 반영한다.|
|Douzone SCM Coverage|아직 100%가 아니다. SCM 대상 Capability 중 일부 서비스/정산/반품/재고 영역이 Partial 상태다.|
|Reference Only Scope|공통관리, 조직관리, 인사관리, 회계관리, 세무관리는 SCM Navigator Coverage 대상에서 제외한다.|
|Immediate focus|Internal Review Ready Process를 현업 검토하고, 남은 SCM Detail Process를 Activity/Owner/Execution System 기준으로 정합화한다.|

## Batch Update History

|Date|Batch|Navigator Process|Coverage Result|Remark|
|---|---|---|---|---|
|2026-06-28|Batch 1|05 B2B 해외, 09 공연장/팝업, 10 이벤트, 11 매장 판매, 19 서비스 매출|Batch target 5/5 review-ready|Owner 기준 Lane, Execution System, Auto 전표생성(미결), EasyAdmin/EasyChain/POS/Cafe24 운영 반영 완료. 19번은 플랫폼 비재고 매출 Complete, 콘텐츠 비재고는 20번 프로젝트 정산 후 최종 Complete 가능|

## Maintenance Rule

이 문서는 Douzone PDF 중 SCM 영역의 Master Source Coverage를 관리한다.

새 Navigator Process 또는 Activity를 만들 때는 아래 순서를 따른다.

1. Douzone PDF Source Process를 확인한다.
2. 해당 Douzone Process가 이 Coverage Matrix에 있는지 확인한다.
3. Capability를 지정한다.
4. Business Activity를 매핑한다.
5. Navigator Process 반영 상태를 `Complete`, `Partial`, `Planned`, `Missing` 중 하나로 관리한다.

Coverage가 `Complete`가 되려면 단순히 Node가 존재하는 것만으로는 부족하다.

다음 기준을 모두 만족해야 한다.

1. Douzone Process와 Navigator Process 대응이 명확하다.
2. Capability와 Business Activity가 연결되어 있다.
3. Node Definition이 Owner, Execution System, Processing Type 기준으로 정리되어 있다.
4. 현업 검토가 가능한 상태다.
5. Review Status가 Approved 또는 이에 준하는 상태다.

Reference Only 영역은 Coverage Complete 대상이 아니다. SCM Process와 연결되는 ERP 메뉴, 전표 승인 지점, 교육 필요 사항만 문서로 남긴다.
