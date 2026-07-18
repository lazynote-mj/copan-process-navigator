# Workshop Navigation Review

|Field|Value|
|---|---|
|Status|Workshop Navigation Index Review v2|
|Related Index|`WorkshopNavigationIndex.md`|
|Baseline|Current runtime detail processes, 27 total|
|Generated At|2026-07-14|

## Summary

| Metric | Count |
|---|---:|
| Current Process count | 27 |
| Proposed Menu Level1 count | 7 |
| Proposed Menu Level2 count | 17 |
| Proposed Process Family count | 22 |
| Product type as core differentiator | 0 |
| Service type as core differentiator | 3 |
| Stock movement 여부 as core differentiator | 4 |
| Sales channel as core differentiator | 6 |
| Transaction type as core differentiator | 10 |
| Project as core differentiator | 2 |
| Organization characteristic as core differentiator | 1 |
| Other as core differentiator | 1 |

## v2 Review Principle

This review is not trying to define a perfect taxonomy. It asks one practical question:

> When a workshop participant says "이 프로세스를 보여주세요", which first word will help them find it fastest?

Therefore, `MD`, `응원봉`, `앨범`, `제상품`, `상품`, and `위탁상품` are not used as menu split criteria unless they actually change the process. In the current review, no process is separated primarily by product type.

## Proposed Menu Level1

- 사업관리
- 구매
- 판매
- 반품
- 재고
- 정산
- 기준정보

## Proposed Menu Level2

- 계약/프로젝트
- 서비스사업
- 구매요청
- 주문관리
- 현장판매
- 이벤트판매
- 서비스매출
- 반품관리
- 구매반품
- 재고이동
- 기타출고
- 기타입고
- 로열티정산
- 위탁정산
- 수익배분정산
- 프로젝트정산
- 저장위치

> 워크숍에서 기준정보를 별도 navigation 대상으로 보지 않는다면 실운영 Level2는 16개로 줄일 수 있다.

## Core Process Difference Distribution

| Core Condition | Count | Meaning |
|---|---:|---|
| 서비스유형 | 3 | 서비스/비용/IT/SW/F&B처럼 수행 방식이 달라지는 경우 |
| 수불 여부 | 4 | 재고 수불이 있는 흐름과 비수불 서비스 흐름이 갈라지는 경우 |
| 판매채널 | 6 | B2B, B2C, 매장/POS 등 사용자가 채널명으로 찾는 경우 |
| 프로젝트 | 2 | 프로젝트 또는 공연/팝업처럼 project/event operation 성격이 강한 경우 |
| 거래유형 | 10 | 예약판매, 반품, 기타입출고, 정산 유형 등 거래 성격이 흐름을 바꾸는 경우 |
| 상품유형 | 0 | 상품유형만으로 프로세스를 분리한 항목 없음 |
| 조직 특성 | 1 | 인사/총무처럼 요청 조직 특성이 탐색 기준이 되는 로컬 프로세스 |
| 기타 | 1 | 기준정보성 supporting process |

## Same Process Family Candidates

| Process Family | Processes | Reason |
|---|---|---|
| 수불상품 판매 | B2B 국내, B2B 해외/수출, B2C 온라인, 예약판매 | 상품유형이 아니라 판매채널/거래유형이 달라지는 동일 order-to-sales family. |
| 현장 판매 | 공연장/팝업, 매장/POS | 사용자는 "공연 판매", "매장 판매"로 찾을 가능성이 높음. 다만 process detail은 재고이동/출고/매출이 섞임. |
| 판매반품 | B2B 국내 반품, B2C 온라인 반품 | 반품주문에서 반품입고/반품전표로 가는 동일 family. |
| 수불상품 재고이동 | 매장 간 재고이동, 일반 재고이동 | 재고이동 요청/확정 흐름이 동일하고 context만 다름. |
| 비수불 구매 | 서비스, F&B/소모품, IT/S/W, 인사/총무 | `wf-purchase-request-to-ap`에 속하며 입고 중심보다 지출/매입전표 중심. |
| 정산 | 로열티, 위탁, 수익배분, 프로젝트 | 모두 집계/확정/예외/MG 또는 정산마감 family이나 계약 유형이 강하게 다름. |

## Hard To Find In Current Menu

| Process | Why It Is Hard To Find | Suggested Workshop Search Path |
|---|---|---|
| 공연장/팝업 판매 ~ 출고 ~ 매출전표 | 현재는 판매/주문출고 variant로 보일 수 있으나 사용자는 "공연" 또는 "팝업"으로 찾음. | 판매 > 현장판매 > 공연/팝업 |
| 이벤트 : 제/상품 | 이름이 너무 짧고 판매/주문/출고 의미가 드러나지 않음. | 판매 > 이벤트판매 > 현장수령/택배 |
| 구매 요청 ~ 매입전표 생성 : 인사/총무 | Runtime variantLabel이 비어 있어 메뉴에서 full title에 의존. | 구매 > 구매요청 > 인사/총무 |
| 수익배분 매출 정산 | 위탁/로열티 source에서 파생되어 기존 정산 메뉴만으로는 구분이 약함. | 정산 > 수익배분정산 > 매출/비용 |
| 저장위치 등록 | 기준정보 process라 워크숍 main flow에서 빠질 수 있음. | 기준정보 > 저장위치 > 기준정보 |

## Rename Candidates

