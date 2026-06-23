---
menuCode: EQUIP_INSPECT_ITEM
audience: operator
title: Equipment Inspection Items — Operator Guide
summary: Full column DB mapping of 2 tables (item master pool + equipment-item assignment), 4 inspection types (daily/periodic/PM/worker), item add/delete procedure, QR label printing
tags: [reference data, equipment, inspection, operations]
keywords: [EQUIP_INSPECT_ITEM_MASTERS, EQUIP_INSPECT_ITEM_POOL, EQUIP_CODE, ITEM_CODE, INSPECT_TYPE, DAILY, PERIODIC, PM, WORKER, ITEM_TYPE, VISUAL, MEASURE, CYCLE, equipment inspection, inspection item, inspection type, equipment type, visual, measurement, QR label, multi-tenancy]
related: [EQUIP_INSPECT_CALENDAR, EQUIP_DAILY]
---

# Equipment Inspection Items — Operator Guide

## System Purpose & Role
This screen manages **2 tables** that define inspection standards per equipment.

| Table | Role | PK |
|--------|------|----|
| `EQUIP_INSPECT_ITEM_MASTERS` | Inspection item pool — templates by equipment type | `COMPANY + PLANT_CD + ITEM_CODE` |
| `EQUIP_INSPECT_ITEM_POOL` | Equipment-item assignment — items actually assigned to specific equipment | `COMPANY + PLANT_CD + EQUIP_CODE + ITEM_CODE + INSPECT_TYPE` |

Select equipment on the left panel → view, add, or delete assigned items per 4 inspection type tabs on the right. Registered items are used for actual inspection input in daily inspection (`/equipment/daily-inspect`) and periodic inspection (`/equipment/periodic-inspect`) screens.

## Data Structure
```
EQUIP_INSPECT_ITEM_MASTERS (Pool: PK = COMPANY + PLANT_CD + ITEM_CODE)
   Stores inspection item templates by equipment type (filtered by EQUIP_TYPE)

EQUIP_INSPECT_ITEM_POOL (Assignment: PK = COMPANY + PLANT_CD + EQUIP_CODE + ITEM_CODE + INSPECT_TYPE)
   ├─ EQUIP_CODE ─▶ EQUIPMENTS (Equipment)
   └─ ITEM_CODE ─▶ EQUIP_INSPECT_ITEM_MASTERS (Inspection item master)

EQUIP_INSPECT_LOGS (Inspection history — reference)
   Links via EQUIP_CODE + ITEM_CODE + INSPECT_TYPE when inspection is performed
```

## Screen Layout
- **Left panel**: Equipment list (accordion groups by equipment type, search filter, `GET /equipment/equips`)
- **Right panel**: 4 inspection type tabs + DataGrid for assigned items
  - `DAILY` / `PERIODIC` / `PM` / `WORKER`
- **Slide panel**: `Add Inspection Item` button → 480px right panel opens → multi-select from master → bulk register

### Inspection Type (INSPECT_TYPE) Code Values

| Code | Display | Description |
|------|---------|-------------|
| `DAILY` | Daily | Basic inspection performed every day |
| `PERIODIC` | Periodic | Inspection performed at regular intervals |
| `PM` | Preventive Maintenance | Inspection per equipment maintenance plan |
| `WORKER` | Worker | Self-inspection by the operator |

### Cycle (CYCLE) Code Values

| Code | Display | Meaning |
|------|---------|---------|
| `DAILY` | Daily | 1-day cycle |
| `WEEKLY` | Weekly | 1-week cycle |
| `MONTHLY` | Monthly | 1-month cycle |
| `QUARTERLY` | Quarterly | 3-month cycle |
| `SEMI_ANNUAL` | Semi-annual | 6-month cycle |
| `ANNUAL` | Annual | 1-year cycle |

### Item Type (ITEM_TYPE) Code Values

| Code | Display | Description |
|------|---------|-------------|
| `VISUAL` | Visual | Visual pass/fail judgment (string criteria comparison) |
| `MEASURE` | Measurement | Measurement value recording (LSL/USL range judgment) |

---

## ① Inspection Item Master — EQUIP_INSPECT_ITEM_MASTERS (All Columns)

| Screen Field | DB Column | Role / Meaning · Operational Notes |
|------|------|------|
| Item Code | `ITEM_CODE` | PK. Input directly, immutable after registration. |
| Item Name | `ITEM_NAME` | Display name. Shown as-is on inspection screens. |
| Inspection Type | `INSPECT_TYPE` | `DAILY`/`PERIODIC`/`PM`/`WORKER`. Note: changing after registration requires updating Pool PK as well. |
| Equipment Type | `EQUIP_TYPE` | Common code `EQUIP_TYPE`. Used as filter in item selection panel. |
| Item Type | `ITEM_TYPE` | `VISUAL`(visual) / `MEASURE`(measurement). Default `VISUAL`. |
| Criteria | `CRITERIA` | Visual judgment criteria string (e.g., "No abnormality", "No cracks"). Measurement type uses reference + LSL/USL. |
| Cycle | `CYCLE` | `DAILY`/`WEEKLY`/`MONTHLY`/`QUARTERLY`/`SEMI_ANNUAL`/`ANNUAL`. |
| Unit | `UNIT` | Measurement unit (mm, kgf, ℃, etc.). Meaningful with LSL/USL for MEASURE type. |
| LSL Value | `LSL_VALUE` | Lower specification limit. Used with USL for range judgment in MEASURE type. |
| USL Value | `USL_VALUE` | Upper specification limit. Used with LSL for range judgment in MEASURE type. |
| Worker QR Code | `WORKER_QR_CODE` | Matching code value for QR scan in worker inspection (WORKER type). |
| Image | `IMAGE_URL` | Inspection item image. Stored at `/uploads/equip-inspect-items/`. 5MB limit, jpeg/png/gif/webp. |
| Use Flag | `USE_YN` | Only `Y` shown in pool selection list. |
| Remark | `REMARK` | Notes. |
| Audit | `CREATED_BY`, `UPDATED_BY`, `CREATED_AT`, `UPDATED_AT` | Creation/update history. |
| Multi-tenancy | `COMPANY`, `PLANT_CD` | PK component. `40` / `1000` scope. |

