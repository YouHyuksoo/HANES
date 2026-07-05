---
menuCode: MAT_LOT_MERGE
audience: operator
title: Material Lot Merge — Operator Guide
summary: Material LOT merge DB structure (MAT_LOTS, MAT_STOCKS, STOCK_TRANSACTIONS), merge logic (original disposal and new serial generation), gating conditions, API, multi-tenancy scope
tags: [material, LOT, merge, operations, DB, serial, stock transaction]
keywords: [lot merge, LOT merge, material merge, MAT_LOTS, MAT_STOCKS, STOCK_TRANSACTIONS, MAT_UID, INIT_QTY, CURRENT_QTY, ARRIVAL_NO, ORIGIN, STATUS, MERGED, LOT_MERGE_IN, LOT_MERGE_OUT, receive complete gating, generation, SEQ_MAT_SERIAL_DAILY, STOCK_TX, multi-tenancy, COMPANY, PLANT_CD, lot-split]
related: [MAT_LOT_SPLIT, MAT_ARRIVAL, QC_IQC]
---

# Material Lot Merge — Operator Guide

## System Purpose & Role
This screen merges multiple material LOTs (`MAT_LOTS`) of the **same item and same arrival** into **one new integrated serial**. On merge, all original LOTs are disposed of (`STATUS='MERGED'`, stock 0), and **1 new `MAT_UID`** with the combined quantity is generated. Stock (`MAT_STOCKS`) and the stock transaction ledger (`STOCK_TRANSACTIONS`) are updated transactionally with consistency. This is the symmetric counterpart to material split (LOT split), and re-processing (merging split results, splitting merged results) is supported.

Design basis: `docs/specs/2026-06-08-lot-split-merge-redesign-design.md`.

## Data Structure
```
MAT_LOTS (PK: MAT_UID)                      ← LOT tracking·status
  STATUS: NORMAL → MERGED (original disposal)
  ORIGIN: original serial inheritance for split/merge tracking
       │
       ├─ MAT_STOCKS (PK: COMPANY+PLANT_CD+WAREHOUSE_CODE+ITEM_CODE+MAT_UID)
       │     QTY / AVAILABLE_QTY / RESERVED_QTY  ← current stock (merge basis quantity)
       │
       └─ STOCK_TRANSACTIONS (PK: TRANS_NO)      ← stock transaction ledger
             TRANS_TYPE: LOT_MERGE_OUT(original issue) / LOT_MERGE_IN(new receipt)
             REF_TYPE='LOT_MERGE', REF_ID=ORIGIN

Validation reference: MAT_ISSUE(issue history), PART_MASTER(item), PARTNER_MASTER(vendor)
```

> The basis for mergeable quantity is `MAT_STOCKS.QTY` (current stock). It sums the actual current stock, not `MAT_LOTS.CURRENT_QTY`.

---

## ① Mergeable LOT List — MAT_LOTS + MAT_STOCKS (Grid)

| Screen Field | DB Column | Role / Meaning · Operational Notes |
|------|------|------|
| Material Serial | `MAT_LOTS.MAT_UID` | PK. Merge target identification key (label barcode). |
| Item Code | `MAT_LOTS.ITEM_CODE` | References `PART_MASTER.ITEM_CODE`. Merge only allowed for same `ITEM_CODE`. |
| Item Name | `PART_MASTER.ITEM_NAME` | Attached via join in `attachMeta` (not a column). |
| Quantity | `MAT_STOCKS.QTY` | Current stock quantity. Basis for merge sum. Attached via `attachMeta`. |
| Arrival No. | `MAT_LOTS.ARRIVAL_NO` | Only LOTs with the same arrival number can be merged (inherits arrival label/info). Cannot merge if NULL. |
| Supplier | `MAT_LOTS.VENDOR` | Vendor code. `PARTNER_MASTER.PARTNER_NAME` is joined and displayed as `vendorName`. |
| Initial Serial (internal) | `MAT_LOTS.ORIGIN` | For split/merge tracking. New LOT inherits (`base.origin || base.matUid`). Grid sort key. |
| Unit (internal) | `PART_MASTER.UNIT` | Quantity display unit. Attached via `attachMeta`. |

