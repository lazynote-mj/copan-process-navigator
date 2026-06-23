# Detail Group 1 · 사업기회 확보 ~ 구매요청 : 제/상품

> **기준 PDF:** `Docs/scm to-be process.pdf` **p.17**  
> **Detail group:** `pg-business-to-purchase-request`  
> **Process id:** `business-to-purchase-request`  
> **검토일:** 2026-06-22

---

## 1. PDF p.17 요약

**제목:** 사업 기회 확보 ~ 구매 요청 PROCESS : 제/상품 (응원봉, MD 등)  
**스윔레인:** 사업부 (단일 lane)

### Zone

| PDF 영역 | 노드 |
|----------|------|
| 사업부 선택영역 | 사업기회확보, 사업참여검토 |
| 자동 프로세스 — 프로젝트 상태 확정 업데이트 및 생성 | 프로젝트등록(자동), WBS코드등록 |

### 메인 흐름 (번호 1~6)

| # | PDF 명칭 | 비고 |
|---|----------|------|
| 1 | 계약등록 | |
| 2 | 프로젝트등록 | 상태 : 미결 |
| 3 | 프로젝트실행품의입력 | |
| — | 프로젝트 실행품의 (G/W) | Y/N 분기 |
| 4 | 프로젝트등록 | 자동 — 상태 확정 |
| 5 | WBS코드등록 | 자동 |
| 6 | 구매요청 | 거래처, 상품, 수량, 단가, 저장위치 |

### 연결 프로세스 (보라 범례)

- 상품 등록 PROCESS → 구매요청 선행
- 거래처 등록 PROCESS → 구매요청 선행

### Decision 분기 (Y/N)

| 노드 | Y | N |
|------|---|---|
| 사업참여검토 | 계약등록 | 사업기회확보 (반려) |
| 사업계약품의 | 프로젝트등록 | 계약등록 (반려) |
| 프로젝트 실행품의 | 자동 프로젝트/WBS | 프로젝트실행품의입력 (반려) |

---

## 2. 검토 전 상태 (gap)

대부분 2026-06-22 초안이 PDF와 일치했으나 다음이 미세 조정 대상이었다.

| 항목 | PDF | 검토 전 | 상태 |
|------|-----|---------|------|
| 연결 프로세스 명칭 | `… PROCESS` 접미사 | `상품 등록`, `거래처 등록` | ✅ 수정 |
| 연결 프로세스 스타일 | 연결 프로세스 (보라) | `manual` 회색 | ✅ `overviewType: linked-process` |
| 연결 프로세스 배치 | 상품·구매요청 동행, 거래처 아래 | 3노드 동일 phase 가로 | ✅ 거래처 `phaseOrder: 10` |
| 사업계약품의 system | G/W | groupware | ✅ `G/W` 통일 |
| 프로젝트 미결 표기 | `상태 : 미결` | `상태: 미결` | ✅ 공백 통일 |

**참고:** 사용자 스크린샷의 `프로젝트목록`, `사업계획확정` 등은 PDF p.2 및 현재 데이터에 없음 (다른 화면/구버전 추정).

---

## 3. 검토 후 노드 매핑

| node id | PDF 명칭 | type | lane | phaseOrder | stepBadge |
|---------|----------|------|------|------------|-----------|
| `opportunity` | 사업기회확보 | manual | business | 1 | — |
| `business-review` | 사업참여검토 | decision | business | 2 | — |
| `contract-register` | 계약등록 | erp | business | 3 | 1 |
| `contract-approval` | 사업계약품의 | decision | business | 4 | — |
| `project-register` | 프로젝트등록 | erp | business | 5 | 2 |
| `project-execution-input` | 프로젝트실행품의입력 | erp | business | 6 | 3 |
| `project-execution-approval` | 프로젝트 실행품의 (G/W) | decision | business | 7 | — |
| `project-status-update` | 프로젝트등록 (자동) | system | business | 8 | 4 |
| `wbs-code-register` | WBS코드등록 | system | business | 8 | 5 |
| `ref-product-register-process` | 상품 등록 PROCESS | manual + linked | business | 9 | — |
| `purchase-request` | 구매요청 | erp | business | 9 | 6 |
| `ref-vendor-register-process` | 거래처 등록 PROCESS | manual + linked | business | 10 | — |

`phaseOrder`는 Detail 세로 레이아웃용. PDF ERP 단계 번호 1~6은 `stepBadge`로만 원형 뱃지 표시 (선택영역·품의 분기·연결 프로세스는 뱃지 없음).

---

## 4. Edge (변경 없음 — PDF 일치 확인)

- 메인 체인: opportunity → … → wbs → purchase-request
- 반려: business-review N→opportunity, contract-approval N→contract-register, project-execution-approval N→project-execution-input
- 참조: ref-product / ref-vendor → purchase-request (`type: reference`)

---

## 5. 변경 파일

| 파일 | 변경 |
|------|------|
| `src/data/processes/business-to-purchase-request.json` | PDF p.17 전체 노드·엣지·zone, stepBadge 1~6 |
| `src/types/process.ts` | `stepBadge` 필드 |
| `src/lib/buildProcessFlowNode.ts` | Detail `overviewType` 보라 스타일, stepBadge 전달 |
| `src/data/activeProcessData.ts` | registry 이름·stepBadge 불일치 시 자동 동기화 |
| `src/data/processDataStore.tsx` | 로드 시 `syncDetailProcessesFromRegistry` 재적용 |
| `public/process-data/state.json` | sync 스크립트 반영 |
| `scripts/generate-scm-detail-processes.mjs` | canonical JSON 직접 참조 (legacy merge 제거) |
| `Docs/detail-group1-product-purchase-review.md` | 본 문서 |

---

## 6. 미결 / 사용자 확인

1. **연결 프로세스 클릭:** 상품/거래처 등록은 별도 Detail 프로세스 없음 — 외부 PROCESS 참조만 표현.
2. **Overview 허브:** `purchase-request`의 `detailProcessIds`에 `business-to-purchase-request` 포함 여부는 Overview 범위 (현재 registry는 `business-to-project` 등 legacy 포함).
3. **저장된 dirty 상태:** 이전에 잘못 저장한 노드명(예: 사업성사전검토)이 있으면 **새로고침** 시 registry와 불일치하면 자동 복원됨. 이미 저장된 state.json은 sync 스크립트로 덮어씀.

---

## 7. 검증

```bash
node scripts/sync-detail-processes-to-state.mjs
npm run build
```
