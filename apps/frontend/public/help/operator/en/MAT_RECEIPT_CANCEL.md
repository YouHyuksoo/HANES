---
menuCode: MAT_RECEIPT_CANCEL
audience: operator
title: Material Receipt Cancellation — Operator Guide
summary: Full column meaning of receipt cancellation, reverse transaction mechanism, stock impact, cancellation chain structure and troubleshooting
tags: [material, receipt, cancel, operations, reverse transaction]
keywords: [STOCK_TRANSACTIONS, CANCEL_REF_ID, receipt cancellation, reverse transaction, DONE, CANCELED, MatStock, TRANS_TYPE, RECEIVE]
related: [MAT_RECEIVE, MAT_ARRIVAL, INV_TRANSACTION]
---

# Material Receipt Cancellation — Operator Guide

## System Purpose & Role
Handles cancellation of material receipt transactions that have been completed (`DONE` status). Selecting a receipt for cancellation creates a reverse transaction (opposite sign) in `STOCK_TRANSACTIONS`, updates `MatStock` quantity, and changes the original transaction status to `CANCELED`. The original and cancellation transactions are linked via the `CANCEL_REF_ID` column.

## Data Structure
```
STOCK_TRANSACTIONS (PK: TRANS_NO)
    │
    ├── Original: TRANS_TYPE='RECEIVE', QTY=+100, STATUS='DONE'
    │       │
    │       ▼ (on cancel)
    ├── Cancel: TRANS_TYPE='RECEIVE', QTY=-100, STATUS='DONE',
    │           CANCEL_REF_ID = Original TRANS_NO
    │
    └── Original updated: STATUS → 'CANCELED'
```

---

## ① Receipt Cancellation — Key Columns in STOCK_TRANSACTIONS

| Screen Field | DB Column | Role / Meaning · Operational Notes |
|------|------|------|
| Transaction No. | `TRANS_NO` | **PK**. Natural key. Generated per numbering rules. |
| Transaction Type | `TRANS_TYPE` | Only `RECEIVE` displayed on this screen. Cancellation also creates a `RECEIVE` type with opposite sign quantity. |
| Transaction Date | `TRANS_DATE` | Original transaction timestamp. |
| Item Code | `ITEM_CODE` | Received item. References `ITEM_MASTERS.ITEM_CODE`. |
| Material Serial | `MAT_UID` | LOT serial for LOT-level transactions. |
| Quantity | `QTY` | Received quantity. Cancellation creates opposite sign (`-` original QTY). |
| Status | `STATUS` | `DONE` (normal) / `CANCELED` (canceled). |
| Cancel Ref | `CANCEL_REF_ID` | References the original `TRANS_NO` for cancellation transactions. NULL for normal transactions. |
| From Warehouse | `FROM_WAREHOUSE_ID` | NULL for simple receipt. |
| To Warehouse | `TO_WAREHOUSE_ID` | Receiving warehouse. |
| Vendor | (via reference chain) | Supplier who delivered the material. |

---

## Cancellation Chain Structure

When a receipt is canceled:
1. A **new transaction** is created with `TRANS_TYPE='RECEIVE'`, `QTY = -(original QTY)`, `STATUS = 'DONE'`, and `CANCEL_REF_ID` pointing to the original `TRANS_NO`
2. The **original transaction's** `STATUS` is updated to `'CANCELED'`
3. `MatStock` quantity decreases by the original receipt quantity
4. A stock transaction history entry is recorded

```
Original: TRANS_NO='RCP-20250101-001', QTY=+100, STATUS='DONE'
    ↓ on cancel
Cancel:   TRANS_NO='CCL-20250101-001', QTY=-100, STATUS='DONE',
          CANCEL_REF_ID='RCP-20250101-001'
    ↓ and
Original: STATUS → 'CANCELED'
```

The screen shows the original transaction number in the `Original Transaction` column for canceled entries.

---

## Stock Impact

| Operation | MAT_STOCKS Effect | STOCK_TRANSACTIONS Effect |
|-----------|------------------|--------------------------|
| Receipt | QTY +100 | RECEIVE +100, STATUS=DONE |
| Cancel Receipt | QTY -100 | RECEIVE -100 (CANCEL_REF_ID), STATUS=DONE; Original → CANCELED |

> Cancellation of a receipt is only possible if the LOT has not been issued to production or otherwise consumed. The system checks for subsequent transactions referencing the LOT before allowing cancellation.

---

## Operating Procedure
1. Open the **Material Receipt Cancellation** screen and set the date range to find the target receipt.
2. Verify the transaction to cancel — check item, quantity, vendor, and warehouse.
3. Click **Cancel** and enter the cancel reason in the modal.
4. Confirm cancellation. Verify that the original transaction now shows `CANCELED` status.
5. Check `MatStock` and `STOCK_TRANSACTIONS` for the reverse entry.

## Permissions
Users with material receipt cancellation authority (material/warehouse manager).

## Troubleshooting

| Symptom | Cause | Action |
|------|------|------|
| Cancel button disabled | Transaction already `CANCELED` or LOT has downstream transactions | Check LOT usage history |
| Receipt not found in list | Date range too narrow or wrong filter | Expand date range; only `RECEIVE` type shown |
| "Cannot cancel — LOT in use" error | LOT has been issued to production or otherwise consumed | Cannot cancel; consider stock adjustment instead |
| Cancel reason field disabled | Must be a modifiable row (`DONE` status) | Verify transaction is `DONE` |
| Stock not updated after cancel | Reverse transaction not created or failed | Check `STOCK_TRANSACTIONS` for the reverse entry; contact support |

## Data & Integration
- **Table**: `STOCK_TRANSACTIONS` (receipt and cancellation), `MAT_STOCKS` (stock update)
- **Integration**: `ITEM_MASTERS`, `WAREHOUSES`, material receipt screen
- **Scope**: `COMPANY='40'`, `PLANT_CD='1000'`
- **Cancellation Guard**: System checks for downstream LOT usage before allowing cancellation
