---
menuCode: INV_TRANSACTION
audience: operator
title: Stock Transaction History — Operator Guide
summary: STOCK_TRANSACTIONS full columns, transaction type meanings, cancellation chain structure and troubleshooting
tags: [stock, transaction, operations, view, ledger]
keywords: [STOCK_TRANSACTIONS, TRANS_TYPE, TRANS_NO, CANCEL_REF_ID, transaction history, RECEIVE, MAT_OUT, ADJUST, TRANSFER, SCRAP]
related: [INV_MAT_STOCK, MAT_ADJUSTMENT]
---

# Stock Transaction History — Operator Guide

## System Purpose & Role
Queries all material stock change history recorded in the `STOCK_TRANSACTIONS` table. All stock movements including receipt, issue, transfer, adjustment, and scrap can be tracked by type and date. When a transaction is canceled, the original and cancellation transactions are linked via `CANCEL_REF_ID`.

## Data Structure
```
STOCK_TRANSACTIONS (PK: TRANS_NO)
    │
    ├── Basic Info: TRANS_TYPE, TRANS_DATE, QTY, STATUS
    ├── Warehouse: FROM_WAREHOUSE_ID → WAREHOUSES, TO_WAREHOUSE_ID → WAREHOUSES
    ├── Item/LOT: ITEM_CODE → ITEM_MASTERS, MAT_UID → MAT_LOTS
    ├── Reference: REF_TYPE + REF_ID (PO/job order etc.)
    └── Cancel Chain: CANCEL_REF_ID → STOCK_TRANSACTIONS.TRANS_NO (self-reference)
        └── Trace back via CANCEL_REF_ID to find the original
```

---

## ① Stock Transaction — STOCK_TRANSACTIONS (All Columns)

| Screen Field | DB Column | Role / Meaning · Operational Notes |
|------|------|------|
| Transaction No. | `TRANS_NO` | **PK**. Natural key. Generated per numbering rules. |
| Transaction Type | `TRANS_TYPE` | Transaction classification. `RECEIVE`, `MAT_OUT`, `ADJUST_IN`, `TRANSFER`, etc. Displayed with color chips. |
| Transaction Date | `TRANS_DATE` | Processing timestamp. Default `CURRENT_TIMESTAMP`. |
| From Warehouse | `FROM_WAREHOUSE_ID` | Warehouse with decreased stock (issue/transfer). NULL for simple receipt. |
| To Warehouse | `TO_WAREHOUSE_ID` | Warehouse with increased stock (receipt/transfer). NULL for simple issue. |
| Item Code | `ITEM_CODE` | Changed item. References `ITEM_MASTERS.ITEM_CODE`. |
| LOT No. | `MAT_UID` | Serial number for LOT-level transactions. NULL for quantity-based processing. |
| Quantity | `QTY` | Changed quantity. Positive = stock increase (receipt), Negative = stock decrease (issue). |
| Unit Price | `UNIT_PRICE` | Item unit price (on receipt). |
| Total Amount | `TOTAL_AMOUNT` | Total amount (= QTY × UNIT_PRICE). |
| Reference Type | `REF_TYPE` | Original document type. `JOB_ORDER`, `SUBCON_ORDER`, `PO`, etc. |
| Reference ID | `REF_ID` | Original document number. |
| Cancel Ref | `CANCEL_REF_ID` | If canceled, references original `TRANS_NO`. NULL for normal transactions. |
| Worker No. | `WORKER_NO` | Worker ID. |
| Remark | `REMARK` | Additional notes. |
| Status | `STATUS` | `DONE` (normal) / `CANCELED` (canceled). Default `DONE`. |
| Account | `ACCOUNT` | Common code based stock account classification. |
| Approver ID | `APPROVER_ID` | Approver for transactions requiring approval (e.g., miscellaneous issue). |
| Approved At | `APPROVED_AT` | Approval processing timestamp. |
| Multi-tenancy | `COMPANY`, `PLANT_CD` | Company code (`40`) / Plant code (`1000`) scope. |
| Created By | `CREATED_BY` | Registrant. |
| Updated By | `UPDATED_BY` | Modifier. |
| Created At | `CREATED_AT` | Record creation time. |
| Updated At | `UPDATED_AT` | Record modification time. |

---

## Transaction Types (`TRANS_TYPE`) Details

| Type | Description | QTY Sign | Stock Effect |
|------|------|---------|----------|
| RECEIVE | Material receipt (purchase/return) | + | Increases to-warehouse stock |
| MAT_OUT | Material issue (production/repair) | - | Decreases from-warehouse stock |
| MAT_OUT_CANCEL | Issue cancellation | + | Restores from-warehouse stock |
| ADJUST_IN | Adjustment increase | + | Increases stock |
| ADJUST_OUT | Adjustment decrease | - | Decreases stock |
| TRANSFER | Inter-warehouse transfer | N/A | From -, To + |
| LOT_SPLIT_IN | LOT split (in) | + | Increases new LOT stock |
| LOT_SPLIT_OUT | LOT split (out) | - | Decreases original LOT stock |
| SCRAP | Disposal | - | Decreases stock (scrap) |
| MISC_IN | Miscellaneous receipt | + | Increases to-warehouse stock |
| PROD_CONSUME | Production consumption | - | Decreases from-warehouse stock |
| PROD_CONSUME_CANCEL | Production consumption cancel | + | Restores from-warehouse stock |

---

## Cancellation Chain Structure

A canceled transaction is created as a **new transaction** with the original `TRANS_NO` recorded in `CANCEL_REF_ID`:

```
Original Transaction (TRANS_NO = 'RCP-20250101-001', QTY = +100, STATUS = 'DONE')
    ↓ on cancel
Cancel Transaction (TRANS_NO = 'CCL-20250101-001', QTY = -100, STATUS = 'DONE',
                    CANCEL_REF_ID = 'RCP-20250101-001')
    ↓ and
Original updated (STATUS = 'CANCELED')
```

In the screen, canceled entries show the original `TRANS_NO` in the `Original Transaction` column for traceability.

---

## Troubleshooting

| Symptom | Cause | Action |
|------|------|------|
| Specific transaction not found | Date range or transaction type filter applied | Clear filters and re-query |
| Quantity shown as 0 | Original status changed to CANCELED after cancellation | Check cancel chain via `CANCEL_REF_ID` |
| Warehouse name not displayed | `FROM_WAREHOUSE_ID` or `TO_WAREHOUSE_ID` is NULL | Simple receipt/issue only has one warehouse |
| RECEIVE with negative quantity | Cancel transaction created as RECEIVE type | Check original via `CANCEL_REF_ID` |

## Data & Integration
- **Tables**: `STOCK_TRANSACTIONS` (transaction history), `MAT_STOCKS` (stock), `MAT_LOTS` (LOT)
- **Integration**: `ITEM_MASTERS`, `WAREHOUSES`, PO/job order etc.
- **Scope**: `COMPANY='40'`, `PLANT_CD='1000'`
