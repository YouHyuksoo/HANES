---
menuCode: MAT_ARRIVAL
audience: operator
title: Arrival Management — Operator Guide
summary: Arrival management DB structure (MAT_ARRIVALS, MAT_LOTS, MAT_ARRIVAL_STOCKS, PURCHASE_ORDER_ITEMS), PO line arrival logic, reversal cancellation, IQC linkage, multi-tenancy scope
tags: [material, arrival, operations, DB, LOT, IQC, reversal]
keywords: [MAT_ARRIVALS, MAT_LOTS, MAT_ARRIVAL_STOCKS, MAT_ARRIVAL_TRANSACTIONS, PURCHASE_ORDERS, PURCHASE_ORDER_ITEMS, ARRIVAL_NO, MAT_UID, IQC_STATUS, LINE_STATUS, ARRIVAL_TYPE, MFG_PARTNER_CODE, reversal, multi-tenancy, COMPANY, PLANT_CD, arrival cancel, LOT generation, serial]
related: [PUR_PO, QC_IQC, MAT_ARRIVAL_RESULT, MAT_ARRIVAL_TRANSACTION, INV_ARRIVAL_STOCK]
---

# Arrival Management — Operator Guide

## System Purpose & Role
This screen registers supplier-delivered materials **by purchase order (PO) line** and generates material LOT (`MAT_LOTS`) serials. At arrival time, three tables are created simultaneously: `MAT_ARRIVALS` (transaction history) + `MAT_LOTS` (LOT tracking) + `MAT_ARRIVAL_STOCKS` (arrival waiting stock). Receiving (raw material current stock `MAT_STOCKS` update) is handled separately after IQC approval.

## Data Structure
```
PURCHASE_ORDERS (PK: PO_NO)
  └─ PURCHASE_ORDER_ITEMS (PK: PO_ID + SEQ)
       │   LINE_STATUS: OPEN → PARTIAL → CLOSE
       │   RECEIVED_QTY cumulative update
       ↓ Arrival registration
MAT_ARRIVALS (PK: ARRIVAL_NO + SEQ)
  ├─ MAT_LOTS (PK: MAT_UID)   ← LOT tracking·IQC
  │     IQC_STATUS: PENDING → PASS/FAIL/HOLD
  └─ MAT_ARRIVAL_STOCKS (PK: COMPANY + PLANT_CD + MAT_UID)
         STATUS: AVAILABLE   ← Arrival stock awaiting IQC

MAT_ARRIVAL_TRANSACTIONS (PK: TRANS_NO)
       ← Arrival·cancel ledger (ARRIVAL_IN / ARRIVAL_CANCEL)
```

---

## ① PO Line — PURCHASE_ORDERS / PURCHASE_ORDER_ITEMS

| Screen Field | DB Column | Role / Meaning · Operational Notes |
|------|------|------|
| PO Number | `PURCHASE_ORDERS.PO_NO` | PK. Arrival availability condition: `STATUS IN ('CONFIRMED', 'PARTIAL')`. |
| Vendor | `PURCHASE_ORDERS.PARTNER_ID / PARTNER_NAME` | Supplier. Copied to `MAT_ARRIVALS.VENDOR_ID/VENDOR_NAME`. |
| Order Date | `PURCHASE_ORDERS.ORDER_DATE` | DATE type. |
| Due Date | `PURCHASE_ORDERS.DUE_DATE` | DATE type. Not currently displayed on screen. |
| Usage Type | `PURCHASE_ORDERS.USE_TYPE` | Common code `PO_USE_TYPE` (e.g., PROD). Displayed in grid. |
| Line No. | `PURCHASE_ORDER_ITEMS.LINE_NO` | Line number within PO (L/N). |
| Rev No. | `PURCHASE_ORDER_ITEMS.REV_NO` | Line revision number (R/N). Default 1. |
| Item Code | `PURCHASE_ORDER_ITEMS.ITEM_CODE` | References `ITEM_MASTERS.ITEM_CODE`. |
| Order Qty | `PURCHASE_ORDER_ITEMS.ORDER_QTY` | INT. |
| Cumulative Arrival | `PURCHASE_ORDER_ITEMS.RECEIVED_QTY` | Increments on each arrival registration. Remaining = ORDER_QTY − RECEIVED_QTY. |
| Line Status | `PURCHASE_ORDER_ITEMS.LINE_STATUS` | `OPEN`(no arrivals) / `PARTIAL`(partial arrival) / `CLOSE`(complete). Automatically recalculated server-side. |

