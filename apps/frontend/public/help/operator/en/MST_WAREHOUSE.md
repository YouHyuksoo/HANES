---
menuCode: MST_WAREHOUSE
audience: operator
title: Warehouse/Location Management — Operator Guide
summary: Full column DB mapping for warehouse·location·transfer rule tables, warehouse type code values, auto-created warehouses, permissions, troubleshooting, multi-tenancy scope
tags: [reference data, warehouse, location, transfer rules, operations]
keywords: [WAREHOUSES, WAREHOUSE_LOCATIONS, WAREHOUSE_TRANSFER_RULES, WAREHOUSE_TYPE, WAREHOUSE_GROUP, FROM_WAREHOUSE_ID, TO_WAREHOUSE_ID, ALLOW_YN, IS_DEFAULT, warehouse type, FLOOR, SUBCON, natural key, composite key, multi-tenancy, COMPANY, PLANT_CD]
related: [MST_PART]
---

# Warehouse/Location Management — Operator Guide

## System Purpose & Role
This master screen manages **warehouses** (physical/logical units where stock is stored and moved), **locations** within warehouses, and **transfer rules** between warehouses. Receiving, issue, stock (`MAT_STOCK`/`PRODUCT_STOCKS`), production results, and inventory moves all reference this master via `WAREHOUSE_CODE`.

## Data Structure
```
WAREHOUSES (PK: COMPANY, PLANT_CD, WAREHOUSE_CODE)
   ├─ WAREHOUSE_LOCATIONS (PK: COMPANY, PLANT_CD, WAREHOUSE_CODE, LOCATION_CODE)
   │        Warehouse 1 : N Locations (linked by WAREHOUSE_CODE)
   └─ WAREHOUSE_TRANSFER_RULES (PK: COMPANY, PLANT_CD, FROM_WAREHOUSE_ID, TO_WAREHOUSE_ID)
            FROM/TO_WAREHOUSE_ID values = WAREHOUSES.WAREHOUSE_CODE (code stored, column name only _ID)
```
> **Note**: `FROM_WAREHOUSE_ID`/`TO_WAREHOUSE_ID` in `WAREHOUSE_TRANSFER_RULES` only have `_ID` in name — the actual stored value is **warehouse code (WAREHOUSE_CODE)**. The service JOINs `fw.WAREHOUSE_CODE = rule.FROM_WAREHOUSE_ID` to retrieve origin/destination warehouse names. This is a natural key join, not an FK constraint column.

CRUD APIs by area:
- Warehouses: `GET/POST/PUT/DELETE /inventory/warehouses[/{code}]`
- Locations: `GET/POST/PUT/DELETE /inventory/warehouse-locations[/{warehouseCode}::{locationCode}]`
- Transfer rules: `GET/POST/PUT/DELETE /master/transfer-rules[/{fromId}/{toId}]`

---

## ① Warehouse Management — WAREHOUSES (All Columns)

| Screen Field | DB Column | Role / Meaning · Operational Notes |
|------|------|------|
| Warehouse Code | `WAREHOUSE_CODE` | PK component. Natural key, immutable (referential integrity). |
| Warehouse Name | `WAREHOUSE_NAME` | Display name. |
| Warehouse Type | `WAREHOUSE_TYPE` | Usage classification. DTO `@IsIn` validation values: `RAW`(raw material)/`WIP`(semi-product)/`FG`(finished goods)/`FLOOR`(WIP stock)/`DEFECT`(defect)/`SCRAP`(scrap)/`SUBCON`(subcontractor). Common code `WAREHOUSE_TYPE`. |
| (Hidden) Warehouse Group | `WAREHOUSE_GROUP` | Column designed so moves within same group are immediate, while moves to different groups require manager approval. Currently no input UI on this screen (nullable). |
| Line | `LINE_CODE` | Production line for FLOOR warehouse. Only shown in form when type is FLOOR. |
| Operation | `PROCESS_CODE` | Process for FLOOR warehouse. Only shown in form when type is FLOOR. |
| (Hidden) Plant Code | `PLANT_CODE` | Auxiliary plant code column (separate from multi-tenancy `PLANT_CD`, nullable). |
| (Hidden) Equipment Code | `EQUIP_CODE` | Equipment-linked WIP warehouse column (nullable). |
| (Hidden) Vendor ID | `VENDOR_ID` | Filled with vendor identifier on auto-creation of subcontract (SUBCON) warehouse (nullable). |
| Default | `IS_DEFAULT` | `'Y'`/`'N'`. Default warehouse for the same type. `getDefaultWarehouse(type)` selects auto-staging target with `IS_DEFAULT='Y' AND USE_YN='Y'`. |
| Use Flag | `USE_YN` | Only `'Y'` active. Soft deactivation recommended over deletion. |
| Audit | `CREATED_BY`, `UPDATED_BY`, `CREATED_AT`, `UPDATED_AT` | Creation/update history. CREATED_AT/UPDATED_AT default SYSTIMESTAMP. |
| Multi-tenancy | `COMPANY`, `PLANT_CD` | Part of PK. `40` / `1000` scope. |

## ② Location — WAREHOUSE_LOCATIONS (All Columns)

