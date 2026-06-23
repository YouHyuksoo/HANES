---
menuCode: MAT_HOLD
audience: operator
title: Material Stock Hold Management — Operator Guide
summary: MAT_LOTS.status based hold mechanism, related tables, stock impact and troubleshooting
tags: [material, hold, operations, LOT, quality]
keywords: [MAT_LOTS, STATUS, HOLD, NORMAL, DEPLETED, stock hold, quality hold, LOT block, issue block, MAT_STOCKS]
related: [INV_MAT_STOCK]
---

# Material Stock Hold Management — Operator Guide

## System Purpose & Role
Changes `MAT_LOTS.STATUS` from `NORMAL` to `HOLD` (or `HOLD` to `NORMAL`) to block or release usage of specific LOTs. Held LOTs still exist as stock in `MAT_STOCKS` but cannot be issued or input to production (the system checks `status = 'HOLD'` to block).

## Data Structure
```
MAT_LOTS (PK: MAT_UID)
    │
    ├── STATUS (NORMAL / HOLD / DEPLETED / SPLIT / MERGED)
    ├── ITEM_CODE → ITEM_MASTERS (itemName, unit)
    ├── VENDOR → PARTNER_MASTERS (vendorName)
    │
    └──▶ MAT_STOCKS (PK: COMPANY + PLANT_CD + WAREHOUSE_CODE + ITEM_CODE + MAT_UID)
            └── Stock quantity is retained, but HOLD status LOTs are excluded from available stock
```

---

## ① LOT — MAT_LOTS (Hold-Related Columns)

| Screen Field | DB Column | Role / Meaning · Operational Notes |
|------|------|------|
| Material Serial | `MAT_UID` | **PK**. LOT/serial number. |
| Item Code | `ITEM_CODE` | Item. References `ITEM_MASTERS`. |
| Current Balance | `CURRENT_QTY` | Current stock quantity of the LOT. |
| Status | `STATUS` | `NORMAL` (normal) / `HOLD` (hold) / `DEPLETED` (depleted) / `SPLIT` (split) / `MERGED` (merged). |
| Vendor Code | `VENDOR` | Supplier code. References `PARTNER_MASTERS`. |
| IQC Status | `IQC_STATUS` | `PENDING` / `PASS` / `FAIL` / `HOLD`. |
| Company | `COMPANY` | Multi-tenancy. |
| Plant | `PLANT_CD` | Multi-tenancy. |
| Manufacture Date | `MANUFACTURE_DATE` | Date of manufacture. |
| Expiry Date | `EXPIRE_DATE` | Shelf life expiration date. |

---

## Hold Mechanism

| Action | Prerequisite | DB Change | Stock Effect |
|------|---------|---------|----------|
| **Hold** | LOT exists, `STATUS ≠ HOLD`, `STATUS ≠ DEPLETED` | `MAT_LOTS.STATUS = 'HOLD'` | Stock retained but excluded from available stock |
| **Release** | LOT exists, `STATUS = 'HOLD'` | `MAT_LOTS.STATUS = 'NORMAL'` | Re-included in available stock |

> **Note**: `DEPLETED` LOTs cannot be held, and held LOTs are blocked from all stock changes including issue and production input.

---

## Hold Use Cases
| Scenario | Description |
|------|------|
| Quality defect | Hold LOT on IQC FAIL or defect found during production |
| Expired shelf life | Hold expired LOTs then process disposal |
| Vendor claim | Preemptive hold when a vendor's LOT is suspected of issues |
| System error correction | Temporarily block LOTs with abnormal quantities due to receipt/issue errors |

## Permissions
Users with stock hold authority (quality/material manager).

## Troubleshooting

| Symptom | Cause | Action |
|------|------|------|
| Hold button not visible | LOT already in HOLD status | Release button shown instead |
| "Cannot hold depleted LOT" error | LOT already depleted | Hold not needed for depleted LOTs |
| Hold release not working | LOT status is not HOLD | Check current status |
| Held LOT can still be issued | Issue process does not check `MAT_LOTS.STATUS` | Add HOLD check logic in issue service |
| Reason not saved | Current service does not store `reason` field in DB | Extend audit history if needed |
| Held LOT stock still counted | `MAT_STOCKS.qty` unchanged (status only) | Manage HOLD LOTs separately in total stock |

## Data & Integration
- **Tables**: `MAT_LOTS` (LOT status), `MAT_STOCKS` (stock)
- **Reference**: `ITEM_MASTERS` (item name), `PARTNER_MASTERS` (vendor name)
- **Scope**: `COMPANY='40'`, `PLANT_CD='1000'`
- **Note**: Product stock (`PRODUCT_STOCKS`) has separate `HOLD_REASON`, `HOLD_AT`, `HOLD_BY` columns, which differs from the material structure
