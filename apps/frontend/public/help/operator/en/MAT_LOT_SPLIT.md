---
menuCode: MAT_LOT_SPLIT
audience: operator
title: Material Lot Split — Operator Guide
summary: Material split DB structure (MAT_LOTS, MAT_STOCKS, STOCK_TRANSACTIONS), receive complete gating, original disposal→new 2-piece generation logic, origin inheritance tracking, multi-tenancy scope
tags: [material, LOT, split, operations, DB, serial, stock transaction]
keywords: [lot split, LOT split, MAT_LOTS, MAT_STOCKS, STOCK_TRANSACTIONS, MAT_UID, INIT_QTY, CURRENT_QTY, SPLIT, LOT_SPLIT_OUT, LOT_SPLIT_IN, receive complete gating, RECEIVE, origin, nextMatSerial, STOCK_TX, isSplittable, InventoryFreezeGuard, multi-tenancy, COMPANY, PLANT_CD]
related: [MAT_LOT, MAT_LOT_MERGE, MAT_ARRIVAL, MAT_ISSUE]
---

# Material Lot Split — Operator Guide

## System Purpose & Role
This screen splits one receive-completed material LOT (`MAT_LOTS`) serial into **two new serials**. The split does not simply separate the original — it **disposes of the original serial (STATUS='SPLIT', stock 0) and generates each split piece (split quantity and remaining quantity) as a new serial**. All quantity movements are recorded in `STOCK_TRANSACTIONS` as `LOT_SPLIT_OUT` (full original issue) / `LOT_SPLIT_IN` (new piece receipt), and new LOTs inherit `ORIGIN` (original serial) for traceability.

> Design basis: `docs/specs/2026-06-08-lot-split-merge-redesign-design.md`. Full original disposal → both resulting pieces as new serials.

## Data Structure
```
MAT_LOTS (PK: MAT_UID)                ← LOT tracking master
  └─ MAT_STOCKS (PK: COMPANY+PLANT_CD+WAREHOUSE_CODE+ITEM_CODE+MAT_UID)
        QTY / AVAILABLE_QTY / RESERVED_QTY   ← current stock

On split execution (single transaction):
  Original MAT_UID
    STATUS NORMAL → SPLIT, CURRENT_QTY → 0
    MAT_STOCKS QTY/AVAILABLE_QTY → 0
    STOCK_TRANSACTIONS: LOT_SPLIT_OUT (QTY = -full quantity)
  New serial A (split qty), B (remainder)  ← nextMatSerial generation
    MAT_LOTS new INSERT (ORIGIN inherited)
    MAT_STOCKS new INSERT
    STOCK_TRANSACTIONS: LOT_SPLIT_IN (QTY = +piece quantity) × 2

Receive complete gating:
  Σ STOCK_TRANSACTIONS.QTY (TRANS_TYPE IN RECEIVE/LOT_SPLIT_IN/LOT_MERGE_IN, STATUS<>CANCELED)
    >= MAT_LOTS.INIT_QTY
```

---

## ① Splittable LOT Grid — MAT_LOTS / MAT_STOCKS

The list query INNER JOINs `MAT_LOTS` and `MAT_STOCKS` and applies receive complete gating.

| Screen Field | DB Column | Role / Meaning · Operational Notes |
|------|------|------|
| Material Serial | `MAT_LOTS.MAT_UID` | PK. Unique LOT identifier (label barcode). Original serial to split. |
| Item Code | `MAT_LOTS.ITEM_CODE` | References `ITEM_MASTERS.ITEM_CODE`. Join key for item name·unit. |
| Item Name | `ITEM_MASTERS.ITEM_NAME` | Joined via `PartMaster` on `ITEM_CODE`. Display only. |
| Current Qty | `MAT_STOCKS.QTY` | Current stock. List condition `QTY > 1`. Split qty must be less than this value. |
| Unit | `ITEM_MASTERS.UNIT` | Item master unit. Displayed alongside quantity. |
| Supplier | `MAT_LOTS.VENDOR` → `PARTNER_MASTERS.PARTNER_NAME` | Batch join via `PartnerMaster` on `VENDOR` code (avoids N+1). Shows code if unmapped. |
| (Gating) | `MAT_LOTS.INIT_QTY` vs Σ transactions | Not displayed. Basis for receive complete judgment. |
| (List filter) | `MAT_LOTS.STATUS = 'NORMAL'` | Only NORMAL. Excludes SPLIT/MERGED/HOLD/DEPLETED. |
| (List filter) | `MAT_STOCKS.RESERVED_QTY = 0` | LOTs with reserved quantity are excluded. |

> Composite list condition: `MAT_STOCKS.QTY > 1` AND `MAT_LOTS.STATUS = 'NORMAL'` AND `NVL(RESERVED_QTY,0) = 0` AND receive complete gating passed.

---

## ② Material LOT — MAT_LOTS (Split-Related All Columns)