| Screen Field | DB Column | Role / Meaning · Operational Notes |
|------|------|------|
| Warehouse | `WAREHOUSE_CODE` | PK component + parent warehouse reference. Immutable after registration. |
| Location Code | `LOCATION_CODE` | PK component. (Warehouse+Location) combination is unique. Immutable. |
| Location Name | `LOCATION_NAME` | Display name. |
| Zone | `ZONE` | Zone classification within warehouse (nullable). |
| Row | `ROW_NO` | Rack/shelf row number (nullable, varchar). |
| Column | `COL_NO` | Rack/shelf column number (nullable, varchar). |
| Level | `LEVEL_NO` | Rack/shelf level number (nullable, varchar). |
| Use Flag | `USE_YN` | Only `'Y'` active. Displayed with ● dot in list. |
| Remark | `REMARK` | Notes (nullable). |
| Audit | `CREATED_BY`, `UPDATED_BY`, `CREATED_AT`, `UPDATED_AT` | Creation/update history. |
| Multi-tenancy | `COMPANY`, `PLANT_CD` | Part of PK. `40` / `1000` scope. |

> Update/delete APIs pass the composite key as `{WAREHOUSE_CODE}::{LOCATION_CODE}` (with `::` separator).

## ③ Warehouse Transfer Rules — WAREHOUSE_TRANSFER_RULES (All Columns)

| Screen Field | DB Column | Role / Meaning · Operational Notes |
|------|------|------|
| Origin Warehouse (code/name) | `FROM_WAREHOUSE_ID` | PK component. **Value = origin warehouse code**. Joined with `WAREHOUSES.WAREHOUSE_CODE` to display code·name. |
| Destination Warehouse (code/name) | `TO_WAREHOUSE_ID` | PK component. **Value = destination warehouse code**. Joined the same way. |
| Allow Flag | `ALLOW_YN` | `'Y'`=move allowed, `'N'`=prohibited. Default `'Y'`. |
| Remark | `REMARK` | Notes (nullable). |
| Audit | `CREATED_BY`, `UPDATED_BY`, `CREATED_AT`, `UPDATED_AT` | Creation/update history. |
| Multi-tenancy | `COMPANY`, `PLANT_CD` | Part of PK. `40` / `1000` scope. |

> (Origin→Destination) pair must be unique. Duplicate registration returns 409 Conflict. Update/delete APIs pass composite key via `/{fromWarehouseId}/{toWarehouseId}` path.

---

## Auto-Created Warehouses (Code-Based Behavior)
Some warehouses are automatically created by the system during operations (separate from screen registration):
- **WIP Floor (FLOOR/WIP)**: `getOrCreateFloorWarehouse(lineCode, processCode)` → code `FLOOR_{line}_{process}`, type `WIP`, fills line·process.
- **Subcontract (SUBCON)**: `getOrCreateSubconWarehouse(vendorId, vendorName)` → code `SUBCON_{vendorID}`, type `SUBCON`, fills `VENDOR_ID`.
- **Default Warehouse Initialization**: `initDefaultWarehouses()` creates `RM_MAIN/RM_SUB/WIP_MAIN/FG_MAIN/FG_SHIP/DEFECT/SCRAP/SUBCON_MAIN` etc. (Some type values in this seed may use `RM` — which may differ from the screen filter code value `RAW` — be aware when inspecting data.)

## Prerequisites (Master·Common Code)
- Common codes: `WAREHOUSE_TYPE`(warehouse type), `USE_YN`
- Line·process codes (FLOOR warehouse): Line/operation master must be pre-registered for selection.

## Operating Procedure
1. Register operational warehouses in Warehouse Management (set type·default warehouse).
2. Register locations (zone/row/column/level) for needed warehouses.
3. Register transfer rules (allow/prohibit) for warehouse pairs requiring control.
4. For discontinued warehouses, deactivate with `USE_YN='N'` instead of deletion (preserves stock/history).

## Permissions
Reference data administrator (create/update/delete). General users can only view.

## Troubleshooting
| Symptom | Cause | Action |
|------|------|------|
| Warehouse deletion failed | Stock exists in the warehouse (`Cannot delete warehouse with stock`) | Transfer/empty stock first, then delete, or use `USE_YN='N'` deactivation |
| Line·process fields not showing in form | Warehouse type is not FLOOR | Change type to `FLOOR` (WIP stock) |
| Auto-staging goes to wrong warehouse | Missing/duplicate `IS_DEFAULT='Y'` warehouse per type | Set exactly 1 default warehouse per type |
| 409 on transfer rule save | Same (origin→destination) pair already exists | Modify existing rule instead |
| Origin/destination name blank in transfer rule | Warehouse code pointed by FROM/TO_WAREHOUSE_ID not in WAREHOUSES | Verify warehouse code consistency (correct to valid code) |
| Warehouse/location not in selection list | `USE_YN='N'` | Activate use flag to Y |

## Data & Integration
- Tables: `WAREHOUSES`, `WAREHOUSE_LOCATIONS`, `WAREHOUSE_TRANSFER_RULES`
- Integration: Receiving/Issue, Stock (`MAT_STOCK`, `PRODUCT_STOCKS`), Production Results, Inventory Move, Item Master (default storage location)
- Scope: `COMPANY='40'`, `PLANT_CD='1000'`