---

## ② Arrival Header — MAT_ARRIVALS

| Screen Field | DB Column | Role / Meaning · Operational Notes |
|------|------|------|
| Arrival No. | `ARRIVAL_NO` | PK (composite). Generated via Oracle Sequence `ARRIVAL`. Multiple items in the same batch share the same `ARRIVAL_NO`. |
| SEQ | `SEQ` | PK (composite). Sequence number within the same `ARRIVAL_NO`. Starts at 1. |
| PO No. | `PO_NO` | Linked PO number. NULL for manual arrivals. |
| PO ID | `PO_ID` | References `PURCHASE_ORDERS.PO_NO`. |
| PO Item ID | `PO_ITEM_ID` | References `PURCHASE_ORDER_ITEMS.SEQ`. |
| Invoice No. | `INVOICE_NO` | Supplier invoice number (transaction tracking). Currently no input UI in PO arrival modal (manual arrival only). |
| Vendor ID | `VENDOR_ID` | Copied from PO's `PARTNER_ID`. |
| Vendor Name | `VENDOR_NAME` | Copied from PO's `PARTNER_NAME`. |
| Supplier UID | `SUP_UID` | Material serial assigned by supplier (optional). |
| Item Code | `ITEM_CODE` | References `ITEM_MASTERS.ITEM_CODE`. |
| Arrival Qty | `QTY` | INT. Quantity registered in this arrival. |
| Warehouse Code | `WAREHOUSE_CODE` | Staging warehouse for arrival. |
| Arrival Date | `ARRIVAL_DATE` | TIMESTAMP. Stored based on user-entered arrival date. |
| Arrival Type | `ARRIVAL_TYPE` | `PO`(PO-based) / `MANUAL`(manual). |
| Worker | `WORKER_ID` | Registering user ID. |
| IQC Status | `IQC_STATUS` | Set to `PENDING` immediately after arrival. Updated based on inspection results. |
| Status | `STATUS` | `DONE` / `CANCELED`. Reversed on cancellation. |
| Remark | `REMARK` | Notes. |
| Multi-tenancy | `COMPANY`, `PLANT_CD` | `'40'` / `'1000'` scope. |

---

## ③ Material LOT — MAT_LOTS

| Screen Field | DB Column | Role / Meaning · Operational Notes |
|------|------|------|
| Material UID | `MAT_UID` | PK. Oracle Sequence `VH1-RM...` format generation. Unique LOT identifier (label barcode). |
| Item Code | `ITEM_CODE` | References `ITEM_MASTERS.ITEM_CODE`. |
| Initial Qty | `INIT_QTY` | Original quantity issued at arrival. Immutable value. Does not change even with stock transactions. |
| Current Qty | `CURRENT_QTY` | Current remaining quantity. Decreases on issue. Same as INIT_QTY for new LOTs. |
| Receive Date | `RECV_DATE` | Date at arrival registration (TIMESTAMP). |
| Manufacture Date | `MANUFACTURE_DATE` | Material manufacturing date (optional). Can be entered in manual arrival. |
| Expiry Date | `EXPIRE_DATE` | Expiration date. Currently not auto-calculated (NULL). |
| Arrival No. | `ARRIVAL_NO` | References `MAT_ARRIVALS.ARRIVAL_NO`. Used for LOT trace-back. |
| Arrival SEQ | `ARRIVAL_SEQ` | Links to `MAT_ARRIVALS.SEQ`. |
| Origin | `ORIGIN` | Used for LOT split/merge tracking. Initially set to the same value as `MAT_UID`. |
| Vendor | `VENDOR` | PO's `PARTNER_ID`. |
| Manufacturer Code | `MFG_PARTNER_CODE` | Actual manufacturer (`PARTNER_MASTERS` MFG type). Required selection in arrival modal. Used for label printing. |
| Invoice No. | `INVOICE_NO` | Transaction tracking. |
| PO No. | `PO_NO` | Linked PO number. |
| IQC Status | `IQC_STATUS` | `PENDING`(awaiting inspection) / `PASS` / `FAIL` / `HOLD`. Updated in the IQC screen. |
| Special Accept YN | `SPECIAL_ACCEPT_YN` | `Y`=special acceptance of rejected material as good. Default `N`. |
| LOT Status | `STATUS` | `NORMAL`(normal) / `HOLD`(on hold) / `DEPLETED`(depleted) / `SPLIT`(split) / `MERGED`(merged). |
| Multi-tenancy | `COMPANY`, `PLANT_CD` | `'40'` / `'1000'` scope. |

