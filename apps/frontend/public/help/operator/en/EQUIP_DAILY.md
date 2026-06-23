---
menuCode: EQUIP_DAILY
audience: operator
title: Daily Inspection — Operation Guide
summary: EQUIP_INSPECT_LOGS table DAILY type inspection, INTERLOCK mechanism, measurement type auto-judgment logic and troubleshooting
tags: [equipment, inspection, daily, operation, DAILY, result, interlock]
keywords: [EQUIP_INSPECT_LOGS, DAILY, daily-inspection-result, OVERALL_RESULT, INTERLOCK, VISUAL, MEASURE, LSL, USL, DETAILS, CLOB]
related: [EQUIP_INSPECT_CALENDAR, EQUIP_INSPECT_ITEM]
---

# Daily Inspection — Operation Guide

## System Purpose & Role
Register, view, and modify daily inspection results stored in the `EQUIP_INSPECT_LOGS` table with `INSPECT_TYPE='DAILY'`. If the inspection result is FAIL, the linked equipment status is automatically changed to **INTERLOCK** to restrict equipment operation.

## Data Structure
```
EQUIP_INSPECT_LOGS (PK: COMPANY + PLANT_CD + EQUIP_CODE + INSPECT_TYPE + INSPECT_DATE)
    │
    ├── INSPECT_TYPE = 'DAILY' (fixed)
    ├── OVERALL_RESULT = 'PASS' | 'FAIL' | 'CONDITIONAL'
    ├── DETAILS (CLOB): JSON array of item-by-item results
    ├── INSPECTOR_NAME & INSPECT_AT
    │
    ├──▶ EquipMaster.status = 'INTERLOCK' (automatic on FAIL)
    │
    └── Linked: EQUIP_INSPECT_ITEM_POOL → EQUIP_INSPECT_ITEM_MASTERS
              (DAILY inspection items for the equipment)
```

---

## ① Inspection Log — EQUIP_INSPECT_LOGS (Full Columns — DAILY)

| Screen Field | DB Column | Role / Meaning · Operational Note |
|------|------|------|
| Equipment Code | `EQUIP_CODE` | **PK (1/6)**. Individual equipment. |
| Inspection Type | `INSPECT_TYPE` | **PK (2/6)**. Fixed as `'DAILY'`. |
| Inspection Date | `INSPECT_DATE` | **PK (3/6)**. Date of inspection. |
| Work Order No. | `ORDER_NO` | For WORKER inspection (usually null for DAILY). |
| Work Date | `WORK_DATE` | Business key for DAILY inspection (work date basis). |
| Inspection Time | `INSPECT_AT` | Actual inspection completion time (TIMESTAMP). |
| Operation Start Time | `OP_WINDOW_START_AT` | Work start time of the day (linked to WorkCalendar). |
| Operation End Time | `OP_WINDOW_END_AT` | Work end time of the day (linked to WorkCalendar). |
| Inspector Name | `INSPECTOR_NAME` | Name of the person who performed the inspection. |
| Overall Result | `OVERALL_RESULT` | `PASS` / `FAIL` / `CONDITIONAL`. |
| Item-by-Item Result | `DETAILS` | CLOB — JSON array of item judgments. |
| Remarks | `REMARK` | Inspection-related notes. |
| Multi-tenancy | `COMPANY`, `PLANT_CD` | **PK (4,5,6/6)**. Company code (`40`) / Plant code (`1000`). |
| Created By | `CREATED_BY` | Initial registrar. |
| Updated By | `UPDATED_BY` | Last modifier. |
| Created At | `CREATED_AT` | Record creation time. |
| Updated At | `UPDATED_AT` | Record modification time. |

---

## DETAILS (CLOB) JSON Structure

Each item's inspection result is stored as a JSON array in the CLOB column:

```json
[
  {
    "itemCode": "EI-DAILY-001",
    "itemName": "Emergency stop button operation",
    "itemType": "VISUAL",
    "result": "PASS",
    "criteria": "Verify normal operation",
    "remark": "",
    "measureValue": null,
    "lsl": null,
    "usl": null
  },
  {
    "itemCode": "EI-DAILY-002",
    "itemName": "Main pressure gauge",
    "itemType": "MEASURE",
    "result": "FAIL",
    "criteria": "5.0 ~ 7.0 kgf/cm²",
    "remark": "Pressure 4.2, below lower limit",
    "measureValue": 4.2,
    "lsl": 5.0,
    "usl": 7.0
  }
]
```

---

## INTERLOCK Mechanism

| Condition | Action | Release Method |
|------|------|----------|
| `OVERALL_RESULT = 'FAIL'` | `EquipMaster.status` → `'INTERLOCK'` (automatic) | Requires separate release process |
| `OVERALL_RESULT = 'PASS'` | `EquipMaster.status` → `'NORMAL'` (automatic, if previous status was INTERLOCK) | Automatic |
| `OVERALL_RESULT = 'CONDITIONAL'` | No equipment status change | - |

---

## Auto-Judgment Logic

### Measurement Type (MEASURE) Auto-Judgment
```
if measureValue < LSL → FAIL (below lower limit)
if measureValue > USL → FAIL (exceeds upper limit)
if LSL <= measureValue <= USL → PASS (normal range)
```
- User can also manually select OK/NG

### Judgment Type (VISUAL)
- User directly selects OK or NG

---

## Permissions
Permission to input equipment inspection results (worker/equipment manager). All users can view.

## Troubleshooting

| Symptom | Cause | Action |
|------|------|------|
| Left equipment list is empty | DAILY inspection items not linked to the equipment | Add items from the equipment inspection items screen |
| Inspection save fails | Inspector not selected or item judgments not entered | Verify all required fields are entered |
| Equipment not in INTERLOCK after FAIL save | Service logic exception or transaction failure | Check logs and process INTERLOCK manually |
| Auto-judgment not working on measurement input | LSL/USL not set in master | Set LSL/USL in the inspection item master |
| Save button disabled | Inspector not selected or some item judgments missing | Ensure all fields are completed |
| Duplicate save for same equipment and date | Record already exists with inspection completed | Process as update (PUT) |

## Data & Links
- **Tables**: `EQUIP_INSPECT_LOGS` (inspection results), `EQUIP_INSPECT_ITEM_POOL` (mapping), `EQUIP_INSPECT_ITEM_MASTERS` (item standards), `EQUIP_MASTERS` (equipment status)
- **Links**: Shares data with work result screen popup, equipment INTERLOCK status change
- **Scope**: `COMPANY='40'`, `PLANT_CD='1000'`
