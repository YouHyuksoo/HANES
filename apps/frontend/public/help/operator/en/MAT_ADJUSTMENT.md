---
menuCode: MAT_ADJUSTMENT
audience: operator
title: Stock Adjustment — Operator Guide
summary: Full column meaning of stock adjustment, DB mapping, approval process (PDA 2-step), stock integration structure and troubleshooting
tags: [material, stock, adjustment, operations, settings, physical]
keywords: [INV_ADJ_LOGS, MAT_STOCKS, stock adjustment, physical inventory, ADJ_TYPE, PHYSICAL_INV, MANUAL_ADJ, adjustment approval, PENDING, APPROVED, InventoryFreezeGuard, STOCK_TRANSACTIONS, MAT_LOTS, warehouse stock]
related: [MAT_RECEIVE, MAT_ISSUE]
---

# Stock Adjustment — Operator Guide

## System Purpose & Role
Manually corrects discrepancies between physical and system stock, recording the history in `INV_ADJ_LOGS`. When an adjustment occurs, `MAT_STOCKS` (warehouse item stock) quantity changes and `STOCK_TRANSACTIONS` records ADJUST_IN/ADJUST_OUT transactions. Divided into PDA path (2-step approval) and PC path (immediate approval).

## Data Structure
```
INV_ADJ_LOGS  (PK: ADJ_DATE + SEQ)
    │
    ├── On APPROVAL ──▶ MAT_STOCKS.qty updated
    │                       │
    │                       └── STOCK_TRANSACTIONS (ADJUST_IN / ADJUST_OUT)
    │
    └── PENDING status ──▶ Awaiting approval/rejection (PDA registration)
                            │
                            ├── Approval → MAT_STOCKS updated
                            └── Rejection → History retained, no stock change
```

---

## ① Stock Adjustment — INV_ADJ_LOGS (All Columns)

| Screen Field | DB Column | Role / Meaning · Operational Notes |
|------|------|------|
| Adjust Date | `ADJ_DATE` | **PK (1/2)**. Adjustment registration date. Auto-generated (`SYSDATE`). |
| Sequence | `SEQ` | **PK (2/2)**. Sequential number within the same date. Auto-numbered (sequence or `MAX+1`). |
| Warehouse | `WAREHOUSE_CODE` | Target warehouse. Links to `MAT_STOCKS.WAREHOUSE_CODE`. |
| Item Code | `ITEM_CODE` | Target item. References `ITEM_MASTERS.ITEM_CODE`. |
| Material UID | `MAT_UID` | LOT UID for LOT-level adjustment. NULL = entire item adjustment. |
| Adjustment Type | `ADJ_TYPE` | Adjustment classification: `ADJUST` (general), `PHYSICAL_INV` (physical count), `MANUAL_ADJ` (manual adjustment). |
| Before Qty | `BEFORE_QTY` | System stock quantity before adjustment. Based on `MAT_STOCKS.QTY`. |
| After Qty | `AFTER_QTY` | Final quantity after adjustment. |
| Diff Qty | `DIFF_QTY` | `AFTER_QTY - BEFORE_QTY`. Positive = increase, Negative = decrease. |
| Approval Status | `ADJUST_STATUS` | `PENDING` = awaiting approval (PDA path), `APPROVED` = approved (stock updated), `REJECTED` = rejected. PC path defaults to `APPROVED`. |
| Reason | `REASON` | Adjustment reason. `varchar2(500)`. |
| Approved By | `APPROVED_BY` | Approver/rejector user ID. |
| Approved At | `APPROVED_AT` | Approval/rejection timestamp. |
| Created By | `CREATED_BY` | Adjustment registrant. |
| Multi-tenancy | `COMPANY`, `PLANT_CD` | Company code (`40`) / Plant code (`1000`) scope. |
| Updated By | `UPDATED_BY` | Last modifier. |
| Created At | `CREATED_AT` | Adjustment registration time. Displayed in list. |
| Updated At | `UPDATED_AT` | Last modification time (auto). |

---

## Adjustment Types (`ADJ_TYPE`)

| Code | Meaning | Usage |
|------|------|------|
| `ADJUST` | General adjustment | Direct quantity adjustment from PC screen |
| `PHYSICAL_INV` | Physical count | Reflecting physical inventory results |
| `MANUAL_ADJ` | Manual adjustment | Exception cases such as receipt/issue error correction |

---

## Approval Process (2 Paths)

| Path | Registration Method | Initial Status | Stock Update | Usage |
|------|----------|-----------|----------|--------|
| PC Screen | `POST /material/adjustment` | `APPROVED` | **Immediate** | Office PC |
| PDA | `POST /material/adjustment/pending` | `PENDING` | On approval | Shop floor PDA |

**PENDING → Approval/Rejection Flow:**
1. PDA registers via `POST /material/adjustment/pending` → `ADJUST_STATUS = 'PENDING'` (stock not updated)
2. Manager approves via `PATCH /material/adjustment/:adjDate/:seq/approve` → `MAT_STOCKS.qty` updated + `STOCK_TRANSACTIONS` recorded
3. Or rejects via `PATCH /material/adjustment/:adjDate/:seq/reject` → history retained, no stock change

> `InventoryFreezeGuard` blocks adjustment registration/approval when inventory is in a frozen state.

---

## Stock Integration Details

**Processing sequence on approval:**
1. Query current `QTY` from `MAT_STOCKS` for the warehouse + item + LOT
2. Increase or decrease `MAT_STOCKS.QTY` by `DIFF_QTY`
3. Record `ADJUST_IN` (increase) or `ADJUST_OUT` (decrease) transaction in `STOCK_TRANSACTIONS`
4. Update `INV_ADJ_LOGS.ADJUST_STATUS` to `'APPROVED'` + record approver and approval time

---

## Operating Procedure
1. **Physical count or discrepancy found**: Check difference between physical and system stock after warehouse count
2. **Register adjustment**: Enter warehouse, item, after-qty, and reason on PC screen → immediate update
3. **PDA path (shop floor)**: Register as PENDING on PDA → manager approves/rejects
4. **Verify results**: Check adjustment history and increase/decrease details in DataGrid
5. **Reverse adjustment (if erroneous)**: Register opposite direction adjustment to restore

## Permissions
Users with stock adjustment authority (material/production manager). Registration and approval blocked during inventory freeze period by `InventoryFreezeGuard`.

## Troubleshooting

| Symptom | Cause | Action |
|------|------|------|
| Save button disabled | Warehouse, item, quantity, or reason empty | Fill in all required fields |
| "Inventory frozen" error | Stock in frozen state due to physical count etc. | Unfreeze and retry |
| Quantity looks wrong | After qty should be the final value, not the delta | Check after qty input (final value, not difference) |
| PDA registration not approved | Remains in `ADJUST_STATUS = 'PENDING'` | Process approval (`/approve`) or rejection (`/reject`) |
| Quantity shown as negative | Decrease adjustment on insufficient stock | Check stock and re-adjust with an appropriate value |

## Data & Integration
- **Tables**: `INV_ADJ_LOGS` (adjustment history), `MAT_STOCKS` (stock quantity update), `STOCK_TRANSACTIONS` (transaction history), `MAT_LOTS` (LOT info)
- **Integration**: `ITEM_MASTERS` (items), `WAREHOUSES` (warehouses)
- **Scope**: `COMPANY='40'`, `PLANT_CD='1000'`
- **Guard**: `InventoryFreezeGuard` — blocks adjustments during inventory freeze
