# SCM TO-BE Swimlane Audit

Source: `Docs/06_Data/Samples/scm to-be process.pdf`

Scope: current app data in `public/process-data/state.json`.

Manual correction exception:
- Process 01-04 have already been manually refined in detail and must not be changed by this swimlane audit.
- Excluded process IDs:
  - `business-to-purchase-request`
  - `purchase-to-ap-invoice`
  - `consignment-purchase-receipt`
  - `b2b-domestic-order-to-sales`

Rule used for this audit:
- PDF page 2-22 map to the 21 SCM detail process groups.
- A node's expected lane is inferred from the PDF swimlane band in which the node label appears.
- This is a visual/PDF fidelity check, not an owner-department semantic check.

Lane IDs:
- `business`: 사업부 / ERP
- `partnership`: 상생협력팀 / ERP
- `warehouse-easyadmin`: 물류센터 / 이지어드민
- `retail-easychain`: 판매현장 / 이지체인
- `finance`: 재무팀 / ERP

## Summary

The current saved state has PDF-lane mismatch candidates in 17 process groups, 94 nodes total.

Correction attempt on 2026-06-23:
- 91 PDF-coordinate-based swimlane corrections were tested for process groups 05-21.
- The correction was reverted immediately because it collapsed several process groups into the `business` lane and removed needed operational swimlanes from the detail view.
- Process 01-04 remained excluded from this attempt.
- Treat the candidates below as audit references only; do not bulk-apply them without manual lane-by-lane review.

High caution:
- Several settlement and service PDFs visually place ERP/finance-like work in the `사업부 / ERP` swimlane. Applying this audit strictly would move many `finance` nodes to `business`.
- Therefore, bulk modification should be done only after confirming that the Process Detail screen must follow the PDF visual swimlane exactly.

## Mismatch Candidates By Process

| Process | Candidate Count | Main Pattern |
| --- | ---: | --- |
| `b2b-domestic-order-to-sales` | 3 | consignment stock/info nodes differ from PDF lane |
| `b2b-domestic-return` | 6 | return request/consignment/finance close nodes differ |
| `b2b-export-order-to-sales` | 4 | export shipment and finance approval nodes differ |
| `b2c-order-to-sales` | 2 | B2C order intake nodes differ |
| `preorder-to-sales` | 11 | PG/order/shipment/finance nodes differ |
| `b2c-return` | 4 | return request and finance close nodes differ |
| `popup-concert-stock-sales-sync` | 7 | POS/order/shipment/finance nodes differ |
| `store-sales` | 9 | store/POS/shipment/finance nodes differ |
| `stock-transfer` | 5 | store transfer nodes differ |
| `other-issue` | 5 | outbound/status nodes differ |
| `royalty-mg-settlement` | 7 | finance nodes visually appear in business lane in PDF |
| `consignment-settlement` | 5 | finance nodes visually appear in business lane in PDF |
| `revenue-share-settlement` | 7 | finance nodes visually appear in business lane in PDF |
| `service-business-to-expense` | 1 | voucher node differs |
| `service-purchase-to-ap` | 7 | procurement/inbound/finance nodes differ |
| `service-order-to-sales` | 4 | shipment/sales close nodes differ |
| `service-project-settlement` | 7 | finance nodes visually appear in business lane in PDF |

## Recommended Correction Order

1. Correct obvious product/order/shipment groups first, excluding process 01-04:
   - `b2b-domestic-return`
   - `b2b-export-order-to-sales`
   - `b2c-order-to-sales`
   - `preorder-to-sales`
   - `b2c-return`

2. Correct retail/stock/outbound groups next:
   - `popup-concert-stock-sales-sync`
   - `store-sales`
   - `stock-transfer`
   - `other-issue`

3. Review settlement/service groups before bulk applying:
   - `royalty-mg-settlement`
   - `consignment-settlement`
   - `revenue-share-settlement`
   - `service-business-to-expense`
   - `service-purchase-to-ap`
   - `service-order-to-sales`
   - `service-project-settlement`
