# Workshop Menu v1 Backlog

이 문서는 Workshop Menu v1 live menu에서 제외했거나, 위치와 업무 범위 확인이 필요한 항목을 기록한다.

## Excluded Backlog

| Item | Reason | Next Decision |
| --- | --- | --- |
| 거래처 관리 Process | 독립 Detail Process가 없다. | 기준정보 Process를 새로 만들지, 기존 업무 노드로만 설명할지 결정한다. |
| 품목 관리 Process | 독립 Detail Process가 없다. | 기준정보 Process를 새로 만들지, 기존 업무 노드로만 설명할지 결정한다. |
| 일반운영 품의/발의 Process | 현재 UC 성격이며 독립 Process가 없다. | 프로젝트를 생성하지 않는 운영성 의사결정을 Navigator Process로 만들지 결정한다. |
| 수입 구매 Process | 수입 구매 전용 Runtime Process가 없다. | 프로젝트 구매 안에 포함할지, 별도 수입 구매 Process를 만들지 결정한다. |
| 연구개발 구매 Process | 독립 연구개발 구매 Process가 명확하지 않다. | F&B Process와 분리되는지 확인한다. |

## Unresolved Runtime Processes

| Process ID | Current Name | Candidate Menu | Open Question |
| --- | --- | --- | --- |
| service-order-to-sales | 주문등록 ~ 매출전표 생성 : 서비스 | 판매 > 서비스매출 | 별도 서비스매출 메뉴가 필요한지, 온라인몰/B2B에 포함될 수 있는지 확인한다. |
| service-business-to-expense | 사업 기회 확보 ~ 비용 정산 : 서비스 | 사업관리 > 프로젝트 또는 사업관리 > 일반운영 | 프로젝트성 서비스인지, 일반운영성 비용 정산인지 확인한다. |
| storage-location-master | 저장위치 마스터 : 단일 | 기준정보 > 저장위치 | 기준정보 live menu에 저장위치를 포함할지 확인한다. |

## Alias Ambiguities

| Navigation Alias | Process ID | Open Question |
| --- | --- | --- |
| 사인회 | event-sales | `event-sales`가 사인회만 의미하는지, 일반 이벤트 판매까지 포함하는지 확인한다. |
| 판매대행 정산 | consignment-settlement | 판매대행 정산과 위탁 매출 정산의 업무 범위가 완전히 동일한지 확인한다. |
| 매장간 이동 | stock-transfer | Runtime title/variant의 창고간 이동을 Workshop에서 매장간 이동으로 부르는 것이 적절한지 확인한다. |