---

## ④ Arrival Stock — MAT_ARRIVAL_STOCKS

Stock awaiting IQC approval. After approval, it moves to `MAT_STOCKS` (raw material current stock).

| Screen Field | DB Column | Role / Meaning · Operational Notes |
|------|------|------|
| Material UID | `MAT_UID` | PK (composite). LOT-level stock row. |
| Arrival No. | `ARRIVAL_NO` | Linked arrival number. |
| Arrival SEQ | `ARRIVAL_SEQ` | Linked arrival sequence. |
| Warehouse Code | `WAREHOUSE_CODE` | Staging warehouse. |
| Item Code | `ITEM_CODE` | Material item code. |
| Qty | `QTY` | Total held quantity. |
| Available Qty | `AVAILABLE_QTY` | Quantity available for issue. 0 on IQC HOLD. |
| Status | `STATUS` | `AVAILABLE`(available) / `HOLD`(IQC hold etc.). |
| Multi-tenancy | `COMPANY`, `PLANT_CD` | PK (composite). |

---

## ⑤ Arrival Ledger — MAT_ARRIVAL_TRANSACTIONS

| DB Column | Role / Meaning · Operational Notes |
|------|------|
| `TRANS_NO` | PK. Transaction number. |
| `TRANS_TYPE` | `ARRIVAL_IN`(arrival) / `ARRIVAL_CANCEL`(cancel reversal). |
| `TRANS_DATE` | Transaction timestamp (TIMESTAMP). |
| `ARRIVAL_NO` | Linked arrival number. |
| `ARRIVAL_SEQ` | Linked arrival sequence. |
| `WAREHOUSE_CODE` | Warehouse. |
| `ITEM_CODE` | Item code. |
| `MAT_UID` | LOT serial. |
| `QTY` | Quantity (negative for cancellation). |
| `UNIT_PRICE` | Unit price (DECIMAL 12,4). |
| `TOTAL_AMOUNT` | Amount (DECIMAL 14,2). |
| `REF_TYPE` | Reference type (cancel linkage etc.). |
| `REF_ID` | Reference ID. |
| `CANCEL_REF_ID` | Original transaction ID for reversal. |
| `WORKER_ID` | Processing user. |
| `STATUS` | `DONE` / `CANCELED`. |
| `COMPANY`, `PLANT_CD` | Multi-tenancy scope. |

---

## Arrival Registration Logic (PO-Based)

1. Validate `PURCHASE_ORDERS.STATUS IN ('CONFIRMED', 'PARTIAL')`.
2. Validate no excess over remaining quantity (= `ORDER_QTY - RECEIVED_QTY`).
3. Generate `ARRIVAL_NO` via Oracle Sequence (`ARRIVAL` generation key).
4. Generate `MAT_UID` (material serial) via Oracle Sequence (`VH1-RM...` format).
5. Create `MAT_ARRIVALS` record (`IQC_STATUS = 'PENDING'`, `STATUS = 'DONE'`).
6. Create `MAT_LOTS` record (`INIT_QTY = CURRENT_QTY = arrival qty`, `IQC_STATUS = 'PENDING'`).
7. Create `MAT_ARRIVAL_STOCKS` record (`STATUS = 'AVAILABLE'`).
8. Create `MAT_ARRIVAL_TRANSACTIONS` record (`TRANS_TYPE = 'ARRIVAL_IN'`).
9. Increment `PURCHASE_ORDER_ITEMS.RECEIVED_QTY`.
10. Recalculate `PURCHASE_ORDER_ITEMS.LINE_STATUS` (OPEN → PARTIAL → CLOSE).
11. Recalculate `PURCHASE_ORDERS.STATUS` (CONFIRMED → PARTIAL → CLOSED).