## ② Equipment-Item Assignment — EQUIP_INSPECT_ITEM_POOL (All Columns)

| Screen Field | DB Column | Role / Meaning · Operational Notes |
|------|------|------|
| Equipment Code | `EQUIP_CODE` | PK. References `EQUIPMENTS.EQUIP_CODE`. Selected from left equipment list. |
| Item Code | `ITEM_CODE` | PK. References `EQUIP_INSPECT_ITEM_MASTERS.ITEM_CODE`. |
| Inspection Type | `INSPECT_TYPE` | PK. `DAILY`/`PERIODIC`/`PM`/`WORKER`. Organized by tabs. |
| Sort Sequence | `SORT_SEQ` | Sort order (ASC). Lower numbers appear first. |
| Use Flag | `USE_YN` | Only `Y` active in inspection screens. |
| Audit | `CREATED_BY`, `UPDATED_BY`, `CREATED_AT`, `UPDATED_AT` | Creation/update history. |
| Multi-tenancy | `COMPANY`, `PLANT_CD` | PK component. `40` / `1000` scope. |

> Pool uses a 5-part composite PK (COMPANY + PLANT_CD + EQUIP_CODE + ITEM_CODE + INSPECT_TYPE). Duplicate registration returns 409 Conflict. The same item can be registered under different inspection types for the same equipment (e.g., DAILY + PERIODIC simultaneously).

## Inspection Item Registration Procedure

1. **Register Master** (prerequisite): Register item code, name, type, criteria in the item pool (`POST /master/equip-inspect-item-masters`)
2. **Select Equipment**: Click target equipment in the left equipment list (grouped by equipment type, searchable)
3. **Switch Tab**: Select the target inspection type tab (DAILY/PERIODIC/PM/WORKER)
4. **Add Items**: Click `Add Inspection Item` button → multi-select items in the right panel → `Bulk Register`
5. **Adjust Order**: Control display order with `SORT_SEQ` value (pass sortSeq in DTO when modifying)
6. **Print QR Label**: Print QR code label for inspection items (`InspectItemLabelModal` — 60mm x 55mm)

> Already-registered items show a `Registered` badge and are disabled in the add panel to prevent duplicate selection.

## Prerequisites (Master·Common Code)
- Common code: `EQUIP_TYPE` (Equipment type)
- Equipment master (`EQUIPMENTS`): Data source for the left equipment list. Equipment must be registered first to appear on screen.
- Inspection item master (`EQUIP_INSPECT_ITEM_MASTERS`): Must be registered before pool assignment.

## Operating Procedure
1. Register inspection items in the item master (item code, name, type, criteria).
2. On the equipment inspection items screen, select equipment and add required items to the pool per type tab.
3. When inspection items change during operation, reflect changes by adding/removing from Pool.
4. For discontinued items, either delete from Pool or set `USE_YN='N'` (inactivation recommended for history preservation).

## Permissions
Reference data administrator (master create/update/delete, pool assign/remove). General users can only view.

## Troubleshooting
| Symptom | Cause | Action |
|------|------|------|
| Left equipment list empty | No equipment registered in `EQUIPMENTS` | Register equipment in equipment master first |
| No items in add panel | No items registered for that inspection type in master | Register items in master screen (`/master/equip-inspect-item`) |
| Equipment type dropdown empty | Common code `EQUIP_TYPE` not configured | Register equipment type codes in common codes |
| 409 error on pool save | Duplicate (equip+item+type) combination exists | Register under different type or activate existing item |
| Item not showing in inspection screen | Pool `USE_YN='N'` or wrong inspection type | Check pool use flag and inspection type |
| Image upload fails | File exceeds 5MB or invalid format (only jpeg/png/gif/webp) | Check file size and format |
| `SORT_SEQ` not applied | `sortSeq` not passed during registration | Include sortSeq in registration DTO or request separate update |

## Data & Integration
- Tables: `EQUIP_INSPECT_ITEM_MASTERS`, `EQUIP_INSPECT_ITEM_POOL`, `EQUIP_INSPECT_LOGS`
- Integration: Equipment master (`EQUIPMENTS`), Daily inspection (`/equipment/daily-inspect`), Periodic inspection (`/equipment/periodic-inspect`), Inspection calendar (`/equipment/inspect-calendar`), Inspection history (`/equipment/inspect-history`)
- Related APIs: `GET /master/equip-inspect-items`, `POST /master/equip-inspect-items`, `DELETE /master/equip-inspect-items/:equipCode/:itemCode/:inspectType`
- Related APIs (master): `GET /master/equip-inspect-item-masters`, `POST /master/equip-inspect-item-masters`, `PUT /master/equip-inspect-item-masters/:itemCode`, `DELETE /master/equip-inspect-item-masters/:itemCode`
- Image storage: `./uploads/equip-inspect-items/` (5MB, jpeg/png/gif/webp)
- Scope: `COMPANY='40'`, `PLANT_CD='1000'`
