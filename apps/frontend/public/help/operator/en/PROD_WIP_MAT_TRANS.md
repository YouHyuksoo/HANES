---
menuCode: PROD_WIP_MAT_TRANS
audience: operator
title: WIP Material Transactions — Operator Guide
summary: Full WIP_MAT_TRANSACTIONS column reference, transaction type semantics, WIP stock integration and troubleshooting
tags: [production, WIP, operator, process, transaction, equipment]
keywords: [WIP_MAT_TRANSACTIONS, WIP_MAT_STOCKS, WIP_IN, PROD_CONSUME, CANCEL_REF_ID, equipment stock, EQUIP_CODE, ITEM_MASTERS, EQUIP_MASTERS]
related: [PROD_ORDER, PROD_INPUT_KIOSK]
---

# WIP Material Transactions — Operator Guide

## System Role
Query all WIP raw material stock transactions recorded in the `WIP_MAT_TRANSACTIONS` table, managed at the equipment level. Every time raw materials are received into `WIP_MAT_STOCKS` or consumed in production, a transaction is automatically recorded. Cancellations are linked to the original via `CANCEL_REF_ID`, enabling transparent tracking and audit of WIP stock flow.

## Data Structure
```
WIP_MAT_TRANSACTIONS (PK: TRANS_NO — WTXYYMMDD-NNNNN)
    │
    ├── Basic: TRANS_TYPE, QTY, STATUS
    ├── Equipment: EQUIP_CODE → EQUIP_MASTERS (equipName)
    ├── Item/LOT: ITEM_CODE → ITEM_MASTERS, MAT_UID → MAT_LOTS
    ├── Reference: REF_TYPE + REF_ID (ORDER_NO etc.)
    └── Cancel chain: CANCEL_REF_ID → WIP_MAT_TRANSACTIONS.TRANS_NO
            │
            └── WIP_MAT_STOCKS (PK: COMPANY + PLANT_CD + EQUIP_CODE + ITEM_CODE + MAT_UID)
                    ├── QTY (total WIP stock)
                    ├── AVAILABLE_QTY (available)
                    └── RESERVED_QTY (reserved)
```

---

## ① WIP Transactions — WIP_MAT_TRANSACTIONS (All Columns)

| Screen Field | DB Column | Role / Meaning · Operational Notes |
|------|------|------|
| Transaction No. | `TRANS_NO` | **PK**. Unique WIP transaction identifier. Format: `WTXYYMMDD-NNNNN`. |
| Type | `TRANS_TYPE` | `WIP_IN` / `WIP_IN_CANCEL` / `PROD_CONSUME` / `PROD_CONSUME_CANCEL`. |
| Equipment | `EQUIP_CODE` | Equipment where transaction occurred. References `EQUIP_MASTERS.EQUIP_CODE`. |
| Item | `ITEM_CODE` | Raw material item. References `ITEM_MASTERS.ITEM_CODE`. |
| LOT | `MAT_UID` | LOT serial number. References `MAT_LOTS.MAT_UID`. |
| Qty | `QTY` | Quantity. Positive for WIP_IN, negative for PROD_CONSUME, reversed on cancel. |
| Source Warehouse | `FROM_WAREHOUSE_ID` | Warehouse supplying material for WIP_IN. |
| Work Order No. | `ORDER_NO` | Associated production order number. |
| Ref Type | `REF_TYPE` | Source document type (e.g., WORK_ORDER). |
| Ref ID | `REF_ID` | Source document number. |
| Cancel Ref | `CANCEL_REF_ID` | Original `TRANS_NO` if this is a cancellation. NULL for normal transactions. |
| Status | `STATUS` | `DONE`(normal) / `CANCELED`(canceled). Default `DONE`. |
| Remark | `REMARK` | Additional notes. |
| Worker | `WORKER_NO` | Worker ID who processed the transaction. |
| Multi-tenancy | `COMPANY`, `PLANT_CD` | Company(`40`) / Plant(`1000`) scope. |
| Created At | `CREATED_AT` | Transaction creation time. Displayed in Date column. |
| Updated At | `UPDATED_AT` | Last modified time. |

---

## Transaction Type Details

| Type | Description | QTY Sign | WIP_MAT_STOCKS Effect |
|------|-------|---------|-------------------|
| WIP_IN | Transfer raw material from warehouse to equipment | + | WIP stock increases |
| WIP_IN_CANCEL | Cancel WIP_IN — return material to warehouse | - | WIP stock decreases |
| PROD_CONSUME | Material consumed in production (actual consumption) | - | WIP stock decreases |
| PROD_CONSUME_CANCEL | Cancel consumption — restore material to WIP stock | + | WIP stock increases |

---

## WIP Stock Integration

Service methods and their transaction type relationships:

| Service Method | TRANS_TYPE Created | WIP_MAT_STOCKS Effect |
|-------------|-------------------|----------------|
| `addStockInTx()` | WIP_IN | `QTY` +, `AVAILABLE_QTY` + |
| `deductStockInTx()` | PROD_CONSUME | FIFO deduction (LOT priority configurable) |
| `restoreInTx(ADD_BACK)` | WIP_IN_CANCEL | Restore on cancel |
| `restoreInTx(DEDUCT_BACK)` | PROD_CONSUME_CANCEL | Restore on cancel |

> `addStockInTx` performs an UPSERT on `WIP_MAT_STOCKS` — if no record exists for the `EQUIP_CODE + ITEM_CODE + MAT_UID` combination, it creates one; otherwise it accumulates.

---

## Cancel Chain

```
Original WIP_IN (TRANS_NO = 'WTX20250601-00001', QTY = +100)
    │
    ├── On cancel → WIP_IN_CANCEL created (QTY = -100, CANCEL_REF_ID = original.TRANS_NO)
    │                Original STATUS = 'CANCELED'
    │
    └── WIP_MAT_STOCKS: LOT quantity -100
```

---

## Troubleshooting

| Symptom | Cause | Action |
|---------|-------|--------|
| No results | Filters too restrictive (equipment/type/date) | Reset filters or broaden range |
| Equipment transactions missing | Wrong equipment selected | Check equipment filter |
| Quantity is 0 or null | Original was canceled | Check cancel chain via CANCEL_REF_ID |
| LOT number not shown | MAT_UID is null for this transaction | Non-LOT transaction (qty-based) |
| Remark empty | REMARK has no value | Not required, normal behavior |

## Data & Integration
- **Tables**: `WIP_MAT_TRANSACTIONS` (ledger), `WIP_MAT_STOCKS` (WIP stock), `EQUIP_MASTERS`, `ITEM_MASTERS`
- **Integration**: Work orders (`PROD_ORDER`), material receipt/issue, production result entry
- **Scope**: `COMPANY='40'`, `PLANT_CD='1000'`
- **Numbering**: `SEQ_WIP_TX.NEXTVAL` → `WTXYYMMDD-NNNNN` format
