---
menuCode: MST_BOM
audience: operator
title: BOM Management — Operator Guide
summary: BOM_MASTERS full columns·composite key, recursive expansion, Excel upload, item/routing integration, troubleshooting
tags: [reference data, BOM, bill of materials, operations]
keywords: [BOM_MASTERS, PARENT_ITEM_CODE, CHILD_ITEM_CODE, REVISION, QTY_PER, OPER, recursive expansion, Excel upload, ECO_NO, multi-tenancy]
related: [MST_PART]
---

# BOM Management — Operator Guide

## System Purpose & Role
This screen manages **`BOM_MASTERS`**, which defines parent-child item composition. It serves as the basis for material requirement expansion (quantity calculation) and input during production, using a self-referencing structure (child items can themselves be parents) to represent multi-level BOMs.

## Data Structure
```
BOM_MASTERS (composite PK: PARENT_ITEM_CODE + CHILD_ITEM_CODE + REVISION)
   ├─ PARENT_ITEM_CODE ─▶ ITEM_MASTERS (parent item)
   └─ CHILD_ITEM_CODE  ─▶ ITEM_MASTERS (child item) ─▶ (child as parent for recursion) BOM_MASTERS
```
- **Composite PK**: `PARENT_ITEM_CODE + CHILD_ITEM_CODE + REVISION` (no UUID id).
- Tree query API: `GET /master/boms/hierarchy/:parentPartId` (recursive expansion).

## All Columns — BOM_MASTERS

| Screen Field | DB Column | Meaning · Operational Notes |
|------|------|------|
| Parent Item | `PARENT_ITEM_CODE` | PK. References `ITEM_MASTERS.ITEM_CODE`. |
| Child Item Code | `CHILD_ITEM_CODE` | PK. References `ITEM_MASTERS.ITEM_CODE`. |
| Revision | `REVISION` | PK. Default `A`. Distinguishes composition versions. |
| Qty Per | `QTY_PER` | NUMBER(10,4). Quantity of child item per 1 parent. |
| Sequence | `SEQ` | Display/processing order (default 0). |
| BOM Group | `BOM_GRP` | Group classification (indexed). |
| Operation | `OPER` | Input process code (entity field name processCode). |
| Side | `SIDE` | Application side (TOP/BOT etc.). |
| ECO No. | `ECO_NO` | Engineering change order tracking number. |
| Valid From | `VALID_FROM` | DATE. Application start date. |
| Valid To | `VALID_TO` | DATE. Application end date (not applied outside period). |
| Remark | `REMARK` | Notes. |
| Use Flag | `USE_YN` | Only Y is a valid composition. |
| Child Name/Type | (join) | `ITEM_MASTERS.ITEM_NAME / ITEM_TYPE` — for display and expansion (not in BOM_MASTERS). |
| Level (Lv) | (calculated) | Tree depth. Not a stored value. |
| Audit | `CREATED_BY/UPDATED_BY/CREATED_AT/UPDATED_AT` | History. |
| Multi-tenancy | `COMPANY`, `PLANT_CD` | `40` / `1000` scope. |

## Excel Upload
- Bulk register multiple BOM entries via Excel template (upload modal). Parent/child item codes must exist in `ITEM_MASTERS`. Key (parent+child+revision) duplicates follow reject/update policy.

## Recursive Expansion / Routing Integration
- If a child item is a semi-product, its own BOM (as parent) expands further (multi-level). Production requirement expansion follows this recursion for cumulative calculation.
- Each BOM row's `OPER` (operation) connects where the material is input in the process, viewed alongside routing.

## Prerequisites
- Parent/child items must be registered in `ITEM_MASTERS` first.
- Operation codes (OPER) based on operation master.

## Permissions
Reference data administrator (create/update/upload). General users can only view.

## Troubleshooting
| Symptom | Cause | Action |
|------|------|------|
| Code error when adding child | Child item not in ITEM_MASTERS | Register in Item Master first |
| Same child item rejected | Parent+child+revision key duplicate | Use different revision or modify existing row |
| Child not expanding in tree | Child itself has no BOM registered | Register child's BOM as parent |
| Production expansion quantity wrong | QTY_PER misentered / outside valid period | Check qty, VALID_FROM/TO |
| Composition not applied | USE_YN='N' or validity period expired | Check USE_YN and validity period |

## Data & Integration
- Table: `BOM_MASTERS`
- Integration: Item Master (`ITEM_MASTERS`), Operation/Routing (OPER), Production requirement expansion
- Scope: `COMPANY='40'`, `PLANT_CD='1000'`
