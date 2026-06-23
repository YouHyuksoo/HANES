---
menuCode: INV_MAT_STOCK
audience: operator
title: Material Stock Status — Operator Guide
summary: MAT_STOCKS table full columns, stock status judgment logic, LOT linkage structure and troubleshooting
tags: [stock, material, operations, view, safety stock]
keywords: [MAT_STOCKS, MAT_LOTS, stock inquiry, safety stock, available stock, QTY, RESERVED_QTY, AVAILABLE_QTY, serial, SAFETY_STOCK, expiry date, ITEM_MASTERS]
related: [INV_TRANSACTION, INV_MAT_PHYSICAL_INV]
---

# Material Stock Status — Operator Guide

## System Purpose & Role
Real-time material stock status query by warehouse and item based on the `MAT_STOCKS` table. Displays stock shortage against the item master's safety stock (`ITEM_MASTERS.SAFETY_STOCK`) and LOT expiry status against `MAT_LOTS.EXPIRE_DATE` to support inventory management decisions.

## Data Structure
```
MAT_STOCKS (PK: COMPANY + PLANT_CD + WAREHOUSE_CODE + ITEM_CODE + MAT_UID)
    │
    ├── QTY (total) = RESERVED_QTY (reserved) + AVAILABLE_QTY (available)
    │
    ├──▶ ITEM_MASTERS.ITEM_CODE — item name, unit, safety stock
    │
    ├──▶ MAT_LOTS.MAT_UID — manufacture date, expiry date
    │
    └──▶ WAREHOUSES.WAREHOUSE_CODE — warehouse name
```

---

## ① Stock — MAT_STOCKS (All Columns)

| Screen Field | DB Column | Role / Meaning · Operational Notes |
|------|------|------|
| Company | `COMPANY` | **PK (1/5)**. Multi-tenancy. `'40'`. |
| Plant | `PLANT_CD` | **PK (2/5)**. Multi-tenancy. `'1000'`. |
| Warehouse Code | `WAREHOUSE_CODE` | **PK (3/5)**. Storage warehouse. |
| Item Code | `ITEM_CODE` | **PK (4/5)**. Stock item. References `ITEM_MASTERS.ITEM_CODE`. |
| Material Serial | `MAT_UID` | **PK (5/5)**. LOT-level identifier. References `MAT_LOTS.MAT_UID`. |
| Location | `LOCATION_CODE` | Detailed storage location within warehouse (optional). |
| Total Qty | `QTY` | Total stock quantity currently in the warehouse. |
| Reserved Qty | `RESERVED_QTY` | Quantity reserved by issue requests etc. |
| Available Qty | `AVAILABLE_QTY` | Immediately usable quantity (= QTY - RESERVED_QTY). |
| Last Count | `LAST_COUNT` | Timestamp of the last physical count. |
| Created By | `CREATED_BY` | Initial registrant. |
| Updated By | `UPDATED_BY` | Last modifier. |
| Created At | `CREATED_AT` | Initial registration time. |
| Updated At | `UPDATED_AT` | Last modification time. |

> **Stock Quantity Relationship**: `QTY = RESERVED_QTY + AVAILABLE_QTY`. The actual quantity available for issue is `AVAILABLE_QTY`.

---

## Stock Status Judgment Logic

Compares the item master's `SAFETY_STOCK` with actual quantity (`QTY`) and displays three levels:

| Status | Condition | Display |
|------|------|------|
| **Shortage** | `QTY < SAFETY_STOCK × 0.5` | Red badge |
| **Caution** | `QTY < SAFETY_STOCK` | Yellow badge |
| **Normal** | `QTY ≥ SAFETY_STOCK` | Green badge |

## Shelf Life Status Judgment Logic

Compares the LOT's `EXPIRE_DATE` with the current date and displays three levels:

| Status | Condition | Display |
|------|------|------|
| **Expired** | `remainingDays ≤ 0` | Red badge + red row background |
| **Imminent** | `remainingDays ≤ 10` | Yellow badge + yellow row background |
| **Normal** | `remainingDays > 10` | Green badge |

---

## Operating Procedure
1. Regularly check stock status for items below safety stock and LOTs approaching expiry.
2. For items below safety stock, consider ordering or transferring from other warehouses.
3. Dispose of or return expired LOTs; plan priority use for imminent LOTs.

## Permissions
All users with stock inquiry authority (master, production, material managers). Read-only (no modification).

## Troubleshooting

| Symptom | Cause | Action |
|------|------|------|
| Specific item not showing | No stock in that warehouse (no row in `MAT_STOCKS`) | Process receipt or adjustment |
| Quantity differs from actual | Missing or duplicate receipt/issue | Check transaction history and adjust |
| Available qty less than total qty | Issue requests (LOT reservations) exist | Check reservation status; cancel if needed |
| Expired LOT shown in red | `remainingDays ≤ 0` | Dispose, return, or use after quality approval |
| Safety stock status inaccurate | `SAFETY_STOCK` not set or incorrect | Verify and update safety stock in item master |

## Data & Integration
- **Tables**: `MAT_STOCKS` (stock), `MAT_LOTS` (LOT info), `ITEM_MASTERS` (items), `WAREHOUSES` (warehouses)
- **Integration**: Material receipt → `MAT_STOCKS` increase, material issue → `MAT_STOCKS` decrease, stock adjustment → `MAT_STOCKS` change
- **Scope**: `COMPANY='40'`, `PLANT_CD='1000'`