> List gating condition (`findMergeableLots`): `MAT_STOCKS.QTY > 0` AND `MAT_LOTS.STATUS='NORMAL'` AND `NVL(RESERVED_QTY,0)=0` AND **receive complete** (see logic below).

---

## ② Material LOT — MAT_LOTS (All Columns)

| Screen Field | DB Column | Role / Meaning · Operational Notes |
|------|------|------|
| Material UID | `MAT_UID` (varchar2 50) | PK. Serial. New merge LOT is generated via `SEQ_MAT_SERIAL_DAILY` (`VH1-RM...`). |
| Item Code | `ITEM_CODE` (varchar2 50) | Item. New LOT inherits from originals. |
| Initial Qty | `INIT_QTY` (int) | Immutable original quantity. New LOT created with `totalQty` (summed quantity). Comparison basis for receive complete gating. |
| Current Qty | `CURRENT_QTY` (int) | Current remaining. Originals updated to 0 on merge, new LOT set to `totalQty`. |
| Receive Date | `RECV_DATE` (date) | New LOT inherits from the first scanned (base) LOT. |
| Manufacture Date | `MANUFACTURE_DATE` (date) | New LOT inherits from base. |
| Expiry Date | `EXPIRE_DATE` (date) | New LOT conservatively inherits the **earliest** date among originals. |
| Arrival No. | `ARRIVAL_NO` (varchar2 50) | Core merge key. All originals must have the same value. New LOT inherits. |
| Arrival SEQ | `ARRIVAL_SEQ` (number) | Inherits from base. Used for label issuance. |
| Origin/Tracking | `ORIGIN` (varchar2 50) | New LOT = `base.origin || base.matUid`. Also recorded as `REF_ID` in stock transactions. |
| Vendor | `VENDOR` (varchar2 50) | Inherits from base. |
| Manufacturer Code | `MFG_PARTNER_CODE` (varchar2 50) | Inherits from base. Manufacturer assumed consistent since same arrival. Used for label printing. |
| Invoice No. | `INVOICE_NO` (varchar2 50) | Inherits from base. |
| PO No. | `PO_NO` (varchar2 50) | Inherits from base. |
| IQC Status | `IQC_STATUS` (varchar2 20) | Inherits from base. |
| Special Accept YN | `SPECIAL_ACCEPT_YN` (char 1) | Default N. |
| LOT Status | `STATUS` (varchar2 20) | `NORMAL`/`HOLD`/`DEPLETED`/`SPLIT`/`MERGED`. Originals→`MERGED`, new→`NORMAL`. |
| Multi-tenancy | `COMPANY`, `PLANT_CD` | `'40'` / `'1000'` scope. All query/save filters. |
| Audit | `CREATED_BY`, `UPDATED_BY`, `CREATED_AT`, `UPDATED_AT` | Creation/update user·time. |

---

## ③ Material Stock — MAT_STOCKS

| Screen Field | DB Column | Role / Meaning · Operational Notes |
|------|------|------|
| Warehouse Code | `WAREHOUSE_CODE` | PK (composite). New LOT inherits from base LOT's warehouse. |
| Location Code | `LOCATION_CODE` | Inherits from base. |
| Item Code | `ITEM_CODE` | PK (composite). |
| Material UID | `MAT_UID` | PK (composite). |
| Quantity | `QTY` | Merge sum basis. Originals updated to 0, new LOT set to `totalQty`. |
| Available Qty | `AVAILABLE_QTY` | Originals 0, new LOT `totalQty`. |
| Reserved Qty | `RESERVED_QTY` | Merge blocked if > 0 (gating·validation). New LOT is 0. |
| Multi-tenancy | `COMPANY`, `PLANT_CD` | PK (composite) scope. |

