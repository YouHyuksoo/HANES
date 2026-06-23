---
menuCode: INV_MAT_PHYSICAL_INV_APPLY
audience: operator
title: Physical Inventory Apply — Operator Guide
summary: Count apply process, stock update structure, transaction processing and troubleshooting
tags: [stock, physical, apply, operations, quantity]
keywords: [PHYSICAL_INV_COUNT_DETAILS, MAT_STOCKS, count apply, applyCount, STOCK_TRANSACTIONS, INV_ADJ_LOGS, PHYSCOUNT_IN, PHYSCOUNT_OUT]
related: [INV_MAT_PHYSICAL_INV, INV_MAT_STOCK, MAT_ADJUSTMENT]
---

# Physical Inventory Apply — Operator Guide

## System Purpose & Role
The final step to align system stock with actual quantities based on PDA scan counts (or PC direct input) after a physical inventory session is completed. When `applyCount()` executes, `MAT_STOCKS` quantities are updated, `PHYSCOUNT_IN/OUT` transactions are recorded in `STOCK_TRANSACTIONS`, and a `PHYSICAL_COUNT` type audit history is created in `INV_ADJ_LOGS`.

## Data Structure
```
PHYSICAL_INV_SESSIONS (COMPLETED)
    │
    └── PHYSICAL_INV_COUNT_DETAILS (systemQty, countedQty, diffQty)
            │
            ▼ on apply
    MAT_STOCKS.qty = countedQty (updated)
    MAT_STOCKS.lastCountAt = now
    MAT_STOCKS.availableQty recalculated
            │
            ├── STOCK_TRANSACTIONS (PHYSCOUNT_IN / PHYSCOUNT_OUT)
            │
            └── INV_ADJ_LOGS (adjType = 'PHYSICAL_COUNT')
```

---

## ① Count Apply Columns

| Screen Field | DB (Source) | Role / Meaning · Operational Notes |
|------|------|------|
| Warehouse | `PHYSICAL_INV_COUNT_DETAILS.WAREHOUSE_CODE` | Target warehouse. |
| Item Code | `PHYSICAL_INV_COUNT_DETAILS.ITEM_CODE` | Counted item. |
| Material Serial | `PHYSICAL_INV_COUNT_DETAILS.MAT_UID` | LOT serial. |
| System Qty | `PHYSICAL_INV_COUNT_DETAILS.SYSTEM_QTY` | Snapshot at session start (immutable). |
| Counted Qty | `PHYSICAL_INV_COUNT_DETAILS.COUNTED_QTY` | PDA cumulative value or PC direct input. **Editable before apply**. |
| Difference | `COUNTED_QTY - SYSTEM_QTY` | Positive = physical count higher, Negative = physical count lower. |

---

## Apply Processing Details

`POST /material/physical-inv` → `PhysicalInvService.applyCount()` performs:

1. Look up `MatStock` by each `PhysicalInvItemDto.stockId` (warehouseCode::itemCode::matUid)
2. Set `MatStock.qty` to `countedQty`
3. Recalculate `MatStock.availableQty` (`qty - reservedQty`)
4. Update `MatStock.lastCountAt`
5. Create `StockTransaction`:
   - `PHYSCOUNT_IN`: records the increase if difference is positive
   - `PHYSCOUNT_OUT`: records the decrease if difference is negative
6. Record `InvAdjLog`: `adjType = 'PHYSICAL_COUNT'`, stores `diffQty`

---

## Pre-Apply Checklist
- Verify **PDA scanning is complete** (check for missed scans).
- Items with **counted qty of 0** are considered to have no actual stock, but consider the possibility of a missed PDA scan.
- Items with **large differences** may need re-verification (theft, loss, receipt/issue errors).
- Apply cautiously since `MAT_STOCKS` is directly modified after application.

## Permissions
Users with physical inventory apply authority (material/quality manager).

## Troubleshooting

| Symptom | Cause | Action |
|------|------|------|
| Apply button disabled | No mismatched items under selected criteria (all match) | Apply unnecessary if counts match exactly |
| "MatStock not found" error | No stock record for the given `stockId` | Check receipt history for the item |
| Counted qty not editable | Field is readonly or value treated as string | Enter only numeric values (integer ≥ 0) |
| Quantity differs from PDA after apply | System quantity changed before apply | Check receipt/issue history; re-count may be needed |
| Difference remains after apply | Quantity changed by another session or adjustment | Re-check stock status and analyze cause |

## Data & Integration
- **Tables**: `PHYSICAL_INV_COUNT_DETAILS`, `MAT_STOCKS`, `STOCK_TRANSACTIONS`, `INV_ADJ_LOGS`
- **Integration**: Physical inventory management (session), material stock status
- **Scope**: `COMPANY='40'`, `PLANT_CD='1000'`