> Raw material current stock (`MAT_STOCKS`) **only increases at receiving time after IQC approval**. In the arrival stage, stock is only accumulated in `MAT_ARRIVAL_STOCKS`.

## Arrival Cancel Logic (Reversal)

- API: `POST /material/arrivals/cancel` (`transactionId`, `reason`)
- Not deletion but reversal: original `MAT_ARRIVAL_TRANSACTIONS.STATUS = 'CANCELED'`, new `ARRIVAL_CANCEL` transaction with opposite quantity.
- `MAT_ARRIVALS.STATUS = 'CANCELED'`, `MAT_ARRIVAL_STOCKS` stock deducted.
- Cancel reason is required. Only possible when original transaction is `DONE` + `ARRIVAL_IN`.

---

## API Routes

| Purpose | Route |
|------|------|
| PO line list | `GET /material/arrivals/po-lines` |
| PO line arrival register | `POST /material/arrivals/po-line` |
| Manual arrival register | `POST /material/arrivals/manual` |
| Arrival cancel | `POST /material/arrivals/cancel` |

---

## Prerequisites (Master·Common Code)

- PO must be in `CONFIRMED` status or above to appear in the arrival list.
- Item Master (`ITEM_MASTERS`) must have `LOT_UNIT_QTY` (serial composition unit) set — if unset, the entire arrival quantity is issued as 1 LOT.
- Raw material warehouse (`WAREHOUSES`, `WAREHOUSE_TYPE = 'RAW'`) must be pre-registered.
- Manufacturer (`PARTNER_MASTERS`, `PARTNER_TYPE = 'MFG'`) must be pre-registered.
- Common codes: `PO_LINE_STATUS`(OPEN/PARTIAL/CLOSE), `PO_USE_TYPE`, `PO_STATUS`.
- `mat_lot` category label templates recommended for label output (`/master/label-templates`).

---

## Permissions

| Role | Permitted Operations |
|------|------|
| General users | PO line lookup, PO-based arrival registration, label output |
| Logistics/Material staff | Above + manual arrival |
| Operators/Administrators | Above + arrival cancel (reversal) |

---

## Troubleshooting

| Symptom | Cause | Action |
|------|------|------|
| PO line not showing in list | `PURCHASE_ORDERS.STATUS` is `DRAFT` or `CLOSED` | Confirm the PO in PO management or check status |
| Arrival button disabled | `LINE_STATUS = 'CLOSE'` or `REMAINING_QTY <= 0` | Check remaining quantity. Modify PO quantity if needed |
| Arrival qty exceeds remaining | `receivedQty > remainingQty` | Verify input is within remaining quantity |
| More serials than expected | `LOT_UNIT_QTY` set too small | Adjust `LOT_UNIT_QTY` in Item Master |
| Label not printing | Print Agent not running or port connection error | Check local Print Agent status |
| IQC pending status not changing | Inspection not registered in IQC screen | Proceed with LOT inspection in IQC screen |
| Arrival cancel button not visible | Transaction status is `CANCELED` or type is `ARRIVAL_CANCEL` | Already cancelled. Need to find original transaction |
| No change in `MAT_STOCKS` after arrival | Normal behavior. Receiving occurs separately after IQC approval | Check IQC pending quantity in [Arrival Stock] screen |

---

## Data & Integration

| Item | Details |
|------|------|
| Main tables | `MAT_ARRIVALS`, `MAT_LOTS`, `MAT_ARRIVAL_STOCKS`, `MAT_ARRIVAL_TRANSACTIONS`, `PURCHASE_ORDERS`, `PURCHASE_ORDER_ITEMS` |
| Reference masters | `ITEM_MASTERS`, `PARTNER_MASTERS`, `WAREHOUSES` |
| Related screens | PO Management (PO status), IQC (inspection results), Arrival Result (history·cancel), Arrival Stock (pending stock) |
| Multi-tenancy scope | `COMPANY = '40'`, `PLANT_CD = '1000'` — common filter on all queries and saves |
