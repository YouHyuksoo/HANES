---
menuCode: CONS_MASTER
audience: operator
title: Consumable Master — Operator Guide
summary: Full column DB mapping for consumable master (CONSUMABLE_MASTERS), usage mapping (CONSUMABLE_USAGE_MAP) relationships, life/status logic, common codes, permissions, troubleshooting, multi-tenancy scope
tags: [consumable, master, reference data, operations]
keywords: [CONSUMABLE_MASTERS, CONSUMABLE_USAGE_MAP, CONSUMABLE_STOCKS, CONSUMABLE_LOGS, CONSUMABLE_CATEGORY, MOLD, JIG, TOOL, expected life, warning threshold, safety stock, USAGE_PER_UNIT, usage mapping, equipment parts, product BOM, multi-tenancy, COMPANY, PLANT_CD]
related: [MST_PART]
---

# Consumable Master — Operator Guide

## System Purpose & Role
This screen manages the **reference data master `CONSUMABLE_MASTERS`** for **consumables (molds, jigs, tools)** used in production. Individual stock instances (`CONSUMABLE_STOCKS`), receipt/issue history (`CONSUMABLE_LOGS`), product/equipment usage mapping (`CONSUMABLE_USAGE_MAP`), and kiosk production consumable input all reference this master via `CONSUMABLE_CODE`.

> API reference: List `GET /consumables`, detail `GET /consumables/:id`, create `POST /consumables`, update `PUT /consumables/:id`, delete `DELETE /consumables/:id`, image `POST|DELETE /consumables/:id/image`, usage mappings `GET|POST /consumables/:id/usage-maps`·`PUT|DELETE /consumables/:id/usage-maps/:productItemCode/:equipCode`. (The `SELECT ... FROM CONSUMABLES` in the grid is a display label; the actual table name is `CONSUMABLE_MASTERS`.)

## Data Structure
```
CONSUMABLE_MASTERS (PK: CONSUMABLE_CODE)
   ├─ 1:N ─▶ CONSUMABLE_STOCKS   (individual instances CON_UID, receiving/mounting status tracking)
   ├─ 1:N ─▶ CONSUMABLE_LOGS     (receipt/issue/shot/replacement history)
   └─ 1:N ─▶ CONSUMABLE_USAGE_MAP(product model × equipment × consumable usage)
                  ├─ PRODUCT_ITEM_CODE ─▶ ITEM_MASTERS.ITEM_CODE (product/model)
                  └─ EQUIP_CODE        ─▶ EQUIP_MASTERS.EQUIP_CODE (equipment)
```

## Two Types of Consumables (Operational Meaning)
The master is unified, but there are two usage paths:
- **Equipment Mounting Type** (molds, jigs, blades): Mounted on equipment with accumulated shot count (`CURRENT_COUNT`), replaced when `EXPECTED_LIFE` is reached. Appears in the kiosk's lower-left "Consumable Equipment Parts" section. Follows `CONSUMABLE_USAGE_MAP` equipment×consumable mapping.
- **Product BOM Input Type**: Input as `CONSUMABLE` items in the product BOM, deducted by production quantity. Displayed in the kiosk based on the product BOM on the left side.

---

## ① Basic Info — CONSUMABLE_MASTERS (All Columns)

| Screen Field | DB Column | Role / Meaning · Operational Notes |
|------|------|------|
| Consumable Code | `CONSUMABLE_CODE` | PK (natural key). Connection key for receipt/issue/stock/usage mapping. Immutable (locked in edit mode). |
| Consumable Name | `NAME` | Display name (entity property name is `consumableName`). |
| Category | `CATEGORY` | Common code `CONSUMABLE_CATEGORY`(MOLD/JIG/TOOL). DTO enum is `['MOLD','JIG','TOOL']`. Saved as null if not selected. |
| Image | `IMAGE_URL` | Upload path (`/uploads/consumables/...`). Only uploadable after master is saved (`POST /consumables/:id/image`). |

## ② Life / Management — CONSUMABLE_MASTERS

| Screen Field | DB Column | Role / Meaning · Operational Notes |
|------|------|------|
| Expected Life | `EXPECTED_LIFE` | Cumulative shot count upper limit (INT). `CURRENT_COUNT ≥ EXPECTED_LIFE` → `STATUS='REPLACE'`. No auto-transition if null. |
| Warning Threshold | `WARNING_COUNT` | Shot count for replacement imminent alert (INT). `CURRENT_COUNT ≥ WARNING_COUNT` → `STATUS='WARNING'`. Typically `< EXPECTED_LIFE`. |
| Safety Stock | `SAFETY_STOCK` | Threshold for stock shortage judgment (INT, default 0). Shortage when stock falls below this. |
| (Auto) Current Shot Count | `CURRENT_COUNT` | Cumulative usage count (INT, default 0). Accumulated via kiosk/shot API (`POST /consumables/shot-count`), reset to 0 on replacement (`/consumables/reset`). No direct input in form. |
| (Auto) Status | `STATUS` | NORMAL/WARNING/REPLACE. Auto-transitions on shot accumulation. |
| (Auto) Operation Status | `OPER_STATUS` | WAREHOUSE(storage)/MOUNTED(installed) etc. Updated in mounting flow. |
| (Auto) Mounted Equipment | `MOUNTED_EQUIP_ID` | Currently mounted equipment code (property name `mountedEquipCode`). |
| (Auto) Stock Quantity | `STOCK_QTY` | Held quantity adjusted by receipt/issue history (INT, default 0). |
| (Auto) Replacement Dates | `LAST_REPLACE`, `NEXT_REPLACE` | Last/next replacement time (TIMESTAMP). |