| Current Process | Workshop-Friendly Name Candidate | Reason |
|---|---|---|
| 이벤트 : 제/상품 | 이벤트 판매/출고 | 현재 이름만으로 주문/출고/매출 흐름을 알기 어려움. |
| 공연장/팝업 판매 ~ 출고 ~ 매출전표 : 제/상품 | 공연/팝업 현장판매 | 사용자는 "공연 판매" 또는 "팝업 판매"로 찾을 가능성이 높음. |
| 매장 판매 ~ 출고 ~ 매출전표 : 제/상품 | 매장/POS 판매 | EasyChain/POS 맥락을 검색어로 노출해야 함. |
| 구매 요청 ~ 매입전표 생성 : 연구개발비/F&B/물류센터소모품 | F&B/소모품 구매 | 워크숍용 메뉴에서는 긴 비용 항목 나열보다 찾기 쉬운 축약명이 필요. |
| 주문 등록 ~ 매출전표 생성 : 서비스 | 비수불 서비스 매출 | 출고 없는 판매라는 차이를 명확히 표현. |

## Duplicate Or Overlapping Processes

| Candidate Overlap | Processes | Recommended Handling |
|---|---|---|
| 주문관리 variants | B2B 국내, B2B 해외, B2C, 예약판매 | 통합 family로 두고 Level3에서 판매채널/거래유형으로 구분. |
| 현장판매 and 주문관리 | 공연/팝업, 매장/POS | 워크숍 검색성 우선으로 Level2 현장판매를 제안하되, Process Family는 판매 family로 연결. |
| 구매요청 variants | 서비스, F&B, IT/S/W, 인사/총무 | 상품유형이 아니라 서비스/지출유형 차이로 구분. |
| 재고이동 variants | 매장 간 재고이동, 일반 재고이동 | 같은 Level2 `재고이동`, Level3 `매장간`/`일반`. |
| 반품 variants | B2B 반품, B2C 반품, 구매반품 | 판매반품과 구매반품은 워크숍에서 분리하는 편이 직관적. |

## Processes To Split Or Keep Separate

| Keep Separate | Reason |
|---|---|
| 서비스매출 vs 주문관리 | 수불 여부가 다르고 서비스매출은 출고 단계가 없음. |
| 현장판매 vs 일반 주문관리 | 사용자의 검색어가 "공연", "팝업", "매장"에 가깝고 재고이동/POS 운영이 섞임. |
| 구매반품 vs 판매반품 | 업무 주체와 문서/송장 흐름이 다름. |
| 로열티정산 / 위탁정산 / 수익배분정산 / 프로젝트정산 | 정산이라는 큰 family는 같지만 계약 유형과 계산 규칙이 다름. |

## Workshop Confirmation List

| Topic | Question |
|---|---|
| 공연/팝업 | 사용자는 이 프로세스를 "주문관리"에서 찾는가, "현장판매"에서 찾는가? |
| 공연/팝업 핵심 조건 | 공연/팝업의 핵심 차이는 판매채널인가, 프로젝트/행사 운영인가? |
| 이벤트 | 이벤트는 판매 프로세스인가, 이벤트 운영 프로세스인가? |
| 수출 B2B | B2B 해외는 B2B 주문관리의 Level3인가, 별도 수출 업무로 올려야 하는가? |
| 서비스 구매 | 서비스/F&B/IT/SW/인사총무는 모두 같은 구매요청 family로 보아도 되는가? |
| F&B/IT/SW/인사총무 | 이 셋은 상품유형이 아니라 서비스/지출유형으로 보는 것이 맞는가? |
| 인사/총무 | 인사/총무는 서비스유형인가, 조직 특성인가? |
| 저장위치 | 워크숍 메뉴에서 기준정보를 Level1로 노출해야 하는가? |
| 수익배분 | 수익배분정산은 위탁정산/로열티정산과 별도 메뉴가 필요한가? |

## Product Type Does Not Split These Processes

| Area | Process Examples | Reason |
|---|---|---|
| 수불상품 판매 | B2B, B2C, 예약판매, 매장/POS, 공연/팝업 | MD/응원봉/앨범 같은 상품유형이 아니라 판매채널/거래유형/행사성이 프로세스 탐색 기준. |
| 수불상품 구매 | 구매 요청 ~ 입고 ~ 매입전표 : 제/상품 | 상품/제상품 구분보다 구매요청-입고-매입전표 흐름이 중요. |
| 정산 | 로열티, 위탁, 수익배분 | 상품유형보다 계약/정산 거래유형이 핵심. |
| 기타 입출고/재고이동 | 기타입고, 기타출고, 재고이동 | 상품유형보다 입출고/이동 거래유형이 핵심. |

## Key Conclusion

상품유형은 이번 index에서 단독 분리 기준으로 쓰지 않았다. 실제 메뉴 탐색을 가르는 기준은 주로 거래유형, 판매채널, 서비스유형, 수불 여부였다. 따라서 워크숍용 Navigator 메뉴는 `상품/MD/응원봉/앨범` 같은 item category보다 `구매요청`, `주문관리`, `현장판매`, `반품관리`, `재고이동`, `정산 유형` 중심으로 설계하는 편이 더 찾기 쉽다.

The next design step should not start from abstract hierarchy. It should start from the phrases participants will use in the room: "구매요청", "공연 판매", "예약판매", "서비스 구매", "위탁정산", "로열티정산", "재고이동".