---

## ④ Stock Transaction Ledger — STOCK_TRANSACTIONS

One merge creates `LOT_MERGE_OUT` records (one per original) + 1 `LOT_MERGE_IN` record (new one).

| DB Column | Role / Meaning · Operational Notes |
|------|------|
| `TRANS_NO` | PK. Generated via `NumberingService.next('STOCK_TX')`. |
| `TRANS_TYPE` | `LOT_MERGE_OUT`(original issue, negative) / `LOT_MERGE_IN`(new receipt, positive). |
| `TRANS_DATE` | Transaction timestamp. |
| `FROM_WAREHOUSE_ID` | OUT: original LOT warehouse. |
| `TO_WAREHOUSE_ID` | IN: new LOT warehouse. |
| `ITEM_CODE` | Item code. |
| `MAT_UID` | OUT: original serial / IN: new serial. |
| `QTY` | OUT: `-originalStock` / IN: `+totalQuantity`. |
| `REF_TYPE` | `'LOT_MERGE'`. |
| `REF_ID` | OUT: original `MAT_UID` / IN: `ORIGIN` (original list recorded in REMARK due to length limit). |
| `REMARK` | Format: `Material merge: [original serials] → new (total qty)`. |
| `STATUS` | `'DONE'`. Receive complete gating SQL aggregates only `STATUS <> 'CANCELED'`. |
| `WORKER_ID`, `CREATED_BY` | Processing user. |
| `COMPANY`, `PLANT_CD` | Multi-tenancy scope. |

---

## Merge Logic (Execution Order)

`POST /material/lot-merge` (`LotMergeService.merge`), within a single DB transaction (`TransactionService.run`):

1. Deduplicate `sourceLotIds` then validate **2 or more**.
2. Look up all `MAT_UID` in `MAT_LOTS` — 404 if any missing. Validate tenant match.
3. Validate **same item** (`ITEM_CODE` single).
4. Validate **same arrival number** (`ARRIVAL_NO` single, must not be NULL).
5. Query `MAT_STOCKS` → build stock map by serial.
6. Validate status/stock/reservation/receive completion per LOT:
   - `STATUS='HOLD'` not allowed, `STATUS<>'NORMAL'` not allowed.
   - `QTY<=0` not allowed, `RESERVED_QTY>0` not allowed.
   - **Receive complete gating**: `SUM(STOCK_TRANSACTIONS.QTY WHERE TRANS_TYPE IN ('RECEIVE','LOT_SPLIT_IN','LOT_MERGE_IN') AND STATUS<>'CANCELED') >= MAT_LOTS.INIT_QTY`.
7. Validate **issue history** (if `MAT_ISSUE` has active entries with `STATUS<>'CANCELED'`, merge blocked).
8. Look up item (`PART_MASTER`) and validate tenant.
9. Calculate sums: `totalQty=Σstock`, `origin=base.origin||base.matUid`, `expireDate=MIN(original expiry dates)`.
10. **Dispose originals**: For each original, record `LOT_MERGE_OUT`(−stock) stock transaction → `MAT_LOTS.STATUS='MERGED', CURRENT_QTY=0` → `MAT_STOCKS.QTY=0, AVAILABLE_QTY=0`.
11. **Generate new serial**: Create `MAT_UID` via `numbering.nextMatSerial`, create `MAT_LOTS`(`STATUS='NORMAL'`, inherit base info) + `MAT_STOCKS`(`QTY=AVAILABLE_QTY=totalQty`, `RESERVED_QTY=0`).
12. Record **new receipt** `LOT_MERGE_IN`(+total quantity) stock transaction.
13. Response: `newLotNo`, `mergedLotNos`, `totalQty`, `itemCode`, `itemName`, `arrivalNo`, label data (reuses `MatLabelPreviewModal`).