## ③ Vendor / Location — CONSUMABLE_MASTERS

| Screen Field | DB Column | Role / Meaning · Operational Notes |
|------|------|------|
| Location | `LOCATION` | Default storage location. |
| Vendor | `VENDOR` | Supply vendor/manufacturer. |
| Unit Price | `UNIT_PRICE` | NUMBER(12,2). Reference for receipt cost and asset valuation. |
| Use Flag | `USE_YN` | Only `Y` shown in list/selection (fixed to `useYn='Y'` in list query). |
| Audit | `CREATED_BY`, `UPDATED_BY`, `CREATED_AT`, `UPDATED_AT` | Creation/update history. |
| Multi-tenancy | `COMPANY`, `PLANT_CD` | `40` / `1000` scope (entity property names `company`, `plant`). |

## ④ Usage Mapping — CONSUMABLE_USAGE_MAP (All Columns)

Defines **which product (model) and equipment** uses the selected consumable. The kiosk queries required consumables based on the work order (product) + equipment.

| Screen Field | DB Column | Role / Meaning · Operational Notes |
|------|------|------|
| Product/Model | `PRODUCT_ITEM_CODE` | PK component. References `ITEM_MASTERS.ITEM_CODE`. Options are only `FINISHED`/`SEMI_PRODUCT` items. Validates existence and `USE_YN='Y'` on registration. |
| Equipment | `EQUIP_CODE` | PK component. References `EQUIP_MASTERS.EQUIP_CODE`. Validates existence and `USE_YN='Y'` on registration. |
| (Key) Consumable | `CONSUMABLE_CODE` | PK component. Selected master. |
| Usage Per Unit | `USAGE_PER_UNIT` | NUMBER(default 1). Consumable shots consumed per unit of production. Shot count accumulates as production quantity × this value. |
| Use Flag | `USE_YN` | `Y`/`N`. Toggled via `Y` badge in list. |
| Remark | `REMARK` | Mapping notes. |
| (Key) Multi-tenancy | `COMPANY`, `PLANT_CD` | PK component. `40` / `1000`. |

> Composite PK: `COMPANY + PLANT_CD + PRODUCT_ITEM_CODE + EQUIP_CODE + CONSUMABLE_CODE`. Re-registering the same combination is an upsert (quantity/use flag/remark updated).

## Life / Status Logic
1. Shot accumulation (`POST /consumables/shot-count`, `addCount`): `CURRENT_COUNT += addCount`.
2. If `EXPECTED_LIFE` is set and `CURRENT_COUNT ≥ EXPECTED_LIFE` → `STATUS='REPLACE'`.
3. Otherwise, if `WARNING_COUNT` is set and `CURRENT_COUNT ≥ WARNING_COUNT` → `STATUS='WARNING'`.
4. Replacement (`POST /consumables/reset`): `CURRENT_COUNT=0`, `STATUS='NORMAL'`, `LAST_REPLACE`=now, `NEXT_REPLACE`=now+`EXPECTED_LIFE` days.
5. Receipt/issue (`POST /consumables/logs`·`receiving`·`issuing`): `STOCK_QTY` adjusted (negative stock blocked on issue).

## Prerequisites (Master·Common Code)
- Common code: `CONSUMABLE_CATEGORY`(MOLD/JIG/TOOL)
- Usage mapping prerequisites: Product/model must be registered in [Item Master](`ITEM_MASTERS`, `FINISHED`/`SEMI_PRODUCT`) and equipment in Equipment Master (`EQUIP_MASTERS`) with `USE_YN='Y'` to be selectable.

## Operating Procedure
1. Register `CONSUMABLE_MASTERS` (code, name, category) → save.
2. Upload image (after save) → fill in life/management and vendor/location.
3. Register usage mapping (`CONSUMABLE_USAGE_MAP`) with product, equipment, usage per unit.
4. Receipt, shot accumulation, and replacement are automatically reflected via receipt/issue/kiosk/shot APIs.

## Permissions
Reference data administrator (create/update/delete/mapping). General users can only view.

## Troubleshooting
| Symptom | Cause | Action |
|------|------|------|
| Image upload disabled on registration | Master not saved (new mode) | Save basic info first, then reopen and upload |
| Code duplicate error on save (409) | Same `CONSUMABLE_CODE` already exists | Check code (immutable key) or update existing entry |
| "Product/equipment not found" on usage mapping save (404) | Item/equipment not registered or `USE_YN='N'` | Activate in Item Master/Equipment Master, then map |
| Usage mapping product list empty | Item type is not `FINISHED`/`SEMI_PRODUCT` | Register item with the correct type |
| Not showing in list | `USE_YN='N'` or category/search filter | Check use flag, filter, and search term |
| Stock shortage error on issue (400) | Insufficient `STOCK_QTY` | Try again after receiving |
| Status not changing after shot accumulation | `EXPECTED_LIFE`/`WARNING_COUNT` not set (null) | Set expected life and warning threshold |
| Thumbnail/image broken | `IMAGE_URL` file missing (404) | Reupload (frontend has placeholder fallback) |

## Data & Integration
- Tables: `CONSUMABLE_MASTERS`(master), `CONSUMABLE_STOCKS`(individual instances), `CONSUMABLE_LOGS`(receipt/issue/shot/replacement history), `CONSUMABLE_USAGE_MAP`(usage mapping)
- Integration: Item Master (`ITEM_MASTERS`), Equipment Master (`EQUIP_MASTERS`), Kiosk production results (consumable input), Material integration flow (consumable arrival LOT → `MAT_STOCKS` loading·auto-issue deduction)
- Scope: `COMPANY='40'`, `PLANT_CD='1000'`
