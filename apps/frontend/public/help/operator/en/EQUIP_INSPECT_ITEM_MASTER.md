---
menuCode: EQUIP_INSPECT_ITEM_MASTER
audience: operator
title: Inspection Item Master — Operations Guide
summary: Complete columns of the EQUIP_INSPECT_ITEM_MASTERS table, inspection item attributes, image upload structure, and troubleshooting
tags: [설비, 점검, 항목, 마스터, 운영, 기준정보]
keywords: [EQUIP_INSPECT_ITEM_MASTERS, ITEM_CODE, INSPECT_TYPE, ITEM_TYPE, VISUAL, MEASURE, LSL_VALUE, USL_VALUE, CYCLE, IMAGE_URL, WORKER_QR_CODE, 설비점검, EQUIP_TYPE, COM_CODES]
related: [EQUIP_INSPECT_ITEM]
---

# Inspection Item Master — Operations Guide

## System Purpose · Role
Stores and manages master data for all inspection items used for equipment inspection in the `EQUIP_INSPECT_ITEM_MASTERS` table. Each inspection item has attributes such as inspection type (DAILY/PERIODIC/PM/WORKER), judgment type (VISUAL/MEASURE), cycle, and judgment criteria (LSL/USL). They are linked to individual equipment in an N:M relationship via `EQUIP_INSPECT_ITEM_POOL` on the [Inspection Items by Equipment] screen.

## Data Structure
```
EQUIP_INSPECT_ITEM_MASTERS (PK: COMPANY + PLANT_CD + ITEM_CODE)
    │
    ├── Inspection Type (INSPECT_TYPE): DAILY / PERIODIC / PM / WORKER
    ├── Judgment Type (ITEM_TYPE): VISUAL (visual) / MEASURE (measurement)
    ├── Cycle (CYCLE): DAILY / WEEKLY / MONTHLY / QUARTERLY / SEMI_ANNUAL / ANNUAL
    ├── Judgment Criteria: CRITERIA (text) or LSL_VALUE + USL_VALUE + UNIT
    │
    └──▶ EQUIP_INSPECT_ITEM_POOL (N:M mapping)
            └── EQUIP_MASTERS (individual equipment)
```

---

## ① Inspection Item Master — EQUIP_INSPECT_ITEM_MASTERS (All Columns)

| Screen Field | DB Column | Role / Meaning · Operational Points |
|------|------|------|
| Item Code | `ITEM_CODE` | **PK (3/3)**. Inspection item identifier. Cannot be changed after registration (maintains mappings). Naming convention recommended: `EI-{EQUIP_TYPE}-{NNN}`. |
| Inspection Item Name | `ITEM_NAME` | Display name of the inspection item. `varchar2(200)`. |
| Inspection Type | `INSPECT_TYPE` | `DAILY` (daily inspection) / `PERIODIC` (periodic inspection) / `PM` (preventive maintenance) / `WORKER` (worker inspection). When mapping by equipment, only items of the same type can be linked. |
| Equipment Type | `EQUIP_TYPE` | References common code `EQUIP_TYPE` values. Specifies the range of equipment types to which this item applies. |
| Judgment Type | `ITEM_TYPE` | `VISUAL` (visual) = qualitative OK/NG judgment / `MEASURE` (measurement) = numerical measurement then LSL~USL range judgment. Default `VISUAL`. |
| Judgment Criteria | `CRITERIA` | VISUAL type: OK/NG judgment guide text. / MEASURE type: supplementary description (numerical criteria use LSL/USL). |
| Cycle | `CYCLE` | Inspection performance cycle. `DAILY` / `WEEKLY` / `MONTHLY` / `QUARTERLY` / `SEMI_ANNUAL` / `ANNUAL`. |
| Unit | `UNIT` | Unit of measurement for measurement type (MEASURE). Common code or free input. |
| Lower Limit Value | `LSL_VALUE` | Lower specification limit for measurement type. |
| Upper Limit Value | `USL_VALUE` | Upper specification limit for measurement type. |
| Worker QR Code | `WORKER_QR_CODE` | QR code value for worker inspection (WORKER). |
| Image URL | `IMAGE_URL` | Server path or URL of the inspection reference image. `varchar2(500)`. |
| Usage Status | `USE_YN` | `Y` (active) / `N` (inactive). If `N`, cannot be selected during equipment mapping. Default `Y`. |
| Remarks | `REMARK` | Management notes. `varchar2(500)`. |
| Multitenancy | `COMPANY`, `PLANT_CD` | **PK (1,2/3)**. Company code (`40`) / Plant code (`1000`) scope. |
| Created By | `CREATED_BY` | Original registrant. |
| Updated By | `UPDATED_BY` | Last modifier. |
| Created At | `CREATED_AT` | Record creation timestamp. |
| Updated At | `UPDATED_AT` | Record modification timestamp. |

---

## Image Upload Structure

| Item | Details |
|------|------|
| Upload API | `POST /master/equip-inspect-item-masters/{itemCode}/image` (multipart) |
| Delete API | `DELETE /master/equip-inspect-item-masters/{itemCode}/image` |
| Allowed Formats | `image/jpeg`, `image/png`, `image/gif`, `image/webp` |
| Max Size | 5MB |
| Storage Location | Server `./uploads/equip-inspect-items/` directory |

---

## Inspection Type Details

| Type | Code | Description | Cycle Example |
|------|------|------|---------|
| Daily Inspection | DAILY | Basic status check before daily work start | DAILY |
| Periodic Inspection | PERIODIC | Monthly/quarterly/semi-annual/annual periodic inspection | MONTHLY ~ ANNUAL |
| Preventive Maintenance | PM | Inspection during equipment preventive maintenance | MONTHLY ~ ANNUAL |
| Worker Inspection | WORKER | Inspection performed by the worker themselves (QR-based possible) | DAILY ~ MONTHLY |

## Judgment Criteria Input Method

| Judgment Type | Input Fields | Storage |
|---------|----------|------|
| VISUAL (visual) | criteria text input | Stored in `CRITERIA` column |
| MEASURE (measurement) | Unit (UNIT) + Lower Limit (LSL) + Upper Limit (USL) | Stored in `UNIT`, `LSL_VALUE`, `USL_VALUE`; `CRITERIA` for supplementary description |

## Permissions
Users with master data management privileges (equipment/quality administrators). General users can only view.

## Troubleshooting

| Symptom | Cause | Action |
|------|------|------|
| Item code duplication error | Same PK (COMPANY+PLANT_CD+ITEM_CODE) already exists | Register with a different code |
| Image upload failure | Exceeds 5MB or unsupported format | Check file size and format |
| Criteria values not visible for measurement type | LSL/USL not entered | Measurement type requires both upper and lower limits |
| Item not visible during equipment mapping | Item's `USE_YN='N'` or EQUIP_TYPE mismatch | Check usage status and equipment type |
| Worker inspection QR code not working | WORKER_QR_CODE not set | Enter QR code value and reissue QR label |

## Data · Relationships
- **Tables**: `EQUIP_INSPECT_ITEM_MASTERS` (master data), `EQUIP_INSPECT_ITEM_POOL` (equipment-item mapping), `EQUIP_INSPECT_LOGS` (inspection results)
- **Relationships**: Equipment master (`EQUIP_MASTERS`), common codes (`COM_CODES.EQUIP_TYPE`)
- **Scope**: `COMPANY='40'`, `PLANT_CD='1000'`