> `by-barcode/:matUid`(`findByBarcode`) pre-validates the merge eligibility (status/stock/reservation/receive complete/issue history) of a single scanned barcode for frontend accumulation.

---

## API Routes

| Purpose | Route |
|------|------|
| Mergeable LOT list | `GET /material/lot-merge` (`search`, `itemCode`, `limit`) |
| Single barcode eligibility check | `GET /material/lot-merge/by-barcode/:matUid` |
| Execute LOT merge | `POST /material/lot-merge` (`sourceLotIds[]`, `remark?`) — applies `InventoryFreezeGuard` |

---

## Prerequisites (Master·Common Code)

- Target LOTs must be **receive complete** (IQC passed and received to `MAT_STOCKS`) to appear in the list.
- New serial generation sequence (`SEQ_MAT_SERIAL_DAILY`)·stock transaction generation key (`STOCK_TX`) must be operational.
- Manufacturer (`PARTNER_MASTER`, `PARTNER_TYPE='MFG'`) must be registered for label manufacturer name display.
- `mat_lot` category label templates recommended for label output (`/master/label-templates`).
- Merge execution may be blocked during inventory freeze (`InventoryFreezeGuard`) periods.

---

## Operating Procedure

1. Identify LOTs to merge via list/search or accumulate by scanning barcodes (2 or more, same item, same arrival number).
2. **Select merge** → confirm total quantity in confirmation modal → **Execute merge**.
3. Original disposal and new generation are processed in a single transaction (partial failure causes full rollback).
4. Print the new serial label and attach to the consolidated box.

---

## Permissions

| Role | Permitted Operations |
|------|------|
| General users | Mergeable LOT lookup, barcode accumulation, merge execution, label output |
| Logistics/Material staff | Same as above |
| Operators/Administrators | Above + inventory freeze/exception handling decisions |

---

## Troubleshooting

| Symptom | Cause | Action |
|------|------|------|
| LOT not in list | Stock 0 / has reservation / receive incomplete / abnormal status | Confirm receipt, release reservation, check status |
| "Only receive-completed LOTs can be merged" error | `SUM(receive stock tx) < INIT_QTY` | Complete receiving after IQC pass |
| "Different items" error | Accumulated LOTs have different `ITEM_CODE` | Select only same-item LOTs |
| "Only LOTs with same arrival number" error | `ARRIVAL_NO` mismatch or NULL | Merge only LOTs from the same arrival |
| "LOT with reserved quantity" error | `RESERVED_QTY > 0` | Release reservation/allocation and retry |
| "Already has material issue history" error | Active issue in `MAT_ISSUE` | Clear the LOT's issues and retry |
| New serial generation failure | Sequence/generation key issue | Check `SEQ_MAT_SERIAL_DAILY`·`STOCK_TX` status |
| Merge button disabled | Less than 2 accumulated | Accumulate 2 or more serials |
| Label not printing | Print Agent not running | Check local Print Agent status |

---

## Data & Integration

| Item | Details |
|------|------|
| Main tables | `MAT_LOTS`, `MAT_STOCKS`, `STOCK_TRANSACTIONS` |
| Reference tables | `MAT_ISSUE`(issue history validation), `PART_MASTER`(item), `PARTNER_MASTER`(vendor/manufacturer) |
| Stock transaction types | `LOT_MERGE_OUT`(original disposal), `LOT_MERGE_IN`(new receipt) — `REF_TYPE='LOT_MERGE'` |
| Generation | New serial `SEQ_MAT_SERIAL_DAILY`(`VH1-RM...`), stock transaction `STOCK_TX` |
| Related screens | Material Split (symmetric), Arrival Management (LOT issuance), IQC (gating) |
| Multi-tenancy scope | `COMPANY = '40'`, `PLANT_CD = '1000'` — common filter on all queries and saves |
