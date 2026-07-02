# Zone 2 · 구매·발주 PDF 대조 결과

> **기준:** `Docs/06. TO-BE overview.pdf` (시각) + `src/data/toBeOverview/overview.json` · `e2e-main-flow.json` (설계 원본)  
> **현재 앱:** `public/process-data/state.json` → `to-be-overview`  
> **검토일:** 2026-06-19

---

## 1. PDF/설계상 흐름 (E2E Main Flow)

```
구매요청
  └─► 기준정보 확인 (split ○)
         ├─► 품목확인 ── 신규 ──► 품목등록요청 ──► 품목등록승인 ──┐
         │              └─ 기존 ─────────────────────────────────┤
         └─► 거래처확인 ─ 신규 ──► 거래처등록요청 ──► 거래처등록승인 ┤
                        └─ 기존 ─────────────────────────────────┤
                                                                   ▼
                                                          기준정보 완료 (merge ○)
                                                                   ▼
                                                          계약/발주등록 ──► 발주품의
```

**Zone 박스 (설계):** `기준정보 확인 / 신규 신청` — 8개 노드 포함

---

## 2. 노드 대조표

| PDF/설계 id | PDF 명칭 | 설계 lane | state.json | 상태 | 조치 |
|-------------|----------|-----------|------------|------|------|
| `purchase-request` | 구매요청 | 사업부 | ✅ 동일 id · 사업부 | 🟡 | slot 5→6 차이만 |
| `master-data-split` | 기준정보 확인 (split) | 상생협력팀 | ❌ **없음** | 🔴 | **추가** (connector) |
| `product-check` | 품목확인 | 상생협력팀 | ❌ **없음** | 🔴 | **추가** (decision) |
| `vendor-check` | **거래처확인** | 상생협력팀 | ⚠ `거래처/품목 확인` · **사업부** | 🔴 | **분리·lane 수정** |
| `product-register-request` | 품목등록요청 | 상생협력팀 | ⚠ `node-mqhm27ka-y41py` · 사업부 | 🔴 | **id 통합·lane 수정** |
| `product-register-approval` | 품목등록승인 | 상생협력팀 | ⚠ `node-mqhm3415-s0x6r` | 🔴 | **id 통합** |
| `vendor-register` | 거래처등록요청 | 상생협력팀 | ⚠ id OK · **사업부** | 🟡 | lane → partnership |
| `vendor-register-approval` | 거래처등록승인 | 상생협력팀 | ⚠ `node-mqhltm4t-el6dq` · **재무팀** | 🔴 | **id·lane 수정** |
| `master-data-complete` | 기준정보 완료 (merge) | 상생협력팀 | ❌ **없음** | 🔴 | **추가** (connector) |
| `purchase-order` | 계약/발주등록 | 상생협력팀 | ✅ | 🟢 | phaseOrder 12 vs 11 |
| `po-approval` | 발주품의 | 상생협력팀 | ✅ | 🟢 | phaseOrder 13 vs 10 |
| — | — | — | ⚠ `node-mqk4l3ai-882sn` 위탁여부체크 | 🔴 | **구매·발주 zone 부적합** · 별도 배치 |

**요약:** 설계 11노드 중 **정상 2 · 부분일치 3 · 누락 3 · 잘못된 id 3 · extraneous 1**

---

## 3. Edge 대조 (기준정보 구간)

### 설계 (`e2e-main-flow.json`)

| edge | source → target | label |
|------|-----------------|-------|
| main:e2e:06b | purchase-request → master-data-split | |
| main:e2e:07 | master-data-split → product-check | |
| main:e2e:07b | master-data-split → vendor-check | |
| main:e2e:08 | product-check → master-data-complete | 기존 |
| main:e2e:08a | product-check → product-register-request | 신규 |
| main:e2e:08c | product-register-request → product-register-approval | |
| main:e2e:08d | product-register-approval → master-data-complete | |
| main:e2e:09 | vendor-check → master-data-complete | 기존 |
| main:e2e:09b | vendor-check → vendor-register | 신규 |
| main:e2e:09c | vendor-register → vendor-register-approval | |
| main:e2e:09d | vendor-register-approval → master-data-complete | |
| main:e2e:10 | master-data-complete → purchase-order | |