| Screen Field | DB Column | Role / Meaning · Operational Notes |
|------|------|------|
| Material UID | `MAT_UID` | PK (varchar2 50). New pieces generated via `nextMatSerial`. |
| Item Code | `ITEM_CODE` | New pieces inherit from original. |
| Initial Qty | `INIT_QTY` | Original quantity at issuance (immutable). Comparison target for receive complete gating. New pieces INSERTed with piece quantity. |
| Current Qty | `CURRENT_QTY` | Remaining quantity. Original updated to `0` on split. New pieces set to piece quantity. |
| Receive Date | `RECV_DATE` | New pieces inherit from original. |
| Manufacture Date | `MANUFACTURE_DATE` | New pieces inherit from original. |
| Expiry Date | `EXPIRE_DATE` | New pieces inherit from original. |
| Arrival No. | `ARRIVAL_NO` | New pieces inherit from original. Used for label and trace-back. |
| Arrival SEQ | `ARRIVAL_SEQ` | New pieces inherit from original. |
| Origin (Initial Serial) | `ORIGIN` | Split/merge tracking key. Both pieces inherit the original's `ORIGIN` (or original `MAT_UID` if none). Core genealogy. |
| Vendor | `VENDOR` | Supplier code. New pieces inherit. |
| Manufacturer Code | `MFG_PARTNER_CODE` | New pieces inherit. Printed as label manufacturer (origin's manufacturer inherited). |
| Invoice No. | `INVOICE_NO` | New pieces inherit. |
| PO No. | `PO_NO` | New pieces inherit. |
| IQC Status | `IQC_STATUS` | New pieces inherit (maintains already-passed inspection results). |
| Special Accept YN | `SPECIAL_ACCEPT_YN` | Default `N`. |
| LOT Status | `STATUS` | Original becomes `SPLIT` after split. New pieces are `NORMAL`. Only `NORMAL` is splittable. |
| Multi-tenancy | `COMPANY`, `PLANT_CD` | `'40'` / `'1000'` scope. New pieces inherit. |

---

## ③ Raw Material Stock — MAT_STOCKS

| Screen Field | DB Column | Role / Meaning · Operational Notes |
|------|------|------|
| Multi-tenancy | `COMPANY`, `PLANT_CD` | Part of composite PK. |
| Warehouse Code | `WAREHOUSE_CODE` | Part of composite PK. New pieces inherit original warehouse. |
| Item Code | `ITEM_CODE` | Part of composite PK. |
| Material UID | `MAT_UID` | Part of composite PK. New pieces get new serial and new row. |
| Location | `LOCATION_CODE` | New pieces inherit from original. |
| Quantity | `QTY` | Total quantity. Original set to `0` on split. New pieces set to piece quantity. |
| Reserved Qty | `RESERVED_QTY` | Split blocking condition (blocked if `> 0`). New pieces set to 0. |
| Available Qty | `AVAILABLE_QTY` | Original set to `0` on split. New pieces set to piece quantity. |

---

## ④ Stock Transaction Ledger — STOCK_TRANSACTIONS

One split creates 1 `LOT_SPLIT_OUT` row + 2 `LOT_SPLIT_IN` rows.

| DB Column | Role / Meaning · Operational Notes |
|------|------|
| `TRANS_NO` | PK. Generated via `NumberingService.next('STOCK_TX')`. |
| `TRANS_TYPE` | `LOT_SPLIT_OUT`(full original issue, QTY negative) / `LOT_SPLIT_IN`(new piece receipt, QTY positive). |
| `TRANS_DATE` | Transaction timestamp. |
| `FROM_WAREHOUSE_ID` | OUT transaction's issue warehouse (original warehouse). |
| `TO_WAREHOUSE_ID` | IN transaction's receipt warehouse (inherits original warehouse). |
| `ITEM_CODE` | Item code (inherits from original). |
| `MAT_UID` | OUT: original serial, IN: new piece serial. |
| `QTY` | OUT: `-full quantity`, IN: `+piece quantity`. INT. |
| `REF_TYPE` | `LOT_SPLIT`. |
| `REF_ID` | Original `MAT_UID` (split tracking reference). |
| `REMARK` | Notes or auto-generated `Material split: {original}({full qty}) → {split qty} + {remainder}`. |
| `WORKER_ID` | Processing user. |
| `STATUS` | `DONE`. Receive complete gating sum uses `STATUS <> 'CANCELED'` condition. |
| `COMPANY`, `PLANT_CD` | Multi-tenancy scope. |

> Receive complete gating recognizes `LOT_SPLIT_IN` / `LOT_MERGE_IN` as received in addition to `RECEIVE`. Therefore, split/merge result serials can be re-split or re-merged.

---

## Split Execution Logic (split)

Executed sequentially within a single DB transaction (`TransactionService.run`):

1. Look up original LOT (tenant scope) + validate existence and tenant match.
2. Validate status: only `STATUS = 'NORMAL'` allowed (`HOLD`/others blocked).
3. **Receive complete gating**: Σ`STOCK_TRANSACTIONS.QTY`(RECEIVE/LOT_SPLIT_IN/LOT_MERGE_IN, STATUS<>CANCELED) ≥ `INIT_QTY`.
4. Query original stock (`MAT_STOCKS`): validate `QTY > 0`, `RESERVED_QTY = 0`, `splitQty < QTY`.
5. Validate issue history (`MAT_ISSUES`): block if active (non-CANCELED) issue exists.
6. Validate item (`PartMaster`): split blocked if `IS_SPLITTABLE = 'N'`.
7. Create `LOT_SPLIT_OUT` stock transaction (QTY = `-full quantity`).
8. Dispose original: `MAT_LOTS.STATUS = 'SPLIT'`, `CURRENT_QTY = 0`; `MAT_STOCKS.QTY = AVAILABLE_QTY = 0`.
9. For each of the two pieces (`[splitQty, remainQty]`):
   - Generate new serial via `nextMatSerial`.
   - New INSERT into `MAT_LOTS` (inherit original properties·`ORIGIN`, `STATUS = 'NORMAL'`).
   - New INSERT into `MAT_STOCKS`.
   - Create `LOT_SPLIT_IN` stock transaction (QTY = `+piece quantity`).
10. Include `label` (2 new serials) in response → frontend displays label preview.

> `remainQty = totalQty - splitQty`, and the `splitQty < QTY` validation ensures it is always `> 0`.

---

## Prerequisites (Master·Common Code)

- Target LOT must be **receive complete** (receiving processed with RECEIVE sum ≥ INIT_QTY in `STOCK_TRANSACTIONS`).
- If `IS_SPLITTABLE` in Item Master (`ITEM_MASTERS`) is `N`, split is blocked — set to `Y` for splittable items.
- Generation keys pre-registered: material serial (`nextMatSerial`, daily sequence `VH1-RM...`), stock transaction (`STOCK_TX`).
- `InventoryFreezeGuard` — split POST is blocked during inventory freeze periods.

---

## Operating Procedure

1. Verify target LOT is receive complete, NORMAL, with no reservations/issue history.
2. Click Split button → enter split quantity (less than current quantity) → execute split.
3. Print labels for the 2 new serials from label preview, discard original label.
4. After split, verify original `STATUS = 'SPLIT'` and 2 new `NORMAL` entries in `MAT_LOTS`.

---

## Permissions

| Role | Permitted Operations |
|------|------|
| General users | Splittable LOT lookup, split execution, label output |
| Logistics/Material staff | Same as above |
| Operators/Administrators | Above + inventory freeze setting/release, item `IS_SPLITTABLE` setting |

---

## Troubleshooting

| Symptom | Cause | Action |
|------|------|------|
| LOT not in list | Before receive complete / `QTY <= 1` / `RESERVED_QTY > 0` / `STATUS <> NORMAL` | Check status·qty·reservation in [Raw Material LOT Status]. Complete receiving first |
| "Only receive-completed LOTs can be split" error | Gating not passed (RECEIVE sum < INIT_QTY) | Complete receiving first |
| "LOT not in NORMAL status" error | Already SPLIT/MERGED or HOLD | Select a different LOT. Release hold and proceed |
| "LOT with reserved quantity" error | `RESERVED_QTY > 0` | Clear reservation first (cancel/consume) |
| "LOT already has material issue history" error | Active non-CANCELED issue exists | Clear the issue first or use another LOT |
| "This item cannot be split" error | `ITEM_MASTERS.IS_SPLITTABLE = 'N'` | Change to splittable in Item Master |
| "Split qty must be less than current stock" error | `splitQty >= QTY` | Re-enter a value less than current quantity |
| Split POST blocked (freeze) | Inventory freeze period | Release freeze in `InventoryFreezeGuard` and retry |
| Label not printing | Print Agent not running | Check local Print Agent status |

---

## Data & Integration

| Item | Details |
|------|------|
| Main tables | `MAT_LOTS`, `MAT_STOCKS`, `STOCK_TRANSACTIONS` |
| Validation references | `MAT_ISSUES`(issue history), `ITEM_MASTERS`(IS_SPLITTABLE·unit), `PARTNER_MASTERS`(supplier name) |
| API routes | `GET /material/lot-split`(splittable list), `POST /material/lot-split`(execute split) |
| Generation | Serial `nextMatSerial`(SEQ_MAT_SERIAL_DAILY), stock tx `STOCK_TX` (`NumberingService`) |
| Guard | `InventoryFreezeGuard`(POST) |
| Tracking (genealogy) | `ORIGIN`(original serial) inheritance + `STOCK_TRANSACTIONS.REF_ID`(original MAT_UID) |
| Related screens | Arrival Management (LOT issuance), Material Merge (inverse operation), Raw Material LOT Status, Material Issue |
| Multi-tenancy scope | `COMPANY = '40'`, `PLANT_CD = '1000'` — common filter on all queries and saves |