### state.json (현재 — 문제 구간)

| edge | source → target | 문제 |
|------|-----------------|------|
| main:e2e:06 | project-approval → purchase-request | ✅ |
| edge-mqkf… | purchase-request → **위탁여부체크** | 🔴 설계에 없음 |
| edge-mqjb3v8p | vendor-check → node-mqhm27ka (품목등록) | 🟡 vendor-check에 품목 분기 혼재 |
| main:e2e:08 | vendor-check → vendor-register | 🟡 source가 merged node |
| edge-mqhfu68e | vendor-check → 위탁여부체크 | 🔴 설계에 없음 |
| edge-mqhmwsvf | node-mqhm27ka → node-mqhm3415 | 🟡 id 비표준 |
| edge-mqjb32xq | vendor-register → node-mqhltm4t (승인) | 🟡 id·lane |
| main:e2e:09 | purchase-order → po-approval | 🟡 방향·condition 상이 |

**누락 edge:** main:e2e:06b, 07, 07b, 08(품목), 08a, 08c, 08d, 09(기존), 09c, 09d, **10**

---

## 4. Zone 박스 (장식)

| | 설계 | state.json |
|---|------|------------|
| id | `zone-master-data-check` | `zone-mqi2txz2-2t3l6` |
| name | 기준정보 확인 / 신규 신청 | 기준정보 확인 |
| nodeIds | **8개** (split~merge 전체) | **1개** (vendor-check만) |

---

## 5. 권장 수정 순서 (코드 변경 없음)

### Step A — 노드 정리 (id·lane·name)

1. `vendor-check` → name **거래처확인**, lane **partnership**
2. **추가:** `master-data-split`, `product-check`, `master-data-complete`
3. **rename/merge:**
   - `node-mqhm27ka-y41py` → `product-register-request`
   - `node-mqhm3415-s0x6r` → `product-register-approval`
   - `node-mqhltm4t-el6dq` → `vendor-register-approval`
4. `vendor-register` lane → **partnership**
5. `node-mqk4l3ai-882sn` (위탁여부체크) → zone 밖으로 이동 또는 별도 phase

### Step B — Edge 재연결 (e2e-main-flow 기준)

- `purchase-request` → `master-data-split` → (품목/거래처 parallel)
- 신규/기존 분기 → `master-data-complete` → `purchase-order`
- 위탁여부체크 관련 edge **제거 후** 올바른 위치에 재배치

### Step C — Zone membership

- `zone-mqi2txz2-2t3l6` nodeIds를 설계 8개로 확장

### Step D — 검증

- [ ] decision 노드 outgoing ≥ 2
- [ ] orphan edge 없음
- [ ] 캔버스 collision 점검
- [ ] **전체 저장**

---

## 6. 영향 범위

| | 영향 |
|---|------|
| React/layout/router 코드 | **없음** |
| state.json | **큼** (노드 3추가 · 3rename · edge ~15수정) |
| detail 프로세스 | `purchase-request` 허브 — **유지** |
| routing | left-bracket 등 **재계산** 필요 |

---

## 7. 진행 체크

| ☐ | 항목 |
|---|------|
| ☐ | Step A 노드 정리 | ✅ 2026-06-19 |
| ☐ | Step B edge 재연결 | ✅ 2026-06-19 |
| ☐ | Step C zone 박스 | ✅ 2026-06-19 |
| ☐ | Step D 검증·저장 | 🟡 앱에서 collision 확인 후 저장 |

| 날짜 | 작업 | 메모 |
|------|------|------|
| 2026-06-19 | Step A–C 적용 | `scripts/migrate-zone2-purchase-order.mjs` → state.json |
